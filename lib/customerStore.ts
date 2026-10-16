"use client";

// Gravação de clientes, conteúdos e definições: Supabase (tabelas customers, customer_posts, app_settings)
// ou, em modo local, este navegador (localStorage) — partilhado com o portal local para testar o fluxo.
import { mergeTasks } from "./tasks";
import { mergeDocs } from "./documents";
import { mergeBoards } from "./moodboard";
import { mergeRefs } from "./references";
import { applyAssignRules, normalizeRules, type AssignRule } from "./assignRules";
import { binExpired, mergeNotes, normalizeCustomer, normalizePost, normalizeSettings, touchPhase, type ContentPost, type Customer, type PortalSettings } from "./customer";
import { supabase, supabaseEnabled } from "./supabase/client";

type CustomerStore = {
  list(): Promise<Customer[]>;
  get(id: string): Promise<Customer | null>;
  save(c: Customer): Promise<Customer>;
  remove(id: string): Promise<void>;
  /** Conteúdos ativos (sem os do lixo). */
  posts(customerId?: string): Promise<ContentPost[]>;
  savePost(p: ContentPost): Promise<ContentPost>;
  /** Apaga de vez (sem lixo). */
  removePost(id: string): Promise<void>;
  /** Lixo: conteúdos apagados há menos de 15 dias (os mais antigos são apagados de vez aqui). */
  bin(customerId?: string): Promise<ContentPost[]>;
  /** Mover para o lixo / restaurar. */
  trashPost(p: ContentPost): Promise<ContentPost>;
  restorePost(p: ContentPost): Promise<ContentPost>;
  settings(): Promise<PortalSettings>;
  saveSettings(s: PortalSettings): Promise<PortalSettings>;
};

export const CUSTOMER_SAVED = "xmedia:customer-saved";

// regras de responsáveis em cache (1 min); limpas quando as definições são gravadas
let rulesCache: { at: number; rules: AssignRule[] } | null = null;
async function rulesFor(store: Pick<CustomerStore, "settings">): Promise<AssignRule[]> {
  if (rulesCache && Date.now() - rulesCache.at < 60_000) return rulesCache.rules;
  const rules = normalizeRules((await store.settings().catch(() => null))?.assign_rules);
  rulesCache = { at: Date.now(), rules };
  return rules;
}
export const clearRulesCache = () => void (rulesCache = null);
const announce = (id: string) => typeof window !== "undefined" && window.dispatchEvent(new CustomEvent(CUSTOMER_SAVED, { detail: { id } }));

type CRow = { id: string; data: Customer; created_at?: string; updated_at?: string };
type PRow = { id: string; customer_id: string; data: ContentPost; created_at?: string; updated_at?: string };
// o cofre (senhas cifradas) nunca vem para o browser por aqui — só pelas rotas /api/vault
const fromC = (r: CRow) => {
  const { vault: _v, ...data } = (r.data ?? {}) as Customer & { vault?: unknown };
  return normalizeCustomer({ ...data, id: r.id, created_at: r.created_at, updated_at: r.updated_at });
};
const fromP = (r: PRow) => normalizePost({ ...r.data, id: r.id, customer_id: r.customer_id, created_at: r.created_at, updated_at: r.updated_at });
const strip = <T extends { created_at?: string; updated_at?: string }>({ created_at: _c, updated_at: _u, ...rest }: T) => rest;

/** Campos que o servidor atualiza (portal, Instagram) não são reescritos por uma cópia antiga do admin. */
function mergeServerFields(next: Customer, prev: Customer | null): Customer {
  if (!prev) return next;
  const { handle } = next.instagram;
  // pedidos de avaliação: o servidor marca as respostas — junta por id e fica com a versão respondida
  const reqs = new Map((prev.feedback?.requests ?? []).map((r) => [r.id, r]));
  for (const r of next.feedback?.requests ?? []) if (!reqs.get(r.id)?.used_at) reqs.set(r.id, r);
  const feedback = reqs.size ? { requests: [...reqs.values()] } : undefined;
  // marca, tarefas e dados da empresa também são editados no portal: fica a versão mais recente
  const brand = (prev.brand?.updated_at ?? "") > (next.brand?.updated_at ?? "") ? prev.brand : next.brand;
  const tasks = prev.tasks || next.tasks ? mergeTasks(prev.tasks, next.tasks) : undefined;
  const company = (prev.company_updated_at ?? "") > (next.company_updated_at ?? "") ? { kind: prev.kind, billing: prev.billing, company_updated_at: prev.company_updated_at } : {};
  const moodboards = prev.moodboards || next.moodboards ? mergeBoards(prev.moodboards, next.moodboards) : undefined;
  const references = prev.references || next.references ? mergeRefs(prev.references, next.references) : undefined;
  // documentos: assinaturas e uploads do portal acontecem no servidor — junta por id (o mais recente ganha)
  const documents = mergeDocs(prev.documents, next.documents);
  return { ...next, portal: prev.portal, instagram: { ...prev.instagram, handle }, feedback, brand, tasks, moodboards, references, documents, ...company };
}
/** O feedback do cliente chega pelo servidor: junta por id para não o perder. */
export function mergeFeedback(next: ContentPost, prev: ContentPost | null): ContentPost {
  if (!prev) return touchPhase(null, next);
  const ids = new Set(next.feedback.map((f) => f.id));
  const feedback = [...next.feedback, ...prev.feedback.filter((f) => !ids.has(f.id))].sort((a, b) => a.at.localeCompare(b.at));
  const notes = mergeNotes(prev.notes, next.notes);
  // a validação é do cliente (portal); recomeça quando o conteúdo volta para aprovação numa ronda nova
  next = { ...next, validation: next.round > prev.round ? undefined : (prev.validation ?? next.validation) };
  // se o cliente decidiu entretanto (aprovar / pedir alterações), essa decisão prevalece
  const clientDecided = prev.feedback.some((f) => f.by === "client" && !ids.has(f.id));
  const merged = clientDecided ? { ...next, feedback, notes, status: prev.status, phase_since: prev.phase_since } : { ...next, feedback, notes };
  return touchPhase(prev, merged);
}

