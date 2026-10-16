// Email que acompanha a invoice (PDF em anexo), no modelo único (lib/email/layout.ts). Sai de invoices@mediamarques.com.
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";
import { money, totals, type Invoice } from "./invoice";
import { dueDate } from "./invoiceStats";

const C: Record<Lang, Record<string, string>> = {
  en: { label: "INVOICE", view: "View invoice online", viewNote: "The link works until the payment due date.", subject: "Invoice {number} — MediaMarques", hi: "Hi{name},", body: "Please find attached invoice {number} for {total}.", pay: "Payment is due by {due}. The PDF includes the bank details and a payment QR code.", payNoQr: "Payment is due by {due}. The PDF includes the bank details.", cta: "Pay online", rows: "Invoice", number: "Number", date: "Issued", due: "Due", total: "Total", thanks: "Thank you for working with us.", questions: "Questions about this invoice? Just reply to this email." },
  pt: { label: "FATURA", view: "Ver a fatura online", viewNote: "O link funciona até à data de vencimento do pagamento.", subject: "Fatura {number} — MediaMarques", hi: "Olá{name},", body: "Segue em anexo a fatura {number} no valor de {total}.", pay: "O pagamento vence a {due}. O PDF inclui os dados bancários e um código QR para pagar.", payNoQr: "O pagamento vence a {due}. O PDF inclui os dados bancários.", cta: "Pagar online", rows: "Fatura", number: "Número", date: "Emitida", due: "Vence", total: "Total", thanks: "Obrigado pela confiança.", questions: "Dúvidas sobre esta fatura? Basta responder a este email." },
  nl: { label: "FACTUUR", view: "Factuur online bekijken", viewNote: "De link werkt tot de vervaldatum van de betaling.", subject: "Factuur {number} — MediaMarques", hi: "Hoi{name},", body: "In de bijlage vind je factuur {number} van {total}.", pay: "De betaling vervalt op {due}. De pdf bevat de bankgegevens en een QR-code om te betalen.", payNoQr: "De betaling vervalt op {due}. De pdf bevat de bankgegevens.", cta: "Online betalen", rows: "Factuur", number: "Nummer", date: "Datum", due: "Vervalt", total: "Totaal", thanks: "Bedankt voor de samenwerking.", questions: "Vragen over deze factuur? Beantwoord gewoon deze e-mail." },
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const fmt = (d: string, lang: Lang) => new Date(d + "T12:00:00Z").toLocaleDateString(lang === "pt" ? "pt-PT" : lang === "nl" ? "nl-NL" : "en-GB", { day: "2-digit", month: "long", year: "numeric" });

export function invoiceEmail(inv: Invoice, o: { lang: Lang; origin: string; name?: string; message?: string; /** Link digital (/i/<token>) — expira no vencimento. */ viewLink?: string }) {
  const c = C[o.lang] ?? C.en;
  const total = money(totals(inv).total, inv.currency);
  const due = fmt(dueDate(inv), o.lang);
  const v = { number: inv.number, total, due };
  const hi = fill(c.hi, { name: o.name ? ` ${o.name.split(" ")[0]}` : "" });
  const payLink = inv.payment.qr === "link" && /^https:\/\//.test(inv.payment.link) ? inv.payment.link : "";
  const pay = fill(inv.payment.qr === "none" ? c.payNoQr : c.pay, v);
  const rows: [string, string][] = [
    [c.number, inv.number],
    [c.date, fmt(inv.issue_date, o.lang)],
    [c.due, due],
    [c.total, total],
  ];
  const html = emailLayout({
    lang: o.lang,
    origin: o.origin,
    label: c.label,
    kicker: inv.client.name || inv.number,
    title: hi,
    lead: o.message?.trim() || undefined,
    paragraphs: [fill(c.body, v), pay],
    cta: o.viewLink ? { label: c.view, href: o.viewLink } : payLink ? { label: c.cta, href: payLink } : undefined,
    note: o.viewLink ? c.viewNote : undefined,
    copyLink: o.viewLink && payLink ? { text: `${c.cta}:`, href: payLink } : undefined,
    rowsTitle: c.rows,
    rows,
    boldLastRow: true,
    closing: `${c.thanks}\n${c.questions}`,
  });
  const text = [hi, "", o.message?.trim() ?? "", fill(c.body, v), pay, o.viewLink ? `${c.view}: ${o.viewLink}` : "", payLink, "", ...rows.map(([k, x]) => `${k}: ${x}`), "", c.thanks, c.questions].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  return { subject: fill(c.subject, v), html, text };
}
