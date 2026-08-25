import type { SupabaseClient } from "@supabase/supabase-js";

export type FxRateProvider = "frankfurter" | "xe";
export type FxRateSource = "identity" | "cache" | FxRateProvider | "manual";
export type FxRateStatus = "available" | "missing_credentials" | "schema_missing" | "fetch_failed" | "invalid_currency";

export type FxUsdRate = {
  currency: string;
  rateToUsd: number;
  rateDate: string;
  asOf: string;
  source: FxRateSource;
  status: FxRateStatus;
  rawPayload?: unknown;
};

type FxRateRow = {
  base_currency: string;
  quote_currency: string;
  rate: string | number;
  rate_date: string;
  as_of: string;
  source: string;
};

type XeConversionResponse = {
  from?: string;
  to?: Array<{
    quotecurrency?: string;
    mid?: number;
  }>;
  timestamp?: string;
};

type FrankfurterRateResponse = {
  base?: string;
  quote?: string;
  rate?: number;
  date?: string;
};

const FRANKFURTER_SOURCE = "frankfurter";
const XE_SOURCE = "xe";
const FX_RATE_SOURCES = new Set<string>([FRANKFURTER_SOURCE, XE_SOURCE, "manual"]);
const USD_RATE: FxUsdRate = {
  currency: "USD",
  rateToUsd: 1,
  rateDate: new Date().toISOString().slice(0, 10),
  asOf: new Date().toISOString(),
  source: "identity",
  status: "available",
};

export function normalizeFxCurrency(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "CNH") return normalized;
  return /^[A-Z]{3}$/.test(normalized) && Intl.supportedValuesOf("currency").includes(normalized) ? normalized : null;
}

function isMissingFxTableError(error: unknown) {
  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown } | null;
  const code = typeof maybeError?.code === "string" ? maybeError.code : "";
  const text = [maybeError?.message, maybeError?.details, maybeError?.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return text.includes("fx_exchange_rates") && (code === "42P01" || code === "PGRST205" || text.includes("does not exist") || text.includes("schema cache"));
}

function getFxRateProvider(): FxRateProvider {
  return process.env.FX_RATE_PROVIDER?.trim().toLowerCase() === XE_SOURCE ? XE_SOURCE : FRANKFURTER_SOURCE;
}

function getXeCredentials() {
  const accountId = process.env.XE_ACCOUNT_ID?.trim();
  const apiKey = process.env.XE_API_KEY?.trim();
  const apiBaseUrl = process.env.XE_API_BASE_URL?.trim() || "https://xecdapi.xe.com/v1";
  return accountId && apiKey ? { accountId, apiKey, apiBaseUrl } : null;
}

function getFrankfurterApiBaseUrl() {
  return process.env.FRANKFURTER_API_BASE_URL?.trim() || "https://api.frankfurter.dev/v2";
}

function rateFromRow(row: FxRateRow): FxUsdRate | null {
  const currency = normalizeFxCurrency(row.base_currency);
  const rate = typeof row.rate === "number" ? row.rate : Number(row.rate);
  if (!currency || row.quote_currency !== "USD" || !Number.isFinite(rate) || rate <= 0) return null;

  return {
    currency,
    rateToUsd: rate,
    rateDate: row.rate_date,
    asOf: row.as_of,
    source: FX_RATE_SOURCES.has(row.source) ? (row.source as FxRateSource) : "cache",
    status: "available",
  };
}

async function loadCachedRates(supabase: SupabaseClient, currencies: string[]) {
  const rates = new Map<string, FxUsdRate>();
  const remoteCurrencies = currencies.filter((currency) => currency !== "USD");
  rates.set("USD", { ...USD_RATE, rateDate: new Date().toISOString().slice(0, 10), asOf: new Date().toISOString() });

  if (!remoteCurrencies.length) return { rates, tableAvailable: true };

  const { data, error } = await supabase
    .from("fx_exchange_rates")
    .select("base_currency,quote_currency,rate,rate_date,as_of,source")
    .in("base_currency", remoteCurrencies)
    .eq("quote_currency", "USD")
    .order("rate_date", { ascending: false })
    .order("as_of", { ascending: false });

  if (error) {
    if (isMissingFxTableError(error)) return { rates, tableAvailable: false };
    throw error;
  }

  for (const row of (data ?? []) as FxRateRow[]) {
    const rate = rateFromRow(row);
    if (rate && !rates.has(rate.currency)) rates.set(rate.currency, rate);
  }

  return { rates, tableAvailable: true };
}

