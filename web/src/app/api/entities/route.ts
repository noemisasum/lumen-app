import { NextResponse } from "next/server";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";
import { requireOrgAdmin } from "@/lib/server/orgs";

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
