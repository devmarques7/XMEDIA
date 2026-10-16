import { senderFrom } from "@/lib/inviteEmail";
import { r2Enabled } from "@/lib/server/r2";
import { serviceClient } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

const TABLES = ["projects", "project_versions", "profiles", "tasks", "team_members", "month_closes", "time_entries", "member_login_attempts", "invoices", "proposals", "proposal_shares", "customers", "customer_posts", "app_settings", "customer_access", "portal_login_attempts", "app_cron", "admin_access", "workspace_members", "customer_users", "services", "service_catalog", "service_quotes"];
const has = (k: string) => Boolean(process.env[k]?.trim());

/**
 * Estado da configuração (só sim/não, nunca valores) para a página /setup.
 * Verifica variáveis, tabelas do Supabase, bucket de media, Google no Supabase Auth e Instagram.
 */
const R2_ENV = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"];

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = has("SUPABASE_SECRET_KEY") || has("SUPABASE_SERVICE_ROLE_KEY");

  const tables: Record<string, boolean> = {};
  let bucket = false;
  let dbError = "";
  if (url && secret) {
    try {
      const db = serviceClient();
      await Promise.all(
        TABLES.map(async (t) => {
          const { error } = await db.from(t).select("*").limit(1); // GET: HEAD não traz o erro de tabela inexistente
          tables[t] = !error;
          if (error && !dbError) dbError = error.message.slice(0, 160);
        })
      );
      const { data } = await db.storage.getBucket("proposal-media");
      bucket = !!data;
    } catch (e) {
      dbError = e instanceof Error ? e.message.slice(0, 160) : "error";
    }
  }

  // migrações 0010–0012: funções do login por código e se o admin já tem código definido
  const migrations: Record<string, boolean> = {};
  let adminPasscode: boolean | null = null;
  if (url && secret) {
    const db = serviceClient();
    const r1 = await db.rpc("check_admin_passcode", { p_email: "health@check.invalid", p_code: "0000" });
    migrations["0010_passcode_login"] = !r1.error;
    const r2 = await db.from("team_members").select("app_role").limit(1);
    migrations["0011_member_roles"] = !r2.error && !!tables.workspace_members;
    migrations["0012_customer_users"] = !!tables.customer_users;
    migrations["0013_services"] = !!tables.services && !!tables.service_quotes;
    if (!r1.error) {
      const { count } = await db.from("admin_access").select("email", { count: "exact", head: true });
      adminPasscode = (count ?? 0) > 0;
    }
  }

  let google: boolean | null = null;
  if (url && anon) {
    try {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon }, cache: "no-store" });
      const j = await r.json();
      google = !!j?.external?.google;
    } catch {
      google = null;
    }
  }

  return Response.json({
    origin,
    supabase: { url: !!url, anon: !!anon, secret, project: url ? new URL(url).hostname.split(".")[0] : null },
    tables,
    bucket,
    dbError,
    migrations,
    adminPasscode,
    google,
    adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").filter((e) => e.trim()).length,
    sessionSecret: has("MEMBER_SESSION_SECRET"),
    instagram: has("INSTAGRAM_APP_ID") && has("INSTAGRAM_APP_SECRET"),
    resend: has("RESEND_API_KEY"),
    // INVITE_FROM tal como está na Vercel é aceite pela Resend? (senão a app usa o nome com o endereço por omissão)
    resendFrom: !process.env.INVITE_FROM?.trim() || senderFrom() === process.env.INVITE_FROM.trim(),
    cron: has("CRON_SECRET") || !!tables.app_cron,
    ai: has("ANTHROPIC_API_KEY"),
    mux: has("MUX_TOKEN_ID") && has("MUX_TOKEN_SECRET"),
    // as 5 variáveis R2_* (ou S3_*) completas → vídeos vão para o R2 sem otimizar no browser
    r2: r2Enabled(),
    r2Missing: R2_ENV.filter((k) => !has(k)),
    vault: has("VAULT_KEY"),
  });
}
