// Email "redefinir código" no modelo único (lib/email/layout.ts).
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";

const COPY: Record<Lang, { subject: string; label: string; title: string; body: string; cta: string; note: string; ignore: string; or: string }> = {
  pt: { subject: "Redefinir o seu código de acesso XMEDIA", label: "REDEFINIR CÓDIGO", title: "Redefinir o código", body: "Recebemos um pedido para redefinir o código de acesso desta conta. Toque no botão e escolha um código novo de 4 a 6 dígitos.", cta: "Escolher código novo", note: "O link é pessoal, funciona uma vez e expira em 30 minutos.", ignore: "Se não pediu isto, ignore este email — o seu código continua o mesmo.", or: "Se o botão não abrir, copie este link:" },
  en: { subject: "Reset your XMEDIA access code", label: "RESET CODE", title: "Reset your code", body: "We received a request to reset the access code for this account. Tap the button and choose a new 4–6 digit code.", cta: "Choose a new code", note: "This link is personal, works once and expires in 30 minutes.", ignore: "If you didn't ask for this, ignore this email — your code stays the same.", or: "If the button doesn't open, copy this link:" },
  nl: { subject: "Je XMEDIA-toegangscode opnieuw instellen", label: "CODE OPNIEUW INSTELLEN", title: "Code opnieuw instellen", body: "We kregen een verzoek om de toegangscode van dit account opnieuw in te stellen. Tik op de knop en kies een nieuwe code van 4–6 cijfers.", cta: "Nieuwe code kiezen", note: "Deze link is persoonlijk, werkt één keer en verloopt na 30 minuten.", ignore: "Niet aangevraagd? Negeer deze e-mail — je code blijft hetzelfde.", or: "Opent de knop niet? Kopieer deze link:" },
};

export function resetEmail(o: { lang: Lang; origin: string; link: string }) {
  const c = COPY[o.lang] ?? COPY.en;
  const html = emailLayout({ lang: o.lang, origin: o.origin, label: c.label, kicker: "XMEDIA", title: c.title, paragraphs: [c.body], cta: { label: c.cta, href: o.link }, note: c.note, copyLink: { text: c.or, href: o.link }, footer: c.ignore });
  return { subject: c.subject, html, text: [c.title, "", c.body, "", o.link, "", c.note, c.ignore].join("\n") };
}
