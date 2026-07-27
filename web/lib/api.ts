/** Typed client for the BadgerIQ API. */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8100";

export type CourseSummary = {
  uuid: string;
  code: string;
  name: string;
  subject: string;
  gpa: number | null;
  enrollment: number;
  pct_a: number | null;
  n_terms: number;
  last_term_label: string;
  difficulty_rank: number | null;
  difficulty_pctl: number | null;
};

export type Rmp = {
  rating: number | null;
  difficulty: number | null;
  would_take_again: number | null;
  n_ratings: number;
};

export type Instructor = {
  name: string;
  gpa: number | null;
  enrollment: number;
  n_terms: number;
  dist: Record<string, number>;
  trend: [number, number][];
  rmp: Rmp | null;
};

export type GenEdTag = { code: string; description: string };

export type Meeting = {
  days: string | null;
  start: string | null; // "HH:MM", 24h
  end: string | null;
  building: string | null;
  room: string | null;
};

export type Seats = {
  available: number | null;
  waitlist: number | null;
  status: string | null; // "OPEN" | "CLOSED" | "WAITLISTED" | ...
};

export type CurrentSection = {
  section_number: string;
  type: string; // "LEC" | "DIS" | "LAB" | ...
  instruction_mode: string | null;
  instructor: string | null;
  seats: Seats;
  meetings: Meeting[];
  final_exam_date: number | null; // epoch ms
};

export type CurrentOffering = {
  term_code: number;
  term_label: string;
  sections: CurrentSection[];
  last_checked: string; // ISO timestamp
};

export type CourseCatalog = {
  description: string | null;
  credits: { min: number | null; max: number | null; range: string | null };
  prerequisites: { enrollment: string | null; advisory: string | null };
  gen_ed: {
    general_ed: GenEdTag | null;
    ethnic_studies: GenEdTag | null;
    breadths: string[];
    core_general_education: GenEdTag | null;
  };
  current_offering: CurrentOffering | null;
};

export type CourseDetail = CourseSummary & {
  subject_code: string;
  last_term: number;
  dist: Record<string, number>;
  instructors: Instructor[];
  catalog: CourseCatalog | null;
};

export type Flag = {
  type: "harsh" | "inconsistent";
  instructor: string;
  course_uuid: string;
  course_code: string;
  gpa: number;
  subject_avg?: number;
  gpa_std?: number;
  reason: string;
};

export type Stats = {
  built_at: string;
  courses: number;
  ranked_courses: number;
  instructors: number;
  flags: number;
  terms: string;
};

async function get<T>(path: string, revalidate = 3600): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { next: { revalidate } });
  if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
  return res.json();
}

export const api = {
  stats: () => get<Stats>("/stats"),
  search: (q: string) =>
    get<{ results: CourseSummary[] }>(`/search?q=${encodeURIComponent(q)}`, 300),
  course: (uuid: string) => get<CourseDetail>(`/courses/${uuid}`),
  subjects: () => get<{ subjects: { code: string; name: string }[] }>("/subjects"),
  rankings: (params: { order?: "hardest" | "easiest"; subject?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params.order) qs.set("order", params.order);
    if (params.subject) qs.set("subject", params.subject);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    return get<{ total: number; results: CourseSummary[] }>(`/rankings?${qs}`);
  },
  flags: (params: { type?: string; subject?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.subject) qs.set("subject", params.subject);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    return get<{ total: number; results: Flag[] }>(`/flags?${qs}`);
  },
};

/** GPA formatting + shared display helpers */
export const fmtGpa = (g: number | null | undefined) =>
  g == null ? "—" : g.toFixed(2);

export const fmtCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

/** "20:25" (24h) -> "8:25 PM" */
export function fmtClock(hhmm: string | null): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** "MWF" -> "Mon, Wed, Fri" */
const DAY_MAP: Record<string, string> = { M: "Mon", T: "Tue", W: "Wed", R: "Thu", F: "Fri", S: "Sat" };
export function fmtDays(days: string | null): string {
  if (!days) return "—";
  // enroll.wisc.edu uses two-char codes for Th/Su in some payloads; fall
  // back to raw chars for anything unrecognized rather than dropping it.
  const out: string[] = [];
  for (const ch of days) {
    out.push(DAY_MAP[ch] ?? ch);
  }
  return out.join(", ");
}

export function fmtRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function seatsLabel(seats: Seats): { text: string; tone: "open" | "waitlist" | "closed" | "unknown" } {
  if (seats.status === "OPEN" && seats.available != null) {
    return { text: `${seats.available} seat${seats.available === 1 ? "" : "s"} open`, tone: "open" };
  }
  if (seats.status === "WAITLISTED" || (seats.waitlist ?? 0) > 0) {
    return { text: `Waitlisted (${seats.waitlist ?? "?"})`, tone: "waitlist" };
  }
  if (seats.status === "CLOSED") return { text: "Closed", tone: "closed" };
  return { text: seats.status ?? "Unknown", tone: "unknown" };
}
