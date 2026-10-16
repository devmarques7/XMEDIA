"use client";

// Desfazer (Ctrl+Z) e histórico de versões em toda a app. Envolve os stores (clientes, conteúdos, definições, invoices,
// propostas, serviços): antes de cada gravação/apagar guarda o estado anterior — numa pilha de desfazer (por separador)
// e na tabela entity_versions (histórico para restaurar). Gravações seguidas do mesmo item (autosave) contam como uma.
import { binExpired, type ContentPost, type Customer, type PortalSettings } from "./customer";
import { customerStore } from "./customerStore";
import type { Invoice } from "./invoice";
import { invoiceStore } from "./invoiceStore";
import type { Proposal } from "./proposal";
import { proposalStore } from "./proposalStore";
import type { Service } from "./services";
import { serviceStore } from "./serviceStore";
import { supabase, supabaseEnabled } from "./supabase/client";

export type Entity = "customer" | "post" | "invoice" | "proposal" | "service" | "settings";
type Op = "create" | "update" | "delete" | "restore";
type Snap = Record<string, unknown> & { id?: string };
export type Change = { entity: Entity; id: string; op: Op; label: string; before: Snap | null; after: Snap | null; at: number };
export type Version = { id: string; entity: Entity; entity_id: string; op: Op; label: string; snapshot: Snap | null; by_email: string; created_at: string; customer_id?: string | null };

const LS_UNDO = "xmedia:undo";
const MAX = 50;
const BURST_MS = 15_000; // gravações do mesmo item dentro deste tempo = uma alteração (autosave)

// ---------- estado ----------
const cache = new Map<string, Snap>(); // último estado conhecido de cada item ("entity:id")
let undo: Change[] = [];
let redo: Change[] = [];
let quiet = 0; // > 0 enquanto se desfaz/refaz (não regista)
const listeners = new Set<() => void>();
const key = (e: Entity, id: string) => `${e}:${id}`;
const clone = <T,>(x: T): T => (x == null ? x : JSON.parse(JSON.stringify(x)));

function persist() {
  try {
    sessionStorage.setItem(LS_UNDO, JSON.stringify({ undo: undo.slice(-MAX), redo: redo.slice(-MAX) }));
  } catch {}
  listeners.forEach((l) => l());
}
function restoreStacks() {
  try {
    const j = JSON.parse(sessionStorage.getItem(LS_UNDO) || "{}") as { undo?: Change[]; redo?: Change[] };
    undo = j.undo ?? [];
    redo = j.redo ?? [];
  } catch {}
}

const remember = (e: Entity, x: Snap | null | undefined) => {
  if (x?.id) cache.set(key(e, x.id), clone(x));
};

function labelOf(e: Entity, x: Snap | null): string {
  if (!x) return "";
  if (e === "customer") return String(x.name ?? "");
  if (e === "post") return String(x.title || x.type || "");
  if (e === "invoice") return `${x.number ?? ""}${(x.client as { name?: string })?.name ? ` · ${(x.client as { name?: string }).name}` : ""}`;
  if (e === "proposal") return String(x.title ?? "");
  if (e === "service") return String(x.name ?? "");
  return "Definições";
}

// ---------- versões (Supabase) ----------
let me = "";
let versionsOk: boolean | null = null;
async function saveVersion(c: Change) {
  if (!supabaseEnabled || versionsOk === false) return;
  try {
    if (!me) me = ((await supabase().auth.getUser()).data.user?.email ?? "").toLowerCase();
    const { error } = await supabase().from("entity_versions").insert({ entity: c.entity, entity_id: c.id, op: c.op, label: c.label.slice(0, 200), snapshot: c.before, by_email: me });
    if (error) versionsOk = /relation|does not exist|schema cache/i.test(error.message) ? false : versionsOk;
    else versionsOk = true;
  } catch {}
}

/** Regista uma alteração (chamado pelos stores envolvidos). */
function record(entity: Entity, id: string, op: Op, before: Snap | null, after: Snap | null) {
  if (quiet || !id) return;
  const label = labelOf(entity, after ?? before);
  const top = undo.at(-1);
  // autosave: junta à alteração anterior do mesmo item (mantém o "antes" original)
  if (top && top.entity === entity && top.id === id && op === "update" && top.op !== "delete" && Date.now() - top.at < BURST_MS) {
    top.after = clone(after);
    top.at = Date.now();
    top.label = label || top.label;
  } else {
    const c: Change = { entity, id, op, label, before: clone(before), after: clone(after), at: Date.now() };
    undo.push(c);
    if (undo.length > MAX) undo = undo.slice(-MAX);
    void saveVersion(c);
  }
  redo = [];
  persist();
}

