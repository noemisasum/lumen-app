"use client";

import { useEffect, useMemo, useState } from "react";
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

  const [loading, setLoading] = useState(true);
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
    if (!supabase) throw new Error("Missing Supabase env vars");
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
        setError("Missing Supabase env vars");
        return;
      }

      const sess = await ensureSession();
      if (!sess) return;

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
      if (!supabase) throw new Error("Missing Supabase env vars");
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/lumen-app-logo.jpg" alt="Lumen App" className="h-7 w-auto" />
            <div className="text-sm font-medium text-zinc-700">Invoices</div>
          </div>
          <a
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </a>
        </header>

        <main className="mt-8 space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Upload invoice</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {multiOrgMode && !orgs.length ? "Create an org and entity before uploading." : "PDF or image."}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {multiOrgMode && orgs.length ? (
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm"
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
                ) : null}

                <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white hover:bg-zinc-800">
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/*"
                    disabled={uploading || (multiOrgMode && (!orgs.length || !entityId))}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(f);
                      e.currentTarget.value = "";
                    }}
                  />
                  {uploading ? "Uploading…" : "Upload"}
                </label>
              </div>
            </div>

            {multiOrgMode && orgs.length && !entityId ? (
              <div className="mt-4 text-sm text-zinc-600">Select an entity to upload.</div>
            ) : null}

            {multiOrgMode && !orgs.length ? (
              <div className="mt-4 text-sm text-zinc-600">No orgs are available for this account yet.</div>
            ) : null}

            {error ? <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</div> : null}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
            <div className="text-sm font-semibold">Recent</div>

            {loading ? (
              <div className="mt-3 text-sm text-zinc-600">Loading…</div>
            ) : invoices.length === 0 ? (
              <div className="mt-3 text-sm text-zinc-600">No invoices yet.</div>
            ) : (
              <div className="mt-4 divide-y divide-zinc-100">
                {invoices.map((inv) => {
                  const files = filesByInvoice[inv.id] || [];
                  return (
                    <div key={inv.id} className="py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-medium text-zinc-900">{inv.description || "Invoice"}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {new Date(inv.created_at).toLocaleString()} • {inv.status}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {files[0] ? (
                            <button
                              onClick={() => openFile(files[0])}
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-50"
                            >
                              View file
                            </button>
                          ) : null}
                          <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700">
                            {inv.currency || "USD"} {inv.total ?? "—"}
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
          </div>
        </main>
      </div>
    </div>
  );
}
