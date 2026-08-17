import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../messages/en/conventions.json";
import { ToastProvider } from "../../../../lib/toast";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const createMutateAsync = vi.fn(async (_input?: unknown) => ({
  id: "skill-1",
  name: "payments-api-conventions",
}));
vi.mock("../../../../lib/hooks/conventions", () => ({
  useCreateConventionSkill: () => ({ mutateAsync: createMutateAsync, isPending: false }),
}));
const tokensMutate = vi.fn();
vi.mock("../../../../lib/hooks/skills", () => ({
  useSkillTokens: () => ({ mutate: tokensMutate, isPending: false, data: { tokens: 187 } }),
}));

import { CreateSkillFromConventionsModal } from "./CreateSkillFromConventionsModal";

afterEach(cleanup);
beforeEach(() => {
  push.mockClear();
  createMutateAsync.mockClear();
});

const ACCEPTED: ConventionCandidate[] = [
  { id: "c1", category: "async", rule: "Always use async/await instead of .then() chains", evidence_path: "src/api/users.ts:23-31", evidence_snippet: "const user = await db.users.find(id);", confidence: 0.91, status: "accepted", accepted: true },
  { id: "c2", category: "infra", rule: "Redis access goes through the singleton", evidence_path: "src/lib/redis.ts:1-9", evidence_snippet: "export const redis = new Redis(x);", confidence: 0.85, status: "accepted", accepted: true },
];

function renderModal(accepted: ConventionCandidate[] = ACCEPTED) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ToastProvider>
        <CreateSkillFromConventionsModal repoId="repo-1" repoName="payments-api" accepted={accepted} onClose={vi.fn()} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("CreateSkillFromConventionsModal", () => {
  it("prefills the name, the merged-from banner, body evidence, and a token count", () => {
    renderModal();
    expect(screen.getByDisplayValue("payments-api-conventions")).toBeInTheDocument();
    // The count is emphasized in its own node; assert the bolded chunk directly.
    expect(screen.getByText("2 accepted conventions")).toBeInTheDocument();
    expect(screen.getByText(/187 tokens/)).toBeInTheDocument();
    // Body is a read-only preview by default: assert the composed line text
    // (not a textarea value), the line-number gutter, and a highlighted heading.
    expect(screen.getByText(/Always use async\/await/)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // gutter line number
    const heading = screen.getByText("# payments-api-conventions");
    expect(heading).toHaveStyle({ color: "var(--accent)" });
  });

  it("uses the singular noun in the banner and description when exactly one convention is accepted", () => {
    renderModal([ACCEPTED[0]!]);
    expect(screen.getByText("1 accepted convention")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1 house convention extracted from payments-api")).toBeInTheDocument();
  });

  it("renders the body code panel (filename + unsaved), the enabled helper text, and the footer note", () => {
    renderModal();
    expect(screen.getByText("payments-api-conventions.md")).toBeInTheDocument();
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByText("Whether this block is added to agents' prompts.")).toBeInTheDocument();
    expect(screen.getByText(/Saved as v1 · added to Skills Lab/)).toBeInTheDocument();
  });

  it("creates a skill with the composed payload on Create", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Create skill/i }));
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]![0] as {
      name: string;
      type: string;
      enabled: boolean;
      convention_ids: string[];
      body: string;
    };
    expect(payload).toMatchObject({
      name: "payments-api-conventions",
      type: "convention",
      enabled: true,
      convention_ids: ["c1", "c2"],
    });
    expect(payload.body).toContain("# payments-api-conventions");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/skill-1?tab=config"));
  });

  it("the Edit toggle reveals the textarea and edits flow into the create payload", async () => {
    renderModal();
    // Preview by default — no editable textarea yet.
    expect(screen.queryByDisplayValue(/# payments-api-conventions/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));

    const ta = screen.getByDisplayValue(/# payments-api-conventions/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: `${ta.value}\n## extra-rule\nEdited body line` } });

    fireEvent.click(screen.getByRole("button", { name: /Create skill/i }));
    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledTimes(1));
    const payload = createMutateAsync.mock.calls[0]![0] as { body: string };
    expect(payload.body).toContain("Edited body line");
    // Original composed content is preserved alongside the edit.
    expect(payload.body).toContain("# payments-api-conventions");
  });
});
