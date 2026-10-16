// PDF final assinado: valores dos campos desenhados sobre o original + página de certificado (trilho de auditoria,
// hashes SHA-256). Usado no servidor e, em modo local, no browser.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AUTO_FIELDS, autoValue, type Doc } from "./documents";

const hexRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** Desenha os valores dos campos sobre o original e junta a página de certificado (trilho de auditoria + hashes). */
export async function finalizePdf(doc: Doc, original: ArrayBuffer): Promise<{ bytes: Uint8Array; sha: string }> {
  const pdf = await PDFDocument.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();
  for (const f of doc.fields) {
    const page = pages[f.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const x = f.x * W, w = f.w * W, h = f.h * H, y = H - f.y * H - h;
    const r = doc.recipients.find((x) => x.id === f.recipient_id);
    const v = AUTO_FIELDS.includes(f.type) ? autoValue(f, r, r?.signed_at ? new Date(r.signed_at) : new Date()) : f.value ?? "";
    if (!v) continue;
    if (v.startsWith("data:image/")) {
      const b64 = v.split(",")[1];
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const img = v.startsWith("data:image/png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const s = Math.min(w / img.width, h / img.height);
      page.drawImage(img, { x, y, width: img.width * s, height: img.height * s });
      if (f.type === "signature" && r) page.drawText(`ID ${doc.id.slice(0, 8)} · ${r.signed_at?.slice(0, 16).replace("T", " ")} UTC`, { x, y: y - 7, size: 5.5, font, color: rgb(0.45, 0.45, 0.45) });
    } else if (f.type === "checkbox" || f.type === "radio") {
      if (v === "true" || f.type === "radio") page.drawText(f.type === "checkbox" ? "X" : `● ${v}`, { x: x + 1, y: y + 2, size: Math.max(7, h * 0.7), font: bold });
    } else {
      page.drawText(v.slice(0, 200), { x: x + 2, y: y + h * 0.25, size: Math.max(7, Math.min(12, h * 0.6)), font, color: f.type === "hyperlink" ? hexRgb("#3d7bff") : rgb(0.07, 0.07, 0.07), maxWidth: w - 4 });
    }
  }
  // página de certificado
  const cert = pdf.addPage([595, 842]);
  let yy = 790;
  const line = (t: string, size = 9, f = font, color = rgb(0.1, 0.1, 0.1)) => {
    cert.drawText(t.slice(0, 120), { x: 48, y: yy, size, font: f, color });
    yy -= size + 6;
  };
  line("CERTIFICATE OF COMPLETION · XMEDIA", 14, bold);
  line("Electronic signature under Regulation (EU) No 910/2014 (eIDAS)", 8, font, rgb(0.4, 0.4, 0.4));
  yy -= 6;
  line(`Document: ${doc.title}`, 10, bold);
  line(`Document ID: ${doc.id}`);
  line(`Original SHA-256: ${doc.file.sha256 ?? "-"}`, 8);
  line(`Completed: ${new Date().toISOString()}`);
  yy -= 8;
  line("SIGNERS", 10, bold);
  for (const r of doc.recipients.filter((x) => x.role !== "viewer")) {
    line(`${r.name} <${r.email}> · ${r.role}`, 9, bold);
    line(`Email verified: ${r.verified_at ?? "-"} · Signed: ${r.signed_at ?? "-"}`, 8);
  }
  yy -= 8;
  line("AUDIT TRAIL", 10, bold);
  for (const e of doc.audit.slice(-40)) line(`${e.at.replace("T", " ").slice(0, 19)}Z  ${e.action.toUpperCase()}  ${e.by}${e.ip ? ` · IP ${e.ip}` : ""}${e.detail ? ` · ${e.detail}` : ""}`, 7.5);
  const bytes = await pdf.save();
  const sha = await sha256Hex(bytes);
  return { bytes, sha };
}

async function sha256Hex(b: Uint8Array) {
  const h = await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

