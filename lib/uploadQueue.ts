"use client";

// Fila global de envios: os ficheiros continuam a subir em segundo plano enquanto o utilizador guarda, fecha o editor
// ou abre outros conteúdos. Enquanto sobe, o conteúdo guarda "pending:<job>/<i>" no lugar do ficheiro (com
// pré-visualização local neste browser); no fim, a fila troca pelo link definitivo — no conteúdo gravado e no editor
// aberto — e grava sozinha.
import { useSyncExternalStore } from "react";
import type { Media } from "./proposal";
import type { ContentPost } from "./customer";
import { pendingPreviews as previews, uploadMedia, type UploadProgress } from "./media";

export type UploadJob = {
  id: string;
  label: string;
  names: string[];
  sizes: number[];
  loaded: number[];
  at: number;
  phase?: "optimize";
  optimize?: number;
  status: "running" | "done" | "error";
  error?: string;
  postId?: string;
  customerId?: string;
};

const jobs = new Map<string, UploadJob>();
const listeners = new Set<() => void>();
let snapshot: UploadJob[] = [];
const emit = () => {
  snapshot = [...jobs.values()];
  listeners.forEach((l) => l());
};
const update = (id: string, patch: Partial<UploadJob>) => {
  const j = jobs.get(id);
  if (j) jobs.set(id, { ...j, ...patch });
  emit();
};

export const pendingSrc = (job: string, i: number) => `pending:${job}/${i}`;
export const isPending = (src: string | undefined) => !!src && src.startsWith("pending:");
/** Pré-visualização local de um ficheiro ainda a subir (só neste browser). */
export const previewOf = (src: string) => previews.get(src) ?? null;
export const hasPending = (p: Pick<ContentPost, "media" | "cover">) => isPending(p.cover) || p.media.some((m) => isPending(m.src));
/** "pending:" sem envio a correr neste browser (aba fechada/recarregada a meio): o ficheiro nunca vai chegar. */
export const isOrphanPending = (src: string | undefined) => isPending(src) && !previews.has(src!);
/** Retira os envios órfãos; devolve o mesmo objeto se não houver nenhum. */
export function dropOrphans<T extends Pick<ContentPost, "media" | "cover">>(p: T): T {
  if (!isOrphanPending(p.cover) && !p.media.some((m) => isOrphanPending(m.src))) return p;
  return { ...p, cover: isOrphanPending(p.cover) ? "" : p.cover, media: p.media.filter((m) => !isOrphanPending(m.src)) };
}

export function useUploadJobs() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => snapshot,
    () => snapshot
  );
}
export const runningCount = () => [...jobs.values()].filter((j) => j.status === "running").length;
export function dismissJob(id: string) {
  jobs.delete(id);
  emit();
}

export type UploadDone = { job: string; map: Record<string, Media>; postId?: string };
export type UploadFailed = { job: string; pending: string[]; error: string; postId?: string };
/** Troca os "pending:" deste envio pelos ficheiros definitivos. */
export function applyUploads<T extends Pick<ContentPost, "media" | "cover">>(p: T, map: Record<string, Media>): T {
  if (!Object.keys(map).length) return p;
  return { ...p, cover: map[p.cover]?.src ?? p.cover, media: p.media.map((m) => (map[m.src] ? { ...m, src: map[m.src].src, kind: map[m.src].kind } : m)) };
}
/** Retira os "pending:" de um envio que falhou. */
export function dropPending<T extends Pick<ContentPost, "media" | "cover">>(p: T, pending: string[]): T {
  const set = new Set(pending);
  return { ...p, cover: set.has(p.cover) ? "" : p.cover, media: p.media.filter((m) => !set.has(m.src)) };
}

/**
 * Começa um envio em segundo plano e devolve logo os "pending:" (com pré-visualização) para pôr no conteúdo.
 * Se `postId` for dado, no fim atualiza também o conteúdo gravado.
 */
export function startUpload(opts: { files: File[]; folder: string; label: string; kindOf: (f: File) => Media["kind"]; postId?: string; customerId?: string }) {
  const id = crypto.randomUUID().slice(0, 8);
  const temps: Media[] = opts.files.map((f, i) => {
    const src = pendingSrc(id, i);
    previews.set(src, URL.createObjectURL(f));
    return { src, kind: opts.kindOf(f), caption: f.name };
  });
  jobs.set(id, { id, label: opts.label, names: opts.files.map((f) => f.name), sizes: opts.files.map((f) => f.size), loaded: opts.files.map(() => 0), at: Date.now(), status: "running", postId: opts.postId, customerId: opts.customerId });
  emit();
  void run(id, opts.files, opts.folder);
  return { job: id, temps };
}

async function run(id: string, files: File[], folder: string) {
  const results: Media[] = new Array(files.length);
  let next = 0;
  const progress = (i: number) => (p: UploadProgress) => {
    const j = jobs.get(id);
    if (!j) return;
    if (p.phase === "optimize") return update(id, { phase: "optimize", optimize: p.loaded / (p.total || 1) });
    const sizes = [...j.sizes];
    const loaded = [...j.loaded];
    if (p.total) sizes[i] = p.total; // vídeos otimizados/fotos reduzidas: conta o que sai de facto
    loaded[i] = p.loaded;
    update(id, { sizes, loaded, phase: undefined, at: j.phase ? Date.now() : j.at });
  };
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      results[i] = await uploadMedia(files[i], folder, progress(i));
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
    const map: Record<string, Media> = Object.fromEntries(results.map((m, i) => [pendingSrc(id, i), m]));
    update(id, { status: "done", loaded: jobs.get(id)!.sizes });
    await persist(id, map);
    window.dispatchEvent(new CustomEvent<UploadDone>("xmedia:upload-done", { detail: { job: id, map, postId: jobs.get(id)?.postId } }));
    setTimeout(() => {
      if (jobs.get(id)?.status === "done") dismissJob(id);
    }, 8000);
  } catch (e) {
    const pending = files.map((_, i) => pendingSrc(id, i));
    update(id, { status: "error", error: (e as Error).message });
    await persistFailure(id, pending);
    window.dispatchEvent(new CustomEvent<UploadFailed>("xmedia:upload-failed", { detail: { job: id, pending, error: (e as Error).message, postId: jobs.get(id)?.postId } }));
  }
  // as pré-visualizações locais deixam de ser precisas pouco depois (o vídeo pode ainda estar a usá-las)
  setTimeout(() => files.forEach((_, i) => {
    const src = pendingSrc(id, i);
    const u = previews.get(src);
    if (u) URL.revokeObjectURL(u);
    previews.delete(src);
  }), 120_000);
}

/** Se o conteúdo já foi guardado com os "pending:", grava a versão com os ficheiros definitivos. */
async function persist(id: string, map: Record<string, Media>) {
  const j = jobs.get(id);
  if (!j?.postId || !j.customerId) return;
  const { customerStore } = await import("./customerStore");
  const p = (await customerStore.posts(j.customerId).catch(() => [] as ContentPost[])).find((x) => x.id === j.postId);
  if (p && hasPending(p)) {
    const next = applyUploads(p, map);
    if (next !== p) await customerStore.savePost(next).catch(() => null);
  }
}
async function persistFailure(id: string, pending: string[]) {
  const j = jobs.get(id);
  if (!j?.postId || !j.customerId) return;
  const { customerStore } = await import("./customerStore");
  const p = (await customerStore.posts(j.customerId).catch(() => [] as ContentPost[])).find((x) => x.id === j.postId);
  if (p && hasPending(p)) await customerStore.savePost(dropPending(p, pending)).catch(() => null);
}
