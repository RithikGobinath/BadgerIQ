import type { CourseCatalog } from "@/lib/api";

export function GenEdBadges({ genEd }: { genEd: CourseCatalog["gen_ed"] }) {
  const tags = [
    genEd.general_ed?.description,
    genEd.core_general_education?.description,
    genEd.ethnic_studies?.description,
    ...genEd.breadths,
  ].filter((t): t is string => Boolean(t));

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border px-2.5 py-0.5 text-xs font-medium"
          style={{ borderColor: "var(--data-blue-deep)", color: "var(--data-blue)" }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
