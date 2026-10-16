import { describe, expect, it } from "vitest";
import { emptyInvoice, epcPayload, importJson, money, nextNumber, qrContent, resolveBtw, totals } from "./invoice";

describe("invoices", () => {
  it("reproduz o invoice Sanctum: GB, sem BTW, €735.00", () => {
    const inv = { ...emptyInvoice("Q4 - #0049", "2026-10-04"), client: { name: "WE ARE SANCTUM LTD.", address: "", country: "GB", vat: "", email: "" } };
    inv.items = [{ id: "1", description: "Reel PRO", qty: 3, rate: 245 }];
    const t = totals(inv);
    expect(t).toMatchObject({ subtotal: 735, btwAmount: 0, total: 735 });
    expect(t.btw.label).toBe("");
    expect(money(t.total, "EUR")).toBe("€735.00 EUR");
  });
  it("BTW automático por país e manual", () => {
    expect(resolveBtw("auto", "nl").rate).toBe(21);
    expect(resolveBtw("auto", "DE")).toMatchObject({ rate: 0, reason: "eu_reverse" });
    expect(resolveBtw("auto", "GB")).toMatchObject({ rate: 0, reason: "outside_eu" });
    expect(resolveBtw(9, "GB").rate).toBe(9);
    const t = totals({ items: [{ id: "1", description: "x", qty: 2.5, rate: 99.99 }], btw: "auto", client: { name: "", address: "", country: "NL", vat: "", email: "" } });
    expect(t).toMatchObject({ subtotal: 249.98, btwAmount: 52.5, total: 302.48 });
    expect(money(1234567.5, "GBP")).toBe("£1,234,567.50 GBP");
  });
  it("numeração seguinte por trimestre", () => {
    expect(nextNumber(["Q4 - #0049", "Q3 - #0012"], "2026-10-08")).toBe("Q4 - #0050");
    expect(nextNumber([], "2027-02-01", 50)).toBe("Q1 - #0050");
  });
  it("importa itens em JSON com chaves alternativas e aponta erros", () => {
    const r = importJson('{"items":[{"name":"Edit","hours":"3","price":"245,5"},{"qty":1}],"btw":21,"client":{"name":"ACME","country":"de"}}');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ description: "Edit", qty: 3, rate: 245.5 });
    expect(r.errors[0]).toContain("Item 2");
    expect(r.patch).toMatchObject({ btw: 21, client: { name: "ACME", country: "DE" } });
    expect(importJson("[1,").errors[0]).toContain("JSON inválido");
  });
  it("QR SEPA (EPC) com IBAN, valor e referência; link ING quando escolhido", () => {
    const p = epcPayload({ name: "MEDIAMARQUES", iban: "NL49 INGB 0110 7149 38", bic: "INGBNL2A", amount: 735, reference: "Invoice Q4 - #0049" }).split("\n");
    expect(p.slice(0, 4)).toEqual(["BCD", "002", "1", "SCT"]);
    expect(p[6]).toBe("NL49INGB0110714938");
    expect(p[7]).toBe("EUR735.00");
    const inv = emptyInvoice("Q4 - #0049", "2026-10-04");
    expect(qrContent({ ...inv, payment: { qr: "link", link: "https://www.ing.nl/payreq/m/?trxid=abc", termsDays: 5 } }, 735)).toContain("ing.nl/payreq");
    expect(qrContent({ ...inv, currency: "GBP" }, 735)).toBeNull();
  });
});
