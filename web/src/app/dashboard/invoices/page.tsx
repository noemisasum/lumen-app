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

type BankAccountRow = {
  id: string;
  entityId: string;
  entityXeroMappingId: string | null;
  xeroBankAccountId: string | null;
  accountName: string;
  currency: string | null;
  status: string;
  source: "xero" | "manual";
  createdAt: string;
  updatedAt: string;
};

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

const statementFileAccept =
  "application/pdf,image/*,.csv,text/csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const selectClassName =
  "h-10 w-full min-w-0 appearance-none truncate rounded-lg border border-zinc-300 bg-white py-0 pl-2.5 pr-9 text-[13px] text-zinc-950 shadow-sm outline-none transition focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 sm:pl-3 sm:pr-10 sm:text-sm";

function SelectControl({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <span className={`relative block min-w-0 ${className}`}>
      <select {...props} className={selectClassName}>
        {children}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 h-2.5 w-2.5 -translate-y-[60%] rotate-45 border-b border-r border-zinc-500"
        aria-hidden="true"
      />
    </span>
  );
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function isStatementLikeFile(file: File) {
  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    mimeType.includes("csv") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    /\.(csv|xls|xlsx|pdf|png|jpe?g|webp|heic|tiff?)$/i.test(fileName)
  );
}

function titleCaseFromFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const cleaned = baseName
    .replace(/[_-]+/g, " ")
    .replace(/\b(statement|bank|transactions?|export|download|csv|xlsx?|pdf|image)\b/gi, " ")
    .replace(/\b(20\d{2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 3) return "";
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function csvCells(line: string) {
  return line
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((cell) => cell.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

async function extractCsvAccountHint(file: File) {
  if (!file.name.toLowerCase().endsWith(".csv") && !file.type.toLowerCase().includes("csv")) return "";

  const text = await file.slice(0, 16_384).text().catch(() => "");
  const rows = text
    .split(/\r?\n/)
    .slice(0, 12)
    .map(csvCells)
    .filter((row) => row.length);

  for (const row of rows) {
    const joined = row.join(" ").toLowerCase();
    const valueCell = row.find((cell, index) => {
      const previous = row[index - 1]?.toLowerCase() ?? "";
      return /account\s*(name|identifier|number|no\.?|id)?/.test(previous) && cell.length >= 3;
    });
    if (valueCell) return valueCell.slice(0, 80);

    const labeledValue = joined.match(/account\s*(?:name|identifier|number|no\.?|id)?\s*[:=-]\s*([a-z0-9][a-z0-9 ._-]{2,80})/i);
    if (labeledValue?.[1]) return labeledValue[1].trim();
  }

  return "";
}

function statementUploadTitle(accountName?: string) {
  const normalizedName = accountName?.trim().replace(/\s+/g, " ");
  return normalizedName ? `${normalizedName} Statement Upload` : "Bank Statement Upload";
}

export default function InvoicesPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [entityId, setEntityId] = useState<string>("");
  const [multiOrgMode, setMultiOrgMode] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [bankAccountError, setBankAccountError] = useState<string | null>(null);
  const [manualAccountName, setManualAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountSyncNote, setAccountSyncNote] = useState<string | null>(null);

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

  async function loadBankAccounts(nextEntityId: string, accessToken: string) {
    if (!nextEntityId) {
      setBankAccounts([]);
      setBankAccountId("");
      setAccountSyncNote(null);
      return;
    }

    setBankAccountsLoading(true);
    setBankAccountError(null);
    setAccountSyncNote(null);

    try {
      const params = new URLSearchParams({ entityId: nextEntityId, syncXero: "1" });
      const response = await fetch(`/api/entity-bank-accounts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = (await response.json()) as {
        accounts?: BankAccountRow[];
        sync?: { synced?: boolean; count?: number; warning?: string };
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Failed to load bank accounts.");

      const accounts = body.accounts ?? [];
      setBankAccounts(accounts);
      setBankAccountId((current) => (accounts.some((account) => account.id === current) ? current : ""));

      if (body.sync?.warning) {
        setAccountSyncNote(body.sync.warning);
      } else if (body.sync?.synced && body.sync.count) {
        setAccountSyncNote(`Synced ${body.sync.count} Xero bank account${body.sync.count === 1 ? "" : "s"}.`);
      }
    } catch (e: unknown) {
      setBankAccounts([]);
      setBankAccountId("");
      setBankAccountError(getErrorMessage(e, "Failed to load bank accounts."));
    } finally {
      setBankAccountsLoading(false);
    }
  }

  async function createManualBankAccount(
    accountName: string,
    accessToken: string,
    options: { allowDuplicate?: boolean; select?: boolean } = {},
  ) {
    const normalizedName = accountName.trim().replace(/\s+/g, " ");
    if (!entityId || !normalizedName) throw new Error("Choose an entity and enter a bank account name.");

    const response = await fetch("/api/entity-bank-accounts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entityId, accountName: normalizedName, allowDuplicate: options.allowDuplicate === true }),
    });
    const body = (await response.json()) as { account?: BankAccountRow; error?: string };
    if (!response.ok || !body.account) throw new Error(body.error || "Failed to create bank account.");

    setBankAccounts((current) => {
      const withoutDuplicate = current.filter((account) => account.id !== body.account?.id);
      return [...withoutDuplicate, body.account as BankAccountRow].sort((left, right) => left.accountName.localeCompare(right.accountName));
    });
    if (options.select !== false) setBankAccountId(body.account.id);
    setManualAccountName("");
    return body.account;
  }

  async function onCreateManualAccount() {
    try {
      if (!supabase) throw new Error("Authentication is not configured for this deployment.");
      const sess = await ensureSession();
      if (!sess) return;

      setCreatingAccount(true);
      setBankAccountError(null);
      await createManualBankAccount(manualAccountName, sess.access_token);
    } catch (e: unknown) {
      setBankAccountError(getErrorMessage(e, "Failed to create bank account."));
    } finally {
      setCreatingAccount(false);
    }
  }

  async function suggestedAccountNameFromFiles(files: File[]) {
    for (const file of files) {
      const csvHint = await extractCsvAccountHint(file);
      if (csvHint) return csvHint;
    }

    for (const file of files) {
      const nameHint = titleCaseFromFileName(file.name);
      if (nameHint) return nameHint;
    }

    const entityName = entities.find((entity) => entity.id === entityId)?.name;
    return entityName ? `${entityName} Statement Account` : "Statement Upload Account";
  }

  async function ensureUploadBankAccount(files: File[], accessToken: string, selectedAccountId: string) {
    if (!multiOrgMode || !entityId) return null;
    if (selectedAccountId) {
      const accountName = bankAccounts.find((account) => account.id === selectedAccountId)?.accountName;
      return { id: selectedAccountId, accountName };
    }

    const suggestedName = await suggestedAccountNameFromFiles(files);
    const account = await createManualBankAccount(suggestedName, accessToken, { allowDuplicate: true, select: false });
    return { id: account.id, accountName: account.accountName };
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
          setBankAccounts([]);
          setBankAccountId("");
          return;
        }

        await loadBankAccounts(currentEntityId, sess.access_token);

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
        setBankAccounts([]);
        setBankAccountId("");
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
      setError(getErrorMessage(e, "Failed to load statement uploads"));
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

  async function uploadOneFile(
    file: File,
    userId: string,
    accessToken: string,
    client: NonNullable<typeof supabase>,
    selectedBankAccountId: string,
    selectedBankAccountName?: string,
  ) {
    if (entityId && selectedBankAccountId && isStatementLikeFile(file)) {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const safeExt = ext.replace(/[^a-z0-9]/g, "") || "pdf";
      const objectKey = `${userId}/statement-intake/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

      const { error: uploadError } = await client.storage.from("invoices").upload(objectKey, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      try {
        const response = await fetch("/api/statement-upload-finalize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            entityId,
            bankAccountId: selectedBankAccountId,
            bucket: "invoices",
            objectKey,
            mimeType: file.type || null,
            sizeBytes: file.size,
            description: statementUploadTitle(selectedBankAccountName),
          }),
        });
        const body = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(body.error || "Failed to link upload to bank account.");
      } catch (e) {
        await client.storage.from("invoices").remove([objectKey]);
        throw e;
      }

      return;
    }

    // 1) Create invoice row
    const insertPayload: InvoiceInsertPayload = {
      created_by: userId,
      status: "UPLOADED",
      currency: "USD",
    };
    // In multi-org schema, entity/org are required.
    if (orgId && entityId) {
      insertPayload.org_id = orgId;
      insertPayload.entity_id = entityId;
    }

    const { data: created, error: cErr } = await client
      .from("invoices")
      .insert(insertPayload)
      .select("id")
      .single();

    if (cErr) throw cErr;
    const invoiceId = created.id as string;

    // 2) Upload file to storage
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9]/g, "") || "pdf";
    const objectKey = `${userId}/${invoiceId}/${Date.now()}-${crypto.randomUUID()}.${safeExt}`;

    const { error: uErr } = await client.storage.from("invoices").upload(objectKey, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (uErr) throw uErr;

    // 3) Create invoice_files row (future-proof ref)
    const filePayload: InvoiceFileInsertPayload = {
      invoice_id: invoiceId,
      created_by: userId,
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
    const { data: createdFile, error: fErr } = await client.from("invoice_files").insert(filePayload).select("id").single();
    if (fErr) throw fErr;

    if (entityId && selectedBankAccountId && isStatementLikeFile(file)) {
      const response = await fetch("/api/bank-statement-imports", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entityId,
          bankAccountId: selectedBankAccountId,
          rawFileId: createdFile.id,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to link upload to bank account.");
    }
  }

  async function onUpload(files: File[]) {
    if (!files.length) return;

    let uploadedCount = 0;

    try {
      if (!supabase) throw new Error("Authentication is not configured for this deployment.");
      const sess = await ensureSession();
      if (!sess) return;

      setUploading(true);
      setError(null);
      setUploadStatus(files.length === 1 ? "Uploading 1 file..." : `Uploading 1 of ${files.length} files...`);
      const selectedAccountId = bankAccountId;

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadStatus(files.length === 1 ? "Uploading 1 file..." : `Uploading ${index + 1} of ${files.length} files...`);
        const selectedBankAccount = await ensureUploadBankAccount([file], sess.access_token, selectedAccountId);
        await uploadOneFile(file, sess.user.id, sess.access_token, supabase, selectedBankAccount?.id ?? "", selectedBankAccount?.accountName);
        uploadedCount += 1;
      }

      setUploadStatus(
        files.length === 1
          ? "Uploaded 1 file."
          : selectedAccountId
            ? `Uploaded ${files.length} files.`
            : `Uploaded ${files.length} files across ${files.length} bank accounts.`,
      );
      await load();
    } catch (e: unknown) {
      if (uploadedCount > 0) {
        setUploadStatus(`Uploaded ${uploadedCount} of ${files.length} files before the batch stopped.`);
        await load();
      }
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
                <BrandLogo className="h-8 sm:h-9" />
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
                <BrandLogo className="h-8 sm:h-9" />
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
              <BrandLogo className="h-8 sm:h-9" />
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
                <h1 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">Upload Bank Statements.</h1>
                <div className="mt-2 min-h-6 text-sm leading-6 text-zinc-600">
                  {multiOrgMode && !orgs.length
                    ? "Create an organisation and entity before uploading."
                    : "Select one or more PDF, image, Excel, or CSV files for the chosen entity."}
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[22rem] sm:flex-row sm:items-center sm:justify-end">
                {multiOrgMode && orgs.length ? (
                  <div className="w-full sm:min-w-44 sm:flex-1">
                    <label htmlFor="invoice-entity" className="sr-only">
                      Entity
                    </label>
                    <SelectControl
                      id="invoice-entity"
                      value={entityId}
                      onChange={(e) => setEntityId(e.target.value)}
                      title="Entity"
                      className="w-full"
                    >
                      {entities
                        .filter((x) => x.org_id === orgId)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </SelectControl>
                  </div>
                ) : null}

                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  accept={statementFileAccept}
                  multiple
                  disabled={uploadUnavailable}
                  aria-label="Choose bank statement files"
                  tabIndex={-1}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) void onUpload(files);
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
                  {uploading ? <Spinner label="Uploading" /> : "Upload Files"}
                </button>
              </div>
            </div>

            {multiOrgMode && entityId ? (
              <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-zinc-950">Bank Account</h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">
                      Pick one account to attach every selected file, or leave blank to create one upload account per file.
                    </p>
                  </div>
                  <div className="flex min-h-6 shrink-0 items-center text-xs font-medium text-zinc-500">
                    {bankAccountsLoading ? <Spinner label="Loading Accounts" /> : `${bankAccounts.length} account${bankAccounts.length === 1 ? "" : "s"}`}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                  <div className="min-w-0">
                    <label htmlFor="statement-bank-account" className="sr-only">
                      Bank account
                    </label>
                    <SelectControl
                      id="statement-bank-account"
                      value={bankAccountId}
                      onChange={(event) => setBankAccountId(event.target.value)}
                      disabled={uploading || bankAccountsLoading || !bankAccounts.length}
                      title="Bank account"
                      className="w-full"
                    >
                      <option value="">{bankAccountsLoading ? "Loading bank accounts" : "Create one account per uploaded file"}</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.accountName}
                          {account.currency ? ` · ${account.currency}` : ""}
                          {account.source === "xero" ? " · Xero" : " · Upload"}
                        </option>
                      ))}
                    </SelectControl>

                    {bankAccounts.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {bankAccounts.slice(0, 6).map((account) => (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => setBankAccountId(account.id)}
                            disabled={uploading}
                            className={`min-h-9 max-w-full rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 ${
                              account.id === bankAccountId
                                ? "border-zinc-950 bg-zinc-950 text-white"
                                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                            }`}
                            aria-pressed={account.id === bankAccountId}
                          >
                            <span className="block max-w-52 truncate sm:max-w-64">{account.accountName}</span>
                            <span className={account.id === bankAccountId ? "text-zinc-300" : "text-zinc-500"}>
                              {account.source === "xero" ? "Xero" : "Upload"}
                              {account.currency ? ` · ${account.currency}` : ""}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <label htmlFor="manual-bank-account" className="sr-only">
                      New bank account name
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="manual-bank-account"
                        type="text"
                        value={manualAccountName}
                        onChange={(event) => setManualAccountName(event.target.value)}
                        disabled={creatingAccount || uploading}
                        placeholder="Add upload account"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={onCreateManualAccount}
                        disabled={!manualAccountName.trim() || creatingAccount || uploading}
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                      >
                        {creatingAccount ? <Spinner label="Adding" /> : "Add"}
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      Clear the selected account when each uploaded file represents a different bank account.
                    </p>
                  </div>
                </div>

                {accountSyncNote ? <div className="mt-3 text-xs leading-5 text-zinc-500">{accountSyncNote}</div> : null}
                {bankAccountError ? (
                  <div className="mt-3">
                    <Notice tone="warning" title="Bank Accounts Unavailable">
                      {bankAccountError}
                    </Notice>
                  </div>
                ) : null}
              </div>
            ) : null}

            {uploadStatus ? <div className="mt-4 text-sm text-zinc-600">{uploadStatus}</div> : null}

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
              <div className="p-5 text-sm leading-6 text-zinc-600">No uploads yet. Add the first bank statement when you are ready.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {invoices.map((inv) => {
                  const files = filesByInvoice[inv.id] || [];
                  return (
                    <div key={inv.id} className="px-5 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-900">{inv.description || "Bank Statement Upload"}</div>
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
