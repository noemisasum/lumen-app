import { NextResponse } from "next/server";
import { requireEntityAccess } from "@/lib/server/orgs";
import { parseManualStatementImport } from "@/lib/server/statement-import-parser";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

type CreateImportBody = {
  entityId?: string;
  bankAccountId?: string;
  rawFileId?: string;
};

type StatementImportRow = {
  id: string;
};

type StatementImportStatus = "queued" | "pending_parse" | "processing" | "imported" | "failed";

type StatementImportStatusRow = {
  id: string;
  raw_file_id: string | null;
  bank_account_id: string | null;
  status: StatementImportStatus;
  error_message: string | null;
  last_reprocess_error: string | null;
  created_at: string;
  updated_at: string;
};

type StatementImportLogRow = {
  statement_import_id: string;
  status: "started" | "imported" | "pending_parse" | "failed" | "skipped";
  transaction_count: number;
  balance_count: number;
  warning_message: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

type RawFileRow = {
  id: string;
  provider: string;
  bucket: string;
  object_key: string;
  mime_type: string | null;
  size_bytes: number | null;
};

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Statement imports are not configured.", missing }, { status: 500 });
}

function parseRawFileIds(requestUrl: URL) {
  const ids = requestUrl.searchParams
    .getAll("rawFileIds")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(ids)).slice(0, 100);
}

function serializeStatementImport(row: StatementImportStatusRow, latestLog?: StatementImportLogRow) {
  return {
    id: row.id,
    rawFileId: row.raw_file_id,
    bankAccountId: row.bank_account_id,
    status: row.status,
    errorMessage: row.error_message,
    lastReprocessError: row.last_reprocess_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestLog: latestLog
      ? {
          status: latestLog.status,
          transactionCount: latestLog.transaction_count,
          balanceCount: latestLog.balance_count,
          warningMessage: latestLog.warning_message,
          errorMessage: latestLog.error_message,
          startedAt: latestLog.started_at,
          finishedAt: latestLog.finished_at,
        }
      : null,
  };
}

async function loadStatementImport(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  rawFileId: string,
  bankAccountId: string,
  entityId: string,
) {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("id")
    .eq("raw_file_id", rawFileId)
    .eq("bank_account_id", bankAccountId)
    .eq("entity_id", entityId)
    .eq("source", "manual")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as StatementImportRow | null) ?? null;
}

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const requestUrl = new URL(request.url);
    const entityId = requestUrl.searchParams.get("entityId")?.trim();
    const rawFileIds = parseRawFileIds(requestUrl);

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });
    if (!rawFileIds.length) return NextResponse.json({ imports: [] });

    const supabase = getSupabaseServiceClient();
    await requireEntityAccess(supabase, entityId, user.id);

    const { data: imports, error: importsError } = await supabase
      .from("bank_statement_imports")
      .select("id,raw_file_id,bank_account_id,status,error_message,last_reprocess_error,created_at,updated_at")
      .eq("entity_id", entityId)
      .eq("source", "manual")
      .in("raw_file_id", rawFileIds)
      .order("created_at", { ascending: false });
    if (importsError) throw importsError;

    const importRows = (imports ?? []) as StatementImportStatusRow[];
    const importIds = importRows.map((row) => row.id);
    const latestLogsByImport: Record<string, StatementImportLogRow> = {};

    if (importIds.length) {
      const { data: logs, error: logsError } = await supabase
        .from("bank_statement_import_processing_logs")
        .select("statement_import_id,status,transaction_count,balance_count,warning_message,error_message,started_at,finished_at")
        .in("statement_import_id", importIds)
        .order("started_at", { ascending: false });

      if (!logsError) {
        for (const log of (logs ?? []) as StatementImportLogRow[]) {
          if (!latestLogsByImport[log.statement_import_id]) latestLogsByImport[log.statement_import_id] = log;
        }
      }
    }

    return NextResponse.json({
      imports: importRows.map((row) => serializeStatementImport(row, latestLogsByImport[row.id])),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to load statement imports." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as CreateImportBody;
    const entityId = body.entityId?.trim();
    const bankAccountId = body.bankAccountId?.trim();
    const rawFileId = body.rawFileId?.trim();

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });
    if (!bankAccountId) return NextResponse.json({ error: "Choose a bank account." }, { status: 400 });
    if (!rawFileId) return NextResponse.json({ error: "Missing uploaded file reference." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireEntityAccess(supabase, entityId, user.id);

    const { data: account, error: accountError } = await supabase
      .from("entity_bank_accounts")
      .select("id")
      .eq("id", bankAccountId)
      .eq("entity_id", entityId)
      .neq("status", "archived")
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return NextResponse.json({ error: "Bank account does not belong to the selected entity." }, { status: 400 });

    const { data: file, error: fileError } = await supabase
      .from("invoice_files")
      .select("id,provider,bucket,object_key,mime_type,size_bytes")
      .eq("id", rawFileId)
      .eq("entity_id", entityId)
      .eq("created_by", user.id)
      .maybeSingle();
    if (fileError) throw fileError;
    if (!file) return NextResponse.json({ error: "Uploaded file does not belong to the selected entity." }, { status: 400 });
    const rawFile = file as RawFileRow;

    const existing = await loadStatementImport(supabase, rawFileId, bankAccountId, entityId);
    if (existing) {
      const parseResult = await parseManualStatementImport(supabase, {
        statementImportId: existing.id,
        entityId,
        bankAccountId,
        rawFileId,
        bucket: rawFile.provider === "supabase" ? rawFile.bucket : null,
        objectKey: rawFile.provider === "supabase" ? rawFile.object_key : null,
        mimeType: rawFile.mime_type,
        sizeBytes: rawFile.size_bytes,
      });
      return NextResponse.json({ ok: true, statementImportId: existing.id, parse: parseResult });
    }

    const { data: statementImport, error: createError } = await supabase
      .from("bank_statement_imports")
      .insert({
        entity_id: entityId,
        bank_account_id: bankAccountId,
        created_by: user.id,
        source: "manual",
        status: "pending_parse",
        raw_file_id: rawFileId,
      })
      .select("id")
      .single();
    if (createError) {
      if (createError.code === "23505") {
        const concurrent = await loadStatementImport(supabase, rawFileId, bankAccountId, entityId);
        if (concurrent) return NextResponse.json({ ok: true, statementImportId: concurrent.id });
      }
      throw createError;
    }
    if (!statementImport) throw new Error("Missing statement import row.");

    const parseResult = await parseManualStatementImport(supabase, {
      statementImportId: statementImport.id,
      entityId,
      bankAccountId,
      rawFileId,
      bucket: rawFile.provider === "supabase" ? rawFile.bucket : null,
      objectKey: rawFile.provider === "supabase" ? rawFile.object_key : null,
      mimeType: rawFile.mime_type,
      sizeBytes: rawFile.size_bytes,
    });

    return NextResponse.json({ ok: true, statementImportId: statementImport.id, parse: parseResult });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to create statement import." }, { status: 500 });
  }
}
