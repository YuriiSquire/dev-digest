import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillStats } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/skills.json";

const statsMock = vi.fn();
vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkillStats: () => statsMock(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { StatsTab } from "./StatsTab";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "PR Rubric",
  description: "d",
  type: "rubric",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
};

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <StatsTab skill={SKILL} />
    </NextIntlClientProvider>,
  );
}

describe("Skill StatsTab", () => {
  it("renders KPI tiles, agent links and a category donut", () => {
    const stats: SkillStats = {
      used_by_agents: 2,
      agents_using: [{ agent_id: "a1", name: "Security Reviewer" }],
      pull_frequency: 0.4,
      accept_rate: 0.75,
      findings_30d: 9,
      by_category: [{ category: "security", count: 3 }],
    };
    statsMock.mockReturnValue({ data: stats, isLoading: false, isError: false, refetch: vi.fn() });
    renderTab();
    expect(screen.getByText("Used by")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Security Reviewer/ });
    expect(link).toHaveAttribute("href", "/agents/a1?tab=config");
    expect(screen.getByText("security")).toBeInTheDocument();
  });

  it("renders '—' for null ratios and empty-state copy when there is no data", () => {
    const stats: SkillStats = {
      used_by_agents: 0,
      agents_using: [],
      pull_frequency: null,
      accept_rate: null,
      findings_30d: 0,
      by_category: [],
    };
    statsMock.mockReturnValue({ data: stats, isLoading: false, isError: false, refetch: vi.fn() });
    renderTab();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("No agents link this skill yet.")).toBeInTheDocument();
    expect(screen.getByText("No findings recorded yet.")).toBeInTheDocument();
  });
});
