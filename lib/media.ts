"use client";

// Vídeos e imagens das propostas.
// Com Supabase: Storage (bucket "proposal-media", URL pública) — funciona nos links partilhados.
// Modo local: IndexedDB deste browser ("idb:<id>") — só se vê neste navegador.
import { useEffect, useState } from "react";
import type { Media } from "./proposal";
import { supabase, supabaseEnabled } from "./supabase/client";
import { muxSrc } from "./mux";

const DB = "xmedia-media";
const STORE = "files";

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function idbPut(id: string, file: Blob) {
  const d = await db();
  await new Promise<void>((res, rej) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function idbGet(id: string): Promise<Blob | null> {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction(STORE).objectStore(STORE).get(id);
    r.onsuccess = () => res((r.result as Blob) ?? null);
    r.onerror = () => rej(r.error);
  });
}

export const MAX_UPLOAD_MB = 500;

export type UploadProgress = { loaded: number; total: number; phase?: "optimize" };

// ---------- envio rápido para o Supabase Storage ----------
// • Host direto de storage (<ref>.storage.supabase.co): evita o gateway da API, recomendado pelo Supabase para ficheiros grandes.
// • Ficheiros > 6 MB: protocolo TUS em blocos de 6 MB — cada bloco tenta de novo sozinho se a rede falhar (não recomeça do zero).
// • Imagens grandes: reduzidas no browser antes de sair (máx. 2880 px, JPEG/WebP) — 5–10× menos bytes, sem perda visível no Instagram.
// • Cache de 1 ano no CDN: o vídeo abre depressa para quem o vê (o nome é único, nunca muda).
const CHUNK = 6 * 1024 * 1024;
const BUCKET = "proposal-media";
const CACHE = "31536000";
const directHost = (base: string) => base.replace(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/, "https://$1.storage.supabase.co");
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

function xhr(method: string, url: string, headers: Record<string, string>, body: Blob | null, onSent?: (n: number) => void): Promise<XMLHttpRequest> {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    if (onSent) x.upload.onprogress = (e) => onSent(e.loaded);
    x.onload = () => res(x);
    x.onerror = () => rej(new Error("upload_network"));
    x.send(body);
  });
}

