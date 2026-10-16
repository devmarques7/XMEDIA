import { after } from "next/server";
import { fail } from "@/lib/server/admin";
import { igConfigured, syncInstagram } from "@/lib/server/instagram";
import { portalPayload, requireCustomer } from "@/lib/server/portal";

const STALE_MS = 6 * 3600_000;

export async function GET() {
  try {
    const { owner_id, customer, user } = await requireCustomer();
    const ig = customer.instagram;
    // métricas com mais de 6 h: atualiza depois de responder
    if (igConfigured() && ig.connected && (!ig.synced_at || Date.now() - new Date(ig.synced_at).getTime() > STALE_MS)) after(() => syncInstagram(customer.id).catch(() => {}));
    return Response.json(await portalPayload(owner_id, customer, user));
  } catch (e) {
    return fail(e);
  }
}
