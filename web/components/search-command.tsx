"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { fmtGpa, type CourseSummary } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8100";

export function SearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CourseSummary[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search courses"
      description="Search UW-Madison courses by code or name"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search courses — try “comp sci 540” or “microeconomics”…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.trim()
            ? loading
              ? "Searching…"
              : "No courses found."
            : "Type a course code or name."}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Courses">
            {results.map((c) => (
              <CommandItem
                key={c.uuid}
                value={c.uuid}
                onSelect={() => {
                  onOpenChange(false);
                  setQuery("");
                  router.push(`/course/${c.uuid}`);
                }}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 whitespace-nowrap font-semibold">{c.code}</span>
                  <span className="truncate text-muted-foreground">{c.name}</span>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  GPA {fmtGpa(c.gpa)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Global provider: mounts the dialog once and binds Cmd/Ctrl-K. */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <SearchContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <SearchCommand open={open} onOpenChange={setOpen} />
    </SearchContext.Provider>
  );
}

export const SearchContext = React.createContext<{ open: () => void }>({
  open: () => {},
});

export const useSearch = () => React.useContext(SearchContext);
