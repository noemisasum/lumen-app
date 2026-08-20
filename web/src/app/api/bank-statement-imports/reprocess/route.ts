import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { requireEntityAdmin } from "@/lib/server/orgs";
import {
  loadSingleStatementImport,
  loadStatementImportBatch,
  reprocessStatementImport,
  type ReprocessSummary,
  type StatementImportRow,
} from "@/lib/server/statement-import-reprocess";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

type ReprocessBody = {
  statementImportId?: string;
  entityId?: string;
  bankAccountId?: string;
  status?: string;
  limit?: unknown;
};

const defaultBatchLimit = 25;
const maxBatchLimit = 100;
const defaultBatchStatuses = ["pending_parse", "queued"] as const;
const supportedStatusFilters = new Set([...defaultBatchStatuses, "failed", "processing", "imported"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Statement import reprocessing is not configured.", missing }, { status: 500 });
}

function hasMaintenanceAccess(request: Request) {
  const secret = process.env.STATEMENT_REPROCESS_SECRET;
  if (!secret) return { configured: false, ok: false };

  const key = request.headers.get("x-lumen-maintenance-key") ?? "";
  const secretBuffer = Buffer.from(secret);
  const keyBuffer = Buffer.from(key);
  return {
    configured: true,
    ok: secretBuffer.length === keyBuffer.length && timingSafeEqual(secretBuffer, keyBuffer),
  };
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

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);
  const maintenanceAccess = hasMaintenanceAccess(request);
  if (!maintenanceAccess.configured) return missingEnvResponse(["STATEMENT_REPROCESS_SECRET"]);
  if (!maintenanceAccess.ok) {
    return NextResponse.json({ error: "Statement import reprocessing is restricted to maintenance operations." }, { status: 403 });
  }

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
      const row = await loadSingleStatementImport(supabase, statementImportId);
      if (!row) return NextResponse.json({ error: "Statement import not found." }, { status: 404 });
      await requireEntityAdmin(supabase, row.entity_id, user.id);
      rows = [row];
    } else {
      await requireEntityAdmin(supabase, entityId as string, user.id);
      rows = await loadStatementImportBatch(supabase, {
        entityId: entityId as string,
        bankAccountId,
        statuses: status,
        limit: parsedLimit.limit,
      });
    }

    const results: ReprocessSummary[] = [];
    for (const row of rows) {
      results.push(await reprocessStatementImport(supabase, row, "maintenance_reprocess"));
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
