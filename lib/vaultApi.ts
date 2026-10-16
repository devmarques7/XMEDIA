"use client";

// Cofre no browser. Com Supabase: /api/vault (estúdio) e /api/portal/vault (cliente) — a senha só chega ao revelar.
// Modo local (testes): cifra com uma chave guardada neste navegador (NÃO é segura — só para experimentar o fluxo).
import { customerStore } from "./customerStore";
import { audit, canEdit, canManage, canReveal, newEntry, normalizeVault, publicEntry, type Grant, type PublicEntry, type Viewer, type VaultEntry } from "./vault";
import { supabaseEnabled } from "./supabase/client";

export type People = { team: { name: string; email: string }[]; client: { name: string; email: string; role: string }[] };
export type VaultList = { entries: PublicEntry[]; people: People; configured: boolean; owner?: boolean };
export type VaultSide = "studio" | "portal";

class VaultError extends Error {}
async function api<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new VaultError(j.error || `http_${r.status}`);
  return j as T;
}

type VaultApi = {
  list(side: VaultSide, scope?: string): Promise<VaultList>;
  save(side: VaultSide, entry: Partial<VaultEntry> & { customer_id: string }, password?: string): Promise<PublicEntry>;
  reveal(side: VaultSide, e: PublicEntry, copy?: boolean): Promise<string>;
  grants(side: VaultSide, e: PublicEntry, grants: Grant[]): Promise<PublicEntry>;
  remove(side: VaultSide, e: PublicEntry): Promise<void>;
};

const url = (side: VaultSide) => (side === "portal" ? "/api/portal/vault" : "/api/vault");
const remote: VaultApi = {
  list: (side, scope = "all") => api(side === "portal" ? url(side) : `${url(side)}?scope=${encodeURIComponent(scope)}`),
  save: async (side, entry, password) => (await api<{ entry: PublicEntry }>(url(side), { action: "save", entry, customer: entry.customer_id, password })).entry,
  reveal: async (side, e, copy) => (await api<{ password: string }>(url(side), { action: "reveal", id: e.id, customer: e.customer_id, copy })).password,
  grants: async (side, e, grants) => (await api<{ entry: PublicEntry }>(url(side), { action: "grants", id: e.id, customer: e.customer_id, grants })).entry,
  remove: async (side, e) => void (await api(url(side), { action: "delete", id: e.id, customer: e.customer_id })),
};

// ---------- modo local ----------
const LS_KEY = "xmedia:vault:localkey";
async function localKey() {
  let raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
    localStorage.setItem(LS_KEY, raw);
  }
  return crypto.subtle.importKey("raw", Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function enc(p: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv: b64(iv), ct: b64(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await localKey(), new TextEncoder().encode(p))) };
}
async function dec(c: { iv: string; ct: string }) {
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(c.iv) }, await localKey(), unb64(c.ct)));
}
async function localViewer(side: VaultSide): Promise<Viewer> {
  if (side === "portal") {
    const { portalApi } = await import("./portalApi");
    const me = await portalApi.me();
    return { side: "client", email: me.me.email, customer_id: me.customer.id, owner: me.me.role === "owner" };
  }
  const s = await customerStore.settings();
  return { side: "studio", email: s.contact_email.toLowerCase(), admin: true };
}
async function localLoad(customerId: string): Promise<VaultEntry[]> {
  if (customerId) {
    const c = await customerStore.get(customerId);
    return normalizeVault((c as unknown as { vault?: unknown })?.vault).map((e) => ({ ...e, customer_id: customerId }));
  }
  const s = await customerStore.settings();
  return normalizeVault((s as unknown as { vault?: unknown }).vault).map((e) => ({ ...e, customer_id: "" }));
}
async function localSave(e: VaultEntry) {
  const list = await localLoad(e.customer_id);
  const next = list.some((x) => x.id === e.id) ? list.map((x) => (x.id === e.id ? e : x)) : [...list, e];
  if (e.customer_id) {
    const c = await customerStore.get(e.customer_id);
    if (c) await customerStore.save({ ...c, vault: next } as typeof c);
  } else {
    const s = await customerStore.settings();
    await customerStore.saveSettings({ ...s, vault: next } as typeof s);
  }
}
async function find(e: PublicEntry) {
  const cur = (await localLoad(e.customer_id)).find((x) => x.id === e.id);
  if (!cur) throw new VaultError("not_found");
  return cur;
}

const local: VaultApi = {
  async list(side, scope = "all") {
    const v = await localViewer(side);
    const cs = await customerStore.list();
    const ids = side === "portal" && v.side === "client" ? [v.customer_id] : scope === "all" ? ["", ...cs.map((c) => c.id)] : [scope === "internal" ? "" : scope];
    const entries = (await Promise.all(ids.map(localLoad))).flat().filter((e) => !e.deleted).map((e) => publicEntry(e, v));
    const { team } = await import("./team");
    const members = await team.members().catch(() => []);
    const portalUsers = side === "portal" && v.side === "client" ? await (await import("./portalApi")).portalApi.users(v.customer_id).catch(() => []) : [];
    return { entries, people: { team: members.filter((m) => m.active && m.email).map((m) => ({ name: m.name, email: m.email.toLowerCase() })), client: portalUsers.map((u) => ({ name: u.name, email: u.email.toLowerCase(), role: u.role })) }, configured: true, owner: v.side === "client" && v.owner };
  },
  async save(side, p, password) {
    const v = await localViewer(side);
    const cur = p.id ? (await localLoad(p.customer_id)).find((x) => x.id === p.id) : undefined;
    if (cur && !canEdit(cur, v)) throw new VaultError("forbidden");
    let e: VaultEntry = cur ?? newEntry({ customer_id: p.customer_id, created_by: { email: v.email, side: v.side } });
    e = { ...e, platform: p.platform ?? e.platform, url: p.url ?? e.url, concept: p.concept ?? e.concept, login: p.login ?? e.login };
    if (password) e = { ...e, secret: await enc(password), has_secret: true };
    e = audit(e, { by: v.email, action: cur ? "updated" : "created" });
    await localSave(e);
    return publicEntry(e, v);
  },
  async reveal(side, pe, copy) {
    const v = await localViewer(side);
    const e = await find(pe);
    if (!canReveal(e, v)) throw new VaultError("no_access");
    await localSave(audit(e, { by: v.email, action: copy ? "copied" : "revealed" }));
    return e.secret ? dec(e.secret) : "";
  },
  async grants(side, pe, grants) {
    const v = await localViewer(side);
    const e = await find(pe);
    if (!canManage(e, v)) throw new VaultError(side === "portal" ? "owner_only" : "client_decides");
    const next = audit({ ...e, grants }, { by: v.email, action: "granted", detail: grants.map((g) => g.email ?? g.kind).join(", ") || "—" });
    await localSave(next);
    return publicEntry(next, v);
  },
  async remove(side, pe) {
    const v = await localViewer(side);
    const e = await find(pe);
    if (!canEdit(e, v)) throw new VaultError("forbidden");
    await localSave(audit({ ...e, deleted: true, secret: undefined, has_secret: false }, { by: v.email, action: "deleted" }));
  },
};

export const vaultApi: VaultApi = supabaseEnabled ? remote : local;
export const vaultLocal = !supabaseEnabled;
