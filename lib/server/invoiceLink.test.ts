import { beforeAll, describe, expect, it } from "vitest";
import { emptyInvoice } from "../invoice";
import { invoiceCc, invoiceToken, linkExpiry, readInvoiceToken } from "./invoiceLink";

beforeAll(() => {
  process.env.INVOICE_LINK_SECRET = "segredo-teste-links-invoice-123456";
});
const inv = { ...emptyInvoice("Q4 - #0051", "2026-10-14"), id: "inv-1" }; // vence 19/10 (5 dias)

describe("link digital da invoice", () => {
  it("expira no fim do dia de vencimento em Amesterdão", () => {
    expect(new Date(linkExpiry(inv) * 1000).toISOString()).toBe("2026-10-19T21:59:59.000Z"); // 23:59:59 CEST
  });
  it("token válido até ao vencimento, expirado depois", () => {
    const tk = invoiceToken(inv, "owner-1");
    expect(readInvoiceToken(tk, Date.parse("2026-10-19T21:00:00Z"))).toMatchObject({ id: "inv-1", owner: "owner-1" });
    expect(readInvoiceToken(tk, Date.parse("2026-10-19T22:00:01Z"))).toEqual({ error: "expired" });
  });
  it("token adulterado ou lixo → inválido", () => {
    const [body, sig] = invoiceToken(inv, "owner-1").split(".");
    const forged = Buffer.from(JSON.stringify({ i: "outra", o: "owner-1", e: 9e9 })).toString("base64url");
    expect(readInvoiceToken(`${forged}.${sig}`)).toEqual({ error: "invalid" });
    expect(readInvoiceToken(`${body}.x`)).toEqual({ error: "invalid" });
    expect(readInvoiceToken("lixo")).toEqual({ error: "invalid" });
  });
  it("Cc: por omissão contact@mediamarques.com; INVOICE_CC aceita vários", () => {
    expect(invoiceCc("")).toEqual(["contact@mediamarques.com"]);
    expect(invoiceCc("contact@mediamarques.com, Boekhouding@x.nl ; lixo")).toEqual(["contact@mediamarques.com", "boekhouding@x.nl"]);
  });
});
