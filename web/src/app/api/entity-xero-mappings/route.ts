import { NextResponse } from "next/server";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";
import { requireEntityAdmin } from "@/lib/server/orgs";

export const runtime = "nodejs";

type MappingBody = {
  entityId?: string;
  connectionTenantId?: string;
};

type TenantRow = {
  id: string;
  connection_id: string;
  tenant_id: string;
};

function mappingConfigError(missing: string[]) {
  return NextResponse.json({ error: "Xero entity mapping is not configured.", missing }, { status: 500 });
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return mappingConfigError(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as MappingBody;
    const entityId = body.entityId?.trim();
    const connectionTenantId = body.connectionTenantId?.trim();

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });
    if (!connectionTenantId) return NextResponse.json({ error: "Choose a Xero tenant." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireEntityAdmin(supabase, entityId, user.id);

    const { data: tenant, error: tenantError } = await supabase
      .from("xero_connection_tenants")
      .select("id,connection_id,tenant_id")
      .eq("id", connectionTenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (tenantError) {
      return NextResponse.json({ error: "Failed to verify Xero tenant access." }, { status: 500 });
    }
    if (!tenant) {
      return NextResponse.json({ error: "Xero tenant not found for this account." }, { status: 404 });
    }

    const tenantRow = tenant as TenantRow;
    const now = new Date().toISOString();
    const { data: mapping, error: mappingError } = await supabase
      .from("entity_xero_mappings")
      .upsert(
        {
          entity_id: entityId,
          connection_id: tenantRow.connection_id,
          connection_tenant_id: tenantRow.id,
          xero_tenant_id: tenantRow.tenant_id,
          mapped_by: user.id,
          updated_at: now,
        },
        { onConflict: "entity_id" },
      )
      .select("id,entity_id,connection_id,connection_tenant_id,xero_tenant_id,mapped_by,created_at,updated_at")
      .single();

    if (mappingError || !mapping) {
      return NextResponse.json({ error: "Failed to map entity to Xero tenant. The tenant may already be mapped." }, { status: 500 });
    }

    const { error: entityUpdateError } = await supabase.from("entities").update({ xero_tenant_id: tenantRow.tenant_id }).eq("id", entityId);
    if (entityUpdateError) {
      return NextResponse.json({ error: "Mapped tenant, but failed to update entity compatibility field." }, { status: 500 });
    }

    return NextResponse.json({ mapping });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to map entity to Xero tenant." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return mappingConfigError(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const requestUrl = new URL(request.url);
    const entityId = requestUrl.searchParams.get("entityId")?.trim();

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireEntityAdmin(supabase, entityId, user.id);

    const { error: deleteError } = await supabase.from("entity_xero_mappings").delete().eq("entity_id", entityId);
    if (deleteError) {
      return NextResponse.json({ error: "Failed to remove Xero mapping." }, { status: 500 });
    }

    const { error: entityUpdateError } = await supabase.from("entities").update({ xero_tenant_id: null }).eq("id", entityId);
    if (entityUpdateError) {
      return NextResponse.json({ error: "Removed mapping, but failed to clear entity compatibility field." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to remove Xero mapping." }, { status: 500 });
  }
}
