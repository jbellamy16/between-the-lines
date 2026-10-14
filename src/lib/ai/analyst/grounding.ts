/**
 * Grounding check for free-text analyst answers.
 *
 * The model may phrase its answer freely, but every number, match time and
 * player name it writes must already appear in evidence the application
 * retrieved for it (or in the viewer's own question). Anything else is treated
 * as invented and the answer is rejected before a viewer sees it.
 *
 * Pure and deterministic: no model, network or clock.
 */

export type GroundingFacts = {
  numbers: Set<string>;
  clocks: Set<string>;
  names: Set<string>;
  /** Counted things, e.g. shot -> {"0", "4"}: "4 shots" must match a shot count. */
  counts: Map<string, Set<string>>;
};

export type RosterName = { name: string };

export type GroundingResult = {
  passed: boolean;
  issues: string[];
  checked: { numbers: number; clocks: number; names: number };
};

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  none: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
};
// "None" and "one" are too common as pronouns to treat as claims.
const CHECKED_WORDS = Object.keys(NUMBER_WORDS).filter(
  (w) => !["none", "one", "zero"].includes(w),
);

const CLOCK = /\b(\d{1,3})(?:\+(\d{1,2}))?:(\d{2})\b/g;
const NUMBER = /(?<![\w.])(\d+(?:\.\d+)?)(%?)/g;
const EVENT_REF = /\be\d{1,3}\b/gi;

export function emptyFacts(): GroundingFacts {
  return {
    numbers: new Set(),
    clocks: new Set(),
    names: new Set(),
    counts: new Map(),
  };
}

const NOUNS: [RegExp, string][] = [
  [/^(shots?|attempts?|efforts?)$/, "shot"],
  [/^(pass(es)?|pass attempts?)$/, "pass"],
  [/^goals?$/, "goal"],
  [/^actions?$/, "action"],
  [/^(recover(y|ies)|ball wins?|high ball wins?)$/, "recovery"],
  [/^tackles?$/, "tackle"],
  [/^interceptions?$/, "interception"],
  [/^corners?$/, "corner"],
  [/^fouls?$/, "foul"],
];
const COUNT_KEYS: Record<string, string> = {
  shots: "shot",
  shotsAfterHighRecovery: "shot",
  passes: "pass",
  completedPasses: "pass",
  goals: "goal",
  actions: "action",
  recoveries: "recovery",
  tackles: "tackle",
  interceptions: "interception",
  corners: "corner",
  fouls: "foul",
};
function noun(raw: string) {
  const word = raw.toLowerCase().trim();
  return NOUNS.find(([pattern]) => pattern.test(word))?.[1];
}
const WORD_ALTERNATION = () => Object.keys(NUMBER_WORDS).join("|");
const COUNT_PHRASE = () =>
  new RegExp(
    `(?<![\\w.:])(\\d+|${WORD_ALTERNATION()})\\s+(?:recorded\\s+|more\\s+|completed\\s+|successful\\s+)?(high ball wins?|ball wins?|pass attempts?|shots?|attempts?|efforts?|pass(?:es)?|goals?|actions?|recover(?:y|ies)|tackles?|interceptions?|corners?|fouls?)\\b`,
    "gi",
  );
function countValue(raw: string) {
  const lower = raw.toLowerCase();
  return lower in NUMBER_WORDS ? NUMBER_WORDS[lower] : Number(raw);
}
function addCount(facts: GroundingFacts, kind: string, value: number) {
  if (!Number.isFinite(value)) return;
  const set = facts.counts.get(kind) ?? new Set<string>();
  set.add(String(value));
  facts.counts.set(kind, set);
}

function addNumber(facts: GroundingFacts, value: number) {
  if (!Number.isFinite(value)) return;
  const forms = new Set<string>([
    String(value),
    String(Math.round(value)),
    value.toFixed(1),
    value.toFixed(2),
  ]);
  // Rates in [0, 1] may be written as percentages.
  if (value > 0 && value < 1) {
    forms.add(String(Math.round(value * 100)));
    forms.add((value * 100).toFixed(1));
  }
  for (const form of forms) facts.numbers.add(normalizeNumber(form));
}

function normalizeNumber(raw: string) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  // 0.10 and 0.1 are the same claim; keep up to two decimals.
  return String(Math.round(n * 100) / 100);
}

