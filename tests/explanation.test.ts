import { describe, expect, it } from "vitest";
import {
  presentStory,
  presentInsight,
  hypothesisQualifications,
  parseExplanationStyle,
} from "../src/lib/explanation";
import { buildBriefing } from "../src/lib/recap-briefing";
import { SyntheticMatchSource } from "../src/lib/sources/synthetic";
import { observe } from "../src/lib/ai/director/observer";
import { selectLeadCandidate } from "../src/lib/ai/director/editorial";
import { packageStory } from "../src/lib/ai/director/story";
import { createInvestigation } from "../src/lib/ai/director/tools";
import { loadHistorical } from "../src/lib/sources/repository";
import { matchInsights } from "../src/lib/sources/intelligence";
import type { MatchData } from "../src/lib/sources/model";

const source = new SyntheticMatchSource();
const match = source.read("pressure");
const styles = ["plain", "fan", "analysis"] as const;
const storyAt = (m: MatchData, time: number, metric = "shots") =>
  packageStory(
    observe(m, time, "analyst", {}, { unranked: true }).find(
      (c) =>
        c.category === "activity-change" && c.statistics[0].label === metric,
    )!,
    m,
    time,
    "analyst",
    "offline",
  );

describe("independent explanations of shared verified evidence", () => {
  it("defaults invalid values to Casual Viewer and preserves saved levels", () => {
    for (const value of [null, undefined, "analyst", "advanced", {}, "plain"])
      expect(parseExplanationStyle(value)).toBe("plain");
    expect(parseExplanationStyle("analysis")).toBe("analysis");
    expect(parseExplanationStyle("fan")).toBe("fan");
  });
  it("changes the reading, retains counts/windows and matches Insights without mutating a story", () => {
    for (const metric of ["shots", "ball wins in the attacking third"]) {
      const story = storyAt(match, 3804, metric);
      const original = structuredClone(story);
      const plain = presentStory(story, match, "plain"),
        analysis = presentStory(story, match, "analysis");
      expect(plain.headline).not.toBe(analysis.headline);
      expect(plain.explanation).toContain("4");
      expect(analysis.explanation).toContain("4");
      expect(plain.explanation).toContain("0");
      expect(analysis.explanation).toContain("45:00–54:12");
      expect(analysis.explanation).toContain("54:12–63:24");
      expect(plain.explanation).toContain("9 min 12 sec");
      expect(plain.qualifications.map((q) => q.code)).toEqual(
        analysis.qualifications.map((q) => q.code),
      );
      const insight = matchInsights(match, 3804).find(
        (i) => i.category === (metric === "shots" ? "chances" : "pressure"),
      )!;
      expect(presentInsight(insight, match, "plain").headline).toBe(
        plain.headline,
      );
      expect(presentInsight(insight, match, "analysis").qualifications).toEqual(
        analysis.qualifications,
      );
      expect(story).toEqual(original);
      if (metric !== "shots") {
        expect(plain.explanation).toContain("near the opponent’s goal");
        expect(analysis.explanation).toContain("attacking third");
        expect(plain.why).toContain("do not guarantee a shot");
        expect(analysis.why).toContain("do not establish pressing intensity");
      }
    }
  });
  it("gives fans named contributions only from the verified current sample", () => {
    const story = storyAt(match, 3804);
    const original = structuredClone(story);
    const current = story.hypothesis.measurements.find(
      (m) => m.key === "current-count",
    )!;
    const ids = new Set(current.eventIds);
    const events = match.events.filter((e) => ids.has(e.id));
    const actor = events[0].actorId!;
    const name = match.players.find((p) => p.id === actor)!.name;
    const count = events.filter((e) => e.actorId === actor).length;
    const fan = presentStory(story, match, "fan");
    const plain = presentStory(story, match, "plain");
    const advanced = presentStory(story, match, "analysis");
    expect(fan.explanation).toContain(`${name} contributed ${count} shot`);
    expect(fan.explanation).toContain("stepped up from 0 to 4 shots");
    expect(plain.explanation).not.toContain("contributed");
    expect(advanced.explanation).toContain("Equal 9 min 12 sec windows");
    expect(
      new Set([plain.explanation, fan.explanation, advanced.explanation]).size,
    ).toBe(3);
    expect(fan.qualifications).toEqual(plain.qualifications);
    expect(story).toEqual(original);
    // An unrelated future event by the same player must not change their count.
    const future = { ...events[0], id: "future-contribution", time: 5000 };
    expect(
      presentStory(
        story,
        { ...match, events: [...match.events, future] },
        "fan",
      ),
    ).toEqual(fan);
    const missingActors = {
      ...match,
      events: match.events.map((e) =>
        ids.has(e.id) ? { ...e, actorId: null } : e,
      ),
    };
    expect(presentStory(story, missingActors, "fan").explanation).not.toContain(
      "contributed",
    );
  });
  it("keeps lower aggregate chance quality explicit in both styles, with an explained statistic", () => {
    // Diagnostic source fixture: same valid event identities, complete supplied xG.
    const m = structuredClone(match);
    const time = [1200, 1800, 2400, 3900, 4200, 4500].find((t) =>
      observe(m, t).some(
        (c) =>
          c.category === "activity-change" &&
          c.statistics[0].label === "shots" &&
          c.statistics[1].value > 0,
      ),
    )!;
    expect(time).toBeDefined();
    const initial = storyAt(m, time);
    const current = initial.hypothesis.windows.find((w) => w.id === "current")!;
    m.capabilities.xg = true;
    for (const e of m.events.filter((e) => e.type === "shot"))
      e.xg = e.time > current.start ? 0.001 : 0.9;
    const story = storyAt(m, time);
    for (const style of styles) {
      const wording = presentStory(story, m, style);
      expect(
        wording.qualifications.some(
          (q) => q.code === "shot-volume-without-xg-increase",
        ),
      ).toBe(true);
      expect(wording.qualifications.map((q) => q.code)).toEqual(
        expect.arrayContaining(
          story.hypothesis.contradictoryEvidence.map((e) => e.code),
        ),
      );
      const recap = buildBriefing(m, time, { style, stories: [story] });
      expect(recap.qualifications.join(" ")).toMatch(
        /not meant better|total source xG did not/,
      );
    }
    expect(
      presentStory(story, m, "plain").qualifications.find(
        (q) => q.code === "shot-volume-without-xg-increase",
      )!.text,
    ).toContain("Expected goals estimates how likely shots are to score");
  });
  it("keeps a verified dense recorded passing comparison without changing Director's evidence cap", async () => {
    const m = await loadHistorical("2499719");
    const insight = matchInsights(m, 1800).find(
      (i) => i.category === "rhythm",
    )!;
    expect(insight.evidenceIds.length + insight.baselineIds.length).toBe(236);
    expect(
      observe(m, 1800, "analyst", {}, { unranked: true }).some(
        (c) => c.statistics[0]?.label === "pass attempts",
      ),
    ).toBe(false);
    for (const style of styles) {
      const wording = presentInsight(insight, m, style);
      expect(wording.explanation).toContain("153");
      expect(wording.explanation).toContain("83");
      expect(wording.qualifications[0].code).toBe("latest-rate-not-sustained");
      expect(wording.qualifications[0].text).toContain("67");
      expect(wording.qualifications[0].text).toContain("86");
      expect(
        presentInsight(
          { ...insight, evidenceIds: insight.evidenceIds.slice(1) },
          m,
          style,
        ).explanation,
      ).toContain("needs a fresh evidence check");
    }
    expect(presentInsight(insight, m, "analysis").explanation).toContain(
      "00:00–15:00",
    );
  });
  it("retains weakening and unknown counter-evidence in the primary wording", () => {
    const story = storyAt(match, 4200);
    story.hypothesis.contradictoryEvidence.push({
      code: "new-counter-fact",
      description: "A new verified qualification.",
      eventIds: [],
    });
    for (const style of styles) {
      const wording = presentStory(story, match, style);
      expect(wording.headline).toContain("has eased");
      expect(wording.qualifications.map((q) => q.code)).toContain(
        "latest-rate-not-sustained",
      );
      expect(wording.qualifications.map((q) => q.text)).toContain(
        "A new verified qualification.",
      );
    }
  });
  it("distinguishes missing xG from incomplete xG without inventing a quality result", () => {
    for (const completeCapability of [false, true]) {
      const m = structuredClone(match);
      m.capabilities.xg = completeCapability;
      for (const e of m.events) delete e.xg;
      const story = storyAt(m, 3804);
      for (const style of styles) {
        const q = hypothesisQualifications(story.hypothesis, style);
        expect(q.map((q) => q.code)).toContain(
          completeCapability
            ? "chance-quality-incomplete"
            : "chance-quality-unavailable",
        );
        expect(q.map((q) => q.code)).not.toContain(
          "shot-volume-without-xg-increase",
        );
      }
    }
  });
  it("keeps goal priority, quiet restraint, score and replay grounding in both recaps", () => {
    for (const scenario of ["pressure", "quiet", "substitution"] as const) {
      const m = source.read(scenario);
      for (const time of [0, 60, 1200, 1800, 3804, 4200, 4500, m.duration]) {
        const plain = buildBriefing(m, time, { style: "plain" });
        for (const style of ["fan", "analysis"] as const) {
          const analysis = buildBriefing(m, time, { style });
          for (const key of [
            "score",
            "cutoff",
            "since",
            "metrics",
            "moments",
            "stories",
            "evidenceIds",
          ] as const)
            expect(analysis[key]).toEqual(plain[key]);
        }
        for (const candidate of observe(m, time, "analyst")) {
          const story = packageStory(candidate, m, time, "analyst", "offline");
          for (const style of styles) {
            const view = presentStory(story, m, style);
            expect(JSON.stringify(view)).not.toMatch(/undefined|NaN/);
            expect(
              presentStory(
                story,
                {
                  ...m,
                  finalScore: { harbor: 99, riverside: 99 },
                  events: m.events.filter((e) => e.time <= time),
                },
                style,
              ),
            ).toEqual(view);
          }
        }
      }
    }
    expect(
      selectLeadCandidate(observe(source.read("quiet"), 3804)),
    ).toBeUndefined();
    for (const style of styles) {
      const lead = selectLeadCandidate(observe(match, 60))!;
      expect(
        presentStory(
          packageStory(lead, match, 60, "analyst", "offline"),
          match,
          style,
        ).headline,
      ).toContain("Goal:");
    }
  });
  it("keeps approximate recorded substitution times in both styles, facts, evidence and cutoff", async () => {
    const m = await loadHistorical("2499719");
    const sub = observe(m, m.duration).find(
      (c) =>
        c.category === "substitute-involvement" &&
        c.headline.includes("D. Gray"),
    )!;
    const story = packageStory(sub, m, m.duration, "analyst", "offline");
    for (const style of styles) {
      const wording = presentStory(story, m, style);
      expect(wording.explanation).toContain("~88′");
      expect(wording.explanation).not.toContain("89:00");
      expect(wording.qualifications.map((q) => q.code)).toContain(
        "minute-precision",
      );
    }
    const event = m.events.find((e) => e.id === story.highlightedEventIds[0])!;
    expect(observe(m, event.time - 1).some((c) => c.id === sub.id)).toBe(false);
  });
  it("renders a verified exploratory investigation in both styles without losing its selected sample", () => {
    const session = createInvestigation(match, 4200, "analyst");
    const result = session.execute("compare_time_windows", {
      matchId: match.id,
      start: 3450,
      end: 4200,
      team: "harbor",
      playerId: null,
      eventId: null,
    });
    const claim = result.claims.find(
      (c) =>
        c.category === "window-comparison" &&
        c.statistics[0].label === "Current shots",
    )!;
    const story = packageStory(claim, match, 4200, "analyst", "offline");
    for (const style of styles) {
      const b = buildBriefing(match, 4200, { style, stories: [story] });
      expect(b.stories[0].storyId).toBe(claim.id);
      expect(b.metrics[0].currentLabel).toBe("57:30–70:00");
      expect(b.evidenceIds).toEqual(
        expect.arrayContaining(story.evidenceEventIds),
      );
    }
  });
  it("keeps an exploratory player's identity at full time and labels an earlier sample", () => {
    const session = createInvestigation(match, 5400, "analyst");
    const result = session.execute("compare_time_windows", {
      matchId: match.id,
      start: 3900,
      end: 4800,
      team: "harbor",
      playerId: "harbor-6",
      eventId: null,
    });
    const claim = result.claims.find(
      (c) => c.category === "window-comparison",
    )!;
    const story = packageStory(claim, match, 5400, "analyst", "offline");
    expect(story.hypothesis.watchNext).toBeNull();
    for (const style of styles) {
      const text = presentStory(story, match, style);
      expect(text.headline).toContain("Milo Serrano's earlier");
      expect(text.explanation).toContain("Milo Serrano");
      expect(text.explanation).toContain("65:00–80:00");
    }
  });
});
