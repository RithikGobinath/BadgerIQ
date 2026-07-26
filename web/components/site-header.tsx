"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSearch } from "@/components/search-command";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/rankings", label: "Rankings" },
  { href: "/flags", label: "Advising flags" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { open } = useSearch();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={{ background: "var(--brand)" }}
          >
            B
          </span>
          BadgerIQ
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
                pathname.startsWith(item.href) && "bg-secondary text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          onClick={open}
          className="ml-auto flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="hidden sm:inline">Search courses…</span>
          <kbd className="hidden rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}
