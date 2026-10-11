"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Category } from "@/lib/intelligence";
import type { TeamId } from "@/lib/match";
import type { MatchData } from "@/lib/sources/model";
import { useAppearance, type Appearance } from "./appearance";
import { ExplanationSelector } from "./explanation-preference";
import { Check } from "./icons";
export type MatchPreferences = {
  team: TeamId | "all";
  player: string;
  categories: Category[];
};
export const defaultPreferences: MatchPreferences = {
  team: "all",
  player: "",
  categories: ["pressure", "chances", "rhythm"],
};
const key = "second-look-preferences";
export function useMatchPreferences() {
  const [prefs, setPrefs] = useState<MatchPreferences>(defaultPreferences),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const read = (event?: Event) => {
      try {
        const p =
          event instanceof CustomEvent && event.detail
            ? event.detail
            : JSON.parse(localStorage.getItem(key) ?? "null");
        if (
          p &&
          ["all", "harbor", "riverside"].includes(p.team) &&
          typeof p.player === "string" &&
          Array.isArray(p.categories)
        )
          setPrefs({
            team: p.team,
            player: p.player,
            categories: p.categories.filter((c: string) =>
              ["pressure", "chances", "rhythm"].includes(c),
            ),
          });
      } catch {}
    };
    read();
    setReady(true);
    window.addEventListener("match-preferences", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("match-preferences", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  // Write only on a user change. Effects in multiple mounted sources must not
  // echo stale snapshots back into storage and trigger an update loop.
  function updatePrefs(next: MatchPreferences) {
    setPrefs(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(
      new CustomEvent("match-preferences", { detail: next }),
    );
  }
  return [prefs, updatePrefs, ready] as const;
}
export function MatchSettings({
  match,
  prefs,
  setPrefs,
  onClose,
  children,
}: {
  match: MatchData;
  prefs: MatchPreferences;
  setPrefs: (p: MatchPreferences) => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [appearance, setAppearance] = useAppearance();
  return (
    <>
      <p className="muted">Preferences are saved on this device.</p>
      <ExplanationSelector settings />
      <label className="setting-label appearance-setting">
        Appearance
        <select
          aria-label="Appearance"
          value={appearance}
          onChange={(e) => setAppearance(e.target.value as Appearance)}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label className="setting-label">
        Follow a team
        <select
          value={prefs.team}
          onChange={(e) =>
            setPrefs({
              ...prefs,
              team: e.target.value as MatchPreferences["team"],
            })
          }
        >
          <option value="all">Both sides (neutral)</option>
          {(["harbor", "riverside"] as const).map((t) => (
            <option key={t} value={t}>
              {match.teams[t].name}
            </option>
          ))}
        </select>
      </label>
      <label className="setting-label">
        Follow a player
        <select
          value={
            match.players.some((p) => p.id === prefs.player) ? prefs.player : ""
          }
          onChange={(e) => setPrefs({ ...prefs, player: e.target.value })}
        >
          <option value="">No preference</option>
          {match.players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Observations</legend>
        {(["pressure", "chances", "rhythm"] as const).map((c) => (
          <label key={c} className="checkbox-label">
            <input
              type="checkbox"
              checked={prefs.categories.includes(c)}
              disabled={c === "pressure" && !match.capabilities.ballRecoveries}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  categories: e.target.checked
                    ? [...prefs.categories, c]
                    : prefs.categories.filter((v) => v !== c),
                })
              }
            />
            {c.charAt(0).toUpperCase() + c.slice(1)}
            {c === "pressure" && !match.capabilities.ballRecoveries
              ? " · unavailable for this source"
              : ""}
          </label>
        ))}
      </fieldset>
      <p className="limitations">
        Team and player preferences prioritize observations.
      </p>
      {children}
      <button className="primary-button" onClick={onClose}>
        Save my experience <Check size={16} />
      </button>
    </>
  );
}
