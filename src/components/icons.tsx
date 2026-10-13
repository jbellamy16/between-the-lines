import {
  Activity as LucideActivity,
  ArrowLeft as LucideArrowLeft,
  ArrowRight as LucideArrowRight,
  ArrowUpRight as LucideArrowUpRight,
  ChartNoAxesColumnIncreasing,
  Check as LucideCheck,
  ChevronDown as LucideChevronDown,
  ChevronRight as LucideChevronRight,
  CircleHelp as LucideCircleHelp,
  Clock3 as LucideClock3,
  ListVideo as LucideListVideo,
  Pause as LucidePause,
  Play as LucidePlay,
  RotateCcw as LucideRotateCcw,
  Settings2 as LucideSettings2,
  ShieldCheck,
  Star as LucideStar,
  TrendingUp as LucideTrendingUp,
  Users as LucideUsers,
  X as LucideX,
  Flag,
  List,
  Trophy,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import {
  IconArrowsExchange,
  IconBallFootball,
  IconEye,
  IconPlayFootball,
  IconShirtSport,
  IconSoccerField,
  type TablerIcon,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { EventType } from "@/lib/match";

// One entry point for all interface glyphs. Brand marks and data plots are separate.
export type IconSize = 16 | 20 | 24 | 32;
export type IconProps = Omit<
  LucideProps,
  "size" | "strokeWidth" | "absoluteStrokeWidth" | "fill" | "children"
> & { size?: IconSize };
function systemIcon(Glyph: LucideIcon) {
  return function SystemIcon({
    size = 20,
    className = "",
    ...props
  }: IconProps) {
    return (
      <Glyph
        {...props}
        size={size}
        strokeWidth={2}
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={`sl-icon ${className}`}
      />
    );
  };
}
export const Activity = systemIcon(LucideActivity);
export const ArrowLeft = systemIcon(LucideArrowLeft);
export const ArrowRight = systemIcon(LucideArrowRight);
export const ArrowUpRight = systemIcon(LucideArrowUpRight);
export const BarChart3 = systemIcon(ChartNoAxesColumnIncreasing);
export const Check = systemIcon(LucideCheck);
export const ChevronDown = systemIcon(LucideChevronDown);
export const ChevronRight = systemIcon(LucideChevronRight);
export const CircleHelp = systemIcon(LucideCircleHelp);
export const Clock3 = systemIcon(LucideClock3);
export const ListVideo = systemIcon(LucideListVideo);
export const Pause = systemIcon(LucidePause);
export const Play = systemIcon(LucidePlay);
export const RotateCcw = systemIcon(LucideRotateCcw);
export const Settings2 = systemIcon(LucideSettings2);
export const Shield = systemIcon(ShieldCheck);
export const Star = systemIcon(LucideStar);
export const TrendingUp = systemIcon(LucideTrendingUp);
export const Users = systemIcon(LucideUsers);
export const X = systemIcon(LucideX);
export const MatchEvents = systemIcon(List);
export const Competition = systemIcon(Trophy);
const Corner = systemIcon(Flag);

function footballIcon(Glyph: TablerIcon) {
  return function FootballIcon({
    size = 20,
    className = "",
    ...props
  }: IconProps) {
    return (
      <Glyph
        {...props}
        size={size}
        stroke={2}
        fill="none"
        aria-hidden="true"
        focusable="false"
        className={`sl-icon ${className}`}
      />
    );
  };
}
export const FootballPitch = footballIcon(IconSoccerField);
export const PlayerShirt = footballIcon(IconShirtSport);
export const Watch = footballIcon(IconEye);
export const Substitution = footballIcon(IconArrowsExchange);
export const Goal = footballIcon(IconBallFootball);
const Possession = footballIcon(IconBallFootball);
const Carry = footballIcon(IconPlayFootball);

function FootballGlyph({
  size = 20,
  className = "",
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`sl-icon ${className}`}
    >
      {children}
    </svg>
  );
}
// Original diagrams extend Tabler's 24px canvas and 2px rounded strokes.
// They accompany text: nuanced actions should never rely on a glyph alone.
export function Stadium(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <ellipse cx="12" cy="9" rx="9" ry="5" />
      <path d="M3 9v6c0 2.8 4 5 9 5s9-2.2 9-5V9" />
      <path d="M8 8h8l2 3H6Z" />
    </FootballGlyph>
  );
}
export function Formation(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M10 7h4M7 12h2m6 0h2M6 17h2m3 0h2m3 0h2" />
    </FootballGlyph>
  );
}
export function HighBallWins(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <path
        d="M15 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4Z"
        fill="currentColor"
        fillOpacity=".18"
        stroke="none"
      />
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M9 5v14m6-14v14m6-10h-3v6h3" />
    </FootballGlyph>
  );
}
export function Shot(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <path d="M14 9V4h7v16h-7v-5m4-11v16m0-11h3m-3 6h3" />
      <circle cx="5" cy="12" r="2" />
      <path d="M10 12h5m-3-3 3 3-3 3" />
    </FootballGlyph>
  );
}
export function Pass(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <circle cx="5" cy="12" r="2" />
      <path d="M10 12h7m-3-3 3 3-3 3M21 8v8" />
    </FootballGlyph>
  );
}
export function Tackle(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <circle cx="18" cy="17" r="3" />
      <path d="M4 4v9l-1 5a2 2 0 0 0 2 2h7a2 2 0 0 0 0-4H9l2-12M4 12h5" />
    </FootballGlyph>
  );
}
export function Interception(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <circle cx="5" cy="12" r="2" />
      <path d="M10 12h5m-3-3 3 3-3 3M19 5v14m-2 0h4" />
    </FootballGlyph>
  );
}
export function Recovery(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <circle cx="9" cy="10" r="6" />
      <path d="m9 7 3 2-1 3H7L6 9Zm0 0V4m3 5 3-1M6 9 3 8m10 9 3 3 5-6" />
    </FootballGlyph>
  );
}
export function Tactics(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m7 14 3 3m0-3-3 3M7 8h7a3 3 0 0 1 3 3v5m-3-3 3 3 3-3" />
    </FootballGlyph>
  );
}
function Foul(props: IconProps) {
  return (
    <FootballGlyph {...props}>
      <path d="M12 10h9v4h-5a6 6 0 1 1-4-4ZM17 10v4M7 3v2m6-1-1 2m-9 1 2 1" />
      <circle cx="10" cy="16" r="2" />
    </FootballGlyph>
  );
}
export const EVENT_ICONS = {
  goal: Goal,
  shot: Shot,
  pass: Pass,
  carry: Carry,
  tackle: Tackle,
  interception: Interception,
  recovery: Recovery,
  substitution: Substitution,
  corner: Corner,
  foul: Foul,
  possession: Possession,
  duel: Tackle,
  restart: Pass,
  offside: Foul,
  touch: Possession,
  interruption: Foul,
  save: Recovery,
  free_kick: Pass,
  card: Foul,
  period_start: Possession,
  period_end: Possession,
  other: Possession,
} satisfies Record<EventType, (props: IconProps) => ReactNode>;
export function EventIcon({ type, ...props }: IconProps & { type: EventType }) {
  const Glyph = EVENT_ICONS[type];
  return <Glyph {...props} />;
}