/** Envio num só pedido (ficheiros pequenos, ou se o TUS não estiver disponível). */
async function simpleUpload(host: string, path: string, file: Blob, contentType: string, auth: Record<string, string>, onProgress?: (p: UploadProgress) => void) {
  const x = await xhr("POST", `${host}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, { ...auth, "Content-Type": contentType, "x-upsert": "false", "cache-control": `max-age=${CACHE}` }, file, (n) => onProgress?.({ loaded: n, total: file.size }));
  if (x.status === 413 || /EntityTooLarge|"413"/.test(x.responseText)) throw new Error("too_large"); // limite do plano/bucket do Supabase
  if (x.status < 200 || x.status >= 300) throw new Error(`upload_${x.status}: ${x.responseText.slice(0, 160)}`);
}

/** TUS (resumable): cria o envio e manda blocos de 6 MB, com 3 tentativas por bloco. */
async function tusUpload(host: string, path: string, file: Blob, contentType: string, auth: Record<string, string>, onProgress?: (p: UploadProgress) => void) {
  const meta = [["bucketName", BUCKET], ["objectName", path], ["contentType", contentType], ["cacheControl", CACHE]].map(([k, v]) => `${k} ${b64(v)}`).join(",");
  const created = await xhr("POST", `${host}/storage/v1/upload/resumable`, { ...auth, "Tus-Resumable": "1.0.0", "Upload-Length": String(file.size), "Upload-Metadata": meta, "x-upsert": "false" }, null);
  const loc = created.getResponseHeader("Location");
  if (created.status !== 201 || !loc) throw new Error(`tus_${created.status}`);
  const url = new URL(loc, host).toString();
  let offset = 0;
  while (offset < file.size) {
    const part = file.slice(offset, Math.min(offset + CHUNK, file.size));
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await xhr("PATCH", url, { ...auth, "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, part, (n) => onProgress?.({ loaded: offset + n, total: file.size }));
        if (r.status !== 204) throw new Error(`tus_${r.status}: ${r.responseText.slice(0, 120)}`);
        offset = Number(r.getResponseHeader("Upload-Offset") ?? offset + part.size);
        break;
      } catch (e) {
        if (attempt >= 2) throw e;
        await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)));
        // pergunta ao servidor onde ficou (o bloco pode ter chegado em parte)
        const h = await xhr("HEAD", url, { ...auth, "Tus-Resumable": "1.0.0" }, null).catch(() => null);
        const at = Number(h?.getResponseHeader("Upload-Offset"));
        if (Number.isFinite(at) && at > offset) {
          offset = at; // o servidor já tem parte do bloco: retoma daí
          break;
        }
      }
    }
  }
}

/** Reduz fotos grandes no browser (mantém o original se não for mais leve ou se o browser não as conseguir ler). */
export async function shrinkImage(file: File, maxSide = 2880): Promise<File> {
  if (file.size < 1.5 * 1024 * 1024 || !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || typeof createImageBitmap === "undefined") return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const alpha = file.type === "image/png" || file.type === "image/webp";
    const type = alpha ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.9));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, alpha ? ".webp" : ".jpg"), { type });
  } catch {
    return file;
  }
}

// ---------- destino dos vídeos e ficheiros grandes ----------
// 1) Cloudflare R2 (grátis até 10 GB, sem custos de saída, até 50 GB por ficheiro, partes em paralelo)
// 2) Mux (streaming adaptativo até 4K; pago depois de 10 vídeos)  3) Supabase Storage (plano Free: 50 MB por ficheiro)
let cfg: Promise<{ r2: boolean; mux: boolean }> | null = null;
/** O que está configurado na Vercel (pergunta uma vez por sessão). */
export const mediaConfig = () =>
  (cfg ??= fetch("/api/media/r2")
    .then((r) => (r.ok ? r.json() : { r2: false, mux: false }))
    .then((j) => ({ r2: !!j.r2, mux: !!j.mux }))
    .catch(() => ({ r2: false, mux: false })));
const BIG = 45 * 1024 * 1024;
const SUPABASE_SAFE = 49 * 1024 * 1024; // limite do Supabase Free: 50 MB por ficheiro
const SUPABASE_TARGET = 44 * 1024 * 1024; // alvo da otimização (margem para o contentor MP4)

async function r2Api<T>(body: unknown): Promise<T> {
  const r = await fetch("/api/media/r2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `r2_${r.status}`);
  return j as T;
}

/** Envio em partes de 32 MB, 4 em paralelo, diretamente para o R2; cada parte tenta 3 vezes (renova o URL se preciso). */
async function r2Upload(file: File, folder: string, contentType: string, onProgress?: (p: UploadProgress) => void): Promise<string> {
  const { key, uploadId, partSize, urls } = await r2Api<{ key: string; uploadId: string; partSize: number; urls: string[] }>({ action: "create", name: file.name, type: contentType, size: file.size, folder });
  const sent = new Array(urls.length).fill(0);
  const report = () => onProgress?.({ loaded: sent.reduce((a, n) => a + n, 0), total: file.size });
  const etags: { n: number; etag: string }[] = [];
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      const part = file.slice(i * partSize, Math.min((i + 1) * partSize, file.size));
      let url = urls[i];
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await xhr("PUT", url, {}, part, (n) => ((sent[i] = n), report()));
          if (r.status === 403 && attempt < 2) {
            url = (await r2Api<{ url: string }>({ action: "sign", key, uploadId, n: i + 1 })).url; // URL expirado
            throw new Error("r2_resign");
          }
          if (r.status < 200 || r.status >= 300) throw new Error(`r2_put_${r.status}`);
          const etag = r.getResponseHeader("ETag");
          if (!etag) throw new Error("r2_cors_etag"); // o CORS do bucket tem de expor o ETag
          etags.push({ n: i + 1, etag });
          sent[i] = part.size;
          report();
          break;
        } catch (e) {
          sent[i] = 0;
          if (attempt >= 2 || (e as Error).message === "r2_cors_etag") throw e;
          await new Promise((ok) => setTimeout(ok, 1000 * (attempt + 1)));
        }
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(4, urls.length) }, worker));
    return (await r2Api<{ url: string }>({ action: "complete", key, uploadId, parts: etags })).url;
  } catch (e) {
    r2Api({ action: "abort", key, uploadId }).catch(() => null);
    throw e;
  }
}

const MUX_CHUNK = 32 * 1024 * 1024; // múltiplo de 256 KiB, como o Mux exige

async function muxUpload(file: File, folder: string, onProgress?: (p: UploadProgress) => void): Promise<string> {
  const cr = await fetch("/api/media/mux", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder }) });
  const up = await cr.json().catch(() => ({}));
  if (!cr.ok || !up.url) throw new Error(up.error || `mux_${cr.status}`);
  // envio em partes: 308 = continua, 200/201 = terminado; cada parte tenta 3 vezes
  for (let start = 0; start < file.size; ) {
    const end = Math.min(start + MUX_CHUNK, file.size);
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await xhr("PUT", up.url, { "Content-Range": `bytes ${start}-${end - 1}/${file.size}` }, file.slice(start, end), (n) => onProgress?.({ loaded: start + n, total: file.size }));
        if (r.status !== 308 && (r.status < 200 || r.status >= 300)) throw new Error(`mux_put_${r.status}`);
        break;
      } catch (e) {
        if (attempt >= 2) throw e;
        await new Promise((ok) => setTimeout(ok, 1000 * (attempt + 1)));
      }
    }
    start = end;
  }
  onProgress?.({ loaded: file.size, total: file.size });
  // o Mux cria o vídeo; espera que fique pronto a tocar (até 3 min — depois o leitor continua a tentar sozinho)
  const t0 = Date.now();
  let playback = "";
  while (Date.now() - t0 < 180_000) {
    const r = await fetch(`/api/media/mux?upload=${encodeURIComponent(up.id)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `mux_${r.status}`);
    if (j.playback_id) playback = j.playback_id;
    if (playback && j.status === "ready") break;
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  if (!playback) throw new Error("mux_processing_timeout");
  return muxSrc(playback);
}

/**
 * Carrega um ficheiro (vídeos: Mux quando configurado; resto: Supabase Storage; modo local: IndexedDB). Com `onProgress` reporta os bytes enviados
 * para a barra com % e tempo restante.
 */
export async function uploadMedia(input: File, proposalId: string, onProgress?: (p: UploadProgress) => void): Promise<Media> {
  const kind: Media["kind"] = input.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|avi|mkv|mts|m2ts|3gp)$/i.test(input.name) ? "video" : "image";
  if (supabaseEnabled && (kind === "video" || input.size > BIG)) {
    const c = await mediaConfig();
    const type = input.type || (kind === "video" ? (/\.mov$/i.test(input.name) ? "video/quicktime" : "video/mp4") : "application/octet-stream");
    if (c.r2) return { src: await r2Upload(input, proposalId, type, onProgress), kind, caption: input.name };
    if (kind === "video" && c.mux) return { src: await muxUpload(input, proposalId, onProgress), kind, caption: input.name };
  }
  if (input.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`Ficheiro acima de ${MAX_UPLOAD_MB} MB.`);
  let file = kind === "image" ? await shrinkImage(input) : input;
  // sem armazenamento para ficheiros grandes: o Supabase Free aceita 50 MB → otimiza o vídeo no browser para caber
  if (supabaseEnabled && kind === "video" && file.size > SUPABASE_SAFE) {
    const { optimizeVideo } = await import("./videoOptimize");
    const r = await optimizeVideo(file, SUPABASE_TARGET, (p) => onProgress?.({ loaded: Math.round(p * 1000), total: 1000, phase: "optimize" }));
    if ("error" in r) throw new Error(r.error === "too_long" ? "too_long_free" : "too_large");
    file = r.file;
    if (file.size > SUPABASE_SAFE) throw new Error("too_large");
  }
  const contentType = file.type || (kind === "video" ? (/\.mov$/i.test(file.name) ? "video/quicktime" : "video/mp4") : "image/jpeg");
  if (supabaseEnabled) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${proposalId}/${crypto.randomUUID()}.${ext}`;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const { data: sess } = await supabase().auth.getSession();
    const auth = { Authorization: `Bearer ${sess.session?.access_token ?? anon}`, apikey: anon };
    const host = directHost(base);
    if (file.size > CHUNK) {
      try {
        await tusUpload(host, path, file, contentType, auth, onProgress);
      } catch {
        // TUS indisponível ou interrompido de vez: envia tudo num só pedido pelo endereço normal (o método anterior)
        await simpleUpload(base, path, file, contentType, auth, onProgress);
      }
    } else {
      await simpleUpload(host, path, file, contentType, auth, onProgress).catch((e) => {
        if ((e as Error).message === "too_large") throw e;
        return simpleUpload(base, path, file, contentType, auth, onProgress);
      });
    }
    onProgress?.({ loaded: file.size, total: file.size });
    const { data } = supabase().storage.from(BUCKET).getPublicUrl(path);
    return { src: data.publicUrl, kind, caption: input.name };
  }
  // modo local: guarda no IndexedDB (progresso simulado em passos para o ecrã acompanhar)
  onProgress?.({ loaded: Math.round(file.size * 0.3), total: file.size });
  const id = crypto.randomUUID();
  await idbPut(id, file);
  onProgress?.({ loaded: file.size, total: file.size });
  return { src: `idb:${id}`, kind, caption: input.name };
}

/** Vários ficheiros em paralelo (3 de cada vez), pela ordem original; `onProgress(i)` dá o callback de cada um. */
export async function uploadAll(files: File[], folder: string, onProgress?: (i: number) => (p: UploadProgress) => void, parallel = 3): Promise<Media[]> {
  const out: Media[] = new Array(files.length);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      out[i] = await uploadMedia(files[i], folder, onProgress?.(i));
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, files.length) }, worker));
  return out;
}

const cache = new Map<string, string>();
/** "pending:<job>/<i>" → pré-visualização local enquanto o ficheiro sobe em segundo plano (ver uploadQueue). */
export const pendingPreviews = new Map<string, string>();

/** Resolve "idb:<id>" para um object URL; outras fontes passam tal como estão. */
export function useMediaSrc(src: string | undefined) {
  const [url, setUrl] = useState<string | null>(src?.startsWith("pending:") ? pendingPreviews.get(src) ?? null : src && !src.startsWith("idb:") ? src : cache.get(src ?? "") ?? null);
  useEffect(() => {
    if (!src) return setUrl(null);
    if (src.startsWith("pending:")) return setUrl(pendingPreviews.get(src) ?? null); // ainda a subir (noutro browser: sem imagem)
    if (!src.startsWith("idb:")) return setUrl(src);
    if (cache.has(src)) return setUrl(cache.get(src)!);
    let alive = true;
    idbGet(src.slice(4))
      .then((b) => {
        if (!b || !alive) return;
        const u = URL.createObjectURL(b);
        cache.set(src, u);
        setUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);
  return url;
}

/** URL utilizável para um src (idb:… → object URL em cache; o resto igual). */
export async function resolveMedia(src: string): Promise<string> {
  if (!src.startsWith("idb:")) return src;
  if (cache.has(src)) return cache.get(src)!;
  const b = await idbGet(src.slice(4));
  if (!b) throw new Error("file_missing");
  const u = URL.createObjectURL(b);
  cache.set(src, u);
  return u;
}
