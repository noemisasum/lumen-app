import { NextResponse } from "next/server";
import { encryptJson, decryptJson } from "@/lib/server/crypto";
import { requireEntityAccess, requireEntityAdmin } from "@/lib/server/orgs";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";
import { createXeroClient, getXeroEnvIssueNames, refreshXeroTokenSet, serializeTokenSet, type XeroTenant } from "@/lib/server/xero";
import type { TokenSet } from "xero-node";

export const runtime = "nodejs";

type AccountType = "bank" | "operating_bank" | "client_money" | "money_processor" | "liquidity_provider";

type BankAccountRow = {
  id: string;
  entity_id: string;
  entity_xero_mapping_id: string | null;
  xero_bank_account_id: string | null;
  account_name: string;
  currency: string | null;
  account_type: AccountType;
  status: string;
  created_at: string;
  updated_at: string;
};

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

type XeroAccount = {
  accountID?: string;
  name?: string;
  code?: string;
  type?: string;
  status?: string;
  currencyCode?: string;
};

type CreateAccountBody = {
  entityId?: string;
  accountName?: string;
  currency?: string;
  accountType?: AccountType;
  allowDuplicate?: boolean;
};

type UpdateAccountBody = {
  entityId?: string;
  accountId?: string;
  accountName?: string;
  accountType?: AccountType;
};

const accountSelectColumns = "id,entity_id,entity_xero_mapping_id,xero_bank_account_id,account_name,currency,account_type,status,created_at,updated_at";
const validAccountTypes = new Set<AccountType>(["bank", "operating_bank", "client_money", "money_processor", "liquidity_provider"]);

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Entity bank accounts are not configured.", missing }, { status: 500 });
}

function accountSource(account: BankAccountRow) {
  return account.xero_bank_account_id ? "xero" : "manual";
}

