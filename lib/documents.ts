// Documentos e assinatura eletrónica. Um documento = ficheiro (PDF/imagem) + destinatários + campos posicionados
// nas páginas + trilho de auditoria. Guardados sem SQL: clientes em customers.data.documents, internos em
// app_settings.data.documents; ficheiros num bucket privado. Funções puras (documents.test.ts).
//
// Assinatura eletrónica (eIDAS, Reg. UE 910/2014): link pessoal por destinatário, verificação do email por código,
// consentimento explícito, registo de IP / user-agent / hora UTC, hash SHA-256 do original e do PDF final, e uma
// página de certificado com o trilho de auditoria. Para assinatura QUALIFICADA (art. 25.º n.º 2) liga-se um
// prestador qualificado (QTSP) — o modelo já tem `provider` para isso.

export const FIELD_TYPES = ["signature", "initials", "name", "email", "company", "title", "date_signed", "date", "textbox", "checkbox", "radio", "image", "drawing", "label", "hyperlink"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
/** Campos preenchidos sozinhos a partir do destinatário / cliente / momento da assinatura. */
export const AUTO_FIELDS: FieldType[] = ["name", "email", "company", "title", "date_signed"];
/** Campos que o admin preenche (fixos no documento, não pedidos ao destinatário). */
export const STATIC_FIELDS: FieldType[] = ["label", "hyperlink", "image"];
export const FIELD_SIZE: Record<FieldType, [number, number]> = {
  signature: [0.24, 0.06], initials: [0.09, 0.05], name: [0.22, 0.03], email: [0.26, 0.03], company: [0.22, 0.03], title: [0.2, 0.03],
  date_signed: [0.14, 0.03], date: [0.14, 0.03], textbox: [0.24, 0.03], checkbox: [0.025, 0.018], radio: [0.025, 0.018],
  image: [0.18, 0.1], drawing: [0.22, 0.08], label: [0.2, 0.025], hyperlink: [0.2, 0.025],
};

export type RecipientRole = "signer" | "approver" | "viewer";
export type RecipientStatus = "pending" | "sent" | "viewed" | "signed" | "declined";
export type Recipient = {
  id: string;
  name: string;
  email: string;
  role: RecipientRole;
  order: number; // ordem de assinatura (1, 2, …) quando signing_order
  lang: "pt" | "en" | "nl";
  company?: string;
  title?: string;
  status: RecipientStatus;
  token_hash?: string; // link pessoal (só o hash)
  otp_hash?: string; // código de verificação por email (só o hash) e validade
  otp_exp?: string;
  otp_tries?: number;
  sent_at?: string;
  viewed_at?: string;
  verified_at?: string; // email verificado por código
  signed_at?: string;
  declined_reason?: string;
};

export type DocField = {
  id: string;
  type: FieldType;
  page: number; // 0-based
  x: number; // 0–1 (fração da largura da página)
  y: number; // 0–1 (fração da altura)
  w: number;
  h: number;
  recipient_id: string; // "" = do remetente (fixo)
  required: boolean;
  label?: string; // texto do label/placeholder; opções do radio separadas por "|"
  value?: string; // valor (texto, "true", data URL da assinatura/imagem, url do hyperlink)
  group?: string; // grupo do radio
};

export type AuditEvent = { at: string; action: "created" | "uploaded" | "sent" | "reminded" | "viewed" | "otp_sent" | "verified" | "signed" | "declined" | "completed" | "voided" | "downloaded"; by: string; ip?: string; ua?: string; detail?: string };

export type DocStatus = "draft" | "sent" | "partially_signed" | "completed" | "declined" | "expired" | "voided";
export type DocFile = { path: string; name: string; mime: string; size: number; pages?: number; sha256?: string };

export type Doc = {
  id: string;
  title: string;
  customer_id: string; // "" = interno
  folder: string; // pasta livre ("Contratos", "Faturas", "Briefings"…)
  tags: string[];
  kind: "file" | "signature";
  file: DocFile; // original
  signed?: DocFile; // PDF final com assinaturas + certificado
  status: DocStatus;
  recipients: Recipient[];
  cc: string[];
  signing_order: boolean;
  message: string;
  fields: DocField[];
  audit: AuditEvent[];
  expires_at?: string;
  /** Visível no portal do cliente (documentos partilhados). */
  shared: boolean;
  uploaded_by: "studio" | "client";
  provider: "xmedia" | "boldsign";
  template?: boolean; // modelo reutilizável (campos + destinatários-tipo)
  created_at: string;
  updated_at: string;
  deleted?: boolean;
};

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();

export function newDoc(p: Partial<Doc> & { title: string; file: DocFile }): Doc {
  const t = now();
  return { id: uid(), customer_id: "", folder: "", tags: [], kind: "file", status: "draft", recipients: [], cc: [], signing_order: false, message: "", fields: [], audit: [{ at: t, action: "uploaded", by: p.uploaded_by ?? "studio" }], shared: false, uploaded_by: "studio", provider: "xmedia", created_at: t, updated_at: t, ...p };
}

export function newRecipient(p: Partial<Recipient> & { order: number }): Recipient {
  return { id: uid(), name: "", email: "", role: "signer", lang: "en", status: "pending", ...p };
}

export function newField(type: FieldType, page: number, x: number, y: number, recipient_id: string): DocField {
  const [w, h] = FIELD_SIZE[type];
  return { id: uid(), type, page, x: clamp(x - w / 2, 0, 1 - w), y: clamp(y - h / 2, 0, 1 - h), w, h, recipient_id: STATIC_FIELDS.includes(type) ? "" : recipient_id, required: !["checkbox", "label", "hyperlink", "image"].includes(type) };
}
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Cores fixas por destinatário (até 6) — campos e chips. */
export const RECIPIENT_COLORS = ["#ff5a1f", "#3d7bff", "#1fae6b", "#b45cff", "#e0a100", "#ff4d8d"];
export const colorOf = (d: Pick<Doc, "recipients">, recipientId: string) => (recipientId ? RECIPIENT_COLORS[Math.max(0, d.recipients.findIndex((r) => r.id === recipientId)) % RECIPIENT_COLORS.length] : "#8a8a8a");

/** Valor automático de um campo para um destinatário (nome, email, empresa, função, data da assinatura). */
export function autoValue(f: DocField, r: Recipient | undefined, at = new Date()): string {
  if (!r) return f.value ?? "";
  if (f.type === "name") return r.name;
  if (f.type === "email") return r.email;
  if (f.type === "company") return r.company ?? "";
  if (f.type === "title") return r.title ?? "";
  if (f.type === "date_signed") return at.toISOString().slice(0, 10);
  return f.value ?? "";
}

/** Quem pode assinar agora (com ordem: só o primeiro por assinar; sem ordem: todos os que faltam). */
export function activeSigners(d: Doc): Recipient[] {
  const left = d.recipients.filter((r) => r.role !== "viewer" && r.status !== "signed" && r.status !== "declined").sort((a, b) => a.order - b.order);
  if (!d.signing_order) return left;
  return left.length ? left.filter((r) => r.order === left[0].order) : [];
}

/** Campos obrigatórios por preencher de um destinatário (valores enviados + automáticos). */
export function missingFields(d: Doc, recipientId: string, values: Record<string, string>): DocField[] {
  return d.fields.filter((f) => f.recipient_id === recipientId && f.required && !AUTO_FIELDS.includes(f.type) && !(values[f.id] ?? "").trim() && f.type !== "radio");
}

/** Estado do documento a partir dos destinatários. */
export function statusOf(d: Doc, at = new Date()): DocStatus {
  if (d.status === "voided" || d.status === "draft") return d.status;
  if (d.recipients.some((r) => r.status === "declined")) return "declined";
  const signers = d.recipients.filter((r) => r.role !== "viewer");
  if (signers.length && signers.every((r) => r.status === "signed")) return "completed";
  if (d.expires_at && new Date(d.expires_at) < at) return "expired";
  return signers.some((r) => r.status === "signed") ? "partially_signed" : "sent";
}

export function audit(d: Doc, e: Omit<AuditEvent, "at">): Doc {
  return { ...d, audit: [...d.audit, { at: now(), ...e }], updated_at: now() };
}

/** Pronto a enviar? Devolve os problemas (sem destinatários, emails inválidos, signatário sem campo de assinatura). */
export function sendProblems(d: Doc): string[] {
  const out: string[] = [];
  const signers = d.recipients.filter((r) => r.role !== "viewer");
  if (!signers.length) out.push("no_signer");
  for (const r of d.recipients) if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) || !r.name.trim()) out.push(`bad_recipient:${r.id}`);
  for (const r of signers) if (!d.fields.some((f) => f.recipient_id === r.id && (f.type === "signature" || f.type === "initials"))) out.push(`no_signature:${r.id}`);
  if (!d.file.mime.includes("pdf")) out.push("not_pdf");
  return out;
}

