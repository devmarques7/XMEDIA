"use client";

// Skill "planear a semana" do assistente: lê a capacidade de cada dia, o que já está planeado e tudo o que os
// clientes ainda pedem (com estimativas calibradas pelo ritmo real) e, depois de confirmado, cria as tarefas.
import { customerStore } from "../customerStore";
import { COMPANY } from "../today";
import { allTasks, weekDays, weekOf, ymd, type StudioTask } from "../studio";
import { mergeTasks, newTask } from "../tasks";
import { team } from "../team";
import { calibrate, dayLoad, fmtMin, normalizePlan, pendingWork, plannable } from "../plan";
import { ToolInputError } from "./apply";
export { PLAN_READ_TOOLS, PLAN_WRITE_TOOLS } from "./planSkill";

type Json = Record<string, unknown>;

async function load() {
  const [customers, posts, settings, me] = await Promise.all([customerStore.list(), customerStore.posts(), customerStore.settings(), team.me().catch(() => ({ email: "" }) as { email: string })]);
  const tasks: StudioTask[] = [...allTasks(customers), ...(settings.tasks ?? []).filter((t) => !t.deleted).map((t) => ({ ...t, customer_id: COMPANY, customer: "XMEDIA" }))];
  const email = (me.email || settings.contact_email || "").toLowerCase();
  return { customers, posts, settings, tasks, email };
}

export async function runPlanRead(name: string, input: Json): Promise<string> {
  if (name !== "get_week_plan") throw new ToolInputError(`ferramenta desconhecida: ${name}`);
  const { customers, posts, settings, tasks, email } = await load();
  const plan = normalizePlan(settings.plan);
  const now = new Date();
  const today = ymd(now);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.start ?? "")) ? weekOf(new Date(String(input.start) + "T12:00:00")) : weekOf(now);
  const days = weekDays(start);
  const from = ymd(new Date(now.getTime() - 14 * 86_400_000));
  const members = await team.members().catch(() => []);
  const meMember = members.find((m) => (m.email ?? "").toLowerCase() === email);
  const entries = await team.entries(from, today, meMember?.id).catch(() => []);
  const mineTasks = tasks.filter((t) => !t.assignee || t.assignee.toLowerCase() === email);
  const cal = calibrate(entries, mineTasks, posts, plan, today);
  const q = String(input.client ?? "").trim().toLowerCase();
  const client = q ? customers.find((c) => c.id === q || c.name.toLowerCase().includes(q)) : undefined;
  if (q && !client) throw new ToolInputError(`cliente "${input.client}" não encontrado`);
  const name_ = (id: string) => (id === COMPANY ? "XMEDIA (interno)" : customers.find((c) => c.id === id)?.name ?? "?");
  const pend = pendingWork(client ? posts.filter((p) => p.customer_id === client.id) : posts, tasks, settings.process, plan, now, cal.factor);
  return JSON.stringify({
    today,
    settings: { capacity_per_day: fmtMin(plan.capacity_min), buffer: `${Math.round(plan.buffer * 100)}%`, plannable_per_workday: fmtMin(plannable(plan, days[0])), workdays: plan.workdays },
    calibration: { calibrated: cal.reliable, factor: cal.factor, logged_per_day: fmtMin(cal.dailyLogged), window_days: 14 },
    days: days.map((d) => {
      const l = dayLoad(d, today, mineTasks, posts, plan, cal.factor);
      return { day: d, past: d < today, capacity: l.capacity, planned: l.planned, free: l.free, level: l.level, tasks: l.tasks.map((x) => ({ id: x.t.id, title: x.t.title, client: name_(x.t.customer_id), min: x.min, due: x.t.due })) };
    }),
    pending: pend.slice(0, 60).map((x) => ({ post_id: x.p.id, customer_id: x.p.customer_id, client: name_(x.p.customer_id), title: x.p.title || x.p.type, type: x.p.type, action: x.action, min: x.min, due: x.due, reason: x.reason, priority: x.score })),
    pending_total: pend.length,
  });
}

export type PlanItem = { title: string; due: string; estimate_min?: number; post_id?: string; customer_id?: string };

export async function preparePlanWrite(name: string, input: Json) {
  if (name !== "plan_week") throw new ToolInputError(`ferramenta desconhecida: ${name}`);
  const items = (Array.isArray(input.items) ? input.items : []) as PlanItem[];
  if (!items.length) throw new ToolInputError("sem itens");
  if (items.length > 60) throw new ToolInputError("demasiados itens (máx. 60)");
  const { customers, posts, settings, tasks, email } = await load();
  const plan = normalizePlan(settings.plan);
  const today = ymd(new Date());
  for (const it of items) {
    if (!String(it.title ?? "").trim()) throw new ToolInputError("item sem título");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(it.due))) throw new ToolInputError(`data inválida: ${it.due}`);
    if (it.customer_id && !customers.some((c) => c.id === it.customer_id)) throw new ToolInputError(`cliente desconhecido: ${it.customer_id}`);
    if (it.post_id && !posts.some((p) => p.id === it.post_id)) throw new ToolInputError(`conteúdo desconhecido: ${it.post_id}`);
  }
  const by = "MediaMarques";
  const created: StudioTask[] = items.map((it) => {
    const cid = it.customer_id ?? COMPANY;
    return {
      ...newTask({ title: String(it.title).trim(), by, side: "studio", internal: true, due: it.due, post_id: it.post_id ?? "", assignee: email || undefined, mentions: email ? [email] : [], progress: "todo", estimate: Number(it.estimate_min) > 0 ? Math.round(Number(it.estimate_min)) : undefined }),
      customer_id: cid,
      customer: cid === COMPANY ? "XMEDIA" : customers.find((c) => c.id === cid)?.name ?? "",
    };
  });
  // resumo por dia com o efeito na capacidade (o utilizador confirma)
  const all = [...tasks, ...created];
  const mineAll = all.filter((t) => !t.assignee || t.assignee.toLowerCase() === email);
  const dayList = [...new Set(created.map((t) => t.due))].sort();
  const lines = dayList.map((d) => {
    const l = dayLoad(d, today, mineAll, posts, plan);
    const n = created.filter((t) => t.due === d).length;
    const warn = l.level === "over" ? ` ⚠ +${fmtMin(l.planned - l.capacity)} acima do máximo` : l.level === "tight" ? " · no limite" : "";
    return `${d} · ${n} tarefa(s) · ${fmtMin(l.planned)} / ${fmtMin(l.capacity)}${warn}`;
  });
  lines.push(...created.slice(0, 12).map((t) => `+ ${t.due} · ${t.title}${t.estimate ? ` (${fmtMin(t.estimate)})` : ""}`));
  return {
    name,
    lines,
    commit: async () => {
      // grava cada tarefa no documento certo: cliente (customers.data.tasks) ou interna (definições)
      const byCustomer = new Map<string, StudioTask[]>();
      for (const t of created) byCustomer.set(t.customer_id, [...(byCustomer.get(t.customer_id) ?? []), t]);
      for (const [cid, list] of byCustomer) {
        const plain = list.map(({ customer_id: _c, customer: _n, ...task }) => task);
        if (cid === COMPANY) {
          const s = await customerStore.settings();
          await customerStore.saveSettings({ ...s, tasks: mergeTasks(s.tasks, plain) });
        } else {
          const c = await customerStore.get(cid);
          if (c) await customerStore.save({ ...c, tasks: mergeTasks(c.tasks, plain) });
        }
      }
      return JSON.stringify({ ok: true, applied: true, created: created.length, days: dayList });
    },
  };
}
