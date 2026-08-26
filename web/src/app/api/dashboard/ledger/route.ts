import { NextResponse } from "next/server";
import { requireEntityAccess } from "@/lib/server/orgs";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";
import { getUsdRatesForCurrencies } from "@/lib/server/fx-rates";
import {
  buildLedgerDashboardPayload,
  classifyLedgerAccountType,
  isMissingLedgerAccountTypeColumnError,
  shouldExcludeLedgerAccount,
  type LedgerAccountType,
  type LedgerDashboardAccount,
  type LedgerDashboardBalance,
  type LedgerDashboardEntity,
  type LedgerDashboardTransaction,
} from "@/lib/server/ledger-dashboard";

export const runtime = "nodejs";

type OrgMemberRow = {
  org_id: string;
  role: string;
};

type EntityMemberRow = {
  entity_id: string;
  role: string;
};

type EntityRow = {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  canAdmin: boolean;
};

type BankAccountRow = {
  id: string;
  entity_id: string;
  xero_bank_account_id: string | null;
  account_name: string;
  currency: string | null;
  account_type?: LedgerAccountType | "bank" | null;
  status: string;
};

type BankBalanceRow = {
  id: string;
  entity_id: string;
  bank_account_id: string;
  source: "manual" | "xero" | "bank_feed";
  balance_date: string;
  as_of: string;
  balance_type: string;
  amount: string | number;
  currency: string;
};

type BankTransactionRow = {
  id: string;
  entity_id: string;
  bank_account_id: string;
  source: "manual" | "xero" | "bank_feed";
  transaction_date: string;
  description: string;
  signed_amount: string | number;
  amount: string | number;
  direction: "inflow" | "outflow" | "unknown";
  currency: string;
  status: string;
};

type PagedLedgerQuery<T> = {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>;
};

const LEDGER_DASHBOARD_PAGE_SIZE = 1000;
const ACCOUNT_SELECT_WITH_TYPE = "id,entity_id,xero_bank_account_id,account_name,currency,account_type,status";
const ACCOUNT_SELECT_WITHOUT_TYPE = "id,entity_id,xero_bank_account_id,account_name,currency,status";

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Ledger dashboard is not configured.", missing }, { status: 500 });
}

function daysAgoIsoDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function accountSource(account: BankAccountRow): LedgerDashboardAccount["source"] {
  return account.xero_bank_account_id ? "xero" : "manual";
}

async function loadAllRows<T>(query: PagedLedgerQuery<T>) {
  const rows: T[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await query.range(offset, offset + LEDGER_DASHBOARD_PAGE_SIZE - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < LEDGER_DASHBOARD_PAGE_SIZE) return rows;
    offset += LEDGER_DASHBOARD_PAGE_SIZE;
  }
}

