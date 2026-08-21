import { encryptJson, decryptJson } from "@/lib/server/crypto";
import { upsertBankBalances, upsertBankTransactions, type BankBalanceInput, type BankTransactionInput } from "@/lib/server/bank-ledger";
import { createXeroClient, getXeroEnvIssueNames, refreshXeroTokenSet, serializeTokenSet, type XeroTenant } from "@/lib/server/xero";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankTransaction, TokenSet } from "xero-node";

type EntityXeroMappingRow = {
  id: string;
  connection_id: string;
  connection_tenant_id: string;
  xero_tenant_id: string;
};

type XeroConnectionRow = {
  id: string;
  token_ciphertext: string;
};

type EntityBankAccountRow = {
  id: string;
  entity_id: string;
  entity_xero_mapping_id: string | null;
  xero_bank_account_id: string | null;
  account_name: string;
  currency: string | null;
  status: string;
};

type XeroAccount = {
  accountID?: string;
  name?: string;
  code?: string;
  status?: string;
  currencyCode?: string;
};

export type XeroBankLedgerSyncResult = {
  synced: boolean;
  accountsSynced: number;
  transactionsSynced: number;
  balancesSynced: number;
  fromDate: string;
  toDate: string;
  warning?: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIsoDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string | null | undefined, fallback: string) {
  const date = value?.trim().slice(0, 10) || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Xero sync dates must be YYYY-MM-DD.");
  }
  return date;
}

function xeroDateTime(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return `DateTime(${year}, ${month}, ${day})`;
}

function xeroDateWhere(fromDate: string, toDate: string) {
  return `Date >= ${xeroDateTime(fromDate)} && Date <= ${xeroDateTime(toDate)}`;
}

function signedXeroAmount(transaction: BankTransaction) {
  const total = Math.abs(Number(transaction.total ?? transaction.subTotal ?? 0));
  const type = String(transaction.type ?? "").toUpperCase();
  if (type.startsWith("SPEND")) return -total;
  if (type.startsWith("RECEIVE")) return total;
  return Number(transaction.total ?? 0);
}

function xeroTransactionStatus(transaction: BankTransaction): BankTransactionInput["status"] {
  const status = String(transaction.status ?? "").toUpperCase();
  if (status === "VOIDED" || status === "DELETED") return "voided";
  return transaction.isReconciled ? "reconciled" : "posted";
}

function xeroTransactionDescription(transaction: BankTransaction) {
  const lineDescription = transaction.lineItems?.map((item) => item.description).find(Boolean);
  return transaction.reference || transaction.contact?.name || lineDescription || "Xero bank transaction";
}

async function loadXeroContext(supabase: SupabaseClient, entityId: string) {
  const { data: mapping, error: mappingError } = await supabase
    .from("entity_xero_mappings")
    .select("id,connection_id,connection_tenant_id,xero_tenant_id")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (mappingError) throw mappingError;
  if (!mapping) return { warning: "This entity is not mapped to a Xero tenant." };

  const xeroIssues = getXeroEnvIssueNames();
  if (xeroIssues.length) return { warning: "Xero is not configured for bank ledger sync." };

  const mappingRow = mapping as EntityXeroMappingRow;
  const { data: connection, error: connectionError } = await supabase
    .from("xero_connections")
    .select("id,token_ciphertext")
    .eq("id", mappingRow.connection_id)
    .is("disconnected_at", null)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) return { warning: "The mapped Xero connection is no longer available." };

  const connectionRow = connection as XeroConnectionRow;
  const xero = createXeroClient();

  const tokenSet = await refreshXeroTokenSet(xero, decryptJson<TokenSet>(connectionRow.token_ciphertext));
  const encryptedTokenSet = encryptJson(serializeTokenSet(tokenSet));
  const { error: tokenUpdateError } = await supabase
    .from("xero_connections")
    .update({ token_ciphertext: encryptedTokenSet, updated_at: new Date().toISOString() })
    .eq("id", connectionRow.id)
    .is("disconnected_at", null)
    .select("id")
    .single();
  if (tokenUpdateError) {
    return { warning: "Xero refreshed credentials could not be saved. Reconnect Xero before syncing bank ledger data." };
  }

  const tenants = (await xero.updateTenants(false)) as XeroTenant[];
  const hasTenant = tenants.some((tenant) => tenant.tenantId === mappingRow.xero_tenant_id);
  if (!hasTenant) return { warning: "The mapped Xero tenant is not available on the active connection." };

  return { xero, mapping: mappingRow };
}

