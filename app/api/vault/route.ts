import { HttpError, fail, requirePerm, serviceClient } from "@/lib/server/admin";
import { aadOf, decrypt, encrypt, grantPeople, loadVault, saveVault } from "@/lib/server/vault";
import { audit, canEdit, canManage, canReveal, newEntry, publicEntry, type Grant, type Viewer, type VaultEntry } from "@/lib/vault";

async function viewer(perm = "customers.view") {
  const { ownerId, user, admin } = await requirePerm(perm);
  return { ownerId, v: { side: "studio", email: (user.email ?? "").toLowerCase(), admin } as Viewer };
}

/** Lista: ?scope=internal | <customerId> | all (visão geral: internas + de todos os clientes). Nunca devolve senhas. */
export async function GET(req: Request) {
  try {
    const { ownerId, v } = await viewer();
    const scope = new URL(req.url).searchParams.get("scope") ?? "all";
    let rows: VaultEntry[] = [];
    if (scope === "all") {
      const { data: cs } = await serviceClient().from("customers").select("id").eq("owner_id", ownerId);
      rows = [...(await loadVault(ownerId, "")), ...(await Promise.all((cs ?? []).map((c) => loadVault(ownerId, c.id as string)))).flat()];
    } else rows = await loadVault(ownerId, scope === "internal" ? "" : scope);
    const people = await grantPeople(ownerId, scope !== "all" && scope !== "internal" ? scope : "");
    return Response.json({ entries: rows.filter((e) => !e.deleted).map((e) => publicEntry(e, v)), people, configured: !!process.env.VAULT_KEY });
  } catch (e) {
    return fail(e);
  }
}

/** { action: "save", entry, password? } · { action: "reveal" | "delete", id, customer } · { action: "grants", id, customer, grants } */
export async function POST(req: Request) {
  try {
    const { ownerId, v } = await viewer("customers.edit");
    const b = (await req.json()) as { action: string; id?: string; customer?: string; entry?: Partial<VaultEntry>; password?: string; grants?: Grant[]; copy?: boolean };
    const customer = String(b.customer ?? b.entry?.customer_id ?? "");
    const list = await loadVault(ownerId, customer);
    const cur = list.find((e) => e.id === (b.id ?? b.entry?.id));

    if (b.action === "save") {
      let e: VaultEntry = cur ?? newEntry({ customer_id: customer, created_by: { email: v.email, side: "studio" } });
      if (cur && !canEdit(cur, v)) throw new HttpError(403, "forbidden");
      const p = b.entry ?? {};
      e = { ...e, platform: String(p.platform ?? e.platform).slice(0, 80), url: String(p.url ?? e.url).slice(0, 500), concept: String(p.concept ?? e.concept).slice(0, 1000), login: String(p.login ?? e.login).slice(0, 200) };
      if (typeof b.password === "string" && b.password) e = { ...e, secret: await encrypt(b.password.slice(0, 500), aadOf(e)), has_secret: true };
      e = audit(e, { by: v.email, action: cur ? "updated" : "created", detail: typeof b.password === "string" && b.password ? "password" : undefined });
      await saveVault(ownerId, customer, [e]);
      return Response.json({ entry: publicEntry(e, v) });
    }
    if (!cur) throw new HttpError(404, "not_found");
    if (b.action === "reveal") {
      if (!canReveal(cur, v)) throw new HttpError(403, "no_access");
      if (!cur.secret) return Response.json({ password: "" });
      const password = await decrypt(cur.secret, aadOf(cur));
      await saveVault(ownerId, customer, [audit(cur, { by: v.email, action: b.copy ? "copied" : "revealed" })]);
      return Response.json({ password });
    }
    if (b.action === "grants") {
      if (!canManage(cur, v)) throw new HttpError(403, "client_decides");
      const grants = (b.grants ?? []).filter((g) => g.kind === "studio" || g.kind === "member").slice(0, 50);
      const e = audit({ ...cur, grants }, { by: v.email, action: "granted", detail: grants.map((g) => g.email ?? g.kind).join(", ") });
      await saveVault(ownerId, customer, [e]);
      return Response.json({ entry: publicEntry(e, v) });
    }
    if (b.action === "delete") {
      if (!canEdit(cur, v)) throw new HttpError(403, "forbidden");
      await saveVault(ownerId, customer, [audit({ ...cur, deleted: true, secret: undefined, has_secret: false }, { by: v.email, action: "deleted" })]);
      return Response.json({ ok: true });
    }
    throw new HttpError(400, "bad_action");
  } catch (e) {
    return fail(e);
  }
}
