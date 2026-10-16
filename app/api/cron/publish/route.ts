import { normalizePost } from "@/lib/customer";
import { fail, serviceClient } from "@/lib/server/admin";
import { igConfigured } from "@/lib/server/instagram";
import { runPublish } from "@/lib/server/publisher";

export const maxDuration = 300;

/** Aceita CRON_SECRET (Vercel Cron / cron externo) ou o token gerado na base de dados para o pg_cron (tabela app_cron). */
async function cronAuthorized(header: string) {
  const got = header.replace(/^Bearer\s+/i, "");
  if (!got) return false;
  if (process.env.CRON_SECRET && got === process.env.CRON_SECRET) return true;
  const { data } = await serviceClient().from("app_cron").select("token").eq("id", 1).maybeSingle();
  return !!data?.token && data.token === got;
}

/**
 * Agendador: publica os posts automáticos cuja hora já passou. Chamar a cada 5–15 min com
 * "Authorization: Bearer $CRON_SECRET" (Vercel Cron no plano Pro, ou um cron externo / Supabase pg_cron).
 */
export async function GET(req: Request) {
  try {
    if (!(await cronAuthorized(req.headers.get("authorization") ?? ""))) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!igConfigured()) return Response.json({ skipped: "ig_not_configured" });
    const { data, error } = await serviceClient()
      .from("customer_posts")
      .select("id, customer_id, data")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(8);
    if (error) throw error;
    const results = [];
    for (const r of data ?? []) {
      const p = normalizePost({ ...r.data, id: r.id, customer_id: r.customer_id });
      if (!p.auto || p.deleted_at) continue; // no lixo: não publica
      results.push({ id: p.id, ...(await runPublish(p, 25_000)) });
    }
    return Response.json({ ran: results.length, results });
  } catch (e) {
    return fail(e);
  }
}
