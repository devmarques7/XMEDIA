// Moodboards (estilo Milanote): quadro livre com imagens (carregadas, coladas ou por link — Pinterest e outras),
// links, notas coloridas e títulos, posicionados à mão. Guardados no cliente. Funções puras (moodboard.test.ts).

export type MoodKind = "image" | "link" | "note" | "heading";
export type NoteColor = "green" | "yellow" | "orange" | "grey" | "white";
export type MoodItem = { id: string; kind: MoodKind; x: number; y: number; w: number; src?: string; url?: string; title?: string; text?: string; color?: NoteColor; embed?: string; vertical?: boolean };
export type Moodboard = { id: string; title: string; items: MoodItem[]; updated: string; at: string; by: string; deleted?: boolean };

export const BOARD_W = 3000;
export const BOARD_H = 2000;
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function newBoard(title: string, by: string): Moodboard {
  const now = new Date().toISOString();
  return { id: uid(), title: title.trim().slice(0, 80) || "Moodboard", items: [], at: now, updated: now, by };
}

/** Próxima posição livre (grelha simples a partir do canto, para itens adicionados sem arrastar). */
export function nextSlot(items: MoodItem[], w = 220): { x: number; y: number } {
  const col = 270;
  for (let row = 0; row < 40; row++)
    for (let c = 0; c < 10; c++) {
      const x = 40 + c * col;
      const y = 40 + row * 260;
      if (!items.some((i) => Math.abs(i.x - x) < w * 0.6 && Math.abs(i.y - y) < 160)) return { x, y };
    }
  return { x: 40, y: 40 };
}

export function newItem(kind: MoodKind, items: MoodItem[], p: Partial<MoodItem> = {}): MoodItem {
  const w = kind === "heading" ? 320 : kind === "note" ? 220 : 240;
  return { id: uid(), kind, w, ...nextSlot(items, w), ...(kind === "note" ? { color: "green" as NoteColor } : {}), ...p };
}

const clampN = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
};
const COLORS: NoteColor[] = ["green", "yellow", "orange", "grey", "white"];
const safeSrc = (v: unknown) => {
  const s = String(v ?? "");
  return /^(https:\/\/|data:image\/|idb:)/.test(s) ? s.slice(0, 1_500_000) : "";
};

export function normalizeBoards(x: unknown): Moodboard[] {
  const now = new Date().toISOString();
  return (Array.isArray(x) ? x : []).slice(0, 50).map((b) => ({
    id: String(b?.id ?? uid()).slice(0, 64),
    title: String(b?.title ?? "Moodboard").slice(0, 80),
    at: String(b?.at ?? now),
    updated: String(b?.updated ?? now),
    by: String(b?.by ?? "").slice(0, 80),
    ...(b?.deleted ? { deleted: true } : {}),
    items: (Array.isArray(b?.items) ? b.items : []).slice(0, 300).map((i: Partial<MoodItem>) => ({
      id: String(i?.id ?? uid()).slice(0, 64),
      kind: (["image", "link", "note", "heading"].includes(i?.kind as string) ? i!.kind : "note") as MoodKind,
      x: clampN(i?.x, 0, BOARD_W - 80, 40),
      y: clampN(i?.y, 0, BOARD_H - 40, 40),
      w: clampN(i?.w, 120, 900, 240),
      ...(i?.src ? { src: safeSrc(i.src) } : {}),
      ...(i?.url && /^https?:\/\//.test(i.url) ? { url: String(i.url).slice(0, 1000) } : {}),
      ...(i?.title ? { title: String(i.title).slice(0, 200) } : {}),
      ...(i?.text ? { text: String(i.text).slice(0, 2000) } : {}),
      ...(i?.color && COLORS.includes(i.color) ? { color: i.color } : {}),
      ...(i?.embed && /^https:\/\//.test(i.embed) ? { embed: String(i.embed).slice(0, 500), ...(i.vertical ? { vertical: true } : {}) } : {}),
    })),
  }));
}

/** Junta (cliente e estúdio editam): por quadro, fica a versão mais recente. */
export function mergeBoards(a: Moodboard[] = [], b: Moodboard[] = []) {
  const m = new Map<string, Moodboard>();
  for (const x of [...a, ...b]) {
    const cur = m.get(x.id);
    if (!cur || x.updated > cur.updated) m.set(x.id, x);
  }
  return [...m.values()].sort((x, y) => y.updated.localeCompare(x.updated));
}
