"use client";

// Portal do cliente. Um cliente (empresa) tem várias pessoas (utilizadores do portal), cada uma com o seu
// email, código de 4–6 dígitos e papel. Fluxo: convite → código (ou Google) → portal.
// Com Supabase: rotas /api/portal/* e /api/customers/* no servidor. Sem Supabase (modo local): tudo neste
// navegador, para testar o fluxo completo.
import { normalizeInvoice, totals, type Invoice } from "./invoice";
import { normalizeBrand, type BrandIdentity } from "./brand";
import { mergeBoards, normalizeBoards, type Moodboard } from "./moodboard";
import { mergeRefs, normalizeRefs, type References } from "./references";
import { fileToDataUrl, localPreview, type LinkPreview } from "./inspirationClient";
import { clientTasks, mergeTasks, normalizeTask, type Task } from "./tasks";
import { INVITE_DAYS, randomToken } from "./codes";
import {
  addNote,
  canManageInstagram,
  canReview,
  clientReview,
  cleanHandle,
  monthlyFee,
  normalizeCustomer,
  normalizePost,
  patchNote,
  cleanMove,
  type NoteMove,
  validHandle,
  validPasscode,
  type Billing,
  type ContentPost,
  type Customer,
  type CustomerUser,
  type CustomerUserRole,
  type Note,
  type PortalSettings,
  clientDraft,
  visibleToClient,
  type ClientDraftInput,
} from "./customer";
import { LS_CUSTOMERS, LS_POSTS, customerStore, readLS, writeLS } from "./customerStore";
import type { Lang } from "./i18n";
import { ApiError } from "./memberApi";
import { supabase, supabaseEnabled } from "./supabase/client";
import { shrinkImage } from "./media";

export { ApiError };
export type PortalCustomer = Omit<Customer, "notes">;
export type PortalInfo = Pick<PortalSettings, "studio_hours" | "contact_email" | "contact_phone" | "delivery_days"> & { fee: number; currency: "EUR"; igConnect: boolean; process?: PortalSettings["process"]; contract_signed?: boolean };
/** Invoice como o cliente a vê no portal (Conta → Pagamento). */
export type PortalInvoice = { id: string; number: string; issue_date: string; status: "sent" | "paid"; currency: string; total: number; due_days: number };
export type TeamAction = { action: "save" | "invite" | "remove"; id?: string; name?: string; email?: string; role?: CustomerUserRole; send?: boolean };
export type PortalMe = Pick<CustomerUser, "id" | "name" | "email" | "role" | "passcode_set" | "email_verified">;
export type PortalData = { customer: PortalCustomer; me: PortalMe; posts: ContentPost[]; info: PortalInfo };
/** Dados do convite: cliente (name), pessoa, email (para preencher o ecrã), papel. */
export type InviteInfo = { name: string; person: string; email: string; role: CustomerUserRole; lang: Lang; expiresAt: string };
export type NoteInput = Pick<Note, "text" | "media" | "t" | "x" | "y">;
export type InviteResult = { link: string; expiresAt: string; email: { sent: boolean; reason?: string }; preview?: { subject: string; html: string; to: string } };
export type UserInput = { id?: string; name: string; email: string; role: CustomerUserRole };
const clientView = (p: ContentPost): ContentPost => ({ ...p, notes: p.notes.filter((n) => n.by === "client" && !n.deleted) });
export type IntegrationStatus = { instagram: boolean; email: boolean; cron: boolean; r2?: boolean; mux?: boolean; vault?: boolean; local: boolean };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `http_${r.status}`);
  return j as T;
}
const post = <T,>(url: string, body: unknown = {}) => api<T>(url, { method: "POST", body: JSON.stringify(body) });

