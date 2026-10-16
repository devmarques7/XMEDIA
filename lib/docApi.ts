"use client";

// Documentos no browser: com Supabase fala com /api/docs, /api/sign e /api/portal/docs; em modo local guarda tudo
// neste navegador (ficheiros no IndexedDB, documentos no cliente/definições locais) para testar o fluxo completo,
// incluindo assinar e gerar o PDF final.
import { customerStore } from "./customerStore";
import { activeSigners, audit, AUTO_FIELDS, autoValue, clientDocs, missingFields, newDoc, normalizeDocs, publicRecipient, sha256Hex, statusOf, type Doc, type DocFile, type Recipient } from "./documents";
import { uploadMedia } from "./media";
import { finalizePdf } from "./pdfSign";
import { supabaseEnabled } from "./supabase/client";

export type DocRow = { doc: Doc; customer: string };
export type SendLink = { id: string; email: string; link: string; sent: boolean };
export type SignView = { doc: Pick<Doc, "id" | "title" | "status" | "message" | "fields" | "recipients">; me: Pick<Recipient, "id" | "name" | "email" | "role" | "status" | "lang"> & { verified: boolean }; canSign: boolean; file: string; signed: string | null };

class DocError extends Error {}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new DocError(j.error || `http_${r.status}`);
  return j as T;
}

type DocApi = {
  list(customer?: string | "all"): Promise<DocRow[]>;
  save(d: Doc): Promise<Doc>;
  remove(d: Doc): Promise<void>;
  voidDoc(d: Doc): Promise<void>;
  upload(file: File, customer: string): Promise<DocFile>;
  fileUrl(d: Doc, which?: "original" | "signed", download?: boolean): string;
  send(d: Doc, resend?: string): Promise<SendLink[]>;
  // assinatura (público)
  view(token: string): Promise<SignView>;
  otp(token: string): Promise<{ sent: boolean; code?: string }>;
  sign(token: string, p: { code: string; values: Record<string, string>; consent: boolean }): Promise<{ status: string }>;
  decline(token: string, reason: string): Promise<void>;
  // portal do cliente
  portalList(): Promise<Doc[]>;
  portalUpload(file: File, folder: string): Promise<Doc>;
  portalSignLink(id: string): Promise<string>;
  portalFileUrl(d: Doc, which?: "original" | "signed", download?: boolean): string;
};

const remote: DocApi = {
  list: (customer = "all") => api(customer === "all" ? "/api/docs?all=1" : `/api/docs?customer=${encodeURIComponent(customer)}`),
  save: async (doc) => (await api<{ doc: Doc }>("/api/docs", { method: "POST", body: JSON.stringify({ action: "save", doc }) })).doc,
  remove: async (doc) => void (await api("/api/docs", { method: "POST", body: JSON.stringify({ action: "delete", doc }) })),
  voidDoc: async (doc) => void (await api("/api/docs", { method: "POST", body: JSON.stringify({ action: "void", doc }) })),
  async upload(file, customer) {
    const f = new FormData();
    f.append("file", file);
    f.append("customer", customer);
    return api("/api/docs/upload", { method: "POST", body: f });
  },
  fileUrl: (d, which = "original", download) => `/api/docs/file?customer=${encodeURIComponent(d.customer_id)}&id=${d.id}&which=${which}${download ? "&download=1" : ""}`,
  send: async (d, resend) => (await api<{ links: SendLink[] }>("/api/docs/send", { method: "POST", body: JSON.stringify({ customer: d.customer_id, id: d.id, resend }) })).links,
  view: (token) => api(`/api/sign/${encodeURIComponent(token)}`),
  otp: (token) => api(`/api/sign/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ action: "otp" }) }),
  sign: (token, p) => api(`/api/sign/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ action: "sign", ...p }) }),
  decline: async (token, reason) => void (await api(`/api/sign/${encodeURIComponent(token)}`, { method: "POST", body: JSON.stringify({ action: "decline", reason }) })),
  portalList: () => api("/api/portal/docs"),
  async portalUpload(file, folder) {
    const f = new FormData();
    f.append("file", file);
    f.append("folder", folder);
    return api("/api/portal/docs/upload", { method: "POST", body: f });
  },
  portalSignLink: async (id) => (await api<{ link: string }>("/api/portal/docs", { method: "POST", body: JSON.stringify({ action: "sign_link", id }) })).link,
  portalFileUrl: (d, which = "original", download) => `/api/portal/docs/file?id=${d.id}&which=${which}${download ? "&download=1" : ""}`,
};

