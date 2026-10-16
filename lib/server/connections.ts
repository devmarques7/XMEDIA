// Ligações MCP no servidor: leitura/gravação em app_settings.data.connections, autorização OAuth segundo a
// especificação MCP (descoberta RFC 9728 / RFC 8414, registo dinâmico RFC 7591, PKCE S256) e a lista de
// servidores para o pedido ao Claude (mcp_servers + mcp_toolset), com os tokens renovados quando expiram.
import type Anthropic from "@anthropic-ai/sdk";
import { normalizeConnections, type Connection } from "../connections";
import { HttpError, serviceClient } from "./admin";
import { decrypt, encrypt } from "./vault";

/** cookie temporário (cifrado) entre o início da autorização e a volta */
export const OAUTH_COOKIE = "xm_conn_oauth";

type Secret = { access?: string; refresh?: string; expires_at?: number; client_id?: string; client_secret?: string; token_endpoint?: string };
const aad = (c: Pick<Connection, "id">) => `conn:${c.id}`;

export async function loadConnections(owner: string): Promise<Connection[]> {
  const { data } = await serviceClient().from("app_settings").select("data").eq("owner_id", owner).maybeSingle();
  return normalizeConnections(data?.data?.connections);
}

/** Grava a lista inteira (relê o documento para não apagar o resto das definições). */
export async function saveConnections(owner: string, list: Connection[]) {
  const db = serviceClient();
  const { data } = await db.from("app_settings").select("data").eq("owner_id", owner).maybeSingle();
  const { error } = await db.from("app_settings").upsert({ owner_id: owner, data: { ...(data?.data ?? {}), connections: list }, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function updateConnection(owner: string, id: string, patch: (c: Connection) => Connection | null) {
  const list = await loadConnections(owner);
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) throw new HttpError(404, "not_found");
  const next = patch(list[i]);
  const out = next ? list.map((c, j) => (j === i ? next : c)) : list.filter((_, j) => j !== i);
  await saveConnections(owner, out);
  return next;
}

export const sealSecret = async (c: Pick<Connection, "id">, s: Secret) => encrypt(JSON.stringify(s), aad(c));
const openSecret = async (c: Connection): Promise<Secret> => (c.secret ? JSON.parse(await decrypt(c.secret, aad(c))) : {});

// ---------- OAuth (especificação de autorização MCP) ----------
type Meta = { authorization_endpoint: string; token_endpoint: string; registration_endpoint?: string; scopes_supported?: string[] };

async function getJson(url: string) {
  const r = await fetch(url, { headers: { Accept: "application/json", "MCP-Protocol-Version": "2025-06-18" }, signal: AbortSignal.timeout(10_000) });
  return r.ok ? r.json() : null;
}

/** Descobre o servidor de autorização: recurso protegido (RFC 9728) → metadados (RFC 8414 / OIDC). */
export async function discover(serverUrl: string): Promise<{ meta: Meta; scope?: string }> {
  const u = new URL(serverUrl);
  let authServer = u.origin;
  let scope: string | undefined;
  // 1) o próprio servidor indica onde estão os metadados no 401
  let prmUrl: string | undefined;
  try {
    const r = await fetch(serverUrl, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "XMEDIA", version: "1" } } }), signal: AbortSignal.timeout(10_000) });
    const m = /resource_metadata="([^"]+)"/.exec(r.headers.get("www-authenticate") ?? "");
    if (m) prmUrl = m[1];
  } catch {}
  const path = u.pathname.replace(/\/$/, "");
  const prm = (prmUrl && (await getJson(prmUrl))) || (path && (await getJson(`${u.origin}/.well-known/oauth-protected-resource${path}`))) || (await getJson(`${u.origin}/.well-known/oauth-protected-resource`));
  if (prm?.authorization_servers?.[0]) authServer = String(prm.authorization_servers[0]).replace(/\/$/, "");
  if (Array.isArray(prm?.scopes_supported) && prm.scopes_supported.length) scope = prm.scopes_supported.join(" ");
  // 2) metadados do servidor de autorização (com e sem caminho)
  const as = new URL(authServer);
  const asPath = as.pathname.replace(/\/$/, "");
  const meta: Meta | null =
    (await getJson(`${as.origin}/.well-known/oauth-authorization-server${asPath}`)) ||
    (asPath && (await getJson(`${as.origin}/.well-known/oauth-authorization-server`))) ||
    (await getJson(`${as.origin}/.well-known/openid-configuration${asPath}`)) ||
    (await getJson(`${authServer}/.well-known/openid-configuration`));
  if (!meta?.authorization_endpoint || !meta?.token_endpoint) throw new HttpError(400, "oauth_unsupported");
  return { meta, scope };
}

