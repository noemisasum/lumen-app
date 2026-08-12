import { NextResponse } from "next/server";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

type OrgRow = {
  id: string;
};

type EntityRow = {
  id: string;
};

type MembershipRow = {
  role: string;
};

function recoveryAdminEmails() {
  return (process.env.LUMEN_ADMIN_RECOVERY_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) {
    return NextResponse.json({ error: "Account recovery is not configured.", missing }, { status: 500 });
  }

  try {
    const { user } = await requireSupabaseUser(request);
    const supabase = getSupabaseServiceClient();
    const nowEmail = user.email?.toLowerCase() ?? "";
    const allowedByEnv = recoveryAdminEmails().includes(nowEmail);

    const { data: org, error: orgError } = await supabase
      .from("orgs")
      .upsert({ slug: "lumen", name: "Lumen" }, { onConflict: "slug" })
      .select("id")
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: "Failed to prepare default organisation." }, { status: 500 });
    }

    const orgRow = org as OrgRow;

    const { data: existingMembership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgRow.id)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: existingOwner } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgRow.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    const currentRole = (existingMembership as MembershipRow | null)?.role ?? null;
    const canRecoverAdmin = allowedByEnv || !existingOwner || currentRole === "owner" || currentRole === "admin";

    if (!canRecoverAdmin) {
      return NextResponse.json(
        {
          error: "Admin recovery is restricted. Ask an existing owner to invite or promote this account.",
        },
        { status: 403 },
      );
    }

    const orgRole = currentRole === "owner" || !existingOwner || allowedByEnv ? "owner" : "admin";
    const { error: membershipError } = await supabase
      .from("org_members")
      .upsert({ org_id: orgRow.id, user_id: user.id, role: orgRole }, { onConflict: "org_id,user_id" });

    if (membershipError) {
      return NextResponse.json({ error: "Failed to recover organisation access." }, { status: 500 });
    }

    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .upsert({ org_id: orgRow.id, name: "Default Entity", code: "default" }, { onConflict: "org_id,name" })
      .select("id")
      .single();

    if (entityError || !entity) {
      return NextResponse.json({ error: "Failed to prepare default entity." }, { status: 500 });
    }

    const entityRow = entity as EntityRow;
    const { error: entityMembershipError } = await supabase
      .from("entity_members")
      .upsert({ entity_id: entityRow.id, user_id: user.id, role: "admin" }, { onConflict: "entity_id,user_id" });

    if (entityMembershipError) {
      return NextResponse.json({ error: "Failed to recover entity access." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      orgRole,
      entityRole: "admin",
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to recover account access." }, { status: 500 });
  }
}
