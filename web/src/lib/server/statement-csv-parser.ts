import type { BankBalanceInput, BankTransactionInput } from "@/lib/server/bank-ledger";

export type ParsedStatementInput = {
  statementImportId: string;
  entityId: string;
  bankAccountId: string;
  defaultCurrency?: string | null;
  fileName?: string | null;
};

export type ParsedStatementResult = {
  transactions: BankTransactionInput[];
  balances: BankBalanceInput[];
  warnings: string[];
};

type CsvRow = {
  fields: string[];
  sourceRowNumber: number;
};

type ColumnMap = {
  date: number;
  postedDate?: number;
  description?: number;
  payee?: number;
  reference?: number;
  externalId?: number;
  amount?: number;
  debit?: number;
  credit?: number;
  currency?: number;
  balance?: number;
};

type ParsedTransactionRow = {
  transaction: BankTransactionInput;
  balance: BankBalanceInput | null;
};

const dateHeaders = ["date", "transaction date", "trans date", "posting date", "posted date", "value date", "effective date"];
const postedDateHeaders = ["posted date", "posting date", "value date"];
const descriptionHeaders = ["description", "details", "narrative", "memo", "transaction details", "particulars", "transaction description"];
const payeeHeaders = ["payee", "merchant", "counterparty", "beneficiary", "payer", "name"];
const referenceHeaders = ["reference", "ref", "transaction reference", "bank reference", "cheque number", "check number"];
const externalIdHeaders = ["fitid", "transaction id", "transaction identifier", "id", "unique id", "bank transaction id"];
const signedAmountHeaders = ["amount", "transaction amount", "signed amount", "net amount"];
const debitHeaders = ["debit", "withdrawal", "withdrawals", "payment", "payments", "money out", "outflow", "debit amount"];
const creditHeaders = ["credit", "deposit", "deposits", "receipt", "receipts", "money in", "inflow", "credit amount"];
const currencyHeaders = ["currency", "ccy", "currency code"];
const balanceHeaders = ["balance", "running balance", "available balance", "ledger balance", "closing balance"];

export function parseCsvStatement(csvText: string, input: ParsedStatementInput): ParsedStatementResult {
  const rows = parseCsv(csvText);
  const headerIndex = rows.findIndex((row) => row.fields.some((field) => field.trim()));
  if (headerIndex === -1) {
    throw new Error("CSV statement is empty.");
  }

  const headers = rows[headerIndex].fields.map(normalizeHeader);
  const columns = detectColumns(headers);
  const dataRows = rows.slice(headerIndex + 1);
  const transactions: BankTransactionInput[] = [];
  const balances: BankBalanceInput[] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    if (isBlankOrSummaryRow(row.fields)) continue;

    const parsed = parseTransactionRow(row, columns, input);
    if (!parsed) {
      skippedRows += 1;
      continue;
    }

    transactions.push(parsed.transaction);
    if (parsed.balance) balances.push(parsed.balance);
  }

  const warnings: string[] = [];
  if (skippedRows) {
    warnings.push(`Skipped ${skippedRows} row${skippedRows === 1 ? "" : "s"} with missing dates, amounts, or descriptions.`);
  }

  if (!transactions.length && !balances.length) {
    throw new Error("CSV statement did not contain valid transaction rows.");
  }

  return { transactions, balances, warnings };
}

