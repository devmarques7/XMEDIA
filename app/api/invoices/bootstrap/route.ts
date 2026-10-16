import { BUNDLED_CUSTOMERS, BUNDLED_INVOICES, matchCustomer, mergeBundledCustomer, needsInvoiceBundle } from "@/lib/bundled";
import { normalizeCustomer, type Customer } from "@/lib/customer";
import { totals } from "@/lib/invoice";
import { fail, requirePerm, serviceClient } from "@/lib/server/admin";

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * Cria/atualiza no Supabase as invoices incluídas na app (e os clientes delas), no workspace de quem está autenticado.
 * Invoice com o mesmo número → atualiza essa (mantém o id e o estado). Cliente com o mesmo nome/email → junta só os
 * dados de faturação (fase, portal e Instagram ficam). Idempotente por bundle_version.
 */
export async function POST() {
  try {
    const { ownerId } = await requirePerm("finance.view");
    const db = serviceClient();
    const written: string[] = [];

    // 1) clientes (só para quem pode editar clientes) — o id final de cada cliente liga as invoices
    const custIds = new Map<string, string>();
    const canCustomers = await requirePerm("customers.edit").then(() => true, () => false);
    if (canCustomers) {
      const { data: cs, error } = await db.from("customers").select("id, name, email, data").eq("owner_id", ownerId);
      if (error) throw error;
      const saved = (cs ?? []).map((r) => normalizeCustomer({ ...(r.data as Customer), id: r.id }));
      const upserts: Record<string, unknown>[] = [];
      for (const b of BUNDLED_CUSTOMERS) {
        const cur = matchCustomer(saved, b);
        custIds.set(b.id, cur?.id ?? b.id);
        const next = mergeBundledCustomer(cur, b);
        if (!next) continue;
        const { created_at: _c, updated_at: _u, ...data } = next;
        upserts.push({ id: next.id, owner_id: ownerId, name: next.name, email: next.email, stage: next.stage, data });
      }
      if (upserts.length) {
        const { error: e2 } = await db.from("customers").upsert(upserts);
        if (e2) throw e2;
        written.push(`${upserts.length} clientes`);
      }
    }

    // 2) invoices
    const { data: rows, error } = await db.from("invoices").select("id, number, status, data").eq("owner_id", ownerId);
    if (error) throw error;
    const upserts: Record<string, unknown>[] = [];
    for (const b of BUNDLED_INVOICES) {
      const row = rows?.find((r) => r.id === b.id) ?? rows?.find((r) => norm(r.number) === norm(b.number));
      if (!needsInvoiceBundle(row?.data, b)) continue;
      const customer_id = b.customer_id ? (custIds.get(b.customer_id) ?? (canCustomers ? b.customer_id : null)) : null;
      const inv = { ...b, id: row?.id ?? b.id, status: (row?.status as typeof b.status) ?? b.status, customer_id };
      const t = totals(inv);
      const { created_at: _c, updated_at: _u, ...data } = inv;
      upserts.push({
        id: inv.id,
        owner_id: ownerId,
        number: inv.number,
        issue_date: inv.issue_date,
        status: inv.status,
        currency: inv.currency,
        subtotal: t.subtotal,
        btw_amount: t.btwAmount,
        total: t.total,
        client_name: inv.client.name,
        data,
      });
      written.push(inv.number);
    }
    for (let i = 0; i < upserts.length; i += 50) {
      const { error: e2 } = await db.from("invoices").upsert(upserts.slice(i, i + 50));
      if (e2) throw e2;
    }
    return Response.json({ written });
  } catch (e) {
    return fail(e);
  }
}
