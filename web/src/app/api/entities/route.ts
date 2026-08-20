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

type UpdateEntityBody = {
  entityId?: string;
  name?: string;
  code?: string | null;
};

function validateEntityDetails(nameValue: unknown, codeValue: unknown) {
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  const code = typeof codeValue === "string" ? codeValue.trim() || null : null;

  if (!name || name.length > 120) {
    return { error: "Enter an entity name under 120 characters." };
  }

  if (code && code.length > 40) {
    return { error: "Enter an entity code under 40 characters." };
  }

  return { name, code };
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) {
    return NextResponse.json({ error: "Entity management is not configured.", missing }, { status: 500 });
  }

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as CreateEntityBody;
    const orgId = body.orgId?.trim();
    const details = validateEntityDetails(body.name, body.code);

    if (!orgId) return NextResponse.json({ error: "Choose an organisation." }, { status: 400 });
    if ("error" in details) {
      return NextResponse.json({ error: details.error }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    await requireOrgAdmin(supabase, orgId, user.id);

    const { data: entity, error: entityError } = await supabase.rpc("create_entity_with_membership", {
      p_org_id: orgId,
      p_user_id: user.id,
      p_name: details.name,
      p_code: details.code,
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

export async function PATCH(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) {
    return NextResponse.json({ error: "Entity management is not configured.", missing }, { status: 500 });
  }

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as UpdateEntityBody;
    const entityId = body.entityId?.trim();
    const details = validateEntityDetails(body.name, body.code);

    if (!entityId) return NextResponse.json({ error: "Choose an entity." }, { status: 400 });
    if ("error" in details) {
      return NextResponse.json({ error: details.error }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    await requireEntityAdmin(supabase, entityId, user.id);

    const { data: entity, error: updateError } = await supabase
      .from("entities")
      .update({ name: details.name, code: details.code })
      .eq("id", entityId)
      .select("id,org_id,name,code")
      .single();

    if (updateError || !entity) {
      return NextResponse.json({ error: "Failed to update entity. Check that the name is unique in this organisation." }, { status: 500 });
    }

    return NextResponse.json({ entity });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to update entity." }, { status: 500 });
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
