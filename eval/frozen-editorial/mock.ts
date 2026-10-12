import { proposal } from "./plan";
import type { Store } from "./store";
/** Ephemeral test double only. Never reads Redis or creates persistent allowance. */
export function mockStore(
  maxNanoUsd = proposal.maxNanoUsd as number,
  maxAttempts = 2,
) {
  let attempts = 0,
    accounted = 0,
    pending = 0,
    stopped = false;
  const store: Store = async (action, event = {}) => {
    if (action === "reserve") {
      if (
        stopped ||
        pending ||
        attempts >= maxAttempts ||
        accounted + proposal.reserveNanoUsd > maxNanoUsd
      )
        throw new Error("Mock reservation refused");
      pending = ++attempts;
      accounted += proposal.reserveNanoUsd;
    }
    if (action === "settle") {
      if (pending !== event.id) throw new Error("Mock settlement refused");
      accounted += Number(event.accountedNanoUsd) - proposal.reserveNanoUsd;
      pending = 0;
      stopped = !!event.stop;
    }
    if (action === "stop") stopped = true;
    return [
      [
        "attempts",
        String(attempts),
        "accounted",
        String(accounted),
        "pending",
        String(pending),
        "stopped",
        String(Number(stopped)),
      ],
      [],
    ];
  };
  return { store, accounted: () => accounted };
}
export const mockEnvironment = {
  AI_ENABLED: "true",
  AI_PROVIDER: "foundry",
  AI_USAGE_STORE: "memory",
  AI_REDIS_URL: "",
  FOUNDRY_ENDPOINT: "https://josh-5098-resource.openai.azure.com",
  FOUNDRY_DEPLOYMENT: proposal.deployment,
  FOUNDRY_API_KEY: "mock-only-never-sent",
  AI_MINUTE_LIMIT: "2",
  AI_HOURLY_LIMIT: "2",
  AI_DAILY_LIMIT: "2",
  AI_TOTAL_LIMIT: "2",
  AI_REQUEST_MINUTE_LIMIT: "30",
  AI_TOKEN_MINUTE_LIMIT: "30000",
  AI_PROACTIVE_ENABLED: "false",
};
