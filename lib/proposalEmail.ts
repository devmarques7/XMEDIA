// Email "a sua proposta está pronta" (PT/EN/NL) no mesmo estilo do convite do portal:
// cabeçalho em gradiente (imagem), cartão claro, BioGrotesk + Fragment Mono, botão preto e quadro de detalhes. Função pura.
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";

const COPY: Record<Lang, { subject: string; label: string; hi: string; body: string; cta: string; details: string; proposal: string; investment: string; from: string; extras: string; valid: string; link: string; pdf: string; or: string; reply: string }> = {
  pt: {
    subject: "{title} · Proposta MediaMarques",
    label: "PROPOSTA",
    hi: "Olá {name},",
    body: "Como combinado, a proposta para {title} está pronta. Abra-a online — funciona no telemóvel e no computador — e veja o plano, os entregáveis e o investimento, passo a passo.",
    cta: "Ver a proposta",
    details: "Resumo",
    proposal: "Proposta",
    investment: "Investimento (recomendado)",
    from: "excl. BTW",
    extras: "Extras opcionais",
    valid: "Preços válidos até",
    link: "Link válido até",
    pdf: "Na própria página pode descarregar o PDF completo.",
    or: "Se o botão não abrir, copie este link:",
    reply: "Basta responder a este email com qualquer dúvida ou ajuste.",
  },
  en: {
    subject: "{title} · MediaMarques proposal",
    label: "PROPOSAL",
    hi: "Hi {name},",
    body: "As promised, the proposal for {title} is ready. Open it online — it works on phone and desktop — and walk through the plan, the deliverables and the investment, step by step.",
    cta: "View the proposal",
    details: "Summary",
    proposal: "Proposal",
    investment: "Investment (recommended)",
    from: "excl. BTW",
    extras: "Optional extras",
    valid: "Prices valid until",
    link: "Link valid until",
    pdf: "You can download the full PDF from the same page.",
    or: "If the button doesn't open, copy this link:",
    reply: "Just reply to this email with any question or change.",
  },
  nl: {
    subject: "{title} · Voorstel van MediaMarques",
    label: "VOORSTEL",
    hi: "Hoi {name},",
    body: "Zoals beloofd is het voorstel voor {title} klaar. Open het online — het werkt op telefoon en computer — en bekijk stap voor stap het plan, de opleveringen en de investering.",
    cta: "Voorstel bekijken",
    details: "Samenvatting",
    proposal: "Voorstel",
    investment: "Investering (aanbevolen)",
    from: "excl. btw",
    extras: "Optionele extra's",
    valid: "Prijzen geldig tot",
    link: "Link geldig tot",
    pdf: "Op dezelfde pagina kun je de volledige PDF downloaden.",
    or: "Opent de knop niet? Kopieer deze link:",
    reply: "Beantwoord deze e-mail gerust met vragen of wijzigingen.",
  },
};

const LOCALE: Record<Lang, string> = { pt: "pt-PT", en: "en-GB", nl: "nl-NL" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export type ProposalEmailInput = {
  lang: Lang;
  name: string; // destinatário
  title: string; // título da proposta
  link: string;
  linkExpires: Date;
  origin: string;
  value?: number; // investimento base excl. BTW
  extras?: number; // nº de extras opcionais
  validUntil?: string; // AAAA-MM-DD
  message?: string; // nota pessoal (opcional)
  sender?: string;
};

export function proposalEmail(o: ProposalEmailInput) {
  const c = COPY[o.lang] ?? COPY.en;
  const v = { name: o.name.trim().split(" ")[0] || o.name, title: o.title };
  const date = (d: Date) => d.toLocaleDateString(LOCALE[o.lang] ?? "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const money = (n: number) => new Intl.NumberFormat(LOCALE[o.lang] ?? "en-GB", { style: "currency", currency: "EUR" }).format(n);
  const subject = fill(c.subject, v);
  const rows: [string, string][] = [[c.proposal, o.title]];
  if (o.value) rows.push([c.investment, `${money(o.value)} ${c.from}`]);
  if (o.extras) rows.push([c.extras, String(o.extras)]);
  if (o.validUntil) rows.push([c.valid, date(new Date(o.validUntil + "T12:00:00"))]);
  rows.push([c.link, date(o.linkExpires)]);
  const msg = (o.message ?? "").trim();
  const sign = o.sender?.trim() || "MediaMarques";

  const text = [fill(c.hi, v), "", ...(msg ? [msg, ""] : []), fill(c.body, v), "", `${c.cta}: ${o.link}`, "", ...rows.map(([k, x]) => `${k}: ${x}`), "", c.pdf, c.reply, "", sign].join("\n");
  const html = emailLayout({
    lang: o.lang,
    origin: o.origin,
    label: c.label,
    kicker: o.title,
    title: fill(c.hi, v),
    lead: msg || undefined,
    paragraphs: [fill(c.body, v)],
    cta: { label: c.cta, href: o.link },
    note: c.pdf,
    rowsTitle: c.details,
    rows,
    copyLink: { text: c.or, href: o.link },
    closing: `${c.reply}\n\n${sign}`,
  });
  return { subject, text, html };
}
