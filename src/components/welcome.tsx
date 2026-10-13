"use client";
import { useEffect, useState } from "react";
import { X } from "./icons";

const storageKey = "between-the-lines-welcome-dismissed";

/** One line for someone landing cold. Dismissed once, it stays dismissed. */
export function Welcome() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "1") setDismissed(true);
    } catch {}
  }, []);
  if (dismissed) return null;
  return (
    <p className="welcome-line">
      <span className="welcome-full">
        <strong>Between the Lines explains a match as it happens.</strong> Press
        play to watch the story change, or ask the analyst about this moment.
      </span>
      <span className="welcome-short">
        <strong>Synthetic demo.</strong> Press play, or ask the analyst.
      </span>
      <button
        type="button"
        className="welcome-dismiss"
        aria-label="Dismiss welcome"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(storageKey, "1");
          } catch {}
        }}
      >
        <X size={16} />
      </button>
    </p>
  );
}
