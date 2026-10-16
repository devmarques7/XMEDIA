"use client";

// Calendário em agenda: mini-mês com pontos por tipo à esquerda (+ resumo do mês), e à direita os dias com
// publicações — número do dia gigante e cartões com hora, barra de cor do tipo, título e estado.
import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { POST_TYPES, monthGrid, postsByDay, type ContentPost, type PostType } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { StatusLabel } from "./parts";

const INIT: Record<PostType, string> = { reel: "RL", post: "PT", carousel: "CR", story: "ST" };
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function AgendaCalendar({ posts, onOpen }: { posts: ContentPost[]; onOpen: (p: ContentPost) => void }) {
  const { t, locale } = useT();
  const today = dayKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const weeks = useMemo(() => monthGrid(month), [month]);
  const byDay = useMemo(() => postsByDay(posts), [posts]);
  const days = useMemo(() => [...byDay.keys()].filter((d) => d.startsWith(month)).sort(), [byDay, month]);
  const inMonth = days.flatMap((d) => byDay.get(d)!);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };
  const monthName = (withYear: boolean) => {
    const d = new Date(month + "-15T12:00:00");
    return withYear ? d.getFullYear() : d.toLocaleDateString(locale, { month: "long" });
  };
  const dow = weeks[0].map((d) => new Date(d + "T12:00:00").toLocaleDateString(locale, { weekday: "short" }).slice(0, 2));
  const time = (p: ContentPost) => {
    const w = p.status === "published" ? p.published_at || p.scheduled_at : p.scheduled_at;
    return w ? new Date(w).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "--:--";
  };
  const go = (d: string) => {
    if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7));
    requestAnimationFrame(() => refs.current[d]?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="agc">
      <aside className="agc-side">
        <section className="w agc-mini">
          <header className="row between">
            <b className="agc-mt">
              <span style={{ textTransform: "capitalize" }}>{monthName(false)}</span> <span className="muted">{monthName(true)}</span>
            </b>
            <span className="row" style={{ gap: 2 }}>
              <button className="agc-ib" onClick={() => shift(-1)} aria-label={t("cal.prev")}>
                <Icon name="chevron" size={16} className="flip" />
              </button>
              <button className="agc-ib" onClick={() => shift(1)} aria-label={t("cal.next")}>
                <Icon name="chevron" size={16} />
              </button>
            </span>
          </header>
          <div className="agc-grid" role="grid">
            {dow.map((d, i) => (
              <span key={i} className="agc-dow">
                {d}
              </span>
            ))}
            {weeks.flat().map((d) => {
              const items = byDay.get(d) ?? [];
              return (
                <button key={d} role="gridcell" className={`agc-d ${d.slice(0, 7) !== month ? "out" : ""} ${d === today ? "today" : ""}`} onClick={() => items.length && go(d)} aria-label={d}>
                  <span>{Number(d.slice(8))}</span>
                  <span className="agc-dots">
                    {items.slice(0, 4).map((p) => (
                      <i key={p.id} className={`ty-${p.type}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="w agc-sum">
          <span className="tile-t">{t("ag.count", { n: inMonth.length })}</span>
          {POST_TYPES.map((ty) => {
            const xs = inMonth.filter((p) => p.type === ty);
            if (!xs.length) return null;
            const next = xs.find((p) => p.scheduled_at && +new Date(p.scheduled_at) >= Date.now());
            return (
              <div key={ty} className="agc-row">
                <span className={`agc-av ty-${ty}`}>{INIT[ty]}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{t(`ct.type.${ty}` as Key)}</b>
                  <span className="muted small"> · {xs.length}</span>
                </span>
                <span className="mono small">{next ? time(next) : "—"}</span>
              </div>
            );
          })}
        </section>
      </aside>

      <section className="agc-main">
        <header className="agc-head">
          <h2 className="agc-title">
            <b style={{ textTransform: "capitalize" }}>{monthName(false)}</b> <span>{monthName(true)}</span>
          </h2>
          <div className="agc-nav">
            <button onClick={() => shift(-1)} aria-label={t("cal.prev")}>
              <Icon name="chevron" size={16} className="flip" />
            </button>
            <button
              onClick={() => {
                setMonth(today.slice(0, 7));
                go(today);
              }}
            >
              {t("ag.today")}
            </button>
            <button onClick={() => shift(1)} aria-label={t("cal.next")}>
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </header>
        {!days.length && <p className="muted agc-empty">{t("ag.empty")}</p>}
        {days.map((d) => {
          const date = new Date(d + "T12:00:00");
          return (
            <article key={d} className={`agc-day ${d === today ? "is-today" : ""}`} ref={(el) => void (refs.current[d] = el)}>
              <div className="agc-num">
                <span>{pad(date.getDate())}</span>
                <small>{date.toLocaleDateString(locale, { weekday: "short" })}</small>
              </div>
              <div className="agc-cards">
                {byDay.get(d)!.map((p) => (
                  <button key={p.id} className={`agc-card ty-${p.type}`} onClick={() => onOpen(p)} data-testid="agenda-card">
                    <span className="agc-time mono">{time(p)}</span>
                    <span className="agc-body">
                      <span className="agc-type">{t(`ct.type.${p.type}` as Key)}</span>
                      <b className="agc-name">{p.title || p.caption.split("\n")[0] || t(`ct.type.${p.type}` as Key)}</b>
                      <span className="agc-meta">
                        <StatusLabel status={p.status} />
                        {p.round > 0 && <span className="mono small muted"> · R{p.round}</span>}
                        {p.notes.filter((n) => !n.deleted).length > 0 && <span className="mono small muted"> · <Icon name="chat" size={14} /> {p.notes.filter((n) => !n.deleted).length}</span>}
                      </span>
                    </span>
                    <span className={`agc-av ty-${p.type}`}>{INIT[p.type]}</span>
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