const C_COLS = "id, data, created_at, updated_at";
const P_COLS = "id, customer_id, data, created_at, updated_at";

const remote: CustomerStore = {
  async list() {
    const { data, error } = await supabase().from("customers").select(C_COLS).order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromC);
  },
  async get(id) {
    const { data, error } = await supabase().from("customers").select(C_COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromC(data) : null;
  },
  async save(c) {
    const prev = await remote.get(c.id).catch(() => null);
    // o cofre não vem no get (fromC tira-o): lê-o à parte para nunca o apagar ao gravar
    const { data: raw } = await supabase().from("customers").select("data").eq("id", c.id).maybeSingle();
    const vault = (raw?.data as { vault?: unknown } | undefined)?.vault;
    const doc = { ...strip(mergeServerFields(c, prev)), ...(vault ? { vault } : {}) };
    const { data, error } = await supabase().from("customers").upsert({ id: c.id, name: c.name, email: c.email, stage: c.stage, data: doc }).select(C_COLS).single();
    if (error) throw error;
    announce(c.id);
    return fromC(data);
  },
  async remove(id) {
    const { error } = await supabase().from("customers").delete().eq("id", id);
    if (error) throw error;
  },
  async posts(customerId) {
    let q = supabase().from("customer_posts").select(P_COLS).order("scheduled_at", { ascending: true, nullsFirst: false });
    if (customerId) q = q.eq("customer_id", customerId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(fromP).filter((p) => !p.deleted_at);
  },
  async bin(customerId) {
    let q = supabase().from("customer_posts").select(P_COLS);
    if (customerId) q = q.eq("customer_id", customerId);
    const { data, error } = await q;
    if (error) throw error;
    const all = (data ?? []).map(fromP).filter((p) => p.deleted_at);
    // passados 15 dias: apagar de vez
    for (const p of all.filter((x) => binExpired(x))) await this.removePost(p.id).catch(() => null);
    return all.filter((x) => !binExpired(x)).sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
  },
  async trashPost(p) {
    return this.savePost({ ...p, deleted_at: new Date().toISOString() });
  },
  async restorePost(p) {
    const { deleted_at: _d, ...rest } = p;
    return this.savePost(rest as ContentPost);
  },
  async savePost(p) {
    const { data: old } = await supabase().from("customer_posts").select(P_COLS).eq("id", p.id).maybeSingle();
    const prevPost = old ? fromP(old) : null;
    // automação de responsáveis (criado / mudou de etapa)
    const merged = applyAssignRules(prevPost, mergeFeedback(p, prevPost), await rulesFor(this));
    const { data, error } = await supabase()
      .from("customer_posts")
      .upsert({ id: p.id, customer_id: p.customer_id, status: merged.status, scheduled_at: merged.scheduled_at || null, data: strip(merged) })
      .select(P_COLS)
      .single();
    if (error) throw error;
    announce(p.customer_id);
    return fromP(data);
  },
  async removePost(id) {
    const { error } = await supabase().from("customer_posts").delete().eq("id", id);
    if (error) throw error;
  },
  async settings() {
    const { data } = await supabase().from("app_settings").select("data").maybeSingle();
    // cofre e ligações (tokens cifrados) só no servidor
    const { vault: _v, connections: _c, ...rest } = (data?.data ?? {}) as Record<string, unknown>;
    return normalizeSettings(rest);
  },
  async saveSettings(s) {
    clearRulesCache();
    // dono do workspace (o admin, mesmo quando quem grava é um team member com settings.manage)
    // documentos internos também são alterados pelo servidor (assinaturas): junta antes de gravar
    const { data: cur } = await supabase().from("app_settings").select("data").maybeSingle();
    if (cur?.data?.documents) s = { ...s, documents: mergeDocs(cur.data.documents, s.documents) };
    if (cur?.data?.vault) s = { ...s, vault: cur.data.vault } as PortalSettings;
    if (cur?.data?.connections) s = { ...s, connections: cur.data.connections } as PortalSettings;
    const { data: owner } = await supabase().rpc("workspace_owner");
    const ownerId = owner ?? (await supabase().auth.getUser()).data.user?.id;
    const { error } = await supabase().from("app_settings").upsert({ owner_id: ownerId, data: s, updated_at: new Date().toISOString() });
    if (error) throw error;
    return s;
  },
};

// ---------- modo local ----------
export const LS_CUSTOMERS = "xmedia:customers";
export const LS_POSTS = "xmedia:customerPosts";
export const LS_SETTINGS = "xmedia:portalSettings";
export function readLS<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}
export const writeLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

