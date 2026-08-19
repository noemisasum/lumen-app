import { NextResponse } from "next/server";
import { removeInvoiceStorageObjects } from "@/lib/server/invoice-storage";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";
import { requireEntityAdmin, requireOrgAdmin, requireOrgOwner } from "@/lib/server/orgs";

export const runtime = "nodejs";

type CreateEntityBody = {
  orgId?: string;
  name?: string;
  code?: string;
};

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) {
    return NextResponse.json({ error: "Entity management is not configured.", missing }, { status: 500 });
  }

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as CreateEntityBody;
    const orgId = body.orgId?.trim();
    const name = body.name?.trim();
    const code = body.code?.trim() || null;

    if (!orgId) return NextResponse.json({ error: "Choose an organisation." }, { status: 400 });
    if (!name || name.length > 120) {
      return NextResponse.json({ error: "Enter an entity name under 120 characters." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    await requireOrgAdmin(supabase, orgId, user.id);

    const { data: entity, error: entityError } = await supabase.rpc("create_entity_with_membership", {
      p_org_id: orgId,
      p_user_id: user.id,
      p_name: name,
      p_code: code,
    });

    if (entityError || !entity) {
      return NextResponse.json({ error: "Failed to create entity. Check that the name is unique in this organisation." }, { status: 500 });
    }

    return NextResponse.json({ entity });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to create entity." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) {
    return NextResponse.json({ error: "Entity management is not configured.", missing }, { status: 500 });
  }

  try {
    const { user } = await requireSupabaseUser(request);
    const requestUrl = new URL(request.url);
    const entityId = requestUrl.searchParams.get("entityId")?.trim();

    if (!entityId) return NextResponse.json({ error: "Choose an entity." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    const { orgId } = await requireEntityAdmin(supabase, entityId, user.id);
    await requireOrgOwner(supabase, orgId, user.id);

    const { data: files, error: filesError } = await supabase
      .from("invoice_files")
      .select("provider,bucket,object_key")
      .eq("entity_id", entityId);
    if (filesError) {
      return NextResponse.json({ error: "Failed to inspect entity files before deletion." }, { status: 500 });
    }

    await removeInvoiceStorageObjects(supabase, files ?? []);

    const { error: deleteError } = await supabase.from("entities").delete().eq("id", entityId);
    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete entity." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to delete entity." }, { status: 500 });
  }
}
