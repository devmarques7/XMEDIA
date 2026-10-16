"use client";

// Faturação do cliente: dados que vão para as invoices + invoices deste cliente (Finanças).
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccess } from "@/lib/access";
import type { Billing, Customer } from "@/lib/customer";
import { useT } from "@/lib/i18n";
import { money, totals, type Invoice } from "@/lib/invoice";
import { invoiceStore } from "@/lib/invoiceStore";
import { can } from "@/lib/roles";

const EMPTY: Billing = { company: "", contact: "", address: "", country: "NL", vat: "", kvk: "", email: "" };
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function BillingCard({ c, onChange }: { c: Customer; onChange: (b: Billing) => void }) {
  const { t, locale } = useT();
  const access = useAccess();
  const fin = can(access, "finance.view");
  const [list, setList] = useState<Invoice[]>([]);
  const b = { ...EMPTY, ...(c.billing ?? {}) };
  useEffect(() => {
    if (!fin) return;
    const company = key(c.billing?.company ?? "");
    invoiceStore
      .list()
      .then((all) => setList(all.filter((i) => i.customer_id === c.id || (!!company && key(i.client.name).startsWith(company)))))
      .catch(() => {});
  }, [fin, c.id, c.billing?.company]);
  const set = (k: keyof Billing, v: string) => onChange({ ...b, [k]: v });
  const paid = list.filter((i) => !i.void && i.status === "paid").reduce((s, i) => s + totals(i).total, 0);
  const open = list.filter((i) => !i.void && i.status === "sent").reduce((s, i) => s + totals(i).total, 0);
  const eur = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(v);

  return (
    <details className="stack" open={!!c.billing}>
      <summary className="label" style={{ cursor: "pointer" }}>
        {t("cu.billing")} {list.length > 0 && <span className="muted">· {list.length} invoices</span>}
      </summary>
      <div className="stack" style={{ gap: 8, marginTop: 8 }}>
        <label className="field">
          <span>{t("cu.billCompany")}</span>
          <input className="input" value={b.company} onChange={(e) => set("company", e.target.value)} />
        </label>
        <label className="field">
          <span>{t("cu.billAddress")}</span>
          <textarea className="textarea small" rows={3} value={b.address} onChange={(e) => set("address", e.target.value)} />
        </label>
        <div className="grid4" style={{ gridTemplateColumns: "1fr 2fr 2fr" }}>
          <label className="field">
            <span>{t("cu.billCountry")}</span>
            <input className="input" value={b.country} maxLength={2} onChange={(e) => set("country", e.target.value.toUpperCase())} />
          </label>
          <label className="field">
            <span>VAT / BTW</span>
            <input className="input" value={b.vat} onChange={(e) => set("vat", e.target.value)} />
          </label>
          <label className="field">
            <span>KVK</span>
            <input className="input" value={b.kvk} onChange={(e) => set("kvk", e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>{t("cu.billEmail")}</span>
          <input className="input" type="email" value={b.email} onChange={(e) => set("email", e.target.value)} />
        </label>
        {fin && list.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="small">
              <span className="tone-ok">{eur(paid)}</span>
              {open > 0 && <span className="tone-warn"> · {eur(open)} {t("fin.status.sent").toLowerCase()}</span>}
            </div>
            {list.map((i) => (
              <Link key={i.id} href={`/financas/${i.id}`} className={`row between small${i.void ? " muted" : ""}`} style={{ gap: 8 }}>
                <span className="mono">{i.number}</span>
                <span className="muted">{new Date(i.issue_date + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short" })}</span>
                <span className="mono" style={i.void ? { textDecoration: "line-through" } : undefined}>
                  {money(totals(i).total, i.currency)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
