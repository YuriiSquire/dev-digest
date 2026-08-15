/* ImportSkillDrawer — import a skill from pasted Markdown, a URL, or the
   community catalog. Every path goes through useImportSkill; the result always
   lands DISABLED and is shown with an untrusted-source notice so it must be
   previewed + vetted before it is enabled. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Drawer,
  Tabs,
  FormField,
  TextInput,
  Textarea,
  Icon,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useImportSkill, useCommunitySkills } from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { DRAWER_WIDTH, IMPORT_TABS, type ImportTab } from "./constants";
import { s } from "./styles";

export function ImportSkillDrawer({
  initialTab = "file",
  onClose,
  onImported,
}: {
  initialTab?: ImportTab;
  onClose: () => void;
  onImported?: (skill: Skill) => void;
}) {
  const t = useTranslations("skills");
  const dr = useTranslations("skills.drawer");
  const toast = useToast();
  const [tab, setTab] = React.useState<ImportTab>(initialTab);

  const importSkill = useImportSkill();

  // file
  const [fileName, setFileName] = React.useState("");
  const [fileBody, setFileBody] = React.useState("");
  // url
  const [url, setUrl] = React.useState("");
  // community
  const [query, setQuery] = React.useState("");

  const finish = (skill: Skill, message: string) => {
    toast.success(message);
    onImported?.(skill);
    onClose();
  };

  const importFile = async () => {
    const skill = await importSkill.mutateAsync({
      kind: "text",
      name: fileName.trim() || undefined,
      body: fileBody,
    });
    finish(skill, t("file.success", { name: skill.name }));
  };

  const importUrl = async () => {
    const skill = await importSkill.mutateAsync({ kind: "url", url: url.trim() });
    finish(skill, t("url.success", { name: skill.name }));
  };

  const importCommunity = async (name: string) => {
    const skill = await importSkill.mutateAsync({ kind: "community", name });
    finish(skill, t("file.success", { name: skill.name }));
  };

  const tabs = IMPORT_TABS.map((tb) => ({ key: tb.key, label: dr(tb.labelKey), icon: tb.icon }));

  return (
    <Drawer width={DRAWER_WIDTH} title={dr("title")} subtitle={dr("subtitle")} onClose={onClose}>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={(k) => setTab(k as ImportTab)} pad="0" />
      </div>

      <div style={s.notice}>
        <Icon.Shield size={15} style={{ flexShrink: 0 }} />
        <span>{t("preview.untrustedNotice")}</span>
      </div>

      {tab === "file" && (
        <div>
          <FormField label={t("file.nameLabel")} hint={t("file.nameHint")}>
            <TextInput value={fileName} onChange={setFileName} placeholder={t("file.namePlaceholder")} />
          </FormField>
          <FormField label={t("file.bodyLabel")} hint={t("file.bodyHint")}>
            <Textarea
              value={fileBody}
              onChange={setFileBody}
              rows={10}
              mono
              placeholder={t("file.bodyPlaceholder")}
            />
          </FormField>
          <div style={s.actions}>
            <Button
              kind="primary"
              icon="Upload"
              onClick={importFile}
              disabled={importSkill.isPending || !fileBody.trim()}
            >
              {importSkill.isPending ? t("file.importing") : t("file.import")}
            </Button>
          </div>
        </div>
      )}

      {tab === "url" && (
        <div>
          <FormField label={t("url.label")} hint={t("url.hint")}>
            <TextInput value={url} onChange={setUrl} placeholder={t("url.placeholder")} />
          </FormField>
          <div style={s.actions}>
            <Button
              kind="primary"
              icon="Globe"
              onClick={importUrl}
              disabled={importSkill.isPending || !url.trim()}
            >
              {importSkill.isPending ? t("url.fetching") : t("url.import")}
            </Button>
          </div>
        </div>
      )}

      {tab === "community" && (
        <CommunityTab query={query} setQuery={setQuery} onImport={importCommunity} pending={importSkill.isPending} />
      )}
    </Drawer>
  );
}

function CommunityTab({
  query,
  setQuery,
  onImport,
  pending,
}: {
  query: string;
  setQuery: (v: string) => void;
  onImport: (name: string) => void;
  pending: boolean;
}) {
  const t = useTranslations("skills");
  const { data, isLoading, isError, refetch } = useCommunitySkills(query);

  return (
    <div>
      <div style={s.searchBar}>
        <TextInput value={query} onChange={setQuery} placeholder={t("community.searchPlaceholder")} />
      </div>

      {isLoading && <Skeleton height={64} />}
      {isError && <ErrorState body={t("community.loadError")} onRetry={() => refetch()} />}
      {!isLoading && !isError && (data ?? []).length === 0 && (
        <EmptyState icon="Users" title={t("community.noMatch.title")} body={t("community.noMatch.body")} />
      )}
      {(data ?? []).length > 0 && (
        <div style={s.communityList}>
          {(data ?? []).map((c) => (
            <div key={c.name} style={s.communityRow}>
              <div style={s.communityMeta}>
                <div style={s.communityName}>{c.name}</div>
                <div style={s.communityDesc}>{c.desc}</div>
              </div>
              <span style={s.communityStars}>
                <Icon.Star size={12} /> {c.stars}
              </span>
              <Button kind="secondary" size="sm" icon="Plus" onClick={() => onImport(c.name)} disabled={pending}>
                {pending ? t("community.importing") : t("community.import")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
