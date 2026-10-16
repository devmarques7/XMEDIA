// KPIs da empresa a partir das invoices (faturação sem BTW, só EUR, sem rascunhos nem anuladas) e dos clientes.
// Funções puras (testadas em kpi.test.ts).
import { totals, type Invoice } from "./invoice";

export type CompanyKpis = {
  year: string;
  /** Faturação do ano até hoje (excl. BTW). */
  ytd: number;
  /** Mesmo período do ano anterior (para comparação), 0 se não houver dados. */
  ytdPrev: number;
  /** Crescimento da faturação: últimos 90 dias vs. 90 dias anteriores (%). null sem base. */
  revenueGrowth: number | null;
  /** Crescimento da empresa: taxa de crescimento mensal composta da faturação (últimos 6 meses fechados, %). */
  cmgr: number | null;
  /** Valor médio por invoice no ano (excl. BTW). */
  avgInvoice: number;
  /** Valor médio por cliente no ano (excl. BTW). */
  avgClient: number;
  /** Clientes com faturação nos últimos 90 dias. */
  activeClients: number;
  /** Clientes com faturação no ano. */
  clientsYear: number;
  /** Novos clientes (1.ª invoice) no mês corrente e no anterior. */
  newThisMonth: number;
  newLastMonth: number;
  /** Clientes perdidos: faturaram entre 90 e 180 dias atrás e não voltaram (nem têm plano ativo). */
  lost: number;
  /** Taxa de perda (%) = perdidos / clientes ativos no período anterior. */
  churn: number | null;
  /** Em aberto (enviadas, incl. BTW). */
  outstanding: number;
  /** Faturação dos últimos 12 meses, mês a mês (excl. BTW). */
  months: { m: string; total: number }[];
};

const DAY = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
export const clientKey = (i: Pick<Invoice, "customer_id" | "client">) => i.customer_id || key(i.client.name.split(" — ")[0]) || "?";
const pct = (now: number, prev: number) => (prev > 0 ? round1(((now - prev) / prev) * 100) : null);
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function companyKpis(invoices: Invoice[], opts: { today?: Date; activePlans?: string[] } = {}): CompanyKpis {
  const today = opts.today ?? new Date();
  const t0 = today.getTime();
  const at = (iso: string) => new Date(iso + "T12:00:00").getTime();
  const valid = invoices
    .filter((i) => !i.void && i.status !== "draft" && i.currency === "EUR")
    .map((i) => ({ i, k: clientKey(i), t: at(i.issue_date), net: totals(i).subtotal, gross: totals(i).total }));
  const year = String(today.getFullYear());
  const sum = (xs: typeof valid) => xs.reduce((s, x) => s + x.net, 0);
  const inRange = (a: number, b: number) => valid.filter((x) => x.t > a && x.t <= b);

  const ytdRows = valid.filter((x) => x.i.issue_date.startsWith(year) && x.t <= t0);
  const prevYearStart = new Date(today.getFullYear() - 1, 0, 1).getTime();
  const prevYearSameDay = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate(), 12).getTime();
  const ytdPrev = sum(valid.filter((x) => x.t >= prevYearStart && x.t <= prevYearSameDay));

  // meses (últimos 12, incluindo o corrente)
  const months: { m: string; total: number }[] = [];
  for (let n = 11; n >= 0; n--) {
    const m = ym(new Date(today.getFullYear(), today.getMonth() - n, 1));
    months.push({ m, total: Math.round(sum(valid.filter((x) => x.i.issue_date.startsWith(m))) * 100) / 100 });
  }
  // CMGR dos últimos 6 meses fechados: primeiro mês com faturação → último mês fechado
  const closed = months.slice(-7, -1);
  const first = closed.findIndex((x) => x.total > 0);
  const last = closed[closed.length - 1];
  const cmgr = first >= 0 && last.total > 0 && closed.length - 1 - first >= 2 ? round1((Math.pow(last.total / closed[first].total, 1 / (closed.length - 1 - first)) - 1) * 100) : null;

  // clientes
  const firstSeen = new Map<string, number>();
  for (const x of valid) firstSeen.set(x.k, Math.min(firstSeen.get(x.k) ?? Infinity, x.t));
  const keysIn = (rows: typeof valid) => new Set(rows.map((x) => x.k));
  const active = keysIn(inRange(t0 - 90 * DAY, t0));
  const before = keysIn(inRange(t0 - 180 * DAY, t0 - 90 * DAY));
  const plans = new Set(opts.activePlans ?? []);
  const lost = [...before].filter((k) => !active.has(k) && !plans.has(k)).length;
  const thisMonth = ym(today);
  const lastMonth = ym(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const firstMonth = (k: string) => ym(new Date(firstSeen.get(k)!));
  const clients = [...firstSeen.keys()];
  const yearClients = keysIn(ytdRows);

  const r90 = sum(inRange(t0 - 90 * DAY, t0));
  const r180 = sum(inRange(t0 - 180 * DAY, t0 - 90 * DAY));
  const ytd = sum(ytdRows);
  return {
    year,
    ytd: Math.round(ytd * 100) / 100,
    ytdPrev: Math.round(ytdPrev * 100) / 100,
    revenueGrowth: pct(r90, r180),
    cmgr,
    avgInvoice: ytdRows.length ? Math.round((ytd / ytdRows.length) * 100) / 100 : 0,
    avgClient: yearClients.size ? Math.round((ytd / yearClients.size) * 100) / 100 : 0,
    activeClients: new Set([...active, ...[...plans].filter((k) => firstSeen.has(k))]).size,
    clientsYear: yearClients.size,
    newThisMonth: clients.filter((k) => firstMonth(k) === thisMonth).length,
    newLastMonth: clients.filter((k) => firstMonth(k) === lastMonth).length,
    lost,
    churn: before.size ? round1((lost / before.size) * 100) : null,
    outstanding: Math.round(valid.filter((x) => x.i.status === "sent").reduce((s, x) => s + x.gross, 0) * 100) / 100,
    months,
  };
}
