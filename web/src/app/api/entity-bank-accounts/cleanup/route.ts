import { NextResponse } from "next/server";
import { requireEntityAccess, requireEntityAdmin } from "@/lib/server/orgs";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";
import { normalizeFxCurrency } from "@/lib/server/fx-rates";

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
  status: string;
};

type CountRow = {
  bank_account_id: string;
};

type BalanceRow = CountRow & {
  amount: string | number;
  currency: string;
  balance_date: string;
  as_of: string;
};

type CleanupBody = {
  action?: "archive_empty_manual_accounts";
  confirm?: boolean;
};

type CleanupCandidate = {
  accountId: string;
  entityId: string;
  accountName: string;
  currency: string | null;
  status: string;
  source: "manual" | "xero";
  transactionCount: number;
  balanceCount: number;
  importCount: number;
  latestBalanceAmount: number | null;
  latestBalanceCurrency: string | null;
  reason: string;
  protected: boolean;
};

const accountSelectColumns = "id,entity_id,xero_bank_account_id,account_name,currency,status";

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Bank account cleanup is not configured.", missing }, { status: 500 });
}

function numberValue(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAccountName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function incrementCount(map: Map<string, number>, accountId: string) {
  map.set(accountId, (map.get(accountId) ?? 0) + 1);
}

function sortLatestBalances(left: BalanceRow, right: BalanceRow) {
  const dateCompare = String(right.balance_date ?? "").localeCompare(String(left.balance_date ?? ""));
  if (dateCompare !== 0) return dateCompare;
  return String(right.as_of ?? "").localeCompare(String(left.as_of ?? ""));
}

async function loadAccessibleEntities(supabase: ReturnType<typeof getSupabaseServiceClient>, userId: string) {
  const [orgMemberResult, entityMemberResult] = await Promise.all([
    supabase.from("org_members").select("org_id,role").eq("user_id", userId),
    supabase.from("entity_members").select("entity_id,role").eq("user_id", userId),
  ]);

  if (orgMemberResult.error) throw orgMemberResult.error;
  if (entityMemberResult.error) throw entityMemberResult.error;

  const orgMemberships = (orgMemberResult.data ?? []) as OrgMemberRow[];
  const entityMemberships = (entityMemberResult.data ?? []) as EntityMemberRow[];
  const orgIds = orgMemberships.map((membership) => membership.org_id);
  const entityMemberIds = entityMemberships.map((membership) => membership.entity_id);
  const orgRoleById = new Map(orgMemberships.map((membership) => [membership.org_id, membership.role]));
  const entityRoleById = new Map(entityMemberships.map((membership) => [membership.entity_id, membership.role]));

  const [orgEntityResult, directEntityResult] = await Promise.all([
    orgIds.length ? supabase.from("entities").select("id,org_id,name,code").in("org_id", orgIds).order("name") : Promise.resolve({ data: [], error: null }),
    entityMemberIds.length ? supabase.from("entities").select("id,org_id,name,code").in("id", entityMemberIds).order("name") : Promise.resolve({ data: [], error: null }),
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

function candidateFromAccount(input: {
  account: BankAccountRow;
  transactionCount: number;
  balanceCount: number;
  importCount: number;
  latestBalance: BalanceRow | null;
  reason: string;
}): CleanupCandidate {
  const source = input.account.xero_bank_account_id ? "xero" : "manual";
  return {
    accountId: input.account.id,
    entityId: input.account.entity_id,
    accountName: input.account.account_name,
    currency: input.account.currency,
    status: input.account.status,
    source,
    transactionCount: input.transactionCount,
    balanceCount: input.balanceCount,
    importCount: input.importCount,
    latestBalanceAmount: numberValue(input.latestBalance?.amount),
    latestBalanceCurrency: input.latestBalance?.currency ?? null,
    reason: input.reason,
    protected: source === "xero",
  };
}

async function buildCleanupSummary(supabase: ReturnType<typeof getSupabaseServiceClient>, entities: EntityRow[], archived: Array<{ id: string; entityId: string; accountName: string; status: string }> = []) {
  const entityIds = entities.map((entity) => entity.id);
  if (!entityIds.length) {
    return {
      generatedAt: new Date().toISOString(),
      dryRun: !archived.length,
      counts: {
        emptyManualAccounts: 0,
        emptyXeroAccounts: 0,
        zeroBalanceNoActivityAccounts: 0,
        duplicateNameGroups: 0,
        invalidBalanceCurrencies: 0,
        archivedAccounts: 0,
      },
      candidates: {
        emptyManualAccounts: [],
        emptyXeroAccounts: [],
        zeroBalanceNoActivityAccounts: [],
        duplicateNameGroups: [],
        invalidBalanceCurrencies: [],
      },
      archived,
    };
  }

  const { data: accountsData, error: accountsError } = await supabase
    .from("entity_bank_accounts")
    .select(accountSelectColumns)
    .in("entity_id", entityIds)
    .order("account_name");
  if (accountsError) throw accountsError;

  const accounts = (accountsData ?? []) as BankAccountRow[];
  const accountIds = accounts.map((account) => account.id);

  const [transactionsResult, balancesResult, importsResult] = await Promise.all([
    accountIds.length ? supabase.from("bank_account_transactions").select("bank_account_id").in("bank_account_id", accountIds) : Promise.resolve({ data: [], error: null }),
    accountIds.length ? supabase.from("bank_account_balances").select("bank_account_id,amount,currency,balance_date,as_of").in("bank_account_id", accountIds) : Promise.resolve({ data: [], error: null }),
    accountIds.length ? supabase.from("bank_statement_imports").select("bank_account_id").in("bank_account_id", accountIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (transactionsResult.error) throw transactionsResult.error;
  if (balancesResult.error) throw balancesResult.error;
  if (importsResult.error) throw importsResult.error;

  const transactionCounts = new Map<string, number>();
  const balanceCounts = new Map<string, number>();
  const importCounts = new Map<string, number>();
  for (const row of (transactionsResult.data ?? []) as CountRow[]) incrementCount(transactionCounts, row.bank_account_id);
  for (const row of (balancesResult.data ?? []) as BalanceRow[]) incrementCount(balanceCounts, row.bank_account_id);
  for (const row of (importsResult.data ?? []) as CountRow[]) {
    if (row.bank_account_id) incrementCount(importCounts, row.bank_account_id);
  }

  const latestBalanceByAccountId = new Map<string, BalanceRow>();
  for (const balance of [...((balancesResult.data ?? []) as BalanceRow[])].sort(sortLatestBalances)) {
    if (!latestBalanceByAccountId.has(balance.bank_account_id)) latestBalanceByAccountId.set(balance.bank_account_id, balance);
  }

  const emptyManualAccounts: CleanupCandidate[] = [];
  const emptyXeroAccounts: CleanupCandidate[] = [];
  const zeroBalanceNoActivityAccounts: CleanupCandidate[] = [];
  const duplicateGroups = new Map<string, CleanupCandidate[]>();
  const invalidCurrencyGroups = new Map<string, { currency: string; balanceCount: number; accountIds: Set<string>; exampleAccountName: string | null }>();

  for (const account of accounts) {
    const transactionCount = transactionCounts.get(account.id) ?? 0;
    const balanceCount = balanceCounts.get(account.id) ?? 0;
    const importCount = importCounts.get(account.id) ?? 0;
    const latestBalance = latestBalanceByAccountId.get(account.id) ?? null;
    const latestAmount = numberValue(latestBalance?.amount);
    const isArchived = account.status === "archived";
    const isEmpty = transactionCount === 0 && balanceCount === 0 && importCount === 0;
    const candidate = candidateFromAccount({ account, transactionCount, balanceCount, importCount, latestBalance, reason: isEmpty ? "No transactions, balances, or imports." : "Latest balance is zero and no transactions/imports exist." });

    if (!isArchived && isEmpty && account.xero_bank_account_id) emptyXeroAccounts.push(candidate);
    if (!isArchived && isEmpty && !account.xero_bank_account_id) emptyManualAccounts.push(candidate);
    if (!isArchived && !isEmpty && latestAmount === 0 && transactionCount === 0 && importCount === 0) zeroBalanceNoActivityAccounts.push(candidate);

    if (!isArchived) {
      const duplicateKey = `${account.entity_id}:${normalizeAccountName(account.account_name)}`;
      const group = duplicateGroups.get(duplicateKey) ?? [];
      group.push(candidate);
      duplicateGroups.set(duplicateKey, group);
    }
  }

  for (const balance of (balancesResult.data ?? []) as BalanceRow[]) {
    const currency = balance.currency?.trim().toUpperCase() || "Unspecified";
    if (normalizeFxCurrency(currency)) continue;
    const account = accounts.find((item) => item.id === balance.bank_account_id);
    const group = invalidCurrencyGroups.get(currency) ?? { currency, balanceCount: 0, accountIds: new Set<string>(), exampleAccountName: account?.account_name ?? null };
    group.balanceCount += 1;
    group.accountIds.add(balance.bank_account_id);
    invalidCurrencyGroups.set(currency, group);
  }

  const duplicateNameGroups = Array.from(duplicateGroups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      entityId: key.split(":")[0],
      normalizedName: normalizeAccountName(group[0].accountName),
      accounts: group,
    }));

  const invalidBalanceCurrencies = Array.from(invalidCurrencyGroups.values()).map((group) => ({
    currency: group.currency,
    balanceCount: group.balanceCount,
    accountCount: group.accountIds.size,
    exampleAccountName: group.exampleAccountName,
  }));

  return {
    generatedAt: new Date().toISOString(),
    dryRun: !archived.length,
    counts: {
      emptyManualAccounts: emptyManualAccounts.length,
      emptyXeroAccounts: emptyXeroAccounts.length,
      zeroBalanceNoActivityAccounts: zeroBalanceNoActivityAccounts.length,
      duplicateNameGroups: duplicateNameGroups.length,
      invalidBalanceCurrencies: invalidBalanceCurrencies.length,
      archivedAccounts: accounts.filter((account) => account.status === "archived").length,
    },
    candidates: {
      emptyManualAccounts,
      emptyXeroAccounts,
      zeroBalanceNoActivityAccounts,
      duplicateNameGroups,
      invalidBalanceCurrencies,
    },
    archived,
  };
}

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const supabase = getSupabaseServiceClient();
    const entities = await loadAccessibleEntities(supabase, user.id);
    await Promise.all(entities.map((entity) => requireEntityAccess(supabase, entity.id, user.id)));

    return NextResponse.json(await buildCleanupSummary(supabase, entities));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to scan bank account cleanup candidates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as CleanupBody;
    if (body.action !== "archive_empty_manual_accounts" || body.confirm !== true) {
      return NextResponse.json({ error: "Cleanup requires action archive_empty_manual_accounts and confirm true." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const entities = await loadAccessibleEntities(supabase, user.id);
    await Promise.all(entities.map((entity) => requireEntityAccess(supabase, entity.id, user.id)));
    const summary = await buildCleanupSummary(supabase, entities);
    const adminEntityIds = new Set(entities.filter((entity) => entity.canAdmin).map((entity) => entity.id));
    await Promise.all(Array.from(adminEntityIds).map((entityId) => requireEntityAdmin(supabase, entityId, user.id)));

    const archiveCandidates = summary.candidates.emptyManualAccounts.filter((candidate) => adminEntityIds.has(candidate.entityId) && !candidate.protected);
    if (!archiveCandidates.length) return NextResponse.json(await buildCleanupSummary(supabase, entities));

    const { data, error } = await supabase
      .from("entity_bank_accounts")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .in(
        "id",
        archiveCandidates.map((candidate) => candidate.accountId),
      )
      .is("xero_bank_account_id", null)
      .neq("status", "archived")
      .select("id,entity_id,account_name,status");
    if (error) throw error;

    const archived = ((data ?? []) as Array<{ id: string; entity_id: string; account_name: string; status: string }>).map((account) => ({
      id: account.id,
      entityId: account.entity_id,
      accountName: account.account_name,
      status: account.status,
    }));

    return NextResponse.json(await buildCleanupSummary(supabase, entities, archived));
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to archive bank account cleanup candidates." }, { status: 500 });
  }
}
