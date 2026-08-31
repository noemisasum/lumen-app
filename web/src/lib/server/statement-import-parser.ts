import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertBankBalances, upsertBankTransactions } from "@/lib/server/bank-ledger";
import {
  finishStatementProcessingLog,
  startStatementProcessingLog,
  type StatementProcessingTrigger,
} from "@/lib/server/statement-processing-log";
import { parseCsvStatement } from "@/lib/server/statement-csv-parser";
import { parseExcelStatement, parseLegacyExcelStatement } from "@/lib/server/statement-excel-parser";
import { statementParserType } from "@/lib/server/statement-file-type";
import { isNotBankStatementPdfError, isUnsupportedPdfStatementLayoutError, parsePdfStatement } from "@/lib/server/statement-pdf-parser";
import {
  appendValidationWarnings,
  duplicatePeriodMessage,
  findOverlappingImportedStatement,
  loadStatementValidationContext,
  statementPeriodFromParsed,
  validateStatementContext,
  StatementImportValidationError,
  type StatementPeriod,
} from "@/lib/server/statement-import-validation";

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

const maxStatementBytes = 8 * 1024 * 1024;

export async function parseManualStatementImport(
  supabase: SupabaseClient,
  input: {
    statementImportId: string;
    entityId: string;
    bankAccountId: string;
    rawFileId?: string | null;
    bucket?: string | null;
    objectKey?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    trigger?: StatementProcessingTrigger;
  },
): Promise<StatementParseOutcome> {
  const processingLog = await startStatementProcessingLog(supabase, {
    statementImportId: input.statementImportId,
    entityId: input.entityId,
    bankAccountId: input.bankAccountId,
    rawFileId: input.rawFileId || null,
    trigger: input.trigger ?? "manual_upload",
  });

  async function finishLog(outcome: StatementParseOutcome) {
    try {
      await finishStatementProcessingLog(supabase, {
        logId: processingLog.id,
        status: outcome.status,
        transactionCount: outcome.transactionsParsed,
        balanceCount: outcome.balancesParsed,
        warning: outcome.status === "failed" ? null : outcome.warning,
        error: outcome.status === "failed" ? outcome.warning : null,
      });
    } catch (error) {
      console.error("Failed to finish statement processing log", error);
    }
    return outcome;
  }

  try {
    const file = await loadRawFile(supabase, input);
    if (!file) {
      return finishLog(await updateImportStatus(supabase, input.statementImportId, "pending_parse", "Raw file is unavailable for automatic parsing."));
    }

    const parserType = statementParserType(file.object_key, file.mime_type);
    if (!parserType) {
      return finishLog(
        await updateImportStatus(
          supabase,
          input.statementImportId,
          "pending_parse",
          "Automatic parsing currently supports CSV, XLSX, PDF, and supported legacy XLS statements. Image statements remain queued for manual parser support.",
        ),
      );
    }

    const sizeBytes = Number(file.size_bytes ?? input.sizeBytes ?? 0);
    if (sizeBytes > maxStatementBytes) {
      return finishLog(
        await updateImportStatus(
          supabase,
          input.statementImportId,
          "pending_parse",
          "Statement file is larger than the current automatic parser limit and remains queued.",
        ),
      );
    }

    await setImportProcessing(supabase, input.statementImportId);

    const fileBuffer = await downloadFileBuffer(supabase, file.bucket, file.object_key);
    const validationContext = await loadStatementValidationContext(supabase, {
      entityId: input.entityId,
      bankAccountId: input.bankAccountId,
    });
    const accountCurrency = validationContext.accountCurrency || "USD";
    const parserInput = {
      statementImportId: input.statementImportId,
      entityId: input.entityId,
      bankAccountId: input.bankAccountId,
      defaultCurrency: accountCurrency,
      fileName: file.object_key.split("/").at(-1) ?? file.object_key,
    };
    const parsed =
      parserType === "csv"
        ? parseCsvStatement(new TextDecoder("utf-8").decode(fileBuffer).replace(/^\uFEFF/, ""), parserInput)
        : parserType === "xlsx"
          ? await parseExcelStatement(fileBuffer, parserInput)
          : parserType === "xls"
            ? parseLegacyExcelStatement(fileBuffer, parserInput)
            : await parsePdfStatement(fileBuffer, parserInput);
    const validationWarnings = parserType === "pdf" ? validateStatementContext(parsed.metadata, validationContext) : [];
    const validated = appendValidationWarnings(parsed, validationWarnings);
    const statementPeriod = statementPeriodFromParsed(validated);
    if (statementPeriod) {
      const duplicate = await findOverlappingImportedStatement(supabase, {
        statementImportId: input.statementImportId,
        bankAccountId: input.bankAccountId,
        period: statementPeriod,
      });
      if (duplicate) {
        return finishLog(await failImportStatus(supabase, input.statementImportId, duplicatePeriodMessage(statementPeriod, duplicate.id)));
      }
    }

    const transactionResult = await upsertBankTransactions(supabase, validated.transactions);
    const balanceResult = await upsertBankBalances(supabase, validated.balances);
    const warning = compactWarning(validated.warnings);
    const outcome = await updateImportStatus(supabase, input.statementImportId, "imported", warning ?? null, {
      transactionsParsed: transactionResult.count,
      balancesParsed: balanceResult.count,
      statementPeriod,
    });
    return finishLog(outcome);
  } catch (error) {
    const message = getErrorMessage(error, "Failed to parse statement.");
    if (isUnsupportedPdfStatementLayoutError(error)) {
      return finishLog(await updateImportStatus(supabase, input.statementImportId, "pending_parse", message));
    }
    if (isNotBankStatementPdfError(error) || error instanceof StatementImportValidationError) {
      return finishLog(await failImportStatus(supabase, input.statementImportId, message));
    }
    return finishLog(await failImportStatus(supabase, input.statementImportId, message));
  }
}

