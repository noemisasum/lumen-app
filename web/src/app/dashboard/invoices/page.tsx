"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Notice, SkeletonBlock, Spinner } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { StoredObjectRef } from "@/lib/storage/types";
import { getStorageAdapter } from "@/lib/storage";

type OrgRow = { id: string; name: string; slug: string };

type EntityRow = { id: string; org_id: string; name: string; code: string | null };

type InvoiceRow = {
  id: string;
  org_id: string;
  entity_id: string;
  status: string;
  vendor_name: string | null;
  description: string | null;
  currency: string | null;
  total: number | null;
  created_at: string;
};

type InvoiceFileRow = {
  id: string;
  invoice_id: string;
  org_id: string;
  entity_id: string;
  provider: StoredObjectRef["provider"];
  bucket: string;
  object_key: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type SingleUserInvoiceRow = Omit<InvoiceRow, "org_id" | "entity_id">;

type SingleUserInvoiceFileRow = Omit<InvoiceFileRow, "org_id" | "entity_id">;

type InvoiceInsertPayload = {
  created_by: string;
  status: string;
  currency: string;
  org_id?: string;
  entity_id?: string;
};

type InvoiceFileInsertPayload = {
  invoice_id: string;
  created_by: string;
  provider: StoredObjectRef["provider"];
  bucket: string;
  object_key: string;
  mime_type: string | null;
  size_bytes: number;
  org_id?: string;
  entity_id?: string;
};

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function InvoicesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [entityId, setEntityId] = useState<string>("");
  const [multiOrgMode, setMultiOrgMode] = useState(false);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [filesByInvoice, setFilesByInvoice] = useState<Record<string, InvoiceFileRow[]>>({});

  async function ensureSession() {
    if (!supabase) throw new Error("Authentication is not configured for this deployment.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      window.location.replace("/login");
      return null;
    }
    return data.session;
  }

  async function load() {
    try {
      if (!supabase) {
        setError("Authentication is not configured for this deployment.");
        return;
      }

      const sess = await ensureSession();
      if (!sess) return;
      setAuthReady(true);

      // Try multi-org tables first; if they don't exist, fall back to single-user mode.
      let detectedMultiOrg = false;
      const { data: orgRows, error: orgErr } = await supabase.from("orgs").select("id,name,slug").order("name");
      if (!orgErr && orgRows) {
        detectedMultiOrg = true;
        setMultiOrgMode(true);
        setOrgs(orgRows as OrgRow[]);

        // Entities the user can see (RLS filtered)
        const { data: entRows, error: entErr } = await supabase
          .from("entities")
          .select("id,org_id,name,code")
          .order("name");
        if (entErr) throw entErr;
        const ents = (entRows || []) as EntityRow[];
        setEntities(ents);

        // Initialize selection if empty
        const currentOrgId = orgId || (orgRows[0]?.id as string) || "";
        const currentEntityId = entityId || ents.find((e) => e.org_id === currentOrgId)?.id || "";
        if (currentOrgId && currentOrgId !== orgId) setOrgId(currentOrgId);
        if (currentEntityId && currentEntityId !== entityId) setEntityId(currentEntityId);

        // Only load invoices once we have an entity selected
        if (!currentEntityId) {
          setInvoices([]);
          setFilesByInvoice({});
          return;
        }

        const { data: invs, error: invErr } = await supabase
          .from("invoices")
          .select("id,org_id,entity_id,status,vendor_name,description,currency,total,created_at")
          .eq("entity_id", currentEntityId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (invErr) throw invErr;
        const rows = (invs || []) as InvoiceRow[];
        setInvoices(rows);

        const ids = rows.map((r) => r.id);
        if (!ids.length) {
          setFilesByInvoice({});
          return;
        }

        const { data: files, error: fErr } = await supabase
          .from("invoice_files")
          .select("id,invoice_id,org_id,entity_id,provider,bucket,object_key,mime_type,size_bytes,created_at")
          .in("invoice_id", ids)
          .order("created_at", { ascending: false });

        if (fErr) throw fErr;

        const grouped: Record<string, InvoiceFileRow[]> = {};
        for (const f of (files || []) as InvoiceFileRow[]) {
          const invId = f.invoice_id;
          grouped[invId] = grouped[invId] || [];
          grouped[invId].push(f);
        }
        setFilesByInvoice(grouped);
      }

      if (!detectedMultiOrg) {
        setMultiOrgMode(false);
        // Single-user mode (schema.sql)
        const { data: invs, error: invErr } = await supabase
          .from("invoices")
          .select("id,status,vendor_name,description,currency,total,created_at")
          .order("created_at", { ascending: false })
          .limit(50);

        if (invErr) throw invErr;
        const rows = ((invs || []) as SingleUserInvoiceRow[]).map((invoice) => ({
          ...invoice,
          org_id: "",
          entity_id: "",
        }));
        setInvoices(rows);

        const ids = rows.map((r) => r.id);
        if (!ids.length) {
          setFilesByInvoice({});
          return;
        }

        const { data: files, error: fErr } = await supabase
          .from("invoice_files")
          .select("id,invoice_id,provider,bucket,object_key,mime_type,size_bytes,created_at")
          .in("invoice_id", ids)
          .order("created_at", { ascending: false });

        if (fErr) throw fErr;
        const grouped: Record<string, InvoiceFileRow[]> = {};
        for (const f of (files || []) as SingleUserInvoiceFileRow[]) {
          const invId = f.invoice_id;
          grouped[invId] = grouped[invId] || [];
          grouped[invId].push({
            ...f,
            org_id: "",
            entity_id: "",
          });
        }
        setFilesByInvoice(grouped);
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load invoices"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Reload when entity changes (multi-org mode)
    if (!entityId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  async function onUpload(file: File) {
    try {
      if (!supabase) throw new Error("Authentication is not configured for this deployment.");
      const sess = await ensureSession();
      if (!sess) return;

      setUploading(true);
      setError(null);

      // 1) Create invoice row
      const insertPayload: InvoiceInsertPayload = {
        created_by: sess.user.id,
        status: "UPLOADED",
        currency: "USD",
      };
      // In multi-org schema, entity/org are required.
      if (orgId && entityId) {
        insertPayload.org_id = orgId;
        insertPayload.entity_id = entityId;
      }

      const { data: created, error: cErr } = await supabase
        .from("invoices")
        .insert(insertPayload)
        .select("id")
        .single();

      if (cErr) throw cErr;
      const invoiceId = created.id as string;

      // 2) Upload file to storage
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const safeExt = ext.replace(/[^a-z0-9]/g, "") || "pdf";
      const objectKey = `${sess.user.id}/${invoiceId}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

      const { error: uErr } = await supabase.storage.from("invoices").upload(objectKey, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (uErr) throw uErr;

      // 3) Create invoice_files row (future-proof ref)
      const filePayload: InvoiceFileInsertPayload = {
        invoice_id: invoiceId,
        created_by: sess.user.id,
        provider: "supabase",
        bucket: "invoices",
        object_key: objectKey,
        mime_type: file.type || null,
        size_bytes: file.size,
      };
      if (orgId && entityId) {
        filePayload.org_id = orgId;
        filePayload.entity_id = entityId;
      }
      const { error: fErr } = await supabase.from("invoice_files").insert(filePayload);
      if (fErr) throw fErr;

      await load();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function openFile(f: InvoiceFileRow) {
    const ref: StoredObjectRef = { provider: f.provider, bucket: f.bucket, key: f.object_key };
    const adapter = getStorageAdapter(ref);
    const url = await adapter.getSignedUrl({ ref, expiresInSeconds: 60 * 10 });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const uploadUnavailable = !supabase || !authReady || uploading || (multiOrgMode && (!orgs.length || !entityId));

  if (loading && !authReady) {
    return (
      <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
                <BrandLogo className="h-6 w-auto sm:h-7" />
              </Link>
              <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
              <div className="text-sm font-medium text-zinc-700">Dashboard</div>
            </div>
          </header>

          <main className="mt-8">
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="min-h-6 text-sm leading-6 text-zinc-600">
                <Spinner label="Checking Session" />
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#f7f6f2] text-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex min-h-11 flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link href="/" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950">
                <BrandLogo className="h-6 w-auto sm:h-7" />
              </Link>
              <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
              <div className="text-sm font-medium text-zinc-700">Dashboard</div>
            </div>
          </header>

          <main className="mt-8">
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <Notice tone="error" title="Authentication Needs Configuration">
                {error || "Sign in is required before this area can load."}
              </Notice>
            </section>
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
              <BrandLogo className="h-6 w-auto sm:h-7" />
            </Link>
            <div className="h-6 w-px bg-zinc-300" aria-hidden="true" />
            <div className="text-sm font-medium text-zinc-700">Statement Intake</div>
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#876b16]">Statement Intake</div>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">Upload Invoices and Statements.</h1>
                <div className="mt-2 min-h-6 text-sm leading-6 text-zinc-600">
                  {multiOrgMode && !orgs.length ? "Create an organisation and entity before uploading." : "PDF and image files are accepted."}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {multiOrgMode && orgs.length ? (
                  <div className="space-y-1">
                    <label htmlFor="invoice-entity" className="sr-only">
                      Entity
                    </label>
                    <select
                      id="invoice-entity"
                      value={entityId}
                      onChange={(e) => setEntityId(e.target.value)}
                      className="h-10 w-full min-w-44 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                      title="Entity"
                    >
                      {entities
                        .filter((x) => x.org_id === orgId)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept="application/pdf,image/*"
                  disabled={uploadUnavailable}
                  aria-label="Choose invoice or statement file"
                  tabIndex={-1}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploadUnavailable}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:text-white"
                  aria-describedby={multiOrgMode && (!orgs.length || !entityId) ? "upload-disabled-reason" : undefined}
                >
                  {uploading ? <Spinner label="Uploading" /> : "Upload"}
                </button>
              </div>
            </div>

            {multiOrgMode && orgs.length && !entityId ? (
              <div id="upload-disabled-reason" className="mt-4 text-sm text-zinc-600">
                Select an entity to upload.
              </div>
            ) : null}

            {multiOrgMode && !orgs.length ? (
              <div id="upload-disabled-reason" className="mt-4 text-sm text-zinc-600">
                No orgs are available for this account yet.
              </div>
            ) : null}

            {error ? (
              <div className="mt-4">
                <Notice tone="error" title="Statement Intake Needs Attention">
                  {error}
                </Notice>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-950">Recent Uploads</h2>
            </div>

            {loading ? (
              <div className="space-y-4 p-5">
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-14 w-full" />
                <SkeletonBlock className="h-14 w-full" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-5 text-sm leading-6 text-zinc-600">No uploads yet. Add the first statement or invoice when you are ready.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {invoices.map((inv) => {
                  const files = filesByInvoice[inv.id] || [];
                  return (
                    <div key={inv.id} className="px-5 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-900">{inv.description || "Invoice"}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {new Date(inv.created_at).toLocaleString()} · {inv.status}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {files[0] ? (
                            <button
                              type="button"
                              onClick={() => openFile(files[0])}
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                            >
                              View File
                            </button>
                          ) : null}
                          <div className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                            {inv.currency || "USD"} {inv.total ?? "Pending"}
                          </div>
                        </div>
                      </div>

                      {files.length > 1 ? (
                        <div className="mt-2 text-xs text-zinc-500">{files.length} files attached</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
