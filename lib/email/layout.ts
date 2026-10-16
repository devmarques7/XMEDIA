// Modelo ÚNICO de todos os emails do XMEDIA (convites da equipa e do portal, propostas, booking, agradecimento,
// avaliação): cabeçalho com a arte em gradiente + rótulo, cartão claro, etiqueta laranja, título, texto,
// botão preto, nota, tabela de detalhes, link de recurso e rodapé MediaMarques. Só muda o conteúdo.
import { EMAIL_FONTS_LINK, EMAIL_SANS, KICKER_STYLE, LABEL_STYLE } from "./theme";

export type EmailBlock = {
  lang?: string;
  origin: string; // para o cabeçalho /api/email/header
  label: string; // ex.: "CLIENT PORTAL", "TEAM"
  kicker?: string; // etiqueta laranja por cima do título (cliente / proposta)
  title: string;
  /** Nota pessoal destacada (texto escuro), antes do corpo. */
  lead?: string;
  paragraphs: string[];
  /** Frase em destaque depois do corpo. */
  strong?: string;
  cta?: { label: string; href: string };
  note?: string; // texto pequeno por baixo do botão
  rowsTitle?: string;
  rows?: [string, string][];
  boldLastRow?: boolean;
  /** Link de recurso ("se o botão não abrir…"). */
  copyLink?: { text: string; href: string };
  closing?: string;
  footer?: string; // linha extra no rodapé (ex.: "se não esperava…")
};

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailLayout(o: EmailBlock) {
  const header = `${o.origin}/api/email/header?label=${encodeURIComponent(o.label)}`;
  const rows = o.rows ?? [];
  const row = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:10px 0;border-top:1px solid #ececec;font-size:13px;color:#8a8a8a;vertical-align:top">${esc(k)}</td><td align="right" style="padding:10px 0 10px 12px;border-top:1px solid #ececec;font-size:14px;color:#111;${strong ? "font-weight:600" : ""}">${esc(v).replace(/\n/g, "<br>")}</td></tr>`;
  const p = (s: string, style = "margin:0 0 16px;font-size:15px;line-height:1.65;color:#444") => `<p style="${style};white-space:pre-line">${esc(s)}</p>`;
  return `<!doctype html><html lang="${o.lang ?? "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(o.title)}</title>
${EMAIL_FONTS_LINK}</head>
<body style="margin:0;padding:0;background:#f2f1ee;font-family:${EMAIL_SANS};color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f1ee;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="padding:0;line-height:0"><img src="${esc(header)}" width="560" alt="XMEDIA · ${esc(o.label)}" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:36px 36px 8px">
${o.kicker ? `<p style="margin:0 0 6px;${KICKER_STYLE}">${esc(o.kicker.toUpperCase())}</p>` : ""}
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.4px">${esc(o.title)}</h1>
${o.lead ? p(o.lead, "margin:0 0 16px;font-size:15px;line-height:1.65;color:#111") : ""}
${o.paragraphs.map((x) => p(x)).join("")}
${o.strong ? p(o.strong, "margin:0 0 16px;font-size:15px;line-height:1.65;color:#111;font-weight:500") : ""}
${o.cta ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 0"><tr><td><a href="${esc(o.cta.href)}" style="display:block;background:#111;color:#ffffff;text-decoration:none;text-align:center;font-weight:500;font-size:15px;padding:14px 20px;border-radius:10px">${esc(o.cta.label)} →</a></td></tr></table>` : ""}
${o.note ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#777">${esc(o.note)}</p>` : ""}
<div style="height:26px;line-height:26px">&nbsp;</div>
${rows.length ? `${o.rowsTitle ? `<p style="margin:0 0 6px;${LABEL_STYLE}">${esc(o.rowsTitle.toUpperCase())}</p>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px">${rows.map(([k, v], i) => row(k, v, !!o.boldLastRow && i === rows.length - 1)).join("")}</table>` : ""}
${o.copyLink ? `<p style="margin:0 0 4px;font-size:12px;color:#8a8a8a">${esc(o.copyLink.text)}</p><p style="margin:0 0 26px;font-size:12px;word-break:break-all"><a href="${esc(o.copyLink.href)}" style="color:#ff5a1f">${esc(o.copyLink.href)}</a></p>` : ""}
${o.closing ? p(o.closing, "margin:0 0 28px;font-size:14px;line-height:1.6;color:#444") : ""}
</td></tr>
<tr><td style="padding:18px 36px 26px;border-top:1px solid #ececec;font-size:12px;line-height:1.6;color:#8a8a8a">
MediaMarques · Brand Elevation Studio · Amsterdam<br>${o.footer ? esc(o.footer) : "contact@mediamarques.com"}</td></tr>
</table></td></tr></table></body></html>`;
}
