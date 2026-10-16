// Email de convite da equipa (PT/EN/NL) no modelo único dos emails (lib/email/layout.ts).
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";

const COPY: Record<Lang, { subject: string; hi: string; body: string; cta: string; expires: string; ignore: string; or: string }> = {
  pt: {
    subject: "{inviter} convidou-o para a equipa XMEDIA",
    hi: "Olá {name},",
    body: "Foi convidado para a equipa no XMEDIA. Ao abrir o link, escreve o seu nome e a sua função, junta uma foto de perfil e escolhe um código de 4 a 6 dígitos (como no iPhone) — não precisa de palavra-passe.",
    cta: "Aceitar convite",
    expires: "Este link é pessoal e expira a {date}.",
    ignore: "Se não esperava este email, pode ignorá-lo.",
    or: "Ou copie este link:",
  },
  en: {
    subject: "{inviter} invited you to the XMEDIA team",
    hi: "Hi {name},",
    body: "You've been invited to the team on XMEDIA. Open the link, enter your name and role, add a profile photo and choose a 4–6 digit code (just like on an iPhone) — no password needed.",
    cta: "Accept invite",
    expires: "This link is personal and expires on {date}.",
    ignore: "If you weren't expecting this email, you can ignore it.",
    or: "Or copy this link:",
  },
  nl: {
    subject: "{inviter} heeft je uitgenodigd voor het XMEDIA-team",
    hi: "Hoi {name},",
    body: "Je bent uitgenodigd voor het team op XMEDIA. Open de link, vul je naam en functie in, voeg een profielfoto toe en kies een code van 4–6 cijfers (net als op een iPhone) — geen wachtwoord nodig.",
    cta: "Uitnodiging accepteren",
    expires: "Deze link is persoonlijk en verloopt op {date}.",
    ignore: "Verwachtte je deze e-mail niet? Dan kun je hem negeren.",
    or: "Of kopieer deze link:",
  },
};

/** Convite do cliente para o portal (marca MediaMarques). */
const PORTAL: typeof COPY = {
  pt: {
    subject: "O seu portal de cliente MediaMarques",
    hi: "Olá {name},",
    body: "Criámos o seu portal de cliente. Aqui acompanha cada fase do projeto, aprova conteúdos e vê o calendário de publicações e o grid do Instagram antes de tudo ir para o ar. Entre com a sua conta Google e escolha um código de 4 a 6 dígitos para os próximos acessos.",
    cta: "Abrir o meu portal",
    expires: "Este convite é pessoal e expira a {date}.",
    ignore: "Se não esperava este email, pode ignorá-lo.",
    or: "Ou copie este link:",
  },
  en: {
    subject: "Your MediaMarques client portal",
    hi: "Hi {name},",
    body: "We've set up your client portal. Follow every phase of the project, approve content and see the posting calendar and your Instagram grid before anything goes live. Sign in with your Google account and choose a 4–6 digit passcode for next time.",
    cta: "Open my portal",
    expires: "This invite is personal and expires on {date}.",
    ignore: "If you weren't expecting this email, you can ignore it.",
    or: "Or copy this link:",
  },
  nl: {
    subject: "Je MediaMarques-klantportaal",
    hi: "Hoi {name},",
    body: "We hebben je klantportaal klaargezet. Volg elke fase van het project, keur content goed en bekijk de postplanning en je Instagram-grid voordat iets live gaat. Log in met je Google-account en kies een code van 4 tot 6 cijfers voor de volgende keer.",
    cta: "Mijn portaal openen",
    expires: "Deze uitnodiging is persoonlijk en verloopt op {date}.",
    ignore: "Verwachtte je deze e-mail niet? Dan kun je hem negeren.",
    or: "Of kopieer deze link:",
  },
};

const LOCALE: Record<Lang, string> = { pt: "pt-PT", en: "en-GB", nl: "nl-NL" };
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

const LABEL = {
  team: { pt: "EQUIPA XMEDIA", en: "XMEDIA TEAM", nl: "XMEDIA-TEAM" } as Record<Lang, string>,
  portal: { pt: "PORTAL DO CLIENTE", en: "CLIENT PORTAL", nl: "KLANTPORTAAL" } as Record<Lang, string>,
};

export function inviteEmail(o: { lang: Lang; name: string; inviter: string; link: string; expiresAt: Date; logoUrl: string; origin?: string; kind?: "team" | "portal" }) {
  const set = o.kind === "portal" ? PORTAL : COPY;
  const c = set[o.lang] ?? set.pt;
  const date = o.expiresAt.toLocaleDateString(LOCALE[o.lang] ?? "pt-PT", { day: "numeric", month: "long", year: "numeric" });
  const v = { name: o.name, inviter: o.inviter || "XMEDIA", date };
  const subject = fill(c.subject, v);
  const text = [fill(c.hi, v), "", c.body, "", `${c.cta}: ${o.link}`, "", fill(c.expires, v), c.ignore].join("\n");
  const origin = o.origin ?? new URL(o.logoUrl).origin;
  const html = emailLayout({
    lang: o.lang,
    origin,
    label: o.kind === "portal" ? LABEL.portal[o.lang] : LABEL.team[o.lang],
    kicker: o.kind === "portal" ? "MediaMarques" : "XMEDIA",
    title: fill(c.hi, v),
    paragraphs: [c.body],
    cta: { label: c.cta, href: o.link },
    note: fill(c.expires, v),
    copyLink: { text: c.or, href: o.link },
    footer: c.ignore,
  });
  return { subject, text, html };
}

/** Envia pela Resend (RESEND_API_KEY). Sem chave devolve false e a app mostra o link para partilhar. */
export async function sendEmail(to: string, mail: { subject: string; text: string; html: string }, opts: { cc?: string[]; replyTo?: string } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false as const, reason: "no_provider" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.INVITE_FROM || "MediaMarques <contact@mediamarques.com>", // domínio verificado no Resend
      to: [to],
      ...(opts.cc?.length ? { cc: opts.cc } : {}),
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!r.ok) return { sent: false as const, reason: `provider_${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { sent: true as const };
}
