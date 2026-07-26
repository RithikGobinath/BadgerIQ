import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, fmtGpa, type CourseDetail } from "@/lib/api";
import { GradeDist } from "@/components/grade-dist";
import { InstructorTable } from "@/components/instructor-table";

export const revalidate = 3600;

type Props = { params: Promise<{ uuid: string }> };

async function loadCourse(uuid: string): Promise<CourseDetail | null> {
  try {
    return await api.course(uuid);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uuid } = await params;
  const course = await loadCourse(uuid);
  if (!course) return { title: "Course not found" };
  return {
    title: `${course.code} — ${course.name}`,
    description: `Grade distribution and instructor comparison for ${course.code} (${course.name}) at UW-Madison. Average GPA ${fmtGpa(course.gpa)} across ${course.enrollment.toLocaleString()} graded students.`,
  };
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function CoursePage({ params }: Props) {
  const { uuid } = await params;
  const course = await loadCourse(uuid);
  if (!course) notFound();

  const difficultyLine =
    course.difficulty_rank != null && course.difficulty_pctl != null
      ? course.difficulty_pctl >= 0.5
        ? `graded harder than ${Math.round(course.difficulty_pctl * 100)}% of ranked courses (#${course.difficulty_rank})`
        : `graded easier than ${Math.round((1 - course.difficulty_pctl) * 100)}% of ranked courses`
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{course.code}</h1>
        <span className="text-lg text-muted-foreground">{course.name}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {course.subject} · last offered {course.last_term_label}
        {difficultyLine && <> · {difficultyLine}</>}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat value={fmtGpa(course.gpa)} label="Average GPA (enrollment-weighted)" />
        <Stat value={course.enrollment.toLocaleString()} label="Graded students" />
        <Stat
          value={course.pct_a != null ? `${Math.round(course.pct_a * 100)}%` : "—"}
          label="Received an A"
        />
        <Stat value={String(course.n_terms)} label="Terms offered" />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">Grade distribution</h2>
        <div className="rounded-xl border border-border bg-card p-5">
          <GradeDist dist={course.dist} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">By instructor</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Same course, different graders — pick your section accordingly. RMP is the
          instructor&apos;s overall RateMyProfessor rating, matched by name.
        </p>
        <InstructorTable instructors={course.instructors} />
      </section>
    </div>
  );
}
