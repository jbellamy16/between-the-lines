// Read-only preparation. No authorization, resource start, allowance creation or EVAL.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createClient } from "@redis/client";
import {
  collectPreflight,
  localConfiguration,
} from "../eval/guided-study/preflight";
import { checkDurability } from "../eval/investigator-feasibility/store";
import { digest } from "../eval/frozen-editorial/plan";
if (process.argv.length !== 3)
  throw new Error("Supply a new readiness output file");
const config = localConfiguration();
const snapshots = [];
for (const [name, url] of [
  ["configured-allowance", config.AI_REDIS_URL],
  ["historical-continuation", "redis://127.0.0.1:16379"],
  ["historical-guided", "redis://127.0.0.1:16380"],
] as const) {
  if (!url) {
    snapshots.push({
      name,
      configured: false,
      reachable: false,
      counters: null,
    });
    continue;
  }
  const client = createClient({
    url,
    socket: { connectTimeout: 2000, reconnectStrategy: false },
    disableOfflineQueue: true,
  });
  client.on("error", () => {});
  const timeout = setTimeout(() => {
    if (client.isOpen) client.destroy();
  }, 4000);
  try {
    await client.connect();
    const durability = await client.configGet([
      "appendonly",
      "appendfsync",
      "maxmemory-policy",
      "no-appendfsync-on-rewrite",
    ]);
    const info = await client.info("persistence");
    let durable = true;
    try {
      checkDurability(durability, info);
    } catch {
      durable = false;
    }
    const counters = await client.hGetAll("{second-look-ai}:budget");
    const ttl = await client.ttl("{second-look-ai}:budget");
    const historicalKeys: string[] = [];
    for await (const keys of client.scanIterator({
      MATCH: "{second-look-ai}:study:*",
      COUNT: 100,
    }))
      historicalKeys.push(...keys);
    snapshots.push({
      name,
      identitySha256: digest(url),
      reachable: true,
      durability,
      durable,
      counters,
      ttl,
      historicalKeys,
      suitable: false,
      note: "Existing owner identity and separate candidate authorization still required; historical stores cannot be reused.",
    });
  } catch {
    snapshots.push({
      name,
      reachable: false,
      counters: null,
      blocker:
        "Existing endpoint unavailable; no service started and no counters inferred.",
    });
  } finally {
    clearTimeout(timeout);
    if (client.isOpen) client.destroy();
  }
}
let containers: unknown = null;
try {
  containers = JSON.parse(
    execFileSync(
      "docker",
      [
        "inspect",
        "second-look-guided-campaign",
        "second-look-foundry-continuation-1",
      ],
      { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] },
    ),
  ).map(
    (c: {
      Name: string;
      State: { Status: string; FinishedAt: string };
      HostConfig: { PortBindings: unknown };
    }) => ({
      name: c.Name,
      status: c.State.Status,
      finishedAt: c.State.FinishedAt,
      ports: c.HostConfig.PortBindings,
    }),
  );
} catch {
  /* Metadata unavailable, not evidence of allowance. */
}
const preflight = await collectPreflight();
const report = {
  ...preflight,
  blockers: [
    ...preflight.blockers.filter(
      (b) =>
        !b.includes("six workflows") &&
        !b.includes("shared application allowance is insufficient"),
    ),
    "No separate explicit authorization exists for this candidate.",
    ...(!config.AI_REDIS_URL || config.AI_USAGE_STORE !== "redis"
      ? [
          "No configured existing durable Redis allowance/owner can be verified; local accounting is memory-only.",
        ]
      : [
          "Existing owner identity and permission must still be independently verified.",
        ]),
    ...(!config.FOUNDRY_ENDPOINT ||
    !config.FOUNDRY_DEPLOYMENT ||
    !config.FOUNDRY_API_KEY
      ? ["Local Foundry endpoint/deployment/key are not configured."]
      : []),
    "Known historical study stores are not reusable allowance, regardless of remaining historical counters.",
  ],
  localConfiguration: {
    store: config.AI_USAGE_STORE ?? "unconfigured",
    redisUrlConfigured: !!config.AI_REDIS_URL,
    foundryEndpointConfigured: !!config.FOUNDRY_ENDPOINT,
    foundryDeploymentConfigured: !!config.FOUNDRY_DEPLOYMENT,
    foundryKeyPresent: !!config.FOUNDRY_API_KEY,
  },
  redisInspection: snapshots,
  historicalContainers: containers,
  readyForAuthorizedRun: false,
  separateAuthorizationPresent: false,
  note: "Collector's six-workflow warnings are historical sizing context, not this one-case requirement. Current Redis state is unknown when endpoints are stopped. No historical counters are reset or reused.",
  redisCommands: ["CONFIG GET", "INFO persistence", "HGETALL", "TTL", "SCAN"],
  inferenceRequests: 0,
  persistentConfigurationChanges: 0,
};
writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    output: process.argv[2],
    readyForAuthorizedRun: false,
    inferenceRequests: 0,
  }),
);