function addClock(facts: GroundingFacts, clock: string) {
  facts.clocks.add(clock);
  const match = /^(\d{1,3})(?:\+(\d{1,2}))?:(\d{2})$/.exec(clock);
  if (!match) return;
  const minute = Number(match[1]);
  // "the 63rd minute" is how football describes 62:50.
  addNumber(facts, minute);
  addNumber(facts, minute + 1);
  if (match[2]) {
    addNumber(facts, Number(match[2]));
    addNumber(facts, Number(match[2]) + 1);
  }
}

/** Collect every number, clock and string fragment from evidence sent to the model. */
export function collectFacts(value: unknown, facts = emptyFacts()) {
  const walk = (v: unknown) => {
    if (v === null || v === undefined) return;
    if (typeof v === "number") addNumber(facts, v);
    else if (typeof v === "string") addText(facts, v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === "object")
      for (const [k, inner] of Object.entries(v as Record<string, unknown>)) {
        addText(facts, k);
        if (typeof inner === "number" && COUNT_KEYS[k])
          addCount(facts, COUNT_KEYS[k], inner);
        walk(inner);
      }
  };
  walk(value);
  return facts;
}

export function addText(facts: GroundingFacts, text: string) {
  for (const m of text.matchAll(CLOCK)) addClock(facts, m[0]);
  for (const m of text.replace(CLOCK, " ").matchAll(NUMBER))
    addNumber(facts, Number(m[1]));
  for (const m of text.matchAll(COUNT_PHRASE())) {
    const kind = noun(m[2]);
    if (kind) addCount(facts, kind, countValue(m[1]));
  }
  // "4 shots ... up from 0 in the previous spell": every number in a sentence
  // that names a counted thing is a possible count of that thing.
  for (const sentence of text.split(/(?<=[.;!?])\s+/)) {
    const kinds = new Set<string>();
    for (const word of sentence.toLowerCase().match(/[a-z]+(?: [a-z]+)?/g) ??
      []) {
      for (const part of [word, ...word.split(" ")]) {
        const kind = noun(part);
        if (kind) kinds.add(kind);
      }
    }
    if (!kinds.size) continue;
    // Durations, percentages and xG values are not counts.
    const values = [
      ...sentence
        .replace(CLOCK, " ")
        .matchAll(
          /(?<![\w.:])(\d+)(?![\d.]|\s*(?:min|sec|minute|second|%|xg|m\b|s\b))/gi,
        ),
    ].map((m) => Number(m[1]));
    for (const kind of kinds)
      for (const value of values) addCount(facts, kind, value);
  }
  facts.names.add(text);
}

export function addName(facts: GroundingFacts, name: string) {
  facts.names.add(name);
}

function nameAllowed(facts: GroundingFacts, name: string) {
  for (const text of facts.names) if (text.includes(name)) return true;
  return false;
}

/** Seconds on a match clock ("63:24", "45+2:10"); stoppage adds its minutes. */
function clockSeconds(m: RegExpMatchArray) {
  return (Number(m[1]) + Number(m[2] ?? 0)) * 60 + Number(m[3]);
}

/**
 * Times the question names that haven't been played yet at `now`, as
 * patterns for the ways an answer might mention them: a match time after it
 * ("80:00"), or a minute that starts after it ("the 80th minute", "minute
 * 80", "80'").
 */
function futureTimes(question: string, now: string) {
  const at = /^(\d{1,3})(?:\+(\d{1,2}))?:(\d{2})$/.exec(now);
  if (!at) return [];
  const nowSeconds = clockSeconds(at);
  const patterns = new Set<string>();
  for (const m of question.matchAll(CLOCK))
    if (clockSeconds(m) > nowSeconds)
      patterns.add(`(?<![\\d+])${m[0].replace("+", "\\+")}\\b`);
  for (const m of question.matchAll(
    /\b(\d{1,3})(?:st|nd|rd|th)\s+minute\b|\bminute\s+(\d{1,3})\b/gi,
  )) {
    const minute = Number(m[1] ?? m[2]);
    if ((minute - 1) * 60 > nowSeconds)
      patterns.add(
        `\\b(?:${minute}(?:st|nd|rd|th)\\b|minute\\s+${minute}\\b|${minute}['’])`,
      );
  }
  return [...patterns].map((p) => new RegExp(p, "i"));
}

