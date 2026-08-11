import { NextResponse } from "next/server";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";

export const runtime = "nodejs";

type TenantRow = {
  tenant_id: string;
  tenant_name: string | null;
};

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) {
    return NextResponse.json({ error: "Xero status is not configured.", missing }, { status: 500 });
  }

  try {
    const { user } = await requireSupabaseUser(request);
    const supabase = getSupabaseServiceClient();

    const { data: connection, error: connectionError } = await supabase
      .from("xero_connections")
      .select("id,connected_at,updated_at")
      .eq("user_id", user.id)
      .is("disconnected_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json({ error: "Failed to load Xero status." }, { status: 500 });
    }

    if (!connection) {
      return NextResponse.json({ connected: false, tenants: [] });
    }

    const { data: tenants, error: tenantError } = await supabase
      .from("xero_connection_tenants")
      .select("tenant_id,tenant_name")
      .eq("connection_id", connection.id)
      .order("tenant_name");

    if (tenantError) {
      return NextResponse.json({ error: "Failed to load Xero tenants." }, { status: 500 });
    }

    return NextResponse.json({
      connected: true,
      connectedAt: connection.connected_at,
      updatedAt: connection.updated_at,
      tenants: ((tenants ?? []) as TenantRow[]).map((tenant) => ({
        id: tenant.tenant_id,
        name: tenant.tenant_name || tenant.tenant_id,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to load Xero status." }, { status: 500 });
  }
}
