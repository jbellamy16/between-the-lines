import { buildCase, cases } from "../editorial-baselines/cases";
import {
  INVESTIGATOR_VERSION,
  investigationMaterial,
  investigationTraceEntry,
  investigatorDigest,
  prepareInvestigation,
  type InvestigationTrace,
} from "../../src/lib/ai/director/investigator-contract";
import { scriptedPlan } from "../investigator/scripted";
import { evaluateEditorial, type Submission } from "./render";

/** Authored selections exercise the renderer, never estimate model intelligence. */
export function controls() {
  const c = buildCase(cases.find((c) => c.id === "fading-favored")!);
  const p = prepareInvestigation(c.match, c.cutoff, c.context);
  const packet = {
    index: p.reader.index,
    bundles: p.initial,
    baselineIds: p.baseline.stories.map((s) => s.storyId),
  };
  const submission: Submission = {
    version: INVESTIGATOR_VERSION,
    indexId: p.reader.index.id,
    initialDigest: investigatorDigest(p.initial),
    trace: [],
    plan: scriptedPlan(packet),
  };
  // Exact parity control uses the declared B2 presentation policy.
  const b2 = evaluateEditorial(
    c.match,
    c.cutoff,
    c.context,
    submission,
    "mock",
    "plain",
    "brief",
  ).audit.b2PresentationPlan;
  const base = { ...submission, plan: b2 };
  const material = investigationMaterial(
    p.reader.index,
    p.initial,
    b2.focalId!,
  );
  const other = p.reader.index.developments.find(
    (d) =>
      d.team === "harbor" &&
      d.category === "activity-change" &&
      d.statistics[0]?.label === "shots",
  )!;
  const bundles = [...p.initial];
  const trace: InvestigationTrace = [];
  for (const purpose of ["inspect-challenge", "resolve-priority"] as const) {
    const option = p.reader.index.options.find(
      (o) =>
        o.developmentId === other.id &&
        (purpose === "inspect-challenge"
          ? o.purpose === purpose
          : o.intent === "shot-surge-explanations"),
    )!;
    const action = {
      indexId: p.reader.index.id,
      optionId: option.id,
      focalId: other.id,
      interpretationIds: [],
      purpose: option.purpose,
    };
    const bundle = p.reader.read({
      indexId: action.indexId,
      optionId: action.optionId,
    });
    bundles.push(bundle);
    trace.push(investigationTraceEntry(action, bundle));
  }
  const quiet = buildCase(cases.find((c) => c.id === "quiet")!);
  const q = prepareInvestigation(quiet.match, quiet.cutoff, quiet.context);
  return [
    { id: "same-as-b2", ...c, submission: base },
    {
      id: "secondary-reordering",
      ...c,
      submission: {
        ...base,
        plan: {
          ...b2,
          interpretationIds: [
            b2.interpretationIds[0],
            b2.interpretationIds[2],
            b2.interpretationIds[1],
          ],
        },
      },
    },
    {
      id: "no-further-gain-stop",
      ...c,
      submission: { ...base, plan: { ...b2, stop: "no-material-gain" } },
    },
    {
      id: "generic-counter-evidence",
      ...c,
      submission: {
        ...base,
        plan: { ...b2, challengeIds: ["challenge:tracking-unavailable"] },
      },
    },
    {
      id: "limited-interpretation-focus",
      ...c,
      submission: {
        ...base,
        plan: {
          ...b2,
          interpretationIds: [
            "repeated-route",
            "both-teams",
            "concentrated-attempts",
          ],
        },
      },
    },
    {
      id: "opponent-counter-evidence",
      ...c,
      submission: {
        ...base,
        plan: { ...b2, challengeIds: ["challenge:opponent-shot-response"] },
      },
    },
    {
      id: "different-supported-evidence",
      ...c,
      submission: {
        ...base,
        plan: {
          ...b2,
          supportIds: material.support.slice(-1).map((s) => s.id),
        },
      },
    },
    {
      id: "other-focal-development",
      ...c,
      submission: {
        ...base,
        trace,
        plan: scriptedPlan({ ...packet, bundles }, other.id),
      },
    },
    {
      id: "invalid-factual-prose",
      ...c,
      submission: {
        ...base,
        plan: { ...b2, explanation: "Invented: 99 shots prove domination." },
      },
    },
    {
      id: "quiet-no-call",
      ...quiet,
      submission: {
        version: INVESTIGATOR_VERSION,
        indexId: q.reader.index.id,
        initialDigest: investigatorDigest(q.initial),
        trace: [],
        plan: scriptedPlan({
          index: q.reader.index,
          bundles: q.initial,
          baselineIds: [],
        }),
      },
    },
  ];
}