function parseCsv(input: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowNumber = 1;
  let currentRowNumber = 1;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      fields.push(field);
      rows.push({ fields, sourceRowNumber: currentRowNumber });
      fields = [];
      field = "";
      if (char === "\r" && next === "\n") index += 1;
      rowNumber += 1;
      currentRowNumber = rowNumber;
    } else {
      field += char;
    }
  }

  if (inQuotes) throw new Error("CSV statement has an unterminated quoted field.");
  if (field || fields.length) {
    fields.push(field);
    rows.push({ fields, sourceRowNumber: currentRowNumber });
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function detectColumns(headers: string[]): ColumnMap {
  const date = findHeader(headers, dateHeaders);
  const amount = findHeader(headers, signedAmountHeaders);
  const debit = findHeader(headers, debitHeaders);
  const credit = findHeader(headers, creditHeaders);
  const description = findHeader(headers, descriptionHeaders);
  const payee = findHeader(headers, payeeHeaders);
  const reference = findHeader(headers, referenceHeaders);

  if (date === undefined) throw new Error("CSV statement is missing a transaction date column.");
  if (amount === undefined && debit === undefined && credit === undefined) {
    throw new Error("CSV statement is missing an amount column or debit/credit columns.");
  }
  if (description === undefined && payee === undefined && reference === undefined) {
    throw new Error("CSV statement is missing a description, payee, or reference column.");
  }

  return {
    date,
    postedDate: findHeader(headers, postedDateHeaders, date),
    description,
    payee,
    reference,
    externalId: findHeader(headers, externalIdHeaders),
    amount,
    debit,
    credit,
    currency: findHeader(headers, currencyHeaders),
    balance: findHeader(headers, balanceHeaders),
  };
}

function findHeader(headers: string[], candidates: string[], exclude?: number) {
  for (const candidate of candidates) {
    const index = headers.findIndex((header, headerIndex) => headerIndex !== exclude && header === candidate);
    if (index !== -1) return index;
  }

  for (const candidate of candidates) {
    const index = headers.findIndex((header, headerIndex) => headerIndex !== exclude && header.includes(candidate));
    if (index !== -1) return index;
  }

  return undefined;
}

function isBlankOrSummaryRow(fields: string[]) {
  const compact = fields.map((field) => field.trim()).filter(Boolean);
  if (!compact.length) return true;
  const joined = compact.join(" ").toLowerCase();
  return /^(opening|closing|available|current)?\s*balance\b/.test(joined) || /^(total|summary)\b/.test(joined);
}

function parseTransactionRow(row: CsvRow, columns: ColumnMap, input: ParsedStatementInput): ParsedTransactionRow | null {
  const transactionDate = parseDate(cell(row, columns.date));
  const signedAmount = parseSignedAmount(row, columns);
  const description = firstNonEmpty(cell(row, columns.description), cell(row, columns.payee), cell(row, columns.reference));
  if (!transactionDate || signedAmount === undefined || !description) return null;

  const postedDate = columns.postedDate === undefined ? null : parseDate(cell(row, columns.postedDate));
  const currency = normalizeCurrency(cell(row, columns.currency)) ?? normalizeCurrency(input.defaultCurrency) ?? "USD";
  const sourceRowId = `${input.statementImportId}:row:${row.sourceRowNumber}`;
  const reference = compact(cell(row, columns.reference));
  const payee = compact(cell(row, columns.payee));
  const explicitExternalId = compact(cell(row, columns.externalId));
  const balanceAmount = parseAmount(cell(row, columns.balance));

  const transaction: BankTransactionInput = {
    entityId: input.entityId,
    bankAccountId: input.bankAccountId,
    source: "manual",
    transactionDate,
    postedDate,
    description,
    payee,
    reference,
    amount: Math.abs(signedAmount),
    signedAmount,
    currency,
    externalId: explicitExternalId,
    sourceRowId,
    sourceRecordType: "csv_row",
    statementImportId: input.statementImportId,
    rawPayload: {
      fileName: input.fileName ?? null,
      sourceRowNumber: row.sourceRowNumber,
      fields: row.fields,
    },
  };

  const balance: BankBalanceInput | null =
    balanceAmount === undefined
      ? null
      : {
          entityId: input.entityId,
          bankAccountId: input.bankAccountId,
          source: "manual",
          balanceDate: postedDate ?? transactionDate,
          balanceType: "reported",
          amount: balanceAmount,
          currency,
          sourceRowId,
          sourceRecordType: "csv_running_balance",
          statementImportId: input.statementImportId,
          rawPayload: {
            fileName: input.fileName ?? null,
            sourceRowNumber: row.sourceRowNumber,
          },
        };

  return { transaction, balance };
}

function cell(row: CsvRow, index: number | undefined) {
  if (index === undefined) return "";
  return row.fields[index]?.trim() ?? "";
}

function firstNonEmpty(...values: string[]) {
  for (const value of values) {
    const compacted = compact(value);
    if (compacted) return compacted;
  }
  return null;
}

function compact(value: string | null | undefined) {
  const compacted = value?.trim().replace(/\s+/g, " ") ?? "";
  return compacted || null;
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function parseSignedAmount(row: CsvRow, columns: ColumnMap) {
  if (columns.amount !== undefined) {
    const amount = parseAmount(cell(row, columns.amount));
    if (amount !== undefined) return amount;
  }

  const debit = parseAmount(cell(row, columns.debit));
  const credit = parseAmount(cell(row, columns.credit));
  if (debit !== undefined && debit !== 0 && (credit === undefined || credit === 0)) return -Math.abs(debit);
  if (credit !== undefined && credit !== 0 && (debit === undefined || debit === 0)) return Math.abs(credit);
  if (debit !== undefined && credit !== undefined) return undefined;
  if (debit !== undefined) return -Math.abs(debit);
  if (credit !== undefined) return Math.abs(credit);
  return undefined;
}

function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^[-–—]$/.test(trimmed)) return undefined;
  const isParenthesized = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed
    .replace(/[()]/g, "")
    .replace(/[A-Z]{3}/gi, "")
    .replace(/[$£€¥HKDUSDSGDAUDCADNZD\s,]/g, "");
  if (!/^[+-]?\d*(?:\.\d+)?$/.test(normalized) || normalized === "" || normalized === "." || normalized === "+" || normalized === "-") {
    return undefined;
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return undefined;
  return isParenthesized ? -Math.abs(amount) : amount;
}

function parseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const named = trimmed.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-,\s](\d{2,4})$/);
  if (named) {
    const month = monthNumber(named[2]);
    if (!month) return null;
    return validIsoDate(normalizeYear(Number(named[3])), month, Number(named[1]));
  }

  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!slash) return null;
  const first = Number(slash[1]);
  const second = Number(slash[2]);
  const year = normalizeYear(Number(slash[3]));
  if (first > 12) return validIsoDate(year, second, first);
  return validIsoDate(year, first, second);
}

function normalizeYear(year: number) {
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

function monthNumber(value: string) {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const index = months.indexOf(value.slice(0, 3).toLowerCase());
  return index === -1 ? null : index + 1;
}

function validIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
