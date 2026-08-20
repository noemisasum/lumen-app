import { NextResponse } from "next/server";
import { requireEntityAccess } from "@/lib/server/orgs";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient, requireSupabaseUser } from "@/lib/server/supabase";
import { syncXeroBankLedger } from "@/lib/server/xero-bank-ledger";

export const runtime = "nodejs";

type SyncBody = {
  entityId?: string;
  fromDate?: string | null;
  toDate?: string | null;
};

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Xero bank ledger sync is not configured.", missing }, { status: 500 });
}

export async function POST(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);

  try {
    const { user } = await requireSupabaseUser(request);
    const body = (await request.json().catch(() => ({}))) as SyncBody;
    const entityId = body.entityId?.trim();

    if (!entityId) return NextResponse.json({ error: "Choose a Lumen entity." }, { status: 400 });

    const supabase = getSupabaseServiceClient();
    await requireEntityAccess(supabase, entityId, user.id);

    const sync = await syncXeroBankLedger(supabase, entityId, {
      fromDate: body.fromDate,
      toDate: body.toDate,
    });

    return NextResponse.json({ sync });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Failed to sync Xero bank ledger data." }, { status: 500 });
  }
}
