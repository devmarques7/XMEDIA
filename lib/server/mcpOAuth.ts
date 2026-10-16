// OAuth 2.1 do MCP da XMEDIA (o mesmo fluxo dos conectores do Claude): registo dinâmico do cliente, autorização
// com PKCE (S256) depois do login do administrador, e tokens de acesso/renovação. Sem tabelas: cada artefacto é
// assinado (HMAC-SHA256) com MCP_OAUTH_SECRET (ou o segredo das sessões). Mudar o segredo revoga todos os acessos.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_TTL = 60 * 60; // 1 h
export const REFRESH_TTL = 60 * 60 * 24 * 30; // 30 dias (renova a cada uso)
const CODE_TTL = 10 * 60;
const CLIENT_TTL = 60 * 60 * 24 * 365 * 5;
export const SCOPE = "xmedia";

const secret = () => {
  // o mesmo segredo das sessões (lib/server/admin.ts → sessionSecret) quando não há um próprio
  const s = process.env.MCP_OAUTH_SECRET || process.env.MEMBER_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!s) throw new Error("Defina MCP_OAUTH_SECRET (ou MEMBER_SESSION_SECRET) na Vercel.");
  return s;
};
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (kind: string, body: string) => b64(createHmac("sha256", secret()).update(`xmedia-mcp:${kind}.${body}`).digest());

type Signed = Record<string, unknown> & { exp: number };

function sign(kind: string, payload: Record<string, unknown>, ttl: number) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttl }));
  return `${kind}.${body}.${mac(kind, body)}`;
}

function verify<T extends Signed>(kind: string, token: unknown): T | null {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3 || parts[0] !== kind) return null;
  const want = Buffer.from(mac(kind, parts[1]));
  const got = Buffer.from(parts[2]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as T;
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** Só https, ou http em localhost (Claude Code / Desktop abrem um callback local). */
export function validRedirect(uri: string) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

// ---- registo dinâmico (RFC 7591): o client_id leva os redirect_uris assinados
export function registerClient(input: { redirect_uris?: unknown; client_name?: unknown }) {
  const uris = Array.isArray(input.redirect_uris) ? input.redirect_uris.map(String) : [];
  if (!uris.length || uris.length > 10 || !uris.every(validRedirect)) throw new OAuthError("invalid_redirect_uri", "redirect_uris: https, ou http://localhost");
  const name = String(input.client_name ?? "Cliente MCP").slice(0, 80);
  return { client_id: sign("cl", { r: uris, n: name }, CLIENT_TTL), client_name: name, redirect_uris: uris };
}

export function clientInfo(clientId: unknown) {
  const c = verify<Signed & { r: string[]; n: string }>("cl", clientId);
  if (!c) throw new OAuthError("invalid_client", "client_id inválido ou expirado — volte a ligar o conector");
  return { name: c.n, redirect_uris: c.r };
}

export type AuthRequest = { client_id: string; redirect_uri: string; code_challenge: string; state?: string; scope?: string; resource?: string };

/** Valida o pedido de autorização antes de mostrar o ecrã de consentimento. */
export function checkAuthRequest(q: Record<string, string | undefined>): AuthRequest & { client: string } {
  if (q.response_type !== "code") throw new OAuthError("unsupported_response_type", "response_type tem de ser code");
  const { name, redirect_uris } = clientInfo(q.client_id);
  const redirect = q.redirect_uri ?? (redirect_uris.length === 1 ? redirect_uris[0] : "");
  if (!redirect_uris.includes(redirect)) throw new OAuthError("invalid_request", "redirect_uri não registado para este cliente");
  if (!q.code_challenge || q.code_challenge_method !== "S256") throw new OAuthError("invalid_request", "PKCE S256 obrigatório");
  return { client: name, client_id: q.client_id!, redirect_uri: redirect, code_challenge: q.code_challenge, state: q.state, scope: q.scope, resource: q.resource };
}

/** Código de autorização (10 min) para o administrador que aprovou. */
export function issueCode(r: AuthRequest, owner: string) {
  return sign("code", { c: r.client_id, u: r.redirect_uri, ch: r.code_challenge, o: owner }, CODE_TTL);
}

const s256 = (v: string) => createHash("sha256").update(v).digest("base64url");

function tokens(owner: string, clientId: string) {
  return {
    access_token: sign("at", { o: owner, c: clientId.slice(-24) }, ACCESS_TTL),
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
    refresh_token: sign("rt", { o: owner, c: clientId.slice(-24) }, REFRESH_TTL),
    scope: SCOPE,
  };
}

/** Continua admin? (membros da equipa com papel na plataforma não ligam o MCP do dono.) */
async function stillAdmin(owner: string) {
  const { serviceClient } = await import("./admin");
  const db = serviceClient();
  const [{ data: u }, { data: wm }] = await Promise.all([db.auth.admin.getUserById(owner), db.from("workspace_members").select("user_id").eq("user_id", owner).maybeSingle()]);
  return !!u?.user && !wm;
}

/** Endpoint de token: authorization_code (+ PKCE) ou refresh_token. */
export async function exchange(form: URLSearchParams) {
  const grant = form.get("grant_type");
  const clientId = form.get("client_id") ?? "";
  clientInfo(clientId); // cliente válido
  if (grant === "authorization_code") {
    const code = verify<Signed & { c: string; u: string; ch: string; o: string }>("code", form.get("code"));
    if (!code || code.c !== clientId) throw new OAuthError("invalid_grant", "código inválido ou expirado");
    if (code.u !== form.get("redirect_uri")) throw new OAuthError("invalid_grant", "redirect_uri diferente");
    const verifier = form.get("code_verifier") ?? "";
    if (!verifier || s256(verifier) !== code.ch) throw new OAuthError("invalid_grant", "code_verifier não confere (PKCE)");
    return tokens(code.o, clientId);
  }
  if (grant === "refresh_token") {
    const rt = verify<Signed & { o: string; c: string }>("rt", form.get("refresh_token"));
    if (!rt || rt.c !== clientId.slice(-24)) throw new OAuthError("invalid_grant", "refresh_token inválido ou expirado");
    if (!(await stillAdmin(rt.o))) throw new OAuthError("invalid_grant", "acesso retirado");
    return tokens(rt.o, clientId);
  }
  throw new OAuthError("unsupported_grant_type", "grant_type: authorization_code ou refresh_token");
}

/** Dono dos dados para um token de acesso válido; null se não for um token OAuth válido. */
export function ownerFromAccessToken(token: string) {
  return verify<Signed & { o: string }>("at", token)?.o ?? null;
}

// ---- metadados (descoberta automática pelos clientes MCP)
export const resourceUrl = (origin: string) => `${origin}/api/mcp`;
export const protectedResource = (origin: string) => ({
  resource: resourceUrl(origin),
  authorization_servers: [origin],
  scopes_supported: [SCOPE],
  bearer_methods_supported: ["header"],
  resource_name: "XMEDIA",
});
export const authServerMetadata = (origin: string) => ({
  issuer: origin,
  authorization_endpoint: `${origin}/oauth/authorize`,
  token_endpoint: `${origin}/api/oauth/token`,
  registration_endpoint: `${origin}/api/oauth/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: [SCOPE],
});

/** Origem pública (atrás do proxy da Vercel). */
export function originOf(req: Request) {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version" };
