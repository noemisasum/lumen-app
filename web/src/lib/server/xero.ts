import { createHash, randomBytes } from "crypto";
import { XeroClient, type TokenSet } from "xero-node";

const XERO_SCOPES = ["openid", "profile", "email", "accounting.settings", "accounting.transactions", "offline_access"];

export type XeroTenant = {
  id?: string;
  tenantId?: string;
  tenantName?: string;
  tenantType?: string;
  connectionId?: string;
  updatedDateUtc?: string;
  createdDateUtc?: string;
};

export function getMissingXeroEnv(includeEncryptionKey = false) {
  const names = ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "XERO_REDIRECT_URI"];
  if (includeEncryptionKey) names.push("XERO_TOKEN_ENCRYPTION_KEY");

  return names.filter((name) => !process.env[name]);
}

export function createOauthState() {
  return randomBytes(32).toString("base64url");
}

export function hashOauthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function createXeroClient(state?: string) {
  const missing = getMissingXeroEnv();
  if (missing.length) {
    throw new Error(`Missing Xero env: ${missing.join(", ")}`);
  }

  return new XeroClient({
    clientId: process.env.XERO_CLIENT_ID as string,
    clientSecret: process.env.XERO_CLIENT_SECRET as string,
    redirectUris: [process.env.XERO_REDIRECT_URI as string],
    scopes: XERO_SCOPES,
    state,
    httpTimeout: 5000,
    clockTolerance: 10,
  });
}

export function tokenExpiresAt(tokenSet: TokenSet) {
  if (typeof tokenSet.expires_at === "number") {
    return new Date(tokenSet.expires_at * 1000).toISOString();
  }

  if (typeof tokenSet.expires_in === "number") {
    return new Date(Date.now() + tokenSet.expires_in * 1000).toISOString();
  }

  return null;
}

export function tokenScopes(tokenSet: TokenSet) {
  return typeof tokenSet.scope === "string" ? tokenSet.scope.split(" ").filter(Boolean) : [];
}

export function serializeTokenSet(tokenSet: TokenSet) {
  return {
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token,
    id_token: tokenSet.id_token,
    expires_at: tokenSet.expires_at,
    expires_in: tokenSet.expires_in,
    scope: tokenSet.scope,
    token_type: tokenSet.token_type,
  };
}
