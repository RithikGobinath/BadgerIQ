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

export type CourseDetail = CourseSummary & {
  subject_code: string;
  last_term: number;
  dist: Record<string, number>;
  instructors: Instructor[];
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
