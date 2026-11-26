/**
 * The Insights and Content ideas pages, as pure functions over questions the
 * AI has already tagged. Nothing here calls the AI: every number is a count of
 * fields Gemini filled in when it tagged the comment (kind of question,
 * conditions, medicines, fit, one-line summary). Added 26 Nov 2026.
 *
 * Only approachable questions count: tagged, read or legacy "posted" items,
 * not "irrelevant", not "do not reply". No commenter text or name is used;
 * examples are the AI's one-line summaries.
 */
import type { Intent } from "./types";

export interface InsightRow {
  intent: Intent;
  conditions: string[];
  medicines: string[];
  fit: number;
  summary: string | null;
  /** "YouTube · Channel Name" */
  community: string | null;
  postedAt: string | null;
}

/** Periods the pages offer, in days. Week-on-week change is shown for 7 only (see insightPeriod). */
export const INSIGHT_PERIODS = [7, 30] as const;
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];

export function parsePeriod(v: string | string[] | undefined, fallback: InsightPeriod): InsightPeriod {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return (INSIGHT_PERIODS as readonly number[]).includes(n) ? (n as InsightPeriod) : fallback;
}

const DAY = 86_400_000;

/**
 * The window shown and, for 7 days, the week before it. A 30-day comparison is
 * not offered: comments are deleted 30 days after YouTube last showed them, so
 * the month before would be incomplete and every change would look like growth.
 */
export function insightPeriod(days: InsightPeriod, now: Date): { since: Date; prevSince: Date | null } {
  const since = new Date(now.getTime() - days * DAY);
  return { since, prevSince: days === 7 ? new Date(since.getTime() - days * DAY) : null };
}

/**
 * One name per thing, so "statins" and "statin", or "Synthroid" and
 * "levothyroxine", are counted together. Brands map to the generic medicine.
 */
const SYNONYMS: Record<string, string> = {
  statins: "statin",
  synthroid: "levothyroxine",
  thyronorm: "levothyroxine",
  eltroxin: "levothyroxine",
  thyroxine: "levothyroxine",
  euthyrox: "levothyroxine",
  ozempic: "semaglutide",
  wegovy: "semaglutide",
  rybelsus: "semaglutide",
  mounjaro: "tirzepatide",
  zepbound: "tirzepatide",
  glp1: "glp-1",
  "glp 1": "glp-1",
  "glp-1 agonist": "glp-1",
  "blood thinners": "blood thinner",
  "type ii diabetes": "type 2 diabetes",
  "type-2 diabetes": "type 2 diabetes",
  t2d: "type 2 diabetes",
  "type i diabetes": "type 1 diabetes",
  "high blood pressure": "hypertension",
  "high bp": "hypertension",
  prediabetic: "prediabetes",
  "pre-diabetes": "prediabetes",
  hypothyroid: "hypothyroidism",
  hyperthyroid: "hyperthyroidism",
  hashimotos: "hashimoto's",
  hashimoto: "hashimoto's",
  pcod: "pcos",
  "polycystic ovary syndrome": "pcos",
  "fatty liver disease": "fatty liver",
  nafld: "fatty liver",
  "chronic kidney disease": "kidney disease",
  ckd: "kidney disease",
  "high cholesterol": "cholesterol",
  anaemia: "anemia",
  "iron deficiency anemia": "anemia",
  "iron deficiency anaemia": "anemia",
};

export function normTerm(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return SYNONYMS[s] ?? s;
}

export function channelName(community: string | null): string | null {
  if (!community) return null;
  return community.replace(/^YouTube · /, "").trim() || null;
}

function uniqueNorm(list: string[]): string[] {
  return [...new Set(list.map(normTerm).filter(Boolean))];
}

export interface Ranked {
  key: string;
  n: number;
  /** Same count in the previous period, when there is one. */
  prev: number | null;
  /** The spelling the AI used most often, for the YouTube page filter link. */
  raw: string;
}

function inWindow(r: InsightRow, from: Date, to: Date): boolean {
  if (!r.postedAt) return false;
  const t = Date.parse(r.postedAt);
  return t >= from.getTime() && t < to.getTime();
}

function tally(rows: InsightRow[], keys: (r: InsightRow) => Array<{ key: string; raw: string }>): Map<string, { n: number; raws: Map<string, number> }> {
  const m = new Map<string, { n: number; raws: Map<string, number> }>();
  for (const r of rows) {
    for (const { key, raw } of keys(r)) {
      const e = m.get(key) ?? { n: 0, raws: new Map() };
      e.n++;
      e.raws.set(raw, (e.raws.get(raw) ?? 0) + 1);
      m.set(key, e);
    }
  }
  return m;
}

function mostCommon(raws: Map<string, number>): string {
  return [...raws.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";
}

function rank(cur: InsightRow[], prev: InsightRow[] | null, keys: (r: InsightRow) => Array<{ key: string; raw: string }>, top: number): Ranked[] {
  const a = tally(cur, keys);
  const b = prev ? tally(prev, keys) : null;
  return [...a.entries()]
    .sort((x, y) => y[1].n - x[1].n || x[0].localeCompare(y[0]))
    .slice(0, top)
    .map(([key, e]) => ({ key, n: e.n, prev: b ? (b.get(key)?.n ?? 0) : null, raw: mostCommon(e.raws) }));
}

const termKeys = (field: "conditions" | "medicines") => (r: InsightRow) => {
  const seen = new Set<string>();
  const out: Array<{ key: string; raw: string }> = [];
  for (const raw of r[field]) {
    const key = normTerm(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, raw: raw.trim().toLowerCase() });
  }
  return out;
};

