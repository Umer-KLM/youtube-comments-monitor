import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { INTENT_LABEL } from "@/lib/format";
import { insightPeriod, parsePeriod, STRONG_FIT, summarise } from "@/lib/insights";
import { loadInsightRows } from "@/lib/queries";
import { BarList, Change, InsightsTabs } from "@/components/insights-ui";
import { PageHeader, Section } from "@/components/stat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Insights" };

type Params = Record<string, string | string[] | undefined>;

/**
 * What people asked, counted from the tags Gemini already wrote. No AI call
 * happens here. Only approachable questions count (src/lib/insights.ts).
 */
export default async function InsightsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const sp = await searchParams;
  const days = parsePeriod(sp.days, 7);
  const now = new Date();
  const { since, prevSince } = insightPeriod(days, now);
  const rows = await loadInsightRows(prevSince ?? since);
  const s = summarise(rows, now, days);
  const unit = "questions";
  const vs = s.prevTotal !== null ? "vs the week before" : null;

  return (
    <div>
      <PageHeader icon={<ChartColumn className="size-5 text-emerald-700" aria-hidden />} title="Insights" count={s.total}>
        What people asked under the videos we watch, counted from the tags Gemini already wrote, so this page costs no AI calls. Only questions someone could be approached
        about are counted: off-topic and &ldquo;not suitable&rdquo; comments are left out. Counted by the day the comment was posted.
      </PageHeader>

      <InsightsTabs active="overview" days={days} />

      {s.total === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
          <Inbox className="size-8 text-stone-400" aria-hidden />
          <p className="mt-3 font-medium text-stone-800">No questions posted in the last {days} days yet</p>
          <p className="mt-1 max-w-md text-sm text-stone-500">
            Comments are read every 3 hours. Try the {days === 7 ? "30-day" : "7-day"} view, or come back after the next run.
          </p>
        </div>
      ) : (
        <>
          <Section title="Questions" description={vs ? `Changes are ${vs}.` : "Comments are kept for 30 days, so there is no month-before comparison."}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              <Tile label="All questions" n={s.total} prev={s.prevTotal} />
              <Tile label={`Strong fit (${STRONG_FIT}+)`} n={s.strong} prev={null} />
              {s.byIntent.map((i) => (
                <Tile key={i.intent} label={INTENT_LABEL[i.intent] ?? i.intent} n={i.n} prev={i.prev} />
              ))}
            </div>
          </Section>

          <Section title="What they ask about" description="Brand names are counted with their medicine (Synthroid and Thyronorm as levothyroxine, Ozempic as semaglutide). Click a name to see those comments.">
            <div className="grid gap-3 md:grid-cols-2 [&>*]:min-w-0">
              <BarList title="Medicines" rows={s.medicines} unit={unit} linkTerms empty="No medicine named in this period." />
              <BarList title="Conditions" rows={s.conditions} unit={unit} linkTerms empty="No condition named in this period." />
            </div>
          </Section>

          <Section title="Where they ask" description="The channels whose viewers asked the most. A good list for creator partnerships.">
            <BarList title="Channels" rows={s.channels} unit={unit} empty="No channel in this period." />
          </Section>

          <p className="mt-6 text-sm text-stone-600">
            Turn these into articles and videos on the{" "}
            <Link href={`/insights/ideas?days=${days}`} className="font-medium text-emerald-800 underline underline-offset-2">
              Content ideas
            </Link>{" "}
            tab.
          </p>
        </>
      )}
    </div>
  );
}

function Tile({ label, n, prev }: { label: string; n: number; prev: number | null }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold leading-tight tabular-nums text-stone-900">{n.toLocaleString()}</span>
        <Change n={n} prev={prev} />
      </div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}
