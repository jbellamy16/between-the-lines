/** Shared event definitions; counts describe recorded actions, not pressing. */
type BallWinEvent = {
  type: string;
  success?: boolean;
  source?: { provider: string };
  position: { x: number; y: number } | null;
};

export const BALL_WIN_DEFINITION =
  "Ball wins in the attacking third count successful recoveries, interceptions and tackles starting in the final third of the pitch. Recoveries with no failure recorded also count. In the synthetic feed, interceptions and tackles start a new possession and represent successful wins. Restarts do not count.";

export function isBallWin(event: BallWinEvent) {
  return (
    (event.type === "recovery" && event.success !== false) ||
    (["interception", "tackle"].includes(event.type) &&
      (event.success === true ||
        (event.success === undefined &&
          (!event.source || event.source.provider === "synthetic"))))
  );
}

export function isHighBallWin(event: BallWinEvent) {
  return isBallWin(event) && (event.position?.x ?? -1) >= 66.7;
}

/** Equal rolling windows, entirely within the supplied period. */
export function comparisonWindow(cutoff: number, periodStart: number) {
  const width = Math.min(900, Math.floor((cutoff - periodStart) / 2));
  return {
    width,
    start: cutoff - width,
    previousStart: cutoff - 2 * width,
    end: cutoff,
  };
}

export function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round((seconds % 60) * 10) / 10;
  return minutes
    ? `${minutes} min${remainder ? ` ${remainder} sec` : ""}`
    : `${remainder} sec`;
}