type PortalApi = {
  // pessoa do cliente
  checkInvite(token: string): Promise<InviteInfo>;
  /** Remoto: prepara o convite e abre o Google. Local: liga ao email indicado. */
  acceptInvite(token: string, localEmail?: string): Promise<void>;
  /** Aceita o convite com o código de 4–6 dígitos (sem Google). Devolve para onde ir. */
  acceptWithCode(token: string, code: string): Promise<{ to: string }>;
  /** Login com Google (recuperar código / outro dispositivo). */
  google(localEmail?: string): Promise<void>;
  setPasscode(code: string): Promise<void>;
  /** Liga a conta Google à pessoa já com sessão (valida o email). Opcional no onboarding. */
  linkGoogle(): Promise<void>;
  login(email: string, code: string): Promise<{ name: string; lang: Lang }>;
  logout(): Promise<void>;
  me(): Promise<PortalData>;
  review(postId: string, action: "approve" | "changes", text: string): Promise<void>;
  /** Comentário no material (frame do vídeo / ponto na imagem); devolve o post atualizado. */
  note(postId: string, note: NoteInput): Promise<ContentPost>;
  removeNote(postId: string, noteId: string): Promise<ContentPost>;
  moveNote(postId: string, noteId: string, to: NoteMove): Promise<ContentPost>;
  setHandle(handle: string): Promise<void>;
  syncInstagram(): Promise<void>;
  // portal: equipa do cliente (o responsável gere) e pagamentos
  team(): Promise<CustomerUser[]>;
  teamAction(a: TeamAction): Promise<{ users: CustomerUser[]; invite?: InviteResult }>;
  billing(): Promise<PortalInvoice[]>;
  /** Identidade visual (responsável e editores). */
  saveBrand(brand: BrandIdentity): Promise<BrandIdentity>;
  /** Tipo de cliente e dados da empresa (responsável). */
  saveCompany(kind: "company" | "person", billing: Partial<Billing>): Promise<{ kind?: "company" | "person"; billing?: Billing }>;
  /** Tarefas alteradas (o servidor junta com as existentes). */
  saveTasks(tasks: Task[]): Promise<Task[]>;
  /** Moodboards alterados (o servidor junta por quadro, fica o mais recente). */
  saveBoards(boards: Moodboard[]): Promise<Moodboard[]>;
  /** Referências alteradas (grupos e links). */
  saveRefs(refs: References): Promise<References>;
  /** Imagem do cliente → URL (Storage) ou data URL em modo local. */
  upload(file: File): Promise<string>;
  /** Imagem + título de um link (Pinterest, sites…). */
  linkPreview(url: string): Promise<LinkPreview>;
  /** Validação de um critério do conteúdo em revisão (ok / ajustar / limpar). */
  validate(postId: string, key: string, value: "ok" | "fix" | null): Promise<Record<string, "ok" | "fix">>;
  /** Rascunho planeado pelo cliente (cria ou atualiza). */
  saveDraft(d: ClientDraftInput): Promise<ContentPost>;
  deleteDraft(id: string): Promise<void>;
  // admin / equipa
  users(customerId: string): Promise<CustomerUser[]>;
  saveUser(customerId: string, u: UserInput): Promise<CustomerUser[]>;
  removeUser(customerId: string, userId: string): Promise<CustomerUser[]>;
  /** send=false: só gera o link e a pré-visualização do email (nada é enviado). */
  invite(customerId: string, userId: string, send?: boolean, lang?: Lang): Promise<InviteResult>;
  access(customerId: string, action: "reset" | "disable" | "enable", userId?: string): Promise<void>;
  adminSync(customerId: string): Promise<void>;
  publishNow(postId: string): Promise<{ ok: boolean; error?: string }>;
  status(): Promise<IntegrationStatus>;
};

