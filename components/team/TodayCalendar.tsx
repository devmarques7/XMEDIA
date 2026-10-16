"use client";

// Por baixo da lista "Hoje": calendário em agenda (como o do portal do cliente — número do dia grande e cartões
// com hora, barra de cor e estado), ajustado ao separador (hoje / amanhã = 1 dia, semana = 7 dias), a linha do
// tempo de prazos (14 dias) e as tarefas sem data. Tudo colapsável (fechado no telemóvel).
import Link from "next/link";
import { Collapsible } from "@/components/Collapsible";
import { Icon } from "@/components/Icon";
import { useT, type Key } from "@/lib/i18n";
import { weekDays, weekOf, ymd, type StudioTask } from "@/lib/studio";
import { agenda } from "@/lib/today";
import type { ContentPost, ProcessSettings } from "@/lib/customer";

const addDays = (d: string, n: number) => ymd(new Date(new Date(d + "T12:00:00").getTime() + n * 86_400_000));

export function TodayCalendar({ view, tasks, posts, proc, onToggle, onDate }: { view: "today" | "tomorrow" | "week" | "none" | "done"; tasks: StudioTask[]; posts: ContentPost[]; proc: ProcessSettings; onToggle: (t: StudioTask) => void; onDate: (t: StudioTask, due: string) => void }) {
  const { t, locale } = useT();
  const today = ymd(new Date());
  const days = view === "today" ? [today] : view === "tomorrow" ? [addDays(today, 1)] : weekDays(weekOf());
  const cal = agenda(days, tasks, posts, proc);
  const line = agenda(Array.from({ length: 14 }, (_, i) => addDays(today, i)), tasks.filter((x) => !x.done), posts, proc);
  const maxN = Math.max(1, ...line.map((d) => d.tasks.length + d.deadlines.length));
  const undated = tasks.filter((x) => !x.done && !x.deleted && !x.due);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00").toLocaleDateString(locale, o);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const range = days.length === 1 ? fmt(days[0], { weekday: "long", day: "numeric", month: "long" }) : `${fmt(days[0], { day: "numeric", month: "short" })} – ${fmt(days[6], { day: "numeric", month: "short" })}`;

  return (
    <div className="tcal">
      <Collapsible title={t("tc.calendar")} right={<span className="mono small muted">{range}</span>} className="tcal-main" testId="tc-cal">
        <div className="tcal-legend mono small muted">
          <span>
            <i className="lg-task" /> {t("tc.tasks")}
          </span>
          <span>
            <i className="lg-dl" /> {t("tc.deadlines")}
          </span>
          <span>
            <i className="lg-pub" /> {t("tc.publishing")}
          </span>
        </div>
        {cal.map((d) => {
          const n = d.tasks.length + d.deadlines.length + d.publishing.length;
          return (
            <article key={d.day} className={`agc-day tc-day ${d.day === today ? "is-today" : ""}`}>
              <div className="agc-num">
                <span>{fmt(d.day, { day: "2-digit" })}</span>
                <small>{fmt(d.day, { weekday: "short" })}</small>
              </div>
              <div className="agc-cards">
                {d.tasks.map((x) => (
                  <button key={x.id} className={`agc-card tc-card k-task ${x.done ? "done" : ""}`} onClick={() => onToggle(x)} data-testid="tc-task">
                    <span className="agc-time mono">{x.done ? <Icon name="check" size={13} /> : <Icon name="task" size={13} />}</span>
                    <span className="agc-body">
                      <span className="agc-type">{t("tc.tasks")}</span>
                      <b className="agc-name">{x.title}</b>
                    </span>
                  </button>
                ))}
                {d.deadlines.map((p) => (
                  <Link key={p.id} className="agc-card tc-card k-dl" href={`/clientes/${p.customer_id}?tab=content&post=${p.id}`}>
                    <span className="agc-time mono">
                      <Icon name="flag" size={13} />
                    </span>
                    <span className="agc-body">
                      <span className="agc-type">{t("tc.deadlines")}</span>
                      <b className="agc-name">{p.title || t(`ct.type.${p.type}` as Key)}</b>
                    </span>
                  </Link>
                ))}
                {d.publishing.map((p) => (
                  <Link key={`pub-${p.id}`} className="agc-card tc-card k-pub" href={`/clientes/${p.customer_id}?tab=content&post=${p.id}`}>
                    <span className="agc-time mono">{time(p.scheduled_at)}</span>
                    <span className="agc-body">
                      <span className="agc-type">{t("tc.publishing")}</span>
                      <b className="agc-name">{p.title || t(`ct.type.${p.type}` as Key)}</b>
                    </span>
                  </Link>
                ))}
                {!n && <span className="muted small tc-free">{t("tc.free")}</span>}
              </div>
            </article>
          );
        })}
      </Collapsible>

      <div className="tcal-side">
        <Collapsible title={t("tc.timeline")} right={<span className="mono small muted">{t("tc.next14")}</span>} testId="tc-line">
          <div className="tline" role="list">
            {line.map((d) => {
              const n = d.tasks.length + d.deadlines.length;
              return (
                <div key={d.day} role="listitem" className={`tline-d ${d.day === today ? "today" : ""} ${new Date(d.day + "T12:00:00").getDay() % 6 === 0 ? "we" : ""}`} title={[...d.tasks.map((x) => x.title), ...d.deadlines.map((p) => p.title)].join("\n")}>
                  <span className="tline-bar">
                    <i className="t" style={{ height: `${(d.tasks.length / maxN) * 100}%` }} />
                    <i className="d" style={{ height: `${(d.deadlines.length / maxN) * 100}%` }} />
                  </span>
                  <span className="mono tline-n">{n || ""}</span>
                  <span className="mono small muted">{fmt(d.day, { day: "2-digit" })}</span>
                </div>
              );
            })}
          </div>
        </Collapsible>

        <Collapsible title={t("tc.undated")} count={undated.length} testId="tc-undated">
          {!undated.length && <p className="muted small">{t("td.clear")}</p>}
          <div className="tund">
            {undated.map((x) => (
              <span key={x.id} className="tund-it">
                <button className="td-check sm" role="checkbox" aria-checked={false} aria-label={x.title} onClick={() => onToggle(x)} />
                <span className="tund-t" title={x.title}>
                  {x.title}
                </span>
                <button className="btn ghost small" onClick={() => onDate(x, today)}>
                  {t("td.when.today")}
                </button>
                <button className="btn ghost small" onClick={() => onDate(x, addDays(today, 1))}>
                  {t("td.when.tomorrow")}
                </button>
              </span>
            ))}
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
