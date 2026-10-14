"use client";
import type { ReactNode } from "react";
import { BrandImage } from "./appearance";
import {
  BarChart3,
  FootballPitch,
  Formation,
  PlayerShirt,
  Settings2,
  Tactics,
} from "./icons";
import { SelectionGroup } from "./motion";
export const MATCH_NAV = [
  { id: "match", label: "Match centre", icon: FootballPitch },
  { id: "insights", label: "Insights", icon: Tactics },
  { id: "stats", label: "Match stats", icon: BarChart3 },
  { id: "lineups", label: "Lineups", icon: Formation },
  { id: "players", label: "Player focus", icon: PlayerShirt },
] as const;
export type MatchSection = (typeof MATCH_NAV)[number]["id"];
export type SectionProps = {
  section: MatchSection;
  setSection: (section: MatchSection) => void;
  active: boolean;
};
export function MatchShell({
  section,
  setSection,
  onSettings,
  children,
  dialog,
  historical = false,
  ready = true,
  nav = MATCH_NAV,
  frame = false,
  library,
}: {
  section: MatchSection;
  setSection: (section: MatchSection) => void;
  onSettings: () => void;
  children: ReactNode;
  dialog?: ReactNode;
  historical?: boolean;
  ready?: boolean;
  /** Same sections; an experience may relabel one (the demo's Moments). */
  nav?: readonly {
    id: MatchSection;
    label: string;
    icon: (typeof MATCH_NAV)[number]["icon"];
  }[];
  /**
   * Desktop app frame: fixed header and playback bar with three panels
   * between them (navigation, the section, the story and analyst).
   */
  frame?: boolean;
  /** Shown under the navigation in the desktop frame. */
  library?: ReactNode;
}) {
  return (
    <div
      className={`app-shell data-first ${historical ? "historical-shell" : ""} ${frame ? "frame" : ""}`}
      data-section={section}
      inert={!ready}
      aria-busy={!ready}
    >
      <aside className="sidebar" aria-label="Application navigation">
        <a href="/" className="brand" aria-label="Between the Lines home">
          <BrandImage className="brand-wordmark" />
          <BrandImage className="brand-symbol" symbol />
        </a>
        <SelectionGroup
          className="main-navigation"
          label="Main navigation"
          navigation
          value={section}
        >
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
              className={`nav-item ${section === id ? "active" : ""}`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </SelectionGroup>
        {library && <div className="sidebar-library">{library}</div>}
        <div className="sidebar-bottom">
          <button
            className="nav-item"
            aria-label="Settings"
            onClick={onSettings}
          >
            <Settings2 size={20} />
            Settings
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <a
            className="mobile-brand"
            href="/"
            aria-label="Between the Lines home"
          >
            <BrandImage />
          </a>
          <div className="breadcrumb">
            {nav.find((n) => n.id === section)?.label}
          </div>
          <div className="topbar-right">
            <button
              className="icon-button mobile-settings"
              aria-label="Settings"
              onClick={onSettings}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
      {dialog}
    </div>
  );
}
export type PitchView = "recent" | "pattern" | "passage";
export function PitchViewControl({
  value,
  onChange,
  hasPattern,
  hasPassage,
}: {
  value: PitchView;
  onChange: (v: PitchView) => void;
  hasPattern: boolean;
  hasPassage: boolean;
}) {
  return (
    <SelectionGroup
      className="mode-switch pitch-view-switch"
      label="Pitch view"
      value={value}
    >
      {(
        [
          ["recent", "Recent actions", true],
          ["pattern", "Pattern evidence", hasPattern],
          ["passage", "Passage replay", hasPassage],
        ] as const
      ).map(([id, label, enabled]) => (
        <button
          key={id}
          className={value === id ? "selected" : ""}
          aria-pressed={value === id}
          disabled={!enabled}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </SelectionGroup>
  );
}