const remote: PortalApi = {
  checkInvite: (token) => api(`/api/portal/invite/${encodeURIComponent(token)}`),
  async acceptInvite(token) {
    await post(`/api/portal/invite/${encodeURIComponent(token)}`);
    await remote.google();
  },
  acceptWithCode: (token, code) => post(`/api/portal/invite/${encodeURIComponent(token)}`, { code }),
  async google() {
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/portal/auth/callback`, queryParams: { prompt: "select_account" } },
    });
    if (error) throw new ApiError(error.message);
  },
  setPasscode: async (code) => {
    await post("/api/portal/passcode", { code });
  },
  async linkGoogle() {
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/portal/auth/callback?link=1`, queryParams: { prompt: "select_account" } },
    });
    if (error) throw new ApiError(error.message);
  },
  login: (email, code) => post("/api/portal/login", { email, code }),
  logout: async () => {
    await post("/api/portal/logout");
  },
  me: () => api("/api/portal/me"),
  review: async (postId, action, text) => {
    await post("/api/portal/posts", { postId, action, text });
  },
  setHandle: async (handle) => {
    await post("/api/portal/instagram", { handle });
  },
  note: async (postId, note) => (await post<{ post: ContentPost }>("/api/portal/notes", { postId, action: "add", note })).post,
  removeNote: async (postId, noteId) => (await post<{ post: ContentPost }>("/api/portal/notes", { postId, action: "remove", noteId })).post,
  moveNote: async (postId, noteId, to) => (await post<{ post: ContentPost }>("/api/portal/notes", { postId, action: "move", noteId, to })).post,
  syncInstagram: async () => {
    await post("/api/portal/instagram/sync");
  },
  team: async () => (await api<{ users: CustomerUser[] }>("/api/portal/team")).users,
  teamAction: (a) => post("/api/portal/team", a),
  billing: async () => (await api<{ invoices: PortalInvoice[] }>("/api/portal/billing")).invoices,
  saveBrand: async (brand) => (await post<{ brand: BrandIdentity }>("/api/portal/doc", { type: "brand", brand })).brand,
  saveCompany: (kind, billing) => post("/api/portal/doc", { type: "company", kind, billing }),
  saveTasks: async (tasks) => (await post<{ tasks: Task[] }>("/api/portal/doc", { type: "tasks", tasks })).tasks,
  saveBoards: async (boards) => (await post<{ boards: Moodboard[] }>("/api/portal/doc", { type: "moodboards", boards })).boards,
  saveRefs: async (references) => (await post<{ references: References }>("/api/portal/doc", { type: "references", references })).references,
  async upload(input) {
    // foto reduzida no browser e enviada diretamente para o Storage com um URL assinado (rápido, sem limite da Vercel)
    const file = await shrinkImage(input);
    const sign = await post<{ path: string; token: string; url: string }>("/api/portal/upload", { type: file.type, size: file.size }).catch(() => null);
    if (sign) {
      const { error } = await supabase().storage.from("proposal-media").uploadToSignedUrl(sign.path, sign.token, file, { contentType: file.type, cacheControl: "31536000" });
      if (!error) return sign.url;
    }
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/portal/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(j.error || `http_${r.status}`);
    return j.url as string;
  },
  linkPreview: (url) => api(`/api/portal/link-preview?url=${encodeURIComponent(url)}`),
  validate: async (postId, key, value) => (await post<{ validation: Record<string, "ok" | "fix"> }>("/api/portal/posts", { postId, action: "validate", key, value })).validation,
  saveDraft: async (draft) => (await post<{ post: ContentPost }>("/api/portal/posts", { action: "draft", draft })).post,
  deleteDraft: async (id) => void (await post("/api/portal/posts", { action: "draft_delete", postId: id })),
  users: async (customerId) => (await api<{ users: CustomerUser[] }>(`/api/customers/users?customerId=${encodeURIComponent(customerId)}`)).users,
  saveUser: async (customerId, u) => (await post<{ users: CustomerUser[] }>("/api/customers/users", { customerId, ...u })).users,
  removeUser: async (customerId, userId) =>
    (await api<{ users: CustomerUser[] }>(`/api/customers/users?customerId=${encodeURIComponent(customerId)}&id=${encodeURIComponent(userId)}`, { method: "DELETE" })).users,
  invite: (customerId, userId, send = false, lang) => post("/api/customers/invite", { customerId, userId, send, lang }),
  access: async (customerId, action, userId) => {
    await post("/api/customers/access", { customerId, action, userId });
  },
  adminSync: async (customerId) => {
    await post("/api/customers/instagram", { customerId });
  },
  publishNow: (postId) => post("/api/customers/publish", { postId }),
  status: () => api("/api/customers/status"),
};

