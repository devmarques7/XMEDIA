import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_COOKIE, CLIENT_PREFIX, MEMBER_COOKIE, verifySession } from "@/lib/codes";

// páginas e ficheiros acessíveis sem sessão (login, tutorial, PWA)
const PUBLIC = ["/login", "/auth", "/tutorial", "/manifest.webmanifest", "/sw.js", "/pwa-icon", "/icon.svg", "/templates", "/exemplo.json", "/briefings", "/fonts", "/invoice", "/v", "/convite", "/api/invite", "/api/member/login", "/api/member/logout", "/api/auth/login", "/api/auth/reset", "/redefinir", "/api/mcp", "/api/proposal-decision", "/f", "/brandbook", "/api/feedback/public", "/assinar", "/api/sign", "/pdf.worker.min.mjs",
  // portal do cliente: entrada, convite e volta do Google; agendador (protegido por CRON_SECRET)
  "/portal/login", "/portal/convite", "/portal/auth", "/api/portal/invite", "/api/portal/login", "/api/portal/logout", "/api/cron",
  // guia de configuração (só mostra sim/não)
  "/setup", "/api/health", "/api/version", "/api/email/header", "/api/appearance",
  // callbacks da Meta (pedido assinado com o app secret)
  "/api/instagram"];
// área do funcionário (sessão por código de série, não Supabase Auth)
const MEMBER_AREA = ["/eu", "/api/member"];
// portal do cliente (sessão própria, cookie xm_client)
const CLIENT_AREA = ["/portal", "/api/portal"];
const under = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(p + "/"));

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // modo local
  const path = request.nextUrl.pathname;
  // Google/Supabase voltou à página inicial com ?code= (Redirect URL não autorizada no Supabase → usa o Site URL):
  // encaminha para o callback para não perder o login
  if (path === "/" && request.nextUrl.searchParams.has("code")) {
    const to = request.nextUrl.clone();
    to.pathname = request.cookies.get("xm_portal_invite") ? "/portal/auth/callback" : "/auth/callback";
    return NextResponse.redirect(to);
  }
  if (path === "/" || under(path, PUBLIC)) return NextResponse.next(); // "/" = site público

  // funcionário: só a própria área
  const secret = process.env.MEMBER_SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (under(path, CLIENT_AREA)) {
    const v = await verifySession(request.cookies.get(CLIENT_COOKIE)?.value, secret);
    if (v?.startsWith(CLIENT_PREFIX)) return NextResponse.next();
    if (path.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const to = request.nextUrl.clone();
    to.pathname = "/portal/login";
    to.search = "";
    return NextResponse.redirect(to);
  }
  const memberId = await verifySession(request.cookies.get(MEMBER_COOKIE)?.value, secret);
  if (under(path, MEMBER_AREA)) {
    if (memberId) return NextResponse.next();
    if (path.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "?as=team";
    return NextResponse.redirect(to);
  }

  let response = NextResponse.next({ request });
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const to = request.nextUrl.clone();
    to.pathname = memberId ? "/eu" : "/login"; // funcionário com sessão vai para a sua área
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
