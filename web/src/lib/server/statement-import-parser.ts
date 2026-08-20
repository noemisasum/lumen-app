import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertBankBalances, upsertBankTransactions } from "@/lib/server/bank-ledger";
import { parseCsvStatement } from "@/lib/server/statement-csv-parser";

export type StatementParseOutcome = {
  status: "imported" | "pending_parse" | "failed";
  transactionsParsed: number;
  balancesParsed: number;
  warning?: string;
};

type RawFileRow = {
  id: string;
  provider: string;
  bucket: string;
  object_key: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type BankAccountRow = {
  currency: string | null;
};

const maxCsvBytes = 8 * 1024 * 1024;

export async function parseManualStatementImport(
  supabase: SupabaseClient,
  input: {
    statementImportId: string;
    entityId: string;
    bankAccountId: string;
    rawFileId: string;
    bucket?: string | null;
    objectKey?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  },
): Promise<StatementParseOutcome> {
  const file = await loadRawFile(supabase, input);
  if (!file) {
    return updateImportStatus(supabase, input.statementImportId, "pending_parse", "Raw file is unavailable for automatic parsing.");
  }

  if (!isCsvFile(file.object_key, file.mime_type)) {
    return updateImportStatus(
      supabase,
      input.statementImportId,
      "pending_parse",
      "Automatic parsing currently supports CSV statements only. PDF, image, and Excel statements remain queued for manual parser support.",
    );
  }

  const sizeBytes = Number(file.size_bytes ?? input.sizeBytes ?? 0);
  if (sizeBytes > maxCsvBytes) {
    return updateImportStatus(
      supabase,
      input.statementImportId,
      "pending_parse",
      "CSV statement is larger than the current automatic parser limit and remains queued.",
    );
  }

  await setImportProcessing(supabase, input.statementImportId);

  try {
    const csvText = await downloadText(supabase, file.bucket, file.object_key);
    const accountCurrency = await loadAccountCurrency(supabase, input.bankAccountId, input.entityId);
    const parsed = parseCsvStatement(csvText, {
      statementImportId: input.statementImportId,
      entityId: input.entityId,
      bankAccountId: input.bankAccountId,
      defaultCurrency: accountCurrency,
      fileName: file.object_key.split("/").at(-1) ?? file.object_key,
    });

    const transactionResult = await upsertBankTransactions(supabase, parsed.transactions);
    const balanceResult = await upsertBankBalances(supabase, parsed.balances);
    const warning = compactWarning(parsed.warnings);
    const outcome = await updateImportStatus(supabase, input.statementImportId, "imported", warning ?? null, {
      transactionsParsed: transactionResult.count,
      balancesParsed: balanceResult.count,
    });
    return outcome;
  } catch (error) {
    const message = getErrorMessage(error, "Failed to parse CSV statement.");
    return updateImportStatus(supabase, input.statementImportId, "failed", message);
  }
}

async function loadRawFile(
  supabase: SupabaseClient,
  input: {
    rawFileId: string;
    entityId: string;
    bucket?: string | null;
    objectKey?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  },
) {
  if (input.bucket && input.objectKey) {
    return {
      id: input.rawFileId,
      provider: "supabase",
      bucket: input.bucket,
      object_key: input.objectKey,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
    } satisfies RawFileRow;
  }

  const { data, error } = await supabase
    .from("invoice_files")
    .select("id,provider,bucket,object_key,mime_type,size_bytes")
    .eq("id", input.rawFileId)
    .eq("entity_id", input.entityId)
    .maybeSingle();
  if (error) throw error;
  const file = (data as RawFileRow | null) ?? null;
  if (!file || file.provider !== "supabase") return null;
  return file;
}

function isCsvFile(objectKey: string, mimeType: string | null) {
  const lowerKey = objectKey.toLowerCase();
  const lowerType = mimeType?.toLowerCase() ?? "";
  return lowerKey.endsWith(".csv") || lowerType.includes("csv") || lowerType === "text/plain";
}

async function downloadText(supabase: SupabaseClient, bucket: string, objectKey: string) {
  const { data, error } = await supabase.storage.from(bucket).download(objectKey);
  if (error) throw error;
  if (!data) throw new Error("Stored CSV statement could not be downloaded.");
  const buffer = await data.arrayBuffer();
  if (buffer.byteLength > maxCsvBytes) throw new Error("CSV statement is larger than the current automatic parser limit.");
  return new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
}

async function loadAccountCurrency(supabase: SupabaseClient, bankAccountId: string, entityId: string) {
  const { data, error } = await supabase
    .from("entity_bank_accounts")
    .select("currency")
    .eq("id", bankAccountId)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) throw error;
  return ((data as BankAccountRow | null)?.currency ?? null) || "USD";
}

async function setImportProcessing(supabase: SupabaseClient, statementImportId: string) {
  const { error } = await supabase
    .from("bank_statement_imports")
    .update({ status: "processing", error_message: null })
    .eq("id", statementImportId);
  if (error) throw error;
}

async function updateImportStatus(
  supabase: SupabaseClient,
  statementImportId: string,
  status: StatementParseOutcome["status"],
  message: string | null,
  counts?: { transactionsParsed: number; balancesParsed: number },
): Promise<StatementParseOutcome> {
  const conciseMessage = message?.trim().slice(0, 500) || null;
  const { error } = await supabase
    .from("bank_statement_imports")
    .update({ status, error_message: conciseMessage })
    .eq("id", statementImportId);
  if (error) throw error;
  return {
    status,
    transactionsParsed: counts?.transactionsParsed ?? 0,
    balancesParsed: counts?.balancesParsed ?? 0,
    warning: conciseMessage ?? undefined,
  };
}

function compactWarning(warnings: string[]) {
  const joined = warnings.map((warning) => warning.trim()).filter(Boolean).join(" ");
  return joined ? joined.slice(0, 500) : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
