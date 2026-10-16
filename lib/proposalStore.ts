"use client";

// Gravação das propostas: Supabase (tabela proposals) ou, em modo local, este navegador.
import { BUNDLED_PROPOSALS, needsBundle } from "./bundled";
import { normalizeProposal, type Proposal } from "./proposal";
import { supabase, supabaseEnabled } from "./supabase/client";

type ProposalStore = {
  list(): Promise<Proposal[]>;
  get(id: string): Promise<Proposal | null>;
  save(p: Proposal): Promise<Proposal>;
  remove(id: string): Promise<void>;
};

export const PROPOSAL_SAVED = "xmedia:proposal-saved";
const announce = (id: string) => typeof window !== "undefined" && window.dispatchEvent(new CustomEvent(PROPOSAL_SAVED, { detail: { id } }));

type RowT = { id: string; data: Proposal; created_at?: string; updated_at?: string };
const fromRow = (r: RowT) => normalizeProposal({ ...r.data, id: r.id, created_at: r.created_at, updated_at: r.updated_at });

const remote: ProposalStore = {
  async list() {
    const { data, error } = await supabase().from("proposals").select("id, data, created_at, updated_at").order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },
  async get(id) {
    const { data, error } = await supabase().from("proposals").select("id, data, created_at, updated_at").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  },
  async save(p) {
    const { created_at: _c, updated_at: _u, ...rest } = p;
    const { data, error } = await supabase()
      .from("proposals")
      .upsert({ id: p.id, title: p.title, client_name: p.client.name, value: p.value, currency: p.currency, stage: p.stage, data: rest })
      .select("id, data, created_at, updated_at")
      .single();
    if (error) throw error;
    announce(p.id);
    return fromRow(data);
  },
  async remove(id) {
    const { error } = await supabase().from("proposals").delete().eq("id", id);
    if (error) throw error;
  },
};

const LS = "xmedia:proposals";
const read = (): Proposal[] => {
  try {
    return JSON.parse(localStorage.getItem(LS) || "[]");
  } catch {
    return [];
  }
};

const local: ProposalStore = {
  async list() {
    return read()
      .map((p) => normalizeProposal(p))
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  },
  async get(id) {
    const p = read().find((x) => x.id === id);
    return p ? normalizeProposal(p) : null;
  },
  async save(p) {
    const all = read();
    const now = new Date().toISOString();
    const prev = all.find((x) => x.id === p.id);
    const saved = { ...p, created_at: prev?.created_at ?? now, updated_at: now };
    localStorage.setItem(LS, JSON.stringify(prev ? all.map((x) => (x.id === p.id ? saved : x)) : [...all, saved]));
    announce(p.id);
    return saved;
  },
  async remove(id) {
    localStorage.setItem(LS, JSON.stringify(read().filter((x) => x.id !== id)));
  },
};

export const proposalStore: ProposalStore = supabaseEnabled ? remote : local;

/** Garante as propostas incluídas na app (uma vez por sessão do browser). Devolve os títulos criados/atualizados. */
export async function ensureBundledProposals(): Promise<string[]> {
  try {
    if (sessionStorage.getItem("xmedia:bundled") === "4") return [];
  } catch {}
  let written: string[] = [];
  if (supabaseEnabled) {
    const r = await fetch("/api/proposals/bootstrap", { method: "POST" });
    if (r.ok) written = ((await r.json()) as { written: string[] }).written;
  } else {
    for (const b of BUNDLED_PROPOSALS) {
      const saved = await local.get(b.id);
      if (needsBundle(saved, b)) {
        await local.save(normalizeProposal(b));
        written.push(b.title);
      }
    }
  }
  try {
    sessionStorage.setItem("xmedia:bundled", "4");
  } catch {}
  return written;
}
