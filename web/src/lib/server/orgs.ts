import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgRole = "owner" | "admin" | "member";
export type EntityRole = "admin" | "ap" | "approver" | "requester";

type OrgMemberRoleRow = {
  role: OrgRole;
};

type EntityWithOrgRow = {
  org_id: string;
};

type EntityMemberRoleRow = {
  role: EntityRole;
};

type EntityAccessRole = OrgRole | EntityRole;

export function slugifyOrgName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return base || "org";
}

export async function uniqueOrgSlug(supabase: SupabaseClient, name: string) {
  const base = slugifyOrgName(name);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await supabase.from("orgs").select("id").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return slug;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function getOrgRole(supabase: SupabaseClient, orgId: string, userId: string) {
  const { data, error } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as OrgMemberRoleRow | null)?.role ?? null;
}

export async function requireOrgAdmin(supabase: SupabaseClient, orgId: string, userId: string) {
  const role = await getOrgRole(supabase, orgId, userId);
  if (role !== "owner" && role !== "admin") {
    throw new Response(JSON.stringify({ error: "You need org owner or admin access for this action." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  return role;
}

export async function requireOrgOwner(supabase: SupabaseClient, orgId: string, userId: string) {
  const role = await getOrgRole(supabase, orgId, userId);
  if (role !== "owner") {
    throw new Response(JSON.stringify({ error: "You need org owner access for this action." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  return role;
}

export async function requireEntityAdmin(supabase: SupabaseClient, entityId: string, userId: string) {
  const { data: entity, error: entityError } = await supabase.from("entities").select("org_id").eq("id", entityId).maybeSingle();
  if (entityError) throw entityError;
  if (!entity) {
    throw new Response(JSON.stringify({ error: "Entity not found." }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const entityRow = entity as EntityWithOrgRow;
  const orgRole = await getOrgRole(supabase, entityRow.org_id, userId);
  if (orgRole === "owner" || orgRole === "admin") return { orgId: entityRow.org_id, role: orgRole };

  const { data: membership, error: membershipError } = await supabase
    .from("entity_members")
    .select("role")
    .eq("entity_id", entityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  const entityRole = (membership as EntityMemberRoleRow | null)?.role ?? null;
  if (entityRole !== "admin") {
    throw new Response(JSON.stringify({ error: "You need entity admin access for this action." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  return { orgId: entityRow.org_id, role: entityRole };
}

export async function requireEntityAccess(supabase: SupabaseClient, entityId: string, userId: string) {
  const { data: entity, error: entityError } = await supabase.from("entities").select("org_id").eq("id", entityId).maybeSingle();
  if (entityError) throw entityError;
  if (!entity) {
    throw new Response(JSON.stringify({ error: "Entity not found." }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const entityRow = entity as EntityWithOrgRow;
  const orgRole = await getOrgRole(supabase, entityRow.org_id, userId);
  if (orgRole) return { orgId: entityRow.org_id, role: orgRole as EntityAccessRole };

  const { data: membership, error: membershipError } = await supabase
    .from("entity_members")
    .select("role")
    .eq("entity_id", entityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  const entityRole = (membership as EntityMemberRoleRow | null)?.role ?? null;
  if (!entityRole) {
    throw new Response(JSON.stringify({ error: "You need access to this entity." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  return { orgId: entityRow.org_id, role: entityRole as EntityAccessRole };
}
