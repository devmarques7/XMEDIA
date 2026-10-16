"use client";

// Plano do dia (para mim ou para qualquer pessoa da equipa): a IA ordena as tarefas da pessoa e escolhe, pela
// função, que pendentes da empresa lhe atribuir; o horário é montado em pomodoros a partir de agora, com almoço,
// jantar e hora de fim. Sem IA, usa a prioridade e as regras por função. "Aplicar" cria as tarefas e grava o plano.
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { useT, type Key } from "@/lib/i18n";
import { newTask } from "@/lib/tasks";
import { mine, type TodayTask } from "@/lib/today";
import { calibrate, estimateTask, fmtMin, normalizePlan, pendingWork, type Pending } from "@/lib/plan";
import { buildSchedule, minutesOfDay, normalizeSchedule, type DaySchedule, type ScheduleSettings } from "@/lib/schedule";
import { pickForRole, roleKind } from "@/lib/teamPlan";
import { ymd, type StudioTask } from "@/lib/studio";
import { Avatar } from "./Avatar";
import type { useStudio } from "./useStudio";

type S = ReturnType<typeof useStudio>;
type Person = { email: string; name: string; role: string; description?: string; responsibilities?: string; photo?: string };
type Result = { order: string[]; assign: { key: string; why: string }[]; notes: string; tips: string[]; source: "ai" | "rules"; error?: string };

const addDaysISO = (d: string, n: number) => new Date(new Date(d + "T12:00:00").getTime() + n * 86_400_000).toISOString().slice(0, 10);
const BLOCK_ICON: Record<string, string> = { focus: "🍅", short: "☕", long: "🚶", lunch: "🍽", dinner: "🍽" };

