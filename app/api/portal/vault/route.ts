import { HttpError, fail } from "@/lib/server/admin";
import { requireCustomer } from "@/lib/server/portal";
import { aadOf, decrypt, encrypt, grantPeople, loadVault, saveVault } from "@/lib/server/vault";
import { audit, canEdit, canManage, canReveal, newEntry, publicEntry, type Grant, type Viewer, type VaultEntry } from "@/lib/vault";

async function ctx() {
  const { owner_id, customer, user } = await requireCustomer();
  const v: Viewer = { side: "client", email: user.email.toLowerCase(), customer_id: customer.id, owner: user.role === "owner" };
  return { owner: owner_id as string, customer, user, v };
}

/** Os acessos do cliente (sem senhas) e as pessoas a quem pode dar acesso (equipa XMEDIA e pessoas da empresa). */
export async function GET() {
  try {
    const { owner, customer, v } = await ctx();
    const entries = (await loadVault(owner, customer.id)).filter((e) => !e.deleted).map((e) => publicEntry(e, v));
    return Response.json({ entries, people: await grantPeople(owner, customer.id), configured: !!process.env.VAULT_KEY, owner: v.side === "client" && v.owner });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const { owner, customer, user, v } = await ctx();
    if (user.role === "viewer") throw new HttpError(403, "read_only");
    const b = (await req.json()) as { action: string; id?: string; entry?: Partial<VaultEntry>; password?: string; grants?: Grant[]; copy?: boolean };
    const list = await loadVault(owner, customer.id);
    const cur = list.find((e) => e.id === (b.id ?? b.entry?.id));
    if (b.action === "save") {
      if (cur && !canEdit(cur, v)) throw new HttpError(403, "forbidden");
      let e: VaultEntry = cur ?? newEntry({ customer_id: customer.id, created_by: { email: v.email, side: "client" } });
      const p = b.entry ?? {};
      e = { ...e, platform: String(p.platform ?? e.platform).slice(0, 80), url: String(p.url ?? e.url).slice(0, 500), concept: String(p.concept ?? e.concept).slice(0, 1000), login: String(p.login ?? e.login).slice(0, 200) };
      if (typeof b.password === "string" && b.password) e = { ...e, secret: await encrypt(b.password.slice(0, 500), aadOf(e)), has_secret: true };
      e = audit(e, { by: v.email, action: cur ? "updated" : "created", detail: typeof b.password === "string" && b.password ? "password" : undefined });
      await saveVault(owner, customer.id, [e]);
      return Response.json({ entry: publicEntry(e, v) });
    }
    if (!cur) throw new HttpError(404, "not_found");
    if (b.action === "reveal") {
      if (!canReveal(cur, v)) throw new HttpError(403, "no_access");
      const password = cur.secret ? await decrypt(cur.secret, aadOf(cur)) : "";
      await saveVault(owner, customer.id, [audit(cur, { by: v.email, action: b.copy ? "copied" : "revealed" })]);
      return Response.json({ password });
    }
    if (b.action === "grants") {
      // só o responsável do cliente decide quem vê
      if (!canManage(cur, v)) throw new HttpError(403, "owner_only");
      const grants = (b.grants ?? []).filter((g) => ["studio", "member", "client"].includes(g.kind)).slice(0, 50);
      const e = audit({ ...cur, grants }, { by: v.email, action: "granted", detail: grants.map((g) => g.email ?? g.kind).join(", ") || "—" });
      await saveVault(owner, customer.id, [e]);
      return Response.json({ entry: publicEntry(e, v) });
    }
    if (b.action === "delete") {
      if (!canEdit(cur, v)) throw new HttpError(403, "forbidden");
      await saveVault(owner, customer.id, [audit({ ...cur, deleted: true, secret: undefined, has_secret: false }, { by: v.email, action: "deleted" })]);
      return Response.json({ ok: true });
    }
    throw new HttpError(400, "bad_action");
  } catch (e) {
    return fail(e);
  }
}
