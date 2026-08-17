import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../messages/en/conventions.json";
import { ToastProvider } from "../../../../lib/toast";

const updateMutateAsync = vi.fn(async (_input?: unknown) => ({}) as ConventionCandidate);
vi.mock("../../../../lib/hooks/conventions", () => ({
  useUpdateConvention: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

import { EditConventionModal } from "./EditConventionModal";

afterEach(cleanup);
beforeEach(() => updateMutateAsync.mockClear());

const CONV: ConventionCandidate = {
  id: "c1",
  category: "async",
  rule: "Always use async/await instead of .then() chains",
  evidence_path: "src/api/users.ts:23-31",
  evidence_snippet: "const user = await db.users.find(id);",
  confidence: 0.91,
  status: "pending",
  accepted: false,
};

function renderModal(convention: ConventionCandidate = CONV, onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ToastProvider>
        <EditConventionModal repoId="repo-1" convention={convention} onClose={onClose} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onClose };
}

describe("EditConventionModal", () => {
  it("prefills the fields from the candidate", () => {
    renderModal();
    expect(screen.getByDisplayValue(CONV.rule)).toBeInTheDocument();
    expect(screen.getByDisplayValue("async")).toBeInTheDocument();
    expect(screen.getByDisplayValue("src/api/users.ts:23-31")).toBeInTheDocument();
    expect(screen.getByDisplayValue("const user = await db.users.find(id);")).toBeInTheDocument();
  });

  it("saves the edited fields via useUpdateConvention and closes", async () => {
    const { onClose } = renderModal();
    fireEvent.change(screen.getByDisplayValue(CONV.rule), {
      target: { value: "Prefer async/await over .then() chains" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => expect(updateMutateAsync).toHaveBeenCalledTimes(1));
    expect(updateMutateAsync.mock.calls[0]![0]).toEqual({
      id: "c1",
      patch: {
        rule: "Prefer async/await over .then() chains",
        category: "async",
        evidence_path: "src/api/users.ts:23-31",
        evidence_snippet: "const user = await db.users.find(id);",
      },
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
