import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "../../../../../../lib/toast";

const importMutateAsync = vi.fn();
const communityMock = vi.fn();

vi.mock("../../../../../../lib/hooks/skills", () => ({
  useImportSkill: () => ({ mutateAsync: importMutateAsync, isPending: false }),
  useCommunitySkills: () => communityMock(),
}));

import { ImportSkillDrawer } from "./ImportSkillDrawer";

afterEach(cleanup);
beforeEach(() => {
  importMutateAsync.mockReset();
  communityMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
});

const IMPORTED: Skill = {
  id: "sk9",
  name: "Imported Rule",
  description: "d",
  type: "custom",
  source: "extracted",
  body: "b",
  enabled: false,
  version: 1,
};

function renderDrawer(props: Partial<React.ComponentProps<typeof ImportSkillDrawer>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <ToastProvider>
        <ImportSkillDrawer onClose={vi.fn()} {...props} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("ImportSkillDrawer", () => {
  it("always shows the untrusted-source notice", () => {
    renderDrawer();
    expect(screen.getByText(/came from an untrusted source/i)).toBeInTheDocument();
  });

  it("imports pasted Markdown via useImportSkill and reports the result", async () => {
    importMutateAsync.mockResolvedValue(IMPORTED);
    const onImported = vi.fn();
    const onClose = vi.fn();
    renderDrawer({ onImported, onClose });

    const body = screen.getByPlaceholderText(/Describe the rule/);
    fireEvent.change(body, { target: { value: "# My Rule\nDo the thing." } });
    fireEvent.click(screen.getByText("Import skill"));

    await waitFor(() => expect(importMutateAsync).toHaveBeenCalledTimes(1));
    expect(importMutateAsync).toHaveBeenCalledWith({
      kind: "text",
      name: undefined,
      body: "# My Rule\nDo the thing.",
    });
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(IMPORTED));
    expect(onClose).toHaveBeenCalled();
  });

  it("imports from a URL when on the URL tab", async () => {
    importMutateAsync.mockResolvedValue(IMPORTED);
    renderDrawer({ initialTab: "url" });
    fireEvent.change(screen.getByPlaceholderText("https://example.com/skills/security.md"), {
      target: { value: "https://example.com/s.md" },
    });
    fireEvent.click(screen.getByText("Import from URL"));
    await waitFor(() => expect(importMutateAsync).toHaveBeenCalledWith({ kind: "url", url: "https://example.com/s.md" }));
  });

  it("imports a community skill by name", async () => {
    importMutateAsync.mockResolvedValue(IMPORTED);
    communityMock.mockReturnValue({
      data: [{ name: "owasp-top-10", repo: "org/repo", stars: 120, lang: "md", desc: "Security checks" }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderDrawer({ initialTab: "community" });
    expect(screen.getByText("owasp-top-10")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Import"));
    await waitFor(() => expect(importMutateAsync).toHaveBeenCalledWith({ kind: "community", name: "owasp-top-10" }));
  });
});
