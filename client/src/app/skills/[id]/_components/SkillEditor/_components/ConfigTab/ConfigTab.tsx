/* Config tab — name / description / type / body + enabled toggle. Body edits
   trigger a debounced live token count (useSkillTokens); an "unsaved" flag
   shows while the draft differs from the persisted skill. Save via
   useUpdateSkill. Plain useState per field + reset on skill.id change (no
   react-hook-form), mirroring the agent ConfigTab. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, TextInput, SelectInput, Textarea, Toggle, Button, Badge } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useUpdateSkill, useSkillTokens } from "../../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../../lib/toast";
import { TOKEN_DEBOUNCE_MS, TYPE_VALUES } from "./constants";
import { isDirty, skillFilename } from "./helpers";
import { s } from "./styles";

export function ConfigTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills.config");
  const li = useTranslations("skills.listItem");
  const toast = useToast();
  const update = useUpdateSkill();
  const tokens = useSkillTokens();

  const [name, setName] = React.useState(skill.name);
  const [description, setDescription] = React.useState(skill.description);
  const [type, setType] = React.useState<SkillType>(skill.type);
  const [body, setBody] = React.useState(skill.body);
  const [enabled, setEnabled] = React.useState(skill.enabled);

  // Reset local form when switching to a different skill.
  React.useEffect(() => {
    setName(skill.name);
    setDescription(skill.description);
    setType(skill.type);
    setBody(skill.body);
    setEnabled(skill.enabled);
  }, [skill.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced live token count for the body.
  const countTokens = tokens.mutate;
  React.useEffect(() => {
    const handle = setTimeout(() => countTokens(body), TOKEN_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [body, countTokens]);

  const typeOptions = TYPE_VALUES.map((v) => ({ value: v, label: li(`type.${v}`) }));
  const dirty = isDirty({ name, description, type, body, enabled }, skill);
  const filename = skillFilename(name);

  const tokenLabel = tokens.isPending
    ? t("tokensCounting")
    : tokens.data
      ? t("tokens", { count: tokens.data.tokens })
      : "";

  const save = () =>
    update.mutate(
      { id: skill.id, patch: { name, description, type, body, enabled } },
      { onSuccess: (data) => toast.success(t("savedToast", { version: data.version })) },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("title")}</h2>
        <label style={s.enabledLabel}>
          {t("enabled")}
          <Toggle on={enabled} onChange={setEnabled} size={16} />
        </label>
      </div>

      <FormField label={t("name")} required>
        <TextInput value={name} onChange={setName} placeholder={t("namePlaceholder")} />
      </FormField>

      <FormField label={t("description")} hint={t("descriptionCaption")}>
        <TextInput value={description} onChange={setDescription} />
      </FormField>

      <FormField label={t("type")}>
        <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
      </FormField>

      <FormField
        label={t("body")}
        hint={t("bodyHint")}
        right={
          <div style={s.bodyRight}>
            <span className="mono" style={s.filename}>
              {filename}
            </span>
            {tokenLabel && <span style={s.tokens}>{tokenLabel}</span>}
            {dirty && <Badge color="var(--warn)">{t("unsaved")}</Badge>}
          </div>
        }
      >
        <Textarea value={body} onChange={setBody} rows={12} mono />
      </FormField>

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={save} disabled={update.isPending}>
          {update.isPending ? t("saving") : t("save")}
        </Button>
        {update.isSuccess && !dirty && (
          <span style={s.savedNote}>{t("saved", { version: update.data?.version })}</span>
        )}
      </div>
    </div>
  );
}
