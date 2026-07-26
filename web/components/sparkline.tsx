/** Tiny GPA-over-terms sparkline (SVG, 2px line, end dot with surface ring). */

export function Sparkline({
  points,
  width = 96,
  height = 28,
}: {
  points: [number, number][]; // [term_code, gpa]
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return <span className="text-xs text-muted-foreground">—</span>;

  const gpas = points.map((p) => p[1]);
  const min = Math.min(...gpas);
  const max = Math.max(...gpas);
  const span = max - min || 0.5; // flat lines get a visible midline
  const pad = 4;

  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (p[1] - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ex, ey] = xy[xy.length - 1];

  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <path d={d} fill="none" stroke="var(--data-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ex} cy={ey} r="4" fill="var(--data-blue)" stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
}
