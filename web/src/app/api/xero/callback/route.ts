import { NextResponse } from "next/server";
import { encryptJson } from "@/lib/server/crypto";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient } from "@/lib/server/supabase";
import {
  createXeroClient,
  getXeroEnvIssueNames,
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
};

function dashboardRedirect(request: Request, status: string) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("xero", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const missing = [...getMissingSupabaseServerEnv(), ...getXeroEnvIssueNames()];
  if (missing.length) return dashboardRedirect(request, "configuration_error");

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const oauthError = requestUrl.searchParams.get("error");

  if (oauthError) return dashboardRedirect(request, "denied");
  if (!code || !state) return dashboardRedirect(request, "invalid_callback");

  const supabase = getSupabaseServiceClient();
  const stateHash = hashOauthState(state);
  const now = new Date().toISOString();

  // Supabase REST cannot wrap the OAuth callback in a broader transaction, so
  // consume the state in the same conditional update that verifies it is unused
  // and unexpired. A replay cannot reach token storage without winning this update.
  const { data: consumedState, error: consumeError } = await supabase
    .from("xero_oauth_states")
    .update({ consumed_at: now })
    .eq("state_hash", stateHash)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("id,user_id,expires_at")
    .maybeSingle();

  if (consumeError) return dashboardRedirect(request, "invalid_state");

  if (!consumedState) {
    const { data: existingState } = await supabase
      .from("xero_oauth_states")
      .select("expires_at")
      .eq("state_hash", stateHash)
      .maybeSingle();

    if (existingState && new Date((existingState as Pick<StateRow, "expires_at">).expires_at).getTime() < Date.now()) {
      return dashboardRedirect(request, "expired_state");
    }

    return dashboardRedirect(request, "invalid_state");
  }

  const oauthState = consumedState as StateRow;

  try {
    const xero = createXeroClient(state);
    const tokenSet = await xero.apiCallback(request.url);
    const tenants = (await xero.updateTenants(false)) as XeroTenant[];
    const claims = tokenSet.claims();
    const encryptedTokenSet = encryptJson(serializeTokenSet(tokenSet));

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

      const { error: cleanupTenantError } = await supabase.rpc("cleanup_stale_xero_connection_tenants", {
        p_connection_id: connection.id,
        p_current_tenant_ids: tenantRows.map((tenant) => tenant.tenant_id),
      });

      if (cleanupTenantError) throw cleanupTenantError;
    } else {
      const { error: cleanupTenantError } = await supabase.rpc("cleanup_stale_xero_connection_tenants", {
        p_connection_id: connection.id,
        p_current_tenant_ids: [],
      });

      if (cleanupTenantError) throw cleanupTenantError;
    }

    return dashboardRedirect(request, "connected");
  } catch {
    return dashboardRedirect(request, "connect_failed");
  }
}
