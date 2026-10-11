"use client";
import type { Fixture } from "@/lib/sources/catalog";
import { useState } from "react";
import { ExplanationPreference } from "./explanation-preference";
import { MatchApp } from "./match-app";
import { HistoricalApp } from "./historical-app";
import type { MatchSection } from "./match-shell";
import { SelectionGroup } from "./motion";
export function MatchExperience({
  historicalEnabled,
  fixtures,
}: {
  historicalEnabled: boolean;
  fixtures: readonly Fixture[];
}) {
  const [section, setSection] = useState<MatchSection>("match");
  const [visitedHistorical, setVisitedHistorical] = useState(false);
  const [source, setSource] = useState<"synthetic" | "historical">("synthetic");
  const selector = historicalEnabled ? (
    <SelectionGroup
      className="mode-switch source-switch"
      label="Match source"
      value={source}
    >
      <button
        className={source === "synthetic" ? "selected" : ""}
        aria-pressed={source === "synthetic"}
        onClick={() => setSource("synthetic")}
      >
        Synthetic
      </button>
      <button
        className={source === "historical" ? "selected" : ""}
        aria-pressed={source === "historical"}
        onClick={() => {
          setVisitedHistorical(true);
          setSource("historical");
        }}
      >
        Recorded
      </button>
    </SelectionGroup>
  ) : null;
  return (
    <ExplanationPreference>
      <div hidden={source !== "synthetic"}>
        <MatchApp
          sourceSelector={selector}
          section={section}
          setSection={setSection}
          active={source === "synthetic"}
        />
      </div>
      {visitedHistorical && (
        <div hidden={source !== "historical"}>
          <HistoricalApp
            sourceSelector={selector}
            fixtures={fixtures}
            section={section}
            setSection={setSection}
            active={source === "historical"}
          />
        </div>
      )}
    </ExplanationPreference>
  );
}
