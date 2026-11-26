import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Lightbulb, Pill, Stethoscope, Tv } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { contentIdeas, insightPeriod, parsePeriod, STRONG_FIT, type ContentIdea } from "@/lib/insights";
import { loadInsightRows } from "@/lib/queries";
import { InsightsTabs, termHref } from "@/components/insights-ui";
import { PageHeader, Section } from "@/components/stat";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Content ideas" };

type Params = Record<string, string | string[] | undefined>;

/**
 * Groups of questions that are asked again and again, each worth one article,
 * Short or post. Built from the tags Gemini already wrote; no AI call here.
 */
export default async function IdeasPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const sp = await searchParams;
  const days = parsePeriod(sp.days, 30);
  const now = new Date();
  const rows = await loadInsightRows(insightPeriod(days, now).since);
  const ideas = contentIdeas(rows, now, days);
  const medicine = ideas.filter((i) => i.kind === "medicine");
  const condition = ideas.filter((i) => i.kind === "condition");

  return (
    <div>
      <PageHeader icon={<Lightbulb className="size-5 text-emerald-700" aria-hidden />} title="Content ideas" count={ideas.length}>
        Questions people keep asking, grouped by topic. Each group is one article, Short or post that answers many real questions at once. The examples are Gemini&apos;s
        one-line summaries, never the commenter&apos;s own words, and no names are kept. Groups with fewer than 3 questions are left out.
      </PageHeader>

      <InsightsTabs active="ideas" days={days} />

      {ideas.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
          <Inbox className="size-8 text-stone-400" aria-hidden />
          <p className="mt-3 font-medium text-stone-800">Not enough questions yet</p>
          <p className="mt-1 max-w-md text-sm text-stone-500">A topic appears once 3 questions about it were posted in the last {days} days.</p>
        </div>
      ) : (
        <>
          <Section
            icon={Pill}
            title="Food with a medicine"
            description="Hash's own topic: what to eat, or avoid, with a medicine. These make the strongest articles, because the app answers exactly this."
          >
            <IdeaList ideas={medicine} empty="No medicine was asked about 3 times or more in this period." />
          </Section>
          <Section icon={Stethoscope} title="Food for a condition" description="Diet questions that name a condition but no medicine.">
            <IdeaList ideas={condition} empty="No condition was asked about 3 times or more in this period." />
          </Section>
        </>
      )}
    </div>
  );
}

function IdeaList({ ideas, empty }: { ideas: ContentIdea[]; empty: string }) {
  if (ideas.length === 0) return <p className="text-sm text-stone-500">{empty}</p>;
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {ideas.map((idea) => (
        <li key={`${idea.kind}:${idea.topic}`} className="min-w-0">
          <IdeaCard idea={idea} />
        </li>
      ))}
    </ol>
  );
}

function IdeaCard({ idea }: { idea: ContentIdea }) {
  const href = termHref(idea.raw);
  const title = idea.kind === "medicine" ? `Food with ${idea.topic}` : `Diet for ${idea.topic}`;
  return (
    <article className="flex h-full flex-col rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-stone-200">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-stone-900">{title}</h3>
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-800" title={`${idea.strong} with a fit of ${STRONG_FIT} or more`}>
          {idea.n} {idea.n === 1 ? "question" : "questions"}
        </span>
      </div>
      {idea.withConditions.length > 0 && <p className="mt-1 text-xs text-stone-500">Mostly asked by people with {idea.withConditions.join(", ")}</p>}
      {idea.examples.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-stone-700">
          {idea.examples.map((e) => (
            <li key={e} className="border-l-2 border-emerald-200 pl-2.5 leading-snug">
              {e}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-stone-500">
        {idea.channels.length > 0 ? (
          <span className="flex min-w-0 items-center gap-1">
            <Tv className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{idea.channels.join(" · ")}</span>
          </span>
        ) : (
          <span />
        )}
        {href && (
          <Link href={href} className="shrink-0 font-medium text-emerald-800 underline underline-offset-2">
            See the comments
          </Link>
        )}
      </div>
    </article>
  );
}
