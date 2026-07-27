/** "My Semester" plan: client-only, no auth needed. localStorage is the
 * source of truth; the URL is just an export/import format for sharing. */
import type { Meeting } from "@/lib/api";

export type PlanItem = {
  id: string; // `${courseUuid}:${sectionNumber}:${type}` - stable, dedupe key
  courseUuid: string;
  courseCode: string;
  courseName: string;
  creditsRange: string | null;
  sectionNumber: string;
  type: string;
  instructor: string | null;
  meetings: Meeting[];
};

export function planItemId(courseUuid: string, sectionNumber: string, type: string): string {
  return `${courseUuid}:${sectionNumber}:${type}`;
}

const STORAGE_KEY = "badgeriq.plan.v1";

export function loadPlan(): PlanItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PlanItem[]) : [];
  } catch {
    return [];
  }
}

export function savePlan(items: PlanItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Parse "HH:MM" to minutes-since-midnight for range comparison. */
export function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function meetingsOverlap(a: Meeting, b: Meeting): boolean {
  // Defensive: a stale cached API response or an edge-case section (TBA,
  // async) can carry no days_list. Treat that as "can't prove a conflict"
  // rather than crashing the whole plan page over one malformed meeting -
  // caught exactly this way when a Next.js fetch cache served a
  // pre-migration API response missing the field entirely.
  const aDays = a.days_list ?? [];
  const bDays = b.days_list ?? [];
  const sharedDay = aDays.some((d) => bDays.includes(d));
  if (!sharedDay) return false;
  const aStart = toMinutes(a.start);
  const aEnd = toMinutes(a.end);
  const bStart = toMinutes(b.start);
  const bEnd = toMinutes(b.end);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  // standard interval overlap, half-open so back-to-back classes don't collide
  return aStart < bEnd && bStart < aEnd;
}

export type Conflict = { a: PlanItem; b: PlanItem };

/** All pairwise conflicts across the whole plan - O(n^2) but n is a
 * semester's worth of sections (tens, not thousands), so this is fine. */
export function findConflicts(items: PlanItem[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.courseUuid === b.courseUuid) continue; // don't flag two sections of the same course as "conflicting"
      const clash = a.meetings.some((ma) => b.meetings.some((mb) => meetingsOverlap(ma, mb)));
      if (clash) conflicts.push({ a, b });
    }
  }
  return conflicts;
}

export function conflictIds(conflicts: Conflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.a.id);
    ids.add(c.b.id);
  }
  return ids;
}

/** Rough credit total - parses "3" or "1-3" style ranges, taking the max
 * (the common case for planning: "how many credits could this add up to"). */
export function totalCredits(items: PlanItem[]): number {
  let total = 0;
  for (const item of items) {
    if (!item.creditsRange) continue;
    const nums = item.creditsRange.match(/\d+(\.\d+)?/g);
    if (!nums) continue;
    total += Math.max(...nums.map(Number));
  }
  return Math.round(total * 10) / 10;
}

export type CalendarBlock = {
  item: PlanItem;
  meeting: Meeting;
  day: string; // "MONDAY", etc
  startMin: number;
  endMin: number;
  lane: number;
  laneCount: number;
  conflicted: boolean;
};

export const CALENDAR_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/** Lay out each day's meetings into side-by-side lanes so overlapping
 * sections don't visually stack on top of each other. Greedy interval
 * scheduling: sort by start time, reuse the first lane that's free, open a
 * new lane otherwise. laneCount is the day's total lane count (a slight
 * simplification vs. computing the exact concurrent-max per block - fine
 * because real conflicts are the flagged exception, not the common case,
 * so most days never have more than one lane anyway). */
export function buildCalendarBlocks(items: PlanItem[], conflictedIds: Set<string>): CalendarBlock[] {
  type Raw = { item: PlanItem; meeting: Meeting; day: string; startMin: number; endMin: number };
  const byDay = new Map<string, Raw[]>();

  for (const item of items) {
    for (const meeting of item.meetings) {
      const startMin = toMinutes(meeting.start);
      const endMin = toMinutes(meeting.end);
      if (startMin == null || endMin == null) continue;
      for (const day of meeting.days_list ?? []) {
        const list = byDay.get(day) ?? [];
        list.push({ item, meeting, day, startMin, endMin });
        byDay.set(day, list);
      }
    }
  }

  const blocks: CalendarBlock[] = [];
  for (const [, dayItems] of byDay) {
    const sorted = [...dayItems].sort((a, b) => a.startMin - b.startMin);
    const laneEnds: number[] = [];
    const withLane = sorted.map((r) => {
      let lane = laneEnds.findIndex((end) => end <= r.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(r.endMin);
      } else {
        laneEnds[lane] = r.endMin;
      }
      return { ...r, lane };
    });
    const laneCount = laneEnds.length;
    for (const b of withLane) {
      blocks.push({ ...b, laneCount, conflicted: conflictedIds.has(b.item.id) });
    }
  }
  return blocks;
}

/** Share format: compact, not full JSON, to keep URLs short. */
export function encodePlanForUrl(items: PlanItem[]): string {
  const compact = items.map((i) => [i.courseUuid, i.sectionNumber, i.type]);
  return encodeURIComponent(btoa(JSON.stringify(compact)));
}

export function decodePlanIdsFromUrl(param: string): [string, string, string][] {
  try {
    return JSON.parse(atob(decodeURIComponent(param)));
  } catch {
    return [];
  }
}
