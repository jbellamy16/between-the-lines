const SINGULAR: Record<string, string> = {
  shots: "shot",
  "pass attempts": "pass attempt",
  "ball wins in the attacking third": "ball win in the attacking third",
  "attacking-third actions": "attacking-third action",
  "forward passes": "forward pass",
};
const ONE = new RegExp(
  `(?<![\\d.])1 (${Object.keys(SINGULAR).join("|")})\\b`,
  "g",
);

/**
 * Display-only: "1 shots" → "1 shot". The engine's wording is left as is
 * because frozen evaluation records capture it verbatim.
 */
export function singularCounts(text: string) {
  return text.replace(ONE, (_, label: string) => `1 ${SINGULAR[label]}`);
}
