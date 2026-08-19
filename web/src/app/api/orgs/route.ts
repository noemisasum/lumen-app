import { NextResponse } from "next/server";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, getSupabaseUserClient, requireSupabaseUser } from "@/lib/server/supabase";
import { uniqueOrgSlug } from "@/lib/server/orgs";

export const runtime = "nodejs";

type CreateOrgBody = {
  orgName?: string;
  entityName?: string;
  entityCode?: string;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

type OrgMemberRow = {
  org_id: string;
  role: string;
};

type EntityRow = {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  xero_tenant_id: string | null;
  created_at: string;
};

type EntityMemberRow = {
  entity_id: string;
  role: string;
};

type XeroConnectionRow = {
  id: string;
  connected_at: string;
  updated_at: string;
};

type XeroTenantRow = {
  id: string;
  connection_id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_type: string | null;
};

type EntityXeroMappingRow = {
  id: string;
  entity_id: string;
  connection_id: string;
  connection_tenant_id: string;
  xero_tenant_id: string;
  mapped_by: string | null;
  created_at: string;
  updated_at: string;
};

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Organisation management is not configured.", missing }, { status: 500 });
}

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user, accessToken } = await requireSupabaseUser(request);
    const userSupabase = getSupabaseUserClient(accessToken);
    const serviceSupabase = getSupabaseServiceClient();

    const { data: orgMemberships, error: membershipError } = await userSupabase
      .from("org_members")
      .select("org_id,role")
      .eq("user_id", user.id);
    if (membershipError) {
      return NextResponse.json({ error: "Failed to load organisation access." }, { status: 500 });
    }

    const memberships = (orgMemberships ?? []) as OrgMemberRow[];
    const orgIds = memberships.map((membership) => membership.org_id);

    const [orgResult, entityResult, entityMemberResult, connectionResult] = await Promise.all([
      orgIds.length
        ? userSupabase.from("orgs").select("id,name,slug,created_at").in("id", orgIds).order("name")
        : Promise.resolve({ data: [], error: null }),
      orgIds.length
        ? userSupabase.from("entities").select("id,org_id,name,code,xero_tenant_id,created_at").in("org_id", orgIds).order("name")
        : Promise.resolve({ data: [], error: null }),
      userSupabase.from("entity_members").select("entity_id,role").eq("user_id", user.id),
      serviceSupabase
        .from("xero_connections")
        .select("id,connected_at,updated_at")
        .eq("user_id", user.id)
        .is("disconnected_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (orgResult.error) return NextResponse.json({ error: "Failed to load organisations." }, { status: 500 });
    if (entityResult.error) return NextResponse.json({ error: "Failed to load entities." }, { status: 500 });
    if (entityMemberResult.error) return NextResponse.json({ error: "Failed to load entity access." }, { status: 500 });
    if (connectionResult.error) return NextResponse.json({ error: "Failed to load Xero connection." }, { status: 500 });

    const orgRoleById = new Map(memberships.map((membership) => [membership.org_id, membership.role]));
    const entityRoleById = new Map(((entityMemberResult.data ?? []) as EntityMemberRow[]).map((membership) => [membership.entity_id, membership.role]));
    const entities = (entityResult.data ?? []) as EntityRow[];
    const entityIds = entities.map((entity) => entity.id);
    const connection = connectionResult.data as XeroConnectionRow | null;

    const [tenantResult, mappingResult] = await Promise.all([
      connection
        ? serviceSupabase
            .from("xero_connection_tenants")
            .select("id,connection_id,tenant_id,tenant_name,tenant_type")
            .eq("connection_id", connection.id)
            .order("tenant_name")
        : Promise.resolve({ data: [], error: null }),
      entityIds.length
        ? serviceSupabase
            .from("entity_xero_mappings")
            .select("id,entity_id,connection_id,connection_tenant_id,xero_tenant_id,mapped_by,created_at,updated_at")
            .in("entity_id", entityIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (tenantResult.error) return NextResponse.json({ error: "Failed to load Xero tenants." }, { status: 500 });
    if (mappingResult.error) return NextResponse.json({ error: "Failed to load Xero mappings." }, { status: 500 });

    const mappings = (mappingResult.data ?? []) as EntityXeroMappingRow[];
    const mappingByEntityId = new Map(mappings.map((mapping) => [mapping.entity_id, mapping]));

    return NextResponse.json({
      orgs: ((orgResult.data ?? []) as OrgRow[]).map((org) => ({
        ...org,
        role: orgRoleById.get(org.id) ?? "member",
      })),
      entities: entities.map((entity) => ({
        ...entity,
        role: entityRoleById.get(entity.id) ?? null,
        canAdmin: ["owner", "admin"].includes(orgRoleById.get(entity.org_id) ?? "") || entityRoleById.get(entity.id) === "admin",
        xeroMapping: mappingByEntityId.get(entity.id) ?? null,
      })),
      xero: {
        connected: Boolean(connection),
        connection: connection
          ? {
              id: connection.id,
              connectedAt: connection.connected_at,
              updatedAt: connection.updated_at,
            }
          : null,
        tenants: ((tenantResult.data ?? []) as XeroTenantRow[]).map((tenant) => ({
          id: tenant.id,
          connectionId: tenant.connection_id,
          tenantId: tenant.tenant_id,
          name: tenant.tenant_name || tenant.tenant_id,
          tenantType: tenant.tenant_type,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to load organisation management." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as CreateOrgBody;
    const orgName = body.orgName?.trim();
    const entityName = body.entityName?.trim();
    const entityCode = body.entityCode?.trim() || null;

    if (!orgName || orgName.length > 120) {
      return NextResponse.json({ error: "Enter an organisation name under 120 characters." }, { status: 400 });
    }
    if (!entityName || entityName.length > 120) {
      return NextResponse.json({ error: "Enter an entity name under 120 characters." }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const slug = await uniqueOrgSlug(supabase, orgName);

    const { data, error } = await supabase.rpc("create_org_with_default_entity", {
      p_user_id: user.id,
      p_org_name: orgName,
      p_org_slug: slug,
      p_entity_name: entityName,
      p_entity_code: entityCode,
    });

    if (error || !data) {
      return NextResponse.json({ error: "Failed to create organisation and entity." }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to create organisation and entity." }, { status: 500 });
  }
}
