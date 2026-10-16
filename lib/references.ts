// Canal de referências: links de Instagram, YouTube, TikTok, Pinterest, Vimeo (ou qualquer site) agrupados por tema,
// com o endereço de embed para ver o conteúdo dentro da plataforma. Funções puras (references.test.ts).

export type Platform = "instagram" | "youtube" | "tiktok" | "pinterest" | "vimeo" | "web";
export type RefItem = { id: string; url: string; platform: Platform; group: string; title: string; note: string; thumb: string; by: string; at: string; updated: string; deleted?: boolean };
export type RefGroup = { id: string; name: string; updated: string; deleted?: boolean };
export type References = { groups: RefGroup[]; items: RefItem[] };

export const EMPTY_REFS: References = { groups: [], items: [] };

/** Plataforma, id e endereço de embed de um link (null se não for https). */
export function parseRef(raw: string): { url: string; platform: Platform; id: string; embed: string; thumb: string; vertical: boolean } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const url = u.toString();
  // YouTube: watch?v=, youtu.be/, /shorts/, /embed/
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : u.searchParams.get("v") || (u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/) ?? [])[1] || "";
    if (/^[\w-]{6,}$/.test(id)) return { url, platform: "youtube", id, embed: `https://www.youtube.com/embed/${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, vertical: u.pathname.startsWith("/shorts") };
  }
  if (host.endsWith("tiktok.com")) {
    const id = (u.pathname.match(/\/video\/(\d+)/) ?? [])[1];
    if (id) return { url, platform: "tiktok", id, embed: `https://www.tiktok.com/embed/v2/${id}`, thumb: "", vertical: true };
    return { url, platform: "tiktok", id: "", embed: "", thumb: "", vertical: true };
  }
  if (host.endsWith("instagram.com")) {
    const m = u.pathname.match(/\/(p|reel|reels|tv)\/([\w-]+)/);
    if (m) {
      const kind = m[1] === "reels" ? "reel" : m[1];
      return { url, platform: "instagram", id: m[2], embed: `https://www.instagram.com/${kind}/${m[2]}/embed/`, thumb: "", vertical: true };
    }
    return { url, platform: "instagram", id: "", embed: "", thumb: "", vertical: true };
  }
  if (host.includes("pinterest.") || host === "pin.it") {
    const id = (u.pathname.match(/\/pin\/(\d+)/) ?? [])[1];
    return { url, platform: "pinterest", id: id ?? "", embed: id ? `https://assets.pinterest.com/ext/embed.html?id=${id}` : "", thumb: "", vertical: true };
  }
  if (host.endsWith("vimeo.com")) {
    const id = (u.pathname.match(/\/(\d+)/) ?? [])[1];
    if (id) return { url, platform: "vimeo", id, embed: `https://player.vimeo.com/video/${id}`, thumb: "", vertical: false };
  }
  return { url, platform: "web", id: "", embed: "", thumb: "", vertical: false };
}

/** Imagem direta (jpg/png/gif/webp/avif)? */
export const isImageUrl = (s: string) => /^https?:\/\/\S+\.(jpe?g|png|gif|webp|avif)(\?\S*)?$/i.test(s.trim());

const newer = <T extends { id: string; updated: string }>(a: T[] = [], b: T[] = []) => {
  const m = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const cur = m.get(x.id);
    if (!cur || x.updated > cur.updated) m.set(x.id, x);
  }
  return [...m.values()];
};
/** Junta duas versões (cliente e estúdio editam): por id, fica a mais recente (apagados ficam marcados). */
export function mergeRefs(a?: References, b?: References): References {
  return { groups: newer(a?.groups, b?.groups), items: newer(a?.items, b?.items).sort((x, y) => y.at.localeCompare(x.at)) };
}

export function normalizeRefs(x: unknown): References {
  const o = (x ?? {}) as Partial<References>;
  const s = (v: unknown, n = 300) => String(v ?? "").slice(0, n);
  const now = new Date().toISOString();
  const groups = (Array.isArray(o.groups) ? o.groups : []).slice(0, 60).map((g) => ({ id: s(g?.id, 64), name: s(g?.name, 60).trim() || "—", updated: s(g?.updated || now, 40), ...(g?.deleted ? { deleted: true } : {}) })).filter((g) => g.id);
  const items = (Array.isArray(o.items) ? o.items : [])
    .slice(0, 600)
    .map((i) => {
      const p = parseRef(s(i?.url, 1000));
      return p ? { id: s(i?.id, 64), url: p.url, platform: p.platform, group: s(i?.group, 64), title: s(i?.title, 200), note: s(i?.note, 600), thumb: /^https:\/\//.test(s(i?.thumb, 1000)) ? s(i?.thumb, 1000) : p.thumb, by: s(i?.by, 80), at: s(i?.at || now, 40), updated: s(i?.updated || now, 40), ...(i?.deleted ? { deleted: true } : {}) } : null;
    })
    .filter((i): i is RefItem => !!i && !!i.id);
  return { groups, items };
}
