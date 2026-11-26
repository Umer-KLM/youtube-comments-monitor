import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cx } from "@/lib/format";
import { changeLabel, INSIGHT_PERIODS, type InsightPeriod, type Ranked } from "@/lib/insights";
import { parseTerm } from "@/lib/queries";

/** Overview / Content ideas tabs and the 7 / 30 day switch, kept in the URL (?days=). */
export function InsightsTabs({ active, days }: { active: "overview" | "ideas"; days: InsightPeriod }) {
  const tabs = [
    { key: "overview", label: "Overview", href: "/insights" },
    { key: "ideas", label: "Content ideas", href: "/insights/ideas" },
  ] as const;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Insights" className="flex gap-1 rounded-full bg-stone-100 p-1 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${t.href}?days=${days}`}
            aria-current={active === t.key ? "page" : undefined}
            className={cx(
              "rounded-full px-3 py-1.5 font-medium transition-colors",
              active === t.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1 text-sm" role="group" aria-label="Period">
        <span className="mr-1 text-stone-500">Posted in the last</span>
        {INSIGHT_PERIODS.map((d) => (
          <Link
            key={d}
            href={`${active === "overview" ? "/insights" : "/insights/ideas"}?days=${d}`}
            aria-current={d === days ? "true" : undefined}
            className={cx(
              "rounded-full px-2.5 py-1 font-medium tabular-nums ring-1 transition-colors",
              d === days ? "bg-emerald-700 text-white ring-emerald-700" : "bg-white text-stone-700 ring-stone-200 hover:bg-stone-50",
            )}
          >
            {d} days
          </Link>
        ))}
      </div>
    </div>
  );
}

/** "+12 vs last week" with an arrow; nothing when there is no previous period. */
export function Change({ n, prev, className }: { n: number; prev: number | null; className?: string }) {
  const label = changeLabel(n, prev);
  if (label === null) return null;
  const up = n > (prev ?? 0);
  const down = n < (prev ?? 0);
  const Icon = up ? TrendingUp : down ? TrendingDown : null;
  return (
    <span className={cx("inline-flex items-center gap-0.5 text-xs tabular-nums text-stone-500", className)} title={`${prev} in the week before`}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {label}
    </span>
  );
}

/** Link to the YouTube page filtered to this condition or medicine, when the filter accepts the spelling. */
export function termHref(raw: string): string | null {
  const t = parseTerm(raw);
  return t ? `/platforms/youtube?term=${encodeURIComponent(t)}` : null;
}

/**
 * A ranked list with one bar per row: one series, so one hue and no legend;
 * the count is written beside every bar in text colour, so the list doubles as
 * its own table. Hovering a row shows the exact numbers.
 */
export function BarList({ title, rows, unit, linkTerms = false, empty }: { title: string; rows: Ranked[]; unit: string; linkTerms?: boolean; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {rows.map((r) => {
            const href = linkTerms ? termHref(r.raw) : null;
            const name = <span className={cx("truncate", linkTerms && "capitalize")}>{r.key}</span>;
            const tip = `${r.key}: ${r.n} ${unit}${r.prev !== null ? ` (${r.prev} the week before)` : ""}`;
            return (
              <li key={r.key} title={tip} className="group text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  {href ? (
                    <Link href={href} className="min-w-0 truncate text-stone-800 underline-offset-2 hover:underline">
                      {name}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate text-stone-800">{name}</span>
                  )}
                  <span className="flex shrink-0 items-baseline gap-2">
                    <Change n={r.n} prev={r.prev} />
                    <span className="font-semibold tabular-nums text-stone-900">{r.n.toLocaleString()}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-100">
                  <div className="h-1.5 rounded-full bg-emerald-600 transition-[width] group-hover:bg-emerald-700" style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
