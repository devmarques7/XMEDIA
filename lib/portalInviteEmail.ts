// Email de convite para o portal do cliente (PT/EN/NL), no estilo da página de login do XMEDIA:
// modelo único (lib/email/layout.ts).
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";

const COPY: Record<Lang, { subject: string; label: string; hi: string; body: string; cta: string; who: string; client: string; email: string; until: string; how: string; or: string; ignore: string }> = {
  pt: {
    subject: "{customer} · O seu acesso ao portal XMEDIA",
    label: "PORTAL DO CLIENTE",
    hi: "Olá {name},",
    body: "Foi convidado para o portal de cliente da {customer} no XMEDIA. Aqui acompanha os projetos, vê os vídeos e as fotografias antes de irem para o ar, comenta no frame ou no ponto exato e aprova as entregas — tudo num só sítio.",
    cta: "Entrar no portal",
    who: "O seu acesso",
    client: "Cliente",
    email: "Email",
    until: "Convite válido até",
    how: "Ao abrir o link, os seus dados já estão preenchidos: só escolhe um código de 4 a 6 dígitos (como no iPhone) para os próximos acessos.",
    or: "Se o botão não abrir, copie este link:",
    ignore: "Se não esperava este convite, pode ignorar este email.",
  },
  en: {
    subject: "{customer} · Your XMEDIA portal access",
    label: "CLIENT PORTAL",
    hi: "Hi {name},",
    body: "You've been invited to the {customer} client portal on XMEDIA. Follow your projects, watch videos and photos before they go live, comment on the exact frame or spot, and approve deliveries — all in one place.",
    cta: "Open the portal",
    who: "Your access",
    client: "Client",
    email: "Email",
    until: "Invite valid until",
    how: "When you open the link your details are already filled in — you just choose a 4–6 digit code (like on an iPhone) for next time.",
    or: "If the button doesn't open, copy this link:",
    ignore: "If you weren't expecting this invite, you can ignore this email.",
  },
  nl: {
    subject: "{customer} · Je toegang tot het XMEDIA-portaal",
    label: "KLANTPORTAAL",
    hi: "Hoi {name},",
    body: "Je bent uitgenodigd voor het klantportaal van {customer} op XMEDIA. Volg je projecten, bekijk video's en foto's voordat ze live gaan, reageer op het exacte frame of de exacte plek en keur opleveringen goed — alles op één plek.",
    cta: "Portaal openen",
    who: "Je toegang",
    client: "Klant",
    email: "E-mail",
    until: "Uitnodiging geldig tot",
    how: "Als je de link opent zijn je gegevens al ingevuld — je kiest alleen een code van 4–6 cijfers (zoals op een iPhone) voor de volgende keer.",
    or: "Opent de knop niet? Kopieer deze link:",
    ignore: "Verwachtte je deze uitnodiging niet? Dan kun je deze e-mail negeren.",
  },
};

const LOCALE: Record<Lang, string> = { pt: "pt-PT", en: "en-GB", nl: "nl-NL" };
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export function portalInviteEmail(o: { lang: Lang; name: string; customer: string; email: string; link: string; expiresAt: Date; origin: string }) {
  const c = COPY[o.lang] ?? COPY.en;
  const v = { name: o.name.split(" ")[0] || o.name, customer: o.customer };
  const date = o.expiresAt.toLocaleDateString(LOCALE[o.lang] ?? "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const subject = fill(c.subject, v);
  const text = [fill(c.hi, v), "", fill(c.body, v), "", `${c.cta}: ${o.link}`, "", `${c.client}: ${o.customer}`, `${c.email}: ${o.email}`, `${c.until}: ${date}`, "", c.how, "", c.ignore].join("\n");
  const html = emailLayout({
    lang: o.lang,
    origin: o.origin,
    label: c.label,
    kicker: o.customer,
    title: fill(c.hi, v),
    paragraphs: [fill(c.body, v)],
    cta: { label: c.cta, href: o.link },
    note: c.how,
    rowsTitle: c.who,
    rows: [[c.client, o.customer], [c.email, o.email], [c.until, date]],
    copyLink: { text: c.or, href: o.link },
    footer: c.ignore,
  });
  return { subject, text, html };
}