function serializeAccount(account: BankAccountRow) {
  return {
    id: account.id,
    entityId: account.entity_id,
    entityXeroMappingId: account.entity_xero_mapping_id,
    xeroBankAccountId: account.xero_bank_account_id,
    accountName: account.account_name,
    currency: account.currency,
    accountType: account.account_type,
    status: account.status,
    source: accountSource(account),
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

function sanitizeAccountName(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "";
}

function normalizeAccountName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeAccountType(value: unknown): AccountType {
  return validAccountTypes.has(value as AccountType) ? (value as AccountType) : "operating_bank";
}

async function loadAccounts(supabase: ReturnType<typeof getSupabaseServiceClient>, entityId: string) {
  const { data, error } = await supabase
    .from("entity_bank_accounts")
    .select(accountSelectColumns)
    .eq("entity_id", entityId)
    .neq("status", "archived")
    .order("account_name");

  if (error) throw error;
  return (data ?? []) as BankAccountRow[];
}

async function syncXeroBankAccounts(supabase: ReturnType<typeof getSupabaseServiceClient>, entityId: string) {
  const { data: mapping, error: mappingError } = await supabase
    .from("entity_xero_mappings")
    .select("id,connection_id,connection_tenant_id,xero_tenant_id")
    .eq("entity_id", entityId)
    .maybeSingle();
  if (mappingError) throw mappingError;
  if (!mapping) return { synced: false, count: 0 };

  const xeroIssues = getXeroEnvIssueNames();
  if (xeroIssues.length) return { synced: false, count: 0, warning: "Xero is not configured for account sync." };

  const mappingRow = mapping as EntityXeroMappingRow;
  const { data: connection, error: connectionError } = await supabase
    .from("xero_connections")
    .select("id,token_ciphertext")
    .eq("id", mappingRow.connection_id)
    .is("disconnected_at", null)
    .maybeSingle();
  if (connectionError) throw connectionError;
  if (!connection) return { synced: false, count: 0, warning: "The mapped Xero connection is no longer available." };

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
    return {
      synced: false,
      count: 0,
      warning: "Xero refreshed credentials could not be saved. Reconnect Xero before syncing bank accounts.",
    };
  }

  const tenants = (await xero.updateTenants(false)) as XeroTenant[];
  const hasTenant = tenants.some((tenant) => tenant.tenantId === mappingRow.xero_tenant_id);
  if (!hasTenant) return { synced: false, count: 0, warning: "The mapped Xero tenant is not available on the active connection." };

  const accountResponse = await xero.accountingApi.getAccounts(mappingRow.xero_tenant_id, undefined, 'Type=="BANK"');
  const accounts = ((accountResponse.body.accounts ?? []) as XeroAccount[]).filter((account) => account.accountID && account.name);

  if (!accounts.length) return { synced: true, count: 0 };

  const now = new Date().toISOString();
  const rows = accounts.map((account) => ({
    entity_id: entityId,
    entity_xero_mapping_id: mappingRow.id,
    xero_bank_account_id: account.accountID,
    account_name: account.name,
    currency: account.currencyCode ?? null,
    status: account.status === "ARCHIVED" ? "archived" : "active",
    updated_at: now,
  }));

  const { error: upsertError } = await supabase.from("entity_bank_accounts").upsert(rows, { onConflict: "entity_id,xero_bank_account_id" });
  if (upsertError) throw upsertError;

  return { synced: true, count: rows.length };
}

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const requestUrl = new URL(request.url);
    const entityId = requestUrl.searchParams.get("entityId")?.trim();
    const shouldSync = requestUrl.searchParams.get("syncXero") === "1";

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    if (shouldSync) {
      await requireEntityAdmin(supabase, entityId, user.id);
    } else {
      await requireEntityAccess(supabase, entityId, user.id);
    }

    const sync = shouldSync ? await syncXeroBankAccounts(supabase, entityId) : { synced: false, count: 0 };
    const accounts = await loadAccounts(supabase, entityId);

    return NextResponse.json({ accounts: accounts.map(serializeAccount), sync });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to load entity bank accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as CreateAccountBody;
    const entityId = body.entityId?.trim();
    const accountName = sanitizeAccountName(body.accountName);
    const currency = body.currency?.trim().toUpperCase().slice(0, 3) || null;
    const accountType = normalizeAccountType(body.accountType);
    const allowDuplicate = body.allowDuplicate === true;

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });
    if (!accountName || accountName.length < 2) return NextResponse.json({ error: "Enter a bank account name." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireEntityAdmin(supabase, entityId, user.id);

    if (!allowDuplicate) {
      const existingAccounts = await loadAccounts(supabase, entityId);
      const existing = existingAccounts.find((account) => !account.xero_bank_account_id && normalizeAccountName(account.account_name) === normalizeAccountName(accountName));
      if (existing) return NextResponse.json({ account: serializeAccount(existing), created: false });
    }

    const { data: created, error: createError } = await supabase
      .from("entity_bank_accounts")
      .insert({
        entity_id: entityId,
        xero_bank_account_id: null,
        account_name: accountName,
        currency,
        account_type: accountType,
        status: "active",
      })
      .select(accountSelectColumns)
      .single();

    if (createError || !created) throw createError ?? new Error("Missing bank account row.");

    return NextResponse.json({ account: serializeAccount(created as BankAccountRow), created: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to create bank account." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as UpdateAccountBody;
    const entityId = body.entityId?.trim();
    const accountId = body.accountId?.trim();
    const hasAccountNameUpdate = typeof body.accountName === "string";
    const accountName = sanitizeAccountName(body.accountName);
    const hasAccountTypeUpdate = body.accountType !== undefined && validAccountTypes.has(body.accountType);

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });
    if (!accountId) return NextResponse.json({ error: "Choose a bank account." }, { status: 400 });
    if (!hasAccountNameUpdate && !hasAccountTypeUpdate) return NextResponse.json({ error: "Choose an account update." }, { status: 400 });
    if (hasAccountNameUpdate && (!accountName || accountName.length < 2)) return NextResponse.json({ error: "Enter a bank account name." }, { status: 400 });
    if (body.accountType !== undefined && !hasAccountTypeUpdate) return NextResponse.json({ error: "Choose a supported treasury account category." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireEntityAdmin(supabase, entityId, user.id);

    const accounts = await loadAccounts(supabase, entityId);
    const target = accounts.find((account) => account.id === accountId);
    if (!target) return NextResponse.json({ error: "Bank account does not belong to the selected entity." }, { status: 404 });
    if (target.xero_bank_account_id && hasAccountNameUpdate && normalizeAccountName(accountName) !== normalizeAccountName(target.account_name)) {
      return NextResponse.json({ error: "Xero bank account names are managed in Xero." }, { status: 400 });
    }

    if (!target.xero_bank_account_id && hasAccountNameUpdate) {
      const normalizedName = normalizeAccountName(accountName);
      const duplicate = accounts.find(
        (account) =>
          account.id !== accountId &&
          !account.xero_bank_account_id &&
          normalizeAccountName(account.account_name) === normalizedName,
      );
      if (duplicate) return NextResponse.json({ error: "An upload bank account with that name already exists." }, { status: 409 });
    }

    const updateValues: Partial<Pick<BankAccountRow, "account_name" | "account_type">> = {};
    if (!target.xero_bank_account_id && hasAccountNameUpdate) updateValues.account_name = accountName;
    if (hasAccountTypeUpdate) updateValues.account_type = body.accountType;
    if (!Object.keys(updateValues).length) return NextResponse.json({ account: serializeAccount(target) });

    const { data: updated, error: updateError } = await supabase
      .from("entity_bank_accounts")
      .update(updateValues)
      .eq("id", accountId)
      .eq("entity_id", entityId)
      .neq("status", "archived")
      .select(accountSelectColumns)
      .single();

    if (updateError || !updated) throw updateError ?? new Error("Missing bank account row.");

    return NextResponse.json({ account: serializeAccount(updated as BankAccountRow) });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to update bank account." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const requestUrl = new URL(request.url);
    const entityId = requestUrl.searchParams.get("entityId")?.trim();
    const accountId = requestUrl.searchParams.get("accountId")?.trim();

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });
    if (!accountId) return NextResponse.json({ error: "Choose a bank account." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireEntityAdmin(supabase, entityId, user.id);

    const accounts = await loadAccounts(supabase, entityId);
    const target = accounts.find((account) => account.id === accountId);
    if (!target) return NextResponse.json({ error: "Bank account does not belong to the selected entity." }, { status: 404 });
    if (target.xero_bank_account_id) return NextResponse.json({ error: "Xero bank accounts are managed in Xero." }, { status: 400 });

    const { data: archived, error: archiveError } = await supabase
      .from("entity_bank_accounts")
      .update({ status: "archived" })
      .eq("id", accountId)
      .eq("entity_id", entityId)
      .is("xero_bank_account_id", null)
      .neq("status", "archived")
      .select(accountSelectColumns)
      .single();

    if (archiveError || !archived) throw archiveError ?? new Error("Missing bank account row.");

    return NextResponse.json({ account: serializeAccount(archived as BankAccountRow), archived: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to archive bank account." }, { status: 500 });
  }
}
