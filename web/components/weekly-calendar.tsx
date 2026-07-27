import { buildCalendarBlocks, CALENDAR_DAYS, type Conflict, type PlanItem } from "@/lib/plan";

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

const GRID_START_MIN = 8 * 60; // 8:00 AM
const GRID_END_MIN = 21 * 60; // 9:00 PM
const PX_PER_MIN = 0.9;
const GRID_HEIGHT = (GRID_END_MIN - GRID_START_MIN) * PX_PER_MIN;

function fmtHour(min: number): string {
  const h = Math.floor(min / 60);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

export function WeeklyCalendar({ items, conflicts }: { items: PlanItem[]; conflicts: Conflict[] }) {
  const conflictedIds = new Set(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const blocks = buildCalendarBlocks(items, conflictedIds);
  const activeDays = CALENDAR_DAYS.filter(
    (d) => blocks.some((b) => b.day === d) || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].includes(d),
  );
  const hourMarks = Array.from(
    { length: (GRID_END_MIN - GRID_START_MIN) / 60 + 1 },
    (_, i) => GRID_START_MIN + i * 60,
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${activeDays.length}, 1fr)` }}>
        <div />
        {activeDays.map((d) => (
          <div key={d} className="border-b border-l border-border py-2 text-center text-xs font-semibold text-muted-foreground">
            {DAY_LABEL[d]}
          </div>
        ))}

        <div className="relative" style={{ height: GRID_HEIGHT }}>
          {hourMarks.map((min) => (
            <div
              key={min}
              className="absolute right-1.5 -translate-y-2 text-[10px] text-muted-foreground"
              style={{ top: (min - GRID_START_MIN) * PX_PER_MIN }}
            >
              {fmtHour(min)}
            </div>
          ))}
        </div>

        {activeDays.map((day) => (
          <div key={day} className="relative border-l border-border" style={{ height: GRID_HEIGHT }}>
            {hourMarks.map((min) => (
              <div
                key={min}
                className="absolute w-full border-t border-border/60"
                style={{ top: (min - GRID_START_MIN) * PX_PER_MIN }}
              />
            ))}
            {blocks
              .filter((b) => b.day === day)
              .map((b, i) => {
                const top = (b.startMin - GRID_START_MIN) * PX_PER_MIN;
                const height = Math.max((b.endMin - b.startMin) * PX_PER_MIN, 20);
                const width = 100 / b.laneCount;
                return (
                  <div
                    key={`${b.item.id}-${i}`}
                    className="absolute overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-tight"
                    style={{
                      top,
                      height,
                      left: `${b.lane * width}%`,
                      width: `calc(${width}% - 3px)`,
                      background: b.conflicted ? "rgba(208,59,59,0.16)" : "rgba(57,135,229,0.16)",
                      borderColor: b.conflicted ? "var(--crit)" : "var(--data-blue-deep)",
                      color: b.conflicted ? "var(--crit)" : "var(--data-blue)",
                    }}
                    title={`${b.item.courseCode} ${b.item.type} ${b.item.sectionNumber}`}
                  >
                    <div className="truncate font-semibold">{b.item.courseCode}</div>
                    <div className="truncate opacity-80">
                      {b.meeting.start && b.meeting.end ? `${b.meeting.start}–${b.meeting.end}` : ""}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
