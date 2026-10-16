// Servidor dos documentos: bucket PRIVADO "documents" (criado pelo próprio sistema, sem SQL), guardar/ler documentos
// nos JSON existentes (cliente ou definições), procurar o destinatário por token e gerar o PDF final assinado.
import { normalizeCustomer, normalizeSettings } from "../customer";
import { mergeDocs, normalizeDocs, type Doc, type Recipient } from "../documents";
import { HttpError, serviceClient } from "./admin";
import { sha256 } from "../codes";

export const DOC_BUCKET = "documents";
export const docTokenHash = (token: string) => sha256(`doc:${token}`);
export const otpHash = (docId: string, rid: string, code: string) => sha256(`otp:${docId}:${rid}:${code}`);

let bucketReady = false;
/** Cria o bucket privado na primeira utilização (API de storage com a chave de serviço — sem SQL). */
export async function ensureBucket() {
  if (bucketReady) return;
  const db = serviceClient();
  const { data } = await db.storage.getBucket(DOC_BUCKET);
  if (!data) {
    const { error } = await db.storage.createBucket(DOC_BUCKET, { public: false, fileSizeLimit: 50 * 1024 * 1024 });
    if (error && !/exists/i.test(error.message)) throw error;
  }
  bucketReady = true;
}

export async function putFile(path: string, body: ArrayBuffer | Uint8Array, mime: string) {
  await ensureBucket();
  const { error } = await serviceClient().storage.from(DOC_BUCKET).upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
}
export async function getFile(path: string): Promise<ArrayBuffer> {
  const { data, error } = await serviceClient().storage.from(DOC_BUCKET).download(path);
  if (error || !data) throw new HttpError(404, "file_missing");
  return data.arrayBuffer();
}
/** Link temporário (10 min) — os ficheiros nunca têm URL pública. */
export async function signedUrl(path: string, download?: string) {
  await ensureBucket();
  const { data, error } = await serviceClient().storage.from(DOC_BUCKET).createSignedUrl(path, 600, download ? { download } : undefined);
  if (error || !data) throw new HttpError(404, "file_missing");
  return data.signedUrl;
}

// ---------- onde vivem os documentos ----------
export async function loadDocs(owner: string, customerId: string): Promise<Doc[]> {
  const db = serviceClient();
  if (customerId) {
    const { data } = await db.from("customers").select("id, owner_id, data").eq("id", customerId).maybeSingle();
    if (!data || data.owner_id !== owner) throw new HttpError(404, "not_found");
    return normalizeDocs(data.data?.documents);
  }
  const { data } = await db.from("app_settings").select("data").eq("owner_id", owner).maybeSingle();
  return normalizeDocs(data?.data?.documents);
}

/** Grava (junta por id, o mais recente ganha) no cliente ou nas definições. */
export async function saveDocs(owner: string, customerId: string, changed: Doc[]) {
  const db = serviceClient();
  if (customerId) {
    const { data } = await db.from("customers").select("id, owner_id, data").eq("id", customerId).maybeSingle();
    if (!data || data.owner_id !== owner) throw new HttpError(404, "not_found");
    const documents = mergeDocs(normalizeDocs(data.data?.documents), changed);
    const { error } = await db.from("customers").update({ data: { ...data.data, documents } }).eq("id", customerId);
    if (error) throw error;
    return documents;
  }
  const { data } = await db.from("app_settings").select("data").eq("owner_id", owner).maybeSingle();
  const s = normalizeSettings(data?.data);
  const documents = mergeDocs(normalizeDocs(s.documents), changed);
  const { error } = await db.from("app_settings").upsert({ owner_id: owner, data: { ...(data?.data ?? {}), documents }, updated_at: new Date().toISOString() });
  if (error) throw error;
  return documents;
}

/** Todos os documentos do dono (internos + de cada cliente), para a visão geral. */
export async function allDocs(owner: string): Promise<{ doc: Doc; customer: string }[]> {
  const db = serviceClient();
  const [{ data: cs }, internal] = await Promise.all([db.from("customers").select("id, data").eq("owner_id", owner), loadDocs(owner, "")]);
  const out = internal.map((doc) => ({ doc, customer: "" }));
  for (const c of cs ?? []) for (const doc of normalizeDocs(c.data?.documents)) out.push({ doc: { ...doc, customer_id: c.id }, customer: normalizeCustomer({ ...c.data, id: c.id }).name });
  return out;
}

/** Encontra o documento e o destinatário a partir do token do link pessoal. */
export async function byToken(token: string): Promise<{ owner: string; doc: Doc; r: Recipient }> {
  if (!/^[\w-]{20,100}$/.test(token)) throw new HttpError(404, "invalid");
  const h = await docTokenHash(token);
  const db = serviceClient();
  const [{ data: cs }, { data: ss }] = await Promise.all([db.from("customers").select("id, owner_id, data"), db.from("app_settings").select("owner_id, data")]);
  const pools: { owner: string; customer: string; docs: unknown }[] = [...(cs ?? []).map((c) => ({ owner: c.owner_id as string, customer: c.id as string, docs: c.data?.documents })), ...(ss ?? []).map((s) => ({ owner: s.owner_id as string, customer: "", docs: s.data?.documents }))];
  for (const p of pools)
    for (const doc of normalizeDocs(p.docs)) {
      const r = doc.recipients.find((x) => x.token_hash === h);
      if (r) return { owner: p.owner, doc: { ...doc, customer_id: p.customer }, r };
    }
  throw new HttpError(404, "invalid");
}

export { finalizePdf } from "../pdfSign";

export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
