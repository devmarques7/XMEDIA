"use client";

// Clientes (admin) em mosaico: KPIs (ativos/inativos, mensalidades, alertas, faturação por cliente, fases) e a lista
// CRM completa com estado, faturação, último contacto, alertas de atraso, mensagem rápida e pré-visualização do portal.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExpandedActions, RowActions, type RowAction } from "@/components/RowActions";
import { useAccess } from "@/lib/access";
import { can } from "@/lib/roles";
import { useMemo, useState } from "react";
import { Bars, Tile } from "@/components/bento";
import { Icon } from "@/components/Icon";
import { CSTAGES, mrr, type ContentPost, type Customer, type PortalSettings } from "@/lib/customer";
import { crmRows, messageLinks, type CrmRow } from "@/lib/crm";
import { useT, type Key } from "@/lib/i18n";
import type { Invoice } from "@/lib/invoice";
import { Cover } from "./parts";
import { InviteDialog } from "./InviteDialog";

type Filter = "all" | "active" | "inactive" | "alerts";

export function CrmOverview({ list, posts, invoices, settings, fin, onPreview, onDelete }: { list: Customer[]; posts: ContentPost[]; invoices: Invoice[]; settings: PortalSettings; fin: boolean; onPreview: (c: Customer) => void; onDelete?: (c: Customer) => void }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => crmRows(list, posts, invoices, settings.process), [list, posts, invoices, settings]);
  const year = String(new Date().getFullYear());
  const eur = (v: number, d = 0) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: d }).format(v);
  const date = (iso: string) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "2-digit" }) : "—");
  const active = rows.filter((r) => r.active).length;
  const late = rows.reduce((s, r) => s + r.late, 0);
  const overdue = rows.reduce((s, r) => s + r.overdue, 0);
  const review = rows.reduce((s, r) => s + r.review, 0);
  const onPortal = list.filter((c) => c.portal.status === "active").length;
  const top = [...rows].sort((a, b) => b.revenueYtd - a.revenueYtd).filter((r) => r.revenueYtd > 0).slice(0, 8);
  const stages = CSTAGES.map((s) => list.filter((c) => c.stage === s).length);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows
      .filter((r) => (filter === "all" ? true : filter === "active" ? r.active : filter === "inactive" ? !r.active : r.alerts + r.review > 0))
      .filter((r) => !n || [r.c.name, r.c.contact, r.c.email, r.c.billing?.company, r.c.instagram.handle].join(" ").toLowerCase().includes(n))
      .sort((a, b) => Number(b.active) - Number(a.active) || b.alerts - a.alerts || b.revenueYtd - a.revenueYtd || a.c.name.localeCompare(b.c.name));
  }, [rows, filter, q]);

  return (
    <>
      <section className="widgets bento" style={{ paddingTop: 0 }}>
        <Tile span={3} tone="blue" title={t("cl.total")} value={list.length} of={`${active} ${t("cl.active").toLowerCase()}`} testid="cl-total">
          <div className="meter" aria-hidden>
            <i style={{ width: `${list.length ? (active / list.length) * 100 : 0}%` }} />
          </div>
        </Tile>
        <Tile span={3} title={`${t("cl.active")} / ${t("cl.inactive")}`} value={active} of={`/ ${list.length - active}`} foot={<><span>{t("cl.portal")}</span><span>{onPortal}</span></>} />
        <Tile span={3} title={t("cl.mrr")} value={eur(mrr(list, settings))} of={t("cu.perMonth")} small foot={<><span>{t("cl.review")}</span><span className={review ? "tone-warn" : ""}>{review}</span></>} />
        <div className={`w tile span-3 ${late + overdue ? "sand" : ""}`} data-testid="cl-alerts">
          <div className="tile-head">
            <span className="tile-t">{t("cl.alerts")}</span>
            <button className="tile-menu" onClick={() => setFilter("alerts")} aria-label={t("cl.withAlerts")}>
              <Icon name="more" size={16} />
            </button>
          </div>
          <div className="tile-foot">
            <span className="tile-num">{late + overdue}</span>
          </div>
          <div className="tile-sep">
            <span>
              {t("cl.late")} {late}
            </span>
            <span>
              {t("cl.overdue")} {overdue}
            </span>
          </div>
        </div>

        {fin && (
          <div className="w tile span-6">
            <span className="tile-t">{t("cl.top", { year })}</span>
            {top.length ? (
              <div className="cl-top">
                {top.map((r) => (
                  <Link key={r.c.id} href={`/clientes/${r.c.id}`} className="cl-topbar">
                    <span className="small">{r.c.name}</span>
                    <span className="meter">
                      <i style={{ width: `${(r.revenueYtd / top[0].revenueYtd) * 100}%` }} />
                    </span>
                    <span className="mono small">{eur(r.revenueYtd)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted small">—</p>
            )}
          </div>
        )}
        <div className={`w tile ${fin ? "span-6" : "span-12"}`}>
          <span className="tile-t">{t("cl.byStage")}</span>
          <Bars values={stages} labels={CSTAGES.map((s) => t(`cu.stage.${s}` as Key).replace(/^Fase \d · |^Phase \d · |^Fase \d · /, "").slice(0, 10))} on={stages.indexOf(Math.max(...stages))} />
        </div>
      </section>

      <section className="w stack cl-list">
        <div className="row between">
          <div className="row" style={{ gap: 6 }}>
            {(["all", "active", "inactive", "alerts"] as Filter[]).map((f) => (
              <button key={f} className={`cb-chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
                {t(f === "all" ? "cl.all" : f === "active" ? "cl.onlyActive" : f === "inactive" ? "cl.onlyInactive" : "cl.withAlerts")}{" "}
                <span className="muted">{f === "all" ? rows.length : f === "active" ? active : f === "inactive" ? rows.length - active : rows.filter((r) => r.alerts + r.review > 0).length}</span>
              </button>
            ))}
          </div>
          <input className="input" style={{ maxWidth: 300 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("cl.search")} aria-label={t("cl.search")} />
        </div>
        <div className="cl-rows">
          {shown.map((r) => (
            <Row
              key={r.c.id}
              r={r}
              fin={fin}
              eur={eur}
              date={date}
              onPreview={() => onPreview(r.c)}
              onDelete={onDelete ? () => onDelete(r.c) : undefined}
              open={openId === r.c.id}
              onToggle={() => (window.matchMedia("(max-width: 760px)").matches ? setOpenId((x) => (x === r.c.id ? null : r.c.id)) : router.push(`/clientes/${r.c.id}`))}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function Row({ r, fin, eur, date, onPreview, onDelete, open, onToggle }: { r: CrmRow; fin: boolean; eur: (v: number) => string; date: (iso: string) => string; onPreview: () => void; onDelete?: () => void; open: boolean; onToggle: () => void }) {
  const { t } = useT();
  const access = useAccess();
  const c = r.c;
  const msg = messageLinks(c, t("po.hello", { name: (c.contact || c.name).split(" ")[0] }) + " ");
  const initials = c.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const edit = can(access, "customers.edit");
  const [invite, setInvite] = useState(false);
  const actions: RowAction[] = [
    { key: "open", label: t("ra.open"), icon: "eye", href: `/clientes/${c.id}` },
    { key: "preview", label: t("ra.preview"), icon: "page", onClick: onPreview },
    { key: "invite", label: t("iv.cta"), icon: "user", onClick: () => setInvite(true), allowed: edit },
    { key: "email", label: t("ra.message"), icon: "mail", href: msg.email || undefined, external: true, allowed: !!msg.email },
    { key: "whatsapp", label: t("ra.whatsapp"), icon: "chat", href: msg.whatsapp || undefined, external: true, allowed: !!msg.whatsapp },
    { key: "edit", label: t("ra.edit"), icon: "edit", href: `/clientes/${c.id}?tab=process`, allowed: edit },
    { key: "delete", label: t("ra.delete"), icon: "trash", danger: true, onClick: onDelete, allowed: edit && !!onDelete, confirm: t("ra.confirmDelete", { name: c.name }) },
  ];
  const alerts = (
    <span className="cl-alerts">
      {r.late > 0 && <span className="cl-al danger"><Icon name="clock" size={14} /> {t("cl.lateN", { n: r.late })}</span>}
      {r.overdue > 0 && <span className="cl-al danger">€ {t("cl.overdueN", { n: r.overdue })}</span>}
      {r.review > 0 && <span className="cl-al warn"><Icon name="target" size={14} /> {t("cl.reviewN", { n: r.review })}</span>}
      {!r.alerts && !r.review && <span className="muted small">{t("cl.noAlerts")}</span>}
    </span>
  );
  return (
    <article className={`cl-row ${r.active ? "" : "off"} ${open ? "open" : ""}`} data-testid="cl-row" onClick={onToggle}>
      <div className="cl-who">
        <span className="cl-av">{c.cover ? <Cover src={c.cover} /> : initials}</span>
        <span style={{ minWidth: 0 }}>
          <b className="cl-name">{c.name}</b>
          <span className="muted small cl-sub">{[c.contact, c.email || c.billing?.email].filter(Boolean).join(" · ") || "—"}</span>
        </span>
        <span className="rt-chev"><Icon name="chevronDown" size={14} /></span>
      </div>
      <span className="cl-state cl-col">
        <span className={`label ${r.active ? "tone-ok" : "muted"}`}>● {r.active ? t("cl.active") : t("cl.inactive")}</span>
        <span className="muted small">{t(`cu.stage.${c.stage}` as Key)}</span>
      </span>
      {fin && (
        <span className="cl-num cl-col">
          <span className="mono">{eur(r.revenueYtd)}</span>
          <span className="muted small">
            {t("cl.lastInvoice")} {date(r.lastInvoice)}
          </span>
        </span>
      )}
      <span className="cl-col cl-alertcol">{alerts}</span>
      <span className="cl-actions" onClick={(e) => e.stopPropagation()}>
        <RowActions actions={actions} />
      </span>
      {invite && (
        <span onClick={(e) => e.stopPropagation()}>
          <InviteDialog customer={c} onClose={() => setInvite(false)} />
        </span>
      )}
      {open && (
        <div className="cl-exp" onClick={(e) => e.stopPropagation()}>
          <div className="cl-exp-grid">
            <span>
              <span className="tile-t muted">{t("cu.col.stage")}</span>
              <br />
              {r.active ? t("cl.active") : t("cl.inactive")} · {t(`cu.stage.${c.stage}` as Key)}
            </span>
            {fin && (
              <span>
                <span className="tile-t muted">{t("cl.revenue")}</span>
                <br />
                <span className="mono">{eur(r.revenueYtd)}</span> · {date(r.lastInvoice)}
              </span>
            )}
            <span>
              <span className="tile-t muted">{t("cl.lastContact")}</span>
              <br />
              <span className="mono">{date(r.lastContact)}</span>
            </span>
            <span>{alerts}</span>
          </div>
          <ExpandedActions actions={actions} />
        </div>
      )}
    </article>
  );
}
