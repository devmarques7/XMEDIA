"use client";

// Estrutura da área privada: barra lateral recolhível com grupos, cabeçalho com
// pesquisa global (⌘K), idioma e menu de perfil.
import { LangMenu, useMenu } from "./LangMenu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AiChat } from "./AiChat";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./Logo";
import { Avatar, useTheme, useUser } from "./ui";
import { LANGS, useT, type Key } from "@/lib/i18n";
import { resetAccess, useAccess } from "@/lib/access";
import { can } from "@/lib/roles";
import { useCompanyKpis } from "@/lib/useCompanyKpis";
import { customerStore } from "@/lib/customerStore";
import { canOpen } from "@/lib/roles";
import { invoiceStore } from "@/lib/invoiceStore";
import { proposalStore } from "@/lib/proposalStore";
import { buildIndex, search, type SearchDoc, type SearchHit, type SearchKind } from "@/lib/search";
import { isLocalMode, store } from "@/lib/store";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import { serviceStore } from "@/lib/serviceStore";
import { team } from "@/lib/team";

type Item = { href: string; key: Key; icon: IconName };
const GROUPS: { key: Key; items: Item[] }[] = [
  { key: "grp.overview", items: [{ href: "/home", key: "nav.home", icon: "home" }, { href: "/calendario", key: "nav.calendar", icon: "calendar" }] },
  { key: "grp.production", items: [{ href: "/tarefas", key: "nav.today", icon: "task" }, { href: "/estudio", key: "nav.studio", icon: "gauge" }, { href: "/projetos", key: "nav.projects", icon: "film" }, { href: "/historico", key: "nav.history", icon: "history" }, { href: "/lixo", key: "nav.bin", icon: "trash" }] },
  {
    key: "grp.sales",
    items: [
      { href: "/clientes", key: "nav.customers", icon: "customers" },
      { href: "/documentos", key: "nav.documents", icon: "page" },
      { href: "/acessos", key: "nav.vault", icon: "key" },
      { href: "/servicos", key: "nav.services", icon: "tag" },
      { href: "/propostas", key: "nav.proposals", icon: "proposal" },
      { href: "/inspiracao", key: "nav.inspiration", icon: "layers" },
      { href: "/avaliacoes", key: "nav.feedback", icon: "star" },
      { href: "/financas", key: "nav.finance", icon: "finance" },
    ],
  },
  { key: "grp.people", items: [{ href: "/equipa", key: "nav.team", icon: "team" }] },
];
const FOOT: Item[] = [
  { href: "/perfil", key: "nav.profile", icon: "user" },
  { href: "/definicoes/aparencia", key: "nav.appearance", icon: "palette" },
  { href: "/definicoes", key: "nav.settings", icon: "settings" },
  { href: "/tutorial", key: "nav.tutorial", icon: "help" },
];

const LS_COLLAPSED = "xmedia:sidebar:collapsed";
const LS_GROUPS = "xmedia:sidebar:closed";
const active = (path: string, href: string) =>
  path === href || (path.startsWith(href + "/") && !(href === "/definicoes" && path.startsWith("/definicoes/aparencia"))) || (href === "/projetos" && path.startsWith("/p/"));
