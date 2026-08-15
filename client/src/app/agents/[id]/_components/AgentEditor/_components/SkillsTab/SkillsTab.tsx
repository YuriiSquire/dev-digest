"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, Icon, Skeleton } from "@devdigest/ui";
import type { Agent, Skill } from "@devdigest/shared";
import { useSkills, useAgentSkills, useSetAgentSkills } from "../../../../../../../lib/hooks/skills";
import { TYPE_COLOR } from "./constants";
import { s } from "./styles";

/**
 * Skills tab — attach workspace skills to an agent and order them.
 *
 * One ordered list: bound skills first (in link order), then the rest. Toggling
 * a checkbox binds/unbinds; native HTML5 drag reorders. Either action persists
 * the ordered list of BOUND skill ids via `useSetAgentSkills`. Local order is
 * optimistic and re-seeds from the server whenever the agent, the skill catalog,
 * or the links change (mirrors ConfigTab's reset-on-agent-id).
 */
export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const { data: skills, isLoading } = useSkills();
  const { data: links } = useAgentSkills(agent.id);
  const setAgentSkills = useSetAgentSkills(agent.id);

  // Full display order (all skill ids) + the bound subset.
  const [orderIds, setOrderIds] = React.useState<string[]>([]);
  const [bound, setBound] = React.useState<Set<string>>(() => new Set());
  const dragId = React.useRef<string | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  // Seed local state from the server: bound first (link order, then unbound in
  // catalog order). Re-runs on agent switch and whenever server data arrives.
  React.useEffect(() => {
    if (!skills || !links) return;
    const boundOrder = [...links]
      .sort((a, b) => a.order - b.order)
      .map((l) => l.skill_id)
      .filter((id) => skills.some((sk) => sk.id === id));
    const unbound = skills.filter((sk) => !boundOrder.includes(sk.id)).map((sk) => sk.id);
    setOrderIds([...boundOrder, ...unbound]);
    setBound(new Set(boundOrder));
  }, [agent.id, skills, links]);

  const byId = React.useMemo(() => {
    const m = new Map<string, Skill>();
    (skills ?? []).forEach((sk) => m.set(sk.id, sk));
    return m;
  }, [skills]);

  const persist = (order: string[], boundSet: Set<string>) =>
    setAgentSkills.mutate(order.filter((id) => boundSet.has(id)));

  const toggle = (id: string) => {
    const next = new Set(bound);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setBound(next);
    persist(orderIds, next);
  };

  const onDragStart = (id: string) => {
    dragId.current = id;
    setDraggingId(id);
  };

  const onDragOverRow = (overId: string) => {
    const from = dragId.current;
    if (from == null || from === overId) return;
    setOrderIds((prev) => {
      const fromIdx = prev.indexOf(from);
      const toIdx = prev.indexOf(overId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      if (moved === undefined) return prev;
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  // Persist ONCE per drag, on dragend. The drag lifecycle fires `drop` then
  // `dragend`, so persisting from both sent two concurrent POSTs that raced into
  // a duplicate agent_skills PK. `dragover` already reorders `orderIds` live, so
  // dragend commits the final order whether or not the drop landed on a row.
  const endDrag = () => {
    dragId.current = null;
    setDraggingId(null);
    persist(orderIds, bound);
  };

  const rows = orderIds.map((id) => byId.get(id)).filter((sk): sk is Skill => !!sk);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <span style={s.count}>
          {t("skills.enabledCount", { linked: bound.size, total: skills?.length ?? 0 })}
        </span>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {isLoading ? (
        <div style={s.list}>
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      ) : rows.length === 0 ? (
        <p style={s.empty}>{t("card.skillCount", { count: 0 })}</p>
      ) : (
        <div style={s.list}>
          {rows.map((sk) => (
            <div
              key={sk.id}
              data-testid={`skill-row-${sk.id}`}
              draggable
              onDragStart={() => onDragStart(sk.id)}
              onDragOver={(e) => {
                e.preventDefault();
                onDragOverRow(sk.id);
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={endDrag}
              style={{ ...s.row, ...(draggingId === sk.id ? s.rowDragging : null) }}
            >
              <span style={s.handle} aria-hidden>
                <Icon.Menu size={15} />
              </span>
              <Checkbox checked={bound.has(sk.id)} onChange={() => toggle(sk.id)} />
              <span style={s.name}>{sk.name}</span>
              <Badge color={TYPE_COLOR[sk.type]}>{sk.type}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
