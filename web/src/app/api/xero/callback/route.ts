import { NextResponse } from "next/server";
import { encryptJson } from "@/lib/server/crypto";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient } from "@/lib/server/supabase";
import {
  createXeroClient,
  getMissingXeroEnv,
  hashOauthState,
  serializeTokenSet,
  tokenExpiresAt,
  tokenScopes,
  type XeroTenant,
} from "@/lib/server/xero";

export const runtime = "nodejs";

type StateRow = {
  id: string;
  user_id: string;
  expires_at: string;
  consumed_at: string | null;
};

function dashboardRedirect(request: Request, status: string) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("xero", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const missing = [...getMissingSupabaseServerEnv(), ...getMissingXeroEnv(true)];
  if (missing.length) return dashboardRedirect(request, "configuration_error");

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");

  if (oauthError) return dashboardRedirect(request, "denied");
  if (!code || !state) return dashboardRedirect(request, "invalid_callback");

  const supabase = getSupabaseServiceClient();
  const stateHash = hashOauthState(state);

  const { data: stateRow, error: stateError } = await supabase
    .from("xero_oauth_states")
    .select("id,user_id,expires_at,consumed_at")
    .eq("state_hash", stateHash)
    .maybeSingle();

  if (stateError || !stateRow) return dashboardRedirect(request, "invalid_state");

  const oauthState = stateRow as StateRow;
  if (oauthState.consumed_at) return dashboardRedirect(request, "invalid_state");
  if (new Date(oauthState.expires_at).getTime() < Date.now()) return dashboardRedirect(request, "expired_state");

  try {
    const xero = createXeroClient(state);
    const tokenSet = await xero.apiCallback(request.url);
    const tenants = (await xero.updateTenants(false)) as XeroTenant[];
    const claims = tokenSet.claims();
    const encryptedTokenSet = encryptJson(serializeTokenSet(tokenSet));
    const now = new Date().toISOString();

    const { data: connection, error: connectionError } = await supabase
      .from("xero_connections")
      .upsert(
        {
          user_id: oauthState.user_id,
          xero_user_id: typeof claims.xero_userid === "string" ? claims.xero_userid : null,
          xero_email: typeof claims.email === "string" ? claims.email : null,
          token_ciphertext: encryptedTokenSet,
          scopes: tokenScopes(tokenSet),
          expires_at: tokenExpiresAt(tokenSet),
          connected_at: now,
          updated_at: now,
          disconnected_at: null,
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();

    if (connectionError || !connection) throw connectionError ?? new Error("Missing Xero connection row.");

    const tenantRows = tenants
      .map((tenant) => ({
        connection_id: connection.id,
        user_id: oauthState.user_id,
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName ?? null,
        tenant_type: tenant.tenantType ?? null,
        xero_connection_id: tenant.id ?? tenant.connectionId ?? null,
        raw_metadata: tenant,
        updated_at: now,
      }))
      .filter((tenant) => tenant.tenant_id);

    if (tenantRows.length) {
      const { error: tenantError } = await supabase
        .from("xero_connection_tenants")
        .upsert(tenantRows, { onConflict: "connection_id,tenant_id" });
      if (tenantError) throw tenantError;
    }

    await supabase.from("xero_oauth_states").update({ consumed_at: now }).eq("id", oauthState.id);

    return dashboardRedirect(request, "connected");
  } catch {
    return dashboardRedirect(request, "connect_failed");
  }
}
