import type { EvidenceIndex } from "../../src/lib/ai/director/discovery";
import type {
  InvestigationBundle,
  InvestigationPlan,
} from "../../src/lib/ai/director/investigator-contract";
import { investigationMaterial } from "../../src/lib/ai/director/investigator-contract";
import type { investigationWire } from "../../src/lib/ai/director/investigator-wire";

/** Evaluation decoder only. The canonical verifier does not trust wire data. */
export function decodeInvestigationWire(
  wire: ReturnType<typeof investigationWire>,
) {
  const decode = (value: unknown): unknown => {
    if (typeof value === "string" && /^s\d+$/.test(value))
      return wire.strings[Number(value.slice(1))];
    if (typeof value === "string" && /^v\d+$/.test(value))
      return decode(wire.values[Number(value.slice(1))]);
    if (Array.isArray(value)) {
      if (typeof value[0] === "string" && /^r\d+$/.test(value[0]))
        return Object.fromEntries(
          wire.shapes[Number(value[0].slice(1))].map((key, i) => [
            key,
            decode(value[i + 1]),
          ]),
        );
      return value.map(decode);
    }
    return value;
  };
  return decode(wire.data) as {
    index: EvidenceIndex;
    baselineIds: string[];
    bundles: InvestigationBundle[];
  };
}
export type ScriptPacket = ReturnType<typeof decodeInvestigationWire>;

/** Authored control script, not a model or a claim of model intelligence.
 * It receives no case labels or raw/future events. */
export function scriptedPlan(
  packet: ScriptPacket,
  focalId = packet.baselineIds[0] ?? null,
): InvestigationPlan {
  if (!focalId)
    return {
      indexId: packet.index.id,
      focalId: null,
      interpretationIds: [],
      supportIds: [],
      challengeIds: [],
      stop:
        packet.index.coverage.options.omitted ||
        packet.index.coverage.developments.omitted
          ? "unresolved"
          : "no-material-gain",
    };
  const material = investigationMaterial(packet.index, packet.bundles, focalId);
  // Select emphasis from supplied evidence; all alternatives remain in the answer.
  const order = [...material.interpretations].sort(
    (a, b) =>
      Number(b.status === "supported") - Number(a.status === "supported"),
  );
  return {
    indexId: packet.index.id,
    focalId,
    interpretationIds: order.map((i) => i.id),
    supportIds: material.support.slice(0, 1).map((s) => s.id),
    challengeIds: material.challenges.slice(0, 1).map((c) => c.id),
    stop:
      material.unresolved ||
      packet.index.coverage.developments.omitted ||
      packet.index.coverage.options.omitted
        ? "unresolved"
        : "sufficient",
  };
}
