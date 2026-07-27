import type { CurrentOffering } from "@/lib/api";
import { fmtClock, fmtDays, fmtRelativeTime, seatsLabel } from "@/lib/api";

const TONE_STYLES: Record<string, { bg: string; fg: string }> = {
  open: { bg: "rgba(12,163,12,0.12)", fg: "var(--good)" },
  waitlist: { bg: "rgba(236,131,90,0.14)", fg: "var(--warn)" },
  closed: { bg: "rgba(208,59,59,0.14)", fg: "var(--crit)" },
  unknown: { bg: "var(--secondary)", fg: "var(--muted-foreground)" },
};

function SeatsBadge({ seats }: { seats: import("@/lib/api").Seats }) {
  const { text, tone } = seatsLabel(seats);
  const style = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: style.bg, color: style.fg }}
    >
      {text}
    </span>
  );
}

export function CurrentSections({ offering }: { offering: CurrentOffering | null }) {
  if (!offering || offering.sections.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Not currently scheduled — no offering in the open registration terms.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between text-sm text-muted-foreground">
        <span>{offering.term_label}</span>
        <span>Seats checked {fmtRelativeTime(offering.last_checked)}</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-3 py-3 font-medium">Instructor</th>
              <th className="px-3 py-3 font-medium">Meets</th>
              <th className="px-4 py-3 text-right font-medium">Seats</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {offering.sections.map((s, i) => (
              <tr key={`${s.section_number}-${i}`} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-3">
                  <span className="font-medium">{s.type}</span>{" "}
                  <span className="text-muted-foreground">{s.section_number}</span>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{s.instructor ?? "Staff"}</td>
                <td className="px-3 py-3">
                  {s.meetings.length === 0 ? (
                    <span className="text-muted-foreground">
                      {s.instruction_mode?.includes("Online") ? "Online" : "TBA"}
                    </span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {s.meetings.map((m, mi) => (
                        <div key={mi}>
                          <span className="font-medium">{fmtDays(m.days)}</span>{" "}
                          <span className="text-muted-foreground">
                            {fmtClock(m.start)}–{fmtClock(m.end)}
                            {m.building && (
                              <>
                                {" · "}
                                {m.building} {m.room}
                              </>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <SeatsBadge seats={s.seats} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
