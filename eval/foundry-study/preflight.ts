import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@redis/client";
import { CAPS, DEPLOYMENT, PRICE } from "./ledger";

export const PRICE_URL =
  "https://prices.azure.com/api/retail/prices?" +
  new URLSearchParams({
    $filter:
      "armRegionName eq 'westus3' and productName eq 'Azure OpenAI GPT5' and (skuName eq '5.4 mini Inp Gl' or skuName eq '5.4 mini cd Inp Gl' or skuName eq '5.4 mini Opt Gl')",
    currencyCode: "USD",
  });
export const MODEL_URL =
  "https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure#gpt-54";
const quotaNames = [
  "AI_MINUTE_LIMIT",
  "AI_HOURLY_LIMIT",
  "AI_DAILY_LIMIT",
  "AI_TOTAL_LIMIT",
  "AI_REQUEST_MINUTE_LIMIT",
  "AI_TOKEN_MINUTE_LIMIT",
] as const;
const defaults = [4, 30, 60, 100, 10, 10000],
  ceilings = [10, 100, 500, 5000, 10, 10000];
export function localConfiguration() {
  const file = existsSync(".env.local")
    ? parseEnv(readFileSync(".env.local", "utf8"))
    : {};
  return {
    ...file,
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => v !== undefined),
    ),
  } as Record<string, string>;
}
export function quotaSnapshot(config: Record<string, string | undefined>) {
  return quotaNames.map((name, i) => {
    const value = Number(
      config[name] ??
        (name === "AI_HOURLY_LIMIT"
          ? config.FOUNDRY_HOURLY_LIMIT
          : undefined) ??
        defaults[i],
    );
    return Number.isFinite(value)
      ? Math.max(0, Math.min(ceilings[i], Math.floor(value)))
      : 0;
  });
}
export type Allowance = {
  limits: number[];
  store: "shared" | "memory" | "unconfigured";
  remainingWorkflows: number | null;
  remainingAttempts: number | null;
};
export function allowanceBlockers(a: Allowance) {
  const reasons: string[] = [];
  if (a.limits[0] <= 0 || a.limits[4] <= 0 || a.limits[5] <= 0)
    reasons.push("Application throughput allowance is disabled.");
  if (
    Math.min(...a.limits.slice(1, 4)) < CAPS.workflows ||
    Math.min(...a.limits.slice(1, 4)) < CAPS.attempts
  )
    reasons.push(
      "Existing application hourly/daily/total limits cannot support six workflows and twelve attempts; increasing them is prohibited.",
    );
  if (
    a.store !== "shared" ||
    a.remainingWorkflows === null ||
    a.remainingAttempts === null
  )
    reasons.push(
      "Remaining durable application allowance cannot be established; no existing shared counter is available to this process.",
    );
  else if (
    a.remainingWorkflows < CAPS.workflows ||
    a.remainingAttempts < CAPS.attempts
  )
    reasons.push(
      "Existing shared application allowance is insufficient for this study.",
    );
  return reasons;
}
async function allowance(config: Record<string, string>): Promise<Allowance> {
  const limits = quotaSnapshot(config);
  const result: Allowance = {
    limits,
    store: config.AI_REDIS_URL
      ? "shared"
      : config.AI_USAGE_STORE === "memory"
        ? "memory"
        : "unconfigured",
    remainingWorkflows: null,
    remainingAttempts: null,
  };
  if (!config.AI_REDIS_URL) return result;
  // Only inspect an EXISTING store. Never create/reset keys or change its config.
  const client = createClient({
    url: config.AI_REDIS_URL,
    socket: { connectTimeout: 3000, reconnectStrategy: false },
    disableOfflineQueue: true,
  });
  client.on("error", () => {});
  const timer = setTimeout(() => {
    if (client.isOpen) client.destroy();
  }, 5000);
  try {
    await client.connect();
    const values = (await client.eval(
      "local t=redis.call('TIME'); return {t,redis.call('HGETALL',KEYS[1])}",
      { keys: ["{second-look-ai}:budget"], arguments: [] },
    )) as [string[], string[]];
    const budget = Object.fromEntries(
      Array.from({ length: values[1].length / 2 }, (_, i) => [
        values[1][i * 2],
        values[1][i * 2 + 1],
      ]),
    );
    const now = Number(values[0][0]);
    const remaining = (attempts: boolean) => {
      const periods = attempts ? [3600, 86400, 0] : [60, 3600, 86400, 0];
      return Math.min(
        ...periods
          .map((period, i) => {
            const used = Number(
              budget[`${attempts ? "attemptUsed" : "used"}${i + 1}`],
            );
            const start = Number(
              budget[`${attempts ? "attemptStart" : "start"}${i + 1}`],
            );
            if (![used, start].every((v) => Number.isSafeInteger(v) && v >= 0))
              throw new Error("Unknown/corrupt counters");
            const effective =
              period && now - start / (attempts ? 1000 : 1) >= period
                ? 0
                : used;
            return limits[i + (attempts ? 1 : 0)] - effective;
          })
          .slice(attempts ? 0 : 1),
      ); // workflows are spaced beyond the minute window
    };
    result.remainingWorkflows = remaining(false);
    result.remainingAttempts = remaining(true);
  } catch {
    /* Unknown stays unknown; errors may contain a private URL. */
  } finally {
    clearTimeout(timer);
    if (client.isOpen) client.destroy();
  }
  return result;
}
const az = (args: string[]) =>
  JSON.parse(
    execFileSync("az", [...args, "-o", "json"], {
      encoding: "utf8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
export async function collectPreflight() {
  const checkedAt = new Date().toISOString(),
    config = localConfiguration();
  const application = await allowance(config);
  const blockers = allowanceBlockers(application);
  let deployment = null,
    prices = null,
    hosted = null;
  try {
    const account = az([
      "cognitiveservices",
      "account",
      "show",
      "--resource-group",
      "rg-josh-5843",
      "--name",
      "josh-5098-resource",
      "--query",
      "{location:location,kind:kind}",
    ]);
    if (account.location !== "westus3" || account.kind !== "AIServices")
      blockers.push(
        "Account region/kind differs from the priced Foundry resource.",
      );
    deployment = az([
      "cognitiveservices",
      "account",
      "deployment",
      "show",
      "--resource-group",
      "rg-josh-5843",
      "--name",
      "josh-5098-resource",
      "--deployment-name",
      DEPLOYMENT,
      "--query",
      "{name:name,sku:sku.name,capacity:sku.capacity,model:properties.model.name,version:properties.model.version,state:properties.provisioningState,rateLimits:properties.rateLimits}",
    ]);
    deployment.region = account.location;
    if (
      deployment.name !== DEPLOYMENT ||
      deployment.model !== "gpt-5.4-mini" ||
      deployment.version !== "2026-03-17" ||
      deployment.sku !== "GlobalStandard" ||
      deployment.capacity !== 10 ||
      deployment.state !== "Succeeded" ||
      !deployment.rateLimits.some(
        (r: { key: string; count: number; renewalPeriod: number }) =>
          r.key === "request" && r.count === 10 && r.renewalPeriod === 60,
      ) ||
      !deployment.rateLimits.some(
        (r: { key: string; count: number; renewalPeriod: number }) =>
          r.key === "token" && r.count === 10000 && r.renewalPeriod === 60,
      )
    )
      blockers.push(
        "Deployment identity or capacity differs from the approved operating envelope.",
      );
  } catch {
    blockers.push("Read-only deployment verification unavailable.");
  }
  try {
    const response = await fetch(PRICE_URL, {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("Price lookup unavailable");
    const value = await response.json();
    const expected: Record<string, number> = {
      "5.4 mini Inp Gl": PRICE.input,
      "5.4 mini cd Inp Gl": PRICE.cachedInput,
      "5.4 mini Opt Gl": PRICE.output,
    };
    const items = value.Items.filter((i: { skuName: string }) =>
      Object.hasOwn(expected, i.skuName),
    );
    if (
      value.NextPageLink ||
      items.length !== 3 ||
      new Set(items.map((i: { skuName: string }) => i.skuName)).size !== 3 ||
      items.some(
        (i: Record<string, unknown>) =>
          i.currencyCode !== "USD" ||
          i.type !== "Consumption" ||
          i.unitOfMeasure !== "1M" ||
          i.armRegionName !== "westus3" ||
          i.retailPrice !== expected[String(i.skuName)] ||
          String(i.effectiveStartDate) > checkedAt,
      )
    )
      throw new Error("Unverified prices");
    prices = {
      source: PRICE_URL,
      checkedAt,
      currency: "USD",
      perMillion: PRICE,
      meters: items.map((i: Record<string, unknown>) =>
        Object.fromEntries(
          [
            "meterId",
            "meterName",
            "skuName",
            "unitOfMeasure",
            "retailPrice",
            "currencyCode",
            "armRegionName",
            "effectiveStartDate",
          ].map((k) => [k, i[k]]),
        ),
      ),
    };
  } catch {
    blockers.push("Applicable current model prices could not be verified.");
  }
  try {
    hosted = az([
      "webapp",
      "config",
      "appsettings",
      "list",
      "--resource-group",
      "rg-between-the-lines",
      "--name",
      "between-the-lines-jb-f5539b65",
      "--query",
      "[?name=='AI_ENABLED' || name=='AI_PROVIDER' || name=='AI_USAGE_STORE' || name=='AI_MINUTE_LIMIT' || name=='AI_HOURLY_LIMIT' || name=='AI_DAILY_LIMIT' || name=='AI_TOTAL_LIMIT'].{name:name,value:value}",
    ]);
  } catch {
    /* Hosted quotas are context, not an alternate allowance. */
  }
  return {
    checkedAt,
    application,
    deployment,
    prices,
    hosted,
    blockers,
    credentialsFetched: false,
    inferenceRequests: 0,
    persistentConfigurationChanges: 0,
  };
}
