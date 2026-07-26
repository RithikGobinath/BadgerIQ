/** Horizontal bar list for a course's grade distribution.
 *
 * One bar per grade (magnitude comparison), data-blue fills with the value
 * labeled at the bar tip - identity comes from the row label, not color.
 */

const GRADE_ORDER = ["a", "ab", "b", "bc", "c", "d", "f"] as const;
const GRADE_LABELS: Record<string, string> = {
  a: "A", ab: "AB", b: "B", bc: "BC", c: "C", d: "D", f: "F",
};

export function GradeDist({ dist }: { dist: Record<string, number> }) {
  const total = GRADE_ORDER.reduce((s, g) => s + (dist[g] ?? 0), 0);
  if (!total) return null;
  const max = Math.max(...GRADE_ORDER.map((g) => dist[g] ?? 0));

  return (
    <div className="flex flex-col gap-2">
      {GRADE_ORDER.map((g) => {
        const n = dist[g] ?? 0;
        const pct = (n / total) * 100;
        return (
          <div key={g} className="grid grid-cols-[28px_1fr_110px] items-center gap-3">
            <span className="text-sm font-semibold text-[--ink-secondary]">
              {GRADE_LABELS[g]}
            </span>
            <div className="h-5 rounded-[4px] bg-[--grid]">
              <div
                className="h-5 rounded-[4px] bg-primary"
                style={{ width: `${max ? Math.max((n / max) * 100, n > 0 ? 1 : 0) : 0}%` }}
              />
            </div>
            <span className="text-right text-sm tabular-nums text-muted-foreground">
              {pct >= 0.05 ? `${pct.toFixed(1)}%` : n > 0 ? "<0.1%" : "0%"}
              <span className="ml-1.5 hidden text-xs sm:inline">({n.toLocaleString()})</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact 100%-stacked distribution strip for table rows.
 *
 * Grades are ordinal, so a monotone blue ramp carries magnitude; adjacent
 * segments separate via 2px surface gaps, not hue distance.
 */
const RAMP: Record<string, string> = {
  a: "#9ec5f4", ab: "#6da7ec", b: "#3987e5", bc: "#256abf",
  c: "#1c5cab", d: "#184f95", f: "#104281",
};

export function DistStrip({ dist, className }: { dist: Record<string, number>; className?: string }) {
  const total = GRADE_ORDER.reduce((s, g) => s + (dist[g] ?? 0), 0);
  if (!total) return null;
  return (
    <div
      className={`flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full ${className ?? ""}`}
      title={GRADE_ORDER.map((g) => `${GRADE_LABELS[g]} ${(((dist[g] ?? 0) / total) * 100).toFixed(1)}%`).join(" · ")}
    >
      {GRADE_ORDER.map((g) => {
        const pct = ((dist[g] ?? 0) / total) * 100;
        if (pct < 0.75) return null;
        return (
          <div
            key={g}
            style={{ width: `${pct}%`, background: RAMP[g] }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        );
      })}
    </div>
  );
}
