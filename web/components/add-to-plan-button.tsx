"use client";

import { usePlan } from "@/components/plan-provider";
import { planItemId, type PlanItem } from "@/lib/plan";

export function AddToPlanButton({ item }: { item: PlanItem }) {
  const { isInPlan, addItem, removeItem } = usePlan();
  const inPlan = isInPlan(item.courseUuid, item.sectionNumber, item.type);
  const id = planItemId(item.courseUuid, item.sectionNumber, item.type);

  return (
    <button
      onClick={() => (inPlan ? removeItem(id) : addItem(item))}
      className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
      style={
        inPlan
          ? { borderColor: "var(--good)", color: "var(--good)" }
          : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
      }
    >
      {inPlan ? "✓ Added" : "+ Add"}
    </button>
  );
}
