import { fail, HttpError, serviceClient } from "@/lib/server/admin";
import { requestReset } from "@/lib/server/reset";
import type { Lang } from "@/lib/i18n";

/** Pedir o link para redefinir o código. Responde sempre { ok: true } (não revela se o email tem conta). */
export async function POST(req: Request) {
  try {
    const { email = "", lang = "en" } = (await req.json()) as { email?: string; lang?: Lang };
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?";
    const db = serviceClient();
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    // limite: 5 pedidos por IP a cada 15 min (reutiliza a tabela de tentativas de login)
    const { count } = await db.from("portal_login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).like("email", "reset:%").gte("at", since);
    if ((count ?? 0) >= 5) throw new HttpError(429, "too_many");
    await db.from("portal_login_attempts").insert({ ip, ok: true, email: `reset:${email.trim().toLowerCase().slice(0, 200)}` });
    await requestReset(email, new URL(req.url).origin, lang);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