/** Normaliza uma lista vinda de JSON (cliente ou definições). */
export function normalizeDocs(x: unknown): Doc[] {
  return (Array.isArray(x) ? x : [])
    .filter((d) => d && typeof d.id === "string" && d.file && typeof d.file.path === "string")
    .map((d) => ({ ...newDoc({ title: String(d.title ?? "Document"), file: d.file }), ...d, tags: Array.isArray(d.tags) ? d.tags : [], recipients: Array.isArray(d.recipients) ? d.recipients : [], fields: Array.isArray(d.fields) ? d.fields : [], audit: Array.isArray(d.audit) ? d.audit : [], cc: Array.isArray(d.cc) ? d.cc : [] }));
}

/** Junta por id (o mais recente ganha) — admin e portal podem editar ao mesmo tempo. */
export function mergeDocs(a: Doc[] = [], b: Doc[] = []): Doc[] {
  const m = new Map<string, Doc>();
  for (const d of [...a, ...b]) {
    const cur = m.get(d.id);
    if (!cur || d.updated_at > cur.updated_at) m.set(d.id, d);
  }
  return [...m.values()].sort((x, y) => y.updated_at.localeCompare(x.updated_at));
}

/** O que o cliente vê no portal: partilhados, enviados ao próprio ou carregados por ele; sem tokens. */
export function clientDocs(docs: Doc[] = [], email = ""): Doc[] {
  const e = email.toLowerCase();
  return docs
    .filter((d) => !d.deleted && !d.template && (d.shared || d.uploaded_by === "client" || d.recipients.some((r) => r.email.toLowerCase() === e)))
    .map((d) => ({ ...d, recipients: d.recipients.map(publicRecipient) }));
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Destinatário sem segredos (link e código), para mostrar fora do servidor. */
export const publicRecipient = ({ token_hash: _t, otp_hash: _o, otp_exp: _e, otp_tries: _n, ...r }: Recipient): Recipient => r;
