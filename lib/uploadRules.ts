// Regras únicas de importação (as mesmas do Instagram): o que cada destino aceita e quantos ficheiros.
// Usadas por todas as zonas de drag & drop (conteúdos, pré-visualização, moodboard, documentos, marca).
import type { Media } from "./proposal";

export type DropTarget = "reel" | "post" | "carousel" | "story" | "cover" | "coverOrVideo" | "moodboard" | "document" | "image" | "json" | "font" | "gallery" | "data";
type Kind = "image" | "video" | "pdf" | "json" | "font" | "csv";
type Rule = { kinds: Kind[]; max: number; replace?: boolean; accept: string };

export const UPLOAD_RULES: Record<DropTarget, Rule> = {
  reel: { kinds: ["video"], max: 1, replace: true, accept: "video/*" }, // um reel = um vídeo
  post: { kinds: ["image"], max: 1, replace: true, accept: "image/*" },
  story: { kinds: ["image", "video"], max: 1, replace: true, accept: "image/*,video/*" },
  carousel: { kinds: ["image", "video"], max: 10, accept: "image/*,video/*" }, // até 10, imagens e vídeos
  cover: { kinds: ["image"], max: 1, replace: true, accept: "image/*" },
  // área da capa no editor: imagem = capa, vídeo = o próprio conteúdo (reel/story)
  coverOrVideo: { kinds: ["image", "video"], max: 1, replace: true, accept: "image/*,video/*" },
  moodboard: { kinds: ["image"], max: 60, accept: "image/*" },
  document: { kinds: ["pdf", "image"], max: 20, accept: "application/pdf,image/*" },
  image: { kinds: ["image"], max: 12, accept: "image/*" },
  json: { kinds: ["json"], max: 1, replace: true, accept: ".json,application/json" },
  font: { kinds: ["font"], max: 4, accept: ".woff2,.woff,.otf,.ttf" },
  gallery: { kinds: ["image", "video"], max: 30, accept: "image/*,video/*" },
  data: { kinds: ["json", "csv"], max: 1, replace: true, accept: ".json,.csv,.ssv,.tsv,.txt" },
};

export function kindOf(f: File): Kind | null {
  const n = f.name.toLowerCase();
  if (f.type.startsWith("video/")) return "video";
  if (f.type.startsWith("image/")) return "image";
  // alguns navegadores não dão o tipo de .mov/.mkv/.heic…: usa a extensão
  if (/\.(mp4|mov|m4v|webm|avi|mkv|mts|m2ts|3gp)$/.test(n)) return "video";
  if (/\.(jpe?g|png|webp|gif|heic|heif|avif|tiff?)$/.test(n)) return "image";
  if (f.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (f.type.includes("json") || n.endsWith(".json")) return "json";
  if (/\.(woff2?|otf|ttf)$/.test(n)) return "font";
  if (/\.(csv|ssv|tsv|txt)$/.test(n) || f.type === "text/csv") return "csv";
  return null;
}

/** Separa os ficheiros aceites dos rejeitados, respeitando o tipo e o limite (contando o que já existe). */
export function checkFiles(target: DropTarget, files: File[], existing = 0): { ok: File[]; rejected: { file: File; reason: "type" | "limit" }[] } {
  const r = UPLOAD_RULES[target];
  const room = r.replace ? r.max : Math.max(0, r.max - existing);
  const ok: File[] = [];
  const rejected: { file: File; reason: "type" | "limit" }[] = [];
  for (const f of files) {
    const k = kindOf(f);
    if (!k || !r.kinds.includes(k)) rejected.push({ file: f, reason: "type" });
    else if (ok.length >= room) rejected.push({ file: f, reason: "limit" });
    else ok.push(f);
  }
  return { ok, rejected };
}

/** Junta media nova à lista do conteúdo seguindo a regra do tipo (reel/post substituem, carrossel acrescenta). */
export function mergeMedia(target: DropTarget, current: Media[], added: Media[]): Media[] {
  const r = UPLOAD_RULES[target];
  return (r.replace ? added : [...current, ...added]).slice(0, r.max);
}

/** Peso de uma fonte a partir do nome do ficheiro (BioGrotesk-Bold.woff2 → 700). */
export function fontWeightOf(name: string): number {
  const n = name.toLowerCase();
  if (/black|heavy/.test(n)) return 900;
  if (/extra-?bold/.test(n)) return 800;
  if (/semi-?bold|demi/.test(n)) return 600;
  if (/bold/.test(n)) return 700;
  if (/medium/.test(n)) return 500;
  if (/light/.test(n)) return 300;
  return 400;
}
