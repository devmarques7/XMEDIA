// Email "Como estamos a trabalhar?" (PT/EN/NL) no estilo dos outros emails: cabeçalho em gradiente, cartão claro,
// botão preto. Link de uso único para o formulário de avaliação. Função pura.
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";

const COPY: Record<Lang, { subject: string; label: string; hi: string; body: string; time: string; cta: string; once: string; valid: string; thanks: string }> = {
  pt: {
    subject: "2 minutos: como estamos a trabalhar consigo?",
    label: "AVALIAÇÃO",
    hi: "Olá {name},",
    body: "Queremos melhorar a forma como trabalhamos consigo. Pode dizer-nos, com toda a sinceridade, como está a ser a experiência com a MediaMarques? As respostas são lidas só pela direção e ajudam-nos a decidir o que mudar.",
    time: "São 8 perguntas rápidas — cerca de 2 minutos.",
    cta: "Responder agora",
    once: "Este link é pessoal e só pode ser usado uma vez.",
    valid: "Válido até {date}.",
    thanks: "Obrigado pela confiança,",
  },
  en: {
    subject: "2 minutes: how are we doing for you?",
    label: "FEEDBACK",
    hi: "Hi {name},",
    body: "We want to keep improving how we work with you. Could you tell us, honestly, how the experience with MediaMarques has been? Answers are read only by the management team and help us decide what to change.",
    time: "8 quick questions — about 2 minutes.",
    cta: "Answer now",
    once: "This link is personal and can only be used once.",
    valid: "Valid until {date}.",
    thanks: "Thank you for your trust,",
  },
  nl: {
    subject: "2 minuten: hoe doen we het voor jou?",
    label: "FEEDBACK",
    hi: "Hoi {name},",
    body: "We willen blijven verbeteren hoe we met je samenwerken. Wil je ons eerlijk vertellen hoe de ervaring met MediaMarques is? De antwoorden worden alleen door de directie gelezen en helpen ons te bepalen wat we veranderen.",
    time: "8 korte vragen — ongeveer 2 minuten.",
    cta: "Nu beantwoorden",
    once: "Deze link is persoonlijk en kan maar één keer gebruikt worden.",
    valid: "Geldig tot {date}.",
    thanks: "Bedankt voor je vertrouwen,",
  },
};
const LOCALE: Record<Lang, string> = { pt: "pt-PT", en: "en-GB", nl: "nl-NL" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export function feedbackEmail(o: { lang: Lang; name: string; link: string; expires: Date; origin: string; sender?: string; company?: string }) {
  const c = COPY[o.lang] ?? COPY.en;
  const first = o.name.trim().split(" ")[0] || o.name;
  const date = o.expires.toLocaleDateString(LOCALE[o.lang] ?? "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const sign = o.sender?.trim() || "Daniel Marques · MediaMarques";
  const subject = c.subject;
  const text = [fill(c.hi, { name: first }), "", c.body, c.time, "", `${c.cta}: ${o.link}`, "", c.once, fill(c.valid, { date }), "", c.thanks, sign].join("\n");
  const html = emailLayout({
    lang: o.lang,
    origin: o.origin,
    label: c.label,
    kicker: o.company,
    title: fill(c.hi, { name: first }),
    paragraphs: [c.body],
    strong: c.time,
    cta: { label: c.cta, href: o.link },
    note: c.once,
    rowsTitle: c.label,
    rows: [
      [{ pt: "Cliente", en: "Client", nl: "Klant" }[o.lang] ?? "Client", o.company || "MediaMarques"],
      [fill(c.valid, { date: "" }).replace(/[.:]\s*$/, ""), date],
    ],
    closing: `${c.thanks}\n${sign}`,
  });
  return { subject, text, html };
}
