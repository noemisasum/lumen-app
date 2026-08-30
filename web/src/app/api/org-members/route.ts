import { NextResponse } from "next/server";
import { addOrgUserByEmail, isEntityAssignableRole, isOrgAssignableRole } from "@/lib/server/org-members";
import { requireOrgOwner } from "@/lib/server/orgs";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

type AddOrgMemberBody = {
  orgId?: string;
  email?: string;
  orgRole?: string;
  entityRole?: string;
};

type OrgMemberRow = {
  user_id: string;
  role: string;
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  org_role: string;
  entity_role: string;
  invited_user_id: string | null;
  accepted_at: string | null;
  created_at: string;
};

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Organisation members are not configured.", missing }, { status: 500 });
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function loadUserEmails(supabase: ReturnType<typeof getSupabaseServiceClient>, userIds: string[]) {
  const ids = new Set(userIds);
  const emailByUserId = new Map<string, string | null>();

  for (let page = 1; ids.size && page <= 25; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const users = data.users ?? [];
    users.forEach((user) => {
      if (ids.has(user.id)) {
        emailByUserId.set(user.id, user.email ?? null);
        ids.delete(user.id);
      }
    });
    if (users.length < 1000) break;
  }

  return emailByUserId;
}

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const requestUrl = new URL(request.url);
    const orgId = requestUrl.searchParams.get("orgId")?.trim();
    if (!orgId) return NextResponse.json({ error: "Choose an organisation." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireOrgOwner(supabase, orgId, user.id);

    const [memberResult, inviteResult] = await Promise.all([
      supabase.from("org_members").select("user_id,role,created_at").eq("org_id", orgId).order("created_at"),
      supabase.from("org_user_invites").select("id,email,org_role,entity_role,invited_user_id,accepted_at,created_at").eq("org_id", orgId).order("created_at", { ascending: false }),
    ]);

    if (memberResult.error) return NextResponse.json({ error: "Failed to load organisation members." }, { status: 500 });
    if (inviteResult.error) return NextResponse.json({ error: "Failed to load pending invites." }, { status: 500 });

    const members = (memberResult.data ?? []) as OrgMemberRow[];
    const emailByUserId = await loadUserEmails(
      supabase,
      members.map((member) => member.user_id),
    );

    return NextResponse.json({
      members: members.map((member) => ({
        userId: member.user_id,
        email: emailByUserId.get(member.user_id) ?? null,
        role: member.role,
        createdAt: member.created_at,
      })),
      invites: ((inviteResult.data ?? []) as InviteRow[]).map((invite) => ({
        id: invite.id,
        email: invite.email,
        orgRole: invite.org_role,
        entityRole: invite.entity_role,
        invitedUserId: invite.invited_user_id,
        acceptedAt: invite.accepted_at,
        createdAt: invite.created_at,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to load organisation members." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as AddOrgMemberBody;
    const orgId = body.orgId?.trim();
    const email = body.email?.trim().toLowerCase() ?? "";
    const orgRole = body.orgRole?.trim() || "member";
    const entityRole = body.entityRole?.trim() || "admin";

    if (!orgId) return NextResponse.json({ error: "Choose an organisation." }, { status: 400 });
    if (!validateEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    if (!isOrgAssignableRole(orgRole)) return NextResponse.json({ error: "Choose member or admin org access." }, { status: 400 });
    if (!isEntityAssignableRole(entityRole)) return NextResponse.json({ error: "Choose a valid entity access role." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    const result = await addOrgUserByEmail(supabase, orgId, user.id, email, orgRole, entityRole);

    return NextResponse.json({
      ...result,
      message:
        result.status === "active"
          ? "User access is active now."
          : result.userId
            ? "Invite saved. Ask this person to verify their email and sign in; Lumen will apply the access after verification."
          : "Invite saved. Ask this person to sign up or use password recovery with this email; Lumen will apply the access when they sign in.",
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to add organisation user." }, { status: 500 });
  }
}
