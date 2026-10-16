"use client";

// Tabela de projetos no formato comum: nome + cliente, poucas colunas e ações (⋯); no telemóvel só o nome e,
// ao tocar, os detalhes e as ações.
import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
import { ExpandedActions, RowActions, useRowExpand, type RowAction } from "./RowActions";
import { useAccess } from "@/lib/access";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/roles";
import { store } from "@/lib/store";
import type { Project } from "@/lib/types";
import { fmtDate, pad, projectStats } from "@/lib/util";

export function ProjectsTable({ projects, actions = false, onChanged }: { projects: Project[]; actions?: boolean; onChanged?: () => void }) {
  const { t, locale } = useT();
  const router = useRouter();
  const access = useAccess();
  const { isOpen, onRow } = useRowExpand();
  return (
    <div className="tablewrap">
      <table className="table rt">
        <thead>
          <tr>
            <th>{t("col.name")}</th>
            <th>{t("col.shoot")}</th>
            <th className="r">{t("col.reels")}</th>
            <th style={{ width: 160 }}>{t("col.scenes")}</th>
            <th className="r">{t("col.updated")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => {
            const s = projectStats(p.data);
            const list: RowAction[] = [
              { key: "open", label: t("ra.open"), icon: "eye", href: `/p/${p.id}` },
              { key: "shoot", label: t("pj.shoot"), icon: "play", href: `/p/${p.id}/shoot`, allowed: actions },
              { key: "edit", label: t("ra.edit"), icon: "edit", href: `/p/${p.id}`, allowed: can(access, "projects.edit") },
              {
                key: "delete",
                label: t("ra.delete"),
                icon: "trash",
                danger: true,
                allowed: can(access, "projects.edit") && !!onChanged,
                confirm: t("ra.confirmDelete", { name: p.title }),
                onClick: async () => {
                  await store.remove(p.id);
                  onChanged?.();
                },
              },
            ];
            const open = isOpen(p.id);
            return (
              <Fragment key={p.id}>
                <tr className={open ? "open has-exp" : ""} style={{ cursor: "pointer" }} onClick={() => onRow(p.id, () => router.push(`/p/${p.id}`))}>
                  <td className="rt-main">
                    <span className="row" style={{ gap: 12, flexWrap: "nowrap", minWidth: 0 }}>
                      <span className="index hide-sm">{pad(i + 1)}</span>
                      <span style={{ minWidth: 0 }}>
                        <span className="cell-title">{p.title}</span>
                        <span className="muted small" style={{ display: "block" }}>
                          {p.data.client || "—"} · v{Math.max(1, p.version - 1)}
                        </span>
                      </span>
                    </span>
                    <span className="rt-chev"><Icon name="chevronDown" size={14} /></span>
                  </td>
                  <td className="mono small" data-label={t("col.shoot")}>
                    {fmtDate(p.data.shootDate, locale) || "—"}
                  </td>
                  <td className="r num" style={{ fontSize: 20 }} data-label={t("col.reels")}>
                    {pad(s.reels)}
                  </td>
                  <td data-label={t("col.scenes")}>
                    <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                      <div className="progress" style={{ flex: 1, minWidth: 60 }}>
                        <i style={{ width: `${s.scenes ? (s.done / s.scenes) * 100 : 0}%` }} />
                      </div>
                      <span className="mono" style={{ fontSize: 12 }}>
                        {s.done}/{s.scenes}
                      </span>
                    </div>
                  </td>
                  <td className="r mono muted small" data-label={t("col.updated")}>
                    {new Date(p.updated_at).toLocaleDateString(locale, { day: "2-digit", month: "short" })}
                  </td>
                  <td className="rt-act">
                    <RowActions actions={list} />
                  </td>
                </tr>
                <tr className={`rt-exp ${open ? "open" : ""}`}>
                  <td colSpan={6}>
                    <ExpandedActions actions={list} />
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
