// Ajudas do browser para moodboards e referências: imagem → data URL reduzida (modo local) e pré-visualização de
// links sem servidor (só imagens diretas e YouTube; o resto mostra "imagem indisponível").
import { isImageUrl, parseRef } from "./references";

export type LinkPreview = { url: string; image: string; title: string; site: string; ok: boolean };

export async function fileToDataUrl(file: File, max = 1400): Promise<string> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * s), height: Math.round(img.height * s) });
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return file.type === "image/png" ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.82);
}

export async function localPreview(url: string): Promise<LinkPreview> {
  const p = parseRef(url);
  if (!p) return { url, image: "", title: "", site: "", ok: false };
  if (isImageUrl(p.url)) return { url: p.url, image: p.url, title: "", site: new URL(p.url).hostname, ok: true };
  if (p.thumb) return { url: p.url, image: p.thumb, title: p.platform, site: p.platform, ok: true };
  return { url: p.url, image: "", title: "", site: new URL(p.url).hostname, ok: false };
}
