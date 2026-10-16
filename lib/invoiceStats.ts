// Finanças: estado de cada invoice (rascunho, enviada, por pagar, em atraso, paga), filtros rápidos e os números do
// painel (faturado, por receber, em atraso, recebido, BTW, últimos 12 meses). Puro e testável.
import { totals, type Invoice } from "./invoice";

const DAY = 86_400_000;
export const QUICK_FILTERS = ["all", "draft", "sent", "unpaid", "overdue", "paid"] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number];

/** Vencimento (AAAA-MM-DD): data de emissão + prazo de pagamento (5 dias por omissão). */
export function dueDate(inv: Pick<Invoice, "issue_date" | "payment">) {
  const d = new Date(inv.issue_date + "T12:00:00Z").getTime() + (inv.payment?.termsDays || 5) * DAY;
  return new Date(d).toISOString().slice(0, 10);
}

/** Enviada, não paga e já passou o vencimento (mesma regra do CRM). */
export const isOverdue = (inv: Pick<Invoice, "status" | "void" | "issue_date" | "payment">, today: string) => !inv.void && inv.status === "sent" && dueDate(inv) < today;

/**
 * Filtros rápidos: "sent" = já saiu (enviada ou paga); "unpaid" = emitida e por pagar (enviada); "overdue" = por pagar
 * fora do prazo. Anuladas só aparecem em "all".
 */
export function matchesFilter(inv: Invoice, f: QuickFilter, today: string) {
  if (f === "all") return true;
  if (inv.void) return false;
  if (f === "draft") return inv.status === "draft";
  if (f === "sent") return inv.status === "sent" || inv.status === "paid";
  if (f === "unpaid") return inv.status === "sent";
  if (f === "overdue") return isOverdue(inv, today);
  return inv.status === "paid";
}

export type FinanceDash = {
  invoiced: number; // emitidas este ano (sem rascunhos/anuladas)
  received: number; // pagas este ano
  outstanding: { n: number; total: number }; // por pagar (todas)
  overdue: { n: number; total: number };
  drafts: number;
  btwQuarter: number;
  months: { key: string; total: number; paid: number }[]; // últimos 12 meses, mais antigo primeiro
  counts: Record<QuickFilter, number>;
};

/** Números do painel (só EUR entram nos montantes; as contagens incluem tudo). */
export function financeDash(list: Invoice[], today: string): FinanceDash {
  const year = today.slice(0, 4);
  const q = Math.floor((+today.slice(5, 7) - 1) / 3);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(+year, +today.slice(5, 7) - 1 - (11 - i), 1));
    return { key: d.toISOString().slice(0, 7), total: 0, paid: 0 };
  });
  const out: FinanceDash = { invoiced: 0, received: 0, outstanding: { n: 0, total: 0 }, overdue: { n: 0, total: 0 }, drafts: 0, btwQuarter: 0, months, counts: { all: 0, draft: 0, sent: 0, unpaid: 0, overdue: 0, paid: 0 } };
  for (const inv of list) {
    for (const f of QUICK_FILTERS) if (matchesFilter(inv, f, today)) out.counts[f]++;
    if (inv.void) continue;
    if (inv.status === "draft") {
      out.drafts++;
      continue;
    }
    if (inv.currency !== "EUR") continue;
    const t = totals(inv);
    if (inv.issue_date.startsWith(year)) out.invoiced += t.total;
    if (inv.status === "paid" && inv.issue_date.startsWith(year)) out.received += t.total;
    if (inv.status === "sent") {
      out.outstanding.n++;
      out.outstanding.total += t.total;
      if (isOverdue(inv, today)) {
        out.overdue.n++;
        out.overdue.total += t.total;
      }
    }
    if (inv.issue_date.startsWith(year) && Math.floor((+inv.issue_date.slice(5, 7) - 1) / 3) === q) out.btwQuarter += t.btwAmount;
    const m = months.find((x) => x.key === inv.issue_date.slice(0, 7));
    if (m) {
      m.total += t.total;
      if (inv.status === "paid") m.paid += t.total;
    }
  }
  return out;
}
