import { describe, expect, it } from "vitest";
import { emptyInvoice } from "./invoice";
import { invoiceEmail } from "./invoiceEmail";

const inv = { ...emptyInvoice("Q4 - #0051", "2026-10-14"), btw: 0 as const, client: { name: "WE ARE SANCTUM LTD.", address: "", country: "GB", vat: "", email: "finance@sanctum.com" }, items: [{ id: "i", description: "Reel", qty: 1, rate: 1250 }] };

describe("email da invoice", () => {
  it("EN: número, total, vencimento e agradecimento", () => {
    const m = invoiceEmail(inv, { lang: "en", origin: "https://x.app", name: "Gabriel Costa", message: "Thanks for October!" });
    expect(m.subject).toBe("Invoice Q4 - #0051 — MediaMarques");
    expect(m.html).toContain("Hi Gabriel,");
    expect(m.html).toContain("Thanks for October!");
    expect(m.html).toContain("Please find attached invoice Q4 - #0051");
    expect(m.text).toContain("Due: 19 October 2026");
    expect(m.html).not.toContain("Pay online"); // sem link de pagamento
  });
  it("PT com link de pagamento", () => {
    const m = invoiceEmail({ ...inv, payment: { qr: "link", link: "https://pay.example/abc", termsDays: 5 } }, { lang: "pt", origin: "https://x.app" });
    expect(m.subject).toBe("Fatura Q4 - #0051 — MediaMarques");
    expect(m.html).toContain('href="https://pay.example/abc"');
    expect(m.text).toContain("Vence: 19 de outubro de 2026");
  });
});
describe("sem QR", () => {
  it("não promete código QR", () => {
    const m = invoiceEmail({ ...inv, payment: { qr: "none", link: "", termsDays: 5 } }, { lang: "en", origin: "https://x.app" });
    expect(m.text).not.toContain("QR");
  });
});
