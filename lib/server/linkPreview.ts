// Pré-visualização de um link (imagem + título): Pinterest (oEmbed), YouTube (miniatura), ou og:image de qualquer página.
// Proteções: só http(s), sem IPs/hosts internos, 6 s de limite e 600 KB lidos no máximo.
import { parseRef } from "@/lib/references";

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:|metadata\.)/i;

export type LinkPreview = { url: string; image: string; title: string; site: string; ok: boolean };

async function get(url: string, accept = "text/html") {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 6000);
  try {
    // segue redirecionamentos à mão (máx. 4) e recusa destinos internos
    let r: Response | null = null;
    let cur = url;
    for (let hop = 0; hop < 5; hop++) {
      const h = new URL(cur);
      if (!/^https?:$/.test(h.protocol) || PRIVATE.test(h.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(h.hostname)) return null;
      r = await fetch(cur, { signal: ctl.signal, redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; XMEDIA-preview/1.0)", Accept: accept } });
      const loc = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
      if (!loc) break;
      cur = new URL(loc, cur).toString();
      r = null;
    }
    if (!r || !r.ok || !r.body) return null;
    const reader = r.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (size < 600_000) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => {});
    return { type: r.headers.get("content-type") ?? "", text: new TextDecoder().decode(Buffer.concat(chunks)), final: cur };
  } catch {
    return null;
  } finally {
    clearTimeout(tm);
  }
}

const meta = (html: string, prop: string) =>
  (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i")) ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i")) ?? [])[1] ?? "";
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function linkPreview(raw: string): Promise<LinkPreview> {
  const p = parseRef(raw);
  const fail = (url = raw): LinkPreview => ({ url, image: "", title: "", site: "", ok: false });
  if (!p) return fail();
  const u = new URL(p.url);
  if (PRIVATE.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return fail(p.url);
  if (p.platform === "youtube") return { url: p.url, image: p.thumb, title: "YouTube", site: "YouTube", ok: true };
  if (p.platform === "pinterest" || u.hostname === "pin.it") {
    const o = await get(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(p.url)}`, "application/json");
    try {
      const j = o ? JSON.parse(o.text) : null;
      if (j?.thumbnail_url) return { url: p.url, image: String(j.thumbnail_url).replace(/\/\d+x\//, "/736x/"), title: String(j.title || j.author_name || "Pinterest"), site: "Pinterest", ok: true };
    } catch {}
  }
  const r = await get(p.url);
  if (!r) return fail(p.url);
  if (r.type.startsWith("image/")) return { url: p.url, image: p.url, title: "", site: u.hostname, ok: true };
  const img = decode(meta(r.text, "og:image") || meta(r.text, "twitter:image") || meta(r.text, "og:image:url"));
  const title = decode(meta(r.text, "og:title") || (r.text.match(/<title[^>]*>([^<]{1,200})/i) ?? [])[1] || "").trim();
  const abs = img ? new URL(img, r.final || p.url).toString() : "";
  return { url: p.url, image: /^https:\/\//.test(abs) ? abs : "", title: title.slice(0, 200), site: decode(meta(r.text, "og:site_name")) || u.hostname.replace(/^www\./, ""), ok: !!abs };
}
