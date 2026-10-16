// Pedidos assinados da Meta (deauthorize / data deletion): "assinatura.payload" em base64url, HMAC-SHA256 com o app secret.
import { serviceClient } from "./admin";
import { patchCustomer } from "./portal";

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export async function parseSignedRequest(signed: string, secret: string): Promise<{ user_id?: string } | null> {
  const [sig, payload] = signed.split(".");
  if (!sig || !payload || !secret) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("HMAC", key, b64(sig), new TextEncoder().encode(payload));
  if (!ok) return null;
  try {
    return JSON.parse(b64(payload).toString("utf8"));
  } catch {
    return null;
  }
}

/** Apaga o token e os dados do Instagram do cliente com esta conta. Devolve quantos clientes foram afetados. */
export async function forgetInstagramUser(igUserId: string) {
  const db = serviceClient();
  const { data } = await db.from("customer_access").select("customer_id").eq("ig_user_id", igUserId);
  for (const r of data ?? []) {
    await db.from("customer_access").update({ ig_token: null, ig_token_expires_at: null, ig_user_id: null }).eq("customer_id", r.customer_id);
    await patchCustomer(r.customer_id, (c) => ({ ...c, instagram: { handle: c.instagram.handle, connected: false } }));
  }
  return data?.length ?? 0;
}

export async function readSigned(req: Request) {
  const form = await req.formData().catch(() => null);
  const signed = String(form?.get("signed_request") ?? "");
  return parseSignedRequest(signed, process.env.INSTAGRAM_APP_SECRET ?? "");
}
