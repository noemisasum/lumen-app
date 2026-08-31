import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireOrgOwner, type EntityRole, type OrgRole } from "@/lib/server/orgs";

export type AddOrgUserResult = {
  status: "active" | "pending";
  email: string;
  orgRole: OrgRole;
  entityRole: EntityRole;
  userId: string | null;
  entityCount: number;
};

type EntityIdRow = {
  id: string;
};

type PendingInviteRow = {
  id: string;
  org_id: string;
  email: string;
  org_role: OrgRole;
  entity_role: EntityRole;
  accepted_at: string | null;
};

type SupabaseEmailVerification = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

export function normalizeMemberEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hasVerifiedUserEmail(user: User) {
  const verification = user as SupabaseEmailVerification;
  return Boolean(verification.email_confirmed_at || verification.confirmed_at);
}

export function isOrgAssignableRole(role: string): role is Exclude<OrgRole, "owner"> {
  return role === "admin" || role === "member";
}

export function isEntityAssignableRole(role: string): role is EntityRole {
  return role === "admin" || role === "ap" || role === "approver" || role === "requester";
}

export async function findAuthUserByEmail(supabase: SupabaseClient, email: string) {
  const targetEmail = normalizeMemberEmail(email);

  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const users = data.users ?? [];
    const match = users.find((user) => normalizeMemberEmail(user.email ?? "") === targetEmail);
    if (match) return match;
    if (users.length < 1000) return null;
  }

  return null;
}

export async function grantOrgEntityAccess(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  orgRole: Exclude<OrgRole, "owner">,
  entityRole: EntityRole,
) {
  const [entityResult, membershipResult] = await Promise.all([
    supabase.from("entities").select("id").eq("org_id", orgId),
    supabase.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle(),
  ]);

  if (entityResult.error) throw entityResult.error;
  if (membershipResult.error) throw membershipResult.error;

  const existingOrgRole = (membershipResult.data as { role: OrgRole } | null)?.role ?? null;
  const shouldUpdateOrgRole = existingOrgRole !== "owner";
  const entities = entityResult.data;

  const entityRows = (entities ?? []) as EntityIdRow[];
  if (shouldUpdateOrgRole) {
    const { error: orgMemberError } = await supabase.from("org_members").upsert({ org_id: orgId, user_id: userId, role: orgRole }, { onConflict: "org_id,user_id" });
    if (orgMemberError) throw orgMemberError;
  }

  if (entityRows.length) {
    const { error: entityMemberError } = await supabase.from("entity_members").upsert(
      entityRows.map((entity) => ({
        entity_id: entity.id,
        user_id: userId,
        role: entityRole,
      })),
      { onConflict: "entity_id,user_id" },
    );
    if (entityMemberError) throw entityMemberError;
  }

  return entityRows.length;
}

export async function addOrgUserByEmail(
  supabase: SupabaseClient,
  orgId: string,
  actorUserId: string,
  email: string,
  orgRole: Exclude<OrgRole, "owner">,
  entityRole: EntityRole,
): Promise<AddOrgUserResult> {
  await requireOrgOwner(supabase, orgId, actorUserId);

  const normalizedEmail = normalizeMemberEmail(email);
  const authUser = await findAuthUserByEmail(supabase, normalizedEmail);

  if (authUser && hasVerifiedUserEmail(authUser)) {
    const entityCount = await grantOrgEntityAccess(supabase, orgId, authUser.id, orgRole, entityRole);
    const { error: inviteError } = await supabase.from("org_user_invites").upsert(
      {
        org_id: orgId,
        email: normalizedEmail,
        org_role: orgRole,
        entity_role: entityRole,
        invited_by: actorUserId,
        invited_user_id: authUser.id,
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "org_id,email" },
    );
    if (inviteError) throw inviteError;

    return { status: "active", email: normalizedEmail, orgRole, entityRole, userId: authUser.id, entityCount };
  }

  const pendingInvitedUserId = authUser?.id ?? null;
  const { error: pendingError } = await supabase.from("org_user_invites").upsert(
    {
      org_id: orgId,
      email: normalizedEmail,
      org_role: orgRole,
      entity_role: entityRole,
      invited_by: actorUserId,
      invited_user_id: pendingInvitedUserId,
      accepted_at: null,
    },
    { onConflict: "org_id,email" },
  );
  if (pendingError) throw pendingError;

  const { count, error: entityCountError } = await supabase.from("entities").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  if (entityCountError) throw entityCountError;

  return { status: "pending", email: normalizedEmail, orgRole, entityRole, userId: pendingInvitedUserId, entityCount: count ?? 0 };
}

export async function acceptPendingOrgInvites(supabase: SupabaseClient, user: User) {
  const email = normalizeMemberEmail(user.email ?? "");
  if (!email) return 0;
  if (!hasVerifiedUserEmail(user)) return 0;

  const { data: invites, error: inviteError } = await supabase
    .from("org_user_invites")
    .select("id,org_id,email,org_role,entity_role,accepted_at")
    .eq("email", email)
    .is("accepted_at", null);
  if (inviteError) throw inviteError;

  const pendingInvites = (invites ?? []) as PendingInviteRow[];
  if (!pendingInvites.length) return 0;

  let acceptedCount = 0;
  for (const invite of pendingInvites) {
    if (!isOrgAssignableRole(invite.org_role) || !isEntityAssignableRole(invite.entity_role)) continue;
    await grantOrgEntityAccess(supabase, invite.org_id, user.id, invite.org_role, invite.entity_role);
    const { error: acceptError } = await supabase
      .from("org_user_invites")
      .update({ invited_user_id: user.id, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (acceptError) throw acceptError;
    acceptedCount += 1;
  }

  return acceptedCount;
}
