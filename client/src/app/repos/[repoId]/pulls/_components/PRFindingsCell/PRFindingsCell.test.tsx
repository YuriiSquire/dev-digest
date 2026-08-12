/**
 * PRFindingsCell — the FINDINGS column cell in the PR list.
 * Covers: severity chips from the PrMeta counts (presence + order), the muted
 * "—" empty state with no hover affordance, the 150ms hover-open flipping
 * aria-expanded (fake timers + act(), per client INSIGHTS — otherwise
 * aria-expanded never flips), and the dropdown content lazily fetched from
 * `/pulls/:id/reviews` (grouped by agent — each agent's latest review — with
 * each finding deep-linked to GitHub).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, within, cleanup, fireEvent, act } from "@testing-library/react";
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

  it("renders a muted — and no hover affordance when all counts are null", () => {
    renderCell(pr({ critical_count: null, warning_count: null, suggestion_count: null }));
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens the dropdown (aria-expanded → true) after the 150ms hover delay", () => {
    // Keep the lazy usePrReviews fetch from hitting a real endpoint; the loading
    // placeholder renders synchronously on open, before this ever resolves.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
    );
    vi.useFakeTimers();
    try {
      renderCell(pr({ critical_count: 2, warning_count: 1 }));

      const trigger = screen.getByRole("button", { name: "3 findings" });
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      fireEvent.mouseEnter(trigger);
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      // The dropdown mounted; while the reviews query is in flight it shows the
      // muted loading placeholder.
      expect(screen.getByText("Loading…")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("orders the chips CRITICAL → WARNING → SUGGESTION and skips zero counts", () => {
    // Distinct counts so DOM order maps unambiguously to severity: the count
    // spans (.tnum) must appear critical(3), warning(2), suggestion(1).
    renderCell(pr({ critical_count: 3, warning_count: 2, suggestion_count: 1 }));
    const trigger = screen.getByRole("button");
    const counts = [...trigger.querySelectorAll(".tnum")].map((el) => el.textContent);
    expect(counts).toEqual(["3", "2", "1"]);

    // A zero in the middle drops out without disturbing the order of the rest.
    cleanup();
    renderCell(pr({ critical_count: 5, warning_count: 0, suggestion_count: 2 }));
    const trigger2 = screen.getByRole("button");
    expect([...trigger2.querySelectorAll(".tnum")].map((el) => el.textContent)).toEqual(["5", "2"]);
  });
});

/** Open the hover dropdown: mouse-enter + advance the 150ms delay in act(),
 *  then hand control back to real timers so the reviews query can settle and
 *  `findBy*` can poll for the resolved content. */
function openDropdown(name: string) {
  const trigger = screen.getByRole("button", { name });
  fireEvent.mouseEnter(trigger);
  act(() => {
    vi.advanceTimersByTime(150);
  });
  vi.useRealTimers();
  return trigger;
}

describe("PRFindingsCell — dropdown content", () => {
  it("renders the newest review's finding detail (title, file:line, severity badge)", async () => {
    mockReviewsFetch([
      review({
        findings: [
          finding({
            id: "fx",
            severity: "CRITICAL",
            category: "perf",
            title: "SQL injection in query builder",
            file: "src/db/query.ts",
            start_line: 12,
            end_line: 12,
          }),
        ],
      }),
    ]);
    vi.useFakeTimers();
    try {
      renderCell(pr({ critical_count: 1 }));
      openDropdown("1 findings");

      // Appears only after the mocked reviews fetch resolves.
      expect(await screen.findByText("SQL injection in query builder")).toBeInTheDocument();

      const tooltip = screen.getByRole("tooltip");
      // file:line deep-link, rendered as `{file}:{lineLabel}` (equal lines → bare line).
      expect(within(tooltip).getByRole("link")).toHaveTextContent("src/db/query.ts:12");
      // The compact SeverityBadge for a CRITICAL finding (lucide octagon-alert icon).
      expect(tooltip.querySelector(".lucide-octagon-alert")).toBeTruthy();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("breaks findings down by agent — EACH agent's latest review, not just one", async () => {
    mockReviewsFetch([
      // Agent A — an OLDER review that must be dropped (latest-per-agent wins).
      review({
        id: "a-old",
        agent_id: "agent-a",
        agent_name: "Security Reviewer",
        created_at: "2026-06-01T00:00:00.000Z",
        findings: [finding({ id: "fa-old", title: "OLD: hardcoded secret" })],
      }),
      // Agent A — its latest review.
      review({
        id: "a-new",
        agent_id: "agent-a",
        agent_name: "Security Reviewer",
        created_at: "2026-06-10T00:00:00.000Z",
        findings: [
          finding({
            id: "fa-new",
            title: "NEW: SQL injection in query builder",
            file: "src/db/query.ts",
            start_line: 12,
            end_line: 12,
          }),
        ],
      }),
      // Agent B — a different agent, so its findings must ALSO appear.
      review({
        id: "b-1",
        agent_id: "agent-b",
        agent_name: "Performance Reviewer",
        created_at: "2026-06-05T00:00:00.000Z",
        findings: [finding({ id: "fb", severity: "WARNING", title: "N+1 query in user list" })],
      }),
      // A summary newer than every review, but ignored (kind !== 'review').
      review({
        id: "sum",
        agent_id: "agent-a",
        kind: "summary",
        created_at: "2026-06-20T00:00:00.000Z",
        findings: [finding({ id: "fs", title: "SUMMARY: overall shape" })],
      }),
    ]);
    vi.useFakeTimers();
    try {
      renderCell(pr({ critical_count: 1, warning_count: 1 }));
      openDropdown("2 findings");

      // Both agents get their own section...
      expect(await screen.findByText("Security Reviewer")).toBeInTheDocument();
      expect(screen.getByText("Performance Reviewer")).toBeInTheDocument();
      // ...and a finding from EACH is shown — the dropdown is NOT limited to one agent.
      expect(screen.getByText("NEW: SQL injection in query builder")).toBeInTheDocument();
      expect(screen.getByText("N+1 query in user list")).toBeInTheDocument();
      // The older same-agent review is superseded, and the summary is ignored.
      expect(screen.queryByText("OLD: hardcoded secret")).not.toBeInTheDocument();
      expect(screen.queryByText("SUMMARY: overall shape")).not.toBeInTheDocument();

      // At least one finding still deep-links to GitHub at the PR head sha.
      const sqlLink = screen
        .getAllByRole("link")
        .find((l) => l.getAttribute("href")?.includes("src/db/query.ts"));
      expect(sqlLink?.getAttribute("href")).toContain("abc1234");
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it("deep-links the finding's file:line to GitHub at the PR head sha", async () => {
    mockReviewsFetch([
      review({
        findings: [
          finding({ title: "N+1 query", file: "src/api/users.ts", start_line: 45, end_line: 52 }),
        ],
      }),
    ]);
    vi.useFakeTimers();
    try {
      // pr() defaults head_sha:"abc1234"; renderCell passes repoFullName:"octo/repo".
      renderCell(pr({ critical_count: 1 }));
      openDropdown("1 findings");

      await screen.findByText("N+1 query");
      const link = screen.getByRole("link");
      const href = link.getAttribute("href") ?? "";
      expect(href).toContain("abc1234"); // head sha pins the blob
      expect(href).toContain("src/api/users.ts"); // finding path
      expect(href).toContain("#L45-L52"); // line range
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
