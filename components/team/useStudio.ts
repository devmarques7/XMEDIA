"use client";

// Carrega tudo o que o Estúdio e a Equipa precisam (clientes, conteúdos, tarefas, equipa, horas, metas) e grava
// alterações no sítio certo: tarefa → documento do cliente, conteúdo → customer_posts, metas → definições.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUSTOMER_SAVED, customerStore } from "@/lib/customerStore";
import { DEFAULT_SETTINGS, type ContentPost, type Customer, type PortalSettings } from "@/lib/customer";
import { mergeTasks, type Task } from "@/lib/tasks";
import { COMPANY } from "@/lib/today";
import { allTasks, people, shiftWeek, weekDays, weekOf, type Goal, type StudioTask } from "@/lib/studio";
import { team, type Member, type TimeEntry } from "@/lib/team";

export function useStudio(initialWeek = weekOf()) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_SETTINGS);
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [prevEntries, setPrevEntries] = useState<TimeEntry[]>([]);
  const [me, setMe] = useState("");
  const [week, setWeek] = useState(initialWeek);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const days = weekDays(week);
      const prev = weekDays(shiftWeek(week, -1));
      const [c, p, s, who] = await Promise.all([customerStore.list(), customerStore.posts(), customerStore.settings(), team.me()]);
      setCustomers(c);
      setPosts(p);
      setSettings(s);
      setMe(who.email || s.contact_email);
      // a equipa pode não estar acessível (sem team.manage): o resto continua a funcionar
      const [ms, es, ps] = await Promise.all([team.members().catch(() => []), team.entries(days[0], days[6]).catch(() => []), team.entries(prev[0], prev[6]).catch(() => [])]);
      setMembers(ms);
      setEntries(es);
      setPrevEntries(ps);
    } catch (e) {
      setErr((e as Error).message);
      setCustomers((c) => c ?? []);
    }
  }, [week]);

  useEffect(() => {
    load();
    window.addEventListener(CUSTOMER_SAVED, load);
    return () => window.removeEventListener(CUSTOMER_SAVED, load);
  }, [load]);

  // tarefas de todos os clientes + as internas da empresa (definições), com customer_id "" (COMPANY)
  const cRef = useRef(customers);
  const sRef = useRef(settings);
  cRef.current = customers;
  sRef.current = settings;
  const tasks = useMemo(() => [...allTasks(customers ?? []), ...(settings.tasks ?? []).filter((t) => !t.deleted).map((t) => ({ ...t, customer_id: COMPANY, customer: "XMEDIA" }))], [customers, settings.tasks]);
  const team_ = useMemo(() => people(members, { email: me, name: "MediaMarques" }), [members, me]);
  const goals = settings.goals ?? [];

  async function saveTask(t: StudioTask | (Task & { customer_id: string })) {
    const { customer_id: _id, customer: _n, ...task } = t as StudioTask;
    const stamped = { ...task, updated: new Date().toISOString() };
    // atualização otimista: o ecrã muda já; os refs garantem que cliques seguidos não se perdem
    if (t.customer_id === COMPANY) {
      const next = { ...sRef.current, tasks: mergeTasks(sRef.current.tasks, [stamped]) };
      sRef.current = next;
      setSettings(next);
      await customerStore.saveSettings(next).catch((e) => setErr((e as Error).message));
      return;
    }
    const c = cRef.current?.find((x) => x.id === t.customer_id);
    if (!c) return;
    const next = { ...c, tasks: mergeTasks(c.tasks, [stamped]) };
    cRef.current = cRef.current?.map((x) => (x.id === c.id ? next : x)) ?? null;
    setCustomers(cRef.current);
    await customerStore.save(next).catch((e) => setErr((e as Error).message));
  }
  async function savePost(p: ContentPost) {
    setPosts((l) => (l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p])); // novo (ex.: criado a partir de uma tarefa) entra logo
    const saved = await customerStore.savePost(p).catch((e) => (setErr((e as Error).message), null));
    // o responsável pode ter mudado por uma regra de automação
    if (saved) setPosts((l) => l.map((x) => (x.id === saved.id ? { ...x, assignee: saved.assignee } : x)));
    return saved ?? undefined;
  }
  async function saveGoals(next: Goal[]) {
    const s = { ...sRef.current, goals: next };
    sRef.current = s;
    setSettings(s);
    await customerStore.saveSettings(s).catch((e) => setErr((e as Error).message));
  }

  /** Grava parte das definições (capacidade, horário, planos do dia). */
  async function patchSettings(patch: Partial<PortalSettings>) {
    const s = { ...sRef.current, ...patch };
    sRef.current = s;
    setSettings(s);
    await customerStore.saveSettings(s).catch((e) => setErr((e as Error).message));
  }
  /** Capacidade diária do planeamento (definições). */
  async function savePlan(plan: NonNullable<PortalSettings["plan"]>) {
    const s = { ...sRef.current, plan };
    sRef.current = s;
    setSettings(s);
    await customerStore.saveSettings(s).catch((e) => setErr((e as Error).message));
  }

  return { customers, posts, settings, members, entries, prevEntries, me, week, setWeek, tasks, people: team_, goals, err, setErr, saveTask, savePost, saveGoals, savePlan, patchSettings, reload: load };
}
