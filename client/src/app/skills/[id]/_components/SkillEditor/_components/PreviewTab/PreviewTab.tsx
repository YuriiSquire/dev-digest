/* Preview tab — renders the skill body exactly as the reviewing agent receives
   it. Non-manual sources carry an untrusted-source notice above the render. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Markdown, Icon } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { s } from "./styles";

export function PreviewTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills.preview");
  const untrusted = skill.source !== "manual";

  return (
    <div style={s.wrap}>
      <p style={s.caption}>{t("renderedCaption")}</p>
      {untrusted && (
        <div style={s.notice}>
          <Icon.Shield size={15} style={{ flexShrink: 0 }} />
          <span>{t("untrustedNotice")}</span>
        </div>
      )}
      <div style={s.card}>
        {skill.body.trim() ? <Markdown>{skill.body}</Markdown> : <span style={s.empty}>{t("empty")}</span>}
      </div>
    </div>
  );
}
