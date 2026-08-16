import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../messages/en/conventions.json";

vi.mock("../../../../components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../../../lib/repo-context", () => ({
  useActiveRepo: () => ({ repoId: "repo-1", activeRepo: { id: "repo-1", name: "payments-api" } }),
}));

const useConventionsMock = vi.fn();
const extractMutate = vi.fn();
const acceptMutate = vi.fn();
const rejectMutate = vi.fn();
let sampleCount = 84;
vi.mock("../../../../lib/hooks/conventions", () => ({
  useConventions: () => useConventionsMock(),
  useExtractConventions: () => ({ mutate: extractMutate, isPending: false, isError: false, data: { sample_count: sampleCount } }),
  useAcceptConvention: () => ({ mutate: acceptMutate, isPending: false }),
  useRejectConvention: () => ({ mutate: rejectMutate, isPending: false }),
}));
// Modal pulls in hooks/skills + toast; stub it to a marker.
vi.mock("../CreateSkillFromConventionsModal", () => ({
  CreateSkillFromConventionsModal: () => <div>MODAL_OPEN</div>,
}));

import { ConventionsListView } from "./ConventionsListView";

afterEach(cleanup);
beforeEach(() => {
  extractMutate.mockClear();
  acceptMutate.mockClear();
  sampleCount = 84;
});

const CONVS: ConventionCandidate[] = [
  { id: "c1", category: "async", rule: "Always use async/await instead of .then() chains", evidence_path: "src/api/users.ts:23-31", evidence_snippet: "const user = await db.users.find(id);", confidence: 0.91, status: "pending", accepted: false },
  { id: "c2", category: "infra", rule: "Redis singleton", evidence_path: "src/lib/redis.ts:1-9", evidence_snippet: "export const redis = new Redis(x);", confidence: 0.85, status: "accepted", accepted: true },
];

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionsListView />
    </NextIntlClientProvider>,
  );
}

describe("ConventionsListView", () => {
  it("shows a loading skeleton while fetching", () => {
    useConventionsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    renderView();
    expect(screen.queryByText(/Redis singleton/)).not.toBeInTheDocument();
  });

  it("renders a card per convention and the accepted count", () => {
    useConventionsMock.mockReturnValue({ data: CONVS, isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    expect(screen.getByText(/Always use async\/await/)).toBeInTheDocument();
    expect(screen.getByText(/Redis singleton/)).toBeInTheDocument();
    expect(screen.getByText("1 of 2 accepted")).toBeInTheDocument();
    expect(screen.getByText(/Detected from 84 sample files/)).toBeInTheDocument();
  });

  it("uses the singular 'sample file' when exactly one file was scanned", () => {
    sampleCount = 1;
    useConventionsMock.mockReturnValue({ data: CONVS, isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    expect(screen.getByText(/Detected from 1 sample file · /)).toBeInTheDocument();
  });

  it("Re-scan triggers extraction", () => {
    useConventionsMock.mockReturnValue({ data: CONVS, isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Re-scan/i }));
    expect(extractMutate).toHaveBeenCalledTimes(1);
  });

  it("Create skill opens the modal (enabled once something is accepted)", () => {
    useConventionsMock.mockReturnValue({ data: CONVS, isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Create skill/i }));
    expect(screen.getByText("MODAL_OPEN")).toBeInTheDocument();
  });

  it("accept fires the accept mutation from a card", () => {
    useConventionsMock.mockReturnValue({ data: CONVS, isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    fireEvent.click(screen.getAllByRole("button", { name: /^Accept$/i })[0]!);
    expect(acceptMutate).toHaveBeenCalledWith("c1");
  });

  it("renders the empty state when there are no conventions", () => {
    useConventionsMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    renderView();
    expect(screen.getByText("No conventions extracted yet")).toBeInTheDocument();
  });

  it("renders an error state on failure", () => {
    useConventionsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    renderView();
    expect(screen.getByText("Could not load conventions.")).toBeInTheDocument();
  });
});
