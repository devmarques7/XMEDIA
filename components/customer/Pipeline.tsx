"use client";

// Pipeline de produção (só admin): todos os conteúdos de todos os clientes num kanban por fase do
// processo, com bloqueados, checklist de alterações e prazo (dias que faltam) — e uma linha do tempo.
import { useBoardDrag } from "@/lib/useBoardDrag";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS, deadline, liveNotes, moveToPhase, openNotes, phaseOf, type ContentPost, type Customer, type Deadline, type Phase, type PortalSettings } from "@/lib/customer";
import { CUSTOMER_SAVED, customerStore } from "@/lib/customerStore";
import { useT, type Key } from "@/lib/i18n";
import { pad } from "@/lib/util";
import { BoardCard } from "./ContentBoard";

const COLS: Phase[] = ["idea", "editing", "client_review", "changes", "blocked", "approved", "scheduled", "published"];
const LS_VIEW = "xmedia:pipeline:view";
const DAY = 86_400_000;

export function usePhaseLabel(s: PortalSettings) {
  const { t } = useT();
  return (k: Phase) => (k !== "blocked" && s.process.steps[k].label) || t(`pl.phase.${k}` as Key);
}

export function DeadlineChip({ d }: { d: Deadline }) {
  const { t } = useT();
  if (d.state === "none") return null;
  const txt = d.state === "late" ? t("pl.late", { n: Math.max(1, -d.daysLeft) }) : d.daysLeft === 0 ? t("pl.today") : t("pl.left", { n: d.daysLeft });
  return (
    <span className={`dl dl-${d.state}`} title={d.reason === "publish" ? t("pl.byPublish") : t("pl.byStep")}>
      <Icon name="clock" size={14} /> {txt}
    </span>
  );
}

