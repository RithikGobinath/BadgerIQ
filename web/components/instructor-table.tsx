"use client";

import * as React from "react";
import { DistStrip } from "@/components/grade-dist";
import { Sparkline } from "@/components/sparkline";
import { fmtGpa, type Instructor } from "@/lib/api";
import { cn } from "@/lib/utils";

type SortKey = "enrollment" | "gpa";
const MIN_SHOWN_ENROLLMENT = 20;

export function InstructorTable({ instructors }: { instructors: Instructor[] }) {
  const [sort, setSort] = React.useState<SortKey>("enrollment");
  const [showAll, setShowAll] = React.useState(false);

  const filtered = showAll
    ? instructors
    : instructors.filter((i) => i.enrollment >= MIN_SHOWN_ENROLLMENT);
  const hidden = instructors.length - filtered.length;

  const rows = [...filtered].sort((a, b) =>
    sort === "enrollment"
      ? b.enrollment - a.enrollment
      : (b.gpa ?? -1) - (a.gpa ?? -1),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} instructor{rows.length === 1 ? "" : "s"}
          {hidden > 0 && !showAll && (
            <>
              {" · "}
              <button className="text-primary hover:underline underline-offset-4" onClick={() => setShowAll(true)}>
                show {hidden} with fewer than {MIN_SHOWN_ENROLLMENT} students
              </button>
            </>
          )}
        </p>
        <div className="flex rounded-md border border-border p-0.5 text-xs">
          {(["enrollment", "gpa"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={cn(
                "rounded px-2.5 py-1 text-muted-foreground transition-colors",
                sort === k && "bg-secondary text-foreground",
              )}
            >
              {k === "enrollment" ? "Most students" : "Highest GPA"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Instructor</th>
              <th className="px-3 py-3 text-right font-medium">GPA</th>
              <th className="px-3 py-3 text-right font-medium">Students</th>
              <th className="px-3 py-3 font-medium">Grade mix</th>
              <th className="px-3 py-3 font-medium">GPA trend</th>
              <th className="px-4 py-3 text-right font-medium">RMP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((i) => (
              <tr key={i.name} className="transition-colors hover:bg-secondary/40">
                <td className="max-w-[220px] truncate px-4 py-3 font-medium">{i.name}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fmtGpa(i.gpa)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {i.enrollment.toLocaleString()}
                  <span className="ml-1 text-xs">/ {i.n_terms}t</span>
                </td>
                <td className="w-[160px] px-3 py-3">
                  <DistStrip dist={i.dist} />
                </td>
                <td className="px-3 py-3">
                  <Sparkline points={i.trend} />
                </td>
                <td className="px-4 py-3 text-right">
                  {i.rmp ? (
                    <span
                      className="tabular-nums"
                      title={`${i.rmp.n_ratings} ratings · difficulty ${i.rmp.difficulty ?? "—"}/5 · ${i.rmp.would_take_again != null ? Math.round(i.rmp.would_take_again) + "% would take again" : "no retake data"}`}
                    >
                      {i.rmp.rating?.toFixed(1) ?? "—"}
                      <span className="text-xs text-muted-foreground">/5</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
