import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

// AppShell pulls in the command palette + global shortcuts + router chrome;
// stub it to a passthrough so the test targets the list view itself.
vi.mock("../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const useSkillsMock = vi.fn();
const updateMutate = vi.fn();
vi.mock("../../../../lib/hooks/skills", () => ({
  useSkills: () => useSkillsMock(),
  useUpdateSkill: () => ({ mutate: updateMutate }),
  useSkillStats: () => ({ data: undefined }),
}));

import { SkillsListView } from "./SkillsListView";

afterEach(cleanup);
beforeEach(() => {
  push.mockClear();
  updateMutate.mockClear();
});

const SKILLS: Skill[] = [
  { id: "s1", name: "PR Rubric", description: "rubric", type: "rubric", source: "manual", body: "b", enabled: true, version: 1 },
  { id: "s2", name: "No SQL Injection", description: "security", type: "security", source: "community", body: "b", enabled: false, version: 2 },
];

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillsListView />
    </NextIntlClientProvider>,
  );
}

describe("SkillsListView", () => {
  it("shows a loading skeleton while fetching", () => {
    useSkillsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    const { container } = renderView();
    expect(container.querySelectorAll("[class*='dd'], div").length).toBeGreaterThan(0);
    expect(screen.queryByText("PR Rubric")).not.toBeInTheDocument();
  });

  it("renders a card per skill and routes on click", () => {
    useSkillsMock.mockReturnValue({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    expect(screen.getByText("PR Rubric")).toBeInTheDocument();
    expect(screen.getByText("No SQL Injection")).toBeInTheDocument();
    fireEvent.click(screen.getByText("PR Rubric"));
    expect(push).toHaveBeenCalledWith("/skills/s1?tab=config");
  });

  it("filters skills by the search box", () => {
    useSkillsMock.mockReturnValue({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    fireEvent.change(screen.getByPlaceholderText("Search skills…"), { target: { value: "injection" } });
    expect(screen.queryByText("PR Rubric")).not.toBeInTheDocument();
    expect(screen.getByText("No SQL Injection")).toBeInTheDocument();
  });

  it("renders an empty state when there are no skills", () => {
    useSkillsMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });

  it("renders an error state on failure", () => {
    useSkillsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    renderView();
    expect(screen.getByText("Could not load skills.")).toBeInTheDocument();
  });
});
