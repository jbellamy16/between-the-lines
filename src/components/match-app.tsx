"use client";
import { DirectorStory } from "./director-story";
import { RecapBriefing } from "./recap-briefing";
import { trapDialogFocus } from "./dialog-focus";
import { useViewingPosition } from "./use-viewing-position";
import { buildEvidence } from "@/lib/ai/evidence";
import type { Provenance } from "@/lib/ai/service";
import type { Narrative } from "@/lib/foundry";
import { ANALYSIS_MODE, Insight, rankInsights } from "@/lib/intelligence";
import {
  DEMO_TIME,
  DURATION,
  eventsAt,
  MatchEvent,
  Scenario,
  SCENARIOS,
  sequenceFor,
} from "@/lib/match";
import { matchInsights } from "@/lib/sources/intelligence";
import { pitchEvents as toLegacyEvents } from "@/lib/sources/model";
import { SyntheticMatchSource } from "@/lib/sources/synthetic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "./appearance";
import { EvidenceReplay } from "./evidence-replay";
import { ArrowUpRight, Play, RotateCcw } from "./icons";
import { InsightNotice } from "./insight-notice";
import { ModalHeader } from "./modal-header";
import { MatchPeople } from "./match-people";
import {
  InsightDetails,
  InsightOverview,
  MatchContext,
  MatchEventFeed,
  MatchHeader,
  MatchPitch,
} from "./match-presentation";
import {
  defaultPreferences as defaultPrefs,
  MatchSettings,
  useMatchPreferences,
} from "./match-settings";
import {
  MatchShell,
  type PitchView,
  type MatchSection as Section,
  type SectionProps,
} from "./match-shell";
import { MatchStatistics } from "./match-statistics";
import { usePageVisibility } from "./motion";
import { ProvenanceDetails, providerLabel } from "./provenance";
import { useMatchPlayback } from "./use-match-playback";
export function MatchApp({
  sourceSelector,
  section,
  setSection,
  active,
}: { sourceSelector?: React.ReactNode } & SectionProps) {
  useAppearance();
  const [scenario, setScenario] = useState<Scenario>("pressure");
  const [profile, setProfile] = useState<"demo" | "balanced">("demo");
  const [time, setTime] = useState(DEMO_TIME),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(8);
  const [prefs, setPrefs, ready] = useMatchPreferences();
  const [pitchView, setPitchView] = useState<PitchView>("pattern");
  const [modal, setModal] = useState<"recap" | "settings" | "about" | null>(
    null,
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null),
    [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [tab, setTab] = useState<"visual" | "evidence" | "explanation">(
    "visual",
  );
  const [replay, setReplay] = useState<{
    ids: string[];
    version: number;
  } | null>(null);
  const [provider, setProvider] = useState("offline"),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState("");
  const [narrative, setNarrative] = useState<{
    key: string;
    value: Narrative;
    provenance: Provenance;
  } | null>(null);
  const [seenEvidenceIds, setSeenEvidenceIds] = useState<string[]>([]);
  const [focusedPlayer, setFocusedPlayer] = useState("harbor-9");
  const requestVersion = useRef(0);
  const narrationRequest = useRef<AbortController | null>(null);
  const visiblePage = usePageVisibility();
  const canonicalMatch = useMemo(
    () => new SyntheticMatchSource().read(scenario, { profile }),
    [scenario, profile],
  );
  const events = useMemo(
    () => toLegacyEvents(canonicalMatch.events),
    [canonicalMatch],
  );
  const visible = useMemo(() => eventsAt(events, time), [events, time]);
  const allInsights = useMemo(
    () => matchInsights(canonicalMatch, time),
    [canonicalMatch, time],
  );
  const insights = useMemo(
    () =>
      rankInsights(allInsights, visible, ANALYSIS_MODE, {
        ...prefs,
        seenEvidenceIds,
      }).map((r) => r.insight),
    [allInsights, prefs, visible, seenEvidenceIds],
  );
  const insight =
    insights.find((i) => `${i.team}-${i.category}` === selectedKey) ??
    insights[0];
  const evidence = insight
    ? visible.filter((e) => insight.evidenceIds.includes(e.id))
    : [];
  const event = visible.find((e) => e.id === selectedEvent);
  const latest = visible
    .filter((e) => !["possession", "substitution"].includes(e.type))
    .at(-1);
  const sequence = event
    ? visible.filter(
        (e) =>
          e.possessionId === event.possessionId &&
          !["possession", "substitution"].includes(e.type),
      )
    : latest
      ? sequenceFor(visible, latest)
      : [];
  const pitchEvents =
    playing || pitchView === "recent"
      ? visible
          .filter(
            (e) =>
              !["possession", "substitution"].includes(e.type) &&
              e.time >= Math.max(time - 60, time < 2700 ? 0 : 2700),
          )
          .slice(-10)
      : event
        ? sequence
        : insight
          ? evidence
          : sequence;
  const activePitchEvent =
    playing || pitchView === "recent" ? pitchEvents.at(-1) : event;
  const replayEvents = replay
    ? visible.filter((e) => replay.ids.includes(e.id))
    : [];
  const displayKey = `${scenario}-${profile}-${time}-${ANALYSIS_MODE}-${insight?.id}`;
  const currentNarrative =
    narrative?.key === displayKey ? narrative.value : null;
  const context = (
    <MatchContext
      match={canonicalMatch}
      time={time}
      onEvent={(id) => {
        const e = visible.find((e) => e.id === id);
        if (e) {
          selectEvent(e);
          setSection("match");
        }
      }}
    />
  );
  const viewing = useViewingPosition(
    canonicalMatch,
    time,
    active,
    modal !== null,
  );
  function computedProvenance(selected?: Insight): Provenance {
    const packet = buildEvidence(
      visible,
      time,
      ANALYSIS_MODE,
      { ...prefs, seenEvidenceIds },
      selected,
    );
    return {
      provider: "offline",
      cached: false,
      cutoff: time,
      activity: [],
      validation: [
        "Events filtered at viewer timestamp",
        "Comparisons computed from recorded events",
      ],
      limitations: packet.limitations,
      facts: packet.facts,
    };
  }
  const dialogRef = useRef<HTMLDialogElement>(null);
  const retainedModal = useRef(modal);
  if (modal) retainedModal.current = modal;
  const dialogContent = modal ?? retainedModal.current;
  const scrollPositions = useRef<Partial<Record<Section, number>>>({});
  const previousSection = useRef(section);
  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) =>
        setProvider(
          ["foundry", "openai"].includes(d.mode) ? d.mode : "offline",
        ),
      )
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!active) {
      setPlaying(false);
      setModal(null);
    }
  }, [active]);
  useMatchPlayback(
    time,
    setTime,
    playing && visiblePage && active,
    speed,
    DURATION,
    true,
  );
  useEffect(() => {
    if (time >= DURATION || !visiblePage) setPlaying(false);
  }, [time, visiblePage]);
  useEffect(() => {
    if (modal) {
      setPlaying(false);
      dialogRef.current?.showModal();
      const overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = overflow;
      };
    } else dialogRef.current?.close();
  }, [modal]);
  useEffect(() => {
    requestVersion.current++;
    narrationRequest.current?.abort();
    setNotice("");
    setLoading(false);
  }, [displayKey]);
  useEffect(() => {
    if (!active) return;
    window.scrollTo({
      top: scrollPositions.current[section] ?? 0,
      behavior: "instant",
    });
    previousSection.current = section;
    const remember = () => {
      scrollPositions.current[previousSection.current] = window.scrollY;
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [section, active]);
  function seek(t: number) {
    setTime(t);
    setPlaying(false);
    setSelectedEvent(null);
    setReplay(null);
    setNarrative(null);
    setPitchView("recent");
  }
  function selectInsight(i: Insight) {
    if (insight)
      setSeenEvidenceIds((seen) =>
        [...new Set([...seen, ...insight.evidenceIds])].slice(-200),
      );
    setPitchView("pattern");
    setSelectedKey(`${i.team}-${i.category}`);
    setSelectedEvent(null);
    setReplay(null);
    setPlaying(false);
    setTab("visual");
    setSection("match");
    requestAnimationFrame(() =>
      document
        .querySelector(".app-shell:not([hidden]) .match-header")
        ?.scrollIntoView({ block: "start" }),
    );
  }
  function selectEvent(e: MatchEvent) {
    setPitchView("passage");
    if (e.type === "substitution") {
      setFocusedPlayer(e.playerId);
      setSection("players");
    }
    setSelectedEvent(e.id);
    setPlaying(false);
    const ids = visible
      .filter(
        (v) =>
          v.possessionId === e.possessionId &&
          !["possession", "substitution"].includes(v.type),
      )
      .map((v) => v.id);
    setReplay(ids.length ? { ids, version: performance.now() } : null);
  }
  function changeScenario(s: Scenario) {
    setScenario(s);
    setSeenEvidenceIds([]);
    seek(DEMO_TIME);
    setPlaying(false);
    setSelectedKey(null);
    setPitchView("pattern");
  }
  function replayEvidence() {
    setPitchView("passage");
    const anchor = event ?? evidence.at(-1) ?? latest;
    if (!anchor) return;
    // Include the rest of this possession only if already observed at the current timestamp.
    const ids = visible
      .filter(
        (e) =>
          e.possessionId === anchor.possessionId &&
          !["possession", "substitution"].includes(e.type),
      )
      .map((e) => e.id);
    setPlaying(false);
    setSelectedEvent(ids.at(-1) ?? anchor.id);
    setReplay({ ids, version: performance.now() });
    document.querySelector(".pitch-panel")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    });
  }
  async function explain() {
    if (!insight || loading) return;
    setPlaying(false);
    setLoading(true);
    setNotice("");
    const version = ++requestVersion.current;
    narrationRequest.current?.abort();
    const controller = new AbortController();
    narrationRequest.current = controller;
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          profile,
          time: Math.floor(time),
          mode: ANALYSIS_MODE,
          team: insight.team,
          category: insight.category,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      if (version !== requestVersion.current) return;
      if (["foundry", "openai"].includes(data.source) && data.narrative)
        setNarrative({
          key: displayKey,
          value: data.narrative,
          provenance: data.provenance,
        });
      setNotice(
        data.notice ??
          (data.source === "offline"
            ? "Offline demo. This explanation comes from verified event rules."
            : ""),
      );
      setTab("explanation");
    } catch {
      if (version === requestVersion.current)
        setNotice(
          "Narration is unavailable. The verified explanation is still here.",
        );
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }
  return (
    <MatchShell
      section={section}
      setSection={setSection}
      onSettings={() => setModal("settings")}
      ready={ready}
      dialog={
        <dialog
          ref={dialogRef}
          aria-label={
            dialogContent === "recap"
              ? "Catch me up"
              : dialogContent === "settings"
                ? "Settings"
                : "About Between the Lines"
          }
          className={`modal ${dialogContent === "recap" ? "recap-modal" : ""}`}
          onKeyDown={trapDialogFocus}
          onCancel={(e) => {
            e.preventDefault();
            setModal(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const rect = e.currentTarget.getBoundingClientRect();
              if (
                e.clientX < rect.left ||
                e.clientX > rect.right ||
                e.clientY < rect.top ||
                e.clientY > rect.bottom
              )
                setModal(null);
            }
          }}
        >
          <ModalHeader
            title={
              dialogContent === "recap"
                ? "Catch me up"
                : dialogContent === "settings"
                  ? "Settings"
                  : "About Between the Lines"
            }
            onClose={() => setModal(null)}
          />
          {dialogContent === "recap" ? (
            modal === "recap" && (
              <RecapBriefing
                key={`${canonicalMatch.id}-${time}`}
                match={canonicalMatch}
                time={time}
                since={viewing.since}
                preferences={{
                  team: prefs.team,
                  player: prefs.player,
                  categories: prefs.categories,
                  seenEvidenceIds,
                }}
                provider={provider}
                onMoment={(id) => {
                  const event = visible.find((e) => e.id === id);
                  if (event) {
                    setModal(null);
                    selectEvent(event);
                    setSection(
                      event.type === "substitution" ? "players" : "match",
                    );
                  }
                }}
                onBack={() => {
                  viewing.acknowledge(time);
                  setModal(null);
                  setSection("match");
                }}
              />
            )
          ) : dialogContent === "settings" ? (
            <>
              <MatchSettings
                match={canonicalMatch}
                prefs={prefs}
                setPrefs={setPrefs}
                onClose={() => setModal(null)}
              >
                <section
                  className="demo-settings"
                  aria-labelledby="demo-settings-title"
                >
                  <h3 id="demo-settings-title">Demo controls</h3>
                  <div className="demo-settings-content">
                    <label className="setting-label">
                      <span>Generator profile</span>
                      <select
                        aria-label="Generator profile"
                        value={profile}
                        onChange={(e) => {
                          setProfile(e.target.value as "demo" | "balanced");
                          setSeenEvidenceIds([]);
                          setSelectedKey(null);
                          seek(DEMO_TIME);
                          setPitchView("pattern");
                        }}
                      >
                        <option value="demo">Curated demo (default)</option>
                        <option value="balanced">
                          Balanced (experimental)
                        </option>
                      </select>
                    </label>
                    <p className="limitations">
                      {profile === "demo"
                        ? "Fictional teams and generated match events."
                        : "An experimental generator with broader passing and faster pacing. Not a validated realism model."}
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setScenario("pressure");
                        seek(60 * 60);
                        setSelectedKey(null);
                        setPrefs(defaultPrefs);
                        setSeenEvidenceIds([]);
                        setTab("visual");
                        setSpeed(16);
                        setPlaying(true);
                        setSection("match");
                        setModal(null);
                      }}
                    >
                      <Play size={16} /> Watch the build-up
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        changeScenario("pressure");
                        setPrefs(defaultPrefs);
                        setSeenEvidenceIds([]);
                        setTab("visual");
                        setSpeed(8);
                        setSection("match");
                        setModal(null);
                      }}
                    >
                      Reset demo <RotateCcw size={16} />
                    </button>
                  </div>
                </section>
              </MatchSettings>
              <button
                className="text-button about-settings"
                onClick={() => setModal("about")}
              >
                About Between the Lines <ArrowUpRight size={16} />
              </button>
            </>
          ) : (
            <>
              <h3 className="brand-headline">More than the score.</h3>
              <p className="recap-summary">
                Football insights that go deeper. Between the Lines turns
                football events into stories you can inspect. Follow a pattern,
                see the evidence on the pitch, and understand why it might
                matter.
              </p>
              <div className="about-stages">
                {[
                  [
                    "01",
                    "Observe",
                    "Seeded synthetic events unfold on a single playback clock.",
                  ],
                  [
                    "02",
                    "Verify",
                    "Rules detect changes and calculate every statistic.",
                  ],
                  [
                    "03",
                    "Explain",
                    "Optional OpenAI or Microsoft Foundry narration retrieves verified evidence through a tool.",
                  ],
                  ["04", "Explore", "Trace a story back to recorded events."],
                ].map(([n, t, d]) => (
                  <div key={n}>
                    <span>{n}</span>
                    <div>
                      <strong>{t}</strong>
                      <p>{d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="limitations">
                {provider !== "offline"
                  ? `${providerLabel(provider)} is configured. Narration runs only when you request an explanation or AI recap.`
                  : "Currently in offline demo mode. Narratives and recaps are deterministic, not AI-generated."}{" "}
                Clubs and players are fictional. No broadcast footage, licensed
                football data, or continuous player tracking is used.
              </p>
              <p className="limitations">
                Icons by Tabler and Lucide. Club marks and additional football
                diagrams created for Between the Lines.{" "}
                <a
                  className="asset-license-link"
                  href="/icon-licenses.txt"
                  target="_blank"
                  rel="noreferrer"
                >
                  Icon licenses
                </a>
              </p>
            </>
          )}
        </dialog>
      }
    >
      <div className="fixture-selector">
        {sourceSelector}
        <select
          aria-label="Fixture"
          value={scenario}
          onChange={(e) => changeScenario(e.target.value as Scenario)}
        >
          {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
            <option key={s} value={s}>
              Harbor Athletic vs Riverside FC · {SCENARIOS[s].name}
            </option>
          ))}
        </select>
        <span className="synthetic-badge">Synthetic demo</span>
      </div>
      <InsightNotice
        key={scenario}
        insights={allInsights}
        playing={playing}
        onSelect={(i) => {
          setPlaying(false);
          setPitchView("pattern");
          setSelectedKey(`${i.team}-${i.category}`);
          setSelectedEvent(null);
          setReplay(null);
        }}
      />
      <MatchHeader
        match={canonicalMatch}
        time={time}
        playing={playing}
        speed={speed}
        onSpeed={setSpeed}
        onSeek={seek}
        onPlay={() => {
          if (time === DURATION) seek(0);
          setReplay(null);
          setSelectedEvent(null);
          setPitchView("recent");
          setPlaying(!playing);
        }}
        onRecap={() => {
          setPlaying(false);
          setModal("recap");
        }}
      />
      {
        <div className="match-grid section-enter" hidden={section !== "match"}>
          <div className="match-left">
            <MatchPitch
              match={canonicalMatch}
              time={time}
              events={canonicalMatch.events.filter((e) =>
                pitchEvents.some((p) => p.id === e.id),
              )}
              selected={activePitchEvent?.id}
              onSelect={(id) => {
                const e = visible.find((e) => e.id === id);
                if (e) selectEvent(e);
              }}
              view={
                replay || event ? "passage" : playing ? "recent" : pitchView
              }
              hasPattern={!!insight}
              hasPassage={!!latest}
              onView={(view) => {
                setPlaying(false);
                setSelectedEvent(null);
                setReplay(null);
                setPitchView(view);
                if (view === "passage") replayEvidence();
              }}
              onClear={() => {
                setSelectedEvent(null);
                setReplay(null);
                setPitchView("pattern");
              }}
              onSeek={seek}
              replay={
                replay && replayEvents.length ? (
                  <EvidenceReplay
                    key={replay.version}
                    events={replayEvents}
                    suspended={!!modal || section !== "match" || !active}
                  />
                ) : undefined
              }
            />
            <MatchEventFeed
              match={canonicalMatch}
              time={time}
              onEvent={(id) => {
                const e = visible.find((e) => e.id === id);
                if (e) selectEvent(e);
              }}
            />
          </div>
          <InsightDetails
            story={
              <DirectorStory
                key={canonicalMatch.id}
                match={canonicalMatch}
                time={time}
                mode={ANALYSIS_MODE}
                preferences={{
                  team: prefs.team,
                  player: prefs.player,
                  categories: prefs.categories,
                }}
                active={active && !modal && section === "match"}
                playing={playing}
                onExplore={() => setPlaying(false)}
              />
            }
            match={canonicalMatch}
            insight={insight}
            insights={insights}
            onSelect={selectInsight}
            mode={ANALYSIS_MODE}
            onEvent={(id) => {
              const e = visible.find((e) => e.id === id);
              if (e) selectEvent(e);
            }}
            onReplay={replayEvidence}
            tab={tab}
            onTab={setTab}
            empty={context}
            explanation={
              <>
                <p className="explanation-text">
                  {currentNarrative?.explanation ?? insight?.explanation}
                </p>
                <p>{currentNarrative?.why ?? insight?.why}</p>
                <p>{currentNarrative?.watch ?? insight?.watch}</p>
              </>
            }
          >
            <button
              className="narrate-button"
              disabled={loading}
              onClick={explain}
            >
              {loading
                ? "Checking evidence…"
                : provider !== "offline"
                  ? `Explain with ${providerLabel(provider)}`
                  : "Explore the explanation"}
            </button>
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            <ProvenanceDetails
              provenance={
                currentNarrative
                  ? narrative!.provenance
                  : computedProvenance(insight)
              }
              events={visible}
              insights={insight ? [insight] : []}
            />
          </InsightDetails>
        </div>
      }
      {section === "insights" && (
        <InsightOverview
          match={canonicalMatch}
          insights={insights}
          onSelect={selectInsight}
          mode={ANALYSIS_MODE}
          empty={context}
        />
      )}
      {section === "stats" && (
        <MatchStatistics match={canonicalMatch} time={time} />
      )}
      {(section === "players" || section === "lineups") && (
        <MatchPeople
          match={canonicalMatch}
          time={time}
          view={section}
          focusedPlayer={focusedPlayer}
          setFocusedPlayer={setFocusedPlayer}
          onFocus={(id) => {
            setFocusedPlayer(id);
            setSection("players");
          }}
          onEvent={(id) => {
            const e = visible.find((e) => e.id === id);
            if (e) {
              selectEvent(e);
              setSection("match");
            }
          }}
          prefs={prefs}
          setPrefs={setPrefs}
        />
      )}
    </MatchShell>
  );
}
