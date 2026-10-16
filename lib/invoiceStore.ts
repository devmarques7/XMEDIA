"use client";

// Gravação das invoices: Supabase (tabela invoices) ou, em modo local, este navegador.
import { BUNDLED_CUSTOMERS, BUNDLED_INVOICES, matchCustomer, mergeBundledCustomer, needsInvoiceBundle } from "./bundled";
import { customerStore } from "./customerStore";
import { normalizeInvoice, totals, type Invoice } from "./invoice";
import { supabase, supabaseEnabled } from "./supabase/client";

type InvoiceStore = {
  list(): Promise<Invoice[]>;
  get(id: string): Promise<Invoice | null>;
  save(inv: Invoice): Promise<Invoice>;
  remove(id: string): Promise<void>;
};

const row = (inv: Invoice) => {
  const t = totals(inv);
  return {
    id: inv.id,
    number: inv.number,
    issue_date: inv.issue_date,
    status: inv.status,
    currency: inv.currency,
    subtotal: t.subtotal,
    btw_amount: t.btwAmount,
    total: t.total,
    client_name: inv.client.name,
    data: inv,
  };
};
const fromRow = (r: { id: string; data: Invoice; created_at?: string; updated_at?: string }) =>
  normalizeInvoice({ ...r.data, id: r.id, created_at: r.created_at, updated_at: r.updated_at });

const remote: InvoiceStore = {
  async list() {
    const { data, error } = await supabase().from("invoices").select("id, data, created_at, updated_at").order("issue_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },
  async get(id) {
    const { data, error } = await supabase().from("invoices").select("id, data, created_at, updated_at").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  },
  async save(inv) {
    const { data, error } = await supabase().from("invoices").upsert(row(inv)).select("id, data, created_at, updated_at").single();
    if (error) throw error;
    return fromRow(data);
  },
  async remove(id) {
    const { error } = await supabase().from("invoices").delete().eq("id", id);
    if (error) throw error;
  },
};

const LS = "xmedia:invoices";
const read = (): Invoice[] => {
  try {
    return JSON.parse(localStorage.getItem(LS) || "[]");
  } catch {
    return [];
  }
};
const write = (v: Invoice[]) => localStorage.setItem(LS, JSON.stringify(v));

const local: InvoiceStore = {
  async list() {
    return read()
      .map((i) => normalizeInvoice(i))
      .sort((a, b) => b.issue_date.localeCompare(a.issue_date) || b.number.localeCompare(a.number));
  },
  async get(id) {
    const i = read().find((x) => x.id === id);
    return i ? normalizeInvoice(i) : null;
  },
  async save(inv) {
    const all = read();
    const now = new Date().toISOString();
    const prev = all.find((x) => x.id === inv.id);
    if (all.some((x) => x.id !== inv.id && x.number === inv.number)) throw new Error(`Já existe uma invoice com o número ${inv.number}.`);
    const saved = { ...inv, created_at: prev?.created_at ?? now, updated_at: now };
    write(prev ? all.map((x) => (x.id === inv.id ? saved : x)) : [...all, saved]);
    return saved;
  },
  async remove(id) {
    write(read().filter((x) => x.id !== id));
  },
};

export const invoiceStore: InvoiceStore = supabaseEnabled ? remote : local;

/** Garante as invoices incluídas na app (uma vez por sessão do browser). Devolve os números criados/atualizados. */
export async function ensureBundledInvoices(): Promise<string[]> {
  const KEY = "xmedia:bundledInvoices";
  const ver = `${BUNDLED_INVOICES.length}:${BUNDLED_INVOICES.reduce((n, b) => n + (b.bundle_version ?? 0), 0)}:${BUNDLED_CUSTOMERS.length}`;
  try {
    if (sessionStorage.getItem(KEY) === ver) return [];
  } catch {}
  let written: string[] = [];
  if (supabaseEnabled) {
    const r = await fetch("/api/invoices/bootstrap", { method: "POST" });
    if (r.ok) written = ((await r.json()) as { written: string[] }).written;
  } else {
    const ids = new Map<string, string>();
    const custs = await customerStore.list();
    for (const b of BUNDLED_CUSTOMERS) {
      const cur = matchCustomer(custs, b);
      ids.set(b.id, cur?.id ?? b.id);
      const next = mergeBundledCustomer(cur, b);
      if (next) await customerStore.save(next);
    }
    const all = await local.list();
    for (const b of BUNDLED_INVOICES) {
      const saved = all.find((x) => x.id === b.id) ?? all.find((x) => x.number.replace(/\s+/g, "") === b.number.replace(/\s+/g, ""));
      if (needsInvoiceBundle(saved, b)) {
        const customer_id = b.customer_id ? (ids.get(b.customer_id) ?? b.customer_id) : null;
        await local.save(normalizeInvoice({ ...b, id: saved?.id ?? b.id, status: saved?.status ?? b.status, customer_id }));
        written.push(b.number);
      }
    }
  }
  try {
    sessionStorage.setItem(KEY, ver);
  } catch {}
  return written;
}
