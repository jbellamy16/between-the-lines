"use client";
import { ModalHeader } from "./modal-header";
import { RecapBriefing } from "./recap-briefing";
import { useViewingPosition } from "./use-viewing-position";
import { trapDialogFocus } from "./dialog-focus";
import { DirectorStory } from "./director-story";
import type { Provenance } from "@/lib/ai/service";
import type { Narrative } from "@/lib/foundry";
import { ANALYSIS_MODE, rankInsights } from "@/lib/intelligence";
import { type Fixture } from "@/lib/sources/catalog";
import {
  eventDescription,
  historicalEvidence,
  historicalInsights,
  historicalSequence,
} from "@/lib/sources/intelligence";
import {
  matchClock,
  periodAt,
  validateMatch,
  type MatchData,
  type NormalizedEvent,
} from "@/lib/sources/model";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppearance } from "./appearance";
import { EvidenceReplay } from "./evidence-replay";
import { ArrowRight, Play } from "./icons";
import { InsightNotice } from "./insight-notice";
import { MatchPeople } from "./match-people";
import {
  InsightDetails,
  InsightOverview,
  MatchContext,
  MatchEventFeed,
  MatchHeader,
  MatchPitch,
} from "./match-presentation";
import { MatchSettings, useMatchPreferences } from "./match-settings";
import { MatchShell, type SectionProps } from "./match-shell";
import { MatchStatistics } from "./match-statistics";
import { AnimatedDetails, usePageVisibility } from "./motion";
import { providerLabel } from "./provenance";
import { useMatchPlayback } from "./use-match-playback";

