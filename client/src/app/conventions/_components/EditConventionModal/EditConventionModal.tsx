/* Edit-convention modal — edit a single detected convention candidate before it
   is turned into a skill. Fields (Rule, Category, Evidence path, Evidence
   snippet) are prefilled from the candidate; everything is editable. Saves via
   useUpdateConvention → PUT /conventions/:id (query-key invalidation lives in
   the hook's onSuccess). Mirrors CreateSkillFromConventionsModal's structure. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal, FormField, TextInput, Textarea } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { useUpdateConvention } from "../../../../lib/hooks/conventions";
import { useToast } from "../../../../lib/toast";
import { s } from "./styles";

export function EditConventionModal({
  repoId,
  convention,
  onClose,
}: {
  repoId: string;
  convention: ConventionCandidate;
  onClose: () => void;
}) {
  const t = useTranslations("conventions.editModal");
  const toast = useToast();
  const update = useUpdateConvention(repoId);

  const [rule, setRule] = React.useState(convention.rule);
  const [category, setCategory] = React.useState(convention.category);
  const [evidencePath, setEvidencePath] = React.useState(convention.evidence_path);
  const [evidenceSnippet, setEvidenceSnippet] = React.useState(convention.evidence_snippet);

  const submit = async () => {
    await update.mutateAsync({
      id: convention.id,
      patch: {
        rule,
        category,
        evidence_path: evidencePath,
        evidence_snippet: evidenceSnippet,
      },
    });
    toast.success(t("savedToast"));
    onClose();
  };

  return (
    <Modal
      width={640}
      title={t("title")}
      subtitle={t("subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button kind="primary" icon="Check" onClick={submit} disabled={update.isPending}>
            {update.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <FormField label={t("rule")} required>
          <TextInput value={rule} onChange={setRule} placeholder={t("rulePlaceholder")} />
        </FormField>

        <FormField label={t("category")}>
          <TextInput value={category} onChange={setCategory} placeholder={t("categoryPlaceholder")} />
        </FormField>

        <FormField label={t("evidencePath")}>
          <TextInput
            value={evidencePath}
            onChange={setEvidencePath}
            placeholder={t("evidencePathPlaceholder")}
            mono
          />
        </FormField>

        <FormField label={t("evidenceSnippet")}>
          <Textarea
            value={evidenceSnippet}
            onChange={setEvidenceSnippet}
            placeholder={t("evidenceSnippetPlaceholder")}
            rows={8}
            mono
          />
        </FormField>
      </div>
    </Modal>
  );
}
