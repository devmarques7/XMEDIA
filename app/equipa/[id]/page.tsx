"use client";

// Ficha de um membro da equipa: o que está a fazer, o plano e o andamento da semana, produtividade,
// metas (feitas ou não) e o kanban das tarefas dele. O valor/hora é o único dado que o admin preenche.
import { DayPlanner } from "@/components/team/DayPlanner";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/Shell";
import { Bars, Ring, Tile } from "@/components/bento";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { Toast, useToast } from "@/components/ui";
import { Avatar } from "@/components/team/Avatar";
import { TaskKanban } from "@/components/team/TaskKanban";
import { useStudio } from "@/components/team/useStudio";
import { phaseOf } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { goalProgress, shiftWeek, stalled, taskOwner, weekDays, workload, type Goal } from "@/lib/studio";
import { CURRENCIES, entryMinutes, fmtHours, fmtMoney, team, type Currency } from "@/lib/team";

const KINDS: Goal["kind"][] = ["posts", "tasks", "hours", "manual"];

export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useT();
  const [toast, setToast] = useToast();
  const S = useStudio();
  const person = S.people.find((p) => (id === "me" ? !p.member : p.member?.id === id));
  const email = person?.email ?? "";
  const w = useMemo(() => workload(email, S.week, S.posts, S.tasks, S.entries, person?.member?.id, S.prevEntries), [email, S.week, S.posts, S.tasks, S.entries, S.prevEntries, person]);
  const days = weekDays(S.week);
  const myGoals = S.goals.filter((g) => g.member === email && g.week === S.week);
  const myTasks = S.tasks.filter((x) => taskOwner(x) === email);
  const [g, setG] = useState<{ title: string; kind: Goal["kind"]; target: number }>({ title: "", kind: "posts", target: 3 });
  const m = person?.member;
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [cur, setCur] = useState<Currency | null>(null);

  if (!S.customers) return <AppShell>{null}</AppShell>;
  if (!person)
    return (
      <AppShell>
        <p className="w muted">{t("st.noMember")}</p>
      </AppShell>
    );

  const hoursByDay = days.map((d) => (m ? S.entries.filter((e) => e.member_id === m.id && e.date === d).reduce((a, e) => a + entryMinutes(e), 0) / 60 : 0));
  const dayItems = (d: string) => [
    ...myTasks.filter((x) => x.due === d).map((x) => ({ k: "t" as const, id: x.id, title: x.title, sub: x.customer, done: x.done })),
    ...w.posts.filter((p) => p.scheduled_at?.slice(0, 10) === d).map((p) => ({ k: "p" as const, id: p.id, title: p.title || t(`ct.type.${p.type}` as Key), sub: S.customers!.find((c) => c.id === p.customer_id)?.name ?? "", done: ["approved", "scheduled", "published"].includes(phaseOf(p)) })),
  ];
  const goalsDone = myGoals.filter((x) => goalProgress(x, w).done).length;
  const weekLabel = `${new Date(days[0] + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${new Date(days[6] + "T12:00:00").toLocaleDateString(locale, { day: "numeric", month: "short" })}`;

  async function addGoal() {
    if (!g.title.trim()) return;
    await S.saveGoals([...S.goals, { id: crypto.randomUUID(), member: email, title: g.title.trim(), kind: g.kind, target: Math.max(1, g.target), week: S.week }]);
    setG({ ...g, title: "" });
  }
  async function saveRate() {
    if (!m) return;
    try {
      await team.saveMember({ ...m, rate: rate ?? m.rate, rate_currency: cur ?? m.rate_currency });
      setToast(t("st.rateSaved"));
      S.reload();
    } catch (e) {
      setToast((e as Error).message);
    }
  }

  return (
    <AppShell
      left={
        <Link href="/equipa" className="btn ghost">
          <Icon name="back" size={14} /> {t("nav.team")}
        </Link>
      }
    >
      <section className="pagehead mb-head">
        <div className="row" style={{ gap: 16, flexWrap: "nowrap", minWidth: 0 }}>
          <Avatar name={person.name} photo={person.photo} size={72} />
          <div style={{ minWidth: 0 }}>
            <span className="label muted">{person.role || "—"}</span>
            <h1 className="h1" style={{ margin: 0 }}>
              {person.name}
            </h1>
            <span className="muted small">{person.email}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn accent" onClick={() => setPlanFor(email)} data-testid="mb-plan">
            <Icon name="sparkles" size={14} /> {t("dpl.planFor", { name: person.name.split(" ")[0] })}
          </button>
          <button className="btn" onClick={() => S.setWeek(shiftWeek(S.week, -1))} aria-label={t("cal.prev")}>
            <Icon name="back" size={14} />
          </button>
          <span className="label" style={{ minWidth: 130, textAlign: "center" }}>
            {weekLabel}
          </span>
          <button className="btn" onClick={() => S.setWeek(shiftWeek(S.week, 1))} aria-label={t("cal.next")}>
            <Icon name="next" size={14} />
          </button>
        </div>
      </section>

      <div className="widgets" style={{ paddingTop: 0 }}>
        <Tile title={t("st.week")} span={3} className="mb-ring">
          <Ring value={w.progress / 100}>
            <b className="tile-num">{w.progress}%</b>
            <span className="muted small">{t("st.weekDone")}</span>
          </Ring>
        </Tile>
        <Tile title={t("st.hours")} span={3} className="st-kpi" value={m ? fmtHours(w.minutes) : "—"} of={m ? t("st.vsPrev", { h: fmtHours(w.prevMinutes) }) : t("st.noHours")}>
          <Bars values={hoursByDay} labels={days.map((d) => new Date(d + "T12:00:00").toLocaleDateString(locale, { weekday: "narrow" }))} small />
        </Tile>
        <Tile title={t("st.delivered")} span={2} className="st-kpi" value={String(w.delivered.length).padStart(2, "0")} of={t("st.inProgress", { n: w.openPosts.length })} />
        <Tile title={t("st.tasksDone")} span={2} className="st-kpi" value={String(w.doneTasks.length).padStart(2, "0")} of={t("st.openN", { n: w.openTasks.length })} />
        <Tile title={t("st.goals")} span={2} className="st-kpi" value={`${goalsDone}/${myGoals.length}`} of={w.lateTasks ? t("st.lateN", { n: w.lateTasks }) : t("st.onTrack")} />

        {/* Plano da semana */}
        <section className="w span-12 stack">
          <div className="row between">
            <span className="tile-t">{t("st.plan")}</span>
            <span className="muted small">{t("st.planHint")}</span>
          </div>
          <div className="wk">
            {days.map((d, i) => {
              const items = dayItems(d);
              const isToday = d === new Date().toISOString().slice(0, 10);
              return (
                <div key={d} className={`wk-day ${isToday ? "today" : ""}`}>
                  <header>
                    <span className="mono small muted">{new Date(d + "T12:00:00").toLocaleDateString(locale, { weekday: "short" })}</span>
                    <b>{Number(d.slice(8))}</b>
                    {hoursByDay[i] > 0 && <span className="mono small">{hoursByDay[i].toFixed(1)}h</span>}
                  </header>
                  {items.map((x) => (
                    <span key={x.k + x.id} className={`wk-item ${x.k} ${x.done ? "done" : ""}`}>
                      <Icon name={x.k === "p" ? "video" : "check"} size={12} /> {x.title}
                      <small className="muted">{x.sub}</small>
                    </span>
                  ))}
                  {!items.length && <span className="muted small">—</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* O que está a fazer */}
        <section className="w span-7 stack">
          <span className="tile-t">{t("st.doing")}</span>
          {!w.openPosts.length && <p className="muted small">{t("st.free")}</p>}
          {w.openPosts.map((p) => {
            const c = S.customers!.find((x) => x.id === p.customer_id);
            const late = stalled(p, S.settings.process);
            return (
              <Link key={p.id} href={`/clientes/${p.customer_id}?tab=content&post=${p.id}`} className={`st-row ${late ? "late" : ""}`}>
                <Avatar name={c?.name ?? "?"} photo={c?.cover || c?.instagram.picture} size={28} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b>{p.title || t(`ct.type.${p.type}` as Key)}</b>
                  <span className="muted small"> · {c?.name}</span>
                </span>
                <span className="label muted">{t(`pl.phase.${phaseOf(p)}` as Key)}</span>
                {late && <span className="label tone-danger">{t("st.stalled")}</span>}
              </Link>
            );
          })}
        </section>

        {/* Metas */}
        <section className="w span-5 stack">
          <span className="tile-t">{t("st.goals")}</span>
          {!myGoals.length && <p className="muted small">{t("st.noGoals")}</p>}
          {myGoals.map((x) => {
            const pr = goalProgress(x, w);
            return (
              <div key={x.id} className={`goal ${pr.done ? "done" : ""}`} data-testid="goal">
                <button
                  className="check sm"
                  role="checkbox"
                  aria-checked={pr.done}
                  aria-label={x.title}
                  disabled={x.kind !== "manual"}
                  onClick={() => S.saveGoals(S.goals.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)))}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{x.title}</b>
                  <span className="cu-bar">
                    <i style={{ width: `${pr.pct}%` }} />
                  </span>
                  <span className="mono small muted">
                    {x.kind === "manual" ? (pr.done ? t("st.goalDone") : t("st.goalOpen")) : `${pr.value}/${x.target} ${t(`st.kind.${x.kind}` as Key)}`}
                  </span>
                </span>
                <button className="btn ghost small" onClick={() => S.saveGoals(S.goals.filter((y) => y.id !== x.id))} aria-label={t("ra.delete")}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            );
          })}
          <form className="goal-new" onSubmit={(e) => (e.preventDefault(), addGoal())}>
            <input className="input" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} placeholder={t("st.goalPh")} data-testid="goal-title" />
            <Select className="select" value={g.kind} onChange={(e) => setG({ ...g, kind: e.target.value as Goal["kind"] })} aria-label={t("st.goalKind")}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`st.kind.${k}` as Key)}
                </option>
              ))}
            </Select>
            {g.kind !== "manual" && <input className="input mono" type="number" min={1} value={g.target} onChange={(e) => setG({ ...g, target: +e.target.value })} style={{ width: 70 }} aria-label={t("st.target")} />}
            <button className="btn accent small" disabled={!g.title.trim()} data-testid="goal-add">
              <Icon name="plus" size={14} />
            </button>
          </form>
        </section>

        {/* Valor/hora: o único dado que o admin preenche */}
        {m && (
          <section className="w span-12 row between" style={{ gap: 12 }}>
            <span className="row" style={{ gap: 10 }}>
              <span className="tile-t">{t("ti.rateTodo")}</span>
              {!m.rate && <span className="label tone-warn">{t("st.rateMissing")}</span>}
              <span className="muted small">{t(`rl.role.${m.app_role}` as Key)}</span>
            </span>
            <span className="row" style={{ gap: 8 }}>
              <input className="input mono" type="number" min={0} step={0.5} value={rate ?? m.rate} onChange={(e) => setRate(+e.target.value)} style={{ width: 110 }} aria-label={t("ti.rateTodo")} data-testid="rate" />
              <Select className="select" value={cur ?? m.rate_currency} onChange={(e) => setCur(e.target.value as Currency)} style={{ width: 90 }} aria-label={t("tm.currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <span className="muted small">{fmtMoney(rate ?? m.rate, cur ?? m.rate_currency, locale)}{t("tm.perHour")}</span>
              <button className="btn" onClick={saveRate} disabled={rate === null && cur === null}>
                <Icon name="check" size={14} /> {t("save")}
              </button>
            </span>
          </section>
        )}

        <section className="w span-12 stack">
          <span className="tile-t">{t("st.kanban")}</span>
          <TaskKanban tasks={myTasks} people={S.people} customers={S.customers} me={S.me} defaultAssignee={email} onSave={S.saveTask} />
        </section>
      </div>
      {planFor && <DayPlanner S={S} person={planFor} onClose={() => setPlanFor(null)} />}
      <Toast msg={toast || S.err} />
    </AppShell>
  );
}
