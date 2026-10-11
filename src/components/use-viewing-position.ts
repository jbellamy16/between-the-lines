"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchData } from "@/lib/sources/model";
import {
  missedSince,
  readViewingPosition,
  viewingKey,
} from "@/lib/viewing-position";

/** A visible, focused two-second dwell is an observation, not proof of watching every preceding event. */
export function useViewingPosition(
  match: MatchData,
  time: number,
  active: boolean,
  recapOpen: boolean,
) {
  const key = viewingKey(match);
  const [entry, setEntry] = useState<{ key: string; position: number | null }>({
    key: "",
    position: null,
  });
  const current = useRef({ time, active, recapOpen });
  current.current = { time, active, recapOpen };
  const observed = useRef<number | null>(null);
  useEffect(() => {
    let position: number | null = null;
    try {
      position = readViewingPosition(localStorage.getItem(key), match.duration);
    } catch {
      /* Private browsing can deny storage. */
    }
    observed.current = position;
    setEntry({ key, position });
    let started = performance.now();
    let engaged =
      active && document.visibilityState === "visible" && document.hasFocus();
    const checkpoint = () => {
      const state = current.current;
      const now = performance.now();
      const visible =
        state.active &&
        !state.recapOpen &&
        document.visibilityState === "visible" &&
        document.hasFocus();
      if (!visible) {
        started = now;
        return;
      }
      if (now - started < 2000) return;
      observed.current = state.time;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ version: 1, position: state.time }),
        );
      } catch {
        /* Session-only fallback. */
      }
    };
    const visibility = () => {
      const visible =
        current.current.active &&
        document.visibilityState === "visible" &&
        document.hasFocus();
      if (visible && !engaged) setEntry({ key, position: observed.current });
      engaged = visible;
      started = performance.now();
    };
    const timer = window.setInterval(checkpoint, 1000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", visibility);
    };
  }, [key, match.duration, active]);
  const acknowledge = useCallback(
    (position: number) => {
      // Explicitly leaving a briefing is a new session anchor; background generation never is.
      observed.current = position;
      setEntry({ key, position });
      try {
        localStorage.setItem(key, JSON.stringify({ version: 1, position }));
      } catch {
        /* Session-only fallback. */
      }
    },
    [key],
  );
  return {
    since: missedSince(entry.key === key ? entry.position : null, time),
    acknowledge,
  };
}
