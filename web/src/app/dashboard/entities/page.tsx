"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Notice, SkeletonBlock, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type SessionInfo = {
  userId: string;
  email: string | null;
  accessToken: string;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
};

type EntityXeroMapping = {
  id: string;
  entity_id: string;
  connection_tenant_id: string;
  xero_tenant_id: string;
  updated_at: string;
};

type EntityRow = {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  role: string | null;
  canAdmin: boolean;
  xeroMapping: EntityXeroMapping | null;
};

type BankAccountRow = {
  id: string;
  entityId: string;
  entityXeroMappingId: string | null;
  xeroBankAccountId: string | null;
  accountName: string;
  currency: string | null;
  accountType: "bank" | "money_processor";
  status: string;
  source: "xero" | "manual";
  createdAt: string;
  updatedAt: string;
};

type BankAccountDraft = {
  accountName: string;
  currency: string;
  accountType: BankAccountRow["accountType"];
};

type XeroTenant = {
  id: string;
  tenantId: string;
  name: string;
  tenantType: string | null;
};

type ManagementState = {
  orgs: OrgRow[];
  entities: EntityRow[];
  xero: {
    connected: boolean;
    tenants: XeroTenant[];
  };
};

type NoticeState = {
  tone: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
};

const selectClassName =
  "h-10 w-full appearance-none rounded-lg border border-zinc-300 bg-white py-0 pl-3 pr-10 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

const inputClassName =
  "mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 sm:px-3 sm:text-sm";

const saveButtonClassName =
  "inline-flex h-9 items-center justify-center rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400";

const unmapButtonClassName =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-medium text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 sm:px-3 sm:text-sm";

const dangerButtonClassName =
  "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 sm:px-3 sm:text-sm";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function tenantLabel(tenants: XeroTenant[], mapping: EntityXeroMapping | null) {
  if (!mapping) return "Not mapped";
  return tenants.find((tenant) => tenant.id === mapping.connection_tenant_id)?.name || mapping.xero_tenant_id;
}

function sortBankAccounts(accounts: BankAccountRow[]) {
  return [...accounts].sort((left, right) => left.accountName.localeCompare(right.accountName));
}

function accountTypeLabel(accountType: BankAccountRow["accountType"]) {
  return accountType === "money_processor" ? "MP" : "Bank";
}

