import { describe, expect, it } from "vitest";
import { BUNDLED_PROPOSALS, needsBundle } from "./bundled";
import { normalizeProposal } from "./proposal";
import { proposalEmail } from "./proposalEmail";
import { applyPricing, pricingSummary } from "./proposalPricing";
import { SEED_SERVICES } from "./services-seed";

const boat = normalizeProposal(BUNDLED_PROPOSALS[0]);

describe("investimento da proposta", () => {
  it("Boat Event: produção 3h, base, pacotes e extras com o motor de preços", () => {
    const s = pricingSummary(boat.pricing!, SEED_SERVICES);
    expect(s.production.subtotal).toBe(3 * 114 + 75);
    expect(s.base.subtotal).toBe(602);
    expect(s.packages.map((p) => p.quote.subtotal)).toEqual([602, 1001.2]);
    expect(s.extras.map((e) => e.price)).toEqual([399.2, 114, 390]);
    expect(s.full.warnings.filter((w) => w.code === "blocked")).toEqual([]);
  });
  it("aplicar gera os slides inv-* depois da secção e é idempotente", () => {
    const once = applyPricing(boat, SEED_SERVICES);
    const twice = applyPricing(once, SEED_SERVICES);
    const ids = twice.doc.slides.map((s) => s.id);
    expect(ids.filter((i) => i.startsWith("inv-"))).toEqual(["inv-packages", "inv-extras", "inv-terms"]);
    expect(ids.indexOf("inv-packages")).toBe(ids.indexOf("s10") + 1);
    expect(twice.value).toBe(1001.2);
    const pk = twice.doc.slides.find((s) => s.id === "inv-packages");
    expect(pk?.type === "packages" && pk.packages.map((p) => [p.price, p.recommended])).toEqual([
      ["€ 602,00 EUR", false],
      ["€ 1.001,20 EUR", true],
    ]);
  });
  it("proposta incluída só reescreve versões anteriores", () => {
    expect(needsBundle(null, boat)).toBe(true);
    expect(needsBundle({ bundle_version: 1 }, boat)).toBe(true);
    expect(needsBundle({ bundle_version: 2 }, boat)).toBe(true);
    expect(needsBundle({ bundle_version: 3 }, boat)).toBe(true);
    expect(needsBundle({ bundle_version: 4 }, boat)).toBe(false);
    expect(needsBundle({ bundle_version: 1, decision: {} }, boat)).toBe(false);
    expect(boat.client.name).toBe("Mónica");
  });
  it("email da proposta no estilo do convite", () => {
    const m = proposalEmail({ lang: "en", name: "Admira Marques", title: boat.title, link: "https://x/v/abc", linkExpires: new Date("2026-11-12"), origin: "https://x", value: 1001.2, extras: 3, validUntil: "2026-11-07" });
    expect(m.subject).toContain("Boat Event");
    expect(m.html).toContain("Hi Admira,");
    expect(m.html).toContain("/api/email/header?label=PROPOSAL");
    expect(m.html).toContain("View the proposal");
    expect(m.text).toContain("https://x/v/abc");
  });
});

describe("decisão do cliente", async () => {
  const { choiceTotals, bookingEmail, declineEmail, bookingLabel } = await import("./decision");
  const offer = applyPricing(boat, SEED_SERVICES).pricing!.offer!;
  it("oferta congelada com 2 pacotes e 2 extras soltos", () => {
    expect(offer.packages.map((p) => [p.name, p.subtotal, !!p.recommended])).toEqual([
      ["Essential", 602, false],
      ["Essential + Social", 1001.2, true],
    ]);
    expect(offer.extras.map((e) => [e.label, e.price])).toEqual([
      ["Extra hour", 114],
      ["Photographer", 390],
    ]);
  });
  it("totais da escolha", () => {
    expect(choiceTotals(offer, 1, [])).toEqual({ subtotal: 1001.2, btw: 210.25, total: 1211.45, deposit: 605.73 });
    expect(choiceTotals(offer, 0, [0, 1]).subtotal).toBe(1106);
  });
  it("emails de booking e de agradecimento", () => {
    const b = bookingEmail({ name: "Admira Marques", title: boat.title, link: "https://x/v/t", origin: "https://x", offer, booking: boat.booking, pkg: 1, extras: [0] });
    expect(bookingLabel(boat.booking)).toContain("Saturday, 14 November 2026");
    expect(b.subject).toBe(`Booking confirmed · ${boat.title}`);
    expect(b.html).toContain("label=BOOKING%20CONFIRMED");
    expect(b.text).toContain("Total excl. BTW: €1,115.20");
    const d = declineEmail({ name: "Admira", title: boat.title, link: "https://x/v/t", origin: "https://x", note: "Budget" });
    expect(d.html).toContain("Thank you, Admira");
    expect(d.text).toContain("Budget");
  });
});

