"use client";

// Fixados (botão direito → Fixar) e recentes (abertos há menos tempo), por tipo de item, guardados neste browser.
import { useSyncExternalStore } from "react";

type Kind = "customer";
const LS = (k: string) => `xmedia:${k}`;
const listeners = new Set<() => void>();
const memo = new Map<string, { raw: string; v: unknown }>();

function read<T>(key: string, d: T): T {
  try {
    const raw = localStorage.getItem(LS(key)) ?? "";
    const hit = memo.get(key);
    if (hit && hit.raw === raw) return hit.v as T; // mesma referência (useSyncExternalStore)
    const v = raw ? (JSON.parse(raw) as T) : d;
    memo.set(key, { raw, v });
    return v;
  } catch {
    return d;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(LS(key), JSON.stringify(v));
  } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
const EMPTY: string[] = [];
const EMPTY_R: Record<string, number> = {};

export const pins = {
  list: (kind: Kind) => read<string[]>(`pins:${kind}`, EMPTY),
  toggle(kind: Kind, id: string) {
    const l = pins.list(kind);
    write(`pins:${kind}`, l.includes(id) ? l.filter((x) => x !== id) : [...l, id]);
  },
  /** Regista que o item foi aberto agora (para "recentes"). */
  touch(kind: Kind, id: string) {
    const r = { ...read<Record<string, number>>(`recent:${kind}`, EMPTY_R), [id]: Date.now() };
    const top = Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, 50);
    write(`recent:${kind}`, Object.fromEntries(top));
  },
  recent: (kind: Kind) => read<Record<string, number>>(`recent:${kind}`, EMPTY_R),
};

export function usePins(kind: Kind) {
  return useSyncExternalStore(subscribe, () => pins.list(kind), () => EMPTY);
}
export function useRecent(kind: Kind) {
  return useSyncExternalStore(subscribe, () => pins.recent(kind), () => EMPTY_R);
}

/** Ordem da lista: fixados primeiro, depois os abertos há menos tempo, depois os restantes (ordem original). */
export function pinnedFirst<T extends { id: string }>(items: T[], pinned: string[], recent: Record<string, number>) {
  const idx = new Map(items.map((x, i) => [x.id, i]));
  const score = (x: T) => (pinned.includes(x.id) ? 2e15 - pinned.indexOf(x.id) : recent[x.id] ?? 0);
  return [...items].sort((a, b) => score(b) - score(a) || idx.get(a.id)! - idx.get(b.id)!);
}