async function fetchXeUsdRate(currency: string): Promise<FxUsdRate> {
  const credentials = getXeCredentials();
  if (!credentials) {
    return {
      currency,
      rateToUsd: 0,
      rateDate: new Date().toISOString().slice(0, 10),
      asOf: new Date().toISOString(),
      source: "cache",
      status: "missing_credentials",
    };
  }

  const url = new URL(`${credentials.apiBaseUrl.replace(/\/+$/, "")}/convert_from.json`);
  url.searchParams.set("from", currency);
  url.searchParams.set("to", "USD");
  url.searchParams.set("amount", "1");

  const auth = Buffer.from(`${credentials.accountId}:${credentials.apiKey}`).toString("base64");
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`XE returned ${response.status} for ${currency}.`);

  const body = (await response.json()) as XeConversionResponse;
  const usdQuote = body.to?.find((quote) => quote.quotecurrency?.toUpperCase() === "USD");
  const rate = usdQuote?.mid;
  if (!Number.isFinite(rate) || !rate || rate <= 0) throw new Error(`XE did not return a usable USD rate for ${currency}.`);

  const asOf = body.timestamp ? new Date(body.timestamp).toISOString() : new Date().toISOString();
  return {
    currency,
    rateToUsd: rate,
    rateDate: asOf.slice(0, 10),
    asOf,
    source: "xe",
    status: "available",
    rawPayload: body,
  };
}

async function fetchFrankfurterUsdRate(currency: string): Promise<FxUsdRate> {
  const url = new URL(`${getFrankfurterApiBaseUrl().replace(/\/+$/, "")}/rate/${currency}/USD`);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Frankfurter returned ${response.status} for ${currency}.`);

  const body = (await response.json()) as FrankfurterRateResponse;
  const rate = body.rate;
  if (!Number.isFinite(rate) || !rate || rate <= 0) throw new Error(`Frankfurter did not return a usable USD rate for ${currency}.`);

  const rateDate = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  return {
    currency,
    rateToUsd: rate,
    rateDate,
    asOf: new Date().toISOString(),
    source: "frankfurter",
    status: "available",
    rawPayload: body,
  };
}

async function cacheFetchedRate(supabase: SupabaseClient, rate: FxUsdRate) {
  const { error } = await supabase.from("fx_exchange_rates").upsert(
    {
      base_currency: rate.currency,
      quote_currency: "USD",
      rate_date: rate.rateDate,
      rate: rate.rateToUsd,
      source: rate.source,
      as_of: rate.asOf,
      raw_payload: rate.rawPayload ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "base_currency,quote_currency,rate_date,source" },
  );
  if (error) throw error;
}

export async function getUsdRatesForCurrencies(supabase: SupabaseClient, inputCurrencies: Array<string | null | undefined>) {
  const currencies = Array.from(new Set(inputCurrencies.map(normalizeFxCurrency).filter((currency): currency is string => Boolean(currency)))).sort();
  const { rates, tableAvailable } = await loadCachedRates(supabase, currencies);

  if (!tableAvailable) {
    return {
      rates,
      status: "schema_missing" as const,
      source: getFxRateProvider(),
      missingCurrencies: currencies.filter((currency) => !rates.has(currency)),
    };
  }

  const missingCurrencies = currencies.filter((currency) => !rates.has(currency));
  const provider = getFxRateProvider();
  const credentials = provider === "xe" ? getXeCredentials() : null;
  if (provider === "xe" && !credentials) {
    return { rates, status: missingCurrencies.length ? ("missing_credentials" as const) : ("available" as const), source: provider, missingCurrencies };
  }

  for (const currency of missingCurrencies) {
    try {
      const fetched = provider === "xe" ? await fetchXeUsdRate(currency) : await fetchFrankfurterUsdRate(currency);
      await cacheFetchedRate(supabase, fetched);
      rates.set(currency, fetched);
    } catch {
      rates.set(currency, {
        currency,
        rateToUsd: 0,
        rateDate: new Date().toISOString().slice(0, 10),
        asOf: new Date().toISOString(),
        source: provider,
        status: "fetch_failed",
      });
    }
  }

  const stillMissing = currencies.filter((currency) => !rates.has(currency) || rates.get(currency)?.status !== "available");
  return { rates, status: stillMissing.length ? ("fetch_failed" as const) : ("available" as const), source: provider, missingCurrencies: stillMissing };
}
