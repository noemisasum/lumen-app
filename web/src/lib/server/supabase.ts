import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type ServerEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export type AuthenticatedRequest = {
  user: User;
  accessToken: string;
};

export function getMissingSupabaseServerEnv() {
  const serverAdminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const entries: Array<[string, string | undefined]> = [
    ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY", serverAdminKey],
  ];

  return entries.filter(([, value]) => !value).map(([name]) => name);
}

function getServerEnv(): ServerEnv {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) {
    throw new Error(`Missing Supabase server env: ${missing.join(", ")}`);
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) as string,
  };
}

export function getSupabaseServiceClient(): SupabaseClient {
  const env = getServerEnv();
  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseUserClient(accessToken: string): SupabaseClient {
  const env = getServerEnv();
  return createClient(env.url, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    accessToken: async () => accessToken,
  });
}

export async function requireSupabaseUser(request: Request): Promise<AuthenticatedRequest> {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Response(JSON.stringify({ error: "Missing Authorization Bearer token." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const env = getServerEnv();
  const supabase = createClient(env.url, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const accessToken = match[1];
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: "Invalid or expired Supabase access token." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return { user: data.user, accessToken };
}
