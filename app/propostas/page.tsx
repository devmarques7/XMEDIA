"use client";

import { useBoardDrag } from "@/lib/useBoardDrag";
import { DropZone } from "@/components/DropZone";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ExpandedActions, RowActions, useRowExpand, type RowAction } from "@/components/RowActions";
import { useAccess } from "@/lib/access";
import { can } from "@/lib/roles";
import { SlideFrame, SlideView } from "@/components/proposal/Slide";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { STAGES, emptyProposal, importProposalJson, pipeline, type Proposal, type Stage } from "@/lib/proposal";
import { PROPOSAL_SAVED, ensureBundledProposals, proposalStore } from "@/lib/proposalStore";
import { pad } from "@/lib/util";

const LS_VIEW = "xmedia:proposals:view";
const STAGE_TONE: Record<Stage, string> = { lead: "muted", diagnosis: "", sent: "tone-warn", negotiation: "tone-warn", won: "tone-ok", lost: "tone-danger" };

export default function ProposalsPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const [toast, setToast] = useToast();
  const [list, setList] = useState<Proposal[] | null>(null);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [jsonOpen, setJsonOpen] = useState(false);
  const [json, setJson] = useState("");

  const load = useCallback(() => proposalStore.list().then(setList).catch((e) => setToast(e.message)), [setToast]);
  useEffect(() => {
    // propostas incluídas na app (ex.: Boat Event) são criadas aqui, sem SQL
    ensureBundledProposals()
      .then((w) => {
        if (w.length) setToast(`${w.join(", ")}`);
      })
      .catch(() => {})
      .finally(load);
    try {
      if (localStorage.getItem(LS_VIEW) === "kanban") setView("kanban");
    } catch {}
    window.addEventListener(PROPOSAL_SAVED, load);
    return () => window.removeEventListener(PROPOSAL_SAVED, load);
  }, [load]);

  const kpi = useMemo(() => pipeline(list ?? []), [list]);
  const money = (v: number, c = "EUR") => new Intl.NumberFormat(locale, { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);
  const date = (d?: string) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "—");

  function pickView(v: "table" | "kanban") {
    setView(v);
    try {
      localStorage.setItem(LS_VIEW, v);
    } catch {}
  }

  const access = useAccess();
  const { isOpen, onRow } = useRowExpand();
  async function create(patch: Partial<Proposal> = {}) {
    const p = { ...emptyProposal(t("pr.new")), ...patch };
    const saved = await proposalStore.save(p);
    router.push(`/propostas/${saved.id}`);
  }

  async function setStage(p: Proposal, stage: Stage) {
    if (p.stage === stage) return;
    setList((l) => l?.map((x) => (x.id === p.id ? { ...x, stage } : x)) ?? l);
    const sent_at = stage === "sent" && !p.sent_at ? new Date().toISOString().slice(0, 10) : p.sent_at;
    await proposalStore.save({ ...p, stage, sent_at }).catch((e) => setToast(e.message));
  }

  async function duplicate(p: Proposal) {
    const saved = await proposalStore.save({ ...p, id: crypto.randomUUID(), title: `${p.title} (copy)`, stage: "lead", sent_at: "" });
    router.push(`/propostas/${saved.id}`);
  }

  async function remove(p: Proposal) {
    if (!confirm(t("pr.deleteConfirm", { title: p.title }))) return;
    await proposalStore.remove(p.id);
    load();
  }

  const importNow = () => {
    const r = importProposalJson(json);
    if (r.errors.length) return setToast(r.errors[0]);
    create(r.patch).catch((e) => setToast(e.message));
  };

  const dnd = useBoardDrag({ onDrop: (id, to) => { const x = list?.find((y) => y.id === id); if (x) setStage(x, to as Stage); } });
  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("pr.sub")}</span>
          <h1 className="h1">{t("nav.proposals")}</h1>
        </div>
        <div className="row">
          <div className="seg" role="group">
            <button aria-pressed={view === "table"} onClick={() => pickView("table")}>
              {t("pr.table")}
            </button>
            <button aria-pressed={view === "kanban"} onClick={() => pickView("kanban")}>
              {t("pr.kanban")}
            </button>
          </div>
          <button className="btn" onClick={() => setJsonOpen((o) => !o)} aria-expanded={jsonOpen}>
            {"{ }"} {t("pr.import")}
          </button>
          <button className="btn accent" onClick={() => create()}>
            + {t("pr.new")}
          </button>
        </div>
      </section>

      {jsonOpen && (
        <div className="jsonbox stack" style={{ marginBottom: 14 }}>
          <textarea className="textarea mono" rows={8} value={json} onChange={(e) => setJson(e.target.value)} placeholder='{ "title": "Shirley", "value": 2950, "slides": [ { "type": "section", "number": "1", "title": "Intro", "text": "…" } ] }' spellCheck={false} />
          <div className="row">
            <button className="btn accent" onClick={importNow} disabled={!json.trim()}>
              + {t("pr.new")}
            </button>
            <DropZone target="json" compact onFiles={async ([f]) => setJson(await f.text())} />
          </div>
        </div>
      )}

      <div className="widgets teamstats" style={{ paddingTop: 0, marginBottom: 14 }}>
        <div className="w span-4">
          <div className="label muted">{t("pr.open")}</div>
          <div className="num" style={{ marginTop: 12 }}>
            {money(kpi.openValue)}
          </div>
          <span className="muted small">{pad(kpi.openCount)}</span>
        </div>
        <div className="w span-4">
          <div className="label muted">{t("pr.won")}</div>
          <div className="num" style={{ marginTop: 12 }}>
            {money(kpi.wonValue)}
          </div>
        </div>
        <div className="w span-4">
          <div className="label muted">{t("pr.winRate")}</div>
          <div className="num" style={{ marginTop: 12 }}>
            {kpi.winRate === null ? "—" : `${kpi.winRate}%`}
          </div>
        </div>
      </div>

      {list?.length === 0 && <p className="muted w">{t("pr.empty")}</p>}

      {!!list?.length && view === "table" && (
        <section className="w">
          <div className="tablewrap">
            <table className="table rt">
              <thead>
                <tr>
                  <th>{t("pr.col.title")}</th>
                  <th>{t("pr.col.client")}</th>
                  <th className="r">{t("pr.col.value")}</th>
                  <th>{t("pr.col.stage")}</th>
                  <th>{t("pr.col.valid")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const edit = can(access, "proposals.edit");
                  const actions: RowAction[] = [
                    { key: "open", label: t("ra.edit"), icon: "edit", href: `/propostas/${p.id}` },
                    { key: "present", label: t("pr.present"), icon: "play", href: `/propostas/${p.id}/apresentar` },
                    { key: "pdf", label: t("ra.pdf"), icon: "download", href: `/propostas/${p.id}/print`, external: true },
                    { key: "duplicate", label: t("ra.duplicate"), icon: "copy", onClick: () => duplicate(p), allowed: edit },
                    { key: "delete", label: t("ra.delete"), icon: "trash", danger: true, onClick: () => remove(p), allowed: edit },
                  ];
                  const open = isOpen(p.id);
                  return (
                    <Fragment key={p.id}>
                      <tr className={open ? "open has-exp" : ""} style={{ cursor: "pointer" }} onClick={() => onRow(p.id, () => router.push(`/propostas/${p.id}`))}>
                        <td className="rt-main">
                          <span className="row" style={{ gap: 12, flexWrap: "nowrap", minWidth: 0 }}>
                            <span className="pr-thumb hide-sm">
                              <SlideFrame>
                                <SlideView slide={p.doc.slides[0]} doc={p.doc} mode="print" />
                              </SlideFrame>
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span className="cell-title">{p.title}</span>
                              <span className="muted small" style={{ display: "block" }}>
                                {p.doc.slides.length} slides · {date(p.updated_at)}
                              </span>
                            </span>
                          </span>
                          <span className="rt-chev"><Icon name="chevronDown" size={14} /></span>
                        </td>
                        <td className="muted" data-label={t("pr.col.client")}>
                          {p.client.company || p.client.name || "—"}
                        </td>
                        <td className="r mono" data-label={t("pr.col.value")}>
                          {money(p.value, p.currency)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()} data-label={t("pr.col.stage")}>
                          <Select className={`select statussel ${STAGE_TONE[p.stage]}`} value={p.stage} onChange={(e) => setStage(p, e.target.value as Stage)} aria-label={t("pr.col.stage")} disabled={!can(access, "proposals.edit")}>
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {t(`pr.stage.${s}`)}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="mono small" data-label={t("pr.col.valid")}>
                          {date(p.valid_until)}
                        </td>
                        <td className="rt-act">
                          <RowActions actions={actions} />
                        </td>
                      </tr>
                      <tr className={`rt-exp ${open ? "open" : ""}`}>
                        <td colSpan={6}>
                          <ExpandedActions actions={actions} />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!!list?.length && view === "kanban" && (
        <div className={`kanban ${dnd.board}`} data-kb-scroll>
          {STAGES.map((s) => {
            const items = list.filter((p) => p.stage === s);
            return (
              <section key={s} {...dnd.col(s)} className={`kcol ${dnd.col(s).className}`}>
                <header className="kcol-head">
                  <span className={`label ${STAGE_TONE[s]}`}>{t(`pr.stage.${s}`)}</span>
                  <span className="mono small muted">
                    {pad(items.length)} · {money(items.reduce((a, p) => a + p.value, 0))}
                  </span>
                </header>
                {items.map((p) => (
                  <article
                    key={p.id}
                    className={`kcard kb-card ${dnd.card(p.id, s).className}`}
                    data-kb-card={p.id}
                    onPointerDown={dnd.card(p.id, s).onPointerDown}
                    onClick={() => router.push(`/propostas/${p.id}`)}
                  >
                    <div className="pr-thumb">
                      <SlideFrame>
                        <SlideView slide={p.doc.slides[0]} doc={p.doc} mode="print" />
                      </SlideFrame>
                    </div>
                    <b>{p.title}</b>
                    <span className="muted small">{p.client.company || p.client.name || "—"}</span>
                    <div className="row between" style={{ flexWrap: "nowrap" }}>
                      <span className="mono">{money(p.value, p.currency)}</span>
                      <Select
                        className="select statussel kcard-stage"
                        value={p.stage}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setStage(p, e.target.value as Stage)}
                        aria-label={t("pr.col.stage")}
                      >
                        {STAGES.map((x) => (
                          <option key={x} value={x}>
                            {t(`pr.stage.${x}`)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </article>
                ))}
                {!items.length && <div className="kempty muted small">{t("pr.dropHere")}</div>}
              </section>
            );
          })}
        </div>
      )}
      <Toast msg={toast} />
    </AppShell>
  );
}
