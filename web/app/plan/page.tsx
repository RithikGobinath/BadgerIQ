"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { usePlan } from "@/components/plan-provider";
import { WeeklyCalendar } from "@/components/weekly-calendar";
import { api } from "@/lib/api";
import { decodePlanIdsFromUrl, encodePlanForUrl, type PlanItem } from "@/lib/plan";
import { fmtClock, fmtDays } from "@/lib/api";

function ConflictBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div
      className="mb-6 rounded-xl border px-4 py-3 text-sm"
      style={{ borderColor: "var(--crit)", background: "rgba(208,59,59,0.08)", color: "var(--crit)" }}
    >
      {count} time conflict{count === 1 ? "" : "s"} in this plan — conflicting sections are outlined red below.
    </div>
  );
}

function ImportBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { replaceAll } = usePlan();
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle");

  React.useEffect(() => {
    const share = searchParams.get("share");
    if (!share || status !== "idle") return;
    setStatus("loading");
    (async () => {
      const triples = decodePlanIdsFromUrl(share);
      const uniqueUuids = [...new Set(triples.map((t) => t[0]))];
      try {
        const courses = await Promise.all(uniqueUuids.map((u) => api.course(u)));
        const byUuid = new Map(courses.map((c) => [c.uuid, c]));
        const items: PlanItem[] = [];
        for (const [uuid, sectionNumber, type] of triples) {
          const course = byUuid.get(uuid);
          const section = course?.catalog?.current_offering?.sections.find(
            (s) => s.section_number === sectionNumber && s.type === type,
          );
          if (!course || !section) continue;
          items.push({
            id: `${uuid}:${sectionNumber}:${type}`,
            courseUuid: uuid,
            courseCode: course.code,
            courseName: course.name,
            creditsRange: course.catalog?.credits.range ?? null,
            sectionNumber,
            type,
            instructor: section.instructor,
            meetings: section.meetings,
          });
        }
        replaceAll(items);
        setStatus("done");
        router.replace("/plan");
      } catch {
        setStatus("error");
      }
    })();
  }, [searchParams, status, replaceAll, router]);

  if (status === "loading") return <div className="mb-6 text-sm text-muted-foreground">Importing shared plan…</div>;
  if (status === "error")
    return <div className="mb-6 text-sm text-[--crit]">Couldn&apos;t load that shared plan link.</div>;
  return null;
}

function ShareButton() {
  const { items } = usePlan();
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      disabled={items.length === 0}
      onClick={() => {
        const url = `${window.location.origin}/plan?share=${encodePlanForUrl(items)}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors enabled:hover:border-ring enabled:hover:text-foreground disabled:opacity-40"
    >
      {copied ? "Link copied!" : "Share plan"}
    </button>
  );
}

function PlanTable() {
  const { items, conflicts, removeItem } = usePlan();
  const conflictedIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border py-16 text-center text-muted-foreground">
        No sections in your plan yet. Search a course and hit &ldquo;+ Add&rdquo; on a section.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-3 py-3 font-medium">Section</th>
            <th className="px-3 py-3 font-medium">Instructor</th>
            <th className="px-3 py-3 font-medium">Meets</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id} className={conflictedIds.has(item.id) ? "bg-[--crit]/5" : undefined}>
              <td className="px-4 py-3">
                <Link href={`/course/${item.courseUuid}`} className="font-medium hover:text-primary">
                  {item.courseCode}
                </Link>
                <div className="text-xs text-muted-foreground">{item.courseName}</div>
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {item.type} {item.sectionNumber}
              </td>
              <td className="px-3 py-3 text-muted-foreground">{item.instructor ?? "Staff"}</td>
              <td className="px-3 py-3 text-muted-foreground">
                {item.meetings.length === 0
                  ? "TBA"
                  : item.meetings.map((m, i) => (
                      <div key={i}>
                        {fmtDays(m.days)} {fmtClock(m.start)}–{fmtClock(m.end)}
                      </div>
                    ))}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-xs text-muted-foreground hover:text-[--crit]"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlanPage() {
  const { items, conflicts, credits, clear } = usePlan();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Semester</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} section{items.length === 1 ? "" : "s"} · {credits} credits
          </p>
        </div>
        <div className="flex gap-2">
          <ShareButton />
          {items.length > 0 && (
            <button
              onClick={clear}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-[--crit] hover:text-[--crit]"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        <React.Suspense fallback={null}>
          <ImportBanner />
        </React.Suspense>
        <ConflictBanner count={conflicts.length} />
      </div>

      {items.length > 0 && (
        <section className="mb-8">
          <WeeklyCalendar items={items} conflicts={conflicts} />
        </section>
      )}

      <PlanTable />
    </div>
  );
}
