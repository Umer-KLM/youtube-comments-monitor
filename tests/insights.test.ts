import { describe, expect, it } from "vitest";
import { changeLabel, channelName, contentIdeas, insightPeriod, normTerm, parsePeriod, summarise, type InsightRow } from "@/lib/insights";

const now = new Date("2026-11-26T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

function row(over: Partial<InsightRow> = {}): InsightRow {
  return {
    intent: "medicine_food_question",
    conditions: ["hypothyroidism"],
    medicines: ["levothyroxine"],
    fit: 80,
    summary: "Asks whether coffee is fine after levothyroxine.",
    community: "YouTube · Dr Thyroid",
    postedAt: daysAgo(1),
    ...over,
  };
}

describe("normTerm", () => {
  it("joins plurals, brands and spellings", () => {
    expect(normTerm("Statins")).toBe("statin");
    expect(normTerm(" Synthroid ")).toBe("levothyroxine");
    expect(normTerm("Thyronorm")).toBe("levothyroxine");
    expect(normTerm("Ozempic")).toBe("semaglutide");
    expect(normTerm("High  Blood Pressure")).toBe("hypertension");
    expect(normTerm("hypothyroid")).toBe("hypothyroidism");
    expect(normTerm("metformin")).toBe("metformin");
  });
});

describe("periods", () => {
  it("parses only 7 or 30", () => {
    expect(parsePeriod("30", 7)).toBe(30);
    expect(parsePeriod("90", 7)).toBe(7);
    expect(parsePeriod(undefined, 30)).toBe(30);
  });
  it("compares the last 7 days with the 7 before, and 30 days with nothing", () => {
    const w = insightPeriod(7, now);
    expect(w.since.toISOString()).toBe(daysAgo(7));
    expect(w.prevSince?.toISOString()).toBe(daysAgo(14));
    expect(insightPeriod(30, now).prevSince).toBeNull();
  });
});

describe("summarise", () => {
  const rows = [
    row(),
    row({ medicines: ["Synthroid"], postedAt: daysAgo(2) }),
    row({ medicines: ["metformin"], conditions: ["type 2 diabetes"], fit: 50, community: "YouTube · Sugar Talk" }),
    row({ intent: "nutrition_question", medicines: [], conditions: ["PCOS"] }),
    row({ postedAt: daysAgo(10) }), // previous week
    row({ postedAt: daysAgo(20) }), // outside both weeks
    row({ postedAt: null }),
  ];
  const s = summarise(rows, now, 7);

  it("counts this week and the week before", () => {
    expect(s.total).toBe(4);
    expect(s.prevTotal).toBe(1);
    expect(s.strong).toBe(3);
    expect(s.byIntent.find((i) => i.intent === "medicine_food_question")).toEqual({ intent: "medicine_food_question", n: 3, prev: 1 });
  });
  it("ranks medicines with brands merged, and keeps the most used spelling", () => {
    expect(s.medicines[0]).toEqual({ key: "levothyroxine", n: 2, prev: 1, raw: "levothyroxine" });
    expect(s.medicines.find((m) => m.key === "metformin")?.n).toBe(1);
  });
  it("ranks channels by name", () => {
    expect(s.channels[0]).toMatchObject({ key: "Dr Thyroid", n: 3 });
  });
  it("has no comparison over 30 days", () => {
    const m = summarise(rows, now, 30);
    expect(m.total).toBe(6);
    expect(m.prevTotal).toBeNull();
    expect(m.medicines[0].prev).toBeNull();
  });
});

describe("contentIdeas", () => {
  it("groups by medicine, else by condition, and drops small groups", () => {
    const rows = [
      row({ fit: 90, summary: "Asks if soy blocks levothyroxine." }),
      row({ medicines: ["Synthroid"], fit: 60, summary: "Asks when to drink coffee after Synthroid." }),
      row({ fit: 70, summary: "Asks if soy blocks levothyroxine." }), // same summary, shown once
      row({ intent: "nutrition_question", medicines: [], conditions: ["PCOS"], summary: "Roti or rice for PCOS?" }),
      row({ intent: "nutrition_question", medicines: [], conditions: ["pcod"], summary: "Is poha fine for PCOS?" }),
      row({ intent: "nutrition_question", medicines: [], conditions: ["pcos", "thyroid"], summary: "Breakfast for PCOS and thyroid?" }),
      row({ medicines: ["metformin"], conditions: [] }), // only 1: left out
    ];
    const ideas = contentIdeas(rows, now, 30);
    expect(ideas.map((i) => `${i.kind}:${i.topic}:${i.n}`)).toEqual(["medicine:levothyroxine:3", "condition:pcos:3"]);
    const levo = ideas[0];
    expect(levo.strong).toBe(2);
    expect(levo.withConditions).toEqual(["hypothyroidism"]);
    expect(levo.examples).toEqual(["Asks if soy blocks levothyroxine.", "Asks when to drink coffee after Synthroid."]);
    expect(levo.channels).toEqual(["Dr Thyroid"]);
  });
});

describe("small helpers", () => {
  it("changeLabel", () => {
    expect(changeLabel(5, 2)).toBe("+3");
    expect(changeLabel(2, 5)).toBe("−3");
    expect(changeLabel(2, 2)).toBe("0");
    expect(changeLabel(2, null)).toBeNull();
  });
  it("channelName", () => {
    expect(channelName("YouTube · Dr Berg")).toBe("Dr Berg");
    expect(channelName(null)).toBeNull();
  });
});
