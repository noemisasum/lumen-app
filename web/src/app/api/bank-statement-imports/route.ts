import { NextResponse } from "next/server";
import { requireEntityAccess } from "@/lib/server/orgs";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

type CreateImportBody = {
  entityId?: string;
  bankAccountId?: string;
  rawFileId?: string;
};

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Statement imports are not configured.", missing }, { status: 500 });
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as CreateImportBody;
    const entityId = body.entityId?.trim();
    const bankAccountId = body.bankAccountId?.trim();
    const rawFileId = body.rawFileId?.trim();

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });
    if (!bankAccountId) return NextResponse.json({ error: "Choose a bank account." }, { status: 400 });
    if (!rawFileId) return NextResponse.json({ error: "Missing uploaded file reference." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireEntityAccess(supabase, entityId, user.id);

    const { data: account, error: accountError } = await supabase
      .from("entity_bank_accounts")
      .select("id")
      .eq("id", bankAccountId)
      .eq("entity_id", entityId)
      .neq("status", "archived")
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return NextResponse.json({ error: "Bank account does not belong to the selected entity." }, { status: 400 });

    const { data: file, error: fileError } = await supabase
      .from("invoice_files")
      .select("id")
      .eq("id", rawFileId)
      .eq("entity_id", entityId)
      .eq("created_by", user.id)
      .maybeSingle();
    if (fileError) throw fileError;
    if (!file) return NextResponse.json({ error: "Uploaded file does not belong to the selected entity." }, { status: 400 });

    const { error: createError } = await supabase.from("bank_statement_imports").insert({
      entity_id: entityId,
      bank_account_id: bankAccountId,
      created_by: user.id,
      source: "manual",
      status: "queued",
      raw_file_id: rawFileId,
    });
    if (createError) throw createError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to create statement import." }, { status: 500 });
  }
}
