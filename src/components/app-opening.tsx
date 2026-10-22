"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { BrandImage } from "./appearance";
import styles from "./app-opening.module.css";

export function AppOpening({
  ready,
  shell,
  onComplete,
}: {
  ready: boolean;
  shell: RefObject<HTMLDivElement | null>;
  onComplete: () => void;
}) {
  const route = useRef<SVGPathElement>(null);
  const ball = useRef<SVGCircleElement>(null);
  const arrow = useRef<SVGPathElement>(null);
  const [drawingDone, setDrawingDone] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const leaving = ready && assetsReady && drawingDone;

  useEffect(() => {
    const line = route.current!;
    const marker = ball.current!;
    const tip = arrow.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const length = line.getTotalLength();
    const started = performance.now();
    let frame = 0;

    function draw(now: number) {
      const elapsed = reduced.matches ? 1 : Math.min(1, (now - started) / 1050);
      const progress = elapsed * elapsed * (3 - 2 * elapsed);
      const point = line.getPointAtLength(progress * length);
      line.style.strokeDashoffset = String(1 - progress);
      marker.setAttribute("cx", String(point.x));
      marker.setAttribute("cy", String(point.y));
      tip.style.opacity = String(Math.max(0, (progress - 0.88) / 0.12));
      if (elapsed < 1) frame = requestAnimationFrame(draw);
      else setDrawingDone(true);
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let frame = 0;
    // Decode the initial visible artwork after saved preferences have applied.
    // Failed assets and slow fonts must never trap someone behind the opening.
    const images = [...(shell.current?.querySelectorAll("img") ?? [])].filter(
      (image) => image.getBoundingClientRect().width > 0,
    );
    const loaded = Promise.allSettled([
      document.fonts.ready,
      ...images.map((image) => image.decode()),
    ]);
    const finish = () => {
      if (disposed) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (!disposed) setAssetsReady(true);
        });
      });
    };
    const fallback = window.setTimeout(finish, 3000);
    void loaded.then(() => {
      clearTimeout(fallback);
      finish();
    });
    return () => {
      disposed = true;
      clearTimeout(fallback);
      cancelAnimationFrame(frame);
    };
  }, [ready, shell]);

  useEffect(() => {
    if (!leaving) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(onComplete, reduced ? 0 : 220);
    return () => clearTimeout(timer);
  }, [leaving, onComplete]);

  return (
    <div
      className={`${styles.opening} ${leaving ? styles.leaving : ""}`}
      role="status"
      aria-label="Getting the match ready"
      data-app-opening
    >
      <div className={styles.center} aria-hidden="true">
        <div className={styles.identity}>
          <BrandImage />
          <svg className={styles.mark} viewBox="0 0 96 96" aria-hidden="true">
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 16V80M80 16V80M48 10V30M48 66V86" />
              <circle cx="48" cy="48" r="18" />
              <path
                ref={route}
                className={styles.route}
                pathLength="1"
                d="M24 72C49 72 47 24 72 24"
              />
              <path
                ref={arrow}
                className={styles.arrow}
                d="M64 20L72 24L68 32"
              />
              <circle
                ref={ball}
                className={styles.ball}
                cx="24"
                cy="72"
                r="4.5"
                strokeWidth="1"
              />
            </g>
          </svg>
        </div>
        <p className={styles.tagline}>More than the score.</p>
      </div>
      <p className={styles.loading} aria-hidden="true">
        <span /> Getting the match ready
      </p>
    </div>
  );
}
