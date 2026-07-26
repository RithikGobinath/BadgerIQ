"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SubjectSelect } from "@/components/subject-select";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtGpa, type CourseSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8100";
const PAGE_SIZE = 50;

function RankingsInner() {
  const params = useSearchParams();
  const [order, setOrder] = React.useState<"hardest" | "easiest">(
    params.get("order") === "easiest" ? "easiest" : "hardest",
  );
  const [subject, setSubject] = React.useState(params.get("subject") ?? "");
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [rows, setRows] = React.useState<CourseSummary[] | null>(null);

  React.useEffect(() => {
    setRows(null);
    const qs = new URLSearchParams({ order, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (subject) qs.set("subject", subject);
    fetch(`${API_BASE}/rankings?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.results ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setRows([]));
  }, [order, subject, page]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Difficulty rankings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ranked by enrollment-weighted average GPA. Only courses with 100+ graded students
        across 3+ terms are ranked, so one rough semester can&apos;t define a course.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5 text-sm">
          {(["hardest", "easiest"] as const).map((o) => (
            <button
              key={o}
              onClick={() => {
                setOrder(o);
                setPage(0);
              }}
              className={cn(
                "rounded px-3 py-1 capitalize text-muted-foreground transition-colors",
                order === o && "bg-secondary text-foreground",
              )}
            >
              {o} first
            </button>
          ))}
        </div>
        <SubjectSelect
          value={subject}
          onChange={(code) => {
            setSubject(code);
            setPage(0);
          }}
        />
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {total.toLocaleString()} courses
        </span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-14 px-4 py-3 text-right font-medium">#</th>
              <th className="px-3 py-3 font-medium">Course</th>
              <th className="px-3 py-3 text-right font-medium">GPA</th>
              <th className="px-3 py-3 text-right font-medium">% A</th>
              <th className="px-4 py-3 text-right font-medium">Students</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows === null
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((c, i) => (
                  <tr key={c.uuid} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {order === "hardest" ? page * PAGE_SIZE + i + 1 : total - page * PAGE_SIZE - i}
                    </td>
                    <td className="max-w-[360px] px-3 py-3">
                      <Link href={`/course/${c.uuid}`} className="group flex min-w-0 items-baseline gap-2">
                        <span className="shrink-0 whitespace-nowrap font-medium group-hover:text-primary">
                          {c.code}
                        </span>
                        <span className="truncate text-muted-foreground">{c.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtGpa(c.gpa)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {c.pct_a != null ? `${Math.round(c.pct_a * 100)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {c.enrollment.toLocaleString()}
                    </td>
                  </tr>
                ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No ranked courses match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors enabled:hover:text-foreground disabled:opacity-40"
          >
            ← Previous
          </button>
          <span className="tabular-nums text-muted-foreground">
            Page {page + 1} of {pages}
          </span>
          <button
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground transition-colors enabled:hover:text-foreground disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default function RankingsPage() {
  return (
    <Suspense>
      <RankingsInner />
    </Suspense>
  );
}
