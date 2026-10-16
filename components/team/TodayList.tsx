"use client";

// Checklist "Hoje": o que fazer hoje (e nesta semana), por prioridade. Fiz → check → atualiza na hora (otimista).
// Completo na página /tarefas; compacto no Estúdio (só atrasadas, hoje e semana, sem sugestões).
import { DayPlanner } from "./DayPlanner";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Collapsible } from "@/components/Collapsible";
import { Icon } from "@/components/Icon";
import { useT, type Key } from "@/lib/i18n";
import { newTask } from "@/lib/tasks";
import { taskOwner, weekDays, weekOf, ymd, type StudioTask } from "@/lib/studio";
import { COMPANY, autoPlan, byRank, dueTag, reorder, type PlanRange, isInternal, mine, mineOrOpen, suggestions, todayTasks, type Bucket, type TodayTask } from "@/lib/today";
import { Avatar } from "./Avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { TypeIcon } from "@/components/customer/parts";
import { AssigneePicker } from "./Assignees";
import { TodayCalendar } from "./TodayCalendar";
import { CapacityBar } from "./Capacity";
import { Select } from "@/components/Select";
import { calibrate, dayLoad, estimateTask, firstFreeDay, fmtMin, normalizePlan, pendingWork, recommend, type Pending } from "@/lib/plan";
import type { useStudio } from "./useStudio";

type S = ReturnType<typeof useStudio>;
export type Filter = "all" | "mine" | "internal";

const LS_FILTER = "xmedia:td:filter";
/** Filtro da lista Hoje partilhado com o avatar do topo da página; por omissão "mine" (as minhas + sem responsável). */
export function useTodayFilter(): [Filter, (f: Filter) => void] {
  const [f, setF] = useState<Filter>("mine");
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_FILTER);
      if (v === "all" || v === "mine" || v === "internal") setF(v);
    } catch {}
  }, []);
  return [
    f,
    (v: Filter) => {
      setF(v);
      try {
        localStorage.setItem(LS_FILTER, v);
      } catch {}
    },
  ];
}

/** Avatar no canto superior direito da página Hoje: alterna entre "as minhas (+ sem responsável)" e "de todos". Só o
 * avatar (realçado quando o foco está ligado); a explicação aparece numa tooltip ao passar o rato. */
export function FocusToggle({ S, filter, onFilter }: { S: S; filter: Filter; onFilter: (f: Filter) => void }) {
  const { t } = useT();
  const me = S.people.find((p) => p.email === S.me);
  const focused = filter === "mine";
  const open = S.tasks.filter((x) => !x.deleted && !x.done && mineOrOpen(x, S.me)).length;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className={`td-focus ${focused ? "on" : ""}`} onClick={() => onFilter(focused ? "all" : "mine")} aria-pressed={focused} aria-label={focused ? t("td.focusOn") : t("td.focusOff")} data-testid="td-focus">
          <Avatar name={me?.name || S.me || "?"} photo={me?.photo} size={34} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" data-testid="td-focus-tip">
        <b>{focused ? t("td.f.mine") : t("td.f.all")}</b>
        <span className="tt-sub">{focused ? t("td.focusCount", { n: open }) : t("td.focusAll")}</span>
        <span className="tt-hint">{focused ? t("td.focusClickAll") : t("td.focusClickMine")}</span>
      </TooltipContent>
    </Tooltip>
  );
}
type When = "today" | "tomorrow" | "week" | "none";

const addDays = (d: string, n: number) => ymd(new Date(new Date(d + "T12:00:00").getTime() + n * 86_400_000));

/** Título da tarefa: clicar (ou Enter) edita no sítio; Enter/sair grava, Esc cancela. */
function EditableTitle({ value, label, onSave }: { value: string; label: string; onSave: (v: string) => unknown }) {
  const [edit, setEdit] = useState<string | null>(null);
  const done = (save: boolean) => {
    const v = (edit ?? "").trim();
    setEdit(null);
    if (save && v && v !== value) onSave(v);
  };
  if (edit !== null)
    return (
      <textarea
        className="td-title-in"
        value={edit}
        autoFocus
        rows={1}
        ref={(el) => {
          // cresce com o texto: vê-se sempre tudo o que foi escrito
          if (el) (el.style.height = "auto"), (el.style.height = `${el.scrollHeight}px`);
        }}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setEdit(e.target.value)}
        onBlur={() => done(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) (e.preventDefault(), done(true));
          if (e.key === "Escape") done(false);
        }}
        aria-label={label}
        data-testid="td-title-in"
      />
    );
  return (
    <b className="td-title editable" role="button" tabIndex={0} title={label} onClick={() => setEdit(value)} onKeyDown={(e) => e.key === "Enter" && setEdit(value)} data-testid="td-title">
      <span className="td-title-t">{value}</span>
      <Icon name="edit" size={13} className="td-pen" />
    </b>
  );
}

