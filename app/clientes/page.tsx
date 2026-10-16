"use client";

import { AccessView } from "@/components/customer/AccessView";
import { useBoardDrag } from "@/lib/useBoardDrag";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ExpandedActions, RowActions, useRowExpand, type RowAction } from "@/components/RowActions";
import { Cover } from "@/components/customer/parts";
import { CrmOverview } from "@/components/customer/CrmOverview";
import { PortalPreview } from "@/components/customer/PortalPreview";
import { InviteDialog } from "@/components/customer/InviteDialog";
import { useAccess } from "@/lib/access";
import { can } from "@/lib/roles";
import { invoiceStore } from "@/lib/invoiceStore";
import type { Invoice } from "@/lib/invoice";
import { AppShell, Toast, useToast } from "@/components/ui";
import { CSTAGES, DEFAULT_SETTINGS, emptyCustomer, monthlyFee, mrr, planState, seedCustomers, stageProgress, type ContentPost, type CStage, type Customer, type PortalSettings } from "@/lib/customer";
import { CUSTOMER_SAVED, customerStore } from "@/lib/customerStore";
import { ensureBundledInvoices } from "@/lib/invoiceStore";
import { useT, type Key } from "@/lib/i18n";
import { isoDay, pad } from "@/lib/util";

const LS_VIEW = "xmedia:customers:view";
const STAGE_TONE: Record<CStage, string> = { not_started: "muted", stage0: "", stage1: "tone-warn", stage2: "tone-warn", stage3: "tone-warn", stage4: "tone-warn", complete: "tone-ok" };
const PORTAL_TONE = { none: "muted", invited: "tone-warn", active: "tone-ok", disabled: "tone-danger" } as const;

