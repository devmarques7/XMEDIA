import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/admin";
import { supabaseServer } from "@/lib/supabase/server";

/** Email ligado ao portal de um cliente (clientes não entram como administradores). */
async function isCustomerEmail(email: string) {
  try {
    const { data } = await serviceClient().from("customer_access").select("customer_id").eq("google_email", email).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Volta do Google (OAuth) e dos links de email do Supabase.
 * O primeiro login com Google cria a conta (registo). Se ADMIN_EMAILS estiver definido
 * (lista separada por vírgulas), só esses emails ficam com sessão.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  if (code) {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      const allowed = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const email = data.user?.email?.toLowerCase() ?? "";
      if ((allowed.length && !allowed.includes(email)) || (!allowed.length && (await isCustomerEmail(email)))) {
        await sb.auth.signOut();
        return NextResponse.redirect(`${origin}/login?as=admin&error=not_allowed`);
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?as=admin&error=auth`);
}
