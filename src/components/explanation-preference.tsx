"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import {
  parseExplanationStyle,
  type ExplanationStyle,
} from "@/lib/explanation";

export const explanationStorageKey = "between-the-lines-explanation-style";
const Preference = createContext<{
  style: ExplanationStyle;
  choose: (style: ExplanationStyle) => void;
}>({ style: "plain", choose: () => {} });

/** Presentation only: deliberately outside match/investigation preferences. */
export function ExplanationPreference({ children }: { children: ReactNode }) {
  const [style, setStyle] = useState<ExplanationStyle>("plain");
  useEffect(() => {
    const read = () => {
      try {
        setStyle(
          parseExplanationStyle(localStorage.getItem(explanationStorageKey)),
        );
      } catch {}
    };
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === explanationStorageKey || event.key === null) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const choose = (next: ExplanationStyle) => {
    setStyle(next);
    try {
      localStorage.setItem(explanationStorageKey, next);
    } catch {}
  };
  return (
    <Preference.Provider value={{ style, choose }}>
      {children}
    </Preference.Provider>
  );
}

export const useExplanationStyle = () => useContext(Preference).style;

export function ExplanationSelector({
  settings = false,
}: {
  settings?: boolean;
}) {
  const { style, choose } = useContext(Preference);
  const id = useId();
  return (
    <div className={settings ? "explanation-setting" : "explanation-control"}>
      <label htmlFor={id}>Explanation style</label>
      <select
        id={id}
        value={style}
        onChange={(event) => choose(parseExplanationStyle(event.target.value))}
      >
        <option value="plain">Plain English</option>
        <option value="analysis">Football Analysis</option>
      </select>
      {settings && (
        <p className="muted">
          Choose everyday language or football detail. Quick and Full control
          recap length separately.
        </p>
      )}
    </div>
  );
}