// ---------- modo local ----------
type LocalUser = CustomerUser & { passcode?: string | null; invite_token?: string | null; google_email?: string | null };
const LS_USERS = "xmedia:customerUsers";
const LS_SESSION = "xmedia:portalSession"; // id do utilizador
const usersAll = () => readLS<LocalUser[]>(LS_USERS, []);
const writeUsers = (l: LocalUser[]) => writeLS(LS_USERS, l);
const patchUser = (id: string, p: Partial<LocalUser>) => writeUsers(usersAll().map((u) => (u.id === id ? { ...u, ...p } : u)));
const pub = ({ passcode, invite_token: _t, google_email: g, ...u }: LocalUser): CustomerUser => ({ ...u, passcode_set: !!passcode, email_verified: !!g });
const customers = () => readLS<Customer[]>(LS_CUSTOMERS, []).map(normalizeCustomer);
/** Escreve campos do servidor (portal/instagram) diretamente, como faria a service role. */
function patchCustomer(id: string, f: (c: Customer) => Customer) {
  writeLS(
    LS_CUSTOMERS,
    readLS<Customer[]>(LS_CUSTOMERS, []).map((c) => (c.id === id ? { ...f(normalizeCustomer(c)), updated_at: new Date().toISOString() } : c))
  );
}
function refreshSummary(customerId: string) {
  const list = usersAll().filter((u) => u.customer_id === customerId);
  patchCustomer(customerId, (c) =>
    c.portal.status === "disabled"
      ? c
      : {
          ...c,
          portal: {
            ...c.portal,
            status: list.some((u) => u.status === "active") ? "active" : list.some((u) => u.status === "invited") ? "invited" : "none",
            passcode_set: list.some((u) => u.status === "active" && !!u.passcode),
          },
        }
  );
}
const session = () => {
  try {
    return localStorage.getItem(LS_SESSION);
  } catch {
    return null;
  }
};
function byToken(token: string) {
  const u = usersAll().find((x) => x.invite_token === token);
  const c = u ? customers().find((x) => x.id === u.customer_id) : null;
  if (!u || !c) throw new ApiError("invalid");
  if (u.status === "disabled" || c.portal.status === "disabled") throw new ApiError("disabled");
  if (!u.invite_expires_at || new Date(u.invite_expires_at) < new Date()) throw new ApiError("expired");
  return { u, c };
}
function current() {
  const id = session();
  const u = id ? usersAll().find((x) => x.id === id) : null;
  const c = u ? customers().find((x) => x.id === u.customer_id) : null;
  if (!u || !c || u.status !== "active" || c.portal.status === "disabled") throw new ApiError("unauthorized");
  return { u, c };
}
function activate(u: LocalUser, p: Partial<LocalUser>) {
  const now = new Date().toISOString();
  patchUser(u.id, { ...p, status: "active", invite_token: null, invite_expires_at: null, registered_at: u.registered_at ?? now, last_login_at: now });
  refreshSummary(u.customer_id);
  localStorage.setItem(LS_SESSION, u.id);
}
function localNoteEdit(postId: string, f: (p: ContentPost) => ContentPost) {
  const { u, c } = current();
  if (!canReview(u.role)) throw new ApiError("read_only");
  const all = readLS<ContentPost[]>(LS_POSTS, []);
  const raw = all.find((x) => x.id === postId && x.customer_id === c.id);
  if (!raw) throw new ApiError("not_found");
  const p = normalizePost(raw);
  if (p.status !== "review") throw new ApiError("not_in_review");
  let next: ContentPost;
  try {
    next = f(p);
  } catch (e) {
    throw e instanceof ApiError ? e : new ApiError("text_required");
  }
  writeLS(LS_POSTS, all.map((x) => (x.id === postId ? { ...next, updated_at: new Date().toISOString() } : x)));
  return clientView(next);
}

