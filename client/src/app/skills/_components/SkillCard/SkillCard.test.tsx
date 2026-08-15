import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillStats } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";

const statsMock = vi.fn();
vi.mock("../../../../lib/hooks/skills", () => ({
  useSkillStats: (id: string) => statsMock(id),
}));

import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "PR Quality Rubric",
  description: "Scores diffs against a rubric",
  type: "rubric",
  source: "manual",
  body: "# Rubric",
  enabled: true,
  version: 1,
};

const STATS: SkillStats = {
  used_by_agents: 3,
  agents_using: [{ agent_id: "a1", name: "Sec" }],
  pull_frequency: 0.63,
  accept_rate: 0.5,
  findings_30d: 12,
  by_category: [{ category: "security", count: 4 }],
};

function renderCard(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SkillCard", () => {
  it("renders name, type + source badges and the stats footer", () => {
    statsMock.mockReturnValue({ data: STATS });
    renderCard(<SkillCard skill={SKILL} />);
    expect(screen.getByText("PR Quality Rubric")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("3 agents · 63% pull · 50% accept")).toBeInTheDocument();
  });

  it("shows an em-dash footer when stats are null", () => {
    statsMock.mockReturnValue({ data: undefined });
    renderCard(<SkillCard skill={SKILL} />);
    expect(screen.getByText("— agents · — pull · — accept")).toBeInTheDocument();
  });

  it("flags an untrusted, disabled skill as needing vetting", () => {
    statsMock.mockReturnValue({ data: undefined });
    renderCard(<SkillCard skill={{ ...SKILL, source: "community", enabled: false }} />);
    expect(screen.getByText("needs vetting")).toBeInTheDocument();
  });

  it("does not flag a manual skill even when disabled", () => {
    statsMock.mockReturnValue({ data: undefined });
    renderCard(<SkillCard skill={{ ...SKILL, enabled: false }} />);
    expect(screen.queryByText("needs vetting")).not.toBeInTheDocument();
  });

  it("toggles enabled without triggering the card click", () => {
    statsMock.mockReturnValue({ data: undefined });
    const onToggle = vi.fn();
    const onClick = vi.fn();
    renderCard(<SkillCard skill={SKILL} onToggle={onToggle} onClick={onClick} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();
  });
});