async function loadRawFile(
  supabase: SupabaseClient,
  input: {
    rawFileId?: string | null;
    entityId: string;
    bucket?: string | null;
    objectKey?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  },
) {
  if (input.bucket && input.objectKey) {
    return {
      id: input.rawFileId ?? "uploaded-file",
      provider: "supabase",
      bucket: input.bucket,
      object_key: input.objectKey,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
    } satisfies RawFileRow;
  }

  if (!input.rawFileId) return null;

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

async function downloadFileBuffer(supabase: SupabaseClient, bucket: string, objectKey: string) {
  const { data, error } = await supabase.storage.from(bucket).download(objectKey);
  if (error) throw error;
  if (!data) throw new Error("Stored statement file could not be downloaded.");
  const buffer = await data.arrayBuffer();
  if (buffer.byteLength > maxStatementBytes) throw new Error("Statement file is larger than the current automatic parser limit.");
  return buffer;
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
  counts?: { transactionsParsed: number; balancesParsed: number; statementPeriod?: StatementPeriod | null },
): Promise<StatementParseOutcome> {
  const conciseMessage = message?.trim().slice(0, 500) || null;
  const retryFields =
    status === "imported"
      ? {
          reprocess_attempt_count: 0,
          last_reprocess_attempt_at: null,
          next_reprocess_after: null,
          last_reprocess_error: null,
        }
      : {};
  const { error } = await supabase
    .from("bank_statement_imports")
    .update({
      status,
      error_message: conciseMessage,
      ...(counts?.statementPeriod
        ? {
            statement_period_start: counts.statementPeriod.start,
            statement_period_end: counts.statementPeriod.end,
          }
        : {}),
      ...retryFields,
    })
    .eq("id", statementImportId);
  if (error) throw error;
  return {
    status,
    transactionsParsed: counts?.transactionsParsed ?? 0,
    balancesParsed: counts?.balancesParsed ?? 0,
    warning: conciseMessage ?? undefined,
  };
}

async function failImportStatus(supabase: SupabaseClient, statementImportId: string, message: string): Promise<StatementParseOutcome> {
  try {
    return await updateImportStatus(supabase, statementImportId, "failed", message);
  } catch (error) {
    const statusMessage = getErrorMessage(error, "Failed to mark statement import as failed.");
    return {
      status: "failed",
      transactionsParsed: 0,
      balancesParsed: 0,
      warning: `${message} ${statusMessage}`.trim().slice(0, 500),
    };
  }
}

function compactWarning(warnings: string[]) {
  const joined = warnings.map((warning) => warning.trim()).filter(Boolean).join(" ");
  return joined ? joined.slice(0, 500) : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
