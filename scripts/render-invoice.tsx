// Renderiza o invoice de exemplo (Sanctum) para comparar com o PDF original. Uso: npx tsx scripts/render-invoice.tsx <saida.pdf>
import { renderToFile } from "@react-pdf/renderer";
import QRCode from "qrcode";
import path from "node:path";
import { InvoiceDocument, registerInvoiceFonts } from "../components/InvoicePdf";
import { readFileSync } from "node:fs";
import { emptyInvoice, importJson, qrContent, totals } from "../lib/invoice";

const root = process.cwd();
registerInvoiceFonts(path.join(root, "public/fonts"));
const inv = emptyInvoice("Q4 - #0049", "2026-10-04");
inv.client = { name: "WE ARE SANCTUM LTD.", address: "1st Floor One Suffolk Way\nSevenoaks TN13 1YL GB", country: "GB", vat: "", email: "" };
inv.items = [{ id: "1", description: "® [MM] Post-Production / Reel PRO: - Complete Edit", qty: 3, rate: 245 }];
inv.note =
  'Covers the complete edit of 3 final Reels from the Sanctum x GoogleHealth event footage, keeping the Sanctum identity clearly distinct from the GoogleHealth partnership throughout. Each Reel is billed at the agreed all-in "Reel PRO: Complete Edit" rate, which includes the narrative edit, color grading and brand-consistency pass. No additional scope or revisions beyond the agreed three Reels are included.';
inv.payment = { qr: "link", link: "https://www.ing.nl/payreq/m/?trxid=aGIiZzAyaoGETXP07wXSrCt33ntQvQg8", termsDays: 5 };
if (process.env.VARIANT === "nl") {
  inv.number = "Q4 - #0050";
  inv.client = { name: "Studio Noord B.V.", address: "Keizersgracht 100\n1015 AA Amsterdam NL", country: "NL", vat: "", email: "" };
  inv.items = [
    { id: "a", description: "® [MM] Capture Day / Full Day", qty: 1, rate: 900 },
    { id: "b", description: "® [MM] Post-Production / Reel PRO: - Complete Edit", qty: 3, rate: 245 },
  ];
  inv.note = "Teste: BTW automático 21% e QR SEPA.";
  inv.payment = { qr: "epc", link: "", termsDays: 5 };
  inv.theme = { ...inv.theme, accent: "#2F5BFF", total: "#2F5BFF" };
}
// node .render.mjs saida.pdf fatura.json → usa o JSON (mesmo formato do "Importar JSON" da app)
if (process.argv[3]) {
  const r = importJson(readFileSync(process.argv[3], "utf8"));
  if (r.errors.length) throw new Error(r.errors.join("\n"));
  Object.assign(inv, r.patch, { items: r.items, payment: { qr: "epc", link: "", termsDays: 5 } });
}
(async () => {
  const content = qrContent(inv, totals(inv).total);
  const qr = content ? await QRCode.toDataURL(content, { margin: 0, width: 420, errorCorrectionLevel: "M" }) : null;
  await renderToFile(<InvoiceDocument invoice={inv} qrDataUrl={qr} iconSrc={path.join(root, "public/invoice/mm-icon.png")} />, process.argv[2]);
  console.log("ok", process.argv[2]);
})();
