"use client";

import * as React from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8100";

export function SubjectSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [subjects, setSubjects] = React.useState<{ code: string; name: string }[]>([]);

  React.useEffect(() => {
    fetch(`${API_BASE}/subjects`)
      .then((r) => r.json())
      .then((d) => setSubjects(d.subjects ?? []))
      .catch(() => {});
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none transition-colors hover:border-ring focus:border-ring"
    >
      <option value="">All subjects</option>
      {subjects.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