describe("invoice incluída", async () => {
  const { BUNDLED_INVOICES, needsInvoiceBundle } = await import("./bundled");
  const { totals } = await import("./invoice");
  it("Q4 - #0047 Sanctum: morada completa e total preservado (€3,620.78)", () => {
    const inv = BUNDLED_INVOICES.find((i) => i.number === "Q4 - #0047")!;
    expect(inv.client.address).toBe("Singel 174\n1015 AJ Amsterdam\nNetherlands");
    const t = totals(inv);
    expect([t.subtotal, t.btwAmount, t.total]).toEqual([2992.38, 628.4, 3620.78]);
    expect(needsInvoiceBundle({ bundle_version: 2 }, inv)).toBe(false);
    expect(needsInvoiceBundle({ bundle_version: 1 }, inv)).toBe(true); // v2: anexo + categoria
    expect(needsInvoiceBundle({}, inv)).toBe(true);
  });
});

describe("invoices 2026 (Notion) e clientes", async () => {
  const { BUNDLED_INVOICES, BUNDLED_CUSTOMERS, matchCustomer, mergeBundledCustomer } = await import("./bundled");
  const { totals } = await import("./invoice");
  const { existsSync } = await import("node:fs");
  const { emptyCustomer } = await import("./customer");
  const by = (n: string) => BUNDLED_INVOICES.find((i) => i.number === n)!;
  const total = (n: string) => totals(by(n)).total;

  it("números únicos, PDFs presentes e clientes ligados", () => {
    const nums = BUNDLED_INVOICES.map((i) => i.number.replace(/\s+/g, "").toLowerCase());
    expect(new Set(nums).size).toBe(nums.length);
    expect(BUNDLED_INVOICES.length).toBe(44);
    const ids = new Set(BUNDLED_CUSTOMERS.map((c) => c.id));
    for (const i of BUNDLED_INVOICES) {
      if (i.attachment) expect(existsSync(`data/invoices-2026/${i.attachment}`), i.attachment).toBe(true);
      expect(i.category, i.number).toBeTruthy();
      expect(ids.has(i.customer_id!), i.number).toBe(true);
    }
  });
  it("totais iguais aos PDFs (com as correções anotadas)", () => {
    expect(total("Q1 - #002")).toBe(5000);
    expect(total("Q1 - #009")).toBe(181.5); // PDF dizia 181.00
    expect(total("Q3 - #0035")).toBe(8167.5);
    expect(total("Q3 - #0038")).toBe(2327.12);
    expect(total("Q3 - #0039")).toBe(694.54);
    expect(total("Q3 - #0040")).toBe(1113.2);
    expect(total("Q3 - #0041")).toBe(847);
    expect(total("Q2 - #015 (1/2)")).toBe(524.84);
    expect(total("Q3 - #0030")).toBe(1109.57);
  });
  it("Q4 - #0051: morada corrigida (Singel 174) e total €363", () => {
    expect(by("Q4 - #0051").client.address).toBe("Singel 174\n1015 AJ Amsterdam\nNetherlands");
    expect(total("Q4 - #0051")).toBe(363);
  });
  it("anuladas ficam registadas mas marcadas", () => {
    expect(BUNDLED_INVOICES.filter((i) => i.void).map((i) => i.number)).toEqual(["Q1 - #003", "Q2 - #0018 (v1)"]);
  });
  it("cliente existente: encontra por nome/alias e só junta a faturação", () => {
    const b = BUNDLED_CUSTOMERS.find((c) => c.name === "Carioca Restaurant")!;
    const saved = { ...emptyCustomer("Carioca Restaurant"), id: "x1", stage: "stage3" as const, email: "management@cariocarestaurant.nl", portal: { status: "active" as const } };
    expect(matchCustomer([saved], b)?.id).toBe("x1");
    const m = mergeBundledCustomer(saved, b)!;
    expect([m.id, m.stage, m.portal.status, m.billing?.vat]).toEqual(["x1", "stage3", "active", "98719785"]);
    expect(mergeBundledCustomer({ ...m }, b)).toBeNull(); // idempotente
    const sanctum = BUNDLED_CUSTOMERS.find((c) => c.billing?.company === "Sanctum BV")!;
    expect(matchCustomer([{ ...emptyCustomer("Sanctum"), id: "s" }], sanctum)?.id).toBe("s");
  });
});
