// Cofre no servidor: cifra AES-256-GCM com a chave VAULT_KEY (só no Vercel; nunca vai para o browser) e leitura/
// gravação das entradas dentro do cliente (customers.data.vault) ou das definições (app_settings.data.vault).
import { normalizeVault, type Cipher, type VaultEntry } from "../vault";
import { HttpError, serviceClient } from "./admin";

let keyP: Promise<CryptoKey> | null = null;
function key() {
  const raw = process.env.VAULT_KEY;
  if (!raw || raw.length < 24) throw new HttpError(503, "vault_not_configured");
  // a chave pode ser qualquer texto longo: deriva 256 bits com SHA-256
  keyP ??= crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)).then((d) => crypto.subtle.importKey("raw", d, "AES-GCM", false, ["encrypt", "decrypt"]));
  return keyP;
}
const b64 = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

export async function encrypt(plain: string, aad: string): Promise<Cipher> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad) }, await key(), new TextEncoder().encode(plain));
  return { iv: b64(iv), ct: b64(ct) };
}
export async function decrypt(c: Cipher, aad: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(c.iv), additionalData: new TextEncoder().encode(aad) }, await key(), unb64(c.ct));
  return new TextDecoder().decode(pt);
}
/** A cifra fica presa à entrada (id + cliente): não se pode copiar o blob para outra entrada. */
export const aadOf = (e: Pick<VaultEntry, "id" | "customer_id">) => `vault:${e.customer_id || "internal"}:${e.id}`;

export async function loadVault(owner: string, customerId: string): Promise<VaultEntry[]> {
  const db = serviceClient();
  if (customerId) {
    const { data } = await db.from("customers").select("id, owner_id, data").eq("id", customerId).maybeSingle();
    if (!data || data.owner_id !== owner) throw new HttpError(404, "not_found");
    return normalizeVault(data.data?.vault).map((e) => ({ ...e, customer_id: customerId }));
  }
  const { data } = await db.from("app_settings").select("data").eq("owner_id", owner).maybeSingle();
  return normalizeVault(data?.data?.vault).map((e) => ({ ...e, customer_id: "" }));
}

export async function saveVault(owner: string, customerId: string, changed: VaultEntry[]) {
  const db = serviceClient();
  const merge = (cur: VaultEntry[]) => {
    const m = new Map(cur.map((e) => [e.id, e]));
    for (const e of changed) m.set(e.id, e);
    return [...m.values()];
  };
  if (customerId) {
    const { data } = await db.from("customers").select("id, owner_id, data").eq("id", customerId).maybeSingle();
    if (!data || data.owner_id !== owner) throw new HttpError(404, "not_found");
    const vault = merge(normalizeVault(data.data?.vault));
    const { error } = await db.from("customers").update({ data: { ...data.data, vault } }).eq("id", customerId);
    if (error) throw error;
    return vault;
  }
  const { data } = await db.from("app_settings").select("data").eq("owner_id", owner).maybeSingle();
  const vault = merge(normalizeVault(data?.data?.vault));
  const { error } = await db.from("app_settings").upsert({ owner_id: owner, data: { ...(data?.data ?? {}), vault }, updated_at: new Date().toISOString() });
  if (error) throw error;
  return vault;
}

/** Pessoas a quem se pode dar acesso: equipa XMEDIA (membros ativos) e pessoas do cliente. */
export async function grantPeople(owner: string, customerId: string) {
  const db = serviceClient();
  const [{ data: team }, { data: users }] = await Promise.all([
    db.from("team_members").select("name, email, active, status").eq("owner_id", owner),
    customerId ? db.from("customer_users").select("name, email, role, status").eq("customer_id", customerId) : Promise.resolve({ data: [] as { name: string; email: string; role: string; status: string }[] }),
  ]);
  return {
    team: (team ?? []).filter((m) => m.active && m.status !== "disabled" && m.email).map((m) => ({ name: m.name as string, email: (m.email as string).toLowerCase() })),
    client: (users ?? []).filter((u) => u.status !== "disabled").map((u) => ({ name: u.name as string, email: (u.email as string).toLowerCase(), role: u.role as string })),
  };
}