const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v === null ? d : (JSON.parse(v) as T);
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export function AppShell({ children, left, right }: { children: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();
  const access = useAccess();
  useEffect(() => setCollapsed(read(LS_COLLAPSED, false)), []);
  useEffect(() => setDrawer(false), [path]);
  const toggle = () => {
    setCollapsed((c) => {
      write(LS_COLLAPSED, !c);
      return !c;
    });
  };
  return (
    <div className={`shell ${collapsed ? "is-collapsed" : ""} ${drawer ? "drawer-open" : ""}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} onClose={() => setDrawer(false)} />
      {drawer && <div className="shell-scrim" onClick={() => setDrawer(false)} />}
      <div className="shell-main">
        <Header left={left} right={right} onMenu={() => setDrawer(true)} />
        <main className="wrap">{access === null ? null : canOpen(access, path) ? children : <NoAccess />}</main>
      </div>
      {access?.admin && <AiChat />}
    </div>
  );
}

/** Página que o papel do team member não permite (o RLS também bloqueia os dados). */
function NoAccess() {
  const { t } = useT();
  return (
    <section className="w stack" style={{ marginTop: 24, maxWidth: 520 }}>
      <span className="label tone-warn"><Icon name="lock" size={14} /> {t("rl.noAccess")}</span>
      <p className="muted">{t("rl.noAccessHint")}</p>
      <Link href="/home" className="btn" style={{ alignSelf: "flex-start" }}>
        <Icon name="back" size={14} /> {t("nav.home")}
      </Link>
    </section>
  );
}

function Sidebar({ collapsed, onToggle, onClose }: { collapsed: boolean; onToggle: () => void; onClose: () => void }) {
  const { t } = useT();
  const path = usePathname();
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => setClosed(read<string[]>(LS_GROUPS, [])), []);
  const flip = (k: string) =>
    setClosed((c) => {
      const next = c.includes(k) ? c.filter((x) => x !== k) : [...c, k];
      write(LS_GROUPS, next);
      return next;
    });

  const access = useAccess();
  const allowed = (it: Item) => access !== null && canOpen(access, it.href);
  const link = (it: Item) => (
    <Link key={it.href} href={it.href} className="sb-link" aria-current={active(path, it.href) ? "page" : undefined} title={collapsed ? t(it.key) : undefined} {...(it.href === "/lixo" ? { "data-bin-target": "" } : {})}>
      <Icon name={it.icon} />
      <span className="sb-text">{t(it.key)}</span>
    </Link>
  );

  return (
    <aside className="sidebar" aria-label="main">
      <div className="sb-top">
        <Link href="/home" className="brand sb-brand" aria-label={t("app")}>
          <Logo size={22} />
          <span className="sb-text">{t("app")}</span>
        </Link>
        <button className="sb-iconbtn sb-close" onClick={onClose} aria-label={t("close")}>
          <Icon name="close" />
        </button>
      </div>

      <nav className="sb-nav">
        {GROUPS.filter((g) => g.items.some(allowed)).map((g) => {
          const isClosed = closed.includes(g.key) && !collapsed;
          return (
            <div key={g.key} className="sb-group">
              <button className="sb-grouphead" onClick={() => flip(g.key)} aria-expanded={!isClosed}>
                <span className="sb-text">{t(g.key)}</span>
                <Icon name="chevron" size={14} className={`sb-chev ${isClosed ? "" : "open"}`} />
              </button>
              {!isClosed && <div className="sb-items">{g.items.filter(allowed).map(link)}</div>}
            </div>
          );
        })}
      </nav>

      <div className="sb-foot">
        {FOOT.filter(allowed).map(link)}
        <button className="sb-link sb-collapse" onClick={onToggle} aria-label={collapsed ? t("nav.expand") : t("nav.collapse")} title={collapsed ? t("nav.expand") : t("nav.collapse")}>
          <Icon name={collapsed ? "expand" : "collapse"} />
          <span className="sb-text">{t("nav.collapse")}</span>
        </button>
      </div>
    </aside>
  );
}

export function Header({ left, right, onMenu }: { left?: React.ReactNode; right?: React.ReactNode; onMenu?: () => void }) {
  const { t } = useT();
  return (
    <header className="topbar shellbar">
      <button className="sb-iconbtn sb-menu" onClick={onMenu} aria-label={t("nav.menu")}>
        <Icon name="apps" size={20} />
      </button>
      {left}
      <KpiBar />
      <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
        <GlobalSearch />
        {right}
        {isLocalMode && (
          <span className="label tone-warn hide-sm" title={t("localModeHint")}>
            {t("localMode")}
          </span>
        )}
        <HeaderTheme />
        <LangMenu />
        <ProfileMenu />
      </div>
    </header>
  );
}

/** KPIs da empresa no cabeçalho (só para quem vê as finanças): faturação, crescimento, médias e clientes. */
function KpiBar() {
  const { t, locale } = useT();
  const access = useAccess();
  const fin = !!access && can(access, "finance.view");
  const d = useCompanyKpis(fin);
  if (!fin || !d) return <div className="kbar" aria-hidden />;
  const k = d.kpi;
  const eur = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
  const pct = (v: number | null, inverse = false) =>
    v === null ? <span className="muted">—</span> : <span className={(v >= 0) !== inverse ? "up" : "down"}>{`${v > 0 ? "+" : ""}${v.toLocaleString(locale)}%`}</span>;
  const items: [string, React.ReactNode, string][] = [
    [t("kpi.ytd", { year: k.year }), eur(k.ytd), k.ytdPrev ? `${t("kpi.vs", { year: String(+k.year - 1) })}: ${eur(k.ytdPrev)}` : ""],
    [t("kpi.growth"), pct(k.revenueGrowth), t("kpi.growthHint")],
    [t("kpi.cmgr"), pct(k.cmgr), t("kpi.cmgrHint")],
    [t("kpi.avg"), eur(k.avgInvoice), t("kpi.avgHint", { client: eur(k.avgClient) })],
    [t("kpi.clients"), `${k.activeClients} / ${k.clientsYear}`, ""],
    [t("kpi.new"), <span key="n" className={k.newThisMonth >= k.newLastMonth ? "up" : "down"}>{`+${k.newThisMonth}`}</span>, t("kpi.newHint", { n: k.newLastMonth })],
    [t("kpi.churn"), k.churn === null ? <span className="muted">—</span> : <span className={k.churn > 20 ? "down" : ""}>{`${k.churn}%`}</span>, t("kpi.churnHint", { n: k.lost })],
    [t("kpi.outstanding"), eur(k.outstanding), ""],
  ];
  return (
    <div className="kbar" role="list" aria-label="KPIs">
      {items.map(([l, v, hint]) => (
        <Link key={l} href="/financas" className="kbar-i" role="listitem" title={hint || undefined}>
          <span className="kbar-l">{l}</span>
          <span className="kbar-v">{v}</span>
        </Link>
      ))}
    </div>
  );
}

/** Modo claro / escuro no cabeçalho (sempre visível; guarda a escolha neste browser). */
function HeaderTheme() {
  const { t } = useT();
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? t("theme.light") : t("theme.dark");
  return (
    <button className="iconpill themepill" onClick={toggle} aria-label={label} title={label} data-testid="theme-toggle">
      <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
    </button>
  );
}

/** Menu suspenso simples que fecha ao clicar fora ou com Esc. */
function ProfileMenu() {
  const { t } = useT();
  const user = useUser();
  const { theme, toggle } = useTheme();
  const { open, setOpen, ref } = useMenu();
  async function signOut() {
    await supabase().auth.signOut();
    resetAccess();
    await fetch("/api/member/logout", { method: "POST" }).catch(() => null);
    location.href = "/login";
  }
  return (
    <div className="menuwrap" ref={ref}>
      <button className="avatar-btn hdr-user" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t("nav.profile")}>
        <Avatar user={user} />
        {user?.name && (
          <span className="mono" style={{ textAlign: "left" }}>
            {user.name.split(" ")[0]}
            <br />
            <span className="muted">{user.email.split("@")[0].slice(0, 12)}</span>
          </span>
        )}
      </button>
      {open && (
        <div className="menu menu-right" role="menu">
          <div className="menu-head">
            <b>{user?.name || t("nav.profile")}</b>
            {user?.email && <span className="muted small">{user.email}</span>}
          </div>
          <Link href="/perfil" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="user" size={16} /> {t("nav.profile")}
          </Link>
          <button role="menuitem" onClick={toggle}>
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} /> {theme === "dark" ? t("theme.light") : t("theme.dark")}
          </button>
          <Link href="/tutorial" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="help" size={16} /> {t("nav.tutorial")}
          </Link>
          {supabaseEnabled && (
            <button role="menuitem" onClick={signOut}>
              <Icon name="logout" size={16} /> {t("logout")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const KIND_ICON: Record<SearchKind, IconName> = { page: "page", project: "film", customer: "customers", service: "tag", proposal: "proposal", invoice: "finance", member: "team", task: "task" };
const KIND_ORDER: SearchKind[] = ["page", "service", "customer", "project", "proposal", "invoice", "member", "task"];

/** Pesquisa em tudo (⌘K / Ctrl+K): mostra onde o texto aparece e abre o sítio certo. */
function GlobalSearch() {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<SearchDoc[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const pages = useMemo(() => [...GROUPS.flatMap((g) => g.items), ...FOOT].map((i) => ({ href: i.href, label: t(i.key) })), [t]);

  const load = useCallback(async () => {
    const safe = <T,>(p: Promise<T>, d: T) => p.catch(() => d);
    const [projects, proposals, invoices, members, tasks, customers, posts, catalog] = await Promise.all([
      safe(store.list(), []),
      safe(proposalStore.list(), []),
      safe(invoiceStore.list(), []),
      safe(team.members(), []),
      safe(store.tasks("2000-01-01", "2100-12-31"), []),
      safe(customerStore.list(), []),
      safe(customerStore.posts(), []),
      safe(serviceStore.load(), null),
    ]);
    setIndex(buildIndex({ projects, proposals, invoices, members, tasks, customers, posts, services: catalog?.services ?? [], pages }));
  }, [pages]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if (!open) return;
    load();
    setCursor(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, load]);

  const hits = useMemo(() => (index && q.trim() ? search(index, q, 40) : []), [index, q]);
  const grouped = useMemo(() => {
    const flat: SearchHit[] = [];
    const groups = KIND_ORDER.map((k) => ({ kind: k, hits: hits.filter((h) => h.doc.kind === k) })).filter((g) => g.hits.length);
    groups.forEach((g) => flat.push(...g.hits));
    return { groups, flat };
  }, [hits]);

  const go = (h: SearchHit) => {
    setOpen(false);
    setQ("");
    router.push(h.field.href ?? h.doc.href);
  };

  return (
    <>
      <button className="searchbtn" onClick={() => setOpen(true)} aria-label={t("search.ph")}>
        <Icon name="search" size={16} />
        <span className="searchbtn-text">{t("search.ph")}</span>
        <kbd className="hide-sm">⌘K</kbd>
      </button>
      {open && (
        <div className="gs-scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="gs" role="dialog" aria-label={t("search.ph")}>
            <div className="gs-input">
              <Icon name="search" />
              <input
                ref={inputRef}
                value={q}
                placeholder={t("search.ph")}
                onChange={(e) => {
                  setQ(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) => Math.min(grouped.flat.length - 1, c + 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => Math.max(0, c - 1));
                  }
                  if (e.key === "Enter" && grouped.flat[cursor]) go(grouped.flat[cursor]);
                }}
                aria-label={t("search.ph")}
                data-testid="global-search"
              />
              <kbd>Esc</kbd>
            </div>
            <div className="gs-results">
              {!index && <p className="muted small gs-empty">{t("search.loading")}</p>}
              {index && !q.trim() && <p className="muted small gs-empty">{t("search.hint")}</p>}
              {index && q.trim() && !hits.length && <p className="muted small gs-empty">{t("search.empty", { q })}</p>}
              {grouped.groups.map((g) => (
                <section key={g.kind}>
                  <div className="label muted gs-group">{t(`search.kind.${g.kind}` as Key)}</div>
                  {g.hits.map((h) => {
                    const i = grouped.flat.indexOf(h);
                    return (
                      <button key={`${h.doc.kind}-${h.doc.id}-${i}`} className={`gs-hit ${i === cursor ? "on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => go(h)}>
                        <Icon name={KIND_ICON[h.doc.kind]} />
                        <span className="gs-body">
                          <span className="gs-title">
                            {h.doc.title} {h.doc.subtitle && <span className="muted small">· {h.doc.subtitle}</span>}
                          </span>
                          {h.field.text !== h.doc.title && (
                            <span className="gs-snippet">
                              <span className="gs-field">{h.field.label}</span> {h.snippet.before}
                              <mark>{h.snippet.match}</mark>
                              {h.snippet.after}
                            </span>
                          )}
                        </span>
                        <Icon name="chevron" size={14} />
                      </button>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
