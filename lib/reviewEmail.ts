// Email "pedido de revisão" de um conteúdo (reel, post, carrossel, story) no modelo único (lib/email/layout.ts):
// "Solicito que revise este conteúdo", que material é, e o link direto para o abrir na XMEDIA.
import { emailLayout } from "./email/layout";
import type { Lang } from "./i18n";

const C: Record<Lang, Record<string, string>> = {
  pt: { label: "REVISÃO", subject: "Pedido de revisão: {title}", hi: "Olá{name},", body: "Solicito que revise este conteúdo.", what: "Material a rever", cta: "Abrir o conteúdo", note: "Comente diretamente no conteúdo (pode marcar o momento exato no vídeo).", rows: "Detalhes", client: "Cliente", content: "Conteúdo", type: "Tipo", date: "Publicação", files: "Ficheiros", by: "Pedido por", none: "sem data", nofile: "ainda sem ficheiro", or: "Se o botão não abrir, copie este link:" },
  en: { label: "REVIEW", subject: "Review request: {title}", hi: "Hi{name},", body: "Please review this content.", what: "Material to review", cta: "Open the content", note: "Comment directly on the content (you can mark the exact moment in the video).", rows: "Details", client: "Client", content: "Content", type: "Type", date: "Publishing", files: "Files", by: "Requested by", none: "no date", nofile: "no file yet", or: "If the button doesn't open, copy this link:" },
  nl: { label: "REVIEW", subject: "Reviewverzoek: {title}", hi: "Hoi{name},", body: "Wil je deze content reviewen?", what: "Te reviewen materiaal", cta: "Content openen", note: "Reageer direct op de content (je kunt het exacte moment in de video markeren).", rows: "Details", client: "Klant", content: "Content", type: "Type", date: "Publicatie", files: "Bestanden", by: "Aangevraagd door", none: "geen datum", nofile: "nog geen bestand", or: "Opent de knop niet? Kopieer deze link:" },
};
const TYPES: Record<Lang, Record<string, string>> = {
  pt: { reel: "Reel", post: "Post", carousel: "Carrossel", story: "Story" },
  en: { reel: "Reel", post: "Post", carousel: "Carousel", story: "Story" },
  nl: { reel: "Reel", post: "Post", carousel: "Carrousel", story: "Story" },
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

export type ReviewMail = { lang: Lang; origin: string; link: string; customer: string; title: string; type: string; scheduled_at?: string; files: number; from: string; name?: string; message?: string };

export function reviewEmail(o: ReviewMail) {
  const c = C[o.lang] ?? C.pt;
  const title = o.title || TYPES[o.lang]?.[o.type] || o.type;
  const when = o.scheduled_at ? new Date(o.scheduled_at).toLocaleString(o.lang === "en" ? "en-GB" : o.lang === "nl" ? "nl-NL" : "pt-PT", { timeZone: "Europe/Amsterdam", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : c.none;
  const rows: [string, string][] = [
    [c.client, o.customer],
    [c.content, title],
    [c.type, TYPES[o.lang]?.[o.type] ?? o.type],
    [c.date, when],
    [c.files, o.files ? String(o.files) : c.nofile],
    [c.by, o.from],
  ];
  const hi = fill(c.hi, { name: o.name ? ` ${o.name.split(" ")[0]}` : "" });
  const html = emailLayout({
    lang: o.lang,
    origin: o.origin,
    label: c.label,
    kicker: `${o.customer} · ${title}`,
    title: hi,
    lead: o.message?.trim() || undefined,
    paragraphs: [c.body],
    strong: `${c.what}: ${title}`,
    cta: { label: c.cta, href: o.link },
    note: c.note,
    rowsTitle: c.rows,
    rows,
    copyLink: { text: c.or, href: o.link },
  });
  const text = [hi, "", c.body, o.message?.trim() ? `\n${o.message.trim()}` : "", "", `${c.what}: ${title} (${o.customer})`, ...rows.map(([k, v]) => `${k}: ${v}`), "", o.link].join("\n");
  return { subject: fill(c.subject, { title }), html, text };
}
