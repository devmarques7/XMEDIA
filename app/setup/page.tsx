"use client";

// Guia de configuração por etapas (produção): mostra o que já está ligado e as URLs exatas a copiar.
// Só lê /api/health, que devolve sim/não — nenhum valor secreto passa por aqui.
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

type Health = {
  origin: string;
  supabase: { url: boolean; anon: boolean; secret: boolean; project: string | null };
  tables: Record<string, boolean>;
  bucket: boolean;
  dbError: string;
  google: boolean | null;
  adminEmails: number;
  sessionSecret: boolean;
  instagram: boolean;
  resend: boolean;
  cron: boolean;
  ai: boolean;
};

function Check({ ok, label, hint }: { ok: boolean | null; label: string; hint?: string }) {
  return (
    <li className={`su-check ${ok ? "ok" : ok === null ? "na" : "no"}`}>
      <span className="su-dot">{ok ? <Icon name="check" size={12} /> : ok === null ? "–" : <Icon name="close" size={12} />}</span>
      <span>
        {label}
        {hint && <span className="muted small" style={{ display: "block" }}>{hint}</span>}
      </span>
    </li>
  );
}

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="su-copy">
      <code className="mono small">{value}</code>
      <button
        className="btn small ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => {});
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? "" : "⧉"}
      </button>
    </span>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className={`w stack su-step ${done ? "done" : ""}`}>
      <div className="row between">
        <span className="row" style={{ gap: 12 }}>
          <span className="su-n mono">{String(n).padStart(2, "0")}</span>
          <h2 className="h2">{title}</h2>
        </span>
        <span className={`label ${done ? "tone-ok" : "tone-warn"}`}>{done ? "Concluída" : "Por fazer"}</span>
      </div>
      {children}
    </section>
  );
}