async function syncXeroBankAccounts(supabase: SupabaseClient, entityId: string, mapping: EntityXeroMappingRow, accounts: XeroAccount[]) {
  const rows = accounts
    .filter((account) => account.accountID && account.name)
    .map((account) => ({
      entity_id: entityId,
      entity_xero_mapping_id: mapping.id,
      xero_bank_account_id: account.accountID,
      account_name: account.name,
      currency: account.currencyCode ?? null,
      status: account.status === "ARCHIVED" ? "archived" : "active",
      updated_at: new Date().toISOString(),
    }));

  if (!rows.length) return 0;

  const { error } = await supabase.from("entity_bank_accounts").upsert(rows, { onConflict: "entity_id,xero_bank_account_id" });
  if (error) throw error;
  return rows.length;
}

async function loadSyncedBankAccounts(supabase: SupabaseClient, entityId: string, mappingId: string) {
  const { data, error } = await supabase
    .from("entity_bank_accounts")
    .select("id,entity_id,entity_xero_mapping_id,xero_bank_account_id,account_name,currency,status")
    .eq("entity_id", entityId)
    .eq("entity_xero_mapping_id", mappingId)
    .neq("status", "archived");
  if (error) throw error;
  return (data ?? []) as EntityBankAccountRow[];
}

function parseReportNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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

function xeroReportBalances(
  reportBody: unknown,
  accountsByXeroId: Map<string, EntityBankAccountRow>,
  accountsByName: Map<string, EntityBankAccountRow>,
  entityId: string,
  mappingId: string,
  balanceDate: string,
) {
  const balances: BankBalanceInput[] = [];
  for (const row of collectReportRows(reportBody)) {
    const cells = (row as { cells?: Array<{ value?: string | number | null; attributes?: Array<{ id?: string; value?: string }> }> }).cells ?? [];
    const firstValue = cells[0]?.value === null || cells[0]?.value === undefined ? undefined : String(cells[0].value).trim();
    const accountId = cells.flatMap((cell) => cell.attributes ?? []).find((attribute) => accountsByXeroId.has(attribute.value ?? ""))?.value;
    const account = (accountId ? accountsByXeroId.get(accountId) : null) ?? (firstValue ? accountsByName.get(firstValue.toLowerCase()) : null);
    if (!account) continue;

    const numericValues = cells.map((cell) => parseReportNumber(cell.value)).filter((value): value is number => value !== null);
    const amount = numericValues.at(-1);
    if (amount === undefined || !account.currency) continue;

    balances.push({
      entityId,
      bankAccountId: account.id,
      source: "xero",
      sourceRecordType: "xero_bank_summary_report",
      entityXeroMappingId: mappingId,
      balanceDate,
      balanceType: "reported",
      amount,
      currency: account.currency,
      externalId: `xero-bank-summary:${account.xero_bank_account_id}:${balanceDate}`,
      rawPayload: row,
    });
  }
  return balances;
}

function isMissingReportsScopeError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const response = (error as { response?: { statusCode?: number; status?: number; body?: unknown }; body?: unknown; message?: string }).response;
  const status = response?.statusCode ?? response?.status;
  const body = response?.body ?? (error as { body?: unknown }).body;
  const text = [JSON.stringify(body ?? ""), (error as { message?: string }).message ?? ""].join(" ").toLowerCase();

  return (status === 401 || status === 403) && (text.includes("scope") || text.includes("permission") || text.includes("forbidden"));
}

