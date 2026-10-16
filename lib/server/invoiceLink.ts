// Link digital de uma invoice (/i/<token>): qualquer pessoa com o link vê a invoice e o PDF, sem login. O token é
// assinado (HMAC-SHA256) e expira no fim do dia do vencimento do pagamento (hora de Amesterdão). Sem tabelas: mudar
// INVOICE_LINK_SECRET (ou o segredo das sessões) invalida todos os links.
import { createHmac, timingSafeEqual } from "node:crypto";
import { dueDate } from "../invoiceStats";
import { toScheduledIso } from "../contentDrafts";
import type { Invoice } from "../invoice";

const secret = () => {
  const s = process.env.INVOICE_LINK_SECRET || process.env.MEMBER_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!s) throw new Error("Defina INVOICE_LINK_SECRET (ou MEMBER_SESSION_SECRET) na Vercel.");
  return s;
};
const mac = (body: string) => createHmac("sha256", secret()).update(`xmedia-invoice:${body}`).digest("base64url");

/** Fim do dia de vencimento em Amesterdão (23:59:59), em segundos Unix. */
export function linkExpiry(inv: Pick<Invoice, "issue_date" | "payment">) {
  return Math.floor(new Date(toScheduledIso(`${dueDate(inv)} 23:59`)).getTime() / 1000) + 59;
}

export function invoiceToken(inv: Pick<Invoice, "id" | "issue_date" | "payment">, owner: string) {
  const body = Buffer.from(JSON.stringify({ i: inv.id, o: owner, e: linkExpiry(inv) })).toString("base64url");
  return `${body}.${mac(body)}`;
}

/** { id, owner } se o token for válido e não tiver expirado; senão null (com o motivo). */
export function readInvoiceToken(token: string, now = Date.now()): { id: string; owner: string; exp: number } | { error: "invalid" | "expired" } {
  const [body, sig] = String(token ?? "").split(".");
  if (!body || !sig) return { error: "invalid" };
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { error: "invalid" };
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { i: string; o: string; e: number };
    if (!p.i || !p.o || !p.e) return { error: "invalid" };
    if (p.e * 1000 < now) return { error: "expired" };
    return { id: p.i, owner: p.o, exp: p.e };
  } catch {
    return { error: "invalid" };
  }
}

export const invoiceLinkUrl = (origin: string, token: string) => `${origin}/i/${token}`;

/** Destinatários em cópia de todas as invoices: INVOICE_CC (vírgulas) ou contact@mediamarques.com. */
export function invoiceCc(raw = process.env.INVOICE_CC) {
  const list = (raw?.trim() ? raw : "contact@mediamarques.com").split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(x));
  return [...new Set(list)];
}
