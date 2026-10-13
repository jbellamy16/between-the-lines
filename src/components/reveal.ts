/**
 * Scroll-to-result: after a tap, bring what it started into view.
 *
 * - Skips scrolling when the result is already fully visible.
 * - Clears the fixed phone tab bar at the bottom, with a little air above.
 * - Smooth, or instant when the viewer prefers reduced motion.
 * - `start` aligns the result's top; `nearest` moves only as far as needed.
 *   A result taller than the space always aligns its top.
 */
export type RevealOptions = {
  /** Scroll this element into place instead (visibility is still checked on the target). */
  anchor?: Element | null;
  align?: "start" | "nearest";
};

const AIR = 12;

/** Height of the fixed tab bar along the bottom edge on phones, else 0. */
function bottomInset() {
  const bar = document.querySelector(".app-shell:not([hidden]) .sidebar");
  if (!bar || getComputedStyle(bar).position !== "fixed") return 0;
  const rect = bar.getBoundingClientRect();
  return rect.top > window.innerHeight / 2
    ? Math.max(0, window.innerHeight - rect.top)
    : 0;
}

export function revealResult(
  target: Element | null | undefined,
  { anchor, align = "start" }: RevealOptions = {},
  settling = false,
) {
  if (!target || !target.isConnected) return;
  const viewTop = AIR;
  const viewBottom = window.innerHeight - bottomInset() - AIR;
  const rect = target.getBoundingClientRect();
  if (!rect.height || (rect.top >= viewTop && rect.bottom <= viewBottom))
    return;
  const place = (anchor ?? target).getBoundingClientRect();
  const space = viewBottom - viewTop;
  const delta =
    align === "nearest" && place.top >= viewTop && place.height <= space
      ? place.bottom - viewBottom
      : place.top - viewTop;
  if (Math.abs(delta) < (settling ? 4 : 1)) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: window.scrollY + delta,
    behavior: reduced || settling ? "instant" : "smooth",
  });
  if (reduced || settling) return;
  // Content can still grow above the result while the smooth scroll runs (an
  // answer streaming in), and browsers don't anchor mid-scroll. Correct once,
  // unless the viewer took over the scroll.
  const input = ["wheel", "touchstart", "keydown"] as const;
  let viewerScrolled = false;
  const tookOver = () => (viewerScrolled = true);
  input.forEach((e) =>
    window.addEventListener(e, tookOver, { passive: true, once: true }),
  );
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    clearTimeout(fallback);
    window.removeEventListener("scrollend", settle);
    input.forEach((e) => window.removeEventListener(e, tookOver));
    if (!viewerScrolled) revealResult(target, { anchor, align }, true);
  };
  // scrollend where supported; the timer also covers a scroll that never moved.
  window.addEventListener("scrollend", settle);
  const fallback = setTimeout(settle, 1200);
}

/** Reveal after React has committed and laid out the result (two frames). */
export function revealSoon(
  find: () => Element | null | undefined,
  options: RevealOptions | (() => RevealOptions) = {},
) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      revealResult(find(), typeof options === "function" ? options() : options),
    ),
  );
}

const shell = ".app-shell:not([hidden])";
export const pitchPanel = () => document.querySelector(`${shell} .pitch-panel`);

/**
 * A moment or observation lands on its pitch replay. Where the story card sits
 * above the pitch (phones), scroll to the pitch; side by side (desktop), to the
 * top of the match grid so the story and the pitch are both in view.
 */
export function revealPitchReplay() {
  revealSoon(pitchPanel, () => {
    const story = document.querySelector(`${shell} .main-story`);
    const pitch = pitchPanel();
    const stacked =
      !!story &&
      !!pitch &&
      pitch.getBoundingClientRect().top >=
        story.getBoundingClientRect().bottom - 1;
    return {
      anchor: stacked ? pitch : document.querySelector(`${shell} .match-grid`),
    };
  });
}