// ---------- adaptadores por tipo ----------
type Adapter = { put: (x: Snap) => Promise<unknown>; del: (id: string) => Promise<unknown> };
const adapters: Record<Entity, Adapter> = {
  customer: { put: (x) => customerStore.save(x as unknown as Customer), del: (id) => customerStore.remove(id) },
  post: { put: (x) => customerStore.savePost(x as unknown as ContentPost), del: (id) => customerStore.removePost(id) },
  settings: { put: (x) => customerStore.saveSettings(x as unknown as PortalSettings), del: async () => {} },
  invoice: { put: (x) => invoiceStore.save(x as unknown as Invoice), del: (id) => invoiceStore.remove(id) },
  proposal: { put: (x) => proposalStore.save(x as unknown as Proposal), del: (id) => proposalStore.remove(id) },
  service: { put: (x) => serviceStore.saveService(x as unknown as Service), del: (id) => serviceStore.removeService(id) },
};

/** Põe um item num estado (null = apagado), sem registar como alteração nova. */
async function apply(entity: Entity, id: string, state: Snap | null) {
  quiet++;
  try {
    const { created_at: _c, updated_at: _u, ...rest } = (state ?? {}) as Snap;
    if (state) await adapters[entity].put(rest as Snap);
    else await adapters[entity].del(id);
    remember(entity, state);
  } finally {
    quiet--;
  }
}

// ---------- envolver os stores (uma vez) ----------
let wrapped = false;
export function installJournal() {
  if (wrapped || typeof window === "undefined") return;
  wrapped = true;
  restoreStacks();
  const cs = customerStore as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const wrapRead = (obj: Record<string, (...a: unknown[]) => Promise<unknown>>, m: string, e: Entity) => {
    const orig = obj[m].bind(obj);
    obj[m] = async (...a: unknown[]) => {
      const r = await orig(...a);
      if (Array.isArray(r)) r.forEach((x) => remember(e, x as Snap));
      else remember(e, r as Snap);
      return r;
    };
  };
  const wrapSave = (obj: Record<string, (...a: unknown[]) => Promise<unknown>>, m: string, e: Entity, fetchPrev?: (x: Snap) => Promise<Snap | null>) => {
    const orig = obj[m].bind(obj);
    obj[m] = async (...a: unknown[]) => {
      const x = (a[0] ?? {}) as Snap;
      const id = String(x.id ?? (e === "settings" ? "settings" : ""));
      let before = cache.get(key(e, id)) ?? null;
      if (!before && fetchPrev && !quiet) before = await fetchPrev(x).catch(() => null);
      const r = (await orig(...a)) as Snap;
      const after = (r && typeof r === "object" ? r : x) as Snap;
      record(e, id, before ? (e === "post" && after.deleted_at && !before.deleted_at ? "delete" : "update") : "create", before, after);
      remember(e, e === "settings" ? { ...after, id: "settings" } : after);
      return r;
    };
  };
  const wrapRemove = (obj: Record<string, (...a: unknown[]) => Promise<unknown>>, m: string, e: Entity, fetchPrev?: (id: string) => Promise<Snap | null>) => {
    const orig = obj[m].bind(obj);
    obj[m] = async (...a: unknown[]) => {
      const id = String(a[0] ?? "");
      const before = cache.get(key(e, id)) ?? (fetchPrev ? await fetchPrev(id).catch(() => null) : null);
      const r = await orig(...a);
      // o lixo apaga sozinho os itens expirados: isso não é uma alteração do utilizador
      if (!(e === "post" && before && binExpired(before as unknown as ContentPost))) record(e, id, "delete", before, null);
      cache.delete(key(e, id));
      return r;
    };
  };

  wrapRead(cs, "list", "customer");
  wrapRead(cs, "get", "customer");
  wrapRead(cs, "posts", "post");
  wrapRead(cs, "bin", "post");
  wrapSave(cs, "save", "customer", (x) => customerStore.get(String(x.id)) as Promise<Snap | null>);
  wrapRemove(cs, "remove", "customer", (id) => customerStore.get(id) as Promise<Snap | null>);
  wrapSave(cs, "savePost", "post", async (x) => ((await customerStore.posts(String(x.customer_id))) as unknown as Snap[]).find((p) => p.id === x.id) ?? null);
  wrapRemove(cs, "removePost", "post");
  const origSettings = cs.settings.bind(cs);
  cs.settings = async () => {
    const r = (await origSettings()) as Snap;
    cache.set(key("settings", "settings"), clone({ ...r, id: "settings" }));
    return r;
  };
  wrapSave(cs, "saveSettings", "settings", async () => ({ ...((await origSettings()) as Snap), id: "settings" }));

  const inv = invoiceStore as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  wrapRead(inv, "list", "invoice");
  wrapRead(inv, "get", "invoice");
  wrapSave(inv, "save", "invoice", (x) => invoiceStore.get(String(x.id)) as Promise<Snap | null>);
  wrapRemove(inv, "remove", "invoice", (id) => invoiceStore.get(id) as Promise<Snap | null>);

  const pr = proposalStore as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  wrapRead(pr, "list", "proposal");
  wrapRead(pr, "get", "proposal");
  wrapSave(pr, "save", "proposal", (x) => proposalStore.get(String(x.id)) as Promise<Snap | null>);
  wrapRemove(pr, "remove", "proposal", (id) => proposalStore.get(id) as Promise<Snap | null>);

  const sv = serviceStore as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const origLoad = sv.load.bind(sv);
  sv.load = async (...a: unknown[]) => {
    const r = (await origLoad(...a)) as { services?: Snap[] };
    r?.services?.forEach((x) => remember("service", x));
    return r;
  };
  wrapSave(sv, "saveService", "service");
  wrapRemove(sv, "removeService", "service");
}

