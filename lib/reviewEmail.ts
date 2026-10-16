// Email "pedido de revisão" de um conteúdo (reel, post, carrossel, story) no modelo único (lib/email/layout.ts).
// Três caminhos: equipa (abre na app), cliente com portal (abre no portal) e pessoa nova do cliente (mesmo onboarding
// do portal: cria o código de acesso e o conteúdo abre logo a seguir). Inglês por omissão.
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";

export type ReviewMode = "app" | "portal" | "onboarding";

const C: Record<Lang, Record<string, string>> = {
  en: {
    label: "REVIEW", subject: "Review request: {title} · {customer}", hi: "Hi {name},", hiAnon: "Hi there,",
    body: "{from} has asked you to review {type} “{title}” for {customer}. Take a look and leave your comments directly on the content — you can pin the exact moment in the video or the spot in the image, so nothing gets lost in emails.",
    bodyOnb: "{from} has asked you to review {type} “{title}” for {customer} in the MediaMarques client portal. First create your access (one minute, no password — just a 4–6 digit code); the content opens right after, ready for your comments.",
    what: "To review: {title}", due: "Planned publishing: {date}.",
    cta: "Open and review", ctaOnb: "Create access and review",
    note: "Your comments go straight to the team's checklist.", noteOnb: "This invitation is personal and expires in 7 days.",
    rows: "Details", client: "Client", content: "Content", type: "Type", date: "Publishing", files: "Files", by: "Requested by", none: "not scheduled yet", nofile: "no file yet", or: "If the button doesn't work, copy this link:",
  },
  pt: {
    label: "REVISÃO", subject: "Pedido de revisão: {title} · {customer}", hi: "Olá {name},", hiAnon: "Olá,",
    body: "{from} pediu-lhe para rever {type} “{title}” de {customer}. Veja o material e deixe os seus comentários diretamente no conteúdo — pode marcar o momento exato do vídeo ou o ponto da imagem, para que nada se perca em emails.",
    bodyOnb: "{from} pediu-lhe para rever {type} “{title}” de {customer} no portal de clientes MediaMarques. Primeiro crie o seu acesso (um minuto, sem palavra-passe — só um código de 4 a 6 dígitos); o conteúdo abre logo a seguir, pronto para os seus comentários.",
    what: "Para rever: {title}", due: "Publicação prevista: {date}.",
    cta: "Abrir e rever", ctaOnb: "Criar acesso e rever",
    note: "Os seus comentários vão diretamente para a checklist da equipa.", noteOnb: "Este convite é pessoal e expira em 7 dias.",
    rows: "Detalhes", client: "Cliente", content: "Conteúdo", type: "Tipo", date: "Publicação", files: "Ficheiros", by: "Pedido por", none: "ainda sem data", nofile: "ainda sem ficheiro", or: "Se o botão não abrir, copie este link:",
  },
  nl: {
    label: "REVIEW", subject: "Reviewverzoek: {title} · {customer}", hi: "Hoi {name},", hiAnon: "Hoi,",
    body: "{from} vraagt je om {type} “{title}” voor {customer} te reviewen. Bekijk het materiaal en plaats je opmerkingen direct op de content — je kunt het exacte moment in de video of het punt in de afbeelding markeren, zodat niets verloren gaat in e-mails.",
    bodyOnb: "{from} vraagt je om {type} “{title}” voor {customer} te reviewen in het MediaMarques-klantenportaal. Maak eerst je toegang aan (één minuut, geen wachtwoord — alleen een code van 4–6 cijfers); de content opent daarna meteen, klaar voor je opmerkingen.",
    what: "Te reviewen: {title}", due: "Geplande publicatie: {date}.",
    cta: "Openen en reviewen", ctaOnb: "Toegang aanmaken en reviewen",
    note: "Je opmerkingen gaan direct naar de checklist van het team.", noteOnb: "Deze uitnodiging is persoonlijk en verloopt over 7 dagen.",
    rows: "Details", client: "Klant", content: "Content", type: "Type", date: "Publicatie", files: "Bestanden", by: "Aangevraagd door", none: "nog niet gepland", nofile: "nog geen bestand", or: "Werkt de knop niet? Kopieer deze link:",
  },
};
const TYPES: Record<Lang, Record<string, string>> = {
  en: { reel: "the reel", post: "the post", carousel: "the carousel", story: "the story" },
  pt: { reel: "o reel", post: "o post", carousel: "o carrossel", story: "a story" },
  nl: { reel: "de reel", post: "de post", carousel: "de carrousel", story: "de story" },
};
const TYPE_LABEL: Record<Lang, Record<string, string>> = {
  en: { reel: "Reel", post: "Post", carousel: "Carousel", story: "Story" },
  pt: { reel: "Reel", post: "Post", carousel: "Carrossel", story: "Story" },
  nl: { reel: "Reel", post: "Post", carousel: "Carrousel", story: "Story" },
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export type ReviewMail = { lang: Lang; origin: string; link: string; customer: string; title: string; type: string; scheduled_at?: string; files: number; from: string; name?: string; message?: string; mode?: ReviewMode };

export function reviewEmail(o: ReviewMail) {
  const lang: Lang = C[o.lang] ? o.lang : "en";
  const c = C[lang];
  const mode = o.mode ?? "app";
  const typeLabel = TYPE_LABEL[lang][o.type] ?? o.type;
  const title = o.title || typeLabel;
  const when = o.scheduled_at ? new Date(o.scheduled_at).toLocaleString(lang === "pt" ? "pt-PT" : lang === "nl" ? "nl-NL" : "en-GB", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const v = { title, customer: o.customer, from: o.from, type: TYPES[lang][o.type] ?? typeLabel, date: when };
  const first = o.name?.trim().split(/\s+/)[0] ?? "";
  const hi = first ? fill(c.hi, { name: first }) : c.hiAnon;
  const body = fill(mode === "onboarding" ? c.bodyOnb : c.body, v);
  const rows: [string, string][] = [
    [c.client, o.customer],
    [c.content, title],
    [c.type, typeLabel],
    [c.date, when || c.none],
    [c.files, o.files ? String(o.files) : c.nofile],
    [c.by, o.from],
  ];
  const html = emailLayout({
    lang,
    origin: o.origin,
    label: c.label,
    kicker: `${o.customer} · ${typeLabel}`,
    title: hi,
    lead: o.message?.trim() || undefined,
    paragraphs: [body, ...(when ? [fill(c.due, v)] : [])],
    strong: fill(c.what, v),
    cta: { label: mode === "onboarding" ? c.ctaOnb : c.cta, href: o.link },
    note: mode === "onboarding" ? c.noteOnb : c.note,
    rowsTitle: c.rows,
    rows,
    copyLink: { text: c.or, href: o.link },
  });
  const text = [hi, "", o.message?.trim() ?? "", body, when ? fill(c.due, v) : "", "", fill(c.what, v), ...rows.map(([k, x]) => `${k}: ${x}`), "", o.link].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
  return { subject: fill(c.subject, v), html, text };
}
