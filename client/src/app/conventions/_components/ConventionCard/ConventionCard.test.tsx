import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";

afterEach(cleanup);

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

const REPO = { owner: "acme", name: "widgets", default_branch: "main" };

function renderCard(
  convention = CONV,
  onAccept = vi.fn(),
  onReject = vi.fn(),
  onEdit = vi.fn(),
  repo: typeof REPO | null = null,
) {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionCard
        convention={convention}
        onAccept={onAccept}
        onReject={onReject}
        onEdit={onEdit}
        repo={repo}
      />
    </NextIntlClientProvider>,
  );
  return { onAccept, onReject, onEdit };
}

describe("ConventionCard", () => {
  it("renders the rule, the evidence path + snippet, and the confidence percent", () => {
    renderCard();
    expect(screen.getByText(CONV.rule)).toBeInTheDocument();
    expect(screen.getByText("src/api/users.ts:23-31")).toBeInTheDocument();
    expect(screen.getByText(/const user = await db\.users\.find\(id\);/)).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });

  it("fires onAccept / onReject", () => {
    const { onAccept, onReject } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Accept/i }));
    fireEvent.click(screen.getByRole("button", { name: /Reject/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("fires onEdit from the edit button, without triggering accept/reject", () => {
    const { onAccept, onReject, onEdit } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("shows the Accepted label once accepted", () => {
    renderCard({ ...CONV, status: "accepted", accepted: true });
    expect(screen.getByRole("button", { name: "Accepted" })).toBeInTheDocument();
  });

  it("shows the Rejected label and a filled (crit) background once rejected", () => {
    renderCard({ ...CONV, status: "rejected", accepted: false });
    const rejectBtn = screen.getByRole("button", { name: "Rejected" });
    expect(rejectBtn).toBeInTheDocument();
    expect(rejectBtn).toHaveStyle({ background: "var(--crit)" });
  });

  it("renders the evidence path as a GitHub link when repo info is provided", () => {
    renderCard(CONV, vi.fn(), vi.fn(), vi.fn(), REPO);
    const link = screen.getByRole("link", { name: /src\/api\/users\.ts:23-31/ });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/acme/widgets/blob/main/src/api/users.ts#L23-L31",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the evidence path as plain text (no link) without repo info", () => {
    renderCard();
    expect(screen.getByText("src/api/users.ts:23-31")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
