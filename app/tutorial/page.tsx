"use client";

import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { AppShell, LangSwitch } from "@/components/ui";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { useT, type Lang } from "@/lib/i18n";

type Section = { id: string; who: string; title: string; steps: string[]; note?: string };

// `código` entre crases é mostrado em mono e pode ser copiado
const CONTENT: Record<Lang, { title: string; intro: string; back: string; copy: string; copied: string; sections: Section[] }> = {
  pt: {
    title: "Tutorial",
    intro: "Como instalar o XMEDIA, entrar com Google e usar o fluxo de pré-produção até à gravação.",
    back: "Voltar ao login",
    copy: "Copiar",
    copied: "Copiado",
    sections: [
      {
        id: "instalar",
        who: "Toda a equipa",
        title: "Instalar como app",
        steps: [
          "iPhone (Safari): abra o link do XMEDIA → toque em Partilhar (quadrado com seta) → “Adicionar ao ecrã principal” → Adicionar.",
          "Android (Chrome): abra o link → toque em “Instalar app” no login, ou menu ⋮ → “Instalar app”.",
          "Computador (Chrome/Edge): clique no ícone de instalar na barra de endereço, ou no botão “Instalar app” do login.",
          "A app abre em ecrã inteiro, sem barra do navegador, com o ícone XMEDIA.",
        ],
      },
      {
        id: "entrar",
        who: "Toda a equipa",
        title: "Entrar com Google",
        steps: [
          "No ecrã de login, toque em “Entrar com Google” e escolha a sua conta.",
          "Na primeira vez, vá a Perfil → Editar e preencha nome, função, cidade e interesses.",
          "Os seus projetos são privados: só a sua conta os vê.",
        ],
      },
      {
        id: "configurar",
        who: "Administrador · uma vez",
        title: "Ativar o login Google (Supabase + Google Cloud)",
        steps: [
          "Vercel → projeto `preprod-studio` → Storage → Create Database → Supabase → aceitar termos → Connect. A Vercel adiciona `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.",
          "Supabase → SQL Editor → corra `supabase/migrations/0001_init.sql` e depois `0002_profiles_tasks.sql`, `0003_team_hours.sql` e `0004_member_invites.sql`.",
          "Google Cloud Console → APIs & Services → OAuth consent screen: tipo External, nome “XMEDIA”, o seu email de suporte.",
          "Credentials → Create credentials → OAuth client ID → Web application. Em Authorized redirect URIs cole `https://<id-do-projeto>.supabase.co/auth/v1/callback` (o URL do projeto Supabase + /auth/v1/callback).",
          "Copie o Client ID e o Client Secret → Supabase → Authentication → Sign In / Providers → Google → ativar e colar.",
          "Supabase → Authentication → URL Configuration: Site URL `https://preprod-studio-iota.vercel.app` · Redirect URLs `https://preprod-studio-iota.vercel.app/auth/callback` e `http://localhost:3000/auth/callback`.",
          "Vercel → Deployments → Redeploy (para a app ler as novas variáveis). Teste: abra o site, entre com Google, veja o seu nome no Home.",
        ],
        note: "Enquanto a app estiver em modo de teste no Google, só os emails adicionados em “Test users” conseguem entrar. Publique o consent screen para abrir a todos.",
      },
      {
        id: "equipa",
        who: "Administrador",
        title: "Equipa: convites e código de acesso",
        steps: [
          "Equipa → + Funcionário: nome, email (só para lhe escrever), função, valor/hora e moeda, responsabilidades e a língua dele (PT/EN/NL).",
          "Separador Convite → “Enviar convite por email”. O email sai na língua do funcionário com um link pessoal válido 7 dias. Se o email não sair, copie o link ou envie por WhatsApp.",
          "O funcionário abre o link, toca em “Aceitar” e recebe um código de série (ex.: `XM-7K4QD-9P2MZ`), mostrado uma única vez. O link deixa de funcionar.",
          "Para entrar: Login → Equipa → escreve o código. Não há email nem palavra-passe.",
          "Na área dele vê o valor a receber no mês (EUR/GBP/BRL), regista horas e vê a ficha — sem poder alterar nada. Depois de fechar o mês, as horas ficam bloqueadas.",
          "Perdeu o código? Convite → “Reenviar convite (novo código)”. Ao aceitar, o código antigo deixa de funcionar.",
        ],
        note: "Para enviar emails a qualquer endereço: crie uma conta na Resend, verifique o seu domínio e adicione na Vercel `RESEND_API_KEY` e `INVITE_FROM` (ex.: XMEDIA <equipa@seudominio.com>).",
      },
      {
        id: "usar",
        who: "Produção",
        title: "Do conceito à gravação",
        steps: [
          "Projetos → + Novo projeto (ou Importar ficheiro). Preencha cliente, data e o conceito geral.",
          "Reels: escolha quantos (+/−). Cada reel tem conceito, estado e data de expiração.",
          "Locais: morada, link Maps e notas de acesso.",
          "Sessões: crie Manhã/Tarde com horário → divisões (ex.: Entrevista 08:30–10:00) → cenas com imagem, vídeo e links de referência.",
          "Versões: guarde uma versão antes de enviar ao cliente. Pode restaurar a qualquer momento.",
          "No dia: ▶ Modo produção → toque na sessão → marque as cenas. O temporizador mostra o tempo que falta para encerrar.",
          "Calendário: vê cada dia com sessões, prazos e as suas tarefas; “O meu dia” junta tudo num checklist por horário.",
        ],
      },
      {
        id: "importar",
        who: "Produção",
        title: "Importar ficheiros",
        steps: [
          "Aceita JSON (projeto completo), CSV (vírgula), SSV (ponto e vírgula, Excel PT/NL) e TSV.",
          "Uma linha por cena, colunas: `session,date,start,end,location,block,block_start,block_end,scene,description,reel,image_url,video_url,links`.",
          "Datas `2026-10-15` ou `15/10/2026`; horas `08:00` ou `8:00`.",
          "Se houver erros, a app mostra a linha e o motivo — descarregue o template (.csv/.ssv/.json) e corrija.",
        ],
      },
    ],
  },
  en: {
    title: "Tutorial",
    intro: "How to install XMEDIA, sign in with Google and run the pre-production flow all the way to the shoot.",
    back: "Back to login",
    copy: "Copy",
    copied: "Copied",
    sections: [
      {
        id: "instalar",
        who: "Whole team",
        title: "Install as an app",
        steps: [
          "iPhone (Safari): open the XMEDIA link → tap Share (square with arrow) → “Add to Home Screen” → Add.",
          "Android (Chrome): open the link → tap “Install app” on the login screen, or menu ⋮ → “Install app”.",
          "Desktop (Chrome/Edge): click the install icon in the address bar, or the “Install app” button on login.",
          "The app opens full screen, without the browser bar, with the XMEDIA icon.",
        ],
      },
      {
        id: "entrar",
        who: "Whole team",
        title: "Sign in with Google",
        steps: [
          "On the login screen, tap “Sign in with Google” and pick your account.",
          "The first time, go to Profile → Edit and fill in name, role, city and interests.",
          "Your projects are private: only your account can see them.",
        ],
      },
      {
        id: "configurar",
        who: "Admin · once",
        title: "Enable Google sign-in (Supabase + Google Cloud)",
        steps: [
          "Vercel → project `preprod-studio` → Storage → Create Database → Supabase → accept terms → Connect. Vercel adds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.",
          "Supabase → SQL Editor → run `supabase/migrations/0001_init.sql`, then `0002_profiles_tasks.sql`, `0003_team_hours.sql` and `0004_member_invites.sql`.",
          "Google Cloud Console → APIs & Services → OAuth consent screen: External, name “XMEDIA”, your support email.",
          "Credentials → Create credentials → OAuth client ID → Web application. Under Authorized redirect URIs paste `https://<project-id>.supabase.co/auth/v1/callback` (your Supabase project URL + /auth/v1/callback).",
          "Copy the Client ID and Client Secret → Supabase → Authentication → Sign In / Providers → Google → enable and paste.",
          "Supabase → Authentication → URL Configuration: Site URL `https://preprod-studio-iota.vercel.app` · Redirect URLs `https://preprod-studio-iota.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.",
          "Vercel → Deployments → Redeploy (so the app picks up the new variables). Test: open the site, sign in with Google, see your name on Home.",
        ],
        note: "While the Google app is in testing mode, only emails listed under “Test users” can sign in. Publish the consent screen to open it to everyone.",
      },
      {
        id: "equipa",
        who: "Admin",
        title: "Team: invites and access code",
        steps: [
          "Team → + Staff member: name, email (only to contact them), role, hourly rate and currency, responsibilities and their language (PT/EN/NL).",
          "Invite tab → “Send invite by email”. The email goes out in the staff member's language with a personal link valid for 7 days. If it isn't sent, copy the link or share it on WhatsApp.",
          "They open the link, tap “Accept” and get a serial code (e.g. `XM-7K4QD-9P2MZ`), shown only once. The link stops working.",
          "To sign in: Login → Team → type the code. No email or password.",
          "In their area they see what they're earning this month (EUR/GBP/BRL), log hours and see their profile — without changing anything. Once the month is closed, hours are locked.",
          "Lost the code? Invite → “Resend invite (new code)”. Once accepted, the old code stops working.",
        ],
        note: "To email any address: create a Resend account, verify your domain and add `RESEND_API_KEY` and `INVITE_FROM` (e.g. XMEDIA <team@yourdomain.com>) in Vercel.",
      },
      {
        id: "usar",
        who: "Production",
        title: "From concept to shoot",
        steps: [
          "Projects → + New project (or Import file). Fill in client, date and the main concept.",
          "Reels: choose how many (+/−). Each reel has a concept, status and expiry date.",
          "Locations: address, Maps link and access notes.",
          "Sessions: create Morning/Afternoon with times → blocks (e.g. Interview 08:30–10:00) → scenes with reference image, video and links.",
          "Versions: save a version before sending to the client. Restore any time.",
          "On the day: ▶ Production mode → tap the session → tick scenes off. The timer shows how long until wrap.",
          "Calendar: see each day with sessions, deadlines and your tasks; “My day” puts everything in one timed checklist.",
        ],
      },
      {
        id: "importar",
        who: "Production",
        title: "Import files",
        steps: [
          "Accepts JSON (full project), CSV (comma), SSV (semicolon, Excel NL/PT) and TSV.",
          "One row per scene, columns: `session,date,start,end,location,block,block_start,block_end,scene,description,reel,image_url,video_url,links`.",
          "Dates `2026-10-15` or `15/10/2026`; times `08:00` or `8:00`.",
          "If there are errors, the app shows the row and why — download a template (.csv/.ssv/.json) and fix it.",
        ],
      },
    ],
  },
  nl: {
    title: "Handleiding",
    intro: "XMEDIA installeren, inloggen met Google en de preproductie doorlopen tot en met de opname.",
    back: "Terug naar inloggen",
    copy: "Kopiëren",
    copied: "Gekopieerd",
    sections: [
      {
        id: "instalar",
        who: "Hele team",
        title: "Als app installeren",
        steps: [
          "iPhone (Safari): open de XMEDIA-link → tik op Delen (vierkant met pijl) → “Zet op beginscherm” → Voeg toe.",
          "Android (Chrome): open de link → tik op “App installeren” bij inloggen, of menu ⋮ → “App installeren”.",
          "Computer (Chrome/Edge): klik op het installatie-icoon in de adresbalk, of op “App installeren” bij inloggen.",
          "De app opent schermvullend, zonder browserbalk, met het XMEDIA-icoon.",
        ],
      },
      {
        id: "entrar",
        who: "Hele team",
        title: "Inloggen met Google",
        steps: [
          "Tik op het inlogscherm op “Inloggen met Google” en kies je account.",
          "De eerste keer: ga naar Profiel → Bewerken en vul naam, functie, stad en interesses in.",
          "Je projecten zijn privé: alleen jouw account ziet ze.",
        ],
      },
      {
        id: "configurar",
        who: "Beheerder · eenmalig",
        title: "Google-login activeren (Supabase + Google Cloud)",
        steps: [
          "Vercel → project `preprod-studio` → Storage → Create Database → Supabase → voorwaarden accepteren → Connect. Vercel voegt `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_ANON_KEY` toe.",
          "Supabase → SQL Editor → voer `supabase/migrations/0001_init.sql` uit, daarna `0002_profiles_tasks.sql`, `0003_team_hours.sql` en `0004_member_invites.sql`.",
          "Google Cloud Console → APIs & Services → OAuth consent screen: External, naam “XMEDIA”, je support-e-mail.",
          "Credentials → Create credentials → OAuth client ID → Web application. Plak bij Authorized redirect URIs `https://<project-id>.supabase.co/auth/v1/callback` (je Supabase-project-URL + /auth/v1/callback).",
          "Kopieer Client ID en Client Secret → Supabase → Authentication → Sign In / Providers → Google → inschakelen en plakken.",
          "Supabase → Authentication → URL Configuration: Site URL `https://preprod-studio-iota.vercel.app` · Redirect URLs `https://preprod-studio-iota.vercel.app/auth/callback` en `http://localhost:3000/auth/callback`.",
          "Vercel → Deployments → Redeploy (zodat de app de nieuwe variabelen leest). Test: open de site, log in met Google, zie je naam op Home.",
        ],
        note: "Zolang de Google-app in testmodus staat, kunnen alleen e-mails onder “Test users” inloggen. Publiceer het consent screen om iedereen toe te laten.",
      },
      {
        id: "equipa",
        who: "Beheerder",
        title: "Team: uitnodigingen en toegangscode",
        steps: [
          "Team → + Medewerker: naam, e-mail (alleen om contact op te nemen), functie, uurtarief en valuta, verantwoordelijkheden en taal (PT/EN/NL).",
          "Tab Uitnodiging → “Uitnodiging per e-mail sturen”. De e-mail gaat in de taal van de medewerker met een persoonlijke link, 7 dagen geldig. Lukt verzenden niet, kopieer de link of deel via WhatsApp.",
          "De medewerker opent de link, tikt op “Accepteren” en krijgt een seriecode (bijv. `XM-7K4QD-9P2MZ`), maar één keer getoond. De link werkt daarna niet meer.",
          "Inloggen: Login → Team → code invullen. Geen e-mail of wachtwoord.",
          "In hun omgeving zien ze wat ze deze maand verdienen (EUR/GBP/BRL), registreren uren en zien hun profiel — zonder iets te kunnen wijzigen. Na de maandafsluiting zijn de uren vergrendeld.",
          "Code kwijt? Uitnodiging → “Opnieuw uitnodigen (nieuwe code)”. Na acceptatie werkt de oude code niet meer.",
        ],
        note: "Om naar elk adres te mailen: maak een Resend-account, verifieer je domein en voeg `RESEND_API_KEY` en `INVITE_FROM` (bijv. XMEDIA <team@jouwdomein.com>) toe in Vercel.",
      },
      {
        id: "usar",
        who: "Productie",
        title: "Van concept tot opname",
        steps: [
          "Projecten → + Nieuw project (of Bestand importeren). Vul klant, datum en hoofdconcept in.",
          "Reels: kies hoeveel (+/−). Elke reel heeft een concept, status en vervaldatum.",
          "Locaties: adres, Maps-link en toegangsnotities.",
          "Sessies: maak Ochtend/Middag met tijden → blokken (bijv. Interview 08:30–10:00) → scènes met referentiebeeld, video en links.",
          "Versies: sla een versie op vóór je naar de klant stuurt. Altijd te herstellen.",
          "Op de dag: ▶ Productiemodus → tik op de sessie → vink scènes af. De timer toont hoe lang je nog hebt.",
          "Agenda: elke dag met sessies, deadlines en je taken; “Mijn dag” zet alles in één checklist op tijd.",
        ],
      },
      {
        id: "importar",
        who: "Productie",
        title: "Bestanden importeren",
        steps: [
          "Ondersteunt JSON (volledig project), CSV (komma), SSV (puntkomma, Excel NL/PT) en TSV.",
          "Eén rij per scène, kolommen: `session,date,start,end,location,block,block_start,block_end,scene,description,reel,image_url,video_url,links`.",
          "Datums `2026-10-15` of `15/10/2026`; tijden `08:00` of `8:00`.",
          "Bij fouten toont de app de rij en de reden — download een sjabloon (.csv/.ssv/.json) en corrigeer.",
        ],
      },
    ],
  },
};

