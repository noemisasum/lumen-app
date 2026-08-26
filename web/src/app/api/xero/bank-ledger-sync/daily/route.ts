import { NextResponse } from "next/server";
import {
  defaultXeroLedgerSyncWindowDays,
  hasInternalSecretAccess,
  isoDateDaysBefore,
  maxXeroLedgerSyncWindowDays,
  parseBoundedInteger,
} from "@/lib/server/maintenance-cron";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient } from "@/lib/server/supabase";
import { syncXeroBankLedger, type XeroBankLedgerSyncResult } from "@/lib/server/xero-bank-ledger";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type EntityXeroCronMappingRow = {
  entity_id: string;
  xero_tenant_id: string;
  entities?: { id: string; name: string; code: string | null } | Array<{ id: string; name: string; code: string | null }> | null;
};

type EntitySyncSummary = {
  entityId: string;
  entityName: string | null;
  entityCode: string | null;
  synced: boolean;
  accountsSynced: number;
  transactionsSynced: number;
  balancesSynced: number;
  fromDate: string;
  toDate: string;
  warning?: string;
  error?: string;
};

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Scheduled Xero bank ledger sync is not configured.", missing }, { status: 500 });
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeEntity(value: EntityXeroCronMappingRow["entities"]) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function loadActiveXeroMappedEntities(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("entity_xero_mappings")
    .select("entity_id,xero_tenant_id,entities!inner(id,name,code),xero_connections!inner(id,disconnected_at)")
    .is("xero_connections.disconnected_at", null)
    .order("entity_id", { ascending: true });
  if (error) throw error;

  const seen = new Set<string>();
  return ((data ?? []) as EntityXeroCronMappingRow[])
    .map((row) => ({ ...row, entity: normalizeEntity(row.entities) }))
    .filter((row) => {
      if (!row.entity_id || seen.has(row.entity_id)) return false;
      seen.add(row.entity_id);
      return true;
    })
    .map((row) => ({
      entityId: row.entity_id,
      entityName: row.entity?.name ?? null,
      entityCode: row.entity?.code ?? null,
      xeroTenantId: row.xero_tenant_id,
    }));
}

function summarizeSync(
  entity: Awaited<ReturnType<typeof loadActiveXeroMappedEntities>>[number],
  sync: XeroBankLedgerSyncResult,
): EntitySyncSummary {
  return {
    entityId: entity.entityId,
    entityName: entity.entityName,
    entityCode: entity.entityCode,
    synced: sync.synced,
    accountsSynced: sync.accountsSynced,
    transactionsSynced: sync.transactionsSynced,
    balancesSynced: sync.balancesSynced,
    fromDate: sync.fromDate,
    toDate: sync.toDate,
    ...(sync.warning ? { warning: sync.warning } : {}),
  };
}

function summarizeError(entity: Awaited<ReturnType<typeof loadActiveXeroMappedEntities>>[number], fromDate: string, toDate: string, error: unknown): EntitySyncSummary {
  return {
    entityId: entity.entityId,
    entityName: entity.entityName,
    entityCode: entity.entityCode,
    synced: false,
    accountsSynced: 0,
    transactionsSynced: 0,
    balancesSynced: 0,
    fromDate,
    toDate,
    error: error instanceof Error && error.message ? error.message : "Failed to sync Xero bank ledger.",
  };
}

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  const internalAccess = hasInternalSecretAccess({
    authorization: request.headers.get("authorization"),
    maintenanceKey: request.headers.get("x-lumen-maintenance-key"),
    cronSecret: process.env.CRON_SECRET,
    maintenanceSecret: process.env.XERO_LEDGER_SYNC_SECRET,
  });
  if (!internalAccess.configured) return missingEnvResponse(["CRON_SECRET or XERO_LEDGER_SYNC_SECRET"]);
  if (!internalAccess.ok) {
    return NextResponse.json({ error: "Scheduled Xero bank ledger sync is restricted to internal automation." }, { status: 403 });
  }

  const windowDays = parseBoundedInteger(
    process.env.XERO_LEDGER_SYNC_WINDOW_DAYS,
    defaultXeroLedgerSyncWindowDays,
    maxXeroLedgerSyncWindowDays,
  );
  const toDate = todayIsoDate();
  const fromDate = isoDateDaysBefore(toDate, windowDays);

  try {
    const supabase = getSupabaseServiceClient();
    const entities = await loadActiveXeroMappedEntities(supabase);
    const results: EntitySyncSummary[] = [];

    for (const entity of entities) {
      try {
        results.push(summarizeSync(entity, await syncXeroBankLedger(supabase, entity.entityId, { fromDate, toDate })));
      } catch (error) {
        console.error("Scheduled Xero bank ledger sync failed", { entityId: entity.entityId, error });
        results.push(summarizeError(entity, fromDate, toDate, error));
      }
    }

    const syncedCount = results.filter((result) => result.synced).length;
    const warningCount = results.filter((result) => result.warning && !result.error).length;
    const errorCount = results.filter((result) => result.error).length;

    return NextResponse.json({
      ok: errorCount === 0,
      entityCount: entities.length,
      syncedCount,
      warningCount,
      errorCount,
      windowDays,
      fromDate,
      toDate,
      totals: {
        accounts: results.reduce((sum, result) => sum + result.accountsSynced, 0),
        transactions: results.reduce((sum, result) => sum + result.transactionsSynced, 0),
        balances: results.reduce((sum, result) => sum + result.balancesSynced, 0),
      },
      results,
    });
  } catch (error) {
    console.error("Failed to run scheduled Xero bank ledger sync", error);
    return NextResponse.json({ error: "Failed to run scheduled Xero bank ledger sync." }, { status: 500 });
  }
}
