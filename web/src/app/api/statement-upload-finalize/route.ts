import { NextResponse } from "next/server";
import { removeInvoiceStorageObjects } from "@/lib/server/invoice-storage";
import { requireEntityAccess } from "@/lib/server/orgs";
import { parseManualStatementImport } from "@/lib/server/statement-import-parser";
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

type InvoiceFileRow = {
  id: string;
  invoice_id: string;
  org_id: string;
  entity_id: string;
  created_by: string;
};

type StatementImportRow = {
  id: string;
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

function cleanupInvoice(supabase: ReturnType<typeof getSupabaseServiceClient>, invoiceId: string) {
  return supabase.from("invoices").delete().eq("id", invoiceId);
}

async function loadInvoiceFileByObject(supabase: ReturnType<typeof getSupabaseServiceClient>, bucket: string, objectKey: string) {
  const { data, error } = await supabase
    .from("invoice_files")
    .select("id,invoice_id,org_id,entity_id,created_by")
    .eq("provider", "supabase")
    .eq("bucket", bucket)
    .eq("object_key", objectKey)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as InvoiceFileRow | null) ?? null;
}

async function loadStatementImport(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  rawFileId: string,
  bankAccountId: string,
  entityId: string,
) {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("id")
    .eq("raw_file_id", rawFileId)
    .eq("bank_account_id", bankAccountId)
    .eq("entity_id", entityId)
    .eq("source", "manual")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as StatementImportRow | null) ?? null;
}

async function createOrLoadStatementImport(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  input: { entityId: string; bankAccountId: string; userId: string; rawFileId: string },
) {
  const existing = await loadStatementImport(supabase, input.rawFileId, input.bankAccountId, input.entityId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("bank_statement_imports")
    .insert({
      entity_id: input.entityId,
      bank_account_id: input.bankAccountId,
      created_by: input.userId,
      source: "manual",
      status: "pending_parse",
      raw_file_id: input.rawFileId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const concurrent = await loadStatementImport(supabase, input.rawFileId, input.bankAccountId, input.entityId);
      if (concurrent) return concurrent;
    }
    throw error;
  }
  if (!data) throw new Error("Missing statement import row.");
  return data as StatementImportRow;
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

    const existingFile = await loadInvoiceFileByObject(supabase, bucket, normalized);
    if (existingFile) {
      if (existingFile.org_id !== entityAccess.orgId || existingFile.entity_id !== entityId || existingFile.created_by !== user.id) {
        return NextResponse.json({ error: "Uploaded file is already linked to a different entity." }, { status: 409 });
      }

      const statementImport = await createOrLoadStatementImport(supabase, {
        entityId,
        bankAccountId,
        userId: user.id,
        rawFileId: existingFile.id,
      });

      cleanupBucket = "";
      cleanupObjectKey = "";

      const parseResult = await parseManualStatementImport(supabase, {
        statementImportId: statementImport.id,
        entityId,
        bankAccountId,
        rawFileId: existingFile.id,
        bucket,
        objectKey: normalized,
        mimeType,
        sizeBytes,
      });

      return NextResponse.json({
        ok: true,
        invoiceId: existingFile.invoice_id,
        rawFileId: existingFile.id,
        statementImportId: statementImport.id,
        parse: parseResult,
      });
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
    if (fileError) {
      if (fileError.code === "23505") {
        const duplicateInvoiceId = cleanupInvoiceId;
        cleanupInvoiceId = "";
        cleanupBucket = "";
        cleanupObjectKey = "";
        await cleanupInvoice(supabase, duplicateInvoiceId);
        const concurrentFile = await loadInvoiceFileByObject(supabase, bucket, normalized);
        if (!concurrentFile || concurrentFile.org_id !== entityAccess.orgId || concurrentFile.entity_id !== entityId || concurrentFile.created_by !== user.id) {
          return NextResponse.json({ error: "Uploaded file is already linked to a different entity." }, { status: 409 });
        }
        const statementImport = await createOrLoadStatementImport(supabase, {
          entityId,
          bankAccountId,
          userId: user.id,
          rawFileId: concurrentFile.id,
        });

        const parseResult = await parseManualStatementImport(supabase, {
          statementImportId: statementImport.id,
          entityId,
          bankAccountId,
          rawFileId: concurrentFile.id,
          bucket,
          objectKey: normalized,
          mimeType,
          sizeBytes,
        });

        return NextResponse.json({
          ok: true,
          invoiceId: concurrentFile.invoice_id,
          rawFileId: concurrentFile.id,
          statementImportId: statementImport.id,
          parse: parseResult,
        });
      }
      throw fileError;
    }
    if (!invoiceFile) throw new Error("Missing invoice file row.");

    const statementImport = await createOrLoadStatementImport(supabase, {
      entityId,
      bankAccountId,
      userId: user.id,
      rawFileId: invoiceFile.id,
    });

    cleanupInvoiceId = "";
    cleanupBucket = "";
    cleanupObjectKey = "";

    const parseResult = await parseManualStatementImport(supabase, {
      statementImportId: statementImport.id,
      entityId,
      bankAccountId,
      rawFileId: invoiceFile.id as string,
      bucket,
      objectKey: normalized,
      mimeType,
      sizeBytes,
    });

    return NextResponse.json({
      ok: true,
      invoiceId: invoice.id,
      rawFileId: invoiceFile.id,
      statementImportId: statementImport.id,
      parse: parseResult,
    });
  } catch (error) {
    if (cleanupBucket && cleanupObjectKey) {
      await cleanupUpload(supabase, cleanupBucket, cleanupObjectKey, cleanupInvoiceId);
    }
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to finalize statement upload. The uploaded file was not linked and has been rolled back." }, { status: 500 });
  }
}
