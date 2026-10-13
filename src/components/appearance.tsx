"use client";

import { useEffect, useState } from "react";

export type Appearance = "system" | "light" | "dark";
const storageKey = "second-look-appearance";

function readAppearance(): Appearance {
  try {
    const value = localStorage.getItem(storageKey);
    if (value === "light" || value === "dark" || value === "system")
      return value;
  } catch {}
  // Dark is the default; "System" is an explicit choice.
  return "dark";
}

export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAppearance(readAppearance());
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        setAppearance(readAppearance());
    };
    window.addEventListener("storage", sync);
    const localSync = () => setAppearance(readAppearance());
    window.addEventListener("match-appearance", localSync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("match-appearance", localSync);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme =
        appearance === "system"
          ? system.matches
            ? "dark"
            : "light"
          : appearance;
      document.documentElement.dataset.theme = theme;
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute("content", theme === "dark" ? "#0b0f14" : "#f8fafc");
      });
    };
    apply();
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [appearance, ready]);

  const chooseAppearance = (value: Appearance) => {
    setAppearance(value);
    try {
      localStorage.setItem(storageKey, value);
      window.dispatchEvent(new Event("match-appearance"));
    } catch {}
  };

  return [appearance, chooseAppearance] as const;
}

/** Both images are server-rendered; CSS selects the correct ink before paint. */
export function BrandImage({
  className = "",
  symbol = false,
}: {
  className?: string;
  symbol?: boolean;
}) {
  return (
    <>
      {(["dark", "light"] as const).map((theme) => (
        <img
          key={theme}
          className={`${className} theme-${theme}-logo`}
          src={
            symbol
              ? `/brand/btl-mark-${theme}.svg`
              : `/brand/btl-horizontal-${theme}.svg`
          }
          width={symbol ? 96 : 376}
          height={symbol ? 96 : 112}
          alt="Between the Lines"
        />
      ))}
    </>
  );
}
