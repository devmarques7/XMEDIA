"use client";

// KPIs da empresa para o cabeçalho e o início: carrega invoices + clientes uma vez (cache 60 s) e recalcula quando se gravam.
import { useEffect, useState } from "react";
import { INVOICE_SAVED } from "./ai/exec";
import { CUSTOMER_SAVED, customerStore } from "./customerStore";
import type { Customer } from "./customer";
import type { Invoice } from "./invoice";
import { invoiceStore } from "./invoiceStore";
import { companyKpis, type CompanyKpis } from "./kpi";

type Data = { kpi: CompanyKpis; invoices: Invoice[]; customers: Customer[] };
let cache: { at: number; p: Promise<Data> } | null = null;

function load(force = false) {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache.p;
  const p = Promise.all([invoiceStore.list(), customerStore.list().catch(() => [] as Customer[])]).then(([invoices, customers]) => ({
    invoices,
    customers,
    kpi: companyKpis(invoices, { activePlans: customers.filter((c) => c.plan.active && c.plan.price).map((c) => c.id) }),
  }));
  cache = { at: Date.now(), p };
  p.catch(() => (cache = null));
  return p;
}

/** `enabled` = o utilizador pode ver as finanças (senão não carrega nada). */
export function useCompanyKpis(enabled: boolean) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const run = (force = false) => load(force).then((x) => alive && setD(x)).catch(() => {});
    run();
    const again = () => run(true);
    window.addEventListener(INVOICE_SAVED, again);
    window.addEventListener(CUSTOMER_SAVED, again);
    return () => {
      alive = false;
      window.removeEventListener(INVOICE_SAVED, again);
      window.removeEventListener(CUSTOMER_SAVED, again);
    };
  }, [enabled]);
  return d;
}
