import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedStatementMetadata, ParsedStatementResult } from "@/lib/server/statement-csv-parser";

export type StatementPeriod = {
  start: string;
  end: string;
};

export type StatementValidationContext = {
  entityName: string | null;
  entityCode: string | null;
  accountName: string | null;
  accountCurrency: string | null;
  xeroBankAccountId: string | null;
};

type ExistingImportPeriodRow = {
  id: string;
  statement_period_start: string | null;
  statement_period_end: string | null;
};

export class StatementImportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatementImportValidationError";
  }
}

export function statementPeriodFromParsed(parsed: ParsedStatementResult): StatementPeriod | null {
  const metadataPeriod = normalizePeriod(parsed.metadata?.statementPeriodStart ?? null, parsed.metadata?.statementPeriodEnd ?? null);
  if (metadataPeriod) return metadataPeriod;

  const dates = [
    ...parsed.transactions.map((transaction) => transaction.transactionDate),
    ...parsed.transactions.map((transaction) => transaction.postedDate ?? null),
    ...parsed.balances.map((balance) => balance.balanceDate),
  ]
    .map(normalizeIsoDate)
    .filter((date): date is string => Boolean(date))
    .sort();

  const start = dates.at(0);
  const end = dates.at(-1);
  return start && end ? { start, end } : null;
}

export function validateStatementContext(metadata: ParsedStatementMetadata | undefined, context: StatementValidationContext): string[] {
  const warnings: string[] = [];
  if (!metadata) {
    warnings.push("Statement metadata did not include account owner or account identifiers, so the selected account could not be verified automatically.");
    return warnings;
  }

  const holderNames = normalizedTextValues(metadata.accountHolderNames ?? []);
  const accountNames = normalizedTextValues(metadata.accountNames ?? []);
  const accountNumbers = normalizedAccountValues(metadata.accountNumbers ?? []);
  const expectedEntityValues = normalizedTextValues([context.entityName, context.entityCode]);
  const expectedAccountNameValues = normalizedTextValues([context.accountName]);
  const expectedAccountNumberValues = normalizedAccountValues(accountNumberCandidates(context));

  if (holderNames.length && expectedEntityValues.length && !holderNames.some((holder) => expectedEntityValues.some((expected) => textValuesMatch(holder, expected)))) {
    throw new StatementImportValidationError("Statement appears to belong to a different account holder or Lumen entity.");
  }

  if (accountNames.length && expectedAccountNameValues.length && !accountNames.some((name) => expectedAccountNameValues.some((expected) => textValuesMatch(name, expected)))) {
    throw new StatementImportValidationError("Statement account name does not match the selected Lumen bank account.");
  }

  if (accountNumbers.length && expectedAccountNumberValues.length && !accountNumbers.some((number) => expectedAccountNumberValues.some((expected) => accountValuesMatch(number, expected)))) {
    throw new StatementImportValidationError("Statement account number or identifier does not match the selected Lumen bank account.");
  }

  if (!holderNames.length && !accountNames.length && !accountNumbers.length) {
    warnings.push("Statement metadata did not include account owner or account identifiers, so the selected account could not be verified automatically.");
  }

  return warnings;
}

export async function loadStatementValidationContext(
  supabase: SupabaseClient,
  input: { entityId: string; bankAccountId: string },
): Promise<StatementValidationContext> {
  const { data: entity, error: entityError } = await supabase
    .from("entities")
    .select("name,code")
    .eq("id", input.entityId)
    .maybeSingle();
  if (entityError) throw entityError;

  const { data: account, error: accountError } = await supabase
    .from("entity_bank_accounts")
    .select("account_name,currency,xero_bank_account_id")
    .eq("id", input.bankAccountId)
    .eq("entity_id", input.entityId)
    .maybeSingle();
  if (accountError) throw accountError;

  const entityRow = (entity as { name: string | null; code: string | null } | null) ?? null;
  const accountRow = (account as { account_name: string | null; currency: string | null; xero_bank_account_id: string | null } | null) ?? null;

  return {
    entityName: entityRow?.name ?? null,
    entityCode: entityRow?.code ?? null,
    accountName: accountRow?.account_name ?? null,
    accountCurrency: accountRow?.currency ?? null,
    xeroBankAccountId: accountRow?.xero_bank_account_id ?? null,
  };
}

export async function findOverlappingImportedStatement(
  supabase: SupabaseClient,
  input: { statementImportId: string; bankAccountId: string; period: StatementPeriod },
) {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("id,statement_period_start,statement_period_end")
    .eq("bank_account_id", input.bankAccountId)
    .eq("source", "manual")
    .eq("status", "imported")
    .neq("id", input.statementImportId)
    .lte("statement_period_start", input.period.end)
    .gte("statement_period_end", input.period.start)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ExistingImportPeriodRow | null) ?? null;
}

export function duplicatePeriodMessage(period: StatementPeriod, existingImportId?: string | null) {
  const importSuffix = existingImportId ? ` Existing import: ${existingImportId}.` : "";
  return `A manual statement for ${period.start} to ${period.end} has already been imported for this bank account, or overlaps an imported statement period.${importSuffix}`;
}

export function statementPeriodsOverlap(left: StatementPeriod, right: StatementPeriod) {
  return left.start <= right.end && left.end >= right.start;
}

export function appendValidationWarnings(parsed: ParsedStatementResult, warnings: string[]) {
  const compactWarnings = warnings.map((warning) => warning.trim()).filter(Boolean);
  return compactWarnings.length ? { ...parsed, warnings: [...parsed.warnings, ...compactWarnings] } : parsed;
}

function normalizePeriod(start: string | null, end: string | null): StatementPeriod | null {
  const normalizedStart = normalizeIsoDate(start);
  const normalizedEnd = normalizeIsoDate(end);
  if (!normalizedStart || !normalizedEnd) return null;
  return normalizedStart <= normalizedEnd ? { start: normalizedStart, end: normalizedEnd } : { start: normalizedEnd, end: normalizedStart };
}

function normalizeIsoDate(value: string | null | undefined) {
  const trimmed = value?.trim().slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizedTextValues(values: Array<string | null | undefined>) {
  return values.map(normalizeText).filter((value): value is string => Boolean(value));
}

function normalizedAccountValues(values: Array<string | null | undefined>) {
  return values.map(normalizeAccountValue).filter((value): value is string => Boolean(value));
}

function accountNumberCandidates(context: StatementValidationContext) {
  return [context.accountName, context.xeroBankAccountId].filter((value): value is string => Boolean(value && /(?:\d.*){4,}/.test(value)));
}

function normalizeText(value: string | null | undefined) {
  const normalized = value
    ?.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(limited|ltd|incorporated|inc|company|co|corp|corporation|holdings|holding|hk|hong kong)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeAccountValue(value: string | null | undefined) {
  const normalized = value?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
  return normalized || null;
}

function textValuesMatch(actual: string, expected: string) {
  if (actual === expected) return true;
  if (actual.length >= 5 && expected.includes(actual)) return true;
  if (expected.length >= 5 && actual.includes(expected)) return true;
  return false;
}

function accountValuesMatch(actual: string, expected: string) {
  if (actual === expected) return true;
  if (actual.length >= 6 && expected.includes(actual)) return true;
  if (expected.length >= 6 && actual.includes(expected)) return true;
  const actualTail = actual.slice(-4);
  const expectedTail = expected.slice(-4);
  return actual.length >= 8 && expected.length >= 8 && actualTail === expectedTail;
}
