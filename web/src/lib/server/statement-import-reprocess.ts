import type { SupabaseClient } from "@supabase/supabase-js";
import { parseManualStatementImport, type StatementParseOutcome } from "@/lib/server/statement-import-parser";
import { logSkippedStatementProcessing, type StatementProcessingTrigger } from "@/lib/server/statement-processing-log";

export type RawFileRow = {
  id: string;
  provider: string;
  bucket: string;
  object_key: string;
  mime_type: string | null;
  size_bytes: number | null;
  entity_id: string;
};

export type StatementImportRow = {
  id: string;
  entity_id: string;
  bank_account_id: string;
  raw_file_id: string | null;
  status: string;
  raw_file: RawFileRow | RawFileRow[] | null;
};

export type ReprocessSummary = {
  statementImportId: string;
  entityId: string;
  bankAccountId: string | null;
  status: StatementParseOutcome["status"] | "skipped";
  transactionCount: number;
  balanceCount: number;
  warning?: string;
  error?: string;
};

export const reprocessImportSelect =
  "id,entity_id,bank_account_id,raw_file_id,status,raw_file:invoice_files(id,provider,bucket,object_key,mime_type,size_bytes,entity_id)";

function firstRawFile(rawFile: StatementImportRow["raw_file"]) {
  return Array.isArray(rawFile) ? rawFile[0] ?? null : rawFile;
}

function summarize(row: StatementImportRow, outcome: StatementParseOutcome): ReprocessSummary {
  return {
    statementImportId: row.id,
    entityId: row.entity_id,
    bankAccountId: row.bank_account_id,
    status: outcome.status,
    transactionCount: outcome.transactionsParsed,
    balanceCount: outcome.balancesParsed,
    ...(outcome.status === "failed" ? { error: outcome.warning } : { warning: outcome.warning }),
  };
}

async function validateBankAccount(supabase: SupabaseClient, bankAccountId: string, entityId: string) {
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

async function skipped(
  supabase: SupabaseClient,
  row: StatementImportRow,
  trigger: StatementProcessingTrigger,
  error: string,
): Promise<ReprocessSummary> {
  await logSkippedStatementProcessing(supabase, {
    statementImportId: row.id,
    entityId: row.entity_id,
    bankAccountId: row.bank_account_id,
    rawFileId: row.raw_file_id,
    trigger,
    error,
  });
  return {
    statementImportId: row.id,
    entityId: row.entity_id,
    bankAccountId: row.bank_account_id,
    status: "skipped",
    transactionCount: 0,
    balanceCount: 0,
    error,
  };
}

export async function loadSingleStatementImport(supabase: SupabaseClient, statementImportId: string) {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select(reprocessImportSelect)
    .eq("id", statementImportId)
    .eq("source", "manual")
    .maybeSingle();
  if (error) throw error;
  return (data as StatementImportRow | null) ?? null;
}

export async function loadStatementImportBatch(
  supabase: SupabaseClient,
  input: { entityId: string; bankAccountId?: string; statuses: string[]; limit: number },
) {
  let query = supabase
    .from("bank_statement_imports")
    .select(reprocessImportSelect)
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

export async function loadStatementImportsNeedingAttention(
  supabase: SupabaseClient,
  input: { limit: number; maxAttempts: number },
) {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select(reprocessImportSelect)
    .eq("source", "manual")
    .in("status", ["queued", "pending_parse", "failed"])
    .lt("reprocess_attempt_count", input.maxAttempts)
    .or(`next_reprocess_after.is.null,next_reprocess_after.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(input.limit);

  if (error) throw error;
  return (data ?? []) as StatementImportRow[];
}

export async function recordAutomatedReprocessAttempt(
  supabase: SupabaseClient,
  row: StatementImportRow,
  summary: ReprocessSummary,
  input: { maxAttempts: number },
) {
  const failedOrStillWaiting = summary.status === "failed" || summary.status === "pending_parse" || summary.status === "skipped";
  const currentAttemptCount = await loadCurrentAttemptCount(supabase, row.id);
  const nextAttemptCount = failedOrStillWaiting ? Math.min(currentAttemptCount + 1, input.maxAttempts) : 0;
  const retryClosed = failedOrStillWaiting && nextAttemptCount >= input.maxAttempts;
  const { error } = await supabase
    .from("bank_statement_imports")
    .update({
      reprocess_attempt_count: nextAttemptCount,
      last_reprocess_attempt_at: new Date().toISOString(),
      next_reprocess_after: failedOrStillWaiting && !retryClosed ? nextBackoffAt(nextAttemptCount) : null,
      last_reprocess_error: failedOrStillWaiting ? summary.error ?? summary.warning ?? null : null,
    })
    .eq("id", row.id);

  if (error) throw error;
}

export async function reprocessStatementImport(
  supabase: SupabaseClient,
  row: StatementImportRow,
  trigger: StatementProcessingTrigger,
): Promise<ReprocessSummary> {
  const rawFile = firstRawFile(row.raw_file);
  if (rawFile && rawFile.entity_id !== row.entity_id) {
    return skipped(supabase, row, trigger, "Linked raw file belongs to a different entity.");
  }

  const hasAccount = await validateBankAccount(supabase, row.bank_account_id, row.entity_id);
  if (!hasAccount) {
    return skipped(supabase, row, trigger, "Bank account does not belong to the import entity or is archived.");
  }

  try {
    const outcome = await parseManualStatementImport(supabase, {
      statementImportId: row.id,
      entityId: row.entity_id,
      bankAccountId: row.bank_account_id,
      rawFileId: row.raw_file_id,
      bucket: rawFile?.provider === "supabase" ? rawFile.bucket : null,
      objectKey: rawFile?.provider === "supabase" ? rawFile.object_key : null,
      mimeType: rawFile?.mime_type ?? null,
      sizeBytes: rawFile?.size_bytes ?? null,
      trigger,
    });
    return summarize(row, outcome);
  } catch (error) {
    return skipped(
      supabase,
      row,
      trigger,
      error instanceof Error && error.message ? error.message : "Failed to reprocess statement import.",
    );
  }
}

async function loadCurrentAttemptCount(supabase: SupabaseClient, statementImportId: string) {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("reprocess_attempt_count")
    .eq("id", statementImportId)
    .maybeSingle();
  if (error) throw error;
  return Math.max(0, Number((data as { reprocess_attempt_count?: number } | null)?.reprocess_attempt_count ?? 0));
}

function nextBackoffAt(multiplier: number) {
  const date = new Date();
  date.setHours(date.getHours() + Math.max(1, multiplier * 6));
  return date.toISOString();
}
