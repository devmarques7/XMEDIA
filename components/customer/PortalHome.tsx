"use client";

// Peças do início do portal: processo Marques (onde está cada conteúdo), perfil do Instagram, próximos 14 dias,
// melhores momentos para publicar e publicação automática. Só tokens de cor (paleta configurável).
import { useMemo, useState } from "react";
import { GoArrow } from "@/components/bento";
import { Icon } from "@/components/Icon";
import { COMMON_TZ, SLOTS, bestTimes, peakWindows } from "@/lib/bestTimes";
import { Select } from "@/components/Select";
import { DEFAULT_CLIENT_PROCESS, groupName, normalizeProcessDef, stageCounts, stageName, type ClientProcess } from "@/lib/clientProcess";
import { DEFAULT_PROCESS, deadline, gridItems, journeyState, JOURNEY, type ContentPost, type Customer, type Instagram, type Phase, type ProcessSettings } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { BOARD_COLS, boardPhase } from "./ContentBoard";
import { Cover, PostThumb, TypeIcon } from "./parts";

const DAY = 86_400_000;
/** Torna um tile clicável (abre a página daquele dado). */
export const clickProps = (onClick?: () => void) =>
  onClick ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick()) } : {};
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const whenOf = (p: ContentPost) => (p.status === "published" ? p.published_at || p.scheduled_at : p.scheduled_at);