/** Registo dinâmico do cliente (RFC 7591). */
export async function register(meta: Meta, redirectUri: string) {
  if (!meta.registration_endpoint) throw new HttpError(400, "oauth_no_registration");
  const r = await fetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_name: "XMEDIA Studio", redirect_uris: [redirectUri], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.client_id) throw new HttpError(502, "oauth_register_failed");
  return { client_id: String(j.client_id), client_secret: j.client_secret ? String(j.client_secret) : undefined };
}

const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
export function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  return { verifier, challenge: crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(b64url) };
}

async function tokenRequest(endpoint: string, body: Record<string, string | undefined>) {
  const form = new URLSearchParams(Object.entries(body).filter((e): e is [string, string] => !!e[1]));
  const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: form, signal: AbortSignal.timeout(15_000) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.access_token) throw new HttpError(502, j?.error ? `oauth_${j.error}` : "oauth_token_failed");
  return j as { access_token: string; refresh_token?: string; expires_in?: number };
}

export async function exchangeCode(p: { token_endpoint: string; client_id: string; client_secret?: string; code: string; verifier: string; redirect_uri: string; resource: string }): Promise<Secret> {
  const t = await tokenRequest(p.token_endpoint, { grant_type: "authorization_code", code: p.code, redirect_uri: p.redirect_uri, client_id: p.client_id, client_secret: p.client_secret, code_verifier: p.verifier, resource: p.resource });
  return { access: t.access_token, refresh: t.refresh_token, expires_at: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined, client_id: p.client_id, client_secret: p.client_secret, token_endpoint: p.token_endpoint };
}

/** Token válido para a ligação (renova com o refresh token quando falta menos de 1 min). */
async function accessToken(owner: string, c: Connection): Promise<string | undefined> {
  if (c.auth === "none") return undefined;
  const s = await openSecret(c);
  if (!s.access) return undefined;
  if (!s.expires_at || s.expires_at > Date.now() + 60_000 || !s.refresh || !s.token_endpoint) return s.access;
  try {
    const t = await tokenRequest(s.token_endpoint, { grant_type: "refresh_token", refresh_token: s.refresh, client_id: s.client_id, client_secret: s.client_secret, resource: c.url });
    const next: Secret = { ...s, access: t.access_token, refresh: t.refresh_token ?? s.refresh, expires_at: t.expires_in ? Date.now() + t.expires_in * 1000 : undefined };
    const secret = await sealSecret(c, next);
    await updateConnection(owner, c.id, (x) => ({ ...x, secret, error: undefined }));
    return next.access;
  } catch (e) {
    await updateConnection(owner, c.id, (x) => ({ ...x, error: (e as Error).message })).catch(() => null);
    return undefined;
  }
}

/** Servidores MCP ativos para o pedido ao Claude. Ligações sem token válido ficam de fora (e não partem o chat). */
export async function mcpForChat(owner: string): Promise<{ servers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[]; toolsets: Anthropic.Beta.BetaMCPToolset[]; names: string[] }> {
  let list: Connection[] = [];
  try {
    list = (await loadConnections(owner)).filter((c) => c.enabled);
  } catch {
    return { servers: [], toolsets: [], names: [] };
  }
  const servers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[] = [];
  const names: string[] = [];
  const used = new Set<string>();
  for (const c of list) {
    let token: string | undefined;
    try {
      token = await accessToken(owner, c);
    } catch {
      continue; // sem VAULT_KEY ou cifra inválida
    }
    if (c.auth !== "none" && !token) continue;
    let name = c.name;
    for (let n = 2; used.has(name); n++) name = `${c.name}-${n}`;
    used.add(name);
    servers.push({ type: "url", url: c.url, name, ...(token ? { authorization_token: token } : {}) });
    names.push(`${name} (${c.label})`);
  }
  return { servers, toolsets: servers.map((s) => ({ type: "mcp_toolset", mcp_server_name: s.name })), names };
}
