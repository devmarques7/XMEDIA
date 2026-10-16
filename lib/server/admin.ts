import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { MEMBER_COOKIE, SESSION_DAYS, sha256, signSession, verifySession } from "@/lib/codes";
import { supabaseServer } from "@/lib/supabase/server";

/** Cliente com service role: só no servidor, ignora RLS. */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY em falta");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const sessionSecret = () => process.env.MEMBER_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const pepper = () => process.env.MEMBER_CODE_PEPPER || sessionSecret();

export const hashCode = (code: string) => sha256(`code:${pepper()}:${code}`);
export const hashToken = (token: string) => sha256(`invite:${token}`);

/** Admin = dono do workspace: utilizador Supabase que não é um team member (members têm workspace_members). */
export async function requireAdmin() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new HttpError(401, "unauthorized");
  const { data: wm } = await serviceClient().from("workspace_members").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (wm) throw new HttpError(403, "admin_only");
  return data.user;
}

/**
 * Admin ou team member com a permissão pedida. Devolve o utilizador e o dono do workspace (owner_id dos dados).
 * A mesma regra existe na base de dados (has_perm), isto só evita que as rotas do servidor a contornem.
 */
export async function requirePerm(perm: string) {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new HttpError(401, "unauthorized");
  const db = serviceClient();
  const { data: wm } = await db.from("workspace_members").select("owner_id, member_id").eq("user_id", data.user.id).maybeSingle();
  if (!wm) return { user: data.user, ownerId: data.user.id, admin: true };
  const { data: t } = await db.from("team_members").select("active, status, app_role, app_permissions").eq("id", wm.member_id).maybeSingle();
  const ok = !!t && t.active && t.status === "active" && t.app_role !== "none" && (t.app_permissions as string[]).includes(perm);
  if (!ok) throw new HttpError(403, "forbidden");
  return { user: data.user, ownerId: wm.owner_id as string, admin: false };
}

/** Funcionário = cookie de sessão assinado (login por código). */
export async function requireMember() {
  const id = await verifySession((await cookies()).get(MEMBER_COOKIE)?.value, sessionSecret());
  if (!id) throw new HttpError(401, "unauthorized");
  return id;
}

export async function setMemberCookie(memberId: string) {
  (await cookies()).set(MEMBER_COOKIE, await signSession(memberId, sessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function clearMemberCookie() {
  (await cookies()).delete(MEMBER_COOKIE);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function fail(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  const msg = e instanceof Error ? e.message : "error";
  return Response.json({ error: msg }, { status });
}

export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