async function loadAccessibleEntities(supabase: ReturnType<typeof getSupabaseServiceClient>, userId: string) {
  const [orgMemberResult, entityMemberResult] = await Promise.all([
    supabase.from("org_members").select("org_id,role").eq("user_id", userId),
    supabase.from("entity_members").select("entity_id,role").eq("user_id", userId),
  ]);

  if (orgMemberResult.error) throw orgMemberResult.error;
  if (entityMemberResult.error) throw entityMemberResult.error;

  const orgIds = ((orgMemberResult.data ?? []) as OrgMemberRow[]).map((membership) => membership.org_id);
  const entityMemberIds = ((entityMemberResult.data ?? []) as EntityMemberRow[]).map((membership) => membership.entity_id);
  const orgRoleById = new Map(((orgMemberResult.data ?? []) as OrgMemberRow[]).map((membership) => [membership.org_id, membership.role]));
  const entityRoleById = new Map(((entityMemberResult.data ?? []) as EntityMemberRow[]).map((membership) => [membership.entity_id, membership.role]));

  const [orgEntityResult, directEntityResult] = await Promise.all([
    orgIds.length
      ? supabase.from("entities").select("id,org_id,name,code").in("org_id", orgIds).order("name")
      : Promise.resolve({ data: [], error: null }),
    entityMemberIds.length
      ? supabase.from("entities").select("id,org_id,name,code").in("id", entityMemberIds).order("name")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (orgEntityResult.error) throw orgEntityResult.error;
  if (directEntityResult.error) throw directEntityResult.error;

  return uniqueById([...(orgEntityResult.data ?? []), ...(directEntityResult.data ?? [])] as Omit<EntityRow, "canAdmin">[]).map((entity) => {
    const orgRole = orgRoleById.get(entity.org_id);
    const entityRole = entityRoleById.get(entity.id);
    return {
      ...entity,
      canAdmin: orgRole === "owner" || orgRole === "admin" || entityRole === "admin",
    };
  });
}

async function loadBankAccounts(supabase: ReturnType<typeof getSupabaseServiceClient>, entityIds: string[]) {
  const query = (selectColumns: string) =>
    supabase.from("entity_bank_accounts").select(selectColumns).in("entity_id", entityIds).neq("status", "archived").order("account_name");

  const result = await query(ACCOUNT_SELECT_WITH_TYPE);
  if (!result.error) return (result.data ?? []) as unknown as BankAccountRow[];
  if (!isMissingLedgerAccountTypeColumnError(result.error)) throw result.error;

  const fallbackResult = await query(ACCOUNT_SELECT_WITHOUT_TYPE);
  if (fallbackResult.error) throw fallbackResult.error;
  return ((fallbackResult.data ?? []) as unknown as BankAccountRow[]).map((account) => ({ ...account, account_type: null }));
}

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const supabase = getSupabaseServiceClient();
    const entities = await loadAccessibleEntities(supabase, user.id);

    if (!entities.length) {
      return NextResponse.json(
        buildLedgerDashboardPayload({
          entities: [],
          accounts: [],
          balances: [],
          transactions: [],
          windowDays: 30,
        }),
      );
    }

    await Promise.all(entities.map((entity) => requireEntityAccess(supabase, entity.id, user.id)));

    const entityIds = entities.map((entity) => entity.id);
    const accounts = (await loadBankAccounts(supabase, entityIds)).filter((account) => !shouldExcludeLedgerAccount({ accountName: account.account_name }));
    const accountIds = accounts.map((account) => account.id);
    const sinceDate = daysAgoIsoDate(30);

    const [balanceResult, transactionResult] = await Promise.all([
      accountIds.length
        ? loadAllRows<BankBalanceRow>(
            supabase
              .from("bank_account_balances")
              .select("id,entity_id,bank_account_id,source,balance_date,as_of,balance_type,amount,currency")
              .in("bank_account_id", accountIds)
              .order("balance_date", { ascending: false })
              .order("as_of", { ascending: false }),
          )
        : Promise.resolve([]),
      accountIds.length
        ? loadAllRows<BankTransactionRow>(
            supabase
              .from("bank_account_transactions")
              .select("id,entity_id,bank_account_id,source,transaction_date,description,signed_amount,amount,direction,currency,status")
              .in("bank_account_id", accountIds)
              .gte("transaction_date", sinceDate)
              .neq("status", "voided")
              .neq("status", "failed")
              .order("transaction_date", { ascending: false }),
          )
        : Promise.resolve([]),
    ]);
    const usdRates = await getUsdRatesForCurrencies(supabase, balanceResult.map((balance) => balance.currency));

    return NextResponse.json(
      buildLedgerDashboardPayload({
        entities: entities.map(
          (entity): LedgerDashboardEntity => ({
            id: entity.id,
            orgId: entity.org_id,
            name: entity.name,
            code: entity.code,
          }),
        ),
        accounts: accounts.map(
          (account): LedgerDashboardAccount => ({
            id: account.id,
            entityId: account.entity_id,
            accountName: account.account_name,
            currency: account.currency,
            status: account.status,
            source: accountSource(account),
            accountType: classifyLedgerAccountType({ accountName: account.account_name, accountType: account.account_type }),
            canAdmin: entities.find((entity) => entity.id === account.entity_id)?.canAdmin ?? false,
          }),
        ),
        balances: balanceResult.map(
          (balance): LedgerDashboardBalance => ({
            id: balance.id,
            entityId: balance.entity_id,
            bankAccountId: balance.bank_account_id,
            source: balance.source,
            balanceDate: balance.balance_date,
            asOf: balance.as_of,
            balanceType: balance.balance_type,
            amount: balance.amount,
            currency: balance.currency,
          }),
        ),
        transactions: transactionResult.map(
          (transaction): LedgerDashboardTransaction => ({
            id: transaction.id,
            entityId: transaction.entity_id,
            bankAccountId: transaction.bank_account_id,
            source: transaction.source,
            transactionDate: transaction.transaction_date,
            description: transaction.description,
            signedAmount: transaction.signed_amount,
            amount: transaction.amount,
            direction: transaction.direction,
            currency: transaction.currency,
            status: transaction.status,
          }),
        ),
        usdRates: usdRates.rates,
        fxStatus: usdRates.status,
        fxSource: usdRates.source,
        fxMissingCurrencies: usdRates.missingCurrencies,
        windowDays: 30,
      }),
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to load ledger dashboard." }, { status: 500 });
  }
}
