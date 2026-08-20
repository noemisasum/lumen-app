import { createHash, randomBytes } from "crypto";
import { XeroClient, type TokenSet } from "xero-node";
import { validateXeroTokenEncryptionKey } from "@/lib/server/crypto";

const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "accounting.settings",
  "accounting.transactions",
  "accounting.reports.read",
  "offline_access",
];

export type XeroTenant = {
  id?: string;
  tenantId?: string;
  tenantName?: string;
  tenantType?: string;
  connectionId?: string;
  updatedDateUtc?: string;
  createdDateUtc?: string;
};

export function getXeroEnvIssues() {
  const names = ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "XERO_REDIRECT_URI", "XERO_TOKEN_ENCRYPTION_KEY"];
  const missing = names.filter((name) => !process.env[name]);
  const invalid = process.env.XERO_TOKEN_ENCRYPTION_KEY && !validateXeroTokenEncryptionKey() ? ["XERO_TOKEN_ENCRYPTION_KEY"] : [];

  return { missing, invalid };
}

export function getXeroEnvIssueNames() {
  const { missing, invalid } = getXeroEnvIssues();
  return [...missing, ...invalid.map((name) => `${name} (must be 32-byte base64 or 64-character hex)`)];
}

export function getConfiguredXeroRedirectUri() {
  return process.env.XERO_REDIRECT_URI ?? null;
}

export function getRequestOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto.split(",")[0].trim()}://${forwardedHost.split(",")[0].trim()}`;
  }

  return new URL(request.url).origin;
}

export function getXeroRedirectOriginMismatch(request: Request) {
  const configuredRedirectUri = getConfiguredXeroRedirectUri();
  if (!configuredRedirectUri) return null;

  try {
    const configured = new URL(configuredRedirectUri);
    const requestOrigin = getRequestOrigin(request);
    const expectedCallbackUri = new URL("/api/xero/callback", requestOrigin).toString();

    if (configured.origin !== requestOrigin) {
      return {
        configuredRedirectUri,
        expectedCallbackUri,
        requestOrigin,
      };
    }
  } catch {
    return {
      configuredRedirectUri,
      expectedCallbackUri: new URL("/api/xero/callback", getRequestOrigin(request)).toString(),
      requestOrigin: getRequestOrigin(request),
    };
  }

  return null;
}

export function createOauthState() {
  return randomBytes(32).toString("base64url");
}

export function hashOauthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function createXeroClient(state?: string) {
  const issues = getXeroEnvIssueNames();
  if (issues.length) {
    throw new Error(`Invalid Xero env: ${issues.join(", ")}`);
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
