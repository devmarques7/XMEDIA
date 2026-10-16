import { describe, expect, it } from "vitest";
import { invoiceFrom, senderFrom } from "./inviteEmail";

describe("senderFrom (remetente Resend)", () => {
  it("vazio → remetente por omissão", () => expect(senderFrom("")).toBe("MediaMarques <contact@mediamarques.com>"));
  it("só o nome → nome com o endereço por omissão", () => expect(senderFrom("MediaMarques Studio")).toBe("MediaMarques Studio <contact@mediamarques.com>"));
  it("Nome <email> fica igual", () => expect(senderFrom("XMEDIA <convites@mediamarques.com>")).toBe("XMEDIA <convites@mediamarques.com>"));
  it("só o email fica igual", () => expect(senderFrom("convites@mediamarques.com")).toBe("convites@mediamarques.com"));
  it("aspas e < > soltos são limpos", () => expect(senderFrom('"MediaMarques" <')).toBe("MediaMarques <contact@mediamarques.com>"));
});

describe("invoiceFrom (remetente das invoices)", () => {
  it("por omissão: invoices@mediamarques.com", () => expect(invoiceFrom("")).toBe("MediaMarques Invoices <invoices@mediamarques.com>"));
  it("INVOICE_FROM completo fica igual", () => expect(invoiceFrom("MediaMarques <invoices@mediamarques.com>")).toBe("MediaMarques <invoices@mediamarques.com>"));
  it("INVOICE_FROM só com o email fica igual", () => expect(invoiceFrom("invoices@mediamarques.com")).toBe("invoices@mediamarques.com"));
});
describe("invoiceFrom só com o nome", () => {
  it("usa invoices@, não contact@", () => expect(invoiceFrom("MediaMarques Studio")).toBe("MediaMarques Studio <invoices@mediamarques.com>"));
});