function defaultBankAccountDraft(): BankAccountDraft {
  return { accountName: "", currency: "", accountType: "bank" };
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

function SelectControl({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <span className={`relative mt-1 block ${className}`}>
      <select {...props} className={selectClassName}>
        {children}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 h-2 w-2 -translate-y-[60%] rotate-45 border-b border-r border-zinc-500"
        aria-hidden="true"
      />
    </span>
  );
}

export default function EntityManagementPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mappingEntityId, setMappingEntityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [state, setState] = useState<ManagementState>({ orgs: [], entities: [], xero: { connected: false, tenants: [] } });
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgEntityName, setNewOrgEntityName] = useState("");
  const [newOrgEntityCode, setNewOrgEntityCode] = useState("");
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityCode, setNewEntityCode] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editEntityName, setEditEntityName] = useState("");
  const [editEntityCode, setEditEntityCode] = useState("");
  const [accountsByEntityId, setAccountsByEntityId] = useState<Record<string, BankAccountRow[]>>({});
  const [accountLoadingEntityIds, setAccountLoadingEntityIds] = useState<string[]>([]);
  const [accountErrorsByEntityId, setAccountErrorsByEntityId] = useState<Record<string, string | null>>({});
  const [accountSyncNotesByEntityId, setAccountSyncNotesByEntityId] = useState<Record<string, string | null>>({});
  const [accountDraftsByEntityId, setAccountDraftsByEntityId] = useState<Record<string, BankAccountDraft>>({});
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState("");
  const [editingAccountType, setEditingAccountType] = useState<BankAccountRow["accountType"]>("bank");
  const [accountAction, setAccountAction] = useState<string | null>(null);

  const manageableOrgs = state.orgs.filter((org) => org.role === "owner" || org.role === "admin");
  const selectedOrg = state.orgs.find((org) => org.id === selectedOrgId) ?? state.orgs[0] ?? null;
  const selectedAdminOrg = manageableOrgs.find((org) => org.id === selectedOrgId) ?? manageableOrgs[0] ?? null;
  const selectedOrgFilterId = selectedOrg?.id;
  const visibleEntities = useMemo(
    () => (selectedOrgFilterId ? state.entities.filter((entity) => entity.org_id === selectedOrgFilterId) : state.entities),
    [selectedOrgFilterId, state.entities],
  );

  const setAccountDraft = useCallback((entityId: string, update: Partial<BankAccountDraft>) => {
    setAccountDraftsByEntityId((current) => ({
      ...current,
      [entityId]: { ...(current[entityId] ?? defaultBankAccountDraft()), ...update },
    }));
  }, []);

  const loadManagement = useCallback(
    async (accessToken: string) => {
      const response = await fetch("/api/orgs", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json()) as ManagementState | { error?: string };
      if (!response.ok) throw new Error("error" in body && body.error ? body.error : "Failed to load organisation setup.");
      const loaded = body as ManagementState;
      setState(loaded);
      setSelectedOrgId((current) => (loaded.orgs.some((org) => org.id === current) ? current : loaded.orgs[0]?.id || ""));
    },
    [],
  );

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;

    (async () => {
      try {
        if (!supabase) {
          setError("Authentication is not configured for this deployment.");
          return;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!data.session) {
          window.location.replace("/login");
          return;
        }

        const currentSession = {
          userId: data.session.user.id,
          email: data.session.user.email ?? null,
          accessToken: data.session.access_token,
        };
        setSession(currentSession);
        await loadManagement(currentSession.accessToken);

        const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
          if (!sess) {
            window.location.replace("/login");
            return;
          }
          const nextSession = { userId: sess.user.id, email: sess.user.email ?? null, accessToken: sess.access_token };
          setSession(nextSession);
          void loadManagement(nextSession.accessToken);
        });
        unsub = sub.subscription;
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Failed to load organisation setup."));
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unsub?.unsubscribe();
    };
  }, [loadManagement, supabase]);

  async function refresh() {
    if (!session) return;
    await loadManagement(session.accessToken);
  }

  const loadBankAccounts = useCallback(async (entityId: string, accessToken: string, options: { syncXero?: boolean } = {}) => {
    setAccountLoadingEntityIds((current) => (current.includes(entityId) ? current : [...current, entityId]));
    setAccountErrorsByEntityId((current) => ({ ...current, [entityId]: null }));
    if (options.syncXero) setAccountSyncNotesByEntityId((current) => ({ ...current, [entityId]: null }));

    try {
      const params = new URLSearchParams({ entityId });
      if (options.syncXero) params.set("syncXero", "1");
      const response = await fetch(`/api/entity-bank-accounts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json()) as {
        accounts?: BankAccountRow[];
        sync?: { synced?: boolean; count?: number; warning?: string };
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Failed to load bank accounts.");

      setAccountsByEntityId((current) => ({ ...current, [entityId]: sortBankAccounts(body.accounts ?? []) }));
      if (body.sync?.warning) {
        setAccountSyncNotesByEntityId((current) => ({ ...current, [entityId]: body.sync?.warning ?? null }));
      } else if (options.syncXero && body.sync?.synced) {
        setAccountSyncNotesByEntityId((current) => ({
          ...current,
          [entityId]: `Synced ${body.sync?.count ?? 0} Xero bank account${body.sync?.count === 1 ? "" : "s"}.`,
        }));
      }
    } catch (e: unknown) {
      setAccountsByEntityId((current) => ({ ...current, [entityId]: [] }));
      setAccountErrorsByEntityId((current) => ({ ...current, [entityId]: getErrorMessage(e, "Failed to load bank accounts.") }));
    } finally {
      setAccountLoadingEntityIds((current) => current.filter((id) => id !== entityId));
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const unloadedEntityIds = visibleEntities
      .map((entity) => entity.id)
      .filter((entityId) => accountsByEntityId[entityId] === undefined && !accountLoadingEntityIds.includes(entityId));
    unloadedEntityIds.forEach((entityId) => void loadBankAccounts(entityId, session.accessToken));
  }, [accountLoadingEntityIds, accountsByEntityId, loadBankAccounts, session, visibleEntities]);

  async function createBankAccount(event: React.FormEvent<HTMLFormElement>, entity: EntityRow) {
    event.preventDefault();
    if (!session || !entity.canAdmin) return;

    const draft = accountDraftsByEntityId[entity.id] ?? defaultBankAccountDraft();
    const accountName = draft.accountName.trim().replace(/\s+/g, " ");
    const currency = normalizeCurrency(draft.currency);
    if (!accountName) return;

    setAccountAction(`account-create:${entity.id}`);
    setAccountErrorsByEntityId((current) => ({ ...current, [entity.id]: null }));
    setAccountSyncNotesByEntityId((current) => ({ ...current, [entity.id]: null }));
    try {
      const response = await fetch("/api/entity-bank-accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entityId: entity.id, accountName, currency, accountType: draft.accountType }),
      });
      const body = (await response.json()) as { account?: BankAccountRow; created?: boolean; error?: string };
      if (!response.ok || !body.account) throw new Error(body.error || "Failed to create bank account.");

      setAccountsByEntityId((current) => ({
        ...current,
        [entity.id]: sortBankAccounts([...(current[entity.id] ?? []).filter((account) => account.id !== body.account?.id), body.account as BankAccountRow]),
      }));
      setAccountDraftsByEntityId((current) => ({ ...current, [entity.id]: defaultBankAccountDraft() }));
      setNotice({
        tone: body.created === false ? "info" : "success",
        title: body.created === false ? "Account Already Exists" : "Bank Account Added",
        message: `${body.account.accountName} is available for statement uploads and ledger classification.`,
      });
    } catch (e: unknown) {
      setAccountErrorsByEntityId((current) => ({ ...current, [entity.id]: getErrorMessage(e, "Failed to create bank account.") }));
    } finally {
      setAccountAction(null);
    }
  }

  function startEditBankAccount(account: BankAccountRow) {
    setEditingAccountId(account.id);
    setEditingAccountName(account.accountName);
    setEditingAccountType(account.accountType);
    setAccountErrorsByEntityId((current) => ({ ...current, [account.entityId]: null }));
  }

  function cancelEditBankAccount() {
    setEditingAccountId(null);
    setEditingAccountName("");
    setEditingAccountType("bank");
  }

  async function updateBankAccount(account: BankAccountRow) {
    if (!session) return;
    const accountName = editingAccountName.trim().replace(/\s+/g, " ");
    if (account.source === "manual" && !accountName) return;
    if ((account.source === "xero" || accountName === account.accountName) && editingAccountType === account.accountType) {
      cancelEditBankAccount();
      return;
    }

    setAccountAction(`account-edit:${account.id}`);
    setAccountErrorsByEntityId((current) => ({ ...current, [account.entityId]: null }));
    setAccountSyncNotesByEntityId((current) => ({ ...current, [account.entityId]: null }));
    try {
      const response = await fetch("/api/entity-bank-accounts", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityId: account.entityId,
          accountId: account.id,
          ...(account.source === "manual" ? { accountName } : {}),
          accountType: editingAccountType,
        }),
      });
      const body = (await response.json()) as { account?: BankAccountRow; error?: string };
      if (!response.ok || !body.account) throw new Error(body.error || "Failed to update bank account.");

      setAccountsByEntityId((current) => ({
        ...current,
        [account.entityId]: sortBankAccounts((current[account.entityId] ?? []).map((item) => (item.id === body.account?.id ? (body.account as BankAccountRow) : item))),
      }));
      cancelEditBankAccount();
    } catch (e: unknown) {
      setAccountErrorsByEntityId((current) => ({ ...current, [account.entityId]: getErrorMessage(e, "Failed to update bank account.") }));
    } finally {
      setAccountAction(null);
    }
  }

  async function archiveBankAccount(account: BankAccountRow) {
    if (!session || account.source === "xero") return;
    if (!window.confirm(`Archive upload account "${account.accountName}"? Existing history stays available.`)) return;

    setAccountAction(`account-delete:${account.id}`);
    setAccountErrorsByEntityId((current) => ({ ...current, [account.entityId]: null }));
    setAccountSyncNotesByEntityId((current) => ({ ...current, [account.entityId]: null }));
    try {
      const params = new URLSearchParams({ entityId: account.entityId, accountId: account.id });
      const response = await fetch(`/api/entity-bank-accounts?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to archive bank account.");

      setAccountsByEntityId((current) => ({
        ...current,
        [account.entityId]: (current[account.entityId] ?? []).filter((item) => item.id !== account.id),
      }));
      if (editingAccountId === account.id) cancelEditBankAccount();
    } catch (e: unknown) {
      setAccountErrorsByEntityId((current) => ({ ...current, [account.entityId]: getErrorMessage(e, "Failed to archive bank account.") }));
    } finally {
      setAccountAction(null);
    }
  }

  async function createOrg(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgName: newOrgName,
          entityName: newOrgEntityName,
          entityCode: newOrgEntityCode,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to create organisation.");
      setNewOrgName("");
      setNewOrgEntityName("");
      setNewOrgEntityCode("");
      setNotice({ tone: "success", title: "Organisation Created", message: "Your first entity is ready for uploads. Map Xero when you want sync and reconciliation." });
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to create organisation."));
    } finally {
      setSaving(false);
    }
  }

  async function createEntity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedAdminOrg) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/entities", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgId: selectedAdminOrg.id,
          name: newEntityName,
          code: newEntityCode,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to create entity.");
      setNewEntityName("");
      setNewEntityCode("");
      setNotice({ tone: "success", title: "Entity Created", message: "You can upload statements for this entity now. Xero mapping can be added for sync and reconciliation." });
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to create entity."));
    } finally {
      setSaving(false);
    }
  }

  function startEditEntity(entity: EntityRow) {
    setEditingEntityId(entity.id);
    setEditEntityName(entity.name);
    setEditEntityCode(entity.code ?? "");
    setError(null);
    setNotice(null);
  }

  function cancelEditEntity() {
    setEditingEntityId(null);
    setEditEntityName("");
    setEditEntityCode("");
  }

  async function updateEntity(event: React.FormEvent<HTMLFormElement>, entity: EntityRow) {
    event.preventDefault();
    if (!session || !entity.canAdmin) return;

    setPendingAction(`entity-edit:${entity.id}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/entities", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityId: entity.id,
          name: editEntityName,
          code: editEntityCode,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to update entity.");
      setNotice({ tone: "success", title: "Entity Updated", message: "The entity details have been saved." });
      cancelEditEntity();
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to update entity."));
    } finally {
      setPendingAction(null);
    }
  }

  async function mapEntity(entityId: string, connectionTenantId: string) {
    if (!session) return;

    setMappingEntityId(entityId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/entity-xero-mappings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ entityId, connectionTenantId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to map Xero tenant.");
      setNotice({ tone: "success", title: "Xero Tenant Mapped", message: "This entity is ready for Xero sync and reconciliation." });
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to map Xero tenant."));
    } finally {
      setMappingEntityId(null);
    }
  }

  async function unmapEntity(entityId: string) {
    if (!session) return;

    setMappingEntityId(entityId);
    setError(null);
    setNotice(null);
    try {
      const params = new URLSearchParams({ entityId });
      const response = await fetch(`/api/entity-xero-mappings?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to remove Xero mapping.");
      setNotice({ tone: "info", title: "Xero Mapping Removed", message: "Bank statement uploads can continue. Map a tenant again when this entity needs Xero sync." });
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to remove Xero mapping."));
    } finally {
      setMappingEntityId(null);
    }
  }

  async function deleteEntity(entity: EntityRow) {
    if (!session || !entity.canAdmin) return;
    const confirmedName = window.prompt(`Type ${entity.name} to delete this entity and its related records.`);
    if (confirmedName !== entity.name) return;

    setPendingAction(`entity:${entity.id}`);
    setError(null);
    setNotice(null);
    try {
      const params = new URLSearchParams({ entityId: entity.id });
      const response = await fetch(`/api/entities?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to delete entity.");
      setNotice({ tone: "info", title: "Entity Deleted", message: `${entity.name} has been removed.` });
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to delete entity."));
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteOrg(org: OrgRow) {
    if (!session || org.role !== "owner") return;
    const confirmedName = window.prompt(`Type ${org.name} to delete this organisation, its entities, and related records.`);
    if (confirmedName !== org.name) return;

    setPendingAction(`org:${org.id}`);
    setError(null);
    setNotice(null);
    try {
      const params = new URLSearchParams({ orgId: org.id });
      const response = await fetch(`/api/orgs?${params.toString()}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to delete organisation.");
      setSelectedOrgId("");
      setNotice({ tone: "info", title: "Organisation Deleted", message: `${org.name} has been removed.` });
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to delete organisation."));
    } finally {
      setPendingAction(null);
    }
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
                <BrandLogo className="h-8 sm:h-9" />
              </Link>
              <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
              <div className="text-sm font-medium text-zinc-700">Entities</div>
            </div>
          </header>
          <main className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            {error ? (
              <Notice tone="error" title="Entity Setup Needs Configuration">
                {error}
              </Notice>
            ) : (
              <Spinner label="Loading Entity Setup" />
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
              <BrandLogo className="h-8 sm:h-9" />
            </Link>
            <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
            <div className="text-sm font-medium text-zinc-700">Entities</div>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          >
            Back to Dashboard
          </Link>
        </header>

        <main className="mt-8 space-y-5">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876b16]">Entity Setup</div>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">Manage Lumen Entities.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                  Create the organisations and entities your team works across. Statement upload works for any selected Lumen entity; Xero mapping powers sync, reconciliation, and accounting workflows.
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                Signed in as <span className="font-medium text-zinc-950">{session.email || session.userId}</span>
              </div>
            </div>
          </section>

          {notice ? (
            <Notice tone={notice.tone} title={notice.title}>
              {notice.message}
            </Notice>
          ) : null}

          {error ? (
            <Notice tone="error" title="Entity Setup Needs Attention">
              {error}
            </Notice>
          ) : null}

          {!state.xero.connected ? (
            <Notice tone="warning" title="Connect Xero Before Mapping">
              Use the dashboard Xero connection first. You can still create Lumen orgs and entities here.
            </Notice>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              <form onSubmit={createOrg} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-950">New Organisation</h2>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-zinc-800">
                    Organisation Name
                    <input
                      value={newOrgName}
                      onChange={(event) => setNewOrgName(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                      placeholder="Lumen Holdings"
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-800">
                    First Entity
                    <input
                      value={newOrgEntityName}
                      onChange={(event) => setNewOrgEntityName(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                      placeholder="Lumen HK Limited"
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-800">
                    Entity Code
                    <input
                      value={newOrgEntityCode}
                      onChange={(event) => setNewOrgEntityCode(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                      placeholder="HK"
                      maxLength={40}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {saving ? <Spinner label="Creating" /> : "Create Org and Entity"}
                </button>
              </form>

              <form onSubmit={createEntity} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-zinc-950">New Entity</h2>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-zinc-800">
                    Organisation
                    <SelectControl
                      value={selectedAdminOrg?.id ?? ""}
                      onChange={(event) => setSelectedOrgId(event.target.value)}
                      disabled={!manageableOrgs.length}
                    >
                      {manageableOrgs.length ? (
                        manageableOrgs.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))
                      ) : (
                        <option value="">No admin orgs</option>
                      )}
                    </SelectControl>
                  </label>
                  <label className="block text-sm font-medium text-zinc-800">
                    Entity Name
                    <input
                      value={newEntityName}
                      onChange={(event) => setNewEntityName(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                      placeholder="Lumen US Inc."
                      maxLength={120}
                      required
                      disabled={!manageableOrgs.length}
                    />
                  </label>
                  <label className="block text-sm font-medium text-zinc-800">
                    Entity Code
                    <input
                      value={newEntityCode}
                      onChange={(event) => setNewEntityCode(event.target.value)}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                      placeholder="US"
                      maxLength={40}
                      disabled={!manageableOrgs.length}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={saving || !manageableOrgs.length}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  {saving ? <Spinner label="Creating" /> : "Add Entity"}
                </button>
              </form>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-semibold text-zinc-950">Accessible Entities</h2>
                  {state.orgs.length ? (
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                      <SelectControl
                        value={selectedOrg?.id ?? ""}
                        onChange={(event) => setSelectedOrgId(event.target.value)}
                        className="mt-0 sm:w-56"
                      >
                        {state.orgs.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </SelectControl>
                      {selectedOrg?.role === "owner" ? (
                        <button
                          type="button"
                          onClick={() => void deleteOrg(selectedOrg)}
                          disabled={pendingAction === `org:${selectedOrg.id}`}
                          className={dangerButtonClassName}
                        >
                          {pendingAction === `org:${selectedOrg.id}` ? <Spinner label="Deleting" /> : "Delete Org"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {loading ? (
                <div className="space-y-4 p-5">
                  <SkeletonBlock className="h-16 w-full" />
                  <SkeletonBlock className="h-16 w-full" />
                </div>
              ) : !state.orgs.length ? (
                <div className="p-5 text-sm leading-6 text-zinc-600">No organisations yet. Create one to start managing entities and uploads.</div>
              ) : !visibleEntities.length ? (
                <div className="p-5 text-sm leading-6 text-zinc-600">No entities in this organisation yet.</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {visibleEntities.map((entity) => {
                    const mappedTenantName = tenantLabel(state.xero.tenants, entity.xeroMapping);
                    const isMapping = mappingEntityId === entity.id;
                    const isDeletingEntity = pendingAction === `entity:${entity.id}`;
                    const isEditingEntity = editingEntityId === entity.id;
                    const isSavingEntity = pendingAction === `entity-edit:${entity.id}`;
                    const isBusy = isMapping || isDeletingEntity || isSavingEntity;
                    const canDeleteEntity = entity.canAdmin && selectedOrg?.role === "owner";
                    const accounts = accountsByEntityId[entity.id] ?? [];
                    const accountsLoading = accountLoadingEntityIds.includes(entity.id);
                    const accountError = accountErrorsByEntityId[entity.id];
                    const accountSyncNote = accountSyncNotesByEntityId[entity.id];
                    const accountDraft = accountDraftsByEntityId[entity.id] ?? defaultBankAccountDraft();
                    const creatingAccount = accountAction === `account-create:${entity.id}`;
                    const syncingAccounts = accountAction === `account-sync:${entity.id}`;

                    return (
                      <div key={entity.id} className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(330px,360px)] md:items-start">
                        {isEditingEntity ? (
                          <form onSubmit={(event) => void updateEntity(event, entity)} className="min-w-0 space-y-3 md:col-span-2">
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(120px,180px)]">
                              <label className="block text-sm font-medium text-zinc-800">
                                Entity Name
                                <input
                                  value={editEntityName}
                                  onChange={(event) => setEditEntityName(event.target.value)}
                                  className={inputClassName}
                                  placeholder="Lumen HK Limited"
                                  maxLength={120}
                                  required
                                  disabled={isSavingEntity}
                                />
                              </label>
                              <label className="block text-sm font-medium text-zinc-800">
                                Entity Code
                                <input
                                  value={editEntityCode}
                                  onChange={(event) => setEditEntityCode(event.target.value)}
                                  className={inputClassName}
                                  placeholder="HK"
                                  maxLength={40}
                                  disabled={isSavingEntity}
                                />
                              </label>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button type="button" onClick={cancelEditEntity} disabled={isSavingEntity} className={secondaryButtonClassName}>
                                Cancel
                              </button>
                              <button type="submit" disabled={isSavingEntity} className={saveButtonClassName}>
                                {isSavingEntity ? <Spinner label="Saving" /> : "Save Entity"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-zinc-950">{entity.name}</h3>
                              {entity.code ? <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">{entity.code}</span> : null}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-zinc-600">
                              Xero: <span className={entity.xeroMapping ? "font-medium text-emerald-800" : "font-medium text-amber-800"}>{mappedTenantName}</span>
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">{entity.canAdmin ? "Admin access" : `Role: ${entity.role || "org member"}`}</div>
                          </div>
                        )}

                        {!isEditingEntity ? (
                          <div className="flex min-w-0 flex-col gap-2 md:items-end">
                            <SelectControl
                              value={entity.xeroMapping?.connection_tenant_id ?? ""}
                              onChange={(event) => {
                                if (event.target.value) void mapEntity(entity.id, event.target.value);
                              }}
                              disabled={!entity.canAdmin || !state.xero.tenants.length || isBusy}
                              className="mt-0"
                              aria-label={`Map ${entity.name} to Xero tenant`}
                            >
                              <option value="">{state.xero.tenants.length ? "Choose Xero tenant" : "No Xero tenants"}</option>
                              {state.xero.tenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                  {tenant.name}
                                </option>
                              ))}
                            </SelectControl>
                            <div className="flex w-full flex-wrap items-center justify-start gap-2 md:flex-nowrap md:justify-end">
                              {entity.canAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => startEditEntity(entity)}
                                  disabled={isBusy}
                                  className={secondaryButtonClassName}
                                >
                                  Edit Entity
                                </button>
                              ) : null}
                              {entity.xeroMapping ? (
                                <button
                                  type="button"
                                  onClick={() => void unmapEntity(entity.id)}
                                  disabled={!entity.canAdmin || isBusy}
                                  className={unmapButtonClassName}
                                >
                                  {isMapping ? <Spinner label="Unmapping" /> : "Unmap Xero"}
                                </button>
                              ) : null}
                              {canDeleteEntity ? (
                                <button type="button" onClick={() => void deleteEntity(entity)} disabled={isBusy} className={dangerButtonClassName}>
                                  {isDeletingEntity ? <Spinner label="Deleting" /> : "Delete Entity"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {!isEditingEntity ? (
                          <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3 md:col-span-2">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Bank Accounts</div>
                                <div className="mt-1 text-xs leading-5 text-zinc-600">
                                  {accountsLoading ? "Loading accounts" : `${accounts.length} active account${accounts.length === 1 ? "" : "s"}`}
                                  {entity.xeroMapping ? " - Xero mapped" : " - Upload accounts only"}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                {entity.xeroMapping ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!session) return;
                                      setAccountAction(`account-sync:${entity.id}`);
                                      void loadBankAccounts(entity.id, session.accessToken, { syncXero: true }).finally(() => setAccountAction(null));
                                    }}
                                    disabled={!entity.canAdmin || syncingAccounts || accountsLoading}
                                    className={secondaryButtonClassName}
                                  >
                                    {syncingAccounts ? <Spinner label="Syncing" /> : "Sync Xero"}
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {entity.canAdmin ? (
                              <form onSubmit={(event) => void createBankAccount(event, entity)} className="mt-3 grid gap-2 lg:grid-cols-[minmax(160px,1fr)_92px_116px_auto] lg:items-end">
                                <label className="block text-xs font-medium text-zinc-700">
                                  Name
                                  <input
                                    value={accountDraft.accountName}
                                    onChange={(event) => setAccountDraft(entity.id, { accountName: event.target.value })}
                                    disabled={creatingAccount}
                                    className="mt-1 h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                                    placeholder="Upload account"
                                    maxLength={120}
                                  />
                                </label>
                                <label className="block text-xs font-medium text-zinc-700">
                                  Currency
                                  <input
                                    value={accountDraft.currency}
                                    onChange={(event) => setAccountDraft(entity.id, { currency: normalizeCurrency(event.target.value) })}
                                    disabled={creatingAccount}
                                    className="mt-1 h-9 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm uppercase text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                                    placeholder="USD"
                                    maxLength={3}
                                  />
                                </label>
                                <label className="block text-xs font-medium text-zinc-700">
                                  Type
                                  <SelectControl
                                    value={accountDraft.accountType}
                                    onChange={(event) => setAccountDraft(entity.id, { accountType: event.target.value as BankAccountRow["accountType"] })}
                                    disabled={creatingAccount}
                                    className="mt-1"
                                  >
                                    <option value="bank">Bank</option>
                                    <option value="money_processor">MP</option>
                                  </SelectControl>
                                </label>
                                <button type="submit" disabled={creatingAccount || !accountDraft.accountName.trim()} className={saveButtonClassName}>
                                  {creatingAccount ? <Spinner label="Adding" /> : "Add"}
                                </button>
                              </form>
                            ) : null}

                            {accountError ? <div className="mt-3 text-xs leading-5 text-red-700">{accountError}</div> : null}
                            {accountSyncNote ? <div className="mt-3 text-xs leading-5 text-zinc-500">{accountSyncNote}</div> : null}

                            {accountsLoading && accounts.length === 0 ? (
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <SkeletonBlock className="h-11 w-full" />
                                <SkeletonBlock className="h-11 w-full" />
                              </div>
                            ) : accounts.length ? (
                              <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                                <div className="divide-y divide-zinc-100">
                                  {accounts.map((account) => {
                                    const isManual = account.source === "manual";
                                    const isEditingAccount = editingAccountId === account.id;
                                    const savingAccount = accountAction === `account-edit:${account.id}`;
                                    const deletingAccount = accountAction === `account-delete:${account.id}`;
                                    const accountBusy = savingAccount || deletingAccount || syncingAccounts || accountsLoading;

                                    return (
                                      <div key={account.id} className="grid min-w-0 gap-2 px-3 py-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                                        <div className="min-w-0">
                                          {isEditingAccount ? (
                                            <div className="grid gap-2 sm:grid-cols-[minmax(150px,1fr)_120px] sm:items-end">
                                              <label className="block min-w-0 text-xs font-medium text-zinc-700">
                                                Name
                                                <input
                                                  type="text"
                                                  value={editingAccountName}
                                                  onChange={(event) => setEditingAccountName(event.target.value)}
                                                  disabled={!isManual || savingAccount}
                                                  className="mt-1 h-9 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                                                />
                                              </label>
                                              <label className="block text-xs font-medium text-zinc-700">
                                                Type
                                                <SelectControl
                                                  value={editingAccountType}
                                                  onChange={(event) => setEditingAccountType(event.target.value as BankAccountRow["accountType"])}
                                                  disabled={savingAccount}
                                                  className="mt-1"
                                                >
                                                  <option value="bank">Bank</option>
                                                  <option value="money_processor">MP</option>
                                                </SelectControl>
                                              </label>
                                            </div>
                                          ) : (
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                              <div className="min-w-0 truncate text-sm font-medium text-zinc-950">{account.accountName}</div>
                                              <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                                                {account.source === "xero" ? "Xero" : "Upload"}
                                              </span>
                                              <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                                                {accountTypeLabel(account.accountType)}
                                              </span>
                                              {account.currency ? (
                                                <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200">
                                                  {account.currency}
                                                </span>
                                              ) : null}
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex min-w-0 flex-wrap gap-2 lg:justify-end">
                                          {isEditingAccount ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => void updateBankAccount(account)}
                                                disabled={accountBusy || (isManual && !editingAccountName.trim())}
                                                className={secondaryButtonClassName}
                                              >
                                                {savingAccount ? <Spinner label="Saving" /> : "Save"}
                                              </button>
                                              <button type="button" onClick={cancelEditBankAccount} disabled={savingAccount} className={secondaryButtonClassName}>
                                                Cancel
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => startEditBankAccount(account)}
                                                disabled={!entity.canAdmin || accountBusy}
                                                className={secondaryButtonClassName}
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void archiveBankAccount(account)}
                                                disabled={!entity.canAdmin || !isManual || accountBusy}
                                                title={isManual ? "Archive upload account" : "Xero accounts are managed in Xero"}
                                                className={dangerButtonClassName}
                                              >
                                                {deletingAccount ? <Spinner label="Archiving" /> : "Archive"}
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-3 text-xs leading-5 text-zinc-500">
                                No bank accounts yet. Add an upload account or sync Xero for mapped entities.
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
