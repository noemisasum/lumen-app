import { NextResponse } from "next/server";
import { removeInvoiceStorageObjects } from "@/lib/server/invoice-storage";
import { requireEntityAccess } from "@/lib/server/orgs";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

type FinalizeUploadBody = {
  entityId?: string;
  bankAccountId?: string;
  bucket?: string;
  objectKey?: string;
  mimeType?: string | null;
  sizeBytes?: number;
  description?: string;
};

type StorageFileRow = {
  name: string;
};

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Statement upload finalization is not configured.", missing }, { status: 500 });
}

function parseObjectKey(objectKey: string) {
  const normalized = objectKey.replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  const name = parts.at(-1) ?? "";
  const parent = parts.slice(0, -1).join("/");
  return { normalized, parent, name };
}

function cleanupUpload(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  bucket: string,
  objectKey: string,
  invoiceId?: string,
) {
  return Promise.allSettled([
    invoiceId ? supabase.from("invoices").delete().eq("id", invoiceId) : Promise.resolve(),
    removeInvoiceStorageObjects(supabase, [{ provider: "supabase", bucket, object_key: objectKey }]),
  ]);
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  const supabase = getSupabaseServiceClient();
  let cleanupBucket = "";
  let cleanupObjectKey = "";
  let cleanupInvoiceId = "";

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as FinalizeUploadBody;
    const entityId = body.entityId?.trim();
    const bankAccountId = body.bankAccountId?.trim();
    const bucket = body.bucket?.trim();
    const objectKey = body.objectKey?.trim();
    const mimeType = body.mimeType?.trim() || null;
    const sizeBytes = Number.isFinite(body.sizeBytes) ? Math.max(0, Math.trunc(body.sizeBytes as number)) : 0;
    const description = body.description?.trim().replace(/\s+/g, " ").slice(0, 160) || "Bank Statement Upload";

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });
    if (!bankAccountId) return NextResponse.json({ error: "Choose a bank account." }, { status: 400 });
    if (bucket !== "invoices") return NextResponse.json({ error: "Uploaded file is in an unsupported storage bucket." }, { status: 400 });
    if (!objectKey) return NextResponse.json({ error: "Missing uploaded file reference." }, { status: 400 });

    const { normalized, parent, name } = parseObjectKey(objectKey);
    cleanupBucket = bucket;
    cleanupObjectKey = normalized;

    if (!name || !normalized.startsWith(`${user.id}/statement-intake/`)) {
      await cleanupUpload(supabase, bucket, normalized);
      return NextResponse.json({ error: "Uploaded file is outside the expected statement intake folder." }, { status: 400 });
    }

    const entityAccess = await requireEntityAccess(supabase, entityId, user.id);

    const { data: account, error: accountError } = await supabase
      .from("entity_bank_accounts")
      .select("id")
      .eq("id", bankAccountId)
      .eq("entity_id", entityId)
      .neq("status", "archived")
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) {
      await cleanupUpload(supabase, bucket, normalized);
      return NextResponse.json({ error: "Bank account does not belong to the selected entity." }, { status: 400 });
    }

    const { data: storageObjects, error: storageError } = await supabase.storage.from(bucket).list(parent, {
      limit: 100,
      search: name,
    });
    if (storageError) throw storageError;
    if (!((storageObjects ?? []) as StorageFileRow[]).some((file) => file.name === name)) {
      return NextResponse.json({ error: "Uploaded file was not found in storage." }, { status: 400 });
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        org_id: entityAccess.orgId,
        entity_id: entityId,
        created_by: user.id,
        status: "UPLOADED",
        currency: "USD",
        description,
      })
      .select("id")
      .single();
    if (invoiceError || !invoice) throw invoiceError ?? new Error("Missing invoice row.");
    cleanupInvoiceId = invoice.id as string;

    const { data: invoiceFile, error: fileError } = await supabase
      .from("invoice_files")
      .insert({
        invoice_id: cleanupInvoiceId,
        org_id: entityAccess.orgId,
        entity_id: entityId,
        created_by: user.id,
        provider: "supabase",
        bucket,
        object_key: normalized,
        mime_type: mimeType,
        size_bytes: sizeBytes,
      })
      .select("id")
      .single();
    if (fileError || !invoiceFile) throw fileError ?? new Error("Missing invoice file row.");

    const { data: statementImport, error: importError } = await supabase
      .from("bank_statement_imports")
      .insert({
        entity_id: entityId,
        bank_account_id: bankAccountId,
        created_by: user.id,
        source: "manual",
        status: "pending_parse",
        raw_file_id: invoiceFile.id,
      })
      .select("id")
      .single();
    if (importError || !statementImport) throw importError ?? new Error("Missing statement import row.");

    cleanupInvoiceId = "";
    cleanupBucket = "";
    cleanupObjectKey = "";

    return NextResponse.json({ ok: true, invoiceId: invoice.id, rawFileId: invoiceFile.id, statementImportId: statementImport.id });
  } catch (error) {
    if (cleanupBucket && cleanupObjectKey) {
      await cleanupUpload(supabase, cleanupBucket, cleanupObjectKey, cleanupInvoiceId);
    }
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to finalize statement upload. The uploaded file was not linked and has been rolled back." }, { status: 500 });
  }
}