export interface InsightSummary {
  total: number;
  prevTotal: number | null;
  byIntent: Array<{ intent: Intent; n: number; prev: number | null }>;
  strong: number;
  medicines: Ranked[];
  conditions: Ranked[];
  channels: Ranked[];
}

const SHOWN_INTENTS: Intent[] = ["medicine_food_question", "nutrition_question", "app_recommendation", "competitor_complaint"];

/** A fit of this much or more counts as a strong match for Hash (same bar as the Shortlist). */
export const STRONG_FIT = 70;

export function summarise(rows: InsightRow[], now: Date, days: InsightPeriod, top = 10): InsightSummary {
  const { since, prevSince } = insightPeriod(days, now);
  const cur = rows.filter((r) => inWindow(r, since, now));
  const prev = prevSince ? rows.filter((r) => inWindow(r, prevSince, since)) : null;
  const countIntent = (list: InsightRow[], i: Intent) => list.filter((r) => r.intent === i).length;
  return {
    total: cur.length,
    prevTotal: prev ? prev.length : null,
    byIntent: SHOWN_INTENTS.map((intent) => ({ intent, n: countIntent(cur, intent), prev: prev ? countIntent(prev, intent) : null })),
    strong: cur.filter((r) => r.fit >= STRONG_FIT).length,
    medicines: rank(cur, prev, termKeys("medicines"), top),
    conditions: rank(cur, prev, termKeys("conditions"), top),
    channels: rank(
      cur,
      prev,
      (r) => {
        const c = channelName(r.community);
        return c ? [{ key: c, raw: c }] : [];
      },
      top,
    ),
  };
}

export interface ContentIdea {
  /** "levothyroxine" or, for questions that name no medicine, a condition. */
  topic: string;
  kind: "medicine" | "condition";
  /** Spelling for the YouTube page filter link. */
  raw: string;
  n: number;
  strong: number;
  /** The conditions asked about most together with this medicine (empty for a condition topic). */
  withConditions: string[];
  /** The clearest AI summaries (highest fit first, no repeats). */
  examples: string[];
  /** Channels where it is asked most. */
  channels: string[];
}

function topKeys(counts: Map<string, number>, n: number): string[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k);
}

/**
 * Groups of questions worth one article or video each. A question that names
 * a medicine joins that medicine's group (food with this medicine is Hash's
 * own topic); one that names none joins the group of its first condition.
 * Groups smaller than minSize are left out.
 */
export function contentIdeas(rows: InsightRow[], now: Date, days: InsightPeriod, opts: { minSize?: number; top?: number; examples?: number } = {}): ContentIdea[] {
  const { since } = insightPeriod(days, now);
  const cur = rows.filter((r) => inWindow(r, since, now));
  type Group = { kind: ContentIdea["kind"]; rows: InsightRow[]; raws: Map<string, number> };
  const groups = new Map<string, Group>();
  const add = (key: string, kind: ContentIdea["kind"], raw: string, r: InsightRow) => {
    const id = `${kind}:${key}`;
    const g: Group = groups.get(id) ?? { kind, rows: [], raws: new Map() };
    g.rows.push(r);
    g.raws.set(raw, (g.raws.get(raw) ?? 0) + 1);
    groups.set(id, g);
  };
  for (const r of cur) {
    const meds = termKeys("medicines")(r);
    if (meds.length) for (const m of meds) add(m.key, "medicine", m.raw, r);
    else {
      const c = termKeys("conditions")(r)[0];
      if (c) add(c.key, "condition", c.raw, r);
    }
  }
  const out: ContentIdea[] = [];
  for (const [id, g] of groups) {
    if (g.rows.length < (opts.minSize ?? 3)) continue;
    const topic = id.slice(id.indexOf(":") + 1);
    const cond = new Map<string, number>();
    const chan = new Map<string, number>();
    for (const r of g.rows) {
      if (g.kind === "medicine") for (const c of uniqueNorm(r.conditions)) cond.set(c, (cond.get(c) ?? 0) + 1);
      const ch = channelName(r.community);
      if (ch) chan.set(ch, (chan.get(ch) ?? 0) + 1);
    }
    const examples: string[] = [];
    const seen = new Set<string>();
    for (const r of [...g.rows].sort((a, b) => b.fit - a.fit)) {
      const s = r.summary?.trim();
      if (!s || seen.has(s.toLowerCase())) continue;
      seen.add(s.toLowerCase());
      examples.push(s);
      if (examples.length >= (opts.examples ?? 3)) break;
    }
    out.push({
      topic,
      kind: g.kind,
      raw: mostCommon(g.raws),
      n: g.rows.length,
      strong: g.rows.filter((r) => r.fit >= STRONG_FIT).length,
      withConditions: topKeys(cond, 3),
      examples,
      channels: topKeys(chan, 3),
    });
  }
  // Biggest first, at most `top` of each kind (the page lists the two kinds separately).
  const byKind = (k: ContentIdea["kind"]) =>
    out.filter((i) => i.kind === k).sort((a, b) => b.n - a.n || a.topic.localeCompare(b.topic)).slice(0, opts.top ?? 20);
  return [...byKind("medicine"), ...byKind("condition")];
}

/** "+12", "−3", "0" for a change against the previous period. */
export function changeLabel(n: number, prev: number | null): string | null {
  if (prev === null) return null;
  const d = n - prev;
  return d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : "0";
}