export default function CustomersPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const [toast, setToast] = useToast();
  const [list, setList] = useState<Customer[] | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<"overview" | "table" | "kanban" | "access">("overview");
  const access = useAccess();
  const fin = !!access && can(access, "finance.view");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [preview, setPreview] = useState<Customer | null>(null);
  const { isOpen, onRow } = useRowExpand();
  const [inviteFor, setInviteFor] = useState<Customer | null>(null);
  useEffect(() => {
    if (fin) invoiceStore.list().then(setInvoices).catch(() => {});
  }, [fin]);

  const load = useCallback(async () => {
    try {
      const [c, p, s] = await Promise.all([customerStore.list(), customerStore.posts(), customerStore.settings()]);
      setList(c);
      setPosts(p);
      setSettings(s);
    } catch (e) {
      setToast((e as Error).message);
      setList([]);
    }
  }, [setToast]);
  useEffect(() => {
    // clientes das invoices (dados de faturação) são criados/atualizados aqui também, sem SQL
    ensureBundledInvoices()
      .catch(() => {})
      .finally(load);
    try {
      const v = localStorage.getItem(LS_VIEW);
      if (v === "table" || v === "kanban" || v === "access") setView(v);
    } catch {}
    window.addEventListener(CUSTOMER_SAVED, load);
    return () => window.removeEventListener(CUSTOMER_SAVED, load);
  }, [load]);

  const pickView = (v: "overview" | "table" | "kanban" | "access") => {
    setView(v);
    try {
      localStorage.setItem(LS_VIEW, v);
    } catch {}
  };
  const money = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const kpi = useMemo(() => {
    const now = Date.now();
    const week = now + 7 * 86_400_000;
    return {
      active: (list ?? []).filter((c) => c.stage !== "complete" && c.stage !== "not_started").length,
      mrr: mrr(list ?? [], settings),
      scheduled: posts.filter((p) => p.status === "scheduled" && p.scheduled_at && +new Date(p.scheduled_at) >= now && +new Date(p.scheduled_at) <= week).length,
      review: posts.filter((p) => p.status === "review").length,
    };
  }, [list, posts, settings]);

  const nextPost = (id: string) => posts.find((p) => p.customer_id === id && p.status !== "published" && p.scheduled_at && +new Date(p.scheduled_at) >= Date.now());

  async function create() {
    const c = await customerStore.save(emptyCustomer(t("cu.newName")));
    router.push(`/clientes/${c.id}`);
  }
  async function seed() {
    const names = new Set((list ?? []).map((c) => c.name.toLowerCase()));
    for (const c of seedCustomers()) if (!names.has(c.name.toLowerCase())) await customerStore.save(c);
    load();
  }
  async function setStage(c: Customer, stage: CStage) {
    if (c.stage === stage) return;
    setList((l) => l?.map((x) => (x.id === c.id ? { ...x, stage } : x)) ?? l);
    await customerStore.save({ ...c, stage }).catch((e) => setToast(e.message));
  }

  const stageSelect = (c: Customer, cls = "") => (
    <Select className={`select statussel ${STAGE_TONE[c.stage]} ${cls}`} value={c.stage} onClick={(e) => e.stopPropagation()} onChange={(e) => setStage(c, e.target.value as CStage)} aria-label={t("cu.col.stage")}>
      {CSTAGES.map((s) => (
        <option key={s} value={s}>
          {t(`cu.stage.${s}` as Key)}
        </option>
      ))}
    </Select>
  );

  const dnd = useBoardDrag({ onDrop: (id, to) => { const x = list?.find((y) => y.id === id); if (x) setStage(x, to as CStage); } });
  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("cu.sub")}</span>
          <h1 className="h1">{t("nav.customers")}</h1>
        </div>
        <div className="row">
          <div className="seg" role="group">
            <button aria-pressed={view === "overview"} onClick={() => pickView("overview")}>
              CRM
            </button>
            <button aria-pressed={view === "kanban"} onClick={() => pickView("kanban")}>
              {t("pr.kanban")}
            </button>
            <button aria-pressed={view === "table"} onClick={() => pickView("table")}>
              {t("pr.table")}
            </button>
            <button aria-pressed={view === "access"} onClick={() => pickView("access")} data-testid="view-access">
              {t("ax.title")}
            </button>
          </div>
          {list?.length === 0 && (
            <button className="btn" onClick={seed}>
              <Icon name="download" size={14} /> {t("cu.seed")}
            </button>
          )}
          <button className="btn accent" onClick={create}>
            + {t("cu.new")}
          </button>
        </div>
      </section>

      {!!list?.length && view === "overview" && <CrmOverview
          list={list}
          posts={posts}
          invoices={invoices}
          settings={settings}
          fin={fin}
          onPreview={setPreview}
          onDelete={async (c) => {
            await customerStore.remove(c.id).catch((e) => setToast((e as Error).message));
            load();
          }}
        />}

      {list?.length === 0 && <p className="muted w">{t("cu.empty")}</p>}

      {!!list?.length && view === "access" && (
        <AccessView
          list={list}
          posts={posts}
          onToast={setToast}
          onSave={async (c) => {
            setList((l) => l?.map((x) => (x.id === c.id ? c : x)) ?? l);
            await customerStore.save(c).catch((e) => setToast((e as Error).message));
            load();
          }}
        />
      )}

      {!!list?.length && view === "kanban" && (
        <div className={`kanban ${dnd.board}`} data-kb-scroll>
          {CSTAGES.map((s) => {
            const items = list.filter((c) => c.stage === s);
            return (
              <section key={s} {...dnd.col(s)} className={`kcol ${dnd.col(s).className}`}>
                <header className="kcol-head">
                  <span className={`label ${STAGE_TONE[s]}`}>{t(`cu.stage.${s}` as Key)}</span>
                  <span className="mono small muted">{pad(items.length)}</span>
                </header>
                {items.map((c) => {
                  const pr = stageProgress(c);
                  const np = nextPost(c.id);
                  return (
                    <article
                      key={c.id}
                      className={`kcard cu-card kb-card ${dnd.card(c.id, s).className}`}
                      data-kb-card={c.id}
                      onPointerDown={dnd.card(c.id, s).onPointerDown}
                      onClick={() => router.push(`/clientes/${c.id}`)}
                    >
                      {c.cover && (
                        <span className="cu-cover">
                          <Cover src={c.cover} />
                        </span>
                      )}
                      <b>{c.name}</b>
                      <span className="muted small">{[c.contact, c.instagram.handle && `@${c.instagram.handle}`].filter(Boolean).join(" · ") || c.email || "—"}</span>
                      {pr.total > 0 && (
                        <span className="cu-bar" aria-label={`${pr.done}/${pr.total}`}>
                          <i style={{ width: `${pr.pct}%` }} />
                        </span>
                      )}
                      <div className="row between" style={{ flexWrap: "nowrap", gap: 6 }}>
                        <span className={`label ${PORTAL_TONE[c.portal.status]}`}>{t(`cu.portal.${c.portal.status}` as Key)}</span>
                        {pr.total > 0 && (
                          <span className="mono small muted">
                            {pr.done}/{pr.total}
                          </span>
                        )}
                      </div>
                      {np && <span className="small muted"><Icon name="clock" size={14} /> {when(np.scheduled_at)}</span>}
                      {stageSelect(c, "kcard-stage")}
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {!!list?.length && view === "table" && (
        <section className="w">
          <div className="tablewrap">
            <table className="table rt">
              <thead>
                <tr>
                  <th>{t("cu.col.name")}</th>
                  <th>{t("cu.col.stage")}</th>
                  <th>{t("cu.col.portal")}</th>
                  <th className="r">{t("cu.col.plan")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const pr = stageProgress(c);
                  const np = nextPost(c.id);
                  const ps = planState(c, isoDay());
                  const edit = can(access, "customers.edit");
                  const actions: RowAction[] = [
                    { key: "open", label: t("ra.open"), icon: "eye", href: `/clientes/${c.id}` },
                    { key: "preview", label: t("ra.preview"), icon: "page", onClick: () => setPreview(c) },
                    { key: "invite", label: t("iv.cta"), icon: "user", onClick: () => setInviteFor(c), allowed: edit },
                    { key: "email", label: t("ra.message"), icon: "mail", href: c.email ? `mailto:${c.email}` : undefined, external: true, allowed: !!c.email },
                    { key: "edit", label: t("ra.edit"), icon: "edit", href: `/clientes/${c.id}?tab=process`, allowed: edit },
                    {
                      key: "delete",
                      label: t("ra.delete"),
                      icon: "trash",
                      danger: true,
                      allowed: edit,
                      confirm: t("ra.confirmDelete", { name: c.name }),
                      onClick: async () => {
                        await customerStore.remove(c.id).catch((e) => setToast((e as Error).message));
                        load();
                      },
                    },
                  ];
                  const open = isOpen(c.id);
                  return (
                    <Fragment key={c.id}>
                      <tr className={open ? "open has-exp" : ""} style={{ cursor: "pointer" }} onClick={() => onRow(c.id, () => router.push(`/clientes/${c.id}`))}>
                        <td className="rt-main">
                          <span style={{ minWidth: 0 }}>
                            <span className="cell-title">{c.name}</span>
                            <span className="muted small" style={{ display: "block" }}>
                              {[c.contact || c.email, c.instagram.handle && `@${c.instagram.handle}${c.instagram.connected ? " ✓" : ""}`, pr.total ? `${pr.done}/${pr.total}` : "", np ? `◷ ${when(np.scheduled_at)}` : ""].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="rt-chev"><Icon name="chevronDown" size={14} /></span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()} data-label={t("cu.col.stage")}>
                          {stageSelect(c)}
                        </td>
                        <td data-label={t("cu.col.portal")}>
                          <span className={`label ${PORTAL_TONE[c.portal.status]}`}>{t(`cu.portal.${c.portal.status}` as Key)}</span>
                        </td>
                        <td className="r mono small" data-label={t("cu.col.plan")}>
                          {ps === "inactive" ? "—" : money(monthlyFee(c, settings))}
                          <div className={`small ${ps === "due" ? "tone-warn" : "muted"}`}>{t(`cu.plan.${ps}` as Key)}</div>
                        </td>
                        <td className="rt-act">
                          <RowActions actions={actions} />
                        </td>
                      </tr>
                      <tr className={`rt-exp ${open ? "open" : ""}`}>
                        <td colSpan={5}>
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
      {inviteFor && <InviteDialog customer={inviteFor} onClose={() => setInviteFor(null)} onDone={(m) => setToast(m)} />}
      {preview && (
        <PortalPreview
          customer={preview}
          posts={posts}
          settings={settings}
          onClose={() => setPreview(null)}
          onSaved={(m) => {
            setToast(m);
            load();
          }}
        />
      )}
      <Toast msg={toast} />
    </AppShell>
  );
}
