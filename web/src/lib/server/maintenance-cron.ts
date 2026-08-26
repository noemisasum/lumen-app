import { timingSafeEqual } from "node:crypto";

export const defaultXeroLedgerSyncWindowDays = 90;
export const maxXeroLedgerSyncWindowDays = 366;

export type InternalSecretAccessInput = {
  authorization?: string | null;
  maintenanceKey?: string | null;
  cronSecret?: string | null;
  maintenanceSecret?: string | null;
};

export function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function bearerToken(authorization: string | null | undefined) {
  return authorization?.replace(/^Bearer\s+/i, "") ?? "";
}

export function hasInternalSecretAccess(input: InternalSecretAccessInput) {
  const cronSecret = input.cronSecret ?? "";
  const maintenanceSecret = input.maintenanceSecret ?? "";
  const bearer = bearerToken(input.authorization);
  const maintenanceKey = input.maintenanceKey ?? "";

  if (!cronSecret && !maintenanceSecret) return { configured: false, ok: false };

  const ok =
    (cronSecret ? safeEquals(bearer, cronSecret) : false) ||
    (maintenanceSecret ? safeEquals(bearer, maintenanceSecret) || safeEquals(maintenanceKey, maintenanceSecret) : false);

  return { configured: true, ok };
}

export function parseBoundedInteger(value: string | undefined, fallback: number, max: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function isoDateDaysBefore(toDate: string, days: number) {
  const date = new Date(`${toDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
