"use client";

// Gravação do catálogo de serviços e dos orçamentos: Supabase (services, service_catalog, service_quotes)
// ou, em modo local, este navegador. Na primeira abertura o catálogo é semeado com os serviços do Notion.
import { SEED_SERVICES } from "./services-seed";
import { DEFAULT_FOLDERS, DEFAULT_RULES, normalizeRules, normalizeService, withHistory, type PricingRules, type QuoteInput, type Service, type ServiceFolder } from "./services";
import { supabase, supabaseEnabled } from "./supabase/client";

export type Catalog = { services: Service[]; folders: ServiceFolder[]; rules: PricingRules };
export type SavedQuote = {
  id: string;
  title: string;
  input: QuoteInput;
  subtotal: number;
  total: number;
  status: "draft" | "sent" | "won" | "lost";
  proposal_id?: string | null;
  invoice_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const SERVICES_SAVED = "xmedia:services-saved";
const announce = () => typeof window !== "undefined" && window.dispatchEvent(new CustomEvent(SERVICES_SAVED));

type Store = {
  load(): Promise<Catalog>;
  saveService(s: Service, by?: string): Promise<Service>;
  removeService(id: string): Promise<void>;
  saveMany(list: Service[], by?: string): Promise<number>;
  saveFolders(f: ServiceFolder[]): Promise<void>;
  saveRules(r: PricingRules): Promise<void>;
  bump(ids: string[]): Promise<void>;
  quotes(): Promise<SavedQuote[]>;
  saveQuote(q: SavedQuote): Promise<SavedQuote>;
  removeQuote(id: string): Promise<void>;
};

const sortFolders = (f: ServiceFolder[]) => (f.length ? f : DEFAULT_FOLDERS).slice().sort((a, b) => a.order - b.order);
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

// ---------------------------------------------------------------- Supabase
type Row = { id: string; data: Service; uses: number; created_at?: string; updated_at?: string };
const fromRow = (r: Row, folders: ServiceFolder[]) => normalizeService({ ...r.data, id: r.id, uses: r.uses, created_at: r.created_at, updated_at: r.updated_at }, folders);
const toRow = (s: Service) => {
  const { created_at: _c, updated_at: _u, ...data } = s;
  return { id: s.id, folder: s.folder, name: s.name, price: s.price, archived: s.archived, uses: s.uses, data };
};

const remote: Store = {
  async load() {
    const db = supabase();
    const [{ data: rows, error }, { data: cat }] = await Promise.all([
      db.from("services").select("id, data, uses, created_at, updated_at").order("folder").order("name"),
      db.from("service_catalog").select("folders, rules").maybeSingle(),
    ]);
    if (error) throw /services|relation|schema cache/i.test(error.message) ? new Error("Catálogo ainda sem tabelas: corra a migração 0013_services.sql no Supabase (SQL editor).") : error;
    const folders = sortFolders(Array.isArray(cat?.folders) ? (cat!.folders as ServiceFolder[]) : []);
    const rules = normalizeRules((cat?.rules as PricingRules) ?? null);
    if (!rows?.length) {
      // primeira vez: semeia com o Notion (só passa se tiver permissão de escrita)
      const seeded = SEED_SERVICES.map((s) => withHistory(null, s, "Notion"));
      const { error: e2 } = await db.from("services").insert(seeded.map(toRow));
      if (!e2) {
        if (!cat) await db.from("service_catalog").upsert({ folders: DEFAULT_FOLDERS, rules: DEFAULT_RULES });
        return { services: seeded, folders, rules };
      }
      return { services: [], folders, rules };
    }
    return { services: rows.map((r) => fromRow(r as Row, folders)), folders, rules };
  },
  async saveService(s, by) {
    const db = supabase();
    const { data: prev } = await db.from("services").select("id, data, uses").eq("id", s.id).maybeSingle();
    const next = withHistory(prev ? normalizeService({ ...(prev.data as Service), uses: prev.uses }) : null, s, by);
    const { data, error } = await db.from("services").upsert(toRow(next), { onConflict: "owner_id,id" }).select("id, data, uses, created_at, updated_at").single();
    if (error) throw error;
    announce();
    return fromRow(data as Row, DEFAULT_FOLDERS);
  },
  async removeService(id) {
    const { error } = await supabase().from("services").delete().eq("id", id);
    if (error) throw error;
    announce();
  },
  async saveMany(list, by) {
    const db = supabase();
    const { data: prevRows } = await db.from("services").select("id, data, uses");
    const prev = new Map((prevRows ?? []).map((r) => [r.id as string, normalizeService({ ...(r.data as Service), uses: r.uses })]));
    const rows = list.map((s) => toRow(withHistory(prev.get(s.id) ?? null, { ...s, uses: Math.max(s.uses, prev.get(s.id)?.uses ?? 0) }, by)));
    const { error } = await db.from("services").upsert(rows, { onConflict: "owner_id,id" });
    if (error) throw error;
    announce();
    return rows.length;
  },
  async saveFolders(folders) {
    const { error } = await supabase().from("service_catalog").upsert({ folders }, { onConflict: "owner_id" });
    if (error) throw error;
    announce();
  },
  async saveRules(rules) {
    const { error } = await supabase().from("service_catalog").upsert({ rules: { ...rules, updated_at: new Date().toISOString() } }, { onConflict: "owner_id" });
    if (error) throw error;
    announce();
  },
  async bump(ids) {
    if (ids.length) await supabase().rpc("bump_service_uses", { ids: [...new Set(ids)] });
  },
  async quotes() {
    const { data, error } = await supabase().from("service_quotes").select("id, data, created_at, updated_at").order("updated_at", { ascending: false }).limit(200);
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...(r.data as SavedQuote), id: r.id, created_at: r.created_at, updated_at: r.updated_at }));
  },
  async saveQuote(q) {
    const { created_at: _c, updated_at: _u, ...data } = q;
    const { data: row, error } = await supabase()
      .from("service_quotes")
      .upsert({ id: q.id, client_name: q.input.client.company || q.input.client.name, customer_id: q.input.client.customer_id || null, total: q.total, data })
      .select("id, created_at, updated_at")
      .single();
    if (error) throw error;
    announce();
    return { ...q, created_at: row.created_at, updated_at: row.updated_at };
  },
  async removeQuote(id) {
    const { error } = await supabase().from("service_quotes").delete().eq("id", id);
    if (error) throw error;
    announce();
  },
};

