import type { IconName } from "@devdigest/ui";

/** Editor tab descriptor. `labelKey` resolves under `skills.detail.tabs`. */
export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/** Interactive tabs. */
export const ENABLED_TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "config", icon: "Settings" },
  { key: "preview", labelKey: "preview", icon: "Eye" },
  { key: "stats", labelKey: "stats", icon: "BarChart" },
];

/** Placeholder tabs, rendered disabled until later lessons build them. */
export const DISABLED_TABS: readonly EditorTab[] = [
  { key: "evals", labelKey: "evals", icon: "FlaskConical" },
  { key: "versions", labelKey: "versions", icon: "History" },
];

/** Keys that actually route/render. */
export const VALID_TABS: readonly string[] = ENABLED_TABS.map((t) => t.key);