export function TodayList({ S, compact, max = 8, clientId, filter: outer, onFilter }: { S: S; compact?: boolean; max?: number; clientId?: string; /** Filtro controlado pela página (avatar do topo). */ filter?: Filter; onFilter?: (f: Filter) => void }) {
  const { t, locale } = useT();
  const today = ymd(new Date());
  const [own, setOwn] = useState<Filter>("all");
  const filter = outer ?? own;
  const setFilter = onFilter ?? setOwn;
  const [title, setTitle] = useState("");
  const [cust, setCust] = useState(COMPANY);
  const [when, setWhen] = useState<When>("today");
  const [tab, setTab] = useState<When | "done">("today");
  const [planning, setPlanning] = useState(false);
  const [planMsg, setPlanMsg] = useState("");
  const [scope, setScope] = useState<string>(clientId ?? "all"); // "all" | COMPANY | id do cliente
  // filtro de cliente vindo de fora (Estúdio)
  useEffect(() => setScope(clientId ?? "all"), [clientId]);
  const [fab, setFab] = useState(false);
  const [dayPlan, setDayPlan] = useState(false);
  const [dropOn, setDropOn] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  useEffect(() => {
    try {
      setHideDone(localStorage.getItem("xmedia:td:hideDone") === "1");
    } catch {}
  }, []);
  const setHide = (v: boolean) => {
    setHideDone(v);
    try {
      localStorage.setItem("xmedia:td:hideDone", v ? "1" : "0");
    } catch {}
  };
  const input = useRef<HTMLInputElement>(null);

  const items = useMemo(() => todayTasks(S.tasks, S.posts, S.settings.process), [S.tasks, S.posts, S.settings.process]);
  const shown = items.filter((x) => (filter === "mine" ? mineOrOpen(x.t, S.me) : filter === "internal" ? isInternal(x.t) : true));
  const by = (b: Bucket) => shown.filter((x) => x.bucket === b);
  const sugg = useMemo(() => (compact ? [] : suggestions(S.posts, S.tasks, S.settings.process)), [compact, S.posts, S.tasks, S.settings.process]);
  const person = (e: string) => S.people.find((p) => p.email === e);
  // ---------- capacidade: as minhas tarefas, calibradas pelas horas que registei nos últimos 14 dias ----------
  const planCfg = normalizePlan(S.settings.plan);
  const meMember = S.members.find((m) => (m.email ?? "").toLowerCase() === S.me);
  const myTasks = useMemo(() => S.tasks.filter((x) => mine(x, S.me)), [S.tasks, S.me]);
  const cal = useMemo(
    () => calibrate([...S.prevEntries, ...S.entries].filter((e) => !meMember || e.member_id === meMember.id), myTasks, S.posts, planCfg, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [S.entries, S.prevEntries, myTasks, S.posts, meMember?.id, S.settings.plan, today]
  );
  const factor = cal.factor;
  const est = (x: StudioTask) => Math.round(estimateTask(x, S.posts, planCfg) * factor);
  const nextFree = (min: number, from = today, list = myTasks) => firstFreeDay(min, from, today, list, S.posts, planCfg, factor);
  // ---------- ordem manual da checklist (arrastar pela pega; funciona com rato e toque) ----------
  const [sortDrag, setSortDrag] = useState<{ id: string; y0: number; dy: number; to: number } | null>(null);
  const orderRef = useRef<TodayTask[]>([]);
  async function applyOrder(from: number, to: number) {
    const list = orderRef.current;
    if (from === to || from < 0) return;
    for (const r of reorder(list, from, to)) {
      const x = list.find((y) => y.t.id === r.id);
      if (x) await S.saveTask({ ...x.t, rank: r.rank });
    }
  }
  function gripDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSortDrag({ id, y0: e.clientY, dy: 0, to: orderRef.current.findIndex((x) => x.t.id === id) });
  }
  function gripMove(e: React.PointerEvent) {
    if (!sortDrag) return;
    // nova posição = quantas outras linhas têm o meio acima do ponteiro
    const others = [...document.querySelectorAll<HTMLElement>("[data-row-id]")].filter((r) => r.dataset.rowId !== sortDrag.id && orderRef.current.some((x) => x.t.id === r.dataset.rowId));
    const to = others.filter((r) => {
      const bx = r.getBoundingClientRect();
      return bx.top + bx.height / 2 < e.clientY;
    }).length;
    setSortDrag({ ...sortDrag, dy: e.clientY - sortDrag.y0, to });
  }
  const toTop = (x: TodayTask) => applyOrder(orderRef.current.findIndex((y) => y.t.id === x.t.id), 0);
  /** Linha onde vai cair: traço por cima (ou por baixo, no fim da lista). */
  const sortMark = (id: string) => {
    if (!sortDrag || sortDrag.id === id) return "";
    const others = orderRef.current.filter((x) => x.t.id !== sortDrag.id);
    if (others[sortDrag.to]?.t.id === id) return "sort-before";
    return sortDrag.to >= others.length && others[others.length - 1]?.t.id === id ? "sort-after" : "";
  };
  function gripUp() {
    const d = sortDrag;
    setSortDrag(null);
    if (!d) return;
    applyOrder(orderRef.current.findIndex((x) => x.t.id === d.id), d.to);
  }
  const client = (id: string) => S.customers?.find((c) => c.id === id);
  const openCount = shown.filter((x) => x.bucket === "late" || x.bucket === "today").length;
  const doneCount = by("done").length;

  const dueFor = (w: When) => (w === "today" ? today : w === "tomorrow" ? addDays(today, 1) : w === "week" ? weekDays(weekOf())[4] : "");
  async function add(extra?: Partial<StudioTask>) {
    const c = cust === COMPANY ? { id: COMPANY, name: "XMEDIA" } : client(cust);
    const name = (extra?.title ?? title).trim();
    if (!name || !c) return;
    const task = newTask({ title: name, by: person(S.me)?.name || "MediaMarques", side: "studio", internal: true, due: dueFor(when), assignee: S.me || undefined, mentions: S.me ? [S.me] : [], progress: "todo", ...extra });
    setTitle("");
    await S.saveTask({ ...task, customer_id: extra?.customer_id ?? c.id, customer: extra?.customer ?? c.name });
    input.current?.focus();
  }
  const drafts = useMemo(
    () => ({
      today: autoPlan("today", S.posts, S.tasks, S.settings.process),
      tomorrow: autoPlan("tomorrow", S.posts, S.tasks, S.settings.process),
      week: autoPlan("week", S.posts, S.tasks, S.settings.process),
    }),
    [S.posts, S.tasks, S.settings.process]
  );
  /** Cria de uma vez as tarefas do período a partir dos prazos (sem duplicar vídeos que já têm tarefa). */
  async function plan(r: PlanRange) {
    const list = drafts[r];
    if (!list.length) return;
    setPlanning(true);
    for (const d of list) {
      const owner = (d.assignee || S.me || "").toLowerCase();
      const task = newTask({ title: `${t(`td.act.${d.action}` as Key)}: ${d.title}`, by: person(S.me)?.name || "MediaMarques", side: "studio", internal: true, due: d.due, post_id: d.post_id, assignee: owner || undefined, mentions: owner ? [owner] : [], progress: "todo" });
      await S.saveTask({ ...task, customer_id: d.customer_id, customer: client(d.customer_id)?.name ?? "" });
    }
    setPlanning(false);
    setTab(r);
    setWhen(r);
    setPlanMsg(t("td.planned", { n: list.length }));
    setTimeout(() => setPlanMsg(""), 3500);
  }
  const toggle = (x: TodayTask) => S.saveTask({ ...x.t, done: !x.t.done });
  const postpone = (x: TodayTask) => S.saveTask({ ...x.t, due: addDays(x.t.due && x.t.due > today ? x.t.due : today, 1) });

  // função de render (não componente): as linhas não são recriadas a cada atualização, e a edição do título mantém o foco
  const row = (x: TodayTask) => {
    const c = x.t.customer_id ? client(x.t.customer_id) : null;
    const owners = [...new Set([taskOwner(x.t), ...x.t.mentions.map((m) => m.toLowerCase())].filter(Boolean))];
    return (
      <li
        key={x.t.id}
        className={`td-row ${x.t.done ? "done" : ""} ${x.bucket} ${sortDrag?.id === x.t.id ? "sorting" : ""} ${sortMark(x.t.id)}`}
        style={sortDrag?.id === x.t.id ? { transform: `translateY(${sortDrag.dy}px)` } : undefined}
        data-row-id={x.t.id}
        data-testid="td-row"
      >
        {!compact && !x.t.done && (
          <button className="td-grip-sort" onPointerDown={(e) => gripDown(e, x.t.id)} onPointerMove={gripMove} onPointerUp={gripUp} onPointerCancel={() => setSortDrag(null)} aria-label={t("td.dragOrder")} title={t("td.dragOrder")} data-testid="td-grip">
            <Icon name="grip" size={14} />
          </button>
        )}
        {!compact && !x.t.done && orderRef.current.findIndex((y) => y.t.id === x.t.id) > 0 && (
          <button className="td-totop" onClick={() => toTop(x)} aria-label={t("td.toTop")} title={t("td.toTop")} data-testid="td-totop">
            <Icon name="arrowUp" size={13} />
          </button>
        )}
        <button className="td-check" role="checkbox" aria-checked={x.t.done} aria-label={x.t.title} onClick={() => toggle(x)} data-testid="td-check">
          {x.t.done && <Icon name="check" size={14} strokeWidth={2.4} />}
        </button>
        <span className="td-main">
          <EditableTitle value={x.t.title} label={t("td.editTitle")} onSave={(title) => S.saveTask({ ...x.t, title })} />
          {x.t.notes?.trim() && <span className="td-notes">{x.t.notes}</span>}
          <span className="td-meta">
            <span className={`td-client ${x.t.customer_id ? "" : "int"}`}>
              {c ? <Avatar name={c.name} photo={c.cover || c.instagram.picture} size={16} /> : <Icon name="lock" size={12} />}
              {c?.name ?? t("td.internal")}
            </span>
            {x.post && (
              <Link href={`/clientes/${x.post.customer_id}?tab=content&post=${x.post.id}`} className="td-video">
                <TypeIcon type={x.post.type} /> <span className="td-video-k">{t(`ct.type.${x.post.type}` as Key)}</span> {x.post.title || ""}
              </Link>
            )}
            {x.alerts
              .filter((a) => a !== "late")
              .map((a) => (
                <span key={a} className={`label ${a === "stalled" || a === "changes" ? "tone-danger" : "muted"}`}>
                  {t(`td.alert.${a}` as Key)}
                </span>
              ))}
          </span>
        </span>
        {!x.t.done && (
          // prazo: clicar abre o calendário (e "×" tira o prazo)
          <label className={`dtag d-${dueTag(x.t.due)} td-due td-due-pick`} title={t("td.setDue")} data-testid="td-due" onClick={(e) => e.stopPropagation()}>
            <Icon name="calendar" size={11} />
            {x.lateDays ? t("td.lateBy", { n: x.lateDays }) : t(`td.tag.${dueTag(x.t.due)}` as Key)}
            {x.t.due && ["week", "ok", "overdue"].includes(dueTag(x.t.due)) ? ` · ${new Date(x.t.due + "T12:00:00").toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" })}` : ""}
            <input
              type="date"
              value={x.t.due}
              onChange={(e) => S.saveTask({ ...x.t, due: e.target.value })}
              onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
              aria-label={t("td.setDue")}
              data-testid="td-due-input"
            />
          </label>
        )}
        {!x.t.done && (
          <span className="td-est" title={x.t.estimate ? t("est.manual") : t("est.auto")} onClick={(e) => e.stopPropagation()}>
            <Select className="select" value={String(x.t.estimate ?? "")} onChange={(e) => S.saveTask({ ...x.t, estimate: Number(e.target.value) || undefined })} aria-label={t("est.label")} data-testid="td-est">
              <option value="">~{fmtMin(est(x.t))}</option>
              {[15, 30, 45, 60, 90, 120, 180, 240, 360].map((m) => (
                <option key={m} value={String(m)}>
                  {fmtMin(m)}
                </option>
              ))}
            </Select>
          </span>
        )}
        {!compact ? (
          <AssigneePicker value={owners[0]} people={S.people} onChange={(e) => S.saveTask({ ...x.t, assignee: e, mentions: [...new Set([...(e ? [e] : []), ...x.t.mentions.filter((m) => m.toLowerCase() !== (x.t.assignee ?? "").toLowerCase())])] })} />
        ) : (
          owners[0] && <Avatar name={person(owners[0])?.name ?? owners[0]} photo={person(owners[0])?.photo} size={22} />
        )}
        {!x.t.done && !compact && (
          <button className="btn ghost small td-later" onClick={() => postpone(x)} title={t("td.postpone")} aria-label={t("td.postpone")}>
            <Icon name="next" size={14} />
          </button>
        )}
        {!compact && (
          <button className="btn ghost small td-del" onClick={() => S.saveTask({ ...x.t, deleted: true })} aria-label={t("ra.delete")}>
            <Icon name="close" size={14} />
          </button>
        )}
      </li>
    );
  };

  if (compact) {
    // no Estúdio: segue o cliente escolhido; lista com scroll (mostra mais do que cabe)
    const top = shown.filter((x) => (scope === "all" || x.t.customer_id === scope) && (x.bucket === "late" || x.bucket === "today" || x.bucket === "week")).slice(0, max * 4);
    return (
      <div className="td compact">
        {!top.length && <p className="muted small">{t("td.clear")}</p>}
        <ul className="td-list td-scroll" data-testid="td-scroll">
          {top.map((x) => (
            row(x)
          ))}
        </ul>
      </div>
    );
  }

  // ---------- vista completa (/tarefas) ----------
  // cliente escolhido = filtro (lista e vídeos que pedem ação) e destino das novas tarefas
  const byClient = <T extends { customer_id: string }>(x: T) => scope === "all" || x.customer_id === scope;
  const tomorrow = addDays(today, 1);
  const weekEnd = weekDays(weekOf())[6];
  const doneToday = (x: TodayTask) => x.t.done && x.t.updated.slice(0, 10) === today;
  const inTab = (x: TodayTask, k: When) =>
    k === "today" ? x.bucket === "late" || x.bucket === "today" || (doneToday(x) && (!x.t.due || x.t.due <= today)) : k === "tomorrow" ? x.t.due === tomorrow : k === "week" ? !!x.t.due && x.t.due > tomorrow && x.t.due <= weekEnd : !x.t.due && !x.t.done;
  const scoped = shown.filter((x) => byClient(x.t));
  const TABS: { k: When; list: TodayTask[] }[] = (["today", "tomorrow", "week", "none"] as When[]).map((k) => ({ k, list: scoped.filter((x) => inTab(x, k)) }));
  const cur = TABS.find((x) => x.k === tab) ?? TABS[0];
  // feitas ficam visíveis (riscadas, no fim) — a menos que se oculte
  const openList = byRank(cur.list.filter((x) => !x.t.done));
  orderRef.current = openList;
  const list = [...openList, ...(hideDone ? [] : cur.list.filter((x) => x.t.done))];

  const open = cur.list.filter((x) => !x.t.done).length;
  const ghosts = Math.max(0, 3 - open);
  // pendentes: com um cliente escolhido mostra TUDO o que esse cliente ainda pede (sem filtro de data)
  const pend = pendingWork(S.posts.filter((p) => byClient(p)), S.tasks, S.settings.process, planCfg, new Date(), factor);
  const vids: Pending[] = scope === "all" || scope === COMPANY ? pend.filter((x) => x.reason !== "open") : pend;
  const capDay = tab === "tomorrow" ? tomorrow : today;
  const load = dayLoad(capDay, today, myTasks, S.posts, planCfg, factor);
  const todayLoad = capDay === today ? load : dayLoad(today, today, myTasks, S.posts, planCfg, factor);
  const weekLoads = weekDays(weekOf()).map((d) => dayLoad(d, today, myTasks, S.posts, planCfg, factor));
  const rec = recommend(vids, todayLoad.free);
  const overBy = load.planned - load.capacity;
  const moveTo = overBy > 0 ? nextFree(Math.min(overBy, 60), addDays(capDay, 1)) : undefined;
  /** Passa para os dias seguintes com espaço as tarefas de menor prioridade até o dia caber no máximo. */
  async function moveOverflow() {
    let left = overBy;
    let list = [...myTasks];
    const order = items.filter((x) => !x.t.done && x.t.due === capDay && mine(x.t, S.me)).sort((a, b) => a.score - b.score);
    for (const x of order) {
      if (left <= 0) break;
      const min = est(x.t);
      const day = firstFreeDay(min, addDays(capDay, 1), today, list, S.posts, planCfg, factor);
      list = list.map((y) => (y.id === x.t.id ? { ...y, due: day } : y));
      await S.saveTask({ ...x.t, due: day });
      left -= min;
    }
  }
  const dayLabel = (d: string) => (d === today ? t("td.when.today") : d === tomorrow ? t("td.when.tomorrow") : new Date(d + "T12:00:00").toLocaleDateString(locale, { weekday: "short", day: "2-digit" }));
  /** Dia para um pendente: hoje se cabe; senão o primeiro dia com espaço (ou o separador escolhido). */
  const dayFor = (x: Pending) => (when === "today" ? (x.min <= todayLoad.free ? today : nextFree(x.min)) : dueFor(when) || today);
  const addPending = (x: Pending, day = dayFor(x)) => {
    const c = client(x.p.customer_id);
    // guarda a estimativa base (a calibração é aplicada na leitura)
    return add({ title: `${t(`td.act.${x.action}` as Key)}: ${x.p.title || t(`ct.type.${x.p.type}` as Key)}`, post_id: x.p.id, due: day, customer_id: x.p.customer_id, customer: c?.name ?? "", estimate: Math.round(x.min / factor) });
  };
  async function fillDay() {
    for (const x of rec.fit) await addPending(x, today);
    setPlanMsg(t("cap.filled", { n: rec.fit.length, h: fmtMin(rec.fit.reduce((a, x) => a + x.min, 0)) }));
    setTimeout(() => setPlanMsg(""), 3500);
  }
  const myGoals = S.goals.filter((g) => g.member === S.me && g.week === weekOf());
  const TEMPLATES = ["tpl.plan", "tpl.review", "tpl.previews", "tpl.shoot", "tpl.reply"] as const;
  const target = scope === "all" ? COMPANY : scope;
  const videoTask = (postId: string) => {
    const v = pend.find((x) => x.p.id === postId);
    if (v) addPending(v);
  };

  return (
    <div className="td td-full">
      {/* cliente: filtra a lista e os vídeos, e é o destino das tarefas novas */}
      <nav className="td-who" aria-label={t("st.client")}>
        <button className={`cb-chip ${scope === "all" ? "on" : ""}`} onClick={() => (setScope("all"), setCust(COMPANY))} aria-pressed={scope === "all"}>
          {t("bd.all")}
        </button>
        <button className={`cb-chip ${scope === COMPANY ? "on" : ""}`} onClick={() => (setScope(COMPANY), setCust(COMPANY))} aria-pressed={scope === COMPANY}>
          <Icon name="lock" size={12} /> {t("td.internal")}
        </button>
        {(S.customers ?? []).map((c) => {
          const n = sugg.filter((x) => x.p.customer_id === c.id).length + shown.filter((x) => x.t.customer_id === c.id && !x.t.done && (x.bucket === "late" || x.bucket === "today")).length;
          return (
            <button key={c.id} className={`cb-chip ${scope === c.id ? "on" : ""}`} onClick={() => (setScope(c.id), setCust(c.id))} aria-pressed={scope === c.id} data-testid="td-client">
              <Avatar name={c.name} photo={c.cover || c.instagram.picture} size={16} /> {c.name} {n > 0 && <span className="muted">{n}</span>}
            </button>
          );
        })}
      </nav>

      <div className="td-grid">
        <section className="td-col td-today">
          <nav className="td-tabs" role="tablist">
            {TABS.map((x) => (
              <button key={x.k} role="tab" aria-selected={tab === x.k} onClick={() => (setTab(x.k), setWhen(x.k))} data-testid={`td-tab-${x.k}`}>
                {t(`td.when.${x.k}` as Key)}
                <span className="mono">{x.list.filter((y) => !y.t.done).length}</span>
              </button>
            ))}
          </nav>

          {(tab === "today" || tab === "tomorrow") && (
            <CapacityBar load={load} week={weekLoads} cal={cal} plan={planCfg} onPlan={(p) => S.savePlan(p)} moveTo={moveTo} onMove={moveOverflow} />
          )}
          <form className="td-add" onSubmit={(e) => (e.preventDefault(), add())}>
            <Icon name="plus" size={18} />
            <input ref={input} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("td.addPh")} data-testid="td-add" />
            <span className="mono small muted td-add-when">
              {target === COMPANY ? t("td.internal") : client(target)?.name} · {t(`td.when.${when}` as Key)}
            </span>
          </form>

          <div className="td-bar">
            <div className="seg" role="group" aria-label="filter">
              {(["all", "mine", "internal"] as Filter[]).map((f) => (
                <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} title={f === "mine" ? t("td.focusOn") : undefined}>
                  {t(`td.f.${f}` as Key)}
                </button>
              ))}
            </div>
            <span className="row" style={{ gap: 12 }}>
              <label className="row small muted" style={{ gap: 6 }}>
                <input type="checkbox" checked={hideDone} onChange={(e) => setHide(e.target.checked)} /> {t("td.hideDone")}
              </label>
              <span className="mono small muted">{t("td.progress", { done: cur.list.filter((x) => x.t.done).length, total: cur.list.length })}</span>
            </span>
          </div>

          {/* a lista aceita vídeos arrastados da coluna "pedem ação" */}
          <ul
            className={`td-list td-drop ${dropOn ? "on" : ""}`}
            onDragOver={(e) => [...e.dataTransfer.types].includes("text/x-video") && (e.preventDefault(), setDropOn(true))}
            onDragLeave={() => setDropOn(false)}
            onDrop={(e) => {
              const id = e.dataTransfer.getData("text/x-video");
              setDropOn(false);
              if (id) (e.preventDefault(), videoTask(id));
            }}
            data-testid="td-list"
          >
            {list.map((x) => (
              row(x)
            ))}
            {Array.from({ length: ghosts }, (_, i) => (
              <li key={`g${i}`} className="td-row td-ghost" onClick={() => input.current?.focus()} data-testid="td-ghost">
                <span className="td-check gh-box" aria-hidden />
                <span className="td-main">
                  <span className="gh" style={{ width: `${62 - i * 14}%` }} />
                  <span className="gh" style={{ width: "28%", height: 8 }} />
                </span>
                <span className="muted small hide-sm">{i === 0 ? t("td.ghostHint") : ""}</span>
              </li>
            ))}
            {dropOn && <li className="kb-slot">{t("td.dropVideo")}</li>}
          </ul>

          {open === 0 && (
            <Collapsible title={t("td.planMore")} className="td-empty2">
              <div className="td-empty">
                <section>
                  <span className="tile-t">{t("st.goals")}</span>
                  {myGoals.length ? (
                    <ul className="td-goals">
                      {myGoals.map((g) => (
                        <li key={g.id}>
                          <Icon name="target" size={14} /> {g.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">{t("st.noGoals")}</p>
                  )}
                  <Link className="btn small" href="/equipa/me">
                    <Icon name="plus" size={13} /> {t("td.addPlan")}
                  </Link>
                </section>
                <section>
                  <span className="tile-t">{t("td.templates")}</span>
                  <div className="td-tpls">
                    {TEMPLATES.map((k) => (
                      <button key={k} className="cb-chip" onClick={() => add({ title: t(k as Key) })} data-testid="td-tpl">
                        <Icon name="plus" size={12} /> {t(k as Key)}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </Collapsible>
          )}
        </section>

        {/* segunda coluna: vídeos que pedem ação (filtrados pelo cliente; arrastar para a lista) */}
        <Collapsible title={scope !== "all" && scope !== COMPANY ? t("td.pendingOf", { c: client(scope)?.name ?? "" }) : t("td.sugg")} count={vids.length} className="td-side" testId="td-side">
          <span className="muted small">{scope !== "all" && scope !== COMPANY ? t("td.pendingHint") : t("td.suggHint2")}</span>
          {vids.length > 0 && (
            <div className="td-fill">
              <span className="small">
                {rec.fit.length ? t("cap.fits", { n: rec.fit.length, h: fmtMin(rec.fit.reduce((a, x) => a + x.min, 0)), free: fmtMin(todayLoad.free) }) : t("cap.noneFits", { free: fmtMin(todayLoad.free) })}
              </span>
              {rec.fit.length > 0 && (
                <button className="btn small accent" onClick={fillDay} data-testid="td-fill">
                  <Icon name="sparkles" size={13} /> {t("cap.fill")}
                </button>
              )}
            </div>
          )}
          {!vids.length && <p className="muted small">{t("td.clear")}</p>}
          <ul className="td-list td-scroll">
            {vids.slice(0, 30).map((x) => {
              const { p, reason, due } = x;
              const c = client(p.customer_id);
              const tag = dueTag(due);
              const fits = x.min <= todayLoad.free;
              const day = dayFor(x);
              return (
                <li key={p.id} className="td-row sugg" draggable onDragStart={(e) => (e.dataTransfer.setData("text/x-video", p.id), (e.dataTransfer.effectAllowed = "copy"))} data-testid="td-sugg">
                  <span className="td-grip" aria-hidden>
                    <Icon name="more" size={14} />
                  </span>
                  <span className="td-main">
                    <Link href={`/clientes/${p.customer_id}?tab=content&post=${p.id}`} className="td-title">
                      <TypeIcon type={p.type} /> {p.title || t(`ct.type.${p.type}` as Key)}
                    </Link>
                    <span className="td-meta">
                      <span className="td-client">
                        <Avatar name={c?.name ?? "?"} photo={c?.cover || c?.instagram.picture} size={14} /> {c?.name}
                      </span>
                      <span className={`dtag d-${tag}`}>
                        {t(`td.tag.${tag}` as Key)}
                        {due && tag !== "today" && tag !== "tomorrow" ? ` · ${new Date(due + "T12:00:00").toLocaleDateString(locale, { day: "2-digit", month: "short" })}` : ""}
                      </span>
                      {(reason === "stalled" || reason === "changes") && <span className="label tone-danger">{t(`td.alert.${reason}` as Key)}</span>}
                      <span className="label muted" title={t("est.auto")}>
                        <Icon name="clock" size={11} /> {t(`td.act.${x.action}` as Key)} · ~{fmtMin(x.min)}
                      </span>
                      <span className={`label ${fits ? "tone-ok" : "tone-warn"}`} data-testid="td-fits">
                        {fits ? t("cap.fitsToday") : t("cap.fitsOn", { day: dayLabel(nextFree(x.min)) })}
                      </span>
                    </span>
                  </span>
                  <button className="btn small" onClick={() => addPending(x)} data-testid="td-sugg-add" aria-label={dayLabel(day)} title={dayLabel(day)}>
                    <Icon name="plus" size={13} /> <span className="hide-sm">{dayLabel(day)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Collapsible>
      </div>

      <TodayCalendar
        view={tab}
        tasks={scoped.map((x) => x.t).concat(S.tasks.filter((x) => !x.deleted && byClient(x) && !scoped.some((y) => y.t.id === x.id) && (filter === "all" || (filter === "mine" ? mineOrOpen(x, S.me) : isInternal(x)))))}
        posts={S.posts.filter((p) => byClient(p))}
        proc={S.settings.process}
        onToggle={(x) => S.saveTask({ ...x, done: !x.done })}
        onDate={(x, due) => S.saveTask({ ...x, due })}
      />

      {dayPlan && <DayPlanner S={S} items={items} onClose={() => setDayPlan(false)} />}
      {/* botão flutuante: planear rápido (a partir dos prazos) e modelos */}
      <div className={`td-fab ${fab ? "open" : ""}`}>
        {fab && (
          <div className="td-fab-card" role="dialog" aria-label={t("td.planTitle")}>
            <span className="tile-t">{t("td.planTitle")}</span>
            <button className="td-fab-it ai" onClick={() => (setDayPlan(true), setFab(false))} data-testid="td-plan-ai">
              <Icon name="sparkles" size={15} />
              <span>
                <b>{t("dpl.myDay")}</b>
                <span className="muted small">{t("dpl.myDayHint")}</span>
              </span>
            </button>
            <span className="muted small">{t("td.planHint")}</span>
            {(["today", "tomorrow", "week"] as PlanRange[]).map((r) => {
              const n = drafts[r].length;
              return (
                <button key={r} className="td-fab-it" onClick={() => (plan(r), setFab(false))} disabled={planning || !n} data-testid={`td-plan-${r}`}>
                  <Icon name="sparkles" size={15} />
                  <span>
                    <b>{t(`td.plan.${r}` as Key)}</b>
                    <span className="muted small">{n ? t("td.planN", { n }) : t("td.planNone")}</span>
                  </span>
                  <span className="mono">{n}</span>
                </button>
              );
            })}
            <span className="tile-t" style={{ marginTop: 6 }}>
              {t("td.templates")}
            </span>
            <div className="td-tpls">
              {TEMPLATES.map((k) => (
                <button key={k} className="cb-chip" onClick={() => (add({ title: t(k as Key) }), setFab(false))}>
                  <Icon name="plus" size={12} /> {t(k as Key)}
                </button>
              ))}
            </div>
          </div>
        )}
        <button className="td-fab-btn" onClick={() => setFab((o) => !o)} aria-expanded={fab} data-testid="td-fab">
          <Icon name={fab ? "close" : "sparkles"} size={18} /> <span>{planMsg || t("td.planTitle")}</span>
        </button>
      </div>
    </div>
  );
}