const SPECULATION =
  /\b(will|going to|is set to|are set to)\s+(score|win|lose|equali[sz]e|concede|break through)\b|\b(tired|fatigued|frustrated|angry|nervous|instructed|ordered|tactical switch|game plan)\b/i;

/**
 * Check an answer against retrieved facts.
 * `roster` lets the check recognise player names it was not told about.
 */
export function verifyGrounding(
  answer: string,
  facts: GroundingFacts,
  roster: RosterName[],
  question = "",
  options: { declining?: boolean; now?: string } = {},
): GroundingResult {
  const issues: string[] = [];
  const questionFacts = emptyFacts();
  addText(questionFacts, question);
  for (const [word, value] of Object.entries(NUMBER_WORDS))
    if (new RegExp(`\\b${word}\\b`, "i").test(question))
      addNumber(questionFacts, value);
  let numbers = 0,
    clocks = 0,
    names = 0;

  for (const m of answer.matchAll(CLOCK)) {
    clocks++;
    if (!facts.clocks.has(m[0]) && !questionFacts.clocks.has(m[0]))
      issues.push(`Time "${m[0]}" is not in the retrieved evidence.`);
  }
  const withoutClocks = answer.replace(CLOCK, " ");
  for (const m of withoutClocks.matchAll(NUMBER)) {
    numbers++;
    const form = normalizeNumber(m[1]);
    if (!facts.numbers.has(form) && !questionFacts.numbers.has(form))
      issues.push(`Number "${m[0]}" is not in the retrieved evidence.`);
  }
  const lower = withoutClocks.toLowerCase();
  for (const word of CHECKED_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "g");
    const count = [...lower.matchAll(pattern)].length;
    if (!count) continue;
    numbers += count;
    const form = String(NUMBER_WORDS[word]);
    if (!facts.numbers.has(form) && !questionFacts.numbers.has(form))
      issues.push(`Number "${word}" is not in the retrieved evidence.`);
  }

  const seen = new Set<string>();
  for (const player of roster) {
    const full = player.name;
    if (seen.has(full)) continue;
    seen.add(full);
    const surname = full.split(" ").at(-1)!;
    const mentionsFull = answer.includes(full);
    // Surnames only count when capitalised mid-sentence, so "march forward"
    // is not mistaken for a player called March.
    const mentionsSurname =
      !mentionsFull &&
      surname.length >= 4 &&
      new RegExp(`(?<![.!?]\\s)(?<!^)\\b${surname}\\b`).test(answer);
    if (!mentionsFull && !mentionsSurname) continue;
    names++;
    const label = mentionsFull ? full : surname;
    if (
      !nameAllowed(facts, mentionsFull ? full : surname) &&
      !question.includes(label)
    )
      issues.push(
        `Player "${label}" does not appear in the retrieved evidence.`,
      );
  }

  for (const m of answer.matchAll(COUNT_PHRASE())) {
    const kind = noun(m[2]);
    if (!kind) continue;
    const value = String(countValue(m[1]));
    if (
      !facts.counts.get(kind)?.has(value) &&
      !questionFacts.counts.get(kind)?.has(value)
    )
      issues.push(
        `"${m[0].trim()}" does not match any ${kind} count in the retrieved evidence.`,
      );
  }

  // A time the viewer asked about that hasn't been played yet may only
  // appear in a decline: an answer about it is about the future.
  if (!options.declining && options.now)
    for (const pattern of futureTimes(question, options.now)) {
      const mention = pattern.exec(answer);
      if (mention)
        issues.push(
          `"${mention[0]}" is after the current clock (${options.now}); it hasn't been played yet. Use cannot_answer.`,
        );
    }

  // A decline may name what it can't judge ("can't say who will win").
  if (!options.declining && SPECULATION.test(answer))
    issues.push(
      "The answer predicts an outcome or describes intent or feelings, which recorded events cannot show.",
    );

  // Event refs ("e4") are citation handles for the app, not words a viewer
  // can read. The digit inside "e4" also escapes the number check above.
  const refs = [...new Set(answer.match(EVENT_REF) ?? [])];
  if (refs.length)
    issues.push(
      `The answer shows event refs (${refs.join(", ")}). Put refs only in citations and describe each moment by its time and player.`,
    );

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    checked: { numbers, clocks, names },
  };
}
