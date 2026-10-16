import { redirect } from "next/navigation";
import { AuthSplit } from "@/components/AuthSplit";
import { serviceClient } from "@/lib/server/admin";
import { OAuthError, checkAuthRequest } from "@/lib/server/mcpOAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Q = Record<string, string | undefined>;

/**
 * Ecrã de autorização do MCP (como nos conectores do Claude): o administrador entra na XMEDIA e aprova o acesso.
 * Sem sessão → login e volta aqui (?next=).
 */
export default async function Authorize({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  let req: ReturnType<typeof checkAuthRequest>;
  try {
    req = checkAuthRequest(q);
  } catch (e) {
    return (
      <AuthSplit top="MCP">
        <h1 className="lg2-title">Pedido inválido</h1>
        <p className="lg2-sub">{e instanceof OAuthError ? e.message : "Não foi possível validar o pedido."} Volte a ligar o conector no Claude.</p>
      </AuthSplit>
    );
  }
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  const here = `/oauth/authorize?${new URLSearchParams(Object.entries(q).filter((x): x is [string, string] => typeof x[1] === "string")).toString()}`;
  if (!data.user) redirect(`/login?as=admin&next=${encodeURIComponent(here)}`);
  const { data: wm } = await serviceClient().from("workspace_members").select("user_id").eq("user_id", data.user.id).maybeSingle();
  const host = new URL(req.redirect_uri).host;
  return (
    <AuthSplit top="MCP">
      <h1 className="lg2-title">Ligar {req.client} à XMEDIA</h1>
      {wm ? (
        <p className="lg2-sub">Só o administrador pode ligar a XMEDIA a uma IA. Entre com a conta de administrador.</p>
      ) : (
        <>
          <p className="lg2-sub">
            <b>{req.client}</b> vai poder ler e alterar os dados da XMEDIA em seu nome ({data.user.email}): clientes, conteúdos e rascunhos, tarefas, propostas, invoices e serviços.
          </p>
          <ul className="muted small" style={{ margin: "0 0 18px", paddingLeft: 18, lineHeight: 1.7, textAlign: "left" }}>
            <li>Volta para: {host}</li>
            <li>O acesso renova-se sozinho enquanto usar a ligação. Para desligar todas as IAs ligadas: mudar MCP_OAUTH_SECRET na Vercel.</li>
          </ul>
          <form method="post" action="/api/oauth/authorize" className="lg2-form" style={{ flexDirection: "column", gap: 10 }}>
            {Object.entries(q).map(([k, v]) => (typeof v === "string" ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <button className="lg2-primary" type="submit" name="decision" value="allow" data-testid="oauth-allow">
              Permitir acesso
            </button>
            <button className="lg2-outline" type="submit" name="decision" value="deny" data-testid="oauth-deny">
              Cancelar
            </button>
          </form>
        </>
      )}
    </AuthSplit>
  );
}