/** O processo Marques em 7 passos, com o número de conteúdos em cada um e a linha de cada conteúdo. */
export function ProcessTracker({ posts, stage, process = DEFAULT_PROCESS, onOpen }: { posts: ContentPost[]; stage: Customer["stage"]; process?: ProcessSettings; onOpen: (p: ContentPost) => void }) {
  const { t, locale } = useT();
  const now = useMemo(() => new Date(), []);
  const recent = now.getTime() - 10 * DAY;
  const live = posts.filter((p) => p.status !== "published" || new Date(whenOf(p) || 0).getTime() >= recent);
  const count = (k: Phase) => live.filter((p) => boardPhase(p) === k).length;
  const cycleNow = JOURNEY.find((j) => journeyState(stage, j) === "now");
  const rows = live
    .map((p) => ({ p, ph: boardPhase(p), d: deadline(p, process, now) }))
    .sort((a, b) => BOARD_COLS.indexOf(a.ph) - BOARD_COLS.indexOf(b.ph) || (a.d.due || "9").localeCompare(b.d.due || "9"))
    .slice(0, 8);
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  return (
    <section className="w span-12 prc" data-testid="process">
      <header className="prc-head">
        <div>
          <span className="tile-t">{t("ps.title")}</span>
          <p className="muted small" style={{ margin: "6px 0 0" }}>
            {t("ps.sub")}
          </p>
        </div>
        <span className="prc-cycle">
          <span className="tile-t muted">{t("ps.cycle")}</span>
          <b>{cycleNow ? t(`cu.phase.${cycleNow}` as Key) : t(`cu.stage.${stage}` as Key)}</b>
        </span>
      </header>
      <ol className="prc-steps">
        {BOARD_COLS.map((k, i) => {
          const n = count(k);
          const yours = k === "client_review" && n > 0;
          const days = process.steps[k]?.days ?? 0;
          return (
            <li key={k} className={`prc-step ${n ? "has" : ""} ${yours ? "yours" : ""}`}>
              <span className="prc-n mono">{pad(i + 1)}</span>
              <b>{t(`ps.step.${k}` as Key)}</b>
              <span className="prc-desc">{t(`ps.desc.${k}` as Key)}</span>
              <span className="prc-foot">
                <span className="tile-num sm">{n}</span>
                {yours ? <span className="prc-tag">{t("ps.yourTurn")}</span> : days > 0 ? <span className="mono small muted">{t("ps.days", { n: days })}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="prc-list">
        <span className="tile-t muted">{t("ps.videos")}</span>
        {!rows.length && <p className="muted small">{t("ps.none")}</p>}
        {rows.map(({ p, ph, d }) => {
          const at = BOARD_COLS.indexOf(ph);
          return (
            <button key={p.id} className={`prc-row ty-${p.type}`} onClick={() => onOpen(p)} data-testid="process-row">
              <span className="prc-thumb">
                <PostThumb p={p} />
              </span>
              <span className="prc-name">
                <span className="prc-type">
                  <TypeIcon type={p.type} /> {t(`ct.type.${p.type}` as Key)}
                </span>
                <b>{p.title || t(`ct.type.${p.type}` as Key)}</b>
              </span>
              <span className="prc-track" aria-label={t(`ps.step.${ph}` as Key)}>
                {BOARD_COLS.map((k, i) => (
                  <i key={k} className={i < at ? "done" : i === at ? (ph === "client_review" ? "now yours" : "now") : ""} title={t(`ps.step.${k}` as Key)} />
                ))}
              </span>
              <span className="prc-where">
                <b className={ph === "client_review" ? "accent" : ""}>{t(`ps.step.${ph}` as Key)}</b>
                <span className={`mono small ${d.state === "late" ? "accent" : "muted"}`}>
                  {d.state === "late" ? t("ps.late") : d.due ? t("ps.due", { date: date(d.due) }) : whenOf(p) ? date(whenOf(p)) : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Perfil do Instagram em miniatura (planeados no topo) — ou marcador com "Ligar Instagram". */
export function ProfilePreview({ customer, ig, posts, connectHref, canConnect, onOpen, className = "" , onClick }: { onClick?: () => void;  customer: Pick<Customer, "name">; ig: Instagram; posts: ContentPost[]; connectHref?: string; canConnect: boolean; onOpen: (p: ContentPost) => void; className?: string }) {
  const { t, locale } = useT();
  const items = useMemo(() => gridItems(posts, ig.media ?? []).slice(0, 9), [posts, ig.media]);
  const n = (v?: number) => (v === undefined ? "—" : new Intl.NumberFormat(locale, { notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(v));
  const planned = items.filter((i) => i.planned).length;
  const connected = ig.connected;
  return (
    <section className={`w tile igm ${onClick ? "click" : ""} ${className}`} {...clickProps(onClick)} data-testid="profile-preview">
      <div className="tile-head">
        <span className="tile-t">{t("pp.title")}</span>
        {onClick ? <GoArrow extra={<Icon name="instagram" size={16} />} /> : <Icon name="instagram" size={16} />}
      </div>
      <div className="igm-head">
        <span className="igm-av">{connected && ig.picture ? <Cover src={ig.picture} /> : <Icon name="user" size={20} />}</span>
        <span className="igm-counts">
          <span>
            <b>{connected ? n(ig.media_count) : "—"}</b> {t("gr.posts")}
          </span>
          <span>
            <b>{connected ? n(ig.followers) : "—"}</b> {t("gr.followers")}
          </span>
          <span>
            <b>{connected ? n(ig.follows) : "—"}</b> {t("gr.following")}
          </span>
        </span>
      </div>
      <div className="igm-name">
        <b>{ig.name || customer.name}</b>
        <span className="muted small"> {ig.handle ? `@${ig.handle}` : ""}</span>
      </div>
      <div className={`igm-grid ${connected ? "" : "empty"}`}>
        {(connected || items.length ? items : []).map((it) => (
          <button key={it.key} className={`igm-cell ${it.planned ? "planned" : ""}`} onClick={(e) => {
              e.stopPropagation();
              if (it.post) onOpen(it.post);
            }} title={it.post?.title || it.ig?.caption?.slice(0, 60) || ""}>
            <Cover src={it.cover} />
            {it.planned && <span className="igm-badge">{it.when ? new Date(it.when).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : "·"}</span>}
          </button>
        ))}
        {Array.from({ length: Math.max(0, 9 - (connected || items.length ? items.length : 0)) }, (_, i) => (
          <span key={`ph${i}`} className="igm-cell ph" />
        ))}
        {!connected && (
          <div className="igm-over">
            <p className="small">{t("pp.connectHint")}</p>
            {canConnect && connectHref ? (
              <a className="btn accent small" href={connectHref} data-testid="pp-connect" onClick={(e) => e.stopPropagation()}>
                <Icon name="instagram" size={14} /> {t("mt.connect")}
              </a>
            ) : (
              <span className="muted small">{t("pp.askOwner")}</span>
            )}
          </div>
        )}
      </div>
      {planned > 0 && <span className="tile-t muted">{t("pp.planned", { n: planned })}</span>}
    </section>
  );
}

type CalView = "month" | "week" | "14d";

/**
 * Calendário de publicações no início: vista de mês, semana ou próximos 14 dias. Grelha em flex-wrap (7 dias por
 * linha, cada dia flex: 1 — ocupa toda a largura e altura do tile), com a cor do tipo e a melhor hora de cada dia.
 */
export function PostTimeline({ posts, ig, onOpen, className = "", onClick }: { posts: ContentPost[]; ig: Instagram; onOpen: (p: ContentPost) => void; className?: string; onClick?: () => void }) {
  const { t, locale } = useT();
  const bt = useMemo(() => bestTimes(ig.media ?? []), [ig.media]);
  const [view, setView] = useState<CalView>(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches ? "14d" : "month"));
  const [shift, setShift] = useState(0); // meses / semanas / quinzenas a partir de hoje
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (view === "14d") return Array.from({ length: 14 }, (_, i) => new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + shift * 14 + i));
    if (view === "week") {
      const mon = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - ((t0.getDay() + 6) % 7) + shift * 7);
      return Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
    }
    const first = new Date(t0.getFullYear(), t0.getMonth() + shift, 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 6) % 7));
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const n = Math.ceil(((last.getTime() - start.getTime()) / DAY + 1) / 7) * 7;
    return Array.from({ length: n }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [view, shift, today]);
  const month = view === "month" ? new Date(today.getFullYear(), today.getMonth() + shift, 1) : null;
  const by = useMemo(() => {
    const m = new Map<string, ContentPost[]>();
    for (const p of posts) {
      const w = whenOf(p);
      if (!w) continue;
      const k = dayKey(new Date(w));
      m.set(k, [...(m.get(k) ?? []), p].sort((a, b) => whenOf(a).localeCompare(whenOf(b))));
    }
    return m;
  }, [posts]);
  const bestOf = (d: Date) => {
    const row = bt.grid[(d.getDay() + 6) % 7];
    return SLOTS[row.indexOf(Math.max(...row))].at;
  };
  const todayKey = dayKey(today);
  const title =
    view === "month"
      ? month!.toLocaleDateString(locale, { month: "long", year: "numeric" })
      : `${days[0].toLocaleDateString(locale, { day: "2-digit", month: "short" })} – ${days[days.length - 1].toLocaleDateString(locale, { day: "2-digit", month: "short" })}`;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const dows = days.slice(0, 7).map((d) => d.toLocaleDateString(locale, { weekday: "short" }).replace(".", ""));

  return (
    <section className={`w tile nxt nxt-${view} ${onClick ? "click" : ""} ${className}`} {...clickProps(onClick)} data-testid="timeline">
      <div className="tile-head">
        <span className="row" style={{ gap: 12 }}>
          <span className="tile-t">{t("tl.title")}</span>
          <b className="nxt-title">{title}</b>
        </span>
        <span className="tile-head-r" onClick={stop}>
          <span className="row small muted hide-sm" style={{ gap: 6 }}>
            <i className="nxt-best-dot" /> {t("tl.best")}
          </span>
          <span className="agc-nav nxt-nav">
            <button onClick={() => setShift((x) => x - 1)} aria-label={t("cal.prev")}>
              ‹
            </button>
            <button onClick={() => setShift(0)}>{t("ag.today")}</button>
            <button onClick={() => setShift((x) => x + 1)} aria-label={t("cal.next")}>
              ›
            </button>
          </span>
          <span className="seg" role="group">
            {(["month", "week", "14d"] as CalView[]).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  setShift(0);
                }}
              >
                {t(`tl.v.${v}` as Key)}
              </button>
            ))}
          </span>
          {onClick && (
            <span className="tile-go" aria-hidden onClick={onClick}>
              <Icon name="arrow" size={18} />
            </span>
          )}
        </span>
      </div>
      {view !== "14d" && (
        <div className="nxt-dows" aria-hidden>
          {dows.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      )}
      <div className="nxt-strip">
        {days.map((d, i) => {
          const k = dayKey(d);
          const items = by.get(k) ?? [];
          const out = month && d.getMonth() !== month.getMonth();
          return (
            <div key={i} className={`nxt-day ${k === todayKey ? "today" : ""} ${(d.getDay() + 6) % 7 >= 5 ? "we" : ""} ${out ? "out" : ""} ${k < todayKey ? "past" : ""}`}>
              <span className="nxt-dh">
                {view === "14d" && <span className="nxt-dow">{d.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")}</span>}
                <span className="nxt-n">{d.getDate()}</span>
              </span>
              <span className="nxt-items">
                {items.map((p) => (
                  <button
                    key={p.id}
                    className={`nxt-post ty-${p.type}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(p);
                    }}
                    title={p.title}
                  >
                    <TypeIcon type={p.type} />
                    <span className="mono">{new Date(whenOf(p)).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                    {view !== "month" && <span className="nxt-pt">{p.title || t(`ct.type.${p.type}` as Key)}</span>}
                  </button>
                ))}
              </span>
              {!out && k >= todayKey && (
                <span className="nxt-best" title={t("tl.best")}>
                  <i className="nxt-best-dot" /> {bestOf(d)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const LS_TZ = "xmedia:tz";
const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";
  } catch {
    return "Europe/Amsterdam";
  }
};

/**
 * Melhores momentos para publicar Reels: só depois de ligar o Instagram. Primeiro pergunta a zona horária do público;
 * depois mostra o próximo pico e os 3 melhores da semana (referência de uso do telemóvel + dados próprios quando há).
 */
export function BestTimesTile({ ig, className = "", onClick }: { onClick?: () => void; ig: Instagram; className?: string }) {
  const { t, locale } = useT();
  const [tz, setTz] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(LS_TZ);
    } catch {
      return null;
    }
  });
  const [pick, setPick] = useState(browserTz());
  const pw = useMemo(() => (tz ? peakWindows(tz, ig.media ?? []) : null), [tz, ig.media]);
  const dow = (d: number) => new Date(2026, 9, 12 + d).toLocaleDateString(locale, { weekday: "long" });
  const inLabel = (m: number) => (m <= 0 ? t("bt.now") : m < 60 ? t("bt.inMin", { n: m }) : m < 1440 ? t("bt.inH", { n: Math.round(m / 60) }) : t("bt.inD", { n: Math.round(m / 1440) }));
  const save = (z: string) => {
    setTz(z);
    try {
      localStorage.setItem(LS_TZ, z);
    } catch {}
  };
  const zones = [...new Set([browserTz(), ...COMMON_TZ])];

  return (
    <section className={`w tile btm fit ${className}`} data-testid="best-times">
      <div className="tile-head">
        <span className="tile-t">{t("bt.title")}</span>
        {onClick && ig.connected && (
          <button className="tile-go-btn" onClick={onClick} aria-label={t("bt.title")}>
            <GoArrow />
          </button>
        )}
      </div>
      {!ig.connected ? (
        <div className="empty-st">
          <ol className="btm-top ghost" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <span className="gh gh-num" />
                <span className="gh-lines">
                  <span className="gh" style={{ width: "60%" }} />
                  <span className="gh" style={{ width: "35%" }} />
                </span>
              </li>
            ))}
          </ol>
          <p className="small muted" style={{ margin: 0 }}>
            <Icon name="instagram" size={14} /> {t("bt.locked")}
          </p>
        </div>
      ) : !tz ? (
        <div className="btm-tz">
          <p className="small" style={{ margin: 0 }}>
            {t("bt.askTz")}
          </p>
          <Select className="select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t("bt.tz")}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <button className="btn accent small" onClick={() => save(pick)} data-testid="bt-tz-save">
            <Icon name="check" size={14} /> {t("bt.calc")}
          </button>
        </div>
      ) : (
        pw && (
          <>
            {pw.next && (
              <div className={`btm-next ${pw.next.live ? "live" : ""}`}>
                <span className="tile-t muted">{pw.next.live ? t("bt.liveNow") : t("bt.nextPeak")}</span>
                <b style={{ textTransform: "capitalize" }}>
                  {dow(pw.next.day)} · {pw.next.from}–{pw.next.to}
                </b>
                <span className="mono small accent">{inLabel(pw.next.inMin)}</span>
              </div>
            )}
            <ol className="btm-top">
              {pw.top.map((x, i) => (
                <li key={i}>
                  <span className="tile-num sm">{pad(i + 1)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ textTransform: "capitalize" }}>{dow(x.day)}</b>
                    <br />
                    <span className="mono small muted">
                      {x.from}–{x.to}
                    </span>
                  </span>
                  <span className="btm-bar" aria-hidden>
                    <i style={{ width: `${Math.round(x.score * 100)}%` }} />
                  </span>
                </li>
              ))}
            </ol>
            <span className="muted small">
              {pw.source === "reference" ? t("bt.refReels") : t("bt.mixed")} ·{" "}
              <button className="lnk" onClick={() => setTz(null)}>
                {tz.replace(/_/g, " ")}
              </button>
            </span>
          </>
        )
      )}
    </section>
  );
}

/** Publicação automática: estados (em fila, em espera, publicados, erros) e um mock-up do perfil do Instagram com a fila. */
export function AutoPublishTile({ posts, connected, className = "", onClick, onOpen }: { onClick?: () => void; posts: ContentPost[]; connected: boolean; className?: string; onOpen?: (p: ContentPost) => void }) {
  const { t, locale } = useT();
  const now = Date.now();
  const queued = posts.filter((p) => p.status === "scheduled" && p.auto && p.scheduled_at && +new Date(p.scheduled_at) >= now).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const waiting = posts.filter((p) => p.status === "review");
  const done = posts.filter((p) => p.status === "published" && +new Date(p.published_at || 0) >= now - 30 * DAY).length;
  const failed = posts.filter((p) => p.status === "failed").length;
  const cells = [...queued, ...waiting].slice(0, 9);
  const states = [
    ["ap2.queued", queued.length, "q"],
    ["ap2.waiting", waiting.length, "w"],
    ["ap2.done", done, "d"],
    ["ap2.failed", failed, failed ? "f" : ""],
  ] as const;
  return (
    <section className={`w tile ap2 fit ${className}`} data-testid="auto-publish">
      <div className="tile-head">
        <span className="tile-t">{t("ap2.title")}</span>
        <span className="row" style={{ gap: 8 }}>
          <span className={`label ${connected ? "tone-ok" : "muted"}`}>● {connected ? "ON" : "OFF"}</span>
          {onClick && (
            <button className="tile-go-btn" onClick={onClick} aria-label={t("ap2.title")}>
              <GoArrow />
            </button>
          )}
        </span>
      </div>
      <div className="ap2-states">
        {states.map(([k, v, c]) => (
          <span key={k} className={`ap2-st ${c} ${v ? "" : "zero"}`}>
            <b className="mono">{v}</b> {t(k)}
          </span>
        ))}
      </div>
      {/* mock-up do perfil: cabeçalho fantasma + grelha com o que está em fila (o resto em esqueleto) */}
      <div className="igm-mock" aria-label={t("ap2.mock")}>
        <div className="igm-mock-head" aria-hidden>
          <span className="gh gh-av" />
          <span className="gh-lines">
            <span className="gh" style={{ width: "45%" }} />
            <span className="gh" style={{ width: "70%" }} />
          </span>
        </div>
        <div className="igm-mock-grid">
          {Array.from({ length: 9 }, (_, i) => {
            const p = cells[i];
            if (!p) return <span key={i} className="gh igm-ghost" aria-hidden />;
            const q = p.status === "scheduled";
            return (
              <button key={p.id} className={`igm-cell ${q ? "q" : "w"}`} onClick={() => onOpen?.(p)} title={p.title}>
                <PostThumb p={p} />
                <span className="igm-tag mono">{q ? new Date(p.scheduled_at).toLocaleDateString(locale, { day: "2-digit", month: "short" }) : t("ap2.waitingShort")}</span>
              </button>
            );
          })}
        </div>
        {!cells.length && <p className="small muted igm-empty">{connected ? t("ap2.empty") : t("ap2.off")}</p>}
      </div>
    </section>
  );
}

/** Resumo do processo DESTE cliente: uma coluna por etapa (agrupadas), com quantos conteúdos e a % do total. */
export function ProcessSummary({ posts, process, onClick, className = "" }: { posts: ContentPost[]; process?: ClientProcess; onClick?: () => void; className?: string }) {
  const { t } = useT();
  const proc = useMemo(() => (process ? normalizeProcessDef(process) : DEFAULT_CLIENT_PROCESS), [process]);
  const counts = useMemo(() => stageCounts(posts, proc), [posts, proc]);
  const live = posts.filter((p) => p.status !== "published").length;
  return (
    <section className={`w tile psum ${onClick ? "click" : ""} ${className}`} {...clickProps(onClick)} data-testid="process-summary" data-tour="process">
      <div className="tile-head">
        <span className="tile-t">{t("hm2.process")}</span>
        {onClick ? <GoArrow extra={<span className="mono small muted hide-sm">{t("hm2.processSub", { n: live })}</span>} /> : <span className="mono small muted">{t("hm2.processSub", { n: live })}</span>}
      </div>
      <div className="psum-cols">
        {counts.map(({ stage, n, pct }, i) => (
          <div key={stage.id} className={`psum-col ${n ? "has" : ""} ${stage.client && n ? "yours" : ""}`}>
            <span className="psum-group">{i === 0 || counts[i - 1].stage.group !== stage.group ? groupName(stage.group, t) : " "}</span>
            <span className="psum-bar">
              <i style={{ height: `${Math.max(n ? 8 : 0, pct)}%` }} />
            </span>
            <span className="tile-num sm">{n}</span>
            <span className="psum-label">{stageName(stage, t)}</span>
            <span className="mono small muted">{pct}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}
