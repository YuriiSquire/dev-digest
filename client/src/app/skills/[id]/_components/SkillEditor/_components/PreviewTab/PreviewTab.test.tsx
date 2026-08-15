import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/skills.json";
import { PreviewTab } from "./PreviewTab";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "PR Rubric",
  description: "Scores diffs",
  type: "rubric",
  source: "manual",
  body: "# Heading\n\nSome **bold** guidance.",
  enabled: true,
  version: 1,
};

function renderTab(skill: Skill) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <PreviewTab skill={skill} />
    </NextIntlClientProvider>,
  );
}

describe("Skill PreviewTab", () => {
  it("renders the body as markdown with the reviewer-facing caption", () => {
    renderTab(SKILL);
    expect(screen.getByText("Rendered as the reviewing agent receives it.")).toBeInTheDocument();
    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("shows no untrusted notice for a manual skill", () => {
    renderTab(SKILL);
    expect(screen.queryByText(/untrusted source/i)).not.toBeInTheDocument();
  });

  it("shows the untrusted notice for a community skill", () => {
    renderTab({ ...SKILL, source: "community" });
    expect(screen.getByText(/came from an untrusted source/i)).toBeInTheDocument();
  });
});
