import { describe, expect, it } from "vitest";
import { emptyInvoice, type Invoice } from "./invoice";
import { dueDate, financeDash, isOverdue, matchesFilter } from "./invoiceStats";

const mk = (over: Partial<Invoice>): Invoice => ({ ...emptyInvoice("Q4 - #0050", "2026-10-01"), btw: 0, items: [{ id: "i", description: "Reel", qty: 1, rate: 1000 }], ...over });
const TODAY = "2026-10-16";
const draft = mk({ status: "draft", issue_date: "2026-10-15" });
const sentNew = mk({ status: "sent", issue_date: "2026-10-14" }); // vence 19/10
const sentLate = mk({ status: "sent", issue_date: "2026-10-01" }); // venceu 06/10
const paid = mk({ status: "paid", issue_date: "2026-09-10" });
const voided = mk({ status: "sent", issue_date: "2026-09-01", void: true });
const usd = mk({ status: "sent", issue_date: "2026-10-02", currency: "USD" as Invoice["currency"] });
const all = [draft, sentNew, sentLate, paid, voided, usd];

describe("estado das invoices", () => {
  it("vencimento = emissão + prazo", () => {
    expect(dueDate(sentLate)).toBe("2026-10-06");
    expect(dueDate({ ...sentLate, payment: { ...sentLate.payment, termsDays: 30 } })).toBe("2026-10-31");
  });
  it("em atraso só se enviada, não anulada e vencida", () => {
    expect(isOverdue(sentLate, TODAY)).toBe(true);
    expect(isOverdue(sentNew, TODAY)).toBe(false);
    expect(isOverdue(voided, TODAY)).toBe(false);
    expect(isOverdue({ ...sentLate, status: "paid" }, TODAY)).toBe(false);
  });
  it("filtros rápidos", () => {
    const ids = (f: Parameters<typeof matchesFilter>[1]) => all.filter((i) => matchesFilter(i, f, TODAY));
    expect(ids("sent")).toEqual([sentNew, sentLate, paid, usd]);
    expect(ids("unpaid")).toEqual([sentNew, sentLate, usd]);
    expect(ids("overdue")).toEqual([sentLate, usd]);
    expect(ids("draft")).toEqual([draft]);
    expect(ids("all")).toHaveLength(6);
  });
});

describe("painel", () => {
  it("montantes em EUR, contagens de tudo, 12 meses", () => {
    const d = financeDash(all, TODAY);
    expect(d.invoiced).toBe(3000); // sentNew + sentLate + paid (sem rascunho, anulada, USD)
    expect(d.received).toBe(1000);
    expect(d.outstanding).toEqual({ n: 2, total: 2000 });
    expect(d.overdue).toEqual({ n: 1, total: 1000 });
    expect(d.drafts).toBe(1);
    expect(d.counts).toMatchObject({ all: 6, draft: 1, sent: 4, unpaid: 3, overdue: 2, paid: 1 });
    expect(d.months).toHaveLength(12);
    expect(d.months[0].key).toBe("2025-11");
    expect(d.months.at(-1)).toEqual({ key: "2026-10", total: 2000, paid: 0 });
    expect(d.months.at(-2)).toEqual({ key: "2026-09", total: 1000, paid: 1000 });
  });
});
