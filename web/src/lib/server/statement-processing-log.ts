import type { SupabaseClient } from "@supabase/supabase-js";

export type StatementProcessingTrigger = "manual_upload" | "maintenance_reprocess" | "maintenance_cron";
export type StatementProcessingLogStatus = "started" | "imported" | "pending_parse" | "failed" | "skipped";

type LogInput = {
  statementImportId: string;
  entityId: string;
  bankAccountId?: string | null;
  rawFileId?: string | null;
  trigger: StatementProcessingTrigger;
};

type FinishInput = {
  logId: string;
  status: Exclude<StatementProcessingLogStatus, "started">;
  transactionCount?: number;
  balanceCount?: number;
  warning?: string | null;
  error?: string | null;
};

function compactMessage(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 1000) || null;
}

export async function startStatementProcessingLog(supabase: SupabaseClient, input: LogInput) {
  const { data, error } = await supabase
    .from("bank_statement_import_processing_logs")
    .insert({
      statement_import_id: input.statementImportId,
      entity_id: input.entityId,
      bank_account_id: input.bankAccountId ?? null,
      raw_file_id: input.rawFileId ?? null,
      trigger: input.trigger,
      status: "started",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Missing statement processing log row.");
  return data as { id: string };
}

export async function finishStatementProcessingLog(supabase: SupabaseClient, input: FinishInput) {
  const { error } = await supabase
    .from("bank_statement_import_processing_logs")
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      transaction_count: input.transactionCount ?? 0,
      balance_count: input.balanceCount ?? 0,
      warning_message: compactMessage(input.warning),
      error_message: compactMessage(input.error),
    })
    .eq("id", input.logId);

  if (error) throw error;
}

export async function logSkippedStatementProcessing(supabase: SupabaseClient, input: LogInput & { error: string }) {
  const log = await startStatementProcessingLog(supabase, input);
  await finishStatementProcessingLog(supabase, {
    logId: log.id,
    status: "skipped",
    error: input.error,
  });
}
