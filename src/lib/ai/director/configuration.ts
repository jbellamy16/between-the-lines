import "server-only";
import { createHash } from "node:crypto";
import { configuredProvider, modelFor } from "../providers";
import { usageStoreReady } from "../controls";
import { DIRECTOR_VERSION } from "./observer";

/** Opaque, non-secret cache identity; never exposes an endpoint or credentials. */
export function directorConfiguration() {
  const provider = configuredProvider();
  return createHash("sha256")
    .update(
      JSON.stringify({
        provider,
        model: provider === "offline" ? null : modelFor(provider),
        endpoint:
          provider === "foundry" ? process.env.FOUNDRY_ENDPOINT : provider,
        ready: usageStoreReady(),
        version: DIRECTOR_VERSION,
      }),
    )
    .digest("hex");
}
