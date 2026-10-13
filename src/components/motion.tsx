"use client";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { revealResult } from "./reveal";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}

// CSS is the source of truth for both CSS and imperative animation timing.
export function motionTiming(element: Element, token = "standard") {
  const style = getComputedStyle(element);
  return {
    duration: parseFloat(style.getPropertyValue(`--motion-${token}`)) || 0,
    easing: style.getPropertyValue("--ease-out").trim() || "ease-out",
  };
}

/** Native keyboard/summary behavior, with reversible opening and closing motion. */
/**
 * A disclosure opened near the bottom of the screen used to expand out of
 * sight, so only its chevron changed. Bring what it opened into view: on the
 * page via revealResult (tab bar, reduced motion, tall content), or inside a
 * scrolling dialog with the browser's own nearest scroll.
 */
function revealOpened(el: HTMLDetailsElement) {
  const dialog = el.closest("dialog");
  if (!dialog) return revealResult(el, { align: "nearest" });
  const box = dialog.getBoundingClientRect(),
    rect = el.getBoundingClientRect();
  if (rect.top >= box.top && rect.bottom <= box.bottom) return;
  el.scrollIntoView({
    block: rect.height > box.height ? "start" : "nearest",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}

export function AnimatedDetails({
  children,
  ...props
}: ComponentProps<"details">) {
  const ref = useRef<HTMLDetailsElement>(null);
  const transition = useRef<{
    animation: Animation;
    expanded: boolean;
    overflow: string;
  } | null>(null);
  const reduced = useReducedMotion();
  useEffect(
    () => () => {
      const el = ref.current;
      const current = transition.current;
      if (!el || !current) return;
      current.animation.cancel();
      el.open = current.expanded;
      el.style.overflow = current.overflow;
      el.removeAttribute("data-expanded");
      el.querySelector(":scope > summary")?.removeAttribute("aria-expanded");
      transition.current = null;
    },
    [reduced],
  );
  return (
    <details
      {...props}
      ref={ref}
      className={`animated-details ${props.className ?? ""}`}
      onClick={(event) => {
        props.onClick?.(event);
        const el = event.currentTarget;
        const target = event.target as Element;
        const summary = target.closest("summary");
        if (
          event.defaultPrevented ||
          summary?.parentElement !== el ||
          target.closest("a, button, input, select")
        )
          return;
        event.preventDefault();
        const current = transition.current;
        const expanded = !(current?.expanded ?? el.open);
        const start = el.getBoundingClientRect().height;
        const overflow = current?.overflow ?? el.style.overflow;
        current?.animation.cancel();
        transition.current = null;
        el.open = expanded;
        el.style.overflow = overflow;
        if (reduced) {
          if (expanded) revealOpened(el);
          return;
        }
        const end = el.getBoundingClientRect().height;
        // Keep the content rendered until a closing transition has finished.
        el.open = true;
        el.style.overflow = "hidden";
        el.dataset.expanded = String(expanded);
        summary.setAttribute("aria-expanded", String(expanded));
        const animation = el.animate(
          [{ height: `${start}px` }, { height: `${end}px` }],
          motionTiming(el, "panel"),
        );
        transition.current = { animation, expanded, overflow };
        animation.onfinish = () => {
          el.open = expanded;
          el.style.overflow = overflow;
          el.removeAttribute("data-expanded");
          summary.removeAttribute("aria-expanded");
          transition.current = null;
          if (expanded) revealOpened(el);
        };
      }}
    >
      {children}
    </details>
  );
}

export function Reveal({
  change,
  children,
  className = "",
}: {
  change: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const animation = el.animate(
      [{ transform: "translateY(4px)" }, { transform: "translateY(0)" }],
      motionTiming(el),
    );
    return () => animation.cancel();
  }, [change, reduced]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function Metric({
  value,
  important = false,
}: {
  value: number | string;
  important?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    const changed = previous.current !== value;
    const increased = Number(value) > Number(previous.current);
    previous.current = value;
    const el = ref.current;
    if (!el || !changed || reduced) return;
    const animation = el.animate(
      important && increased
        ? [
            { opacity: 0.95, transform: "translateY(4px) scale(.94)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ]
        : [{ opacity: 0.95 }, { opacity: 1 }],
      motionTiming(el, important ? "visual" : "micro"),
    );
    return () => animation.cancel();
  }, [value, important, reduced]);
  return (
    <span className="motion-metric" ref={ref}>
      {value}
    </span>
  );
}

// One moving indicator; measure only on selection/resize, never each frame.
export function SelectionGroup({
  children,
  className,
  label,
  navigation = false,
  value,
}: {
  children: ReactNode;
  className: string;
  label: string;
  navigation?: boolean;
  value: string;
}) {
  const ref = useRef<HTMLDivElement & HTMLElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const selected = el.querySelector<HTMLElement>(
        '[aria-current="page"], [aria-pressed="true"]',
      );
      if (selected)
        setPosition({
          x: selected.offsetLeft,
          y: selected.offsetTop,
          width: selected.offsetWidth,
          height: selected.offsetHeight,
        });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);
  const Tag = navigation ? "nav" : "div";
  return (
    <Tag
      ref={ref}
      className={`${className} selection-group`}
      aria-label={label}
    >
      <span
        aria-hidden="true"
        className="selection-indicator"
        style={{
          width: position.width,
          height: position.height,
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
      />
      {children}
    </Tag>
  );
}

export function usePageVisibility() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}
