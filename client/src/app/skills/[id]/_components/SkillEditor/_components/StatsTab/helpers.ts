import type { SkillStats } from "@devdigest/shared";
import type { DonutSegment } from "@devdigest/ui";
import { CATEGORY_COLORS } from "./constants";

/** Format a [0,1] ratio as a whole-percent string, or the dash when null. */
export function formatPct(ratio: number | null | undefined, dash: string): string {
  if (ratio == null) return dash;
  return `${Math.round(ratio * 100)}%`;
}

/** Map by_category counts to donut segments with a cycled colour. */
export function toCategorySegments(byCategory: SkillStats["by_category"]): DonutSegment[] {
  return byCategory.map((c, i) => ({
    label: c.category,
    value: c.count,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] ?? CATEGORY_COLORS[0],
  }));
}
