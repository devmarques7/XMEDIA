import { describe, expect, it } from "vitest";
import { emptyInvoice, totals } from "../invoice";
import { ToolInputError, applyItems, applyUpdate, buildNew, describeChange } from "./apply";

const base = () => {
  const inv = emptyInvoice("Q4 - #0050", "2026-10-07");
  inv.client = { name: "Sanctum BV", address: "", country: "NL", vat: "", email: "" };
  inv.items = [
    { id: "1", description: "Capturing Day", qty: 6, rate: 114 },
    { id: "2", description: "Reel PRO", qty: 1, rate: 245 },
  ];
  return inv;
};

describe("ferramentas do assistente", () => {
  it("acerta o orçamento de 300 € com uma linha de desconto", () => {
    const after = applyItems(base(), {
      items: [
        { description: "Capturing Day", qty: 6, rate: 114 },
        { description: "Reel PRO", qty: 1, rate: 245 },
        { description: "Partnership Discount", qty: 1, rate: -629 },
      ],
    });
    expect(totals(after)).toMatchObject({ subtotal: 300, btwAmount: 63, total: 363 });
    expect(describeChange(base(), after).at(-1)).toContain("€363.00 EUR");
  });
  it("altera só os campos enviados e valida tipos", () => {
    const after = applyUpdate(base(), { id: "x", btw: 0, client: { country: "gb" }, note: "Updated" });
    expect(after.btw).toBe(0);
    expect(after.client).toMatchObject({ name: "Sanctum BV", country: "GB" });
    expect(after.items).toHaveLength(2);
    expect(() => applyUpdate(base(), { id: "x", btw: 15 })).toThrow(ToolInputError);
    expect(() => applyUpdate(base(), { id: "x", issue_date: "8/10/2026" })).toThrow(ToolInputError);
    expect(() => applyItems(base(), { items: [{ description: "", qty: 1, rate: 1 }] })).toThrow("item 1");
  });
  it("cria invoice nova com BTW automático", () => {
    const inv = buildNew({ client: { name: "ACME GmbH", country: "DE", vat: "DE123" }, items: [{ description: "Edit", qty: 2, rate: 100 }] }, "Q4 - #0052", "2026-10-08");
    expect(inv.number).toBe("Q4 - #0052");
    expect(totals(inv)).toMatchObject({ subtotal: 200, total: 200, btw: { reason: "eu_reverse" } });
  });
});
