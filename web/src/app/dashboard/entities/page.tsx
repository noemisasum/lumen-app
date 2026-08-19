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

const iconButtonClassName =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400";

const dangerButtonClassName =
  "inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-sm font-medium text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function tenantLabel(tenants: XeroTenant[], mapping: EntityXeroMapping | null) {
  if (!mapping) return "Not mapped";
  return tenants.find((tenant) => tenant.id === mapping.connection_tenant_id)?.name || mapping.xero_tenant_id;
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

  const manageableOrgs = state.orgs.filter((org) => org.role === "owner" || org.role === "admin");
  const selectedOrg = state.orgs.find((org) => org.id === selectedOrgId) ?? state.orgs[0] ?? null;
  const selectedAdminOrg = manageableOrgs.find((org) => org.id === selectedOrgId) ?? manageableOrgs[0] ?? null;
  const visibleEntities = selectedOrg ? state.entities.filter((entity) => entity.org_id === selectedOrg.id) : state.entities;

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
      setNotice({ tone: "success", title: "Organisation Created", message: "Your first entity is ready to map to a Xero tenant." });
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
      setNotice({ tone: "success", title: "Entity Created", message: "Map it to Xero before bank statement ingestion starts." });
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to create entity."));
    } finally {
      setSaving(false);
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
      setNotice({ tone: "success", title: "Xero Tenant Mapped", message: "This entity is ready for the bank statement ingestion slice." });
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
      setNotice({ tone: "info", title: "Xero Mapping Removed", message: "Map a tenant again before importing bank statements for this entity." });
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
                <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">Map Lumen Entities to Xero.</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                  Create the organisations and entities your team works across, then choose the matching Xero tenant before bank statement ingestion is enabled.
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
                <div className="p-5 text-sm leading-6 text-zinc-600">No organisations yet. Create one to start mapping entities to Xero.</div>
              ) : !visibleEntities.length ? (
                <div className="p-5 text-sm leading-6 text-zinc-600">No entities in this organisation yet.</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {visibleEntities.map((entity) => {
                    const mappedTenantName = tenantLabel(state.xero.tenants, entity.xeroMapping);
                    const isMapping = mappingEntityId === entity.id;
                    const isDeletingEntity = pendingAction === `entity:${entity.id}`;
                    const canDeleteEntity = entity.canAdmin && selectedOrg?.role === "owner";

                    return (
                      <div key={entity.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_280px] lg:items-center">
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

                        <div className="flex min-w-0 flex-col gap-2">
                          <SelectControl
                            value={entity.xeroMapping?.connection_tenant_id ?? ""}
                            onChange={(event) => {
                              if (event.target.value) void mapEntity(entity.id, event.target.value);
                            }}
                            disabled={!entity.canAdmin || !state.xero.tenants.length || isMapping}
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
                          <div className="flex items-center justify-end gap-2">
                            {entity.xeroMapping ? (
                              <button
                                type="button"
                                onClick={() => void unmapEntity(entity.id)}
                                disabled={!entity.canAdmin || isMapping || isDeletingEntity}
                                className={iconButtonClassName}
                                aria-label={`Unmap ${entity.name} from Xero`}
                                title="Unmap Xero tenant"
                              >
                                {isMapping ? <Spinner label="Updating" /> : "X"}
                              </button>
                            ) : null}
                            {canDeleteEntity ? (
                              <button
                                type="button"
                                onClick={() => void deleteEntity(entity)}
                                disabled={isMapping || isDeletingEntity}
                                className={dangerButtonClassName}
                              >
                                {isDeletingEntity ? <Spinner label="Deleting" /> : "Delete Entity"}
                              </button>
                            ) : null}
                          </div>
                        </div>
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