function Rich({ text, copy, copied }: { text: string; copy: string; copied: string }) {
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(null), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <>
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") ? (
          <button
            key={i}
            className="codechip"
            title={copy}
            onClick={() => {
              navigator.clipboard?.writeText(part.slice(1, -1));
              setDone(part);
            }}
          >
            {done === part ? `${copied}` : part.slice(1, -1)}
          </button>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** Atalhos e comandos da app (teclado e clique direito). */
const SHORTCUTS: Record<"pt" | "en" | "nl", { title: string; intro: string; rows: [string, string][] }> = {
  pt: {
    title: "Atalhos e comandos",
    intro: "Funcionam em toda a app (fora dos campos de texto, onde as teclas são as do próprio campo).",
    rows: [
      ["⌘K / Ctrl+K", "Pesquisar em tudo (clientes, conteúdos, invoices, propostas, serviços)"],
      ["⌘Z / Ctrl+Z", "Desfazer a última alteração"],
      ["⇧⌘Z / Ctrl+Y", "Refazer"],
      ["⌘B / Ctrl+B", "Recolher / abrir a barra lateral"],
      ["Botão direito numa aba do cliente", "Fixar a aba (aparece primeiro)"],
      ["Botão direito num cliente", "Abrir perfil, fixar, criar tarefa, criar conteúdo, editar, copiar link"],
      ["Histórico (em cada item)", "Ver as versões guardadas e restaurar uma"],
      ["Enter / Esc", "Confirmar / fechar janelas e menus"],
    ],
  },
  en: {
    title: "Shortcuts and commands",
    intro: "They work across the app (outside text fields, where keys belong to the field).",
    rows: [
      ["⌘K / Ctrl+K", "Search everything (clients, content, invoices, proposals, services)"],
      ["⌘Z / Ctrl+Z", "Undo the last change"],
      ["⇧⌘Z / Ctrl+Y", "Redo"],
      ["⌘B / Ctrl+B", "Collapse / expand the sidebar"],
      ["Right-click a client tab", "Pin the tab (shows first)"],
      ["Right-click a client", "Open profile, pin, create task, create content, edit, copy link"],
      ["History (on each item)", "See saved versions and restore one"],
      ["Enter / Esc", "Confirm / close dialogs and menus"],
    ],
  },
  nl: {
    title: "Sneltoetsen en opdrachten",
    intro: "Ze werken in de hele app (buiten tekstvelden, waar de toetsen van het veld zijn).",
    rows: [
      ["⌘K / Ctrl+K", "Alles doorzoeken (klanten, content, facturen, voorstellen, diensten)"],
      ["⌘Z / Ctrl+Z", "Laatste wijziging ongedaan maken"],
      ["⇧⌘Z / Ctrl+Y", "Opnieuw"],
      ["⌘B / Ctrl+B", "Zijbalk in- / uitklappen"],
      ["Rechtsklik op een klanttab", "Tab vastzetten (komt eerst)"],
      ["Rechtsklik op een klant", "Profiel openen, vastzetten, taak maken, content maken, bewerken, link kopiëren"],
      ["Geschiedenis (bij elk item)", "Opgeslagen versies bekijken en er één herstellen"],
      ["Enter / Esc", "Bevestigen / vensters en menu's sluiten"],
    ],
  },
};

export default function Tutorial() {
  const { lang } = useT();
  const c = CONTENT[lang];
  // com sessão: dentro do layout da app (barra lateral para voltar ao contexto); sem sessão: página pública
  const [inApp, setInApp] = useState<boolean | null>(null);
  useEffect(() => {
    if (!supabaseEnabled) return setInApp(true);
    supabase()
      .auth.getSession()
      .then(({ data }) => setInApp(!!data.session))
      .catch(() => setInApp(false));
  }, []);
  const sc = SHORTCUTS[lang as "pt" | "en" | "nl"] ?? SHORTCUTS.en;
  const body = (
    <>
      <section className="w tut-keys" id="atalhos" style={{ marginBottom: 14, scrollMarginTop: 16 }}>
        <div className="w-head">
          <span className="label">
            <b>⌘</b>
            {sc.title}
          </span>
        </div>
        <p className="muted small" style={{ margin: "0 0 10px" }}>
          {sc.intro}
        </p>
        <dl className="kbd-list">
          {sc.rows.map(([k, v]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
  if (inApp === null) return null;
  if (inApp) return <AppShell><TutorialBody c={c} extra={body} /></AppShell>;
  return (
    <main className="wrap" style={{ maxWidth: 860 }}>
      <div className="bar">
        <Link href="/login" className="brand">
          <Logo size={26} /> <span>XMEDIA</span>
        </Link>
        <LangSwitch />
      </div>
      <TutorialBody c={c} extra={body} />
    </main>
  );
}

function TutorialBody({ c, extra }: { c: (typeof CONTENT)[keyof typeof CONTENT]; extra: React.ReactNode }) {
  return (
    <>

      <section className="pagehead">
        <div>
          <span className="label muted">XMEDIA · {c.title}</span>
          <h1 className="h1">{c.title}</h1>
          <p className="muted" style={{ maxWidth: 560 }}>
            {c.intro}
          </p>
        </div>
      </section>

      {extra}
      <nav className="row" style={{ marginBottom: 18 }}>
        {c.sections.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} className="chip">
            {String(i + 1).padStart(2, "0")} {s.title}
          </a>
        ))}
      </nav>

      {c.sections.map((s, i) => (
        <section key={s.id} id={s.id} className="w" style={{ marginBottom: 14, scrollMarginTop: 16 }}>
          <div className="w-head">
            <span className="label">
              <b>{String(i + 1).padStart(2, "0")}</b>
              {s.title}
            </span>
            <span className="pill">{s.who}</span>
          </div>
          <ol className="steps">
            {s.steps.map((step, k) => (
              <li key={k}>
                <span className="stepn">{k + 1}</span>
                <span>
                  <Rich text={step} copy={c.copy} copied={c.copied} />
                </span>
              </li>
            ))}
          </ol>
          {s.note && <p className="note">{s.note}</p>}
        </section>
      ))}

      <Link href="/login" className="btn solid" style={{ marginTop: 8 }}>
        <Icon name="back" size={14} /> {c.back}
      </Link>
    </>
  );
}
