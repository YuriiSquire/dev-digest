/* Create-skill-from-conventions modal — clones the skills CreateSkillModal and
   adds the Enabled toggle + live token count (from the skill editor's ConfigTab).
   Prefilled name + body composed from the accepted conventions; everything is
   editable before save. Saves via useCreateConventionSkill → POST
   /repos/:id/conventions/skill (source 'extracted'). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Button,
  Modal,
  FormField,
  TextInput,
  SelectInput,
  Toggle,
  Badge,
  Icon,
} from "@devdigest/ui";
import type { ConventionCandidate, SkillType } from "@devdigest/shared";
import { useCreateConventionSkill } from "../../../../lib/hooks/conventions";
import { useSkillTokens } from "../../../../lib/hooks/skills";
import { useToast } from "../../../../lib/toast";
import { BodyPreview } from "./BodyPreview";
import { composeSkillBody, skillFilename } from "./helpers";
import { DEFAULT_TYPE, MODAL_WIDTH, TOKEN_DEBOUNCE_MS, TYPE_VALUES } from "./constants";
import { s } from "./styles";

export function CreateSkillFromConventionsModal({
  repoId,
  repoName,
  accepted,
  onClose,
}: {
  repoId: string;
  repoName: string;
  accepted: ConventionCandidate[];
  onClose: () => void;
}) {
  const t = useTranslations("conventions.modal");
  const toast = useToast();
  const router = useRouter();
  const create = useCreateConventionSkill(repoId);
  const tokens = useSkillTokens();

  const [name, setName] = React.useState(t("defaultName", { repo: repoName }));
  const [description, setDescription] = React.useState(
    t("defaultDescription", { count: accepted.length, repo: repoName }),
  );
  const [type, setType] = React.useState<SkillType>(DEFAULT_TYPE);
  const [enabled, setEnabled] = React.useState(true);
  const [body, setBody] = React.useState(() => composeSkillBody(repoName, accepted));
  // `body` is the single source of truth; this only toggles how it's shown
  // (read-only highlighted preview by default, editable textarea on demand).
  const [editing, setEditing] = React.useState(false);

  // Debounced live token count for the body.
  const countTokens = tokens.mutate;
  React.useEffect(() => {
    const handle = setTimeout(() => countTokens(body), TOKEN_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [body, countTokens]);

  const tokenLabel = tokens.isPending
    ? t("tokensCounting")
    : tokens.data
      ? t("tokens", { count: tokens.data.tokens })
      : "";

  const filename = skillFilename(name);

  const submit = async () => {
    const skill = await create.mutateAsync({
      name: name.trim() || t("defaultName", { repo: repoName }),
      description,
      type,
      body,
      enabled,
      convention_ids: accepted.map((c) => c.id),
    });
    toast.success(t("createdToast", { name: skill.name }));
    onClose();
    router.push(`/skills/${skill.id}?tab=config`);
  };

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("title")}
      subtitle={name}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <span style={s.footerNote}>
            <Icon.GitCommit size={13} />
            {t("footerNote")}
          </span>
          <div style={s.footerActions}>
            <Button kind="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button
              kind="primary"
              icon="Sparkles"
              onClick={submit}
              disabled={create.isPending || accepted.length === 0}
            >
              {create.isPending ? t("creating") : t("create")}
            </Button>
          </div>
        </div>
      }
    >
      <div style={s.body}>
        <div style={s.banner}>
          <Icon.Sparkles size={14} />
          <span>
            {t.rich("mergedFrom", {
              count: accepted.length,
              repo: repoName,
              b: (chunks) => <strong>{chunks}</strong>,
              r: (chunks) => <span style={s.bannerRepo}>{chunks}</span>,
            })}
          </span>
        </div>

        <FormField label={t("name")} required>
          <TextInput value={name} onChange={setName} placeholder={t("namePlaceholder")} />
        </FormField>

        <FormField label={t("description")}>
          <TextInput value={description} onChange={setDescription} />
        </FormField>

        <div style={s.typeRow}>
          <FormField label={t("type")}>
            <SelectInput
              value={type}
              onChange={(v) => setType(v as SkillType)}
              options={TYPE_VALUES}
            />
          </FormField>
          <FormField label={t("enabled")} hint={t("enabledHint")}>
            <div style={s.enabledRow}>
              <Toggle on={enabled} onChange={setEnabled} size={16} />
            </div>
          </FormField>
        </div>

        <FormField label={t("body")} required>
          <div style={s.bodyPanel}>
            <div style={s.bodyHeader}>
              <div style={s.bodyHeaderLeft}>
                <Icon.FileText size={14} style={s.fileIcon} />
                <span className="mono" style={s.filename}>
                  {filename}
                </span>
                <Badge>{t("unsaved")}</Badge>
              </div>
              <div style={s.bodyHeaderRight}>
                {tokenLabel && <span style={s.tokens}>{tokenLabel}</span>}
                <Button
                  kind="ghost"
                  size="sm"
                  icon={editing ? "Eye" : "Edit"}
                  onClick={() => setEditing((v) => !v)}
                >
                  {editing ? t("preview") : t("edit")}
                </Button>
              </div>
            </div>
            {editing ? (
              <textarea
                className="mono"
                value={body}
                rows={12}
                onChange={(e) => setBody(e.target.value)}
                style={s.bodyTextarea}
              />
            ) : (
              <BodyPreview body={body} />
            )}
          </div>
        </FormField>
      </div>
    </Modal>
  );
}
