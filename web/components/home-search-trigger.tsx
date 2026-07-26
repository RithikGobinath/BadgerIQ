"use client";

import { useSearch } from "@/components/search-command";

export function HomeSearchTrigger() {
  const { open } = useSearch();
  return (
    <button
      onClick={open}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-lg shadow-black/30 transition-colors hover:border-ring"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span className="flex-1 text-muted-foreground">
        Search any course — “comp sci 540”, “organic chemistry”…
      </span>
      <kbd className="rounded border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
