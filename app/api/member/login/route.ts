import { normalizeCode } from "@/lib/codes";
import { HttpError, clientIp, fail, hashCode, serviceClient, setMemberCookie } from "@/lib/server/admin";

const MAX_FAILS = 10; // por IP, em 15 min

export async function POST(req: Request) {
  try {
    const db = serviceClient();
    const ip = clientIp(req);
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await db.from("member_login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("ok", false).gte("at", since);
    if ((count ?? 0) >= MAX_FAILS) throw new HttpError(429, "too_many");

    const { code } = (await req.json()) as { code?: string };
    const norm = normalizeCode(code ?? "");
    const { data: m } = norm
      ? await db.from("team_members").select("id, status, active, lang").eq("login_code_hash", await hashCode(norm)).maybeSingle()
      : { data: null };
    const ok = !!m && m.status === "active" && m.active;
    await db.from("member_login_attempts").insert({ ip, ok });
    if (!ok) {
      await new Promise((r) => setTimeout(r, 400));
      throw new HttpError(401, "bad_code");
    }
    await db.from("team_members").update({ last_login_at: new Date().toISOString() }).eq("id", m!.id);
    await setMemberCookie(m!.id);
    return Response.json({ ok: true, lang: m!.lang });
  } catch (e) {
    return fail(e);
  }
}