export function DayPlanner({ S, onClose, person: initial, items: priority }: { S: S; onClose: () => void; person?: string; items?: TodayTask[] }) {
  const { t, lang } = useT();
  const today = ymd(new Date());
  const people: Person[] = useMemo(() => {
    const me = S.members.find((m) => (m.email ?? "").toLowerCase() === S.me);
    const list: Person[] = [{ email: S.me, name: me?.name || t("dpl.me"), role: me?.role || "Admin", description: me?.description, responsibilities: (me?.responsibilities ?? []).join(", "), photo: me?.photo_url }];
    for (const m of S.members) if (m.active && m.email && m.email.toLowerCase() !== S.me) list.push({ email: m.email.toLowerCase(), name: m.name, role: m.role, description: m.description, responsibilities: (m.responsibilities ?? []).join(", "), photo: m.photo_url });
    return list;
  }, [S.members, S.me, t]);
  const [who, setWho] = useState(initial ?? S.me);
  const [day, setDay] = useState(today);
  const [cfg, setCfg] = useState<ScheduleSettings>(normalizeSchedule(S.settings.schedule));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [applied, setApplied] = useState(false);
  const person = people.find((p) => p.email === who) ?? people[0];
  const plan = normalizePlan(S.settings.plan);
  const isMe = person.email === S.me;
  // calibração só para mim (as horas registadas são minhas); para os outros, estimativas base
  const factor = useMemo(() => (isMe ? calibrate([...S.prevEntries, ...S.entries], S.tasks.filter((x) => mine(x, S.me)), S.posts, plan, today).factor : 1), [isMe, S.prevEntries, S.entries, S.tasks, S.posts, S.me, plan, today]);
  const est = (x: StudioTask) => Math.round(estimateTask(x, S.posts, plan) * factor);
  const startAt = day === today ? minutesOfDay(new Date()) : 0;
  // tarefas da pessoa até ao dia (inclui atrasadas), na ordem atual da checklist
  const rank = (x: StudioTask) => (priority ? priority.findIndex((y) => y.t.id === x.id) : -1);
  const tasks = S.tasks
    .filter((x) => !x.deleted && !x.done && mine(x, person.email) && x.due && x.due <= day)
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || (rank(a) === -1 ? 1e9 : rank(a)) - (rank(b) === -1 ? 1e9 : rank(b)));
  // pendentes da empresa sem responsável (ou já desta pessoa)
  const pool: Pending[] = pendingWork(S.posts.filter((p) => !p.assignee || p.assignee.toLowerCase() === person.email), S.tasks, S.settings.process, plan, new Date(), factor);
  const probe = buildSchedule([{ id: "_", title: "", min: 99999 }], cfg, day, startAt);
  const capacity = probe.focus_min;
  const taskMin = tasks.reduce((a, x) => a + est(x), 0);
  const free = Math.max(0, capacity - taskMin);
  const client = (id: string) => (S.customers ?? []).find((c) => c.id === id)?.name ?? "XMEDIA";
  const label = (x: Pending) => `${t(`td.act.${x.action}` as Key)}: ${x.p.title || t(`ct.type.${x.p.type}` as Key)}`;

  async function generate() {
    setBusy(true);
    setApplied(false);
    const body = {
      lang,
      day,
      start: probe.start,
      focus_available: capacity,
      person: { name: person.name, role: person.role, description: person.description, responsibilities: person.responsibilities, is_me: isMe },
      tasks: tasks.map((x) => ({ id: x.id, title: x.title, client: client(x.customer_id), min: est(x), due: x.due, priority: 100 - Math.max(0, rank(x)) })),
      pool: pool.slice(0, 50).map((x) => ({ key: x.p.id, title: x.p.title || x.p.type, client: client(x.p.customer_id), type: x.p.type, action: x.action, min: x.min, due: x.due, reason: x.reason })),
    };
    const fallback = (error?: string): Result => ({
      order: tasks.map((x) => x.id),
      assign: pickForRole(pool.map((x) => ({ ...x, type: x.p.type })), roleKind(`${person.role} ${person.description ?? ""} ${person.responsibilities ?? ""}`), free).map((x) => ({ key: x.p.id, why: t("dpl.whyRole", { role: person.role || "—" }) })),
      notes: "",
      tips: [],
      source: "rules",
      error,
    });
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const c = localStorage.getItem("xmedia:ai:code");
        if (c) headers["x-xmedia-ai-code"] = c;
      } catch {}
      const r = await fetch("/api/ai/plan-day", { method: "POST", headers, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      setRes(r.ok ? { ...j, source: "ai" } : fallback(j.error || `http_${r.status}`));
    } catch (e) {
      setRes(fallback((e as Error).message));
    }
    setBusy(false);
  }

  // horário a partir do resultado: tarefas na ordem escolhida + pendentes atribuídos
  const assigned = (res?.assign ?? []).map((a) => ({ a, x: pool.find((p) => p.p.id === a.key) })).filter((y): y is { a: { key: string; why: string }; x: Pending } => !!y.x);
  const schedule: DaySchedule | null = res
    ? buildSchedule(
        [
          ...res.order.map((id) => tasks.find((x) => x.id === id)).filter((x): x is StudioTask => !!x).map((x) => ({ id: x.id, title: x.title, min: est(x) })),
          ...assigned.map(({ x }) => ({ id: `post:${x.p.id}`, title: label(x), min: x.min })),
        ],
        cfg,
        day,
        startAt
      )
    : null;

  async function apply() {
    if (!res || !schedule) return;
    setBusy(true);
    // 1) ordem da checklist da pessoa
    for (const [i, id] of res.order.entries()) {
      const x = tasks.find((y) => y.id === id);
      if (x && x.rank !== i) await S.saveTask({ ...x, rank: i });
    }
    // 2) pendentes atribuídos → tarefas da pessoa nesse dia (e o conteúdo fica com responsável)
    for (const [i, { x }] of assigned.entries()) {
      const task = newTask({ title: label(x), by: "MediaMarques", side: "studio", internal: true, due: day, post_id: x.p.id, assignee: person.email, mentions: [person.email], progress: "todo", estimate: Math.round(x.min / factor), rank: res.order.length + i });
      await S.saveTask({ ...task, customer_id: x.p.customer_id, customer: client(x.p.customer_id) });
      if (!x.p.assignee) await S.savePost({ ...x.p, assignee: person.email });
    }
    // 3) guarda o plano do dia (últimos 30)
    const key = `${person.email}:${day}`;
    const plans = { ...(S.settings.day_plans ?? {}), [key]: { ...schedule, notes: res.notes, tips: res.tips, source: res.source, at: new Date().toISOString(), person: person.email } };
    const keep = Object.fromEntries(Object.entries(plans).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 30));
    await S.patchSettings({ day_plans: keep, schedule: cfg });
    setBusy(false);
    setApplied(true);
  }

  const saved = S.settings.day_plans?.[`${person.email}:${day}`];
  const view = schedule ?? saved ?? null;
  return (
    <div className="overlay ov-top" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog dpl" role="dialog" aria-modal="true" aria-label={t("dpl.title")} data-testid="day-planner">
        <header className="row between">
          <span className="row" style={{ gap: 8 }}>
            <Icon name="sparkles" size={18} /> <b className="dpl-title">{t("dpl.title")}</b>
          </span>
          <button className="btn ghost" onClick={onClose} aria-label={t("ct.close")} disabled={busy}>
            <Icon name="close" />
          </button>
        </header>

        <div className="dpl-bar">
          <label className="field">
            <span>{t("dpl.for")}</span>
            <Select className="select" value={who} onChange={(e) => (setWho(e.target.value), setRes(null))} data-testid="dpl-person">
              {people.map((p) => (
                <option key={p.email} value={p.email}>
                  {p.name}
                  {p.role ? ` · ${p.role}` : ""}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>{t("dpl.day")}</span>
            <Select className="select" value={day} onChange={(e) => (setDay(e.target.value), setRes(null))}>
              <option value={today}>{t("td.when.today")}</option>
              <option value={addDaysISO(today, 1)}>{t("td.when.tomorrow")}</option>
            </Select>
          </label>
          <label className="field">
            <span>{t("dpl.dayStart")}</span>
            <input className="input" type="time" value={cfg.day_start} onChange={(e) => setCfg({ ...cfg, day_start: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("dpl.lunch")}</span>
            <input className="input" type="time" value={cfg.lunch_at} onChange={(e) => setCfg({ ...cfg, lunch_at: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("dpl.dinner")}</span>
            <input className="input" type="time" value={cfg.dinner_at} onChange={(e) => setCfg({ ...cfg, dinner_at: e.target.value })} />
          </label>
          <label className="field">
            <span>{t("dpl.work")}</span>
            <Select className="select" value={String(cfg.work_min)} onChange={(e) => setCfg({ ...cfg, work_min: Number(e.target.value) })}>
              {[240, 360, 420, 480, 540].map((m) => (
                <option key={m} value={String(m)}>
                  {fmtMin(m)}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="dpl-sum">
          <Avatar name={person.name} photo={person.photo} size={32} />
          <span className="small">
            <b>{person.name}</b> {person.role && <span className="muted">· {person.role}</span>}
            <br />
            <span className="muted">{t("dpl.summary", { n: tasks.length, m: fmtMin(taskMin), cap: fmtMin(capacity), free: fmtMin(free), pool: pool.length })}</span>
          </span>
          <button className="btn accent" onClick={generate} disabled={busy} data-testid="dpl-generate">
            <Icon name="sparkles" size={14} /> {busy ? t("dpl.thinking") : res || saved ? t("dpl.again") : t("dpl.go")}
          </button>
        </div>

        {res?.source === "rules" && <p className="note small">{t("dpl.rules", { e: res.error ?? "" })}</p>}
        {res?.notes && (
          <p className="dpl-notes small" data-testid="dpl-notes">
            <Icon name="sparkles" size={13} /> {res.notes}
          </p>
        )}
        {!!res?.tips?.length && (
          <ul className="dpl-tips small">
            {res.tips.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        )}
        {assigned.length > 0 && (
          <section className="dpl-assign">
            <span className="tile-t">{t("dpl.assigned", { name: person.name })}</span>
            <ul>
              {assigned.map(({ a, x }) => (
                <li key={a.key}>
                  <b>{label(x)}</b> <span className="muted small">· {client(x.p.customer_id)} · ~{fmtMin(x.min)}</span>
                  <span className="muted small dpl-why">{a.why}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view ? (
          <section className="dpl-time" data-testid="dpl-schedule">
            <div className="row between">
              <span className="tile-t">
                {t("dpl.schedule")} · {view.start}–{view.end}
              </span>
              <span className="mono small">{t("dpl.totals", { f: fmtMin(view.focus_min), p: view.pomodoros, end: view.end })}</span>
            </div>
            <ol className="dpl-blocks">
              {view.blocks.map((b, i) => (
                <li key={i} className={`dpl-b ${b.kind}`}>
                  <span className="mono dpl-at">
                    {b.start}–{b.end}
                  </span>
                  <span aria-hidden>{BLOCK_ICON[b.kind]}</span>
                  <span className="dpl-what">
                    {b.kind === "focus" ? (
                      <>
                        {b.title} {b.part && b.part[1] > 1 && <span className="muted small">({b.part[0]}/{b.part[1]})</span>}
                      </>
                    ) : (
                      t(`dpl.k.${b.kind}` as Key)
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="dpl-end small">
              <Icon name="flag" size={13} /> {t("dpl.endAt", { end: view.end })}
            </p>
            {view.unscheduled.length > 0 && (
              <div className="note small">
                {t("dpl.notFit")}{" "}
                {view.unscheduled.map((u) => `${u.title} (${fmtMin(u.left)})`).join(" · ")}
              </div>
            )}
          </section>
        ) : (
          !busy && <p className="muted small">{t("dpl.hint")}</p>
        )}

        <footer className="row between">
          <span className="muted small">{saved && !res ? t("dpl.savedAt", { at: new Date(saved.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }) : ""}</span>
          <span className="row" style={{ gap: 8 }}>
            {applied && <span className="label tone-ok">{t("dpl.applied")}</span>}
            <button className="btn accent" onClick={apply} disabled={busy || !res || applied} data-testid="dpl-apply">
              <Icon name="check" size={14} /> {t("dpl.apply")}
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}
