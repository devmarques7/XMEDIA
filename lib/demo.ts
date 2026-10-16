// Dados de demonstração para a pré-visualização do portal (e testes): Instagram com métricas e conteúdos em todas
// as fases do processo. Capas geradas em SVG (sem imagens externas). Determinístico a partir de uma semente.
import { emptyPost, type ContentPost, type Instagram, type PostStatus, type PostType } from "./customer";

const rnd = (seed: number) => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Capa em SVG (degradê em tons de cinza com uma forma), como data URL. */
export function demoCover(i: number, label = "") {
  const g = [
    ["#2b2b2b", "#9a9a9a"],
    ["#444", "#d8d8d8"],
    ["#1d1d1d", "#6e6e6e"],
    ["#5a5a5a", "#e9e9e9"],
  ][i % 4];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><circle cx="${120 + (i * 53) % 180}" cy="${160 + (i * 71) % 200}" r="${70 + (i * 13) % 60}" fill="#fff" fill-opacity=".18"/><text x="24" y="472" font-family="monospace" font-size="22" fill="#fff" fill-opacity=".8">${label.replace(/[<&>]/g, "").slice(0, 22)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function demoInstagram(handle: string, name: string, opts: { followers?: number; reach?: number } = {}): Instagram {
  const r = rnd(hash(handle || name));
  const followers = opts.followers ?? Math.round(2000 + r() * 18000);
  const today = new Date();
  const history = Array.from({ length: 28 }, (_, i) => ({
    d: new Date(today.getTime() - (27 - i) * 86_400_000).toISOString().slice(0, 10),
    followers: Math.round(followers - (27 - i) * (followers * 0.0025) + r() * 20),
  }));
  const media = Array.from({ length: 12 }, (_, i) => {
    const ts = new Date(today.getTime() - (i * 4 + Math.round(r() * 3)) * 86_400_000);
    return {
      id: `demo-ig-${i}`,
      caption: `Demo ${i + 1}`,
      media_type: i % 3 === 0 ? "VIDEO" : i % 3 === 1 ? "CAROUSEL_ALBUM" : "IMAGE",
      product: i % 3 === 0 ? "REELS" : "FEED",
      url: demoCover(i, `${name} · ${i + 1}`),
      permalink: "",
      timestamp: ts.toISOString(),
      likes: Math.round(80 + r() * 600),
      comments: Math.round(4 + r() * 40),
      reach: Math.round(800 + r() * 9000),
    };
  });
  const reach = opts.reach ?? Math.round(followers * (1.4 + r()));
  return {
    handle: handle || name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    connected: true,
    username: handle,
    name,
    followers,
    follows: Math.round(300 + r() * 500),
    media_count: 120 + Math.round(r() * 300),
    synced_at: today.toISOString(),
    insights: { reach, views: Math.round(reach * 2.6), accounts_engaged: Math.round(reach * 0.08), total_interactions: Math.round(reach * 0.065), likes: Math.round(reach * 0.05), comments: Math.round(reach * 0.006), shares: Math.round(reach * 0.004), saves: Math.round(reach * 0.005) },
    history,
    media,
  };
}

/** Vídeo curto de domínio público (CC0, MDN) para os Reels de demonstração. */
export const DEMO_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const PLAN: [PostType, PostStatus, string, number, boolean?][] = [
  ["reel", "idea", "Bastidores do serviço", 9],
  ["carousel", "draft", "3 erros que encarecem o projeto", 6],
  ["reel", "draft", "Antes e depois — percepção", 7, true],
  ["reel", "review", "Reel de lançamento", 3],
  ["post", "review", "Retrato da equipa", 4],
  ["carousel", "approved", "Guia rápido de cuidados", 5],
  ["reel", "scheduled", "Depoimento do cliente", 2],
  ["story", "scheduled", "Contagem decrescente", 1],
  ["post", "published", "Novo espaço", -3],
  ["reel", "published", "Um dia connosco", -8],
];

/** Conteúdos de demonstração em todas as fases (datas à volta de hoje). */
export function demoPosts(customerId: string, today = new Date()): ContentPost[] {
  return PLAN.map(([type, status, title, days, changes], i) => {
    const at = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days, 10 + (i % 8), i % 2 ? 30 : 0).toISOString();
    const p = emptyPost(customerId, type);
    return {
      ...p,
      id: `${customerId.replace(/-/g, "").slice(0, 8).padEnd(8, "0")}-de00-4000-8000-${String(i).padStart(12, "0")}`, // uuid válido, marcado "de00"
      status,
      title,
      caption: `${title}\n\n#demo`,
      cover: demoCover(i, title),
      media:
        type === "reel"
          ? [{ src: DEMO_VIDEO, kind: "video" as const, caption: title }]
          : type === "carousel"
            ? [1, 2, 3, 4].map((n) => ({ src: demoCover(i + n, `${title} · ${n}/4`), kind: "image" as const, caption: `Slide ${n}` }))
            : [{ src: demoCover(i, title), kind: "image" as const, caption: title }],
      scheduled_at: status === "idea" ? "" : at,
      published_at: status === "published" ? at : "",
      round: status === "review" || changes ? 1 : 0,
      notes: changes
        ? [{ id: `n${i}`, by: "client" as const, author: "Cliente", text: "Podemos usar outra música?", media: 0, round: 1, done: false, at: today.toISOString(), updated: today.toISOString(), x: 0.4, y: 0.3 }]
        : [],
      feedback: changes ? [{ id: `f${i}`, at: today.toISOString(), by: "client" as const, text: "Pequenos ajustes", action: "changes" as const }] : [],
    };
  });
}

export const isDemoPost = (p: Pick<ContentPost, "id">) => /^[0-9a-f]{8}-de00-4000-8000-/.test(p.id);
