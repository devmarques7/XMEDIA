import { describe, expect, it } from "vitest";
import { BUNDLED_INVOICES } from "./bundled";
import { emptyInvoice, type Invoice } from "./invoice";
import { companyKpis } from "./kpi";

const inv = (n: string, date: string, client: string, net: number, extra: Partial<Invoice> = {}): Invoice => ({
  ...emptyInvoice(n, date),
  status: "paid",
  btw: 0,
  client: { name: client, address: "", country: "NL", vat: "", email: "" },
  items: [{ id: "1", description: "x", qty: 1, rate: net }],
  ...extra,
});

describe("KPIs da empresa", () => {
  it("faturação, médias, clientes novos e perdidos", () => {
    const today = new Date(2026, 9, 14, 12);
    const k = companyKpis(
      [
        inv("1", "2026-05-20", "A", 1000), // A: só maio → perdido (90–180 dias)
        inv("2", "2026-09-20", "B", 500),
        inv("3", "2026-10-02", "C", 300), // C novo este mês
        inv("4", "2026-10-05", "B", 200),
        inv("5", "2026-10-06", "D", 999, { status: "draft" }), // rascunho não conta
        inv("6", "2026-10-07", "E", 999, { void: true }), // anulada não conta
        inv("7", "2025-03-01", "B", 400), // ano anterior
      ],
      { today }
    );
    expect(k.ytd).toBe(2000);
    expect(k.ytdPrev).toBe(400);
    expect(k.avgInvoice).toBe(500);
    expect(k.clientsYear).toBe(3);
    expect(k.activeClients).toBe(2); // B, C
    expect(k.newThisMonth).toBe(1);
    expect(k.lost).toBe(1);
    expect(k.churn).toBe(100);
    expect(k.months.at(-1)).toEqual({ m: "2026-10", total: 500 });
  });
  it("com as invoices de 2026 do Notion", () => {
    const k = companyKpis(BUNDLED_INVOICES, { today: new Date(2026, 9, 14, 12) });
    expect(k.ytd).toBeGreaterThan(30000);
    expect(k.clientsYear).toBe(21); // Viva Fashion só tem a anulada
    expect(k.months).toHaveLength(12);
  });
});
