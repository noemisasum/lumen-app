import type { BankBalanceInput } from "./bank-ledger";

export type XeroReportBankAccount = {
  id: string;
  xero_bank_account_id: string | null;
  account_name: string;
};

type XeroOrganisation = {
  baseCurrency?: string | number | null;
};

function parseReportNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCurrencyCode(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

export function xeroOrganisationBaseCurrency(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const organisations = (body as { organisations?: unknown }).organisations;
  if (!Array.isArray(organisations)) return null;
  const baseCurrency = (organisations[0] as XeroOrganisation | undefined)?.baseCurrency;
  return normalizeCurrencyCode(baseCurrency);
}

function collectReportRows(value: unknown, rows: unknown[] = []) {
  if (!value || typeof value !== "object") return rows;
  const objectValue = value as { rows?: unknown; cells?: unknown };
  if (Array.isArray(objectValue.cells)) rows.push(value);
  if (Array.isArray(objectValue.rows)) {
    objectValue.rows.forEach((row) => collectReportRows(row, rows));
  }
  if ("reports" in objectValue && Array.isArray((objectValue as { reports?: unknown }).reports)) {
    (objectValue as { reports: unknown[] }).reports.forEach((report) => collectReportRows(report, rows));
  }
  return rows;
}

export function xeroReportBalances(
  reportBody: unknown,
  accountsByXeroId: Map<string, XeroReportBankAccount>,
  accountsByName: Map<string, XeroReportBankAccount>,
  entityId: string,
  mappingId: string,
  balanceDate: string,
  reportCurrency: string,
) {
  const balances: BankBalanceInput[] = [];
  const balanceCurrency = normalizeCurrencyCode(reportCurrency);
  if (!balanceCurrency) return balances;

  for (const row of collectReportRows(reportBody)) {
    const cells = (row as { cells?: Array<{ value?: string | number | null; attributes?: Array<{ id?: string; value?: string }> }> }).cells ?? [];
    const firstValue = cells[0]?.value === null || cells[0]?.value === undefined ? undefined : String(cells[0].value).trim();
    const accountId = cells.flatMap((cell) => cell.attributes ?? []).find((attribute) => accountsByXeroId.has(attribute.value ?? ""))?.value;
    const account = (accountId ? accountsByXeroId.get(accountId) : null) ?? (firstValue ? accountsByName.get(firstValue.toLowerCase()) : null);
    if (!account) continue;

    const numericValues = cells.map((cell) => parseReportNumber(cell.value)).filter((value): value is number => value !== null);
    const amount = numericValues.at(-1);
    if (amount === undefined) continue;

    balances.push({
      entityId,
      bankAccountId: account.id,
      source: "xero",
      sourceRecordType: "xero_bank_summary_report",
      entityXeroMappingId: mappingId,
      balanceDate,
      balanceType: "reported",
      amount,
      currency: balanceCurrency,
      externalId: `xero-bank-summary:${account.xero_bank_account_id}:${balanceDate}`,
      rawPayload: row,
    });
  }
  return balances;
}
