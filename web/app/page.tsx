import Link from "next/link";
import { api, fmtGpa, type CourseSummary, type Stats } from "@/lib/api";
import { HomeSearchTrigger } from "@/components/home-search-trigger";

export const revalidate = 3600;

async function loadData(): Promise<{
  stats: Stats | null;
  hardest: CourseSummary[];
  easiest: CourseSummary[];
}> {
  try {
    const [stats, hard, easy] = await Promise.all([
      api.stats(),
      api.rankings({ order: "hardest", limit: 5 }),
      api.rankings({ order: "easiest", limit: 5 }),
    ]);
    return { stats, hardest: hard.results, easiest: easy.results };
  } catch {
    return { stats: null, hardest: [], easiest: [] };
  }
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TeaserList({
  title,
  subtitle,
  courses,
  href,
}: {
  title: string;
  subtitle: string;
  courses: CourseSummary[];
  href: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-sm text-primary hover:underline underline-offset-4">
          See all →
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      <ul className="mt-4 divide-y divide-border">
        {courses.map((c) => (
          <li key={c.uuid}>
            <Link
              href={`/course/${c.uuid}`}
              className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-secondary/50"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 whitespace-nowrap font-medium">{c.code}</span>
                <span className="truncate text-sm text-muted-foreground">{c.name}</span>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {fmtGpa(c.gpa)}
              </span>
            </Link>
          </li>
        ))}
        {courses.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            Data loads once the API is reachable.
          </li>
        )}
      </ul>
    </div>
  );
}

export default async function Home() {
  const { stats, hardest, easiest } = await loadData();

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="relative py-20 text-center sm:py-28">
        <div
          className="pointer-events-none absolute inset-x-0 -top-14 mx-auto h-72 w-[36rem] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
        />
        <h1 className="relative text-4xl font-bold tracking-tight sm:text-5xl">
          Know the grade
          <br />
          before you enroll.
        </h1>
        <p className="relative mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Real grade distributions for every UW–Madison course and instructor —
          20 years of Madgrades data and RateMyProfessor ratings, in one search.
        </p>
        <div className="relative mx-auto mt-8 max-w-lg">
          <HomeSearchTrigger />
        </div>

        {stats && (
          <div className="relative mx-auto mt-14 grid max-w-2xl grid-cols-2 gap-8 sm:grid-cols-4">
            <StatBlock value={stats.courses.toLocaleString()} label="Courses" />
            <StatBlock value={stats.instructors.toLocaleString()} label="Instructors" />
            <StatBlock value={stats.flags.toLocaleString()} label="Advising flags" />
            <StatBlock value="20 yrs" label={stats.terms} />
          </div>
        )}
      </section>

      <section className="grid gap-5 pb-20 md:grid-cols-2">
        <TeaserList
          title="Toughest graded courses"
          subtitle="Lowest average GPA, min. 100 students across 3+ terms"
          courses={hardest}
          href="/rankings"
        />
        <TeaserList
          title="Most generously graded"
          subtitle="Highest average GPA over the same bar"
          courses={easiest}
          href="/rankings?order=easiest"
        />
      </section>
    </div>
  );
}
