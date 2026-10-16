import { HttpError, fail, requireAdmin } from "@/lib/server/admin";
import { loadConnections, saveConnections, sealSecret, updateConnection } from "@/lib/server/connections";
import { PRESETS, publicConnection, slug, validUrl, type ConnAuth, type Connection } from "@/lib/connections";

/** Ligações do assistente (só o administrador). Nunca devolve tokens. */
export async function GET() {
  try {
    const user = await requireAdmin();
    const list = await loadConnections(user.id);
    return Response.json({ connections: list.map(publicConnection), presets: PRESETS, configured: !!process.env.VAULT_KEY });
  } catch (e) {
    return fail(e);
  }
}

/**
 * { action: "add", preset? | label+url+auth } · { action: "toggle", id, enabled } · { action: "token", id, token }
 * · { action: "disconnect", id } · { action: "remove", id }
 */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(b.id ?? "");
    switch (b.action) {
      case "add": {
        const p = PRESETS.find((x) => x.id === b.preset);
        const label = String(p?.label ?? b.label ?? "").trim().slice(0, 60);
        const url = String(p?.url ?? b.url ?? "").trim();
        const auth = (p?.auth ?? (["oauth", "token", "none"].includes(String(b.auth)) ? b.auth : "oauth")) as ConnAuth;
        if (!label || !validUrl(url)) throw new HttpError(400, "invalid_url");
        const list = await loadConnections(user.id);
        if (list.some((c) => c.url === url)) throw new HttpError(409, "already_added");
        const c: Connection = { id: crypto.randomUUID(), name: slug(label), label, url, preset: p?.id, auth, enabled: true, created_at: new Date().toISOString() };
        await saveConnections(user.id, [...list, c]);
        return Response.json({ connection: publicConnection(c) });
      }
      case "toggle": {
        const c = await updateConnection(user.id, id, (x) => ({ ...x, enabled: !!b.enabled }));
        return Response.json({ connection: c && publicConnection(c) });
      }
      case "token": {
        // token colado na interface (servidores sem OAuth): cifrado de imediato
        const token = String(b.token ?? "").trim();
        if (!token || token.length > 4000) throw new HttpError(400, "invalid_token");
        if (!process.env.VAULT_KEY) throw new HttpError(503, "vault_not_configured");
        const secret = await sealSecret({ id }, { access: token });
        const next = await updateConnection(user.id, id, (x) => ({ ...x, secret, connected_at: new Date().toISOString(), error: undefined }));
        return Response.json({ connection: next && publicConnection(next) });
      }
      case "disconnect": {
        const c = await updateConnection(user.id, id, (x) => ({ ...x, secret: undefined, connected_at: undefined, error: undefined }));
        return Response.json({ connection: c && publicConnection(c) });
      }
      case "remove":
        await updateConnection(user.id, id, () => null);
        return Response.json({ ok: true });
      default:
        throw new HttpError(400, "bad_action");
    }
  } catch (e) {
    return fail(e);
  }
}
