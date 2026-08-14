/**
 * PRFindingsCell — the FINDINGS column cell in the PR list.
 * Covers: severity chips from the PrMeta counts (presence + order); the muted
 * "—" empty state with no buttons; and the CLICK-to-filter interaction — each
 * severity chip is a button that opens a by-agent dropdown showing ONLY that
 * severity's findings (lazily fetched from `/pulls/:id/reviews`), toggles closed
 * on a second click, switches on clicking another severity, and closes on Escape.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, within, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PrMeta, ReviewRecord, FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import { PRFindingsCell } from "./PRFindingsCell";

afterEach(cleanup);

function pr(o: Partial<PrMeta> = {}): PrMeta {
  return {
    id: "pr-1",
    number: 42,
    title: "Add rate limiting",
    author: "octocat",
    branch: "feat/rl",
    base: "main",
    head_sha: "abc1234",
    additions: 10,
    deletions: 2,
    files_count: 3,
    status: "needs_review",
    opened_at: "2026-06-11T18:00:00.000Z",
    updated_at: "2026-06-11T18:44:34.000Z",
    score: 72,
    cost_usd: null,
    critical_count: null,
    warning_count: null,
    suggestion_count: null,
    ...o,
  };
}

function renderCell(meta: PrMeta) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <PRFindingsCell pr={meta} repoFullName="octo/repo" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function finding(o: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id: "f1",
    severity: "CRITICAL",
    category: "perf",
    title: "N+1 query in user list endpoint",
    file: "src/api/users.ts",
    start_line: 45,
    end_line: 52,
    rationale: "The loop calls db.posts.findMany once per user.",
    suggestion: null,
    confidence: 0.86,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

function review(o: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "r1",
    pr_id: "pr-1",
    agent_id: "a1",
    run_id: "run-1",
    agent_name: "Security Reviewer",
    kind: "review",
    verdict: "request_changes",
    summary: null,
    score: 40,
    model: "deepseek/deepseek-v4-flash",
    grounding: "1/1 passed",
    created_at: "2026-06-11T18:44:34.000Z",
    findings: [],
    ...o,
  };
}

/**
 * Stub the lazy `usePrReviews` fetch (`GET /pulls/:id/reviews`). The hook goes
 * through `apiFetch`, which only reads `res.ok`/`res.status`/`res.json()`.
 * Tests using this MUST `vi.unstubAllGlobals()` in a finally.
 */
function mockReviewsFetch(reviews: ReviewRecord[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => reviews })),
  );
}

describe("PRFindingsCell", () => {
  it("renders a chip per non-zero severity with its count, omitting zero/null", () => {
    renderCell(pr({ critical_count: 2, warning_count: 1, suggestion_count: 0 }));
    expect(screen.getByText("2")).toBeInTheDocument(); // CRITICAL chip
    expect(screen.getByText("1")).toBeInTheDocument(); // WARNING chip
    // SUGGESTION count is 0 → no chip; there is no third count rendered.
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders a muted — and no buttons when all counts are null", () => {
    renderCell(pr({ critical_count: null, warning_count: null, suggestion_count: null }));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders one clickable button per severity, in CRITICAL → WARNING → SUGGESTION order", () => {
    renderCell(pr({ critical_count: 3, warning_count: 2, suggestion_count: 1 }));
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Show CRITICAL findings",
      "Show WARNING findings",
      "Show SUGGESTION findings",
    ]);
    // Counts follow the same order; all start unpressed.
    expect(buttons.map((b) => b.querySelector(".tnum")?.textContent)).toEqual(["3", "2", "1"]);
    buttons.forEach((b) => expect(b).toHaveAttribute("aria-pressed", "false"));

    // A zero in the middle drops out without disturbing the order of the rest.
    cleanup();
    renderCell(pr({ critical_count: 5, warning_count: 0, suggestion_count: 2 }));
    expect(screen.getAllByRole("button").map((b) => b.querySelector(".tnum")?.textContent)).toEqual([
      "5",
      "2",
    ]);
  });
});