const local: PortalApi = {
  async checkInvite(token) {
    const { u, c } = byToken(token);
    return { name: c.name, person: u.name, email: u.email, role: u.role, lang: c.lang, expiresAt: u.invite_expires_at! };
  },
  async acceptInvite(token, email) {
    const { u } = byToken(token);
    const g = (email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g)) throw new ApiError("bad_email");
    activate(u, { google_email: g });
  },
  async acceptWithCode(token, code) {
    const { u } = byToken(token);
    if (!validPasscode(code)) throw new ApiError("bad_passcode");
    activate(u, { passcode: code });
    return { to: "/portal/bem-vindo" };
  },
  async google(email) {
    const g = (email ?? "").trim().toLowerCase();
    const u = usersAll().find((x) => x.status === "active" && (x.google_email === g || x.email === g));
    if (!u) throw new ApiError("no_account");
    localStorage.setItem(LS_SESSION, u.id);
  },
  async linkGoogle() {
    // modo local: simula o Google com o email do convite
    const { u } = current();
    patchUser(u.id, { google_email: u.email });
  },
  async setPasscode(code) {
    const { u } = current();
    if (!validPasscode(code)) throw new ApiError("bad_passcode");
    patchUser(u.id, { passcode: code });
    refreshSummary(u.customer_id);
  },
  async login(email, code) {
    const e = email.trim().toLowerCase();
    for (const u of usersAll().filter((x) => x.status === "active" && (x.email === e || x.google_email === e))) {
      const c = customers().find((x) => x.id === u.customer_id);
      if (!c || c.portal.status === "disabled" || !u.passcode || u.passcode !== code) continue;
      patchUser(u.id, { last_login_at: new Date().toISOString() });
      localStorage.setItem(LS_SESSION, u.id);
      return { name: c.name, lang: c.lang };
    }
    throw new ApiError("bad_passcode");
  },
  async logout() {
    localStorage.removeItem(LS_SESSION);
  },
  async me() {
    const { u, c } = current();
    const s = await customerStore.settings();
    const { notes: _n, ...cust } = c;
    const customer = { ...cust, tasks: clientTasks(c.tasks) };
    const posts = readLS<ContentPost[]>(LS_POSTS, [])
      .filter((p) => p.customer_id === c.id && visibleToClient(p))
      .map(normalizePost)
      .map(clientView)
      .sort((a, b) => (a.scheduled_at || "9999").localeCompare(b.scheduled_at || "9999"));
    return {
      customer,
      me: { id: u.id, name: u.name, email: u.email, role: u.role, passcode_set: !!u.passcode, email_verified: !!u.google_email },
      posts,
      info: { studio_hours: s.studio_hours, contact_email: s.contact_email, contact_phone: s.contact_phone, delivery_days: s.delivery_days, fee: monthlyFee(c, s), currency: "EUR", igConnect: false, process: s.process, contract_signed: c.contract_signed },
    };
  },
  async review(postId, action, text) {
    const { u, c } = current();
    if (!canReview(u.role)) throw new ApiError("read_only");
    const all = readLS<ContentPost[]>(LS_POSTS, []);
    const p = all.find((x) => x.id === postId && x.customer_id === c.id);
    if (!p) throw new ApiError("not_found");
    let next: ContentPost;
    try {
      next = clientReview(normalizePost(p), action, text, undefined, u.name || u.email);
    } catch (e) {
      throw new ApiError(e instanceof Error && e.message === "text_required" ? "text_required" : "not_in_review");
    }
    writeLS(LS_POSTS, all.map((x) => (x.id === postId ? { ...next, updated_at: new Date().toISOString() } : x)));
  },
  async note(postId, note) {
    const { u } = current();
    return localNoteEdit(postId, (p) => addNote(p, { ...note, by: "client", author: u.name || u.email }));
  },
  async removeNote(postId, noteId) {
    return localNoteEdit(postId, (p) => {
      const n = p.notes.find((x) => x.id === noteId);
      if (!n || n.by !== "client") throw new ApiError("not_found");
      return patchNote(p, noteId, { deleted: true });
    });
  },
  async moveNote(postId, noteId, to) {
    return localNoteEdit(postId, (p) => {
      const n = p.notes.find((x) => x.id === noteId);
      const m = cleanMove(p, to);
      if (!n || n.by !== "client" || !m) throw new ApiError("not_found");
      return patchNote(p, noteId, m);
    });
  },
  async setHandle(handle) {
    const { u, c } = current();
    if (!canManageInstagram(u.role)) throw new ApiError("owner_only");
    const h = cleanHandle(handle);
    if (!validHandle(h)) throw new ApiError("bad_handle");
    patchCustomer(c.id, (x) => ({ ...x, instagram: { ...x.instagram, handle: h } }));
  },
  async syncInstagram() {
    throw new ApiError("ig_not_configured");
  },
  async team() {
    return local.users(current().c.id);
  },
  async teamAction(a) {
    const { u: me, c } = current();
    if (me.role !== "owner") throw new ApiError("owner_only");
    const users = await local.users(c.id);
    const target = a.id ? users.find((x) => x.id === a.id) : null;
    const owners = users.filter((x) => x.role === "owner" && x.status !== "disabled");
    if (target?.id === me.id && (a.action === "remove" || (a.action === "save" && a.role !== "owner"))) throw new ApiError("not_self");
    if (target?.role === "owner" && owners.length <= 1 && (a.action === "remove" || a.role !== "owner")) throw new ApiError("last_owner");
    if (a.action === "remove") return { users: await local.removeUser(c.id, a.id!) };
    if (a.action === "invite") {
      const invite = await local.invite(c.id, a.id!, a.send);
      return { invite, users: await local.users(c.id) };
    }
    return { users: await local.saveUser(c.id, { id: a.id, name: a.name ?? "", email: a.email ?? "", role: a.role ?? "member" }) };
  },
  async saveBrand(brand) {
    const { u, c } = current();
    if (u.role === "viewer") throw new ApiError("read_only");
    const b = { ...normalizeBrand(brand, c.name), updated_at: new Date().toISOString() };
    patchCustomer(c.id, (x) => ({ ...x, brand: b }));
    return b;
  },
  async saveCompany(kind, billing) {
    const { u, c } = current();
    if (u.role !== "owner") throw new ApiError("owner_only");
    const base = c.billing ?? { company: "", contact: "", address: "", country: "NL", vat: "", kvk: "", email: "" };
    const next = { ...base, ...billing } as Billing;
    patchCustomer(c.id, (x) => ({ ...x, kind, billing: next, company_updated_at: new Date().toISOString() }));
    return { kind, billing: next };
  },
  async saveTasks(tasks) {
    const { u, c } = current();
    if (u.role === "viewer") throw new ApiError("read_only");
    const cur = c.tasks ?? [];
    const allowed = tasks.map((x) => normalizeTask(x)).filter((x): x is Task => !!x && !cur.find((y) => y.id === x.id && y.internal));
    const merged = mergeTasks(cur, allowed);
    patchCustomer(c.id, (x) => ({ ...x, tasks: merged }));
    return clientTasks(merged);
  },
  async saveBoards(boards) {
    const { u, c } = current();
    if (u.role === "viewer") throw new ApiError("read_only");
    const merged = mergeBoards(c.moodboards, normalizeBoards(boards));
    patchCustomer(c.id, (x) => ({ ...x, moodboards: merged }));
    return merged;
  },
  async saveRefs(refs) {
    const { u, c } = current();
    if (u.role === "viewer") throw new ApiError("read_only");
    const merged = mergeRefs(c.references, normalizeRefs(refs));
    patchCustomer(c.id, (x) => ({ ...x, references: merged }));
    return merged;
  },
  async upload(file) {
    return fileToDataUrl(file);
  },
  async linkPreview(url) {
    return localPreview(url);
  },
  async saveDraft(d) {
    const { u, c } = current();
    if (!canReview(u.role)) throw new ApiError("read_only");
    const all = readLS<ContentPost[]>(LS_POSTS, []);
    const cur = d.id ? all.find((x) => x.id === d.id && x.customer_id === c.id) ?? null : null;
    let next: ContentPost;
    try {
      next = clientDraft(cur ? normalizePost(cur) : null, c.id, d, u.email);
    } catch {
      throw new ApiError("not_a_draft");
    }
    next = { ...next, updated_at: new Date().toISOString() };
    writeLS(LS_POSTS, cur ? all.map((x) => (x.id === next.id ? next : x)) : [...all, next]);
    return next;
  },
  async deleteDraft(id) {
    const { c } = current();
    const all = readLS<ContentPost[]>(LS_POSTS, []);
    const cur = all.find((x) => x.id === id && x.customer_id === c.id);
    if (!cur?.client_draft || cur.status !== "idea") throw new ApiError("not_a_draft");
    writeLS(LS_POSTS, all.filter((x) => x.id !== id));
  },
  async validate(postId, key, value) {
    const { u, c } = current();
    if (!canReview(u.role)) throw new ApiError("read_only");
    const all = readLS<ContentPost[]>(LS_POSTS, []);
    const raw = all.find((x) => x.id === postId && x.customer_id === c.id);
    if (!raw) throw new ApiError("not_found");
    const p = normalizePost(raw);
    if (p.status !== "review") throw new ApiError("not_in_review");
    const validation = { ...(p.validation ?? {}) };
    if (value) validation[key] = value;
    else delete validation[key];
    writeLS(LS_POSTS, all.map((x) => (x.id === postId ? { ...p, validation, updated_at: new Date().toISOString() } : x)));
    return validation;
  },
  async billing() {
    const { u, c } = current();
    if (u.role === "viewer") throw new ApiError("read_only");
    const company = (c.billing?.company || c.name).toLowerCase();
    return readLS<Invoice[]>("xmedia:invoices", [])
      .map((i) => normalizeInvoice(i))
      .filter((i) => !i.void && i.status !== "draft" && (i.customer_id === c.id || (!i.customer_id && i.client.name.toLowerCase().startsWith(company))))
      .sort((a, b) => b.issue_date.localeCompare(a.issue_date))
      .map((i) => ({ id: i.id, number: i.number, issue_date: i.issue_date, status: i.status as "sent" | "paid", currency: i.currency, total: totals(i).total, due_days: i.payment.termsDays }));
  },
  async users(customerId) {
    return usersAll()
      .filter((u) => u.customer_id === customerId)
      .map(pub);
  },
  async saveUser(customerId, input) {
    if (input.id) patchUser(input.id, { name: input.name.trim(), role: input.role });
    else {
      const email = input.email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError("bad_email");
      if (usersAll().some((u) => u.customer_id === customerId && u.email === email)) throw new ApiError("email_in_use");
      writeUsers([
        ...usersAll(),
        { id: crypto.randomUUID(), customer_id: customerId, email, name: input.name.trim(), role: input.role, status: "invited", created_at: new Date().toISOString() },
      ]);
    }
    refreshSummary(customerId);
    return local.users(customerId);
  },
  async removeUser(customerId, userId) {
    writeUsers(usersAll().filter((u) => u.id !== userId));
    refreshSummary(customerId);
    return local.users(customerId);
  },
  async invite(customerId, userId) {
    const c = customers().find((x) => x.id === customerId);
    const u = usersAll().find((x) => x.id === userId && x.customer_id === customerId);
    if (!c || !u) throw new ApiError("not_found");
    if (c.portal.status === "disabled" || u.status === "disabled") throw new ApiError("disabled");
    const token = randomToken();
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
    patchUser(u.id, { invite_token: token, invite_expires_at: expiresAt, invited_at: new Date().toISOString(), status: u.status === "active" ? "active" : "invited" });
    refreshSummary(customerId);
    return { link: `${location.origin}/portal/convite/${token}`, expiresAt, email: { sent: false, reason: "local_mode" } };
  },
  async access(customerId, action, userId) {
    if (userId) {
      patchUser(userId, action === "reset" ? { passcode: null } : { status: action === "disable" ? "disabled" : "active" });
      if (action === "disable" && session() === userId) localStorage.removeItem(LS_SESSION);
    } else patchCustomer(customerId, (x) => ({ ...x, portal: { ...x.portal, status: action === "disable" ? "disabled" : "none" } }));
    refreshSummary(customerId);
  },
  async adminSync() {
    throw new ApiError("ig_not_configured");
  },
  async publishNow() {
    return { ok: false, error: "local_mode" };
  },
  async status() {
    return { instagram: false, email: false, cron: false, local: true };
  },
};

export const portalApi: PortalApi = supabaseEnabled ? remote : local;
export const portalLocal = !supabaseEnabled;

/** Dispositivo lembrado (como o ecrã de bloqueio): nome + email para pedir só o código. */
const LS_WHO = "xmedia:portal:who";
export type Who = { name: string; email: string; len?: number };
export const rememberWho = (w: Who | null) => {
  try {
    if (w) localStorage.setItem(LS_WHO, JSON.stringify(w));
    else localStorage.removeItem(LS_WHO);
  } catch {}
};
export const readWho = () => readLS<Who | null>(LS_WHO, null);
