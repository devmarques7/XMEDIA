// Servidor do portal do cliente: sessão (cookie assinado), hash do código de 4–6 dígitos,
// cifra do token do Instagram e leitura dos dados do cliente com a service role.
import { applyAssignRules, normalizeRules } from "@/lib/assignRules";
import { clientTasks } from "@/lib/tasks";
import { cookies } from "next/headers";
import { CLIENT_COOKIE, CLIENT_PREFIX, SESSION_DAYS, sha256, signSession, verifySession } from "@/lib/codes";
import { monthlyFee, visibleToClient as isVisibleToClient, normalizeCustomer, normalizePost, normalizeSettings, type ContentPost, type Customer, type CustomerUser } from "@/lib/customer";
import { HttpError, serviceClient, sessionSecret } from "./admin";

/** Hash do código de um utilizador do portal (o id do utilizador entra no hash). */
export const hashPasscode = (userId: string, code: string) => sha256(`portal:${sessionSecret()}:${userId}:${code}`);

/** Sessão do portal = um utilizador (pessoa) de um cliente. */
export async function setClientCookie(userId: string) {
  (await cookies()).set(CLIENT_COOKIE, await signSession(CLIENT_PREFIX + userId, sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}
export async function clearClientCookie() {
  (await cookies()).delete(CLIENT_COOKIE);
}

const USER_COLS = "id, customer_id, email, google_email, name, role, status, passcode_hash, invited_at, invite_expires_at, registered_at, last_login_at, created_at";
type UserRow = CustomerUser & { passcode_hash: string | null; google_email?: string | null };
export const publicUser = (u: UserRow): CustomerUser => {
  const { passcode_hash, google_email, ...rest } = u;
  // email validado = entrou pelo menos uma vez com a conta Google
  return { ...rest, passcode_set: !!passcode_hash, email_verified: !!google_email };
};

export async function loadCustomerUser(id: string): Promise<UserRow | null> {
  const { data } = await serviceClient().from("customer_users").select(USER_COLS).eq("id", id).maybeSingle();
  return (data as UserRow) ?? null;
}
export async function listCustomerUsers(customerId: string): Promise<CustomerUser[]> {
  const { data } = await serviceClient().from("customer_users").select(USER_COLS).eq("customer_id", customerId).order("created_at");
  return ((data ?? []) as UserRow[]).map(publicUser);
}

/**
 * Utilizador do portal com sessão válida e ativo, e o cliente dele (não bloqueado).
 * Todas as rotas /api/portal/* partem daqui: o customer_id vem SEMPRE do utilizador, nunca do pedido.
 */
export async function requireCustomer() {
  const v = await verifySession((await cookies()).get(CLIENT_COOKIE)?.value, sessionSecret());
  if (!v?.startsWith(CLIENT_PREFIX)) throw new HttpError(401, "unauthorized");
  const user = await loadCustomerUser(v.slice(CLIENT_PREFIX.length));
  if (!user || user.status !== "active") throw new HttpError(401, "unauthorized");
  const row = await loadCustomer(user.customer_id);
  if (!row || row.customer.portal.status === "disabled") throw new HttpError(401, "unauthorized");
  return { ...row, user: publicUser(user) };
}

/** Resumo do acesso no documento do cliente (para listas e kanban): ativo / convidado / sem acesso. */
export async function refreshPortalSummary(customerId: string) {
  const users = await listCustomerUsers(customerId);
  await patchCustomer(customerId, (c) => {
    if (c.portal.status === "disabled") return c;
    const active = users.filter((u) => u.status === "active");
    const last = active.map((u) => u.last_login_at ?? "").sort().at(-1) || c.portal.last_login_at;
    return {
      ...c,
      portal: {
        ...c.portal,
        status: active.length ? "active" : users.some((u) => u.status === "invited") ? "invited" : "none",
        passcode_set: active.some((u) => u.passcode_set),
        last_login_at: last || undefined,
        registered_at: c.portal.registered_at ?? active[0]?.registered_at ?? undefined,
      },
    };
  });
}

export async function loadCustomer(id: string) {
  const { data } = await serviceClient().from("customers").select("id, owner_id, data, created_at, updated_at").eq("id", id).maybeSingle();
  if (!data) return null;
  return { owner_id: data.owner_id as string, customer: normalizeCustomer({ ...data.data, id: data.id, created_at: data.created_at, updated_at: data.updated_at }) };
}

/** Atualiza campos do documento do cliente (portal, instagram…) sem tocar no resto. */
export async function patchCustomer(id: string, f: (c: Customer) => Customer) {
  const row = await loadCustomer(id);
  if (!row) throw new HttpError(404, "not_found");
  const next = f(row.customer);
  const { created_at: _c, updated_at: _u, ...doc } = next;
  const { error } = await serviceClient().from("customers").update({ data: doc, name: next.name, email: next.email, stage: next.stage }).eq("id", id);
  if (error) throw error;
  return next;
}

export async function loadPosts(customerId: string, visibleToClient = false): Promise<ContentPost[]> {
  const q = serviceClient().from("customer_posts").select("id, customer_id, data, created_at, updated_at").eq("customer_id", customerId);
  const { data, error } = await q.order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  const all = (data ?? []).map((r) => normalizePost({ ...r.data, id: r.id, customer_id: r.customer_id, created_at: r.created_at, updated_at: r.updated_at }));
  // o lixo nunca aparece; o cliente não vê as ideias internas, mas vê os rascunhos que ele próprio planeou
  const live = all.filter((p) => !p.deleted_at);
  return visibleToClient ? live.filter(isVisibleToClient) : live;
}

export async function savePostServer(post: ContentPost) {
  // automação de responsáveis também nas mudanças feitas no servidor (aprovação do cliente, publicação)
  const db = serviceClient();
  const { data: old } = await db.from("customer_posts").select("id, customer_id, data").eq("id", post.id).maybeSingle();
  const { data: cust } = await db.from("customers").select("owner_id").eq("id", post.customer_id).maybeSingle();
  let p = post;
  if (cust?.owner_id) {
    const s = await loadSettings(cust.owner_id).catch(() => null);
    p = applyAssignRules(old ? normalizePost({ ...old.data, id: old.id, customer_id: old.customer_id }) : null, post, normalizeRules(s?.assign_rules));
  }
  const { created_at: _c, updated_at: _u, ...doc } = p;
  const { error } = await serviceClient().from("customer_posts").update({ status: p.status, scheduled_at: p.scheduled_at || null, data: doc }).eq("id", p.id);
  if (error) throw error;
}

export async function loadSettings(ownerId: string) {
  const { data } = await serviceClient().from("app_settings").select("data").eq("owner_id", ownerId).maybeSingle();
  return normalizeSettings(data?.data);
}

/** O que o cliente vê de um post: sem notas internas do estúdio nem apagadas. */
export const clientPost = (p: ContentPost): ContentPost => ({ ...p, notes: p.notes.filter((n) => n.by === "client" && !n.deleted) });

export async function portalPayload(owner_id: string, customer: Customer, me: CustomerUser) {
  const s = await loadSettings(owner_id);
  const { notes: _n, ...pub } = customer;
  return {
    customer: { ...pub, tasks: clientTasks(customer.tasks) },
    me: { id: me.id, name: me.name, email: me.email, role: me.role, passcode_set: !!me.passcode_set, email_verified: !!me.email_verified },
    posts: (await loadPosts(customer.id, true)).map(clientPost),
    info: {
      studio_hours: s.studio_hours,
      contact_email: s.contact_email,
      contact_phone: s.contact_phone,
      delivery_days: s.delivery_days,
      fee: monthlyFee(customer, s),
      currency: "EUR" as const,
      igConnect: Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
      process: s.process,
      contract_signed: customer.contract_signed,
    },
  };
}

// ---------- cifra AES-GCM para o token do Instagram ----------
async function aesKey() {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`igtoken:${sessionSecret()}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64url");
export async function seal(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function unseal(sealed: string) {
  const [iv, ct] = sealed.split(".").map((s) => new Uint8Array(Buffer.from(s, "base64url")));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await aesKey(), ct));
}