// ---------- API pública ----------
export const journal = {
  canUndo: () => undo.length > 0,
  canRedo: () => redo.length > 0,
  last: () => undo.at(-1) ?? null,
  next: () => redo.at(-1) ?? null,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Desfaz a última alteração (volta ao estado anterior). Devolve a alteração desfeita. */
  async undo(): Promise<Change | null> {
    const c = undo.pop();
    if (!c) return null;
    persist();
    try {
      await apply(c.entity, c.id, c.before);
      redo.push(c);
      void saveVersion({ ...c, op: "restore", before: c.after, label: c.label });
    } catch (e) {
      undo.push(c);
      throw e;
    } finally {
      persist();
    }
    return c;
  },
  async redo(): Promise<Change | null> {
    const c = redo.pop();
    if (!c) return null;
    persist();
    try {
      await apply(c.entity, c.id, c.after);
      undo.push({ ...c, at: 0 }); // at=0: não junta com a próxima gravação
    } catch (e) {
      redo.push(c);
      throw e;
    } finally {
      persist();
    }
    return c;
  },
  /** Versões guardadas de um item (mais recentes primeiro). */
  async versions(entity: Entity, id: string): Promise<Version[]> {
    if (!supabaseEnabled) return [];
    const { data, error } = await supabase().from("entity_versions").select("*").eq("entity", entity).eq("entity_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []) as Version[];
  },
  /** Últimas alterações de toda a app (página Histórico). */
  async recent(limit = 200): Promise<Version[]> {
    if (!supabaseEnabled) return [];
    const { data, error } = await supabase().from("entity_versions").select("id, entity, entity_id, op, label, by_email, created_at, customer_id:snapshot->>customer_id").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as Version[];
  },
  async version(id: string): Promise<Version | null> {
    const { data } = await supabase().from("entity_versions").select("*").eq("id", id).maybeSingle();
    return (data as Version) ?? null;
  },
  /** Restaura um item para uma versão guardada (a versão atual fica guardada também, para poder voltar). */
  async restore(v: Version) {
    const current = cache.get(key(v.entity, v.entity_id)) ?? null;
    await apply(v.entity, v.entity_id, v.snapshot);
    const c: Change = { entity: v.entity, id: v.entity_id, op: "restore", label: v.label, before: current, after: v.snapshot, at: 0 };
    undo.push(c);
    redo = [];
    persist();
    void saveVersion(c);
  },
  versionsAvailable: () => versionsOk,
};
