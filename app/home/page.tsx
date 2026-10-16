"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bars, Dots, Ring, Tile, TileLines } from "@/components/bento";
import { PostThumb } from "@/components/customer/parts";
import { Icon } from "@/components/Icon";
import { ImportDialog } from "@/components/ImportDialog";
import { ProjectsTable } from "@/components/ProjectsTable";
import { AppShell, Avatar, ClockWidget, DotGrid, SessionTimer, Toast, useNow, useToast, useUser } from "@/components/ui";
import { useProjects } from "@/lib/useProjects";
import { useAccess } from "@/lib/access";
import { can } from "@/lib/roles";
import { useCompanyKpis } from "@/lib/useCompanyKpis";
import { customerStore } from "@/lib/customerStore";
import { thumbOf, phaseOf, type ContentPost, type Customer } from "@/lib/customer";
import { collect, summarize, BENCHMARK } from "@/lib/feedback";
import { totals } from "@/lib/invoice";
import { useT, type Key } from "@/lib/i18n";
import { fromJSON } from "@/lib/io";
import { isLocalMode, store } from "@/lib/store";
import { REEL_STATUS, emptyData } from "@/lib/types";
import { STATUS_COLOR, agenda, daysUntil, fmtDate, pad, range, sessionStats } from "@/lib/util";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Dashboard() {
  const { t, locale } = useT();
  const router = useRouter();
  const user = useUser();
  const now = useNow(30_000);
  const { projects, error: err, toggleScene: toggle } = useProjects();
  const [q, setQ] = useState("");
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const access = useAccess();
  const fin = !!access && can(access, "finance.view");
  const cust = !!access && can(access, "customers.view");
  const kd = useCompanyKpis(fin);
  const [crm, setCrm] = useState<{ customers: Customer[]; posts: ContentPost[] } | null>(null);
  const [span, setSpan] = useState<6 | 12>(12);
  useEffect(() => {
    if (!cust) return;
    Promise.all([customerStore.list(), customerStore.posts()])
      .then(([customers, posts]) => setCrm({ customers, posts }))
      .catch(() => {});
  }, [cust]);

  // atalho "/" para pesquisar
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const n = norm(q.trim());
    if (!n) return projects;
    return projects.filter((p) =>
      norm(
        [
          p.title,
          p.data.client,
          ...p.data.reels.map((r) => r.title),
          ...p.data.sessions.flatMap((s) => [s.label, ...s.blocks.flatMap((b) => [b.title, ...b.scenes.map((c) => c.title)])]),
        ].join(" ")
      ).includes(n)
    );
  }, [projects, q]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ag = useMemo(() => agenda(filtered), [filtered, now?.getDate()]);
  // se a pesquisa bate em cenas concretas mostra só essas; se bate só no projeto, mostra o dia todo
  const sceneHits = q.trim() ? ag.items.filter((a) => norm(`${a.scene.title} ${a.block.title}`).includes(norm(q.trim()))) : [];
  const activities = sceneHits.length ? sceneHits : ag.items;
  const doneCount = ag.items.filter((a) => a.scene.done).length;
  const pct = ag.items.length ? Math.round((doneCount / ag.items.length) * 100) : 0;

  // sessão para o temporizador: a que está a decorrer, senão a próxima, senão a primeira do dia
  const nowHM = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : "00:00";
  const timerSession =
    (ag.isToday && ag.sessions.find((x) => x.session.start <= nowHM && nowHM < x.session.end)) ||
    (ag.isToday && ag.sessions.find((x) => x.session.start > nowHM)) ||
    ag.sessions[0];

  const reels = filtered.flatMap((p) => p.data.reels);
  const expiring = reels.filter((r) => {
    const d = daysUntil(r.expiresAt);
    return d !== null && d >= 0 && d <= 7 && r.status !== "publicado";
  }).length;

  async function create() {
    const p = await store.create(t("newProjectTitle"), emptyData({ format: t("def.format"), look: t("def.look"), gear: t("def.gear") }));
    router.push(`/p/${p.id}`);
  }

  async function loadExample() {
    const { title, data } = fromJSON(await (await fetch("/exemplo.json")).text());
    const p = await store.create(title, data);
    await store.snapshot(p.id, t("vs.imported", { fmt: "JSON" }));
    router.push(`/p/${p.id}`);
  }

  const firstName = (user?.name || "").split(" ")[0] || (isLocalMode ? t("home.guest") : "");

  return (
    <AppShell>

      <section className="pagehead">
        <div className="row" style={{ gap: 14, alignItems: "center" }}>
          <Avatar user={user ?? { name: firstName, email: "" }} />
          <div>
            <div className="label muted">{user?.email || t("localMode")}</div>
            <h1 className="h1">{t("home.hello", { name: firstName })}</h1>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setImporting(true)}>
            <Icon name="upload" size={14} /> {t("home.import")}
          </button>
          <button className="btn solid" onClick={create}>
            + {t("home.new")}
          </button>
        </div>
      </section>

      <Bento
        pct={pct}
        done={doneCount}
        total={ag.items.length}
        focus={timerSession ? { start: timerSession.session.start, end: timerSession.session.end, title: timerSession.project.title, href: `/p/${timerSession.project.id}/shoot` } : null}
        reels={reels.length}
        kd={fin ? kd : null}
        crm={crm}
        span={span}
        setSpan={setSpan}
      />

      {err && <p className="tone-danger">{err}</p>}

      {/* tabela de projetos */}
      <section className="w">
        <div className="w-head">
          <span className="label">
            <b>00</b>
            {t("home.projects")}
          </span>
          <label className="search" style={{ flex: "0 1 340px", padding: "8px 14px", borderRadius: 4 }}>
            <span className="muted" aria-hidden>
              ⌕
            </span>
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("home.search")} aria-label={t("home.search")} />
            {q ? (
              <button className="btn ghost" onClick={() => setQ("")} aria-label="clear">
                <Icon name="close" size={14} />
              </button>
            ) : (
              <kbd className="hide-sm">/</kbd>
            )}
          </label>
          <span className="num" style={{ fontSize: 28 }}>
            {projects ? pad(filtered.length) : "··"}
          </span>
        </div>
        {projects?.length === 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 16, alignItems: "center" }}>
            <div className="stack">
              <p style={{ margin: 0 }}>{t("home.empty")}</p>
              <div className="row">
                <button className="btn accent" onClick={loadExample}>
                  {t("home.example")} <Icon name="arrow" size={14} />
                </button>
                <button className="btn" onClick={() => setImporting(true)}>
                  {t("home.import")}
                </button>
              </div>
            </div>
            <div className="dots" style={{ height: 90 }} />
          </div>
        ) : filtered.length === 0 && q ? (
          <p className="muted">{t("home.noResults", { q })}</p>
        ) : (
          <>
            <ProjectsTable projects={filtered.slice(0, 5)} />
            {filtered.length > 5 && (
              <Link href="/projetos" className="label arrow" style={{ display: "inline-block", marginTop: 12 }}>
                {t("nav.projects")} ({filtered.length})
              </Link>
            )}
          </>
        )}
      </section>

      {/* widgets */}
      <section className="widgets">
        <ClockWidget
          day={ag.day}
          isToday={ag.isToday}
          sessions={ag.sessions.map(({ session: s }) => ({ id: s.id, label: s.label, start: s.start, end: s.end }))}
        />

        {/* tarefas do dia (ref. Athletic score) */}
        <div className="w span-3" style={{ display: "flex", flexDirection: "column" }}>
          <div className="w-head">
            <span className="label">
              <b>02</b>
              {ag.isToday || !ag.day ? t("w.tasks") : t("w.tasksOf", { date: fmtDate(ag.day, locale) })}
            </span>
          </div>
          <div className="display" style={{ fontSize: "clamp(72px, 8vw, 110px)" }}>
            {pct}
            <span style={{ fontSize: "0.4em" }}>%</span>
          </div>
          <div className="mono" style={{ fontSize: 13, margin: "8px 0 18px" }}>
            {doneCount}/{ag.items.length} ·{" "}
            <span className={pct === 100 ? "tone-ok" : pct >= 75 ? "tone-warn" : "muted"}>
              {t(pct === 100 ? "w.complete" : pct >= 75 ? "w.almost" : pct > 0 ? "w.inProgress" : "w.notStarted")}
            </span>
          </div>
          <div style={{ marginTop: "auto" }}>
            <DotGrid total={ag.items.length} filled={doneCount} cols={12} />
          </div>
        </div>

        {/* reels por estado (ref. lista sleep/strength/steps) */}
        <div className="w span-4">
          <div className="w-head">
            <span className="label">
              <b>03</b>
              {t("w.reels")}
            </span>
            <span className="num" style={{ fontSize: 28 }}>
              {pad(reels.length)}
            </span>
          </div>
          {REEL_STATUS.map((st) => {
            const n = reels.filter((r) => r.status === st).length;
            return (
              <div key={st} className="statrow">
                <span className="ico" style={{ background: STATUS_COLOR[st] }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(0,0,0,.55)" }} />
                </span>
                <span className="label" style={{ flex: 1 }}>
                  {t(`st.${st}` as Key)}
                </span>
                <span className="mono" style={{ fontSize: 22, fontWeight: 300 }}>
                  {n}
                </span>
              </div>
            );
          })}
          {expiring > 0 && (
            <div className="pill accent" style={{ marginTop: 10 }}>
              {t("w.expiringSoon", { n: expiring })}
            </div>
          )}
        </div>

        {/* temporizador */}
        <div className="w span-12">
          <div className="w-head">
            <span className="label">
              <b>04</b>
              {t("w.timer")}
            </span>
            {timerSession && (
              <Link href={`/p/${timerSession.project.id}/shoot`} className="label arrow">
                {timerSession.project.title}
              </Link>
            )}
          </div>
          {timerSession ? (
            <SessionTimer
              id={timerSession.session.id}
              label={`${timerSession.session.label} · ${timerSession.project.title}`}
              date={timerSession.session.date || timerSession.project.data.shootDate}
              start={timerSession.session.start}
              end={timerSession.session.end}
              blocks={timerSession.session.blocks}
              allDone={(() => {
                const st = sessionStats(timerSession.session);
                return st.total > 0 && st.done === st.total;
              })()}
            />
          ) : (
            <p className="muted">{t("w.nothingScheduled")}</p>
          )}
        </div>
      </section>

      {/* atividades com checklist */}
      <section className="w">
        <div className="w-head">
          <span className="label">
            <b>05</b>
            {t("home.activities")}
          </span>
          {ag.day && (
            <span className="label muted">{t("home.activitiesOf", { date: fmtDate(ag.day, locale, { weekday: "short", day: "2-digit", month: "short" }) })}</span>
          )}
        </div>
        {activities.length === 0 ? (
          <p className="muted">{t("home.noActivities")}</p>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>{t("col.done")}</th>
                  <th>{t("col.time")}</th>
                  <th>{t("col.scene")}</th>
                  <th>{t("col.block")}</th>
                  <th>{t("col.reels")}</th>
                  <th>{t("col.project")}</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const reel = a.project.data.reels.find((r) => r.id === a.scene.reelId);
                  return (
                    <tr key={a.scene.id} className={a.scene.done ? "done" : ""}>
                      <td>
                        <button
                          className="check sm"
                          role="checkbox"
                          aria-checked={a.scene.done}
                          aria-label={a.scene.title}
                          onClick={() => toggle(a.project.id, a.scene.id)}
                        />
                      </td>
                      <td className="mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                        {range(a.block.start, a.block.end) || range(a.session.start, a.session.end)}
                      </td>
                      <td>
                        <span className="scene-title">{a.scene.title}</span>
                      </td>
                      <td className="muted" style={{ fontSize: 13 }}>
                        {a.session.label} · {a.block.title}
                      </td>
                      <td>{reel ? <span className="chip accent">{reel.title}</span> : <span className="muted">—</span>}</td>
                      <td>
                        <Link href={`/p/${a.project.id}/shoot`} className="arrow" style={{ fontSize: 13 }}>
                          {a.project.title}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      <Toast msg={toast} />
    </AppShell>
  );
}

type BentoProps = {
  pct: number;
  done: number;
  total: number;
  focus: { start: string; end: string; title: string; href: string } | null;
  reels: number;
  kd: ReturnType<typeof useCompanyKpis>;
  crm: { customers: Customer[]; posts: ContentPost[] } | null;
  span: 6 | 12;
  setSpan: (n: 6 | 12) => void;
};

/** Mosaico do início: foco do dia, invoices pagas, faturação, produção, avaliações e clientes. */
function Bento({ pct, done, total, focus, reels, kd, crm, span, setSpan }: BentoProps) {
  const { t, locale } = useT();
  const [slide, setSlide] = useState(0);
  const eur = (v: number, compact = false) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: compact ? 1 : 0, notation: compact ? "compact" : "standard" }).format(v);
  const k = kd?.kpi;
  const year = new Date().getFullYear().toString();
  const inv = (kd?.invoices ?? []).filter((i) => !i.void && i.status !== "draft" && i.issue_date.startsWith(year));
  const paid = inv.filter((i) => i.status === "paid");
  const paidSum = paid.reduce((s, i) => s + totals(i).total, 0);
  const invSum = inv.reduce((s, i) => s + totals(i).total, 0);
  const months = (k?.months ?? []).slice(-span);
  const mLabel = (m: string) => new Date(m + "-15T12:00:00").toLocaleDateString(locale, { month: "short" }).replace(".", "");

  const posts = crm?.posts ?? [];
  const live = posts.filter((p) => phaseOf(p) !== "published");
  const withClient = live.filter((p) => phaseOf(p) === "client_review").length;
  const recent = [...posts].filter((p) => thumbOf(p) || p.media.some((m) => m.kind === "video")).sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")).slice(0, 6);
  const fb = crm ? collect(crm.customers) : null;
  const sum = fb ? summarize(fb.responses, fb.sent) : null;
  const weak = sum?.weak ?? [];
  const slides = [
    ...(weak.length ? [{ k: t("fb.focus"), big: t(`fb.dim.${weak[0]}` as Key).split(" — ")[0], text: t("fb.weak") }] : []),
    { k: "Marques", big: t("hm.quote").split(".")[0], text: t("hm.quoteBy") },
  ];
  const sl = slides[slide % slides.length];

  return (
    <section className="widgets bento" style={{ paddingTop: 0 }}>
      <div className="span-3 stackcol">
        <Tile tone="blue" title={t("hm.focus")} value={`${pct}%`} of={focus ? `${focus.start}–${focus.end}` : "—"} href={focus?.href} testid="tile-focus">
          {focus && <span className="tile-text">{focus.title}</span>}
        </Tile>
        <Tile title={t("hm.tasks")} value={done} of={`/ ${total}`} />
      </div>

      {k ? (
        <Tile span={3} title={t("hm.paid")} value={paid.length} of={`/ ${inv.length}`} href="/financas" foot={<><span>{t("hm.total")}</span><span>{eur(paidSum)} / {eur(invSum)}</span></>} testid="tile-paid" />
      ) : (
        <Tile span={3} title={t("w.reels")} value={reels} of={`/ ${posts.length || reels}`} href="/projetos" />
      )}

      {k ? (
        <div className="w tile span-6" data-testid="tile-revenue">
          <div className="tile-head">
            <span className="tile-t">{t("hm.revenue")}</span>
            <div className="seg" role="group">
              {([6, 12] as const).map((n) => (
                <button key={n} aria-pressed={span === n} onClick={() => setSpan(n)}>
                  {n}M
                </button>
              ))}
            </div>
          </div>
          <div className="rev">
            <div>
              <span className="tile-num">{eur(k.ytd, true)}</span>
              <div className="tile-of muted" style={{ marginTop: 8 }}>
                {t("kpi.ytd", { year: k.year })} · {k.revenueGrowth === null ? "—" : `${k.revenueGrowth > 0 ? "+" : ""}${k.revenueGrowth}%`}
              </div>
            </div>
            <Bars
              values={months.map((m) => m.total)}
              labels={months.map((m) => mLabel(m.m))}
              on={months.length - 1}
              tip={months.length ? <>{eur(months[months.length - 1].total)}<br /><span className="muted">{mLabel(months[months.length - 1].m)}</span></> : null}
            />
          </div>
        </div>
      ) : (
        <Tile span={6} title={t("home.projects")} value={reels} href="/projetos" go />
      )}

      {/* produção + últimos trabalhos */}
      <div className="w tile tall span-3">
        <div className="tile-head">
          <span className="tile-t">{t("hm.production")}</span>
          <Link href="/projetos" className="tile-go" aria-label={t("hm.open")}>
            <Icon name="arrow" size={18} />
          </Link>
        </div>
        <div className="tile-foot">
          <span className="tile-num">{live.length}</span>
          <span className="tile-of">
            {withClient} {t("hm.toApprove").toLowerCase()}
          </span>
        </div>
        <div className="tile-sep" style={{ flexDirection: "column", gap: 10 }}>
          <span>{t("pd.latest")}</span>
          <div className="gal">
            {recent.length
              ? recent.map((p) => (
                  <Link key={p.id} href={`/clientes/${p.customer_id}?tab=content&post=${p.id}`} title={p.title}>
                    <PostThumb p={p} />
                  </Link>
                ))
              : Array.from({ length: 6 }, (_, i) => <span key={i} />)}
          </div>
        </div>
      </div>

      {/* destaque (azul): foco das avaliações / mantra */}
      <div className="w tile tall span-3 feature">
        <TileLines />
        <span />
        <div className="stack" style={{ gap: 14 }}>
          <span className="tile-t muted">{sl.k}</span>
          <h2 className="tile-big">{sl.big}</h2>
          <p className="tile-text">{sl.text}</p>
          {slides.length > 1 && <Dots n={slides.length} on={slide % slides.length} onPick={setSlide} />}
        </div>
      </div>

      <div className="span-6 subgrid">
        <Tile title={t("hm.clients")} value={k ? k.activeClients : crm?.customers.length ?? "—"} of={k ? `/ ${k.clientsYear}` : undefined} href="/clientes" foot={k ? <><span>+{k.newThisMonth} {t("kpi.new").toLowerCase()}</span><span>{t("kpi.churn")} {k.churn ?? "—"}{k.churn !== null ? "%" : ""}</span></> : undefined}>
          {k && k.clientsYear > 0 && (
            <div className="meter" aria-hidden>
              <i style={{ width: `${Math.round((k.activeClients / k.clientsYear) * 100)}%` }} />
            </div>
          )}
        </Tile>
        <div className="w tile">
          <div className="tile-head">
            <span className="tile-t">{t("hm.nps")}</span>
            <Link href="/avaliacoes" className="tile-menu" aria-label={t("nav.feedback")}>
              <Icon name="more" size={16} />
            </Link>
          </div>
          <Ring value={sum?.nps === null || !sum ? 0 : (sum.nps + 100) / 200}>
            <span className="tile-num">{sum?.nps ?? "—"}</span>
            <div className="tile-t" style={{ marginTop: 8, fontSize: 10.5 }}>
              {sum?.n ? t("fb.npsMarket", { n: BENCHMARK.nps.market, top: BENCHMARK.nps.top }) : t("hm.noFeedback")}
            </div>
          </Ring>
        </div>
        <Link href="/avaliacoes" className="w tile sand wide" data-testid="tile-feedback">
          <div className="tile-head">
            <span />
            <span className="tile-go">
              <Icon name="arrow" size={18} />
            </span>
          </div>
          <div className="tile-foot">
            <h2 className="tile-big">
              {t("nav.feedback")}
              <br />
              {t("fb.request")}
            </h2>
            <span className="tile-of">
              {sum?.n ?? 0} / {sum?.sent ?? 0} {t("fb.responses").toLowerCase()}
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}
