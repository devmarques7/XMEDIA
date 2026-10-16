// Validação e aplicação das ferramentas de escrita sobre uma invoice (funções puras, testadas).
import { emptyInvoice, money, totals, type BtwSetting, type Invoice, type InvoiceItem } from "../invoice";

type Json = Record<string, unknown>;
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export class ToolInputError extends Error {}

function str(v: unknown, field: string) {
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw new ToolInputError(`"${field}" deve ser texto`);
  return v;
}

function btw(v: unknown): BtwSetting | undefined {
  if (v === undefined) return undefined;
  if (v === "auto" || v === 0 || v === 9 || v === 21) return v;
  if (v === "0" || v === "9" || v === "21") return Number(v) as BtwSetting;
  throw new ToolInputError(`"btw" deve ser "auto", 0, 9 ou 21`);
}

export function parseItems(v: unknown): InvoiceItem[] {
  if (!Array.isArray(v) || v.length === 0) throw new ToolInputError(`"items" deve ser uma lista com pelo menos um item`);
  return v.map((r, i) => {
    const o = (r ?? {}) as Json;
    const description = String(o.description ?? "").trim();
    const qty = Number(o.qty);
    const rate = Number(o.rate);
    if (!description) throw new ToolInputError(`item ${i + 1}: falta "description"`);
    if (!isFinite(qty) || !isFinite(rate)) throw new ToolInputError(`item ${i + 1}: "qty" e "rate" devem ser números`);
    return { id: uid(), description, qty, rate };
  });
}

function clientPatch(v: unknown, cur: Invoice["client"]): Invoice["client"] {
  if (v === undefined) return cur;
  if (typeof v !== "object" || v === null) throw new ToolInputError(`"client" deve ser um objeto`);
  const c = v as Json;
  return {
    name: str(c.name, "client.name") ?? cur.name,
    address: str(c.address, "client.address") ?? cur.address,
    country: (str(c.country, "client.country") ?? cur.country).toUpperCase(),
    vat: str(c.vat, "client.vat") ?? cur.vat,
    email: str(c.email, "client.email") ?? cur.email,
  };
}

export function applyUpdate(inv: Invoice, input: Json): Invoice {
  const status = str(input.status, "status");
  if (status && !["draft", "sent", "paid"].includes(status)) throw new ToolInputError(`"status" inválido`);
  const currency = str(input.currency, "currency");
  if (currency && currency !== "EUR" && currency !== "GBP") throw new ToolInputError(`"currency" deve ser EUR ou GBP`);
  const date = str(input.issue_date, "issue_date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ToolInputError(`"issue_date" deve ser AAAA-MM-DD`);
  const qr = str(input.payment_qr, "payment_qr");
  if (qr && !["epc", "link", "none"].includes(qr)) throw new ToolInputError(`"payment_qr" inválido`);
  const terms = input.terms_days === undefined ? undefined : Number(input.terms_days);
  if (terms !== undefined && (!isFinite(terms) || terms < 0)) throw new ToolInputError(`"terms_days" inválido`);
  return {
    ...inv,
    number: str(input.number, "number") ?? inv.number,
    issue_date: date ?? inv.issue_date,
    status: (status as Invoice["status"]) ?? inv.status,
    currency: (currency as Invoice["currency"]) ?? inv.currency,
    btw: btw(input.btw) ?? inv.btw,
    note: str(input.note, "note") ?? inv.note,
    client: clientPatch(input.client, inv.client),
    payment: {
      qr: (qr as Invoice["payment"]["qr"]) ?? inv.payment.qr,
      link: str(input.payment_link, "payment_link") ?? inv.payment.link,
      termsDays: terms ?? inv.payment.termsDays,
    },
  };
}

export function applyItems(inv: Invoice, input: Json): Invoice {
  return { ...inv, items: parseItems(input.items) };
}

export function buildNew(input: Json, number: string, today: string): Invoice {
  const base = emptyInvoice(number, str(input.issue_date, "issue_date") ?? today);
  return applyUpdate({ ...base, items: parseItems(input.items) }, { id: base.id, client: input.client, note: input.note, btw: input.btw, currency: input.currency });
}

/** Resumo legível de uma alteração para o cartão de confirmação. */
export function describeChange(before: Invoice | null, after: Invoice) {
  const a = totals(after);
  const lines: string[] = [];
  if (!before) {
    lines.push(`${after.number} · ${after.client.name || "—"}`);
    after.items.forEach((i) => lines.push(`+ ${i.description} — ${i.qty} × ${money(i.rate, after.currency)}`));
  } else {
    const b = totals(before);
    for (const k of ["number", "issue_date", "status", "currency", "note"] as const)
      if (before[k] !== after[k]) lines.push(`${k}: ${String(before[k]).slice(0, 60) || "—"} → ${String(after[k]).slice(0, 60) || "—"}`);
    if (JSON.stringify(before.client) !== JSON.stringify(after.client)) lines.push(`cliente: ${after.client.name} (${after.client.country}${after.client.vat ? `, VAT ${after.client.vat}` : ""})`);
    if (before.btw !== after.btw) lines.push(`BTW: ${before.btw} → ${after.btw}`);
    if (JSON.stringify(before.payment) !== JSON.stringify(after.payment)) lines.push(`pagamento: QR ${after.payment.qr}${after.payment.link ? ` (${after.payment.link})` : ""}, ${after.payment.termsDays} dias`);
    const sig = (i: InvoiceItem) => `${i.description}|${i.qty}|${i.rate}`;
    if (before.items.map(sig).join() !== after.items.map(sig).join()) {
      after.items.forEach((i) => lines.push(`• ${i.description} — ${i.qty} × ${money(i.rate, after.currency)}`));
    }
    if (b.total !== a.total) lines.push(`total: ${money(b.total, before.currency)} → ${money(a.total, after.currency)}`);
  }
  lines.push(`subtotal ${money(a.subtotal, after.currency)} · ${a.btw.label || "sem BTW"} ${money(a.btwAmount, after.currency)} · total ${money(a.total, after.currency)}`);
  return lines;
}
