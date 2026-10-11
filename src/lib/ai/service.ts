import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { controlledNarration, usageStoreReady } from "./controls";
import { configuredProvider, modelFor, type ProviderMode } from "./providers";
import {
  composeNarration,
  NarrationFailure,
  type NarrationResult,
} from "./narration";
import type { EvidencePacket } from "./evidence";
export type Provenance = {
  provider: ProviderMode;
  model?: string;
  cached: boolean;
  cutoff: number;
  activity: string[];
  validation: string[];
  limitations: string[];
  facts: { id: string; text: string; evidenceIds: string[] }[];
  usage?: NarrationResult["usage"];
  contextFactIds?: string[];
  modelFactIds?: string[];
};
export function offlineProvenance(packet: EvidencePacket): Provenance {
  return {
    provider: "offline",
    cached: false,
    cutoff: packet.time,
    activity: [],
    validation: [
      "Events filtered at viewer timestamp",
      "Comparisons computed from recorded events",
    ],
    limitations: packet.limitations,
    facts: packet.facts,
  };
}
const pending = new Map<
  string,
  Promise<{ result: NarrationResult; cached: boolean }>
>();
export async function narratePacket(packet: EvidencePacket) {
  const provider = configuredProvider();
  const fallback = {
    source: "offline" as const,
    narrative: null,
    provenance: offlineProvenance(packet),
  };
  if (provider === "offline") return fallback;
  if (!usageStoreReady())
    return {
      ...fallback,
      notice:
        "AI is configured, but shared usage controls are unavailable. Showing the verified offline explanation.",
    };
  // Hash all evidence, preferences/ranking, mode, provider, model and prompt version. Never round time into the future.
  const identity = { version: 3, provider, model: modelFor(provider), packet };
  const key = createHash("sha256")
    .update(JSON.stringify(identity))
    .digest("hex");
  try {
    let task = pending.get(key);
    if (!task) {
      task = controlledNarration(identity, (signal) =>
        composeNarration(packet, provider, signal),
      );
      pending.set(key, task);
    }
    const { result, cached } = await task;
    return {
      source: result.provider,
      narrative: result.narrative,
      provenance: {
        provider: result.provider,
        model: result.model,
        cached,
        cutoff: packet.time,
        activity: result.activity,
        validation: result.validation,
        limitations: packet.limitations,
        facts: result.selectedFactIds.map((id) =>
          packet.facts.find((f) => f.id === id)!,
        ),
        contextFactIds: result.contextFactIds,
        modelFactIds: result.modelFactIds,
        usage: result.usage,
      } satisfies Provenance,
    };
  } catch (error) {
    return {
      ...fallback,
      ...(error instanceof NarrationFailure
        ? {
            failureStage: error.stage,
            provenance: {
              ...fallback.provenance,
              activity: error.activity,
              validation: [...fallback.provenance.validation, ...error.checks],
            },
          }
        : {}),
      notice:
        "AI narration is unavailable, busy, at its usage limit, or did not pass validation. The verified offline explanation is available; you can try again shortly.",
    };
  } finally {
    pending.delete(key);
  }
}
export async function readInput<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  // Stream cap also applies to chunked requests without Content-Length.
  if (Number(req.headers.get("content-length") ?? 0) > 16384)
    throw new Error("Large input");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Missing input");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) {
        await reader.cancel();
        throw new Error("Large input");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
