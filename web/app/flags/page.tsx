"use client";

import * as React from "react";
import Link from "next/link";
import { SubjectSelect } from "@/components/subject-select";
import { Skeleton } from "@/components/ui/skeleton";
import { type Flag } from "@/lib/api";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8100";
const PAGE_SIZE = 30;

const TYPE_META = {
  harsh: {
    label: "Harsh grading",
    color: "var(--crit)",
    icon: "▼",
    blurb: "GPA more than 1 std dev below the subject average",
  },
  inconsistent: {
    label: "Inconsistent",
    color: "var(--warn)",
    icon: "≈",
    blurb: "Large term-to-term GPA swings for the same course",
  },
} as const;

function FlagBadge({ type }: { type: keyof typeof TYPE_META }) {
  const meta = TYPE_META[type];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ borderColor: meta.color, color: meta.color }}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

export default function FlagsPage() {
  const [type, setType] = React.useState<"" | "harsh" | "inconsistent">("");
  const [subject, setSubject] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [rows, setRows] = React.useState<Flag[] | null>(null);

  React.useEffect(() => {
    setRows(null);
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    if (type) qs.set("type", type);
    if (subject) qs.set("subject", subject);
    fetch(`${API_BASE}/flags?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.results ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setRows([]));
  }, [type, subject, page]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Advising flags</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Instructor-course pairs with statistically unusual grading, flagged by explicit
        rules — not a model, and not a judgment of teaching quality. Every flag states
        its reason and the numbers behind it.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5 text-sm">
          {([["", "All"], ["harsh", "Harsh"], ["inconsistent", "Inconsistent"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => {
                setType(v);
                setPage(0);
              }}
              className={cn(
                "rounded px-3 py-1 text-muted-foreground transition-colors",
                type === v && "bg-secondary text-foreground",
              )}
            >
              {label}
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
          {total.toLocaleString()} flags
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {rows === null
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
          : rows.map((f, i) => (
              <div
                key={`${f.course_uuid}-${f.instructor}-${f.type}-${i}`}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="font-semibold">{f.instructor}</span>
                  <Link
                    href={`/course/${f.course_uuid}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {f.course_code}
                  </Link>
                  <span className="text-sm tabular-nums text-muted-foreground">GPA {f.gpa.toFixed(2)}</span>
                  <span className="ml-auto">
                    <FlagBadge type={f.type} />
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{f.reason}.</p>
              </div>
            ))}
        {rows?.length === 0 && (
          <div className="rounded-xl border border-border py-12 text-center text-muted-foreground">
            No flags match this filter.
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm">
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
