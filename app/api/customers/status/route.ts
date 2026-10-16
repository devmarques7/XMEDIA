import { fail, requirePerm } from "@/lib/server/admin";
import { r2Enabled } from "@/lib/server/r2";
import { igConfigured } from "@/lib/server/instagram";

/** O que está configurado no servidor (sem revelar valores). */
export async function GET() {
  try {
    await requirePerm("customers.view");
    return Response.json({ instagram: igConfigured(), email: Boolean(process.env.RESEND_API_KEY), cron: Boolean(process.env.CRON_SECRET), r2: r2Enabled(), mux: Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET), vault: Boolean(process.env.VAULT_KEY), local: false });
  } catch (e) {
    return fail(e);
  }
}
