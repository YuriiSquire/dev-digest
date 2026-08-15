import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../../../../lib/toast";

const updateMutate = vi.fn();
const tokensMutate = vi.fn();
const tokensState = { mutate: tokensMutate, isPending: false, data: { tokens: 42 } as { tokens: number } | undefined };

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: updateMutate, isPending: false, isSuccess: false, data: undefined }),
  useSkillTokens: () => tokensState,
}));

import { ConfigTab } from "./ConfigTab";

afterEach(cleanup);
beforeEach(() => {
  updateMutate.mockClear();
  tokensMutate.mockClear();
  tokensState.data = { tokens: 42 };
});

const SKILL: Skill = {
  id: "sk1",
  name: "PR Rubric",
  description: "Scores diffs",
  type: "rubric",
  source: "manual",
  body: "# Rubric\nBe concise.",
  enabled: true,
  version: 3,
};

function renderTab(skill: Skill = SKILL) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <ConfigTab skill={skill} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("Skill ConfigTab", () => {
  it("renders the current skill into the form and shows the live token count", () => {
    renderTab();
    expect(screen.getByDisplayValue("PR Rubric")).toBeInTheDocument();
    expect(screen.getByText("42 tokens")).toBeInTheDocument();
    expect(screen.getByText("pr-rubric.md")).toBeInTheDocument();
  });

  it("saves the edited fields through useUpdateSkill", () => {
    renderTab();
    fireEvent.change(screen.getByDisplayValue("PR Rubric"), { target: { value: "PR Rubric v2" } });
    fireEvent.click(screen.getByText("Save"));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sk1",
        patch: expect.objectContaining({ name: "PR Rubric v2", type: "rubric", enabled: true }),
      }),
      expect.anything(),
    );
  });

  it("shows an 'unsaved' flag once the draft diverges from the skill", () => {
    renderTab();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("PR Rubric"), { target: { value: "PR Rubric X" } });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
  });

  it("debounces a token recount when the body changes", () => {
    vi.useFakeTimers();
    try {
      renderTab();
      tokensMutate.mockClear();
      const body = screen.getByDisplayValue(/Be concise/);
      fireEvent.change(body, { target: { value: "# Rubric\nBe concise and cite file:line." } });
      expect(tokensMutate).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(tokensMutate).toHaveBeenCalledWith("# Rubric\nBe concise and cite file:line.");
    } finally {
      vi.useRealTimers();
    }
  });
});
