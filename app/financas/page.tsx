"use client";

import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { useAccess } from "@/lib/access";
import { can } from "@/lib/roles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ExpandedActions, RowActions, useRowExpand, type RowAction } from "@/components/RowActions";
import { DropOverlay, InvoiceJsonBox, useWindowDrop } from "@/components/InvoiceJson";
import { AppShell, Toast, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { emptyInvoice, INVOICE_CATEGORIES, money, nextNumber, totals, type Invoice, type InvoiceCategory, type InvoiceStatus } from "@/lib/invoice";
import { downloadInvoice } from "@/lib/invoicePdf";
import { INVOICE_SAVED } from "@/lib/ai/exec";
import { invoiceStore, ensureBundledInvoices } from "@/lib/invoiceStore";
import { isoDay, pad } from "@/lib/util";
import { QUICK_FILTERS, dueDate, financeDash, isOverdue, matchesFilter, type QuickFilter } from "@/lib/invoiceStats";
import { MonthBars } from "@/components/finance/MonthBars";

const STATUS_TONE: Record<InvoiceStatus, string> = { draft: "muted", sent: "tone-warn", paid: "tone-ok" };
const FIRST_NUMBER = 50; // a última invoice emitida fora da app foi a #0049

export default function FinancePage() {
  const { t, locale } = useT();
  const access = useAccess();
  const router = useRouter();
  const [toast, setToast] = useToast();
  const [list, setList] = useState<Invoice[] | null>(null);
  const [busy, setBusy] = useState("");
  const [jsonOpen, setJsonOpen] = useState(false);
  const { isOpen, onRow } = useRowExpand();
  const [cat, setCat] = useState<InvoiceCategory | "all" | "none">("all");
  const [yr, setYr] = useState<string>("all");
  // filtro rápido (enviadas, por pagar, em atraso…); ?f= abre já filtrado
  const [qf, setQf] = useState<QuickFilter>(() => {
    const f = typeof location !== "undefined" ? new URLSearchParams(location.search).get("f") : null;
    return (QUICK_FILTERS as readonly string[]).includes(f ?? "") ? (f as QuickFilter) : "all";
  });
  const [jsonText, setJsonText] = useState("");
  const openJson = useCallback((text = "") => {
    setJsonText(text);
    setJsonOpen(true);
    requestAnimationFrame(() => document.querySelector("[data-jsonbox]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, []);
  const dropping = useWindowDrop(openJson);
  const year = isoDay().slice(0, 4);
  const q = Math.floor(new Date().getMonth() / 3) + 1;

  const load = () => invoiceStore.list().then(setList).catch((e) => setToast(e.message));
  useEffect(() => {
    // invoices incluídas na app (ex.: Q4 - #0047 re-emitida) são criadas/atualizadas aqui, sem SQL
    ensureBundledInvoices()
      .then((w) => {
        if (w.length) setToast(`${w.length > 3 ? t("fin.registered", { n: w.length }) : w.join(", ")}`);
      })
      .catch(() => {})
      .finally(load);
    window.addEventListener(INVOICE_SAVED, load);
    return () => window.removeEventListener(INVOICE_SAVED, load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const all = useMemo(() => (list ?? []).map((inv) => ({ inv, t: totals(inv) })), [list]);
  const years = useMemo(() => [...new Set(all.map(({ inv }) => inv.issue_date.slice(0, 4)))].sort().reverse(), [all]);
  const inYear = useMemo(() => all.filter(({ inv }) => yr === "all" || inv.issue_date.startsWith(yr)), [all, yr]);
  // totais por categoria (sem anuladas nem rascunhos), para os filtros
  const cats = useMemo(() => {
    const m = new Map<string, { n: number; total: number }>();
    for (const { inv, t: tt } of inYear) {
      const k = inv.category ?? "none";
      const e = m.get(k) ?? { n: 0, total: 0 };
      e.n++;
      if (!inv.void && inv.status !== "draft") e.total += tt.total;
      m.set(k, e);
    }
    return m;
  }, [inYear]);
  const today = isoDay();
  const dash = useMemo(() => financeDash(list ?? [], today), [list, today]);
  const rows = useMemo(() => inYear.filter(({ inv }) => (cat === "all" || (inv.category ?? "none") === cat) && matchesFilter(inv, qf, today)), [inYear, cat, qf, today]);
  const pickQf = (f: QuickFilter) => {
    setQf(f);
    try {
      const u = new URL(location.href);
      if (f === "all") u.searchParams.delete("f");
      else u.searchParams.set("f", f);
      history.replaceState(null, "", u);
    } catch {}
  };

  async function create(seed?: Partial<Invoice>) {
    const today = isoDay();
    const number = nextNumber((list ?? []).map((i) => i.number), today, FIRST_NUMBER);
    const inv = { ...emptyInvoice(number, today), ...seed };
    const saved = await invoiceStore.save(inv);
    router.push(`/financas/${saved.id}`);
  }

  async function duplicate(inv: Invoice) {
    const today = isoDay();
    const copy = { ...inv, id: crypto.randomUUID(), status: "draft" as const, issue_date: today, number: nextNumber((list ?? []).map((i) => i.number), today, FIRST_NUMBER) };
    const saved = await invoiceStore.save(copy);
    router.push(`/financas/${saved.id}`);
  }

  async function setStatus(inv: Invoice, status: InvoiceStatus) {
    await invoiceStore.save({ ...inv, status }).catch((e) => setToast(e.message));
    load();
  }

  async function remove(inv: Invoice) {
    if (!confirm(t("fin.deleteConfirm", { number: inv.number }))) return;
    await invoiceStore.remove(inv.id);
    load();
  }

  async function pdf(inv: Invoice) {
    setBusy(inv.id);
    try {
      await downloadInvoice(inv);
    } catch (e) {
      setToast((e as Error).message);
    }
    setBusy("");
  }

  const eur = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(v);

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("fin.sub")}</span>
          <h1 className="h1">{t("nav.finance")}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => (jsonOpen ? setJsonOpen(false) : openJson())} aria-expanded={jsonOpen}>
            {"{ }"} {t("fin.import")}
          </button>
          <button className="btn accent" onClick={() => create()}>
            + {t("fin.new")}
          </button>
        </div>
      </section>

      {jsonOpen && (
        <div style={{ marginBottom: 14 }}>
          <InvoiceJsonBox
            initial={jsonText}
            actions={[{ label: `+ ${t("fin.jsonCreate")}`, mode: "create", primary: true }]}
            onApply={({ items, patch }) => create({ ...patch, items }).catch((e) => setToast(e.message))}
          />
        </div>
      )}

      {access && !can(access, "finance.view") && <p className="note"><Icon name="lock" size={14} /> {t("rl.draftOnly")}</p>}
      {can(access, "finance.view") && list && list.length > 0 && (
        <>
          <div className="fin-dash" data-testid="fin-dash">
            <div className="fin-tile">
              <span className="label muted">{t("fin.invoiced", { year })}</span>
              <span className="num">{eur(dash.invoiced)}</span>
            </div>
            <button className="fin-tile" onClick={() => pickQf(qf === "unpaid" ? "all" : "unpaid")} aria-pressed={qf === "unpaid"}>
              <span className="label muted">{t("fin.outstanding")}</span>
              <span className="num">{eur(dash.outstanding.total)}</span>
              <span className="muted small">{t("fin.d.n", { n: dash.outstanding.n })}</span>
            </button>
            <button className={`fin-tile ${dash.overdue.n ? "warn" : ""}`} onClick={() => pickQf(qf === "overdue" ? "all" : "overdue")} aria-pressed={qf === "overdue"}>
              <span className="label muted">{t("fin.d.overdue")}</span>
              <span className="num">{eur(dash.overdue.total)}</span>
              <span className="muted small">{t("fin.d.n", { n: dash.overdue.n })}</span>
            </button>
            <div className="fin-tile">
              <span className="label muted">{t("fin.paid")} {year}</span>
              <span className="num">{eur(dash.received)}</span>
            </div>
            <div className="fin-tile">
              <span className="label muted">{t("fin.btwQuarter", { q })}</span>
              <span className="num">{eur(dash.btwQuarter)}</span>
            </div>
          </div>
          <div className="fin-chart">
            <span className="label muted">{t("fin.d.months")}</span>
            <MonthBars months={dash.months} locale={locale} money={(v) => eur(v)} label={t("fin.d.months")} paidLabel={t("fin.paid")} />
          </div>
        </>
      )}

      {all.length > 0 && (
        <div className="fin-quick" role="group" aria-label="Status" data-testid="fin-quick">
          {QUICK_FILTERS.map((f) => (
            <button key={f} className={`chip${qf === f ? " on" : ""}`} onClick={() => pickQf(f)} aria-pressed={qf === f} data-testid={`fin-q-${f}`}>
              {t(`fin.q.${f}` as "fin.q.all")} <span className="muted">{dash.counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {all.length > 0 && (
        <div className="row fin-filters" style={{ marginBottom: 12 }}>
          {(["all", ...INVOICE_CATEGORIES, ...(cats.has("none") ? ["none"] : [])] as const).map((k) => {
            const e = k === "all" ? { n: inYear.length } : cats.get(k);
            if (k !== "all" && !e) return null;
            return (
              <button key={k} className={`chip${cat === k ? " on" : ""}`} onClick={() => setCat(k as typeof cat)} aria-pressed={cat === k}>
                {t(`fin.cat.${k}` as "fin.cat.all")} <span className="muted">{e?.n}</span>
                {k !== "all" && can(access, "finance.view") && <span className="mono small"> · {eur(cats.get(k)!.total)}</span>}
              </button>
            );
          })}
          {years.length > 1 && (
            <Select className="select" style={{ width: "auto", marginLeft: "auto" }} value={yr} onChange={(e) => setYr(e.target.value)} aria-label="Year">
              <option value="all">{t("fin.allYears")}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      <section className="w">
        <div className="w-head">
          <span className="label">
            <b>{pad(rows.length)}</b>
            Invoices
          </span>
          {can(access, "finance.view") && (
            <span className="muted small">
              {t("fin.paid")} {year} · {eur(dash.received)}
            </span>
          )}
        </div>
        {list?.length === 0 && <p className="muted">{t("fin.empty")}</p>}
        {!!list?.length && (
          <div className="tablewrap">
            <table className="table rt">
              <thead>
                <tr>
                  <th>{t("fin.col.client")}</th>
                  <th>{t("fin.col.category")}</th>
                  <th>{t("fin.col.date")}</th>
                  <th className="r">{t("fin.col.total")}</th>
                  <th>{t("fin.col.status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ inv, t: tt }) => {
                  const fin = can(access, "finance.view");
                  const actions: RowAction[] = [
                    { key: "open", label: t("ra.edit"), icon: "edit", href: `/financas/${inv.id}` },
                    { key: "pdf", label: busy === inv.id ? "…" : t("fin.download"), icon: "download", onClick: () => pdf(inv) },
                    { key: "send", label: t("fin.send"), icon: "send", href: `/financas/${inv.id}?send=1`, allowed: fin && !inv.void },
                    { key: "original", label: t("ra.original"), icon: "page", href: inv.attachment ? `/api/invoices/file/${inv.attachment}` : undefined, external: true, allowed: !!inv.attachment },
                    { key: "duplicate", label: t("ra.duplicate"), icon: "copy", onClick: () => duplicate(inv), allowed: fin || can(access, "invoices.create") },
                    { key: "delete", label: t("ra.delete"), icon: "trash", danger: true, onClick: () => remove(inv), allowed: fin },
                  ];
                  const open = isOpen(inv.id);
                  return (
                    <Fragment key={inv.id}>
                      <tr className={`${inv.void ? "fin-void" : ""} ${open ? "open has-exp" : ""}`} style={{ cursor: "pointer" }} onClick={() => onRow(inv.id, () => router.push(`/financas/${inv.id}`))}>
                        <td className="rt-main">
                          <span style={{ minWidth: 0 }}>
                            <span className="mono small muted" style={{ display: "block" }}>
                              {inv.number}
                            </span>
                            <span className="cell-title">{inv.client.name || "—"}</span>
                            {inv.void && (
                              <span className="chip small" title={t("fin.voidHint")} style={{ marginLeft: 6 }}>
                                {t("fin.void")}
                              </span>
                            )}
                          </span>
                          <span className="rt-chev"><Icon name="chevronDown" size={14} /></span>
                        </td>
                        <td className="small muted" data-label={t("fin.col.category")}>
                          {inv.category ? t(`fin.cat.${inv.category}` as "fin.cat.all") : "—"}
                        </td>
                        <td className="mono small" data-label={t("fin.col.date")}>
                          {new Date(inv.issue_date + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td className="r mono" data-label={t("fin.col.total")}>
                          {money(tt.total, inv.currency)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()} data-label={t("fin.col.status")}>
                          <Select className={`select statussel ${STATUS_TONE[inv.status]}`} value={inv.status} onChange={(e) => setStatus(inv, e.target.value as InvoiceStatus)} aria-label={t("fin.col.status")}>
                            {(["draft", "sent", "paid"] as InvoiceStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {t(`fin.status.${s}` as "fin.status.draft")}
                              </option>
                            ))}
                          </Select>
                          {isOverdue(inv, today) && (
                            <span className="chip small" title={dueDate(inv)} style={{ marginLeft: 6 }} data-testid="fin-overdue">
                              ! {t("fin.d.overdue")}
                            </span>
                          )}
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
        )}
      </section>
      <DropOverlay show={dropping} label={t("fin.dropCreate")} />
      <Toast msg={toast} />
    </AppShell>
  );
}
