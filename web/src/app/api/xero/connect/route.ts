import { NextResponse } from "next/server";
import { createOauthState, createXeroClient, getMissingXeroEnv, hashOauthState } from "@/lib/server/xero";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Xero connection is not configured.", missing }, { status: 500 });
}

export async function POST(request: Request) {
  const missing = [...getMissingSupabaseServerEnv(), ...getMissingXeroEnv()];
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const state = createOauthState();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const supabase = getSupabaseServiceClient();

    const { error } = await supabase.from("xero_oauth_states").insert({
      state_hash: hashOauthState(state),
      user_id: user.id,
      expires_at: expiresAt,
      redirect_after: "/dashboard",
    });

    if (error) {
      return NextResponse.json({ error: "Failed to create Xero OAuth state." }, { status: 500 });
    }

    const authorizationUrl = await createXeroClient(state).buildConsentUrl();
    return NextResponse.json({ authorizationUrl, expiresAt });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to start Xero connection." }, { status: 500 });
  }
}
