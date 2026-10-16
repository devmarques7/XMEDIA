// Visão CRM dos clientes: ativo/inativo, faturação, última invoice, último contacto e alertas (conteúdos
// atrasados, à espera do cliente, invoices por pagar fora de prazo). Funções puras (crm.test.ts).
import { deadline, type ContentPost, type Customer, type ProcessSettings } from "./customer";
import { totals, type Invoice } from "./invoice";
import { clientKey } from "./kpi";

export type CrmRow = {
  c: Customer;
  active: boolean;
  revenueYtd: number;
  revenueAll: number;
  lastInvoice: string; // AAAA-MM-DD ou ""
  lastContact: string; // ISO ou ""
  late: number;
  review: number;
  overdue: number;
  overdueAmount: number;
  inProduction: number;
  alerts: number;
};

const DAY = 86_400_000;
const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);

/** Invoices de um cliente: ligadas pelo customer_id, ou pelo nome da empresa de faturação / nome do cliente. */
export function invoicesOf(c: Customer, all: Invoice[]) {
  const names = [c.billing?.company, c.name].filter(Boolean).map((n) => key(n!));
  return all.filter((i) => i.customer_id === c.id || (!i.customer_id && names.includes(clientKey({ ...i, customer_id: null }))));
}

export function crmRows(customers: Customer[], posts: ContentPost[], invoices: Invoice[], proc: ProcessSettings, today = new Date()): CrmRow[] {
  const year = String(today.getFullYear());
  const t0 = today.getTime();
  return customers.map((c) => {
    const inv = invoicesOf(c, invoices).filter((i) => !i.void && i.status !== "draft");
    const mine = posts.filter((p) => p.customer_id === c.id);
    const lastInvoice = inv.map((i) => i.issue_date).sort().at(-1) ?? "";
    const overdueList = inv.filter((i) => i.status === "sent" && new Date(i.issue_date + "T12:00:00").getTime() + (i.payment.termsDays || 5) * DAY < t0);
    const late = mine.filter((p) => deadline(p, proc, today).state === "late").length;
    const review = mine.filter((p) => p.status === "review").length;
    const inProduction = mine.filter((p) => p.status !== "published").length;
    const working = c.stage !== "complete" && c.stage !== "not_started";
    const recentInvoice = !!lastInvoice && t0 - new Date(lastInvoice + "T12:00:00").getTime() < 90 * DAY;
    const contacts = [
      c.updated_at,
      c.portal.last_login_at,
      ...mine.flatMap((p) => [p.updated_at, ...p.feedback.map((f) => f.at)]),
      lastInvoice ? lastInvoice + "T12:00:00" : "",
    ].filter(Boolean) as string[];
    return {
      c,
      active: working || c.plan.active || recentInvoice || inProduction > 0,
      revenueYtd: Math.round(inv.filter((i) => i.issue_date.startsWith(year)).reduce((s, i) => s + totals(i).subtotal, 0) * 100) / 100,
      revenueAll: Math.round(inv.reduce((s, i) => s + totals(i).subtotal, 0) * 100) / 100,
      lastInvoice,
      lastContact: contacts.sort().at(-1) ?? "",
      late,
      review,
      overdue: overdueList.length,
      overdueAmount: Math.round(overdueList.reduce((s, i) => s + totals(i).total, 0) * 100) / 100,
      inProduction,
      alerts: late + overdueList.length,
    };
  });
}

/** Link para mensagem rápida: WhatsApp (se houver telefone) ou email. */
export function messageLinks(c: Pick<Customer, "email" | "phone" | "name" | "contact" | "billing">, text = "") {
  const phone = (c.phone || "").replace(/[^\d]/g, "");
  const email = c.email || c.billing?.email || "";
  return {
    whatsapp: phone.length >= 8 ? `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "",
    email: email ? `mailto:${email}${text ? `?body=${encodeURIComponent(text)}` : ""}` : "",
  };
}
