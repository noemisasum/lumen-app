import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  logSkippedReprocessAttempt,
  loadStatementImportsNeedingAttention,
  recordAutomatedReprocessAttempt,
  reprocessStatementImport,
  summarizeReprocessError,
  type ReprocessSummary,
} from "@/lib/server/statement-import-reprocess";
import { getMissingSupabaseServerEnv, getSupabaseServiceClient } from "@/lib/server/supabase";

export const runtime = "nodejs";

const defaultBatchLimit = 25;
const maxBatchLimit = 50;
const defaultMaxAttempts = 3;
const maxConfiguredAttempts = 10;

function missingEnvResponse(missing: string[]) {
  return NextResponse.json({ error: "Hourly statement import reprocessing is not configured.", missing }, { status: 500 });
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function hasInternalAccess(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const maintenanceSecret = process.env.STATEMENT_REPROCESS_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const maintenanceKey = request.headers.get("x-lumen-maintenance-key") ?? "";

  if (!cronSecret && !maintenanceSecret) return { configured: false, ok: false };

  const ok =
    (cronSecret ? safeEquals(bearer, cronSecret) : false) ||
    (maintenanceSecret ? safeEquals(bearer, maintenanceSecret) || safeEquals(maintenanceKey, maintenanceSecret) : false);

  return { configured: true, ok };
}

function parseBoundedInteger(value: string | undefined, fallback: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  const missing = getMissingSupabaseServerEnv();
  if (missing.length) return missingEnvResponse(missing);
  const internalAccess = hasInternalAccess(request);
  if (!internalAccess.configured) return missingEnvResponse(["CRON_SECRET or STATEMENT_REPROCESS_SECRET"]);
  if (!internalAccess.ok) {
    return NextResponse.json({ error: "Hourly statement import reprocessing is restricted to internal automation." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseServiceClient();
    const batchLimit = parseBoundedInteger(process.env.STATEMENT_REPROCESS_CRON_LIMIT, defaultBatchLimit, maxBatchLimit);
    const maxAttempts = parseBoundedInteger(process.env.STATEMENT_REPROCESS_MAX_ATTEMPTS, defaultMaxAttempts, maxConfiguredAttempts);
    const rows = await loadStatementImportsNeedingAttention(supabase, { limit: batchLimit, maxAttempts });
    const results: ReprocessSummary[] = [];

    for (const row of rows) {
      let result: ReprocessSummary;
      try {
        result = await reprocessStatementImport(supabase, row, "maintenance_cron");
      } catch (error) {
        result = summarizeReprocessError(row, error);
        try {
          await logSkippedReprocessAttempt(supabase, row, "maintenance_cron", result.error ?? "Failed to reprocess statement import.");
        } catch (logError) {
          console.error("Failed to log skipped statement reprocess attempt", logError);
        }
      }

      try {
        await recordAutomatedReprocessAttempt(supabase, row, result, { maxAttempts });
      } catch (error) {
        console.error("Failed to record automated statement reprocess attempt", error);
        result = {
          ...result,
          status: "skipped",
          error: `Failed to record automated reprocess attempt: ${
            error instanceof Error && error.message ? error.message : "Unknown error"
          }`,
        };
      }
      results.push(result);
    }

    return NextResponse.json({
      ok: true,
      count: results.length,
      limit: batchLimit,
      maxAttempts,
      results,
    });
  } catch {
    return NextResponse.json({ error: "Failed to run hourly statement import reprocessing." }, { status: 500 });
  }
}