export function Pipeline() {
  const { t, locale } = useT();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [posts, setPosts] = useState<ContentPost[] | null>(null);
  const [s, setS] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [who, setWho] = useState("all");
  const [risk, setRisk] = useState(false);
  const [view, setView] = useState<"kanban" | "timeline">("kanban");
  const label = usePhaseLabel(s);

  const load = useCallback(async () => {
    const [c, p, st] = await Promise.all([customerStore.list(), customerStore.posts(), customerStore.settings()]);
    setCustomers(c);
    setPosts(p);
    setS(st);
  }, []);
  useEffect(() => {
    load().catch(() => setPosts([]));
    try {
      if (localStorage.getItem(LS_VIEW) === "timeline") setView("timeline");
    } catch {}
    window.addEventListener(CUSTOMER_SAVED, load);
    return () => window.removeEventListener(CUSTOMER_SAVED, load);
  }, [load]);

  const now = useMemo(() => new Date(), [posts]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const rows = useMemo(() => {
    const recent = now.getTime() - 14 * DAY;
    return (posts ?? [])
      .filter((p) => who === "all" || p.customer_id === who)
      .filter((p) => p.status !== "published" || new Date(p.published_at || p.scheduled_at || 0).getTime() >= recent)
      .map((p) => ({ p, phase: phaseOf(p), d: deadline(p, s.process, now) }))
      .filter((r) => !risk || r.d.state === "late" || r.d.state === "warn" || r.phase === "blocked");
  }, [posts, who, risk, s, now]);

  const kpi = {
    changes: rows.filter((r) => r.phase === "changes").length,
    blocked: rows.filter((r) => r.phase === "blocked").length,
    late: rows.filter((r) => r.d.state === "late").length,
    warn: rows.filter((r) => r.d.state === "warn").length,
  };

  async function move(id: string, phase: Phase) {
    const p = posts?.find((x) => x.id === id);
    if (!p || phaseOf(p) === phase) return;
    const next = moveToPhase(p, phase);
    setPosts((l) => l?.map((x) => (x.id === id ? next : x)) ?? l);
    await customerStore.savePost(next).catch(() => load());
  }
  const dnd = useBoardDrag({ onDrop: (id, to) => move(id, to as Phase) });
  const open = (p: ContentPost) => router.push(`/clientes/${p.customer_id}?tab=content&post=${p.id}`);
  const pickView = (v: "kanban" | "timeline") => {
    setView(v);
    try {
      localStorage.setItem(LS_VIEW, v);
    } catch {}
  };
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  return (
    <section className="stack">
      <div className="widgets teamstats" style={{ paddingTop: 0 }}>
        {(
          [
            ["changes", kpi.changes, "tone-warn"],
            ["blocked", kpi.blocked, "tone-danger"],
            ["late", kpi.late, "tone-danger"],
            ["warn", kpi.warn, "tone-warn"],
          ] as const
        ).map(([k, n, tone]) => (
          <div key={k} className="w span-3">
            <div className="label muted">{t(`pl.kpi.${k}` as Key)}</div>
            <div className={`num ${n ? tone : ""}`} style={{ marginTop: 12 }}>
              {pad(n)}
            </div>
          </div>
        ))}
      </div>

      <div className="row between">
        <div className="row">
          <Select className="select statussel" value={who} onChange={(e) => setWho(e.target.value)} aria-label={t("cu.col.name")}>
            <option value="all">{t("pl.allCustomers")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button className={`chip ${risk ? "on" : ""}`} onClick={() => setRisk((r) => !r)}>
            <Icon name="flag" size={14} /> {t("pl.atRisk")}
          </button>
        </div>
        <div className="row">
          <div className="seg" role="group">
            <button aria-pressed={view === "kanban"} onClick={() => pickView("kanban")}>
              {t("pr.kanban")}
            </button>
            <button aria-pressed={view === "timeline"} onClick={() => pickView("timeline")}>
              {t("pl.timeline")}
            </button>
          </div>
          <Link href="/definicoes#processo" className="btn small ghost">
            <Icon name="settings" size={14} /> {t("pl.configure")}
          </Link>
        </div>
      </div>

      {posts?.length === 0 && <p className="muted w">{t("pl.empty")}</p>}

      {view === "kanban" && !!posts?.length && (
        <div className={`kanban pl-board ${dnd.board}`} data-kb-scroll>
          {COLS.map((col) => {
            const items = rows.filter((r) => r.phase === col).sort((a, b) => (a.d.due || "9999").localeCompare(b.d.due || "9999"));
            const days = col !== "blocked" ? s.process.steps[col].days : 0;
            return (
              <section key={col} {...dnd.col(col)} className={`kcol pl-col pl-${col} ${dnd.col(col).className}`}>
                <header className="kcol-head">
                  <span className="label">{label(col)}</span>
                  <span className="mono small muted">
                    {pad(items.length)}
                    {days > 0 && ` · ${days}d`}
                  </span>
                </header>
                {dnd.over === col && dnd.canDropHere(col) && <div className="kb-slot">{t("kb.dropHere")}</div>}
                {items.map(({ p, d }) => {
                  const all = liveNotes(p).length;
                  const openN = openNotes(p).length;
                  return (
                    <BoardCard
                      key={p.id}
                      p={p}
                      client={name(p.customer_id)}
                      clientInfo={(() => {
                        const c = customers.find((x) => x.id === p.customer_id);
                        return c ? { name: c.name, photo: c.cover || c.instagram.picture } : undefined;
                      })()}
                      showOwner
                      className={d.state === "late" ? "late" : ""}
                      drag={dnd.card(p.id, col)}
                      onOpen={open}
                      extra={
                        <>
                          {p.blocked && p.blocked_reason && <span className="small tone-danger"><Icon name="ban" size={14} /> {p.blocked_reason}</span>}
                          {p.status === "failed" && p.error && <span className="small tone-danger"><Icon name="alert" size={14} /> {p.error.slice(0, 80)}</span>}
                          {all > 0 && (
                            <span className="pl-check">
                              <span className="cu-bar">
                                <i style={{ width: `${((all - openN) / all) * 100}%` }} />
                              </span>
                              <span className="mono small">
                                <Icon name="check" size={14} /> {all - openN}/{all}
                              </span>
                            </span>
                          )}
                          <div className="row between" style={{ gap: 6, flexWrap: "wrap" }}>
                            <DeadlineChip d={d} />
                            {p.round > s.process.max_rounds && <span className="mono small tone-warn">R{p.round}</span>}
                          </div>
                        </>
                      }
                    />
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {view === "timeline" && !!posts?.length && <Timeline rows={rows.filter((r) => r.phase !== "published")} name={name} label={label} onOpen={open} />}
    </section>
  );
}

/** Linha do tempo: 3 semanas; barra = fase atual (entrada → prazo), ◆ = data de publicação. */
function Timeline({
  rows,
  name,
  label,
  onOpen,
}: {
  rows: { p: ContentPost; phase: Phase; d: Deadline }[];
  name: (id: string) => string;
  label: (k: Phase) => string;
  onOpen: (p: ContentPost) => void;
}) {
  const { t, locale } = useT();
  const N = 21;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 2);
  const days = Array.from({ length: N }, (_, i) => new Date(start.getTime() + i * DAY));
  const col = (iso: string) => Math.floor((new Date(iso).getTime() - start.getTime()) / DAY);
  const clamp = (n: number) => Math.min(N - 1, Math.max(0, n));
  const sorted = [...rows].sort((a, b) => (a.d.due || a.p.scheduled_at || "9999").localeCompare(b.d.due || b.p.scheduled_at || "9999"));

  return (
    <div className="w tl-wrap">
      <div className="tl" style={{ gridTemplateColumns: `minmax(150px, 220px) repeat(${N}, minmax(22px, 1fr))` }}>
        <span />
        {days.map((d, i) => (
          <span key={i} className={`tl-day mono ${i === 2 ? "today" : ""} ${d.getDay() === 0 || d.getDay() === 6 ? "we" : ""}`}>
            {d.toLocaleDateString(locale, { weekday: "narrow" })}
            <b>{d.getDate()}</b>
          </span>
        ))}
        {sorted.map(({ p, phase, d }) => {
          const a = clamp(col(p.phase_since));
          const b = d.due ? clamp(col(d.due)) : a;
          const pub = p.scheduled_at ? col(p.scheduled_at) : -1;
          return (
            <div key={p.id} className="tl-row" style={{ gridColumn: `1 / span ${N + 1}` }} onClick={() => onOpen(p)}>
              <span className="tl-name">
                <b>{p.title || t(`ct.type.${p.type}` as Key)}</b>
                <span className="muted small">
                  {name(p.customer_id)} · {label(phase)}
                </span>
              </span>
              <span className={`tl-bar dl-${d.state === "none" ? "ok" : d.state}`} style={{ gridColumn: `${Math.min(a, b) + 2} / ${Math.max(a, b) + 3}` }} title={label(phase)}>
                <DeadlineChip d={d} />
              </span>
              {pub >= 0 && pub < N && (
                <span className="tl-pub" style={{ gridColumn: `${pub + 2}` }} title={t("pl.publish")}>
                  ◆
                </span>
              )}
              <span className="tl-today" style={{ gridColumn: 4 }} />
            </div>
          );
        })}
      </div>
      {!sorted.length && <p className="muted small">{t("pl.empty")}</p>}
    </div>
  );
}