export async function syncXeroBankLedger(
  supabase: SupabaseClient,
  entityId: string,
  options: { fromDate?: string | null; toDate?: string | null } = {},
): Promise<XeroBankLedgerSyncResult> {
  const toDate = parseIsoDate(options.toDate, todayIsoDate());
  const fromDate = parseIsoDate(options.fromDate, daysAgoIsoDate(90));
  const context = await loadXeroContext(supabase, entityId);

  if (!("xero" in context) || !context.xero || !context.mapping) {
    return { synced: false, accountsSynced: 0, transactionsSynced: 0, balancesSynced: 0, fromDate, toDate, warning: context.warning };
  }

  const accountResponse = await context.xero.accountingApi.getAccounts(context.mapping.xero_tenant_id, undefined, 'Type=="BANK"');
  const xeroAccounts = ((accountResponse.body.accounts ?? []) as XeroAccount[]).filter((account) => account.accountID && account.name);
  const accountsSynced = await syncXeroBankAccounts(supabase, entityId, context.mapping, xeroAccounts);
  const lumenAccounts = await loadSyncedBankAccounts(supabase, entityId, context.mapping.id);
  const accountsByXeroId = new Map(lumenAccounts.flatMap((account) => (account.xero_bank_account_id ? [[account.xero_bank_account_id, account] as const] : [])));
  const accountsByName = new Map(lumenAccounts.map((account) => [account.account_name.toLowerCase(), account] as const));

  const transactions: BankTransactionInput[] = [];
  const pageSize = 100;
  for (let page = 1; page <= 100; page += 1) {
    const response = await context.xero.accountingApi.getBankTransactions(
      context.mapping.xero_tenant_id,
      undefined,
      xeroDateWhere(fromDate, toDate),
      "Date ASC",
      page,
      4,
      pageSize,
    );
    const pageTransactions = ((response.body.bankTransactions ?? []) as BankTransaction[]).filter((transaction) => {
      const xeroAccountId = transaction.bankAccount?.accountID;
      return Boolean(xeroAccountId && accountsByXeroId.has(xeroAccountId));
    });

    for (const transaction of pageTransactions) {
      const xeroAccountId = transaction.bankAccount?.accountID;
      const account = xeroAccountId ? accountsByXeroId.get(xeroAccountId) : null;
      if (!account || !transaction.date || !account.currency) continue;
      const signedAmount = signedXeroAmount(transaction);
      transactions.push({
        entityId,
        bankAccountId: account.id,
        source: "xero",
        sourceRecordType: "xero_bank_transaction",
        entityXeroMappingId: context.mapping.id,
        transactionDate: transaction.date,
        description: xeroTransactionDescription(transaction),
        payee: transaction.contact?.name ?? null,
        reference: transaction.reference ?? null,
        amount: Math.abs(signedAmount),
        signedAmount,
        currency: String(transaction.currencyCode ?? account.currency),
        externalId: transaction.bankTransactionID ?? null,
        rawPayload: transaction,
        status: xeroTransactionStatus(transaction),
      });
    }

    if ((response.body.bankTransactions ?? []).length < pageSize) break;
  }

  const transactionResult = await upsertBankTransactions(supabase, transactions);

  let balanceResult = { count: 0 };
  let warning: string | undefined;
  try {
    const reportResponse = await context.xero.accountingApi.getReportBankSummary(context.mapping.xero_tenant_id, fromDate, toDate);
    const balances = xeroReportBalances(reportResponse.body, accountsByXeroId, accountsByName, entityId, context.mapping.id, toDate);
    balanceResult = await upsertBankBalances(supabase, balances);
    if (!balances.length) warning = "Xero Bank Summary did not expose account balance rows that could be tied to synced bank accounts.";
  } catch (error) {
    warning = isMissingReportsScopeError(error)
      ? "Xero Bank Summary balances require the accounting.reports.read scope. Reconnect Xero, then sync again to import balance snapshots."
      : "Xero Bank Summary balances were unavailable; transactions were synced without balance snapshots.";
  }

  return {
    synced: true,
    accountsSynced,
    transactionsSynced: transactionResult.count,
    balancesSynced: balanceResult.count,
    fromDate,
    toDate,
    warning,
  };
}
