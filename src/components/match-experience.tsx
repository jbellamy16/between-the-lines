"use client";
import { useState } from "react";
import { ExplanationPreference } from "./explanation-preference";
import { MatchApp } from "./match-app";
import type { MatchSection } from "./match-shell";
export function MatchExperience() {
  const [section, setSection] = useState<MatchSection>("match");
  return (
    <ExplanationPreference>
      <MatchApp section={section} setSection={setSection} active />
    </ExplanationPreference>
  );
}