export default function SetupPage() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setErr("");
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then(setH)
      .catch((e) => setErr(String(e)));
  }, []);
  useEffect(load, [load]);

  if (!h) return <main className="wrap" style={{ padding: 32 }}>{err || "A verificar…"}</main>;

  const o = h.origin;
  const ref = h.supabase.project;
  const tablesOk = Object.values(h.tables).filter(Boolean).length;
  const tablesAll = Object.keys(h.tables).length || 17;
  const s1 = h.supabase.url && h.supabase.anon && h.supabase.secret && tablesOk === tablesAll && h.bucket;
  const s2 = h.adminEmails > 0 && h.sessionSecret;
  const s3 = h.google === true;
  const s5 = h.instagram;
  const dash = ref ? `https://supabase.com/dashboard/project/${ref}` : "https://supabase.com/dashboard";

  return (
    <main className="wrap su">
      <header className="row between" style={{ padding: "24px 0" }}>
        <span className="row" style={{ gap: 10 }}>
          <Logo size={26} />
          <b>XMEDIA · Configuração</b>
        </span>
        <button className="btn small" onClick={load}>
          <Icon name="refresh" size={14} /> Verificar de novo
        </button>
      </header>

      {!h.supabase.url && (
        <p className="note">
          Este deploy está em <b>modo local</b> (sem Supabase). As etapas abaixo só ficam verdes depois do deploy em modo Supabase.
        </p>
      )}

      <Step n={1} title="Base de dados (Supabase)" done={!!s1}>
        <ul className="su-list">
          <Check ok={h.supabase.url && h.supabase.anon} label="URL e chave pública do Supabase no Vercel" hint={ref ? `Projeto: ${ref}` : undefined} />
          <Check ok={h.supabase.secret} label="Chave secreta no servidor (SUPABASE_SECRET_KEY)" hint="Supabase → Project Settings → API Keys → Secret key → Vercel → Environment Variables (Production)" />
          <Check ok={h.supabase.secret ? tablesOk === tablesAll : null} label={`Tabelas criadas (${tablesOk}/${tablesAll})`} hint={h.dbError || "Supabase → SQL Editor → colar todo o ficheiro supabase/setup.sql → Run"} />
          <Check ok={h.supabase.secret ? h.bucket : null} label="Bucket de media (proposal-media)" hint="É criado pelo mesmo setup.sql" />
        </ul>
        <div className="row">
          <a className="btn small" href={`${dash}/sql/new`} target="_blank" rel="noreferrer">
            Abrir SQL Editor <Icon name="arrow" size={14} />
          </a>
          <a className="btn small ghost" href={`${dash}/settings/api-keys`} target="_blank" rel="noreferrer">
            API Keys <Icon name="arrow" size={14} />
          </a>
        </div>
      </Step>

      <Step n={2} title="Acesso de administrador" done={s2}>
        <ul className="su-list">
          <Check ok={h.adminEmails > 0} label={`ADMIN_EMAILS (${h.adminEmails} email${h.adminEmails === 1 ? "" : "s"})`} hint="As contas Google com acesso total, separadas por vírgulas. Sem isto, qualquer conta Google podia registar-se." />
          <Check ok={h.sessionSecret} label="MEMBER_SESSION_SECRET" hint="Texto aleatório longo que assina as sessões da equipa e dos clientes." />
        </ul>
      </Step>

      <Step n={3} title="Login com Google" done={s3}>
        <ul className="su-list">
          <Check ok={h.google} label="Google ativo no Supabase Auth" />
        </ul>
        <ol className="su-howto">
          <li>
            Google Cloud <Icon name="next" size={14} /> APIs &amp; Services <Icon name="next" size={14} /> Credentials <Icon name="next" size={14} /> <b>Create OAuth client ID</b> (Web application). Em “Authorized redirect URIs”:
            <Copy value={`https://${ref ?? "<projeto>"}.supabase.co/auth/v1/callback`} />
          </li>
          <li>
            Supabase <Icon name="next" size={14} /> Authentication <Icon name="next" size={14} /> Sign In / Providers <Icon name="next" size={14} /> <b>Google</b>: ativar e colar o Client ID e o Client Secret.
          </li>
          <li>
            Supabase <Icon name="next" size={14} /> Authentication <Icon name="next" size={14} /> URL Configuration. <b>Site URL</b>:
            <Copy value={o} />
            <b>Redirect URLs</b> (as duas):
            <Copy value={`${o}/auth/callback`} />
            <Copy value={`${o}/portal/auth/callback`} />
          </li>
        </ol>
        <div className="row">
          <a className="btn small" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
            Google Cloud <Icon name="arrow" size={14} />
          </a>
          <a className="btn small ghost" href={`${dash}/auth/providers`} target="_blank" rel="noreferrer">
            Providers <Icon name="arrow" size={14} />
          </a>
          <a className="btn small ghost" href={`${dash}/auth/url-configuration`} target="_blank" rel="noreferrer">
            URL Configuration <Icon name="arrow" size={14} />
          </a>
        </div>
      </Step>

      <Step n={4} title="Testar logins" done={false}>
        <ol className="su-howto">
          <li>
            <Link href="/login?as=admin">Entrar como administrador</Link> com a conta Google de ADMIN_EMAILS <Icon name="next" size={14} /> deve abrir a Home.
          </li>
          <li>
            Em <Link href="/clientes">Clientes</Link>: importar do Notion (ou criar um cliente de teste com um Gmail seu, diferente do de admin) <Icon name="next" size={14} /> Portal &amp; acesso <Icon name="next" size={14} /> Gerar convite.
          </li>
          <li>Abrir o link do convite numa janela anónima <Icon name="next" size={14} /> Continuar com Google (o Gmail de teste) <Icon name="next" size={14} /> escolher o código <Icon name="next" size={14} /> registar o Instagram.</li>
          <li>
            Sair e voltar a entrar em <Link href="/portal/login">/portal/login</Link> só com o código.
          </li>
        </ol>
      </Step>

      <Step n={5} title="Instagram (Meta)" done={s5}>
        <ul className="su-list">
          <Check ok={h.instagram} label="INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET no Vercel" />
        </ul>
        <ol className="su-howto">
          <li>
            developers.facebook.com <Icon name="next" size={14} /> My Apps <Icon name="next" size={14} /> <b>Create app</b> <Icon name="next" size={14} /> caso de uso “Manage messaging &amp; content on Instagram” (tipo Business).
          </li>
          <li>
            Instagram <Icon name="next" size={14} /> <b>API setup with Instagram login</b> <Icon name="next" size={14} /> “Set up Instagram business login”. Em <b>OAuth redirect URIs</b>:
            <Copy value={`${o}/api/portal/instagram/callback`} />
            <b>Deauthorize callback URL</b>:
            <Copy value={`${o}/api/instagram/deauthorize`} />
            <b>Data deletion request URL</b>:
            <Copy value={`${o}/api/instagram/delete`} />
          </li>
          <li>Copiar o <b>Instagram app ID</b> e o <b>Instagram app secret</b> (dessa mesma página) para o Vercel.</li>
          <li>
            App roles <Icon name="next" size={14} /> Roles <Icon name="next" size={14} /> <b>Instagram Testers</b>: adicionar a conta (Empresa ou Criador) e aceitar o convite em instagram.com <Icon name="next" size={14} /> Definições <Icon name="next" size={14} /> Permissões de sites <Icon name="next" size={14} /> Convites de tester.
          </li>
          <li>No portal do cliente <Icon name="next" size={14} /> Métricas <Icon name="next" size={14} /> Ligar Instagram. Para clientes que não sejam testers, a app tem de passar a App Review da Meta.</li>
        </ol>
        <a className="btn small" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">
          Meta for Developers <Icon name="arrow" size={14} />
        </a>
      </Step>

      <Step n={6} title="Extras" done={h.resend && h.cron}>
        <ul className="su-list">
          <Check ok={h.resend} label="Email de convites (RESEND_API_KEY)" hint="Opcional: sem isto, copia o link do convite e envia-o por WhatsApp." />
          <Check ok={h.cron} label="Publicação automática (pg_cron a cada 10 min)" hint="Criado pelo setup.sql: o Supabase chama /api/cron/publish com um token gerado na própria base de dados." />
          <Check ok={h.ai} label="Assistente IA (ANTHROPIC_API_KEY)" />
        </ul>
      </Step>

      <Step n={7} title="Tudo o que falta ligar (links)" done={false}>
        <ol className="su-howto">
          <li>
            <b>Vercel → Environment Variables</b> (Production): RESEND_API_KEY, INVITE_FROM, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, MCP_TOKEN, MCP_OWNER_EMAIL, ANTHROPIC_API_KEY, ADMIN_EMAILS, MEMBER_SESSION_SECRET, MEMBER_CODE_PEPPER, SUPABASE_SECRET_KEY e VAULT_KEY (texto aleatório longo, ≥ 32 caracteres — cifra as senhas do cofre de Acessos; nunca o altere depois de usar, senão as senhas guardadas deixam de abrir). Depois de mudar variáveis: Redeploy.
            <span className="row" style={{ marginTop: 6 }}>
              <a className="btn small" href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">
                Vercel <Icon name="arrow" size={14} />
              </a>
            </span>
          </li>
          <li>
            <b>Email (Resend)</b>: verificar o domínio mediamarques.com (registos DNS) e pôr INVITE_FROM, ex. <span className="mono">XMEDIA &lt;convites@mediamarques.com&gt;</span>. Sem isto, os convites e a avaliação mensal dão o link para copiar.
            <span className="row" style={{ marginTop: 6 }}>
              <a className="btn small" href="https://resend.com/domains" target="_blank" rel="noreferrer">
                Resend · Domains <Icon name="arrow" size={14} />
              </a>
              <a className="btn small ghost" href="https://resend.com/api-keys" target="_blank" rel="noreferrer">
                API Keys <Icon name="arrow" size={14} />
              </a>
            </span>
          </li>
          <li>
            <b>Meta App Review</b> (para clientes que não são Instagram Testers): pedir instagram_business_basic, instagram_business_manage_insights, instagram_business_content_publish e instagram_business_manage_comments, com vídeo do fluxo e a política de privacidade.
            <span className="row" style={{ marginTop: 6 }}>
              <a className="btn small" href="https://developers.facebook.com/docs/instagram-platform/app-review" target="_blank" rel="noreferrer">
                App Review <Icon name="arrow" size={14} />
              </a>
              <a className="btn small ghost" href="https://business.facebook.com/settings/info" target="_blank" rel="noreferrer">
                Business Verification <Icon name="arrow" size={14} />
              </a>
            </span>
          </li>
          <li>
            <b>Google OAuth consent screen</b>: nome XMEDIA, logótipo, domínio autorizado e publicar em “In production” (senão só os test users entram).
            <span className="row" style={{ marginTop: 6 }}>
              <a className="btn small" href="https://console.cloud.google.com/auth/branding" target="_blank" rel="noreferrer">
                Branding <Icon name="arrow" size={14} />
              </a>
              <a className="btn small ghost" href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noreferrer">
                Audience <Icon name="arrow" size={14} />
              </a>
            </span>
          </li>
          <li>
            <b>MCP</b> (ligar o Claude ao XMEDIA): gerar um texto aleatório longo para MCP_TOKEN e o email do dono em MCP_OWNER_EMAIL. Endpoint:
            <Copy value={`${o}/api/mcp`} />
          </li>
          <li>
            <b>Assistente IA</b>: chave em console.anthropic.com → API Keys → ANTHROPIC_API_KEY.
            <span className="row" style={{ marginTop: 6 }}>
              <a className="btn small" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                Anthropic Console <Icon name="arrow" size={14} />
              </a>
            </span>
          </li>
          <li>
            <b>Fonte BioGrotesk</b>: carregar os ficheiros (.woff2) em <Link href="/definicoes/aparencia">Definições → Aparência</Link> (arraste os pesos todos de uma vez).
          </li>
          <li>
            <b>Equipa</b>: convidar cada pessoa em <Link href="/equipa">Equipa → Convidar para a equipa</Link> (email + acesso) e depois definir o valor/hora na ficha. Distribuir o trabalho em <Link href="/estudio">Estúdio</Link>.
          </li>
          <li>
            <b>Processo e horários</b>: etapas, prazos e melhores horas em <Link href="/definicoes">Definições</Link>; processo por cliente na ficha do cliente → Processo.
          </li>
        </ol>
      </Step>
    </main>
  );
}