// ---------- modo local ----------
type LocalRecipient = Recipient & { token?: string; code?: string };
async function localAll(): Promise<{ doc: Doc; customer: string }[]> {
  const [cs, s] = await Promise.all([customerStore.list(), customerStore.settings()]);
  return [...normalizeDocs(s.documents).map((doc) => ({ doc, customer: "" })), ...cs.flatMap((c) => normalizeDocs(c.documents).map((doc) => ({ doc: { ...doc, customer_id: c.id }, customer: c.name })))];
}
async function localSave(d: Doc) {
  const doc = { ...d, updated_at: new Date().toISOString() };
  if (d.customer_id) {
    const c = await customerStore.get(d.customer_id);
    if (!c) throw new DocError("not_found");
    const list = normalizeDocs(c.documents);
    await customerStore.save({ ...c, documents: list.some((x) => x.id === d.id) ? list.map((x) => (x.id === d.id ? doc : x)) : [doc, ...list] });
  } else {
    const s = await customerStore.settings();
    const list = normalizeDocs(s.documents);
    await customerStore.saveSettings({ ...s, documents: list.some((x) => x.id === d.id) ? list.map((x) => (x.id === d.id ? doc : x)) : [doc, ...list] });
  }
  return doc;
}
async function byLocalToken(token: string) {
  for (const { doc } of await localAll()) {
    const r = (doc.recipients as LocalRecipient[]).find((x) => x.token === token);
    if (r) return { doc, r };
  }
  throw new DocError("invalid");
}
async function idbBuffer(src: string): Promise<ArrayBuffer> {
  const { resolveMedia } = await import("./media");
  const url = await resolveMedia(src);
  return (await fetch(url)).arrayBuffer();
}
const localUrl = (f: DocFile) => f.path; // idb:… — resolvido pelos componentes (useMediaSrc)

