// Dono dos dados para rotas sem sessão (MCP, link público): MCP_OWNER_EMAIL ou o primeiro de ADMIN_EMAILS.
import { serviceClient } from "./admin";

let ownerCache: { email: string; id: string } | null = null;

export async function ownerId() {
  const email = (process.env.MCP_OWNER_EMAIL || (process.env.ADMIN_EMAILS ?? "").split(",")[0] || "").trim().toLowerCase();
  if (!email) throw new Error("Defina MCP_OWNER_EMAIL (ou ADMIN_EMAILS) na Vercel.");
  if (ownerCache?.email === email) return ownerCache.id;
  const db = serviceClient();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) {
      ownerCache = { email, id: u.id };
      return u.id;
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`Utilizador ${email} não encontrado no Supabase.`);
}
