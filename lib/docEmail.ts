// Emails dos documentos (pedido de assinatura, código de verificação, concluído) no modelo único (lib/email/layout.ts).
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";

type Kind = "request" | "otp" | "completed";
const C: Record<Lang, Record<string, string>> = {
  en: {
    label: "DOCUMENT", req_s: "{from} sent you “{title}” to sign", req_t: "Hi {name},", req_b: "{from} asked you to review and sign “{title}”. It takes a minute: open the document, fill in your fields and sign — no account needed.",
    req_cta: "Review and sign", req_note: "This link is personal. Your email will be verified with a code before signing.",
    otp_s: "Your signing code: {code}", otp_t: "Your code: {code}", otp_b: "Use this code to confirm your email and sign “{title}”. It expires in 10 minutes.", otp_note: "If you didn't request it, ignore this email.",
    done_s: "Completed: “{title}”", done_t: "All signed", done_b: "Everyone has signed “{title}”. The signed PDF includes a certificate with the audit trail.", done_cta: "Download the signed PDF",
    rows: "Details", doc: "Document", from: "From", until: "Valid until", or: "If the button doesn't open, copy this link:",
  },
  pt: {
    label: "DOCUMENTO", req_s: "{from} enviou “{title}” para assinar", req_t: "Olá {name},", req_b: "{from} pediu-lhe para rever e assinar “{title}”. Demora um minuto: abra o documento, preencha os seus campos e assine — sem criar conta.",
    req_cta: "Rever e assinar", req_note: "Este link é pessoal. O seu email é confirmado com um código antes de assinar.",
    otp_s: "O seu código de assinatura: {code}", otp_t: "O seu código: {code}", otp_b: "Use este código para confirmar o email e assinar “{title}”. Expira em 10 minutos.", otp_note: "Se não pediu este código, ignore este email.",
    done_s: "Concluído: “{title}”", done_t: "Tudo assinado", done_b: "Todos assinaram “{title}”. O PDF assinado inclui um certificado com o trilho de auditoria.", done_cta: "Descarregar o PDF assinado",
    rows: "Detalhes", doc: "Documento", from: "De", until: "Válido até", or: "Se o botão não abrir, copie este link:",
  },
  nl: {
    label: "DOCUMENT", req_s: "{from} stuurde “{title}” om te ondertekenen", req_t: "Hoi {name},", req_b: "{from} vraagt je “{title}” te bekijken en te ondertekenen. Het duurt een minuut: open het document, vul je velden in en onderteken — geen account nodig.",
    req_cta: "Bekijken en ondertekenen", req_note: "Deze link is persoonlijk. Je e-mail wordt met een code bevestigd voor het ondertekenen.",
    otp_s: "Je ondertekeningscode: {code}", otp_t: "Je code: {code}", otp_b: "Gebruik deze code om je e-mail te bevestigen en “{title}” te ondertekenen. Verloopt over 10 minuten.", otp_note: "Niet aangevraagd? Negeer deze e-mail.",
    done_s: "Voltooid: “{title}”", done_t: "Alles ondertekend", done_b: "Iedereen heeft “{title}” ondertekend. De ondertekende pdf bevat een certificaat met het audittraject.", done_cta: "Ondertekende pdf downloaden",
    rows: "Details", doc: "Document", from: "Van", until: "Geldig tot", or: "Opent de knop niet? Kopieer deze link:",
  },
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export function docEmail(kind: Kind, o: { lang: Lang; origin: string; name: string; title: string; from: string; link?: string; code?: string; expires?: string; message?: string }) {
  const c = C[o.lang] ?? C.en;
  const v = { name: o.name.split(" ")[0] || o.name, title: o.title, from: o.from, code: o.code ?? "" };
  const p = kind === "request" ? "req" : kind === "otp" ? "otp" : "done";
  const subject = fill(c[`${p}_s`], v);
  const html = emailLayout({
    lang: o.lang,
    origin: o.origin,
    label: c.label,
    kicker: o.title,
    title: fill(c[`${p}_t`], v),
    lead: kind === "request" && o.message ? o.message : undefined,
    paragraphs: [fill(c[`${p}_b`], v)],
    cta: o.link && kind !== "otp" ? { label: c[`${p}_cta`], href: o.link } : undefined,
    note: c[`${p}_note`] ? fill(c[`${p}_note`], v) : undefined,
    rowsTitle: kind === "request" ? c.rows : undefined,
    rows: kind === "request" ? ([[c.doc, o.title], [c.from, o.from], ...(o.expires ? [[c.until, o.expires]] : [])] as [string, string][]) : undefined,
    copyLink: o.link && kind !== "otp" ? { text: c.or, href: o.link } : undefined,
  });
  const text = [fill(c[`${p}_t`], v), "", fill(c[`${p}_b`], v), o.link ? `\n${o.link}` : ""].join("\n");
  return { subject, html, text };
}
