import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BankLedgerSource = "manual" | "xero" | "bank_feed";
export type BankTransactionDirection = "inflow" | "outflow" | "unknown";
export type BankTransactionStatus = "pending" | "posted" | "reconciled" | "voided" | "failed";
export type BankBalanceType = "opening" | "closing" | "available" | "current" | "statement" | "reported";

export type BankTransactionInput = {
  entityId: string;
  bankAccountId: string;
  source: BankLedgerSource;
  transactionDate: string;
  postedDate?: string | null;
  description?: string | null;
  payee?: string | null;
  reference?: string | null;
  amount: number;
  signedAmount: number;
  direction?: BankTransactionDirection;
  currency: string;
  externalId?: string | null;
  externalHash?: string | null;
  /**
   * Parser-provided stable row identity, such as CSV row index, FITID, or a
   * statement import line id. Required for manual/imported rows without an externalId.
   */
  sourceRowId?: string | number | null;
  sourceRecordType?: string | null;
  statementImportId?: string | null;
  entityXeroMappingId?: string | null;
  rawPayload?: unknown;
  status?: BankTransactionStatus;
};

export type BankBalanceInput = {
  entityId: string;
  bankAccountId: string;
  source: BankLedgerSource;
  balanceDate: string;
  asOf?: string | null;
  balanceType?: BankBalanceType;
  amount: number;
  currency: string;
  externalId?: string | null;
  externalHash?: string | null;
  /**
   * Parser-provided stable row identity, such as statement balance type/index.
   * Included in fallback hashes so repeated imported balances stay distinct.
   */
  sourceRowId?: string | number | null;
  sourceRecordType?: string | null;
  statementImportId?: string | null;
  entityXeroMappingId?: string | null;
  rawPayload?: unknown;
};

function isoDate(value: string) {
  const date = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid ledger date: ${value}`);
  }
  return date;
}

function compactText(value: string | null | undefined, maxLength: number) {
  const compacted = value?.trim().replace(/\s+/g, " ") ?? "";
  return compacted ? compacted.slice(0, maxLength) : null;
}

function currencyCode(value: string) {
  const normalized = value.trim().toUpperCase();
  const isSupportedCurrency = normalized === "CNH" || (/^[A-Z]{3}$/.test(normalized) && Intl.supportedValuesOf("currency").includes(normalized));
  if (!isSupportedCurrency) {
    throw new Error(`Invalid ledger currency: ${value}`);
  }
  return normalized;
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function signedDirection(signedAmount: number): BankTransactionDirection {
  if (signedAmount > 0) return "inflow";
  if (signedAmount < 0) return "outflow";
  return "unknown";
}

function normalizeAmount(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Ledger amount must be a finite number.");
  }
  return value;
}

function transactionHash(input: BankTransactionInput) {
  const externalIdMissing = input.externalId == null || input.externalId.trim() === "";
  const sourceRowIdMissing = input.sourceRowId == null || (typeof input.sourceRowId === "string" && input.sourceRowId.trim() === "");

  if ((input.source === "manual" || input.source === "bank_feed") && externalIdMissing && sourceRowIdMissing) {
    throw new Error("Manual or imported ledger transactions require externalId or sourceRowId for stable row identity.");
  }

  return hashPayload({
    source: input.source,
    externalId: input.externalId ?? null,
    sourceRowId: input.sourceRowId ?? null,
    statementImportId: input.statementImportId ?? null,
    bankAccountId: input.bankAccountId,
    transactionDate: isoDate(input.transactionDate),
    postedDate: input.postedDate ? isoDate(input.postedDate) : null,
    signedAmount: normalizeAmount(input.signedAmount),
    currency: currencyCode(input.currency),
    description: compactText(input.description, 500) ?? "",
    payee: compactText(input.payee, 240),
    reference: compactText(input.reference, 240),
  });
}

function balanceHash(input: BankBalanceInput) {
  return hashPayload({
    source: input.source,
    externalId: input.externalId ?? null,
    sourceRowId: input.sourceRowId ?? null,
    statementImportId: input.statementImportId ?? null,
    bankAccountId: input.bankAccountId,
    balanceDate: isoDate(input.balanceDate),
    balanceType: input.balanceType ?? "reported",
    amount: normalizeAmount(input.amount),
    currency: currencyCode(input.currency),
  });
}

export function normalizeBankTransaction(input: BankTransactionInput) {
  const signedAmount = normalizeAmount(input.signedAmount);
  const amount = normalizeAmount(input.amount);

  return {
    entity_id: input.entityId,
    bank_account_id: input.bankAccountId,
    statement_import_id: input.statementImportId ?? null,
    entity_xero_mapping_id: input.entityXeroMappingId ?? null,
    source: input.source,
    source_record_type: compactText(input.sourceRecordType, 80),
    transaction_date: isoDate(input.transactionDate),
    posted_date: input.postedDate ? isoDate(input.postedDate) : null,
    description: compactText(input.description, 500) ?? "",
    payee: compactText(input.payee, 240),
    reference: compactText(input.reference, 240),
    amount: Math.abs(amount),
    signed_amount: signedAmount,
    direction: input.direction ?? signedDirection(signedAmount),
    currency: currencyCode(input.currency),
    external_id: compactText(input.externalId, 240),
    external_hash: input.externalHash ?? transactionHash(input),
    raw_payload: input.rawPayload ?? {},
    status: input.status ?? "posted",
    updated_at: new Date().toISOString(),
  };
}

export function normalizeBankBalance(input: BankBalanceInput) {
  return {
    entity_id: input.entityId,
    bank_account_id: input.bankAccountId,
    statement_import_id: input.statementImportId ?? null,
    entity_xero_mapping_id: input.entityXeroMappingId ?? null,
    source: input.source,
    source_record_type: compactText(input.sourceRecordType, 80),
    balance_date: isoDate(input.balanceDate),
    as_of: input.asOf ?? new Date().toISOString(),
    balance_type: input.balanceType ?? "reported",
    amount: normalizeAmount(input.amount),
    currency: currencyCode(input.currency),
    external_id: compactText(input.externalId, 240),
    external_hash: input.externalHash ?? balanceHash(input),
    raw_payload: input.rawPayload ?? {},
    updated_at: new Date().toISOString(),
  };
}

export async function upsertBankTransactions(supabase: SupabaseClient, inputs: BankTransactionInput[]) {
  if (!inputs.length) return { count: 0 };

  const rows = inputs.map(normalizeBankTransaction);
  const { error } = await supabase.from("bank_account_transactions").upsert(rows, {
    onConflict: "bank_account_id,source,external_hash",
  });
  if (error) throw error;

  return { count: rows.length };
}

export async function upsertBankBalances(supabase: SupabaseClient, inputs: BankBalanceInput[]) {
  if (!inputs.length) return { count: 0 };

  const rows = inputs.map(normalizeBankBalance);
  const { error } = await supabase.from("bank_account_balances").upsert(rows, {
    onConflict: "bank_account_id,source,external_hash",
  });
  if (error) throw error;

  return { count: rows.length };
}