export function HistoricalApp({
  sourceSelector,
  fixtures,
  section,
  setSection,
  active,
}: {
  sourceSelector: ReactNode;
  fixtures: readonly Fixture[];
} & SectionProps) {
  useAppearance();
  const [settings, setSettings] = useState(false);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const [prefs, setPrefs] = useMatchPreferences();
  useEffect(() => {
    if (settings && active) settingsDialog.current?.showModal();
    else settingsDialog.current?.close();
  }, [settings, active]);
  useEffect(() => {
    if (!active) setSettings(false);
  }, [active]);
  const [id, setId] = useState<string>(fixtures[0].id);
  const [match, setMatch] = useState<MatchData | null>(null),
    [error, setError] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  useEffect(() => {
    if (active) window.scrollTo({ top: 0, behavior: "instant" });
  }, [section, active]);
  useEffect(() => {
    const controller = new AbortController();
    setMatch(null);
    setError("");
    fetch(`/api/historical/${id}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("Match unavailable");
        return r.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setMatch(validateMatch(data));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "The recorded match could not be loaded. Choose another match or try again.",
          );
      });
    return () => controller.abort();
  }, [id]);
  return (
    <MatchShell
      historical
      section={section}
      setSection={setSection}
      onSettings={() => setSettings(true)}
      dialog={
        <dialog
          ref={settingsDialog}
          className="modal"
          aria-label="Settings"
          onCancel={() => setSettings(false)}
        >
          <ModalHeader title="Settings" onClose={() => setSettings(false)} />
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={spoilers}
              onChange={(e) => setSpoilers(e.target.checked)}
            />
            Reveal final score
          </label>
          {spoilers && match?.id === id && (
            <p data-testid="final-score">
              Final score: {match.teams.harbor.name} {match.finalScore.harbor}–
              {match.finalScore.riverside} {match.teams.riverside.name}
            </p>
          )}
          {match ? (
            <MatchSettings
              match={match}
              prefs={prefs}
              setPrefs={setPrefs}
              onClose={() => setSettings(false)}
            />
          ) : (
            <p>Loading match preferences…</p>
          )}
        </dialog>
      }
    >
      <div className="fixture-selector">
        {sourceSelector}
        <select
          aria-label="Fixture"
          value={id}
          onChange={(e) => {
            setSpoilers(false);
            setId(e.target.value);
          }}
        >
          {fixtures.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} · {m.date}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : match?.id === id ? (
        <HistoricalReplay
          key={match.id}
          match={match}
          section={section}
          setSection={setSection}
          active={active && !settings}
        />
      ) : (
        <p role="status">Loading recorded events…</p>
      )}
    </MatchShell>
  );
}
function HistoricalReplay({
  match,
  section,
  setSection,
  active: sourceActive,
}: { match: MatchData } & SectionProps) {
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(8);
  const [prefs, setPrefs] = useMatchPreferences();
  const mode = ANALYSIS_MODE;
  const [detailTab, setDetailTab] = useState<
    "visual" | "evidence" | "explanation"
  >("visual");
  const [focusedPlayer, setFocusedPlayer] = useState(match.players[0].id);
  const [selected, setSelected] = useState<string | null>(null),
    [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  const [sequence, setSequence] = useState(false),
    [playerFilter, setPlayerFilter] = useState("");
  const [provider, setProvider] = useState("offline"),
    [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<{
    narrative: Narrative | null;
    provenance: Provenance;
    notice?: string;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [recapOpen, setRecapOpen] = useState(false);
  const viewing = useViewingPosition(match, time, sourceActive, recapOpen);
  const dialog = useRef<HTMLDialogElement>(null),
    request = useRef<AbortController | null>(null);
  const visiblePage = usePageVisibility();
  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((x) => setProvider(x.mode))
      .catch(() => {});
    return () => request.current?.abort();
  }, []);
  useMatchPlayback(
    time,
    setTime,
    playing && visiblePage && sourceActive && !recapOpen,
    speed,
    match.duration,
  );
  useEffect(() => {
    if (!sourceActive) {
      setPlaying(false);
      setRecapOpen(false);
    }
  }, [sourceActive]);
  useEffect(() => {
    if (time >= match.duration) setPlaying(false);
  }, [time, match.duration]);
  useEffect(() => {
    if (recapOpen) {
      dialog.current?.showModal();
      const overflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = overflow;
      };
    } else dialog.current?.close();
  }, [recapOpen]);
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    if (answer) setAnswer(null);
    if (notice) setNotice("");
    if (loading) setLoading(false);
  }, [time, mode, sourceActive]);
  const visible = useMemo(
    () => match.events.filter((e) => e.time <= time),
    [match, time],
  );
  const insights = useMemo(
    () =>
      rankInsights(historicalInsights(match, time), visible, mode, prefs).map(
        (r) => r.insight,
      ),
    [match, time, visible, mode, prefs],
  );
  const insight =
    insights.find((i) => `${i.team}-${i.category}` === selectedInsight) ??
    insights[0];
  const filteredVisible = visible.filter(
    (e) => !playerFilter || e.playerId === playerFilter,
  );
  const active =
    filteredVisible.find((e) => e.id === selected) ?? filteredVisible.at(-1);
  const passage = active ? historicalSequence(match, active, time) : [];
  const recent = filteredVisible
    .filter((e) => e.period === periodAt(match, time).id && e.time >= time - 60)
    .slice(-10);
  const viewEvents = sequence
    ? passage
    : selectedInsight && insight
      ? visible.filter((e) => insight.evidenceIds.includes(e.id))
      : recent;
  const inspector =
    viewEvents.find((e) => e.id === selected) ?? viewEvents.at(-1);
  const identities = {
    teams: match.teams,
    player: (id: string) =>
      match.players.find((p) => p.id === id) ?? {
        name: "Unidentified player",
        number: null,
      },
  };
  const insightPacket = useMemo(
    () => (insight ? historicalEvidence(match, time, mode, insight.id) : null),
    [match, time, mode, insight],
  );
  function invalidate() {
    request.current?.abort();
    setAnswer(null);
    setNotice("");
    setLoading(false);
  }
  function seek(value: number) {
    invalidate();
    setTime(Math.min(match.duration, Math.max(0, value)));
    setPlaying(false);
    setSelected(null);
    setSequence(false);
    setSelectedInsight(null);
  }
  function choose(event: NormalizedEvent) {
    invalidate();
    setPlaying(false);
    setSelected(event.id);
    setSequence(true);
    setSelectedInsight(null);
    setPlayerFilter("");
    setSection("match");
  }
  async function narrate() {
    if (loading) return;
    setDetailTab("explanation");
    invalidate();
    setPlaying(false);
    setLoading(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const res = await fetch("/api/historical/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          matchId: match.id,
          time,
          mode,
          ...(insight ? { insightId: insight.id } : {}),
        }),
      });
      if (!res.ok) throw new Error("Narration unavailable");
      const result = await res.json();
      if (!controller.signal.aborted) {
        setAnswer(result);
        setNotice(result.notice ?? "");
      }
    } catch {
      if (!controller.signal.aborted)
        setNotice(
          "The explanation could not be loaded. Verified event intelligence remains available.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  function selectObservation(i: (typeof insights)[number]) {
    invalidate();
    setPlaying(false);
    setSelectedInsight(`${i.team}-${i.category}`);
    setPlayerFilter("");
    setSequence(false);
    setSelected(null);
    setDetailTab("visual");
    setSection("match");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const empty = (
    <MatchContext
      match={match}
      time={time}
      onEvent={(id) => {
        const e = visible.find((e) => e.id === id);
        if (e) {
          choose(e);
          setSection("match");
        }
      }}
    />
  );
  const answerPanel = () => (
    <>
      <button className="narrate-button" disabled={loading} onClick={narrate}>
        {loading
          ? "Checking the evidence…"
          : provider === "offline"
            ? "Explore the explanation"
            : `Explain with ${providerLabel(provider)}`}
      </button>
      {notice && <p role="status">{notice}</p>}
      {
        <AnimatedDetails className="provenance">
          <summary>How Between the Lines knows</summary>
          <div
            className="provenance-content"
            tabIndex={0}
            aria-label="Explanation evidence and limitations"
          >
            <p className="historical-provider">
              {answer
                ? providerLabel(answer.provenance.provider)
                : "Deterministic offline"}
              {answer?.provenance.model ? ` · ${answer.provenance.model}` : ""}.
              {answer?.provenance.cached ? " Reused a validated response." : ""}{" "}
              AI runs only when requested.
            </p>
            <h3>Measurement notes</h3>
            <p>
              Two equal 15-minute windows within the same half. Descriptive
              thresholds, not statistical confidence. Event counts do not
              establish tactical cause or off-ball movement.
            </p>
            <p>
              Evidence through{" "}
              {matchClock(match, answer?.provenance.cutoff ?? time)}. AI selects
              verified wording; it cannot invent claims.
            </p>
            {(answer?.provenance.facts ?? insightPacket?.facts ?? []).map(
              (f) => (
                <p key={f.id}>{f.text}</p>
              ),
            )}
            <ul>
              {(
                answer?.provenance.validation ?? [
                  "Events filtered at playback timestamp",
                ]
              ).map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <p>
              {answer?.provenance.activity.join(" · ") ||
                "No completed AI tool activity."}
            </p>
          </div>
        </AnimatedDetails>
      }
    </>
  );
  return (
    <>
      <MatchHeader
        match={match}
        time={time}
        playing={playing}
        speed={speed}
        onSpeed={setSpeed}
        onSeek={seek}
        onPlay={() => {
          invalidate();
          setSelected(null);
          setSequence(false);
          setSelectedInsight(null);
          if (time >= match.duration) setTime(0);
          setPlaying(!playing);
        }}
        onRecap={() => {
          invalidate();
          setPlaying(false);
          setRecapOpen(true);
        }}
      />
      <InsightNotice
        insights={insights}
        playing={playing}
        onSelect={(i) => {
          invalidate();
          setPlaying(false);
          setSelectedInsight(`${i.team}-${i.category}`);
          setPlayerFilter("");
          setSection("match");
          setSelected(null);
          setSequence(false);
        }}
      />
      <div className="match-grid section-enter" hidden={section !== "match"}>
        <div className="match-left">
          <MatchPitch
            match={match}
            time={time}
            events={viewEvents}
            selected={inspector?.id}
            onSelect={(id) => {
              const e = visible.find((e) => e.id === id);
              if (e) choose(e);
            }}
            view={sequence ? "passage" : selectedInsight ? "pattern" : "recent"}
            hasPattern={!!insight}
            hasPassage={!!active}
            onView={(view) => {
              invalidate();
              setPlaying(false);
              setSelected(null);
              setSequence(view === "passage");
              setSelectedInsight(
                view === "pattern" && insight
                  ? `${insight.team}-${insight.category}`
                  : null,
              );
              setPlayerFilter("");
            }}
            onClear={() => {
              setSequence(false);
              setSelected(null);
              setSelectedInsight(
                insight ? `${insight.team}-${insight.category}` : null,
              );
            }}
            onSeek={seek}
            replay={
              sequence && passage.length ? (
                <EvidenceReplay
                  key={`${match.id}-${active?.id}`}
                  events={passage}
                  suspended={!sourceActive || recapOpen || section !== "match"}
                  identities={identities}
                  formatTime={(t) => matchClock(match, t)}
                  describe={(e) =>
                    eventDescription(match, e as NormalizedEvent)
                  }
                  generated={false}
                />
              ) : undefined
            }
          />
          <MatchEventFeed
            match={match}
            time={time}
            onEvent={(id) => {
              const e = visible.find((e) => e.id === id);
              if (e) choose(e);
            }}
          />
        </div>
        <InsightDetails
          story={
            <DirectorStory
              key={match.id}
              match={match}
              time={time}
              mode={mode}
              preferences={prefs}
              active={sourceActive && !recapOpen && section === "match"}
              playing={playing}
              onExplore={() => setPlaying(false)}
            />
          }
          match={match}
          insight={insight}
          insights={insights}
          onSelect={selectObservation}
          mode={mode}
          onEvent={(id) => {
            const e = visible.find((e) => e.id === id);
            if (e) choose(e);
          }}
          onReplay={() => {
            const anchor =
              visible.find((e) => e.id === selected) ??
              visible.findLast((e) => insight?.evidenceIds.includes(e.id));
            if (anchor) choose(anchor);
          }}
          tab={detailTab}
          onTab={setDetailTab}
          empty={empty}
          explanation={
            <>
              <p className="explanation-text">
                {answer?.narrative?.explanation ?? insight?.explanation}
              </p>
              <p>{answer?.narrative?.why ?? insight?.why}</p>
              <p>{answer?.narrative?.watch ?? insight?.watch}</p>
            </>
          }
        >
          {answerPanel()}
        </InsightDetails>
      </div>
      {section === "insights" && (
        <InsightOverview
          match={match}
          insights={insights}
          onSelect={selectObservation}
          mode={mode}
          empty={empty}
        />
      )}
      {section === "stats" && <MatchStatistics match={match} time={time} />}
      {(section === "players" || section === "lineups") && (
        <MatchPeople
          match={match}
          time={time}
          prefs={prefs}
          setPrefs={setPrefs}
          view={section}
          focusedPlayer={focusedPlayer}
          setFocusedPlayer={setFocusedPlayer}
          onFocus={(id) => {
            setFocusedPlayer(id);
            setSection("players");
          }}
          onEvent={(id) => {
            const e = visible.find((e) => e.id === id);
            if (e) choose(e);
          }}
        />
      )}
      <footer className="match-attribution">
        <AnimatedDetails>
          <summary>Source details · {match.provenance.provider}</summary>
          <p>
            <a
              href={match.sourceUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              {match.attribution}
            </a>
          </p>
          <p>
            Adapted event and match records ·{" "}
            <a
              href={match.provenance.licenseUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              {match.provenance.license}
            </a>
            . No endorsement implied.
          </p>
          {match.limitations.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </AnimatedDetails>
      </footer>
      <dialog
        ref={dialog}
        className="modal recap-modal"
        aria-label="Catch me up"
        onKeyDown={trapDialogFocus}
        aria-hidden={!recapOpen}
        inert={!recapOpen}
        onCancel={() => {
          invalidate();
          setRecapOpen(false);
        }}
      >
        <ModalHeader
          title="Catch me up"
          onClose={() => {
            invalidate();
            setRecapOpen(false);
          }}
        />
        {recapOpen && (
          <RecapBriefing
            key={`${match.id}-${time}`}
            match={match}
            time={time}
            since={viewing.since}
            preferences={prefs}
            provider={provider}
            onMoment={(id) => {
              const event = visible.find((e) => e.id === id);
              if (event) {
                choose(event);
                setRecapOpen(false);
              }
            }}
            onBack={() => {
              viewing.acknowledge(time);
              invalidate();
              setRecapOpen(false);
              setSection("match");
            }}
          />
        )}
      </dialog>
    </>
  );
}
