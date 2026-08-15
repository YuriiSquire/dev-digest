import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, AgentSkillLink, Agent } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";

// Hoisted spy so the mocked useSetAgentSkills can expose a stable mutate fn.
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

const SKILLS: Skill[] = [
  { id: "s1", name: "Rubric One", description: "", type: "rubric", source: "manual", body: "", enabled: true, version: 1 },
  { id: "s2", name: "Security Two", description: "", type: "security", source: "manual", body: "", enabled: true, version: 1 },
  { id: "s3", name: "Custom Three", description: "", type: "custom", source: "manual", body: "", enabled: true, version: 1 },
];

// Bound: s1 (order 0), s2 (order 1). s3 is unbound.
const LINKS: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "s1", order: 0 },
  { agent_id: "ag1", skill_id: "s2", order: 1 },
];

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false }),
  useAgentSkills: () => ({ data: LINKS }),
  useSetAgentSkills: () => ({ mutate }),
}));

import { SkillsTab } from "./SkillsTab";

const AGENT = { id: "ag1", name: "Agent" } as unknown as Agent;

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => mutate.mockClear());
afterEach(cleanup);

describe("A2/L03 SkillsTab", () => {
  it("shows 'N of M enabled' from the bound links", () => {
    renderTab();
    expect(screen.getByText("2 of 3 enabled")).toBeInTheDocument();
  });

  it("toggling an unbound skill's checkbox persists it appended to the bound ids", () => {
    renderTab();
    const row = screen.getByTestId("skill-row-s3");
    fireEvent.click(within(row).getByRole("checkbox"));
    expect(mutate).toHaveBeenCalledWith(["s1", "s2", "s3"]);
  });

  it("toggling a bound skill's checkbox persists it removed from the bound ids", () => {
    renderTab();
    const row = screen.getByTestId("skill-row-s1");
    fireEvent.click(within(row).getByRole("checkbox"));
    expect(mutate).toHaveBeenCalledWith(["s2"]);
  });

  it("drag-reordering bound skills persists the reordered bound ids EXACTLY ONCE", () => {
    renderTab();
    const s1Row = screen.getByTestId("skill-row-s1");
    const s2Row = screen.getByTestId("skill-row-s2");
    // Drag s2 above s1 → bound order becomes [s2, s1]. The full lifecycle fires
    // drop THEN dragend; persist must run once (on dragend), not once per event —
    // two concurrent POSTs raced into a duplicate agent_skills PK.
    fireEvent.dragStart(s2Row);
    fireEvent.dragOver(s1Row);
    fireEvent.drop(s1Row);
    fireEvent.dragEnd(s2Row);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(["s2", "s1"]);
  });
});
