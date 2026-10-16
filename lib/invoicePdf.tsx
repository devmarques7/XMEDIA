"use client";

// Gera o PDF no browser (React PDF carregado só quando é preciso).
import { qrContent, totals, type Invoice } from "./invoice";

export async function invoiceBlob(inv: Invoice): Promise<Blob> {
  const [{ pdf }, { InvoiceDocument, registerInvoiceFonts }, QR] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/InvoicePdf"),
    import("qrcode"),
  ]);
  registerInvoiceFonts(`${location.origin}/fonts`);
  const content = qrContent(inv, totals(inv).total);
  const qr = content ? await QR.toDataURL(content, { margin: 0, width: 420, errorCorrectionLevel: "M" }) : null;
  return pdf(<InvoiceDocument invoice={inv} qrDataUrl={qr} iconSrc={`${location.origin}/invoice/mm-icon.png`} />).toBlob();
}

/** Nome no padrão do ficheiro original: [SANCTUM]©MM.Invoices[2026]-49.pdf */
export function invoiceFileName(inv: Invoice) {
  const who = (inv.client.name || "CLIENT").replace(/\b(LTD|B\.?V\.?|BV|LLC|INC|GMBH|SL|LDA)\.?\b/gi, "").replace(/^WE ARE\s+/i, "").trim().split(/\s+/)[0] || "CLIENT";
  const seq = parseInt(/#(\d+)/.exec(inv.number)?.[1] ?? "0", 10);
  return `[${who.toUpperCase().replace(/[^\w-]/g, "")}]©MM.Invoices[${inv.issue_date.slice(0, 4)}]-${seq}.pdf`;
}

export async function downloadInvoice(inv: Invoice) {
  const url = URL.createObjectURL(await invoiceBlob(inv));
  const a = document.createElement("a");
  a.href = url;
  a.download = invoiceFileName(inv);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