describe("PRFindingsCell — click to filter by severity", () => {
  // Two agents; agent-a has a CRITICAL + a WARNING, agent-b has a CRITICAL only.
  const mixed = () => [
    review({
      id: "a",
      agent_id: "agent-a",
      agent_name: "Security Reviewer",
      created_at: "2026-06-10T00:00:00.000Z",
      findings: [
        finding({
          id: "c1",
          severity: "CRITICAL",
          title: "SQL injection in query builder",
          file: "src/db/query.ts",
          start_line: 12,
          end_line: 12,
        }),
        finding({ id: "w1", severity: "WARNING", title: "N+1 query in user list" }),
      ],
    }),
    review({
      id: "b",
      agent_id: "agent-b",
      agent_name: "Performance Reviewer",
      created_at: "2026-06-05T00:00:00.000Z",
      findings: [finding({ id: "c2", severity: "CRITICAL", title: "Unbounded recursion risk" })],
    }),
  ];

  it("shows only the clicked severity's findings, grouped by agent", async () => {
    mockReviewsFetch(mixed());
    try {
      renderCell(pr({ critical_count: 2, warning_count: 1 }));
      const crit = screen.getByRole("button", { name: "Show CRITICAL findings" });
      expect(crit).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(crit);
      expect(crit).toHaveAttribute("aria-pressed", "true");

      // Both agents' CRITICAL findings appear, under both agent sections...
      expect(await screen.findByText("SQL injection in query builder")).toBeInTheDocument();
      expect(screen.getByText("Unbounded recursion risk")).toBeInTheDocument();
      expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
      expect(screen.getByText("Performance Reviewer")).toBeInTheDocument();
      // ...but the WARNING finding is NOT shown under the CRITICAL filter.
      expect(screen.queryByText("N+1 query in user list")).not.toBeInTheDocument();

      // The critical finding still deep-links to GitHub at the PR head sha.
      const tooltip = screen.getByRole("tooltip");
      const link = within(tooltip)
        .getAllByRole("link")
        .find((l) => l.getAttribute("href")?.includes("src/db/query.ts"));
      expect(link?.getAttribute("href")).toContain("abc1234");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("switches to another severity, dropping agents that have none of it", async () => {
    mockReviewsFetch(mixed());
    try {
      renderCell(pr({ critical_count: 2, warning_count: 1 }));
      fireEvent.click(screen.getByRole("button", { name: "Show CRITICAL findings" }));
      await screen.findByText("SQL injection in query builder");

      fireEvent.click(screen.getByRole("button", { name: "Show WARNING findings" }));
      // Only the WARNING finding remains, under its agent; the critical-only
      // agent-b section is gone, and criticals are hidden.
      expect(await screen.findByText("N+1 query in user list")).toBeInTheDocument();
      expect(screen.queryByText("SQL injection in query builder")).not.toBeInTheDocument();
      expect(screen.queryByText("Performance Reviewer")).not.toBeInTheDocument();
      expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("closes on a second click of the active chip, and on Escape", async () => {
    mockReviewsFetch(mixed());
    try {
      renderCell(pr({ critical_count: 2 }));
      const crit = screen.getByRole("button", { name: "Show CRITICAL findings" });

      fireEvent.click(crit);
      expect(await screen.findByText("SQL injection in query builder")).toBeInTheDocument();

      // Second click on the active chip → closes.
      fireEvent.click(crit);
      expect(crit).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByText("SQL injection in query builder")).not.toBeInTheDocument();

      // Reopen, then Escape → closes.
      fireEvent.click(crit);
      await screen.findByText("SQL injection in query builder");
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(crit).toHaveAttribute("aria-pressed", "false"));
      expect(screen.queryByText("SQL injection in query builder")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows a muted 'No findings' when the clicked severity has no detail rows", async () => {
    // The chip count says 1 critical, but the fetched reviews carry only a
    // WARNING — the documented count-vs-detail divergence. Filtering to CRITICAL
    // yields no groups → the muted empty state, not a stuck spinner.
    mockReviewsFetch([
      review({ findings: [finding({ id: "w", severity: "WARNING", title: "style nit" })] }),
    ]);
    try {
      renderCell(pr({ critical_count: 1 }));
      fireEvent.click(screen.getByRole("button", { name: "Show CRITICAL findings" }));
      expect(await screen.findByText("No findings")).toBeInTheDocument();
      expect(screen.queryByText("style nit")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