// ---------------------------------------------------------------- local (navegador)
const LS = { services: "xmedia:services", folders: "xmedia:serviceFolders", rules: "xmedia:serviceRules", quotes: "xmedia:serviceQuotes" };
const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

const local: Store = {
  async load() {
    const folders = sortFolders(read<ServiceFolder[]>(LS.folders, []));
    let list = read<Service[] | null>(LS.services, null);
    if (!list) {
      list = SEED_SERVICES.map((s) => ({ ...withHistory(null, s, "Notion"), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
      write(LS.services, list);
    }
    return { services: list.map((s) => normalizeService(s, folders)), folders, rules: normalizeRules(read<PricingRules | null>(LS.rules, null)) };
  },
  async saveService(s, by) {
    const all = read<Service[]>(LS.services, []);
    const prev = all.find((x) => x.id === s.id) ?? null;
    const now = new Date().toISOString();
    const next = { ...withHistory(prev ? normalizeService(prev) : null, s, by), created_at: prev?.created_at ?? now, updated_at: now };
    write(LS.services, prev ? all.map((x) => (x.id === s.id ? next : x)) : [...all, next]);
    announce();
    return next;
  },
  async removeService(id) {
    write(LS.services, read<Service[]>(LS.services, []).filter((x) => x.id !== id));
    announce();
  },
  async saveMany(list, by) {
    for (const s of list) await local.saveService(s, by);
    return list.length;
  },
  async saveFolders(f) {
    write(LS.folders, f);
    announce();
  },
  async saveRules(r) {
    write(LS.rules, { ...r, updated_at: new Date().toISOString() });
    announce();
  },
  async bump(ids) {
    const set = new Set(ids);
    write(LS.services, read<Service[]>(LS.services, []).map((s) => (set.has(s.id) ? { ...s, uses: (s.uses || 0) + 1 } : s)));
  },
  async quotes() {
    return read<SavedQuote[]>(LS.quotes, []).sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  },
  async saveQuote(q) {
    const all = read<SavedQuote[]>(LS.quotes, []);
    const now = new Date().toISOString();
    const prev = all.find((x) => x.id === q.id);
    const saved = { ...q, created_at: prev?.created_at ?? now, updated_at: now };
    write(LS.quotes, prev ? all.map((x) => (x.id === q.id ? saved : x)) : [saved, ...all]);
    announce();
    return saved;
  },
  async removeQuote(id) {
    write(LS.quotes, read<SavedQuote[]>(LS.quotes, []).filter((x) => x.id !== id));
    announce();
  },
};

export const serviceStore: Store = supabaseEnabled ? remote : local;
export const newQuoteId = uid;
