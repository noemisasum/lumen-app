import { NextResponse } from "next/server";
import { requireEntityAdmin } from "@/lib/server/orgs";
import { parseManualStatementImport, type StatementParseOutcome } from "@/lib/server/statement-import-parser";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

type ReprocessBody = {
  statementImportId?: string;
  entityId?: string;
  bankAccountId?: string;
  status?: string;
  limit?: unknown;
};

type RawFileRow = {
  id: string;
  provider: string;
  bucket: string;
  object_key: string;
  mime_type: string | null;
  size_bytes: number | null;
  entity_id: string;
};

type StatementImportRow = {
  id: string;
  entity_id: string;
  bank_account_id: string;
  raw_file_id: string | null;
  status: string;
  raw_file: RawFileRow | RawFileRow[] | null;
};

type ReprocessSummary = {
  statementImportId: string;
  status: StatementParseOutcome["status"] | "skipped";
  transactionCount: number;
  balanceCount: number;
  warning?: string;
  error?: string;
};

const defaultBatchLimit = 25;
const maxBatchLimit = 100;
const defaultBatchStatuses = ["pending_parse", "queued"] as const;
const supportedStatusFilters = new Set([...defaultBatchStatuses, "failed", "processing", "imported"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Statement import reprocessing is not configured.", missing }, { status: 500 });
}

type ParsedLimit = { limit: number; error?: never } | { limit?: never; error: NextResponse };

function parseLimit(value: unknown): ParsedLimit {
  if (value === undefined) return { limit: defaultBatchLimit };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > maxBatchLimit) {
    return {
      error: NextResponse.json({ error: `limit must be an integer between 1 and ${maxBatchLimit}.` }, { status: 400 }),
    };
  }
  return { limit: value };
}

function normalizeStatus(value: string | undefined) {
  const status = value?.trim();
  if (!status) return [...defaultBatchStatuses];
  return supportedStatusFilters.has(status) ? [status] : null;
}

function validateUuid(value: string | undefined, fieldName: string) {
  if (!value || uuidPattern.test(value)) return null;
  return NextResponse.json({ error: `${fieldName} must be a valid UUID.` }, { status: 400 });
}

function firstRawFile(rawFile: StatementImportRow["raw_file"]) {
  return Array.isArray(rawFile) ? rawFile[0] ?? null : rawFile;
}

function summarize(statementImportId: string, outcome: StatementParseOutcome): ReprocessSummary {
  return {
    statementImportId,
    status: outcome.status,
    transactionCount: outcome.transactionsParsed,
    balanceCount: outcome.balancesParsed,
    ...(outcome.status === "failed" ? { error: outcome.warning } : { warning: outcome.warning }),
  };
}

async function loadSingleImport(supabase: ReturnType<typeof getSupabaseServiceClient>, statementImportId: string) {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select(
      "id,entity_id,bank_account_id,raw_file_id,status,raw_file:invoice_files(id,provider,bucket,object_key,mime_type,size_bytes,entity_id)",
    )
    .eq("id", statementImportId)
    .eq("source", "manual")
    .maybeSingle();
  if (error) throw error;
  return (data as StatementImportRow | null) ?? null;
}

async function loadBatchImports(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  input: { entityId: string; bankAccountId?: string; statuses: string[]; limit: number },
) {
  let query = supabase
    .from("bank_statement_imports")
    .select(
      "id,entity_id,bank_account_id,raw_file_id,status,raw_file:invoice_files(id,provider,bucket,object_key,mime_type,size_bytes,entity_id)",
    )
    .eq("entity_id", input.entityId)
    .eq("source", "manual")
    .in("status", input.statuses)
    .order("created_at", { ascending: true })
    .limit(input.limit);

  if (input.bankAccountId) query = query.eq("bank_account_id", input.bankAccountId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as StatementImportRow[];
}

async function validateBankAccount(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  bankAccountId: string,
  entityId: string,
) {
  const { data, error } = await supabase
    .from("entity_bank_accounts")
    .select("id")
    .eq("id", bankAccountId)
    .eq("entity_id", entityId)
    .neq("status", "archived")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function reprocessImport(supabase: ReturnType<typeof getSupabaseServiceClient>, row: StatementImportRow): Promise<ReprocessSummary> {
  const rawFile = firstRawFile(row.raw_file);
  if (rawFile && rawFile.entity_id !== row.entity_id) {
    return {
      statementImportId: row.id,
      status: "skipped",
      transactionCount: 0,
      balanceCount: 0,
      error: "Linked raw file belongs to a different entity.",
    };
  }

  const hasAccount = await validateBankAccount(supabase, row.bank_account_id, row.entity_id);
  if (!hasAccount) {
    return {
      statementImportId: row.id,
      status: "skipped",
      transactionCount: 0,
      balanceCount: 0,
      error: "Bank account does not belong to the import entity or is archived.",
    };
  }

  try {
    const outcome = await parseManualStatementImport(supabase, {
      statementImportId: row.id,
      entityId: row.entity_id,
      bankAccountId: row.bank_account_id,
      rawFileId: row.raw_file_id ?? "",
      bucket: rawFile?.provider === "supabase" ? rawFile.bucket : null,
      objectKey: rawFile?.provider === "supabase" ? rawFile.object_key : null,
      mimeType: rawFile?.mime_type ?? null,
      sizeBytes: rawFile?.size_bytes ?? null,
    });
    return summarize(row.id, outcome);
  } catch (error) {
    return {
      statementImportId: row.id,
      status: "skipped",
      transactionCount: 0,
      balanceCount: 0,
      error: error instanceof Error && error.message ? error.message : "Failed to reprocess statement import.",
    };
  }
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as ReprocessBody;
    const statementImportId = body.statementImportId?.trim();
    const entityId = body.entityId?.trim();
    const bankAccountId = body.bankAccountId?.trim();
    const status = normalizeStatus(body.status);
    const parsedLimit = parseLimit(body.limit);

    if (!status) return NextResponse.json({ error: "Unsupported status filter for statement import reprocessing." }, { status: 400 });
    if (parsedLimit.error) return parsedLimit.error;
    const invalidStatementImportId = validateUuid(statementImportId, "statementImportId");
    if (invalidStatementImportId) return invalidStatementImportId;
    const invalidEntityId = validateUuid(entityId, "entityId");
    if (invalidEntityId) return invalidEntityId;
    const invalidBankAccountId = validateUuid(bankAccountId, "bankAccountId");
    if (invalidBankAccountId) return invalidBankAccountId;
    if (statementImportId && entityId) {
      return NextResponse.json({ error: "Use either statementImportId or an entity batch filter, not both." }, { status: 400 });
    }
    if (!statementImportId && !entityId) {
      return NextResponse.json({ error: "Choose a statement import or a Lumen entity to reprocess." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    let rows: StatementImportRow[];

    if (statementImportId) {
      const row = await loadSingleImport(supabase, statementImportId);
      if (!row) return NextResponse.json({ error: "Statement import not found." }, { status: 404 });
      await requireEntityAdmin(supabase, row.entity_id, user.id);
      rows = [row];
    } else {
      await requireEntityAdmin(supabase, entityId as string, user.id);
      rows = await loadBatchImports(supabase, {
        entityId: entityId as string,
        bankAccountId,
        statuses: status,
        limit: parsedLimit.limit,
      });
    }

    const results: ReprocessSummary[] = [];
    for (const row of rows) {
      results.push(await reprocessImport(supabase, row));
    }

    return NextResponse.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to reprocess statement imports." }, { status: 500 });
  }
}
