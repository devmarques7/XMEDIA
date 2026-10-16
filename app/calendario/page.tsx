"use client";

import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, Toast, useNow, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { store } from "@/lib/store";
import type { Block, Project, Session, Task } from "@/lib/types";
import { useProjects } from "@/lib/useProjects";
import { STATUS_COLOR, isoDay, pad, range, sessionStats } from "@/lib/util";

type Ev =
  | { kind: "session"; time: string; end: string; title: string; project: Project; session: Session }
  | { kind: "deadline"; time: ""; title: string; project: Project; color: string }
  | { kind: "task"; time: string; title: string; task: Task };

const addDays = (day: string, n: number) => {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

export default function CalendarPage() {
  const { t, locale } = useT();
  const now = useNow(60_000);
  const today = now ? isoDay(now) : isoDay();
  const { projects, toggleScene } = useProjects();
  const [start, setStart] = useState(today);
  const [selected, setSelected] = useState(today);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [toast, setToast] = useToast();

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const from = days[0] < selected ? days[0] : selected;
  const to = days[6] > selected ? days[6] : selected;

  const loadTasks = useCallback(() => store.tasks(from, to).then(setTasks).catch((e) => setToast(e.message)), [from, to, setToast]);
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const eventsOf = useCallback(
    (day: string): Ev[] => {
      const ev: Ev[] = [];
      for (const p of projects ?? []) {
        for (const s of p.data.sessions)
          if ((s.date || p.data.shootDate) === day) ev.push({ kind: "session", time: s.start, end: s.end, title: s.label, project: p, session: s });
        for (const r of p.data.reels)
          if (r.expiresAt === day && r.status !== "publicado") ev.push({ kind: "deadline", time: "", title: r.title, project: p, color: STATUS_COLOR[r.status] });
      }
      for (const task of tasks) if (task.date === day) ev.push({ kind: "task", time: task.time, title: task.title, task });
      return ev.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
    },
    [projects, tasks]
  );

  // lê do próprio formulário (funciona com preenchimento automático / ditado)
  async function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    if (!title) return;
    const task = await store.addTask({ title, date: selected, time: String(fd.get("time") ?? ""), done: false });
    setTasks((ts) => [...ts, task]);
    form.reset();
  }

  async function toggleTask(task: Task) {
    setTasks((ts) => ts.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x)));
    await store.updateTask(task.id, { done: !task.done }).catch(() => loadTasks());
  }
  async function removeTask(task: Task) {
    if (!confirm(t("removeConfirm", { what: t("cal.task") }))) return;
    setTasks((ts) => ts.filter((x) => x.id !== task.id));
    await store.removeTask(task.id).catch(() => loadTasks());
  }

  const sel = new Date(selected + "T12:00:00");
  const selEvents = eventsOf(selected);
  const checklist = selEvents.flatMap((e) =>
    e.kind === "task" ? [e.task.done] : e.kind === "session" ? e.session.blocks.flatMap((b) => b.scenes.map((c) => c.done)) : []
  );
  const doneN = checklist.filter(Boolean).length;
  const nowHM = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : "";

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">
            {new Date(start + "T12:00:00").toLocaleDateString(locale, { month: "long", year: "numeric" })}
          </span>
          <h1 className="h1">{t("nav.calendar")}</h1>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setStart(addDays(start, -7))} aria-label={t("cal.prev")}>
            <Icon name="back" size={14} />
          </button>
          <button
            className="btn"
            onClick={() => {
              setStart(today);
              setSelected(today);
            }}
          >
            {t("cal.today")}
          </button>
          <button className="btn" onClick={() => setStart(addDays(start, 7))} aria-label={t("cal.next")}>
            <Icon name="next" size={14} />
          </button>
        </div>
      </section>

      <div className="calgrid">
        {/* O meu dia */}
        <section className="w dayplan">
          <div className="w-head">
            <span className="label">
              <b>{pad(sel.getDate())}</b>
              {selected === today ? t("cal.dayPlan") : sel.toLocaleDateString(locale, { weekday: "long" })}
            </span>
            <span className="mono small">
              {doneN}/{checklist.length}
            </span>
          </div>
          <div className="row" style={{ alignItems: "flex-end", gap: 16, marginBottom: 14 }}>
            <span className="display" style={{ fontSize: "clamp(64px, 14vw, 120px)" }}>
              {pad(sel.getDate())}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8 }}>
              <span className="label">{sel.toLocaleDateString(locale, { weekday: "long" })}</span>
              <span className="muted small">{sel.toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
            </span>
          </div>
          <div className="progress" style={{ marginBottom: 18 }}>
            <i style={{ width: `${checklist.length ? (doneN / checklist.length) * 100 : 0}%` }} />
          </div>

          <form className="row addtask" onSubmit={addTask}>
            <input className="input" name="title" required style={{ flex: 1, minWidth: 160 }} placeholder={t("cal.taskPh")} aria-label={t("cal.taskPh")} />
            <input className="input" name="time" type="time" style={{ width: 110 }} aria-label={t("col.time")} />
            <button className="btn accent" type="submit">
              + {t("cal.add")}
            </button>
          </form>

          {selEvents.length === 0 && <p className="muted">{t("cal.nothing")}</p>}
          <ol className="timeline">
            {selEvents.map((e, i) => {
              const live = selected === today && e.kind === "session" && e.time <= nowHM && nowHM < e.end;
              return (
                <li key={i} className={live ? "live" : ""}>
                  <span className="mono small tl-time">{e.kind === "session" ? range(e.time, e.end) : e.time || t("cal.allDay")}</span>
                  <div className="tl-body">
                    {e.kind === "task" && (
                      <div className={`row tl-task ${e.task.done ? "done" : ""}`} style={{ flexWrap: "nowrap" }}>
                        <button className="check sm" role="checkbox" aria-checked={e.task.done} aria-label={e.title} onClick={() => toggleTask(e.task)} />
                        <span className="scene-title" style={{ flex: 1 }}>
                          {e.title}
                        </span>
                        <button className="btn ghost small" onClick={() => removeTask(e.task)} aria-label={t("remove")}>
                          <Icon name="close" size={14} />
                        </button>
                      </div>
                    )}
                    {e.kind === "deadline" && (
                      <div className="row" style={{ gap: 10 }}>
                        <span className="dot" style={{ background: e.color }} />
                        <span>
                          {t("cal.deadline")} · {e.title}
                        </span>
                        <Link href={`/p/${e.project.id}?tab=reels`} className="muted small arrow">
                          {e.project.title}
                        </Link>
                      </div>
                    )}
                    {e.kind === "session" && <SessionChecklist e={e} onToggle={(sceneId) => toggleScene(e.project.id, sceneId)} />}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* lista de dias (ref. calendário 14 · 15 · 16) */}
        <div className="daylist">
          {days.map((day) => {
            const d = new Date(day + "T12:00:00");
            const ev = eventsOf(day);
            return (
              <button key={day} className={`dayrow ${day === selected ? "sel" : ""} ${day === today ? "today" : ""}`} onClick={() => setSelected(day)}>
                <div className="daynum">
                  <span className="big">{pad(d.getDate())}</span>
                  <span className="label muted">{d.toLocaleDateString(locale, { weekday: "short" })}</span>
                </div>
                <div className="events">
                  {ev.length === 0 ? (
                    <div className="noevents">
                      <span className="navdot" /> {t("cal.noEvents")}
                    </div>
                  ) : (
                    ev.slice(0, 4).map((e, i) => (
                      <div key={i} className="event">
                        <span
                          className="ev-ico"
                          style={{
                            background: e.kind === "session" ? "var(--accent)" : e.kind === "deadline" ? e.color : e.task.done ? "var(--ok)" : "var(--live)",
                          }}
                        />
                        <span className={`ev-title ${e.kind === "task" && e.task.done ? "muted" : ""}`}>
                          <span>{e.title}</span>
                          {e.kind !== "task" && <span className="muted small">{e.project.title}</span>}
                        </span>
                        <span className="mono small">{e.time || "—"}</span>
                      </div>
                    ))
                  )}
                  {ev.length > 4 && <div className="muted small" style={{ paddingLeft: 12 }}>+{ev.length - 4}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <Toast msg={toast} />
    </AppShell>
  );
}

function SessionChecklist({ e, onToggle }: { e: Extract<Ev, { kind: "session" }>; onToggle: (sceneId: string) => void }) {
  const { t } = useT();
  const st = sessionStats(e.session);
  return (
    <div>
      <div className="row between">
        <span>
          <b style={{ fontWeight: 500 }}>{e.title}</b> <span className="muted small">· {e.project.title}</span>
        </span>
        <Link href={`/p/${e.project.id}/shoot`} className="chip accent">
          <Icon name="play" size={14} /> {t("cal.scenes", { done: st.done, total: st.total })}
        </Link>
      </div>
      {e.session.blocks.map((b: Block) => (
        <div key={b.id} style={{ marginTop: 10 }}>
          <div className="label muted" style={{ marginBottom: 4 }}>
            {range(b.start, b.end)} · {b.title}
          </div>
          {b.scenes.map((c) => (
            <div key={c.id} className={`row tl-task ${c.done ? "done" : ""}`} style={{ flexWrap: "nowrap", padding: "4px 0" }}>
              <button className="check sm" role="checkbox" aria-checked={c.done} aria-label={c.title} onClick={() => onToggle(c.id)} />
              <span className="scene-title">{c.title}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
