import { providerLabel } from "./provenance";

/** Describe the returned result, never infer AI work from provider availability. */
export function InvestigationSource({
  source,
  cached = false,
}: {
  source: string;
  cached?: boolean;
}) {
  const ai = source === "foundry" || source === "openai";
  return (
    <div className="investigation-source" aria-label="Analysis source">
      <span className="investigation-source-label">
        {ai ? "AI investigation" : "Verified event analysis"}
        {cached && ai ? " · Reused answer" : ""}
      </span>
      <p className="director-mode-note">
        {ai
          ? `Investigated with ${providerLabel(source)} · Independently verified. AI selected evidence; deterministic checks verified the recorded facts.`
          : "Checked from recorded events using deterministic rules · No model investigation."}
      </p>
    </div>
  );
}
