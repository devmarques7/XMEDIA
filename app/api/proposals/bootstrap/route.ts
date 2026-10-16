import { BUNDLED_PROPOSALS, needsBundle } from "@/lib/bundled";
import { fail, requirePerm, serviceClient } from "@/lib/server/admin";

/**
 * Cria/atualiza no Supabase as propostas incluídas na app (ex.: Boat Event), no workspace de quem está autenticado.
 * Idempotente: só escreve quando falta ou quando a versão incluída é mais recente do que a guardada.
 */
export async function POST() {
  try {
    const { ownerId } = await requirePerm("proposals.edit");
    const db = serviceClient();
    const ids = BUNDLED_PROPOSALS.map((p) => p.id);
    const { data: rows, error } = await db.from("proposals").select("id, owner_id, data").in("id", ids);
    if (error) throw error;
    const written: string[] = [];
    for (const b of BUNDLED_PROPOSALS) {
      const row = rows?.find((r) => r.id === b.id);
      if (row && row.owner_id !== ownerId) continue; // pertence a outro workspace
      if (!needsBundle(row?.data, b)) continue;
      const { id, created_at: _c, updated_at: _u, ...data } = b;
      const { error: e2 } = await db
        .from("proposals")
        .upsert({ id, owner_id: ownerId, title: b.title, client_name: b.client.company || b.client.name, value: b.value, currency: b.currency, stage: b.stage, data });
      if (e2) throw e2;
      written.push(b.title);
    }
    return Response.json({ written });
  } catch (e) {
    return fail(e);
  }
}
