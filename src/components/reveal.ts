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
  /** Only scroll a panel that scrolls on its own; never move the page. */
  panelOnly?: boolean;
};

const AIR = 12;
const shell = ".app-shell:not([hidden])";

/** Height of the fixed tab bar along the bottom edge on phones, else 0. */
function bottomInset() {
  const bar = document.querySelector(`${shell} .sidebar`);
  if (!bar || getComputedStyle(bar).position !== "fixed") return 0;
  const rect = bar.getBoundingClientRect();
  return rect.top > window.innerHeight / 2
    ? Math.max(0, window.innerHeight - rect.top)
    : 0;
}

/** Fixed bars (the frame's header and playback bar) cover the page's edges. */
function fixedBar(target: Element, selector: string) {
  const bar = target.closest(".app-shell")?.querySelector(selector);
  if (!bar || getComputedStyle(bar).position !== "fixed") return null;
  const rect = bar.getBoundingClientRect();
  return rect.height ? rect : null;
}

type Scroller = {
  panel: boolean;
  top: number;
  bottom: number;
  scrollTop: () => number;
  scrollTo: (options: ScrollToOptions) => void;
  events: Window | HTMLElement;
};

/**
 * Where the result scrolls: the frame's story panel scrolls on its own;
 * everything else scrolls the page, clear of any fixed bars.
 */
function scrollerFor(target: Element): Scroller {
  const panel = target.closest<HTMLElement>(".app-shell.frame .main-story");
  if (panel && getComputedStyle(panel).position === "fixed") {
    const rect = panel.getBoundingClientRect();
    return {
      panel: true,
      top: rect.top,
      bottom: rect.bottom,
      scrollTop: () => panel.scrollTop,
      scrollTo: (options) => panel.scrollTo(options),
      events: panel,
    };
  }
  const header = fixedBar(target, ".topbar");
  // The desktop frame's playback bar, or the controls pinned on smaller screens.
  const footer =
    fixedBar(target, ".match-header") ?? fixedBar(target, ".match-controls");
  return {
    panel: false,
    top: header ? header.bottom : 0,
    bottom: Math.min(
      window.innerHeight - bottomInset(),
      footer ? footer.top : Infinity,
    ),
    scrollTop: () => window.scrollY,
    scrollTo: (options) => window.scrollTo(options),
    events: window,
  };
}

export function revealResult(
  target: Element | null | undefined,
  { anchor, align = "start", panelOnly = false }: RevealOptions = {},
  settling = false,
) {
  if (!target || !target.isConnected) return;
  const scroller = scrollerFor(target);
  if (panelOnly && !scroller.panel) return;
  const viewTop = scroller.top + AIR;
  const viewBottom = scroller.bottom - AIR;
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
  scroller.scrollTo({
    top: scroller.scrollTop() + delta,
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
    scroller.events.removeEventListener("scrollend", settle);
    input.forEach((e) => window.removeEventListener(e, tookOver));
    if (!viewerScrolled) revealResult(target, { anchor, align }, true);
  };
  // scrollend where supported; the timer also covers a scroll that never moved.
  scroller.events.addEventListener("scrollend", settle);
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
