import { HttpError, fail, requireAdmin, serviceClient } from "@/lib/server/admin";
import { applyLifecycle, selfTest, storeConfig, usage } from "@/lib/server/r2";

export const maxDuration = 60;

/** Estado do armazenamento de vídeos e espaço usado por cliente (só o administrador). */
export async function GET(req: Request) {
  try {
    const user = await requireAdmin();
    const c = storeConfig();
    if (!c) return Response.json({ configured: false });
    const withUsage = new URL(req.url).searchParams.get("usage") === "1";
    let groups: { group: string; label: string; bytes: number; files: number }[] = [];
    let truncated = false;
    if (withUsage) {
      const u = await usage(user.id);
      truncated = u.truncated;
      const { data: cs } = await serviceClient().from("customers").select("id, data").eq("owner_id", user.id);
      const names = new Map((cs ?? []).map((x) => [`customers/${x.id}`, String((x.data as { name?: string })?.name ?? "")]));
      groups = u.groups.map((g) => ({ ...g, label: names.get(g.group) || g.group })).sort((a, b) => b.bytes - a.bytes);
    }
    return Response.json({ configured: true, provider: c.provider, r2: c.provider === "Cloudflare R2", publicHost: new URL(c.publicUrl).host, groups, truncated });
  } catch (e) {
    return fail(e);
  }
}

/** { action: "test" } → verificação completa · { action: "lifecycle", days } → arquivo automático + limpeza */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    if (!storeConfig()) throw new HttpError(503, "storage_not_configured");
    const b = (await req.json().catch(() => ({}))) as { action?: string; days?: number };
    if (b.action === "test") return Response.json(await selfTest(user.id, new URL(req.url).origin));
    if (b.action === "lifecycle") return Response.json(await applyLifecycle(Math.min(365, Math.max(30, Number(b.days) || 60))));
    throw new HttpError(400, "bad_action");
  } catch (e) {
    return fail(e);
  }
}
