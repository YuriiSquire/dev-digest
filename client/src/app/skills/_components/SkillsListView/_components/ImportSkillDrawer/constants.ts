import type { IconName } from "@devdigest/ui";

export type ImportTab = "file" | "url" | "community";

/** Drawer tab descriptors; labels resolve under skills.drawer.tabs. */
export const IMPORT_TABS: readonly { key: ImportTab; labelKey: string; icon: IconName }[] = [
  { key: "file", labelKey: "tabs.file", icon: "Upload" },
  { key: "url", labelKey: "tabs.url", icon: "Globe" },
  { key: "community", labelKey: "tabs.community", icon: "Users" },
];

export const DRAWER_WIDTH = 640;
