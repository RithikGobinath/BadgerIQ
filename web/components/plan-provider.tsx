"use client";

import * as React from "react";
import {
  type Conflict,
  type PlanItem,
  findConflicts,
  loadPlan,
  planItemId,
  savePlan,
  totalCredits,
} from "@/lib/plan";

type PlanContextValue = {
  items: PlanItem[];
  conflicts: Conflict[];
  credits: number;
  isInPlan: (courseUuid: string, sectionNumber: string, type: string) => boolean;
  addItem: (item: PlanItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  replaceAll: (items: PlanItem[]) => void;
};

const PlanContext = React.createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<PlanItem[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  // Load from localStorage only after mount - avoids an SSR/client markup
  // mismatch, since the server has no localStorage to read from.
  React.useEffect(() => {
    setItems(loadPlan());
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (hydrated) savePlan(items);
  }, [items, hydrated]);

  const addItem = React.useCallback((item: PlanItem) => {
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = React.useCallback(() => setItems([]), []);
  const replaceAll = React.useCallback((next: PlanItem[]) => setItems(next), []);

  const isInPlan = React.useCallback(
    (courseUuid: string, sectionNumber: string, type: string) =>
      items.some((i) => i.id === planItemId(courseUuid, sectionNumber, type)),
    [items],
  );

  const conflicts = React.useMemo(() => findConflicts(items), [items]);
  const credits = React.useMemo(() => totalCredits(items), [items]);

  return (
    <PlanContext.Provider value={{ items, conflicts, credits, isInPlan, addItem, removeItem, clear, replaceAll }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = React.useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside <PlanProvider>");
  return ctx;
}
