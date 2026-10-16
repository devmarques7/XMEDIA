import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { activeSigners, clientDocs, missingFields, newDoc, newField, newRecipient, sendProblems, statusOf, type Doc } from "./documents";
import { finalizePdf } from "./pdfSign";

const file = { path: "x/y.pdf", name: "y.pdf", mime: "application/pdf", size: 10 };
const mk = (): Doc => {
  const a = newRecipient({ order: 1, name: "Ana", email: "ana@x.com" });
  const b = newRecipient({ order: 2, name: "Bruno", email: "b@y.com" });
  const d = newDoc({ title: "Contrato", file, recipients: [a, b] });
  return { ...d, fields: [newField("signature", 0, 0.5, 0.5, a.id), newField("signature", 0, 0.5, 0.8, b.id), newField("textbox", 0, 0.3, 0.3, a.id)] };
};

describe("documentos", () => {
  it("valida o envio", () => {
    const d = mk();
    expect(sendProblems(d)).toEqual([]);
    expect(sendProblems({ ...d, fields: d.fields.slice(1) })[0]).toMatch(/^no_signature:/);
    expect(sendProblems({ ...d, recipients: [] })).toContain("no_signer");
  });
  it("ordem de assinatura e estado", () => {
    const d = { ...mk(), status: "sent" as const, signing_order: true };
    expect(activeSigners(d).map((r) => r.name)).toEqual(["Ana"]);
    const after = { ...d, recipients: d.recipients.map((r, i) => (i === 0 ? { ...r, status: "signed" as const } : r)) };
    expect(activeSigners(after).map((r) => r.name)).toEqual(["Bruno"]);
    expect(statusOf(after)).toBe("partially_signed");
    expect(statusOf({ ...after, recipients: after.recipients.map((r) => ({ ...r, status: "signed" as const })) })).toBe("completed");
  });
  it("campos obrigatórios em falta", () => {
    const d = mk();
    const a = d.recipients[0].id;
    expect(missingFields(d, a, {}).length).toBe(2);
    expect(missingFields(d, a, Object.fromEntries(d.fields.filter((f) => f.recipient_id === a).map((f) => [f.id, "x"])))).toEqual([]);
  });
  it("o cliente só vê o que é dele e sem tokens", () => {
    const d = { ...mk(), recipients: mk().recipients.map((r) => ({ ...r, token_hash: "secret" })) };
    expect(clientDocs([d], "zzz@x.com")).toEqual([]);
    const seen = clientDocs([d], "ana@x.com");
    expect(seen.length).toBe(1);
    expect(seen[0].recipients.every((r) => !("token_hash" in r) || !r.token_hash)).toBe(true);
  });
  it("gera o PDF final com página de certificado", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    const original = (await pdf.save()).buffer as ArrayBuffer;
    const d = mk();
    const done = { ...d, fields: d.fields.map((f) => ({ ...f, value: f.type === "textbox" ? "Olá" : "" })) };
    const { bytes, sha } = await finalizePdf(done, original);
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(2);
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
  });
});