const local: DocApi = {
  async list(customer = "all") {
    const all = await localAll();
    return customer === "all" ? all : all.filter((x) => x.doc.customer_id === customer);
  },
  save: localSave,
  remove: async (d) => void (await localSave({ ...d, deleted: true })),
  voidDoc: async (d) => void (await localSave(audit({ ...d, status: "voided" }, { action: "voided", by: "studio" }))),
  async upload(file) {
    const m = await uploadMedia(file, "documents");
    return { path: m.src, name: file.name, mime: file.type || "application/octet-stream", size: file.size, sha256: await sha256Hex(await file.arrayBuffer()) };
  },
  fileUrl: (d, which = "original") => localUrl(which === "signed" && d.signed ? d.signed : d.file),
  async send(d, resend) {
    let next: Doc = { ...d, status: d.status === "draft" ? "sent" : d.status };
    const targets = resend ? next.recipients.filter((r) => r.id === resend) : activeSigners(next).concat(next.recipients.filter((r) => r.role === "viewer"));
    const links: SendLink[] = [];
    for (const r of targets) {
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      next = audit({ ...next, recipients: next.recipients.map((x) => (x.id === r.id ? ({ ...x, token, status: x.status === "pending" ? "sent" : x.status, sent_at: new Date().toISOString() } as LocalRecipient) : x)) }, { action: resend ? "reminded" : "sent", by: "studio", detail: r.email });
      links.push({ id: r.id, email: r.email, link: `${location.origin}/assinar/${token}`, sent: false });
    }
    await localSave({ ...next, status: statusOf(next) });
    return links;
  },
  async view(token) {
    const { doc, r } = await byLocalToken(token);
    if (!r.viewed_at) await localSave(audit({ ...doc, recipients: doc.recipients.map((x) => (x.id === r.id ? { ...x, viewed_at: new Date().toISOString(), status: x.status === "sent" ? "viewed" : x.status } : x)) }, { action: "viewed", by: r.email }));
    return { doc: { ...doc, recipients: doc.recipients.map(publicRecipient) }, me: { id: r.id, name: r.name, email: r.email, role: r.role, status: r.status, lang: r.lang, verified: !!r.verified_at }, canSign: activeSigners(doc).some((x) => x.id === r.id), file: localUrl(doc.file), signed: doc.signed ? localUrl(doc.signed) : null };
  },
  async otp(token) {
    const { doc, r } = await byLocalToken(token);
    const code = String(100000 + Math.floor(Math.random() * 900000));
    await localSave(audit({ ...doc, recipients: doc.recipients.map((x) => (x.id === r.id ? ({ ...x, code } as LocalRecipient) : x)) }, { action: "otp_sent", by: r.email }));
    return { sent: false, code }; // modo local: sem email, o código aparece no ecrã
  },
  async sign(token, p) {
    const { doc, r } = await byLocalToken(token);
    if (!activeSigners(doc).some((x) => x.id === r.id)) throw new DocError("not_your_turn");
    if (!p.consent) throw new DocError("consent_required");
    if ((r as LocalRecipient).code !== p.code) throw new DocError("bad_code");
    const missing = missingFields(doc, r.id, p.values);
    if (missing.length) throw new DocError(`missing:${missing[0].id}`);
    const at = new Date();
    let next: Doc = {
      ...doc,
      fields: doc.fields.map((f) => (f.recipient_id !== r.id ? f : { ...f, value: AUTO_FIELDS.includes(f.type) ? autoValue(f, r, at) : p.values[f.id] ?? f.value ?? "" })),
      recipients: doc.recipients.map((x) => (x.id === r.id ? ({ ...x, code: undefined, verified_at: at.toISOString(), signed_at: at.toISOString(), status: "signed" } as LocalRecipient) : x)),
    };
    next = audit(audit(next, { action: "verified", by: r.email, detail: "email code" }), { action: "signed", by: r.email });
    next = { ...next, status: statusOf(next) };
    if (next.status === "completed") {
      const { bytes, sha } = await finalizePdf(next, await idbBuffer(next.file.path));
      const file = new File([bytes as Uint8Array<ArrayBuffer>], `${next.title} (signed).pdf`, { type: "application/pdf" });
      const m = await uploadMedia(file, "documents");
      next = audit({ ...next, signed: { path: m.src, name: file.name, mime: "application/pdf", size: bytes.length, sha256: sha } }, { action: "completed", by: "system", detail: `sha256 ${sha.slice(0, 16)}…` });
    } else {
      for (const x of activeSigners(next).filter((y) => !(y as LocalRecipient).token)) {
        const t = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        next = audit({ ...next, recipients: next.recipients.map((y) => (y.id === x.id ? ({ ...y, token: t, status: "sent", sent_at: new Date().toISOString() } as LocalRecipient) : y)) }, { action: "sent", by: "system", detail: x.email });
      }
    }
    await localSave(next);
    return { status: next.status };
  },
  async decline(token, reason) {
    const { doc, r } = await byLocalToken(token);
    const next = audit({ ...doc, recipients: doc.recipients.map((x) => (x.id === r.id ? { ...x, status: "declined" as const, declined_reason: reason } : x)) }, { action: "declined", by: r.email, detail: reason });
    await localSave({ ...next, status: statusOf(next) });
  },
  async portalList() {
    const { portalApi } = await import("./portalApi");
    const me = await portalApi.me();
    const c = await customerStore.get(me.customer.id);
    return clientDocs(normalizeDocs(c?.documents).map((d) => ({ ...d, customer_id: me.customer.id })), me.me.email);
  },
  async portalUpload(file, folder) {
    const { portalApi } = await import("./portalApi");
    const me = await portalApi.me();
    const f = await local.upload(file, me.customer.id);
    return localSave(audit(newDoc({ title: file.name.replace(/\.[^.]+$/, ""), file: f, customer_id: me.customer.id, folder, uploaded_by: "client", shared: true }), { action: "uploaded", by: me.me.email }));
  },
  async portalSignLink(id) {
    const { portalApi } = await import("./portalApi");
    const me = await portalApi.me();
    const d = (await local.list(me.customer.id)).find((x) => x.doc.id === id)?.doc;
    const r = d?.recipients.find((x) => x.email.toLowerCase() === me.me.email.toLowerCase());
    if (!d || !r) throw new DocError("not_found");
    const [l] = await local.send(d, r.id);
    return new URL(l.link).pathname;
  },
  portalFileUrl: (d, which = "original") => localUrl(which === "signed" && d.signed ? d.signed : d.file),
};

export const docApi: DocApi = supabaseEnabled ? remote : local;
export const docLocal = !supabaseEnabled;