function upsertLS<T extends { id: string; created_at?: string; updated_at?: string }>(k: string, item: T): T {
  const all = readLS<T[]>(k, []);
  const now = new Date().toISOString();
  const prev = all.find((x) => x.id === item.id);
  const saved = { ...item, created_at: prev?.created_at ?? now, updated_at: now };
  writeLS(k, prev ? all.map((x) => (x.id === item.id ? saved : x)) : [...all, saved]);
  return saved;
}

const local: CustomerStore = {
  async list() {
    return readLS<Customer[]>(LS_CUSTOMERS, [])
      .map(normalizeCustomer)
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  },
  async get(id) {
    const c = readLS<Customer[]>(LS_CUSTOMERS, []).find((x) => x.id === id);
    return c ? normalizeCustomer(c) : null;
  },
  async save(c) {
    const prev = await local.get(c.id);
    const saved = upsertLS(LS_CUSTOMERS, mergeServerFields(c, prev));
    announce(c.id);
    return normalizeCustomer(saved);
  },
  async remove(id) {
    writeLS(LS_CUSTOMERS, readLS<Customer[]>(LS_CUSTOMERS, []).filter((x) => x.id !== id));
    writeLS(LS_POSTS, readLS<ContentPost[]>(LS_POSTS, []).filter((x) => x.customer_id !== id));
  },
  async posts(customerId) {
    return readLS<ContentPost[]>(LS_POSTS, [])
      .filter((p) => (!customerId || p.customer_id === customerId) && !p.deleted_at)
      .map(normalizePost)
      .sort((a, b) => (a.scheduled_at || "9999").localeCompare(b.scheduled_at || "9999"));
  },
  async savePost(p) {
    const prev = readLS<ContentPost[]>(LS_POSTS, []).find((x) => x.id === p.id) ?? null;
    const prevPost = prev ? normalizePost(prev) : null;
    const saved = upsertLS(LS_POSTS, applyAssignRules(prevPost, mergeFeedback(p, prevPost), await rulesFor(this)));
    announce(p.customer_id);
    return normalizePost(saved);
  },
  async removePost(id) {
    const p = readLS<ContentPost[]>(LS_POSTS, []).find((x) => x.id === id);
    writeLS(LS_POSTS, readLS<ContentPost[]>(LS_POSTS, []).filter((x) => x.id !== id));
    if (p) announce(p.customer_id);
  },
  async bin(customerId) {
    const all = readLS<ContentPost[]>(LS_POSTS, []).filter((p) => p.deleted_at && (!customerId || p.customer_id === customerId));
    const expired = all.filter((x) => binExpired(x)).map((x) => x.id);
    if (expired.length) writeLS(LS_POSTS, readLS<ContentPost[]>(LS_POSTS, []).filter((x) => !expired.includes(x.id)));
    return all.filter((x) => !expired.includes(x.id)).map(normalizePost).sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
  },
  async trashPost(p) {
    return this.savePost({ ...p, deleted_at: new Date().toISOString() });
  },
  async restorePost(p) {
    const { deleted_at: _d, ...rest } = p;
    // o savePost local junta com o anterior: limpar o campo explicitamente
    writeLS(LS_POSTS, readLS<ContentPost[]>(LS_POSTS, []).map((x) => (x.id === p.id ? { ...x, deleted_at: undefined } : x)));
    return this.savePost(rest as ContentPost);
  },
  async settings() {
    return normalizeSettings(readLS<Partial<PortalSettings> | null>(LS_SETTINGS, null));
  },
  async saveSettings(s) {
    clearRulesCache();
    writeLS(LS_SETTINGS, s);
    return s;
  },
};

export const customerStore: CustomerStore = supabaseEnabled ? remote : local;
