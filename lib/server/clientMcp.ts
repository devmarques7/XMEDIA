// Execução no servidor das ferramentas MCP dos clientes (ver lib/ai/clientTools.ts), sempre no âmbito do dono.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ToolInputError } from "../ai/apply";
import { brandProgress, normalizeBrand } from "../brand";
import { DEFAULT_CLIENT_PROCESS, normalizeProcessDef, stageCounts, stageMove, stageOf } from "../clientProcess";
import { moveToPhase, normalizeCustomer, normalizePost, normalizeSettings, openNotes, type ContentPost, type Customer, type Note, type PortalSettings } from "../customer";
import { mergeTasks, newTask, type Task } from "../tasks";
import { allTasks, taskOwner, type StudioTask } from "../studio";
import { COMPANY, suggestions, todayTasks } from "../today";
import { splitChecklist, validationState } from "../validation";
import { applyClientJson } from "../clientJson";
import { DraftError, buildDrafts, customerBrief, draftLines, matchCustomers, pickCustomer } from "../contentDrafts";
import { applyChangeRequests, changeLines, matchPosts, pickPost, splitChanges } from "../changeRequests";

type Json = Record<string, unknown>;

export async function runClientTool(name: string, a: Json, db: SupabaseClient, owner: string): Promise<string> {
  try {
    return await run(name, a, db, owner);
  } catch (e) {
    if (e instanceof DraftError) throw new ToolInputError(e.message); // o modelo corrige e tenta de novo
    throw e;
  }
}

async function run(name: string, a: Json, db: SupabaseClient, owner: string): Promise<string> {
  const customers = async () => {
    const { data, error } = await db.from("customers").select("id, data").eq("owner_id", owner);
    if (error) throw error;
    return (data ?? []).map((r) => normalizeCustomer({ ...r.data, id: r.id }));
  };
  const findCustomer = async (key: unknown) => {
    const k = String(key ?? "").trim().toLowerCase();
    const all = await customers();
    const hit = all.find((c) => c.id === key) ?? all.find((c) => c.name.toLowerCase() === k) ?? all.find((c) => c.name.toLowerCase().includes(k) && k.length >= 3);
    if (!hit) throw new ToolInputError(`cliente "${key}" não encontrado`);
    return hit;
  };
  const saveCustomer = async (c: Customer) => {
    const { created_at: _c, updated_at: _u, ...data } = c;
    const { error } = await db.from("customers").update({ name: c.name, email: c.email, stage: c.stage, data }).eq("id", c.id).eq("owner_id", owner);
    if (error) throw error;
  };
  const posts = async (customerId: string) => {
    const { data, error } = await db.from("customer_posts").select("id, customer_id, data").eq("customer_id", customerId);
    if (error) throw error;
    return (data ?? []).map((r) => normalizePost({ ...r.data, id: r.id, customer_id: r.customer_id })).filter((p) => !p.deleted_at);
  };
  const findPost = async (id: unknown) => {
    const { data } = await db.from("customer_posts").select("id, customer_id, data").eq("id", String(id ?? "")).maybeSingle();
    if (!data || data.data?.deleted_at) throw new ToolInputError(`conteúdo "${id}" não encontrado`);
    const { data: c } = await db.from("customers").select("id, data").eq("id", data.customer_id).eq("owner_id", owner).maybeSingle();
    if (!c) throw new ToolInputError(`conteúdo "${id}" não encontrado`);
    return { p: normalizePost({ ...data.data, id: data.id, customer_id: data.customer_id }), c: normalizeCustomer({ ...c.data, id: c.id }) };
  };
  const savePost = async (p: ContentPost) => {
    const { created_at: _c, updated_at: _u, ...doc } = p;
    const { error } = await db.from("customer_posts").upsert({ id: p.id, owner_id: owner, customer_id: p.customer_id, status: p.status, scheduled_at: p.scheduled_at || null, data: doc });
    if (error) throw error;
  };
  const brief = (p: ContentPost, c: Customer) => {
    const proc = c.process ? normalizeProcessDef(c.process) : DEFAULT_CLIENT_PROCESS;
    const v = validationState(p);
    return { id: p.id, type: p.type, title: p.title, status: p.status, stage: stageOf(p, proc).label, scheduled_at: p.scheduled_at, round: p.round, open_comments: openNotes(p).length, validation: v.ok + v.fix ? `${v.ok} ok / ${v.fix} ajustar / ${v.list.length}` : undefined };
  };

  const settings = async () => {
    const { data } = await db.from("app_settings").select("data").eq("owner_id", owner).maybeSingle();
    return normalizeSettings(data?.data);
  };
  const saveSettings = async (s: PortalSettings) => {
    const { error } = await db.from("app_settings").upsert({ owner_id: owner, data: s, updated_at: new Date().toISOString() });
    if (error) throw error;
  };
  const allPosts = async () => {
    const ids = (await customers()).map((c) => c.id);
    if (!ids.length) return [];
    const { data, error } = await db.from("customer_posts").select("id, customer_id, data").in("customer_id", ids);
    if (error) throw error;
    return (data ?? []).map((r) => normalizePost({ ...r.data, id: r.id, customer_id: r.customer_id })).filter((p) => !p.deleted_at);
  };
  const today = () => new Date().toISOString().slice(0, 10);

  switch (name) {
    case "list_customers": {
      const q = String(a.query ?? "").toLowerCase();
      const all = (await customers()).filter((c) => !q || `${c.name} ${c.email} ${c.contact}`.toLowerCase().includes(q));
      const out = [];
      for (const c of all.slice(0, 60)) {
        const proc = c.process ? normalizeProcessDef(c.process) : DEFAULT_CLIENT_PROCESS;
        const ps = await posts(c.id);
        out.push({ id: c.id, name: c.name, kind: c.kind ?? "company", stage: c.stage, email: c.email, portal: c.portal.status, board: Object.fromEntries(stageCounts(ps, proc).filter((x) => x.n).map((x) => [x.stage.label, x.n])) });
      }
      return JSON.stringify(out);
    }
    case "get_content_board": {
      const c = await findCustomer(a.customer);
      const proc = c.process ? normalizeProcessDef(c.process) : DEFAULT_CLIENT_PROCESS;
      const ps = await posts(c.id);
      return JSON.stringify({ customer: c.name, stages: proc.stages.map((s) => ({ id: s.id, label: s.label, group: s.group, days: s.days, client: !!s.client, auto: !!s.auto, posts: ps.filter((p) => stageOf(p, proc).id === s.id).map((p) => brief(p, c)) })) });
    }
    case "move_content": {
      const { p, c } = await findPost(a.post_id);
      const proc = c.process ? normalizeProcessDef(c.process) : DEFAULT_CLIENT_PROCESS;
      const k = String(a.stage ?? "").toLowerCase();
      const st = proc.stages.find((s) => s.id === k || s.label.toLowerCase() === k);
      if (!st) throw new ToolInputError(`etapa "${a.stage}" não existe — use: ${proc.stages.map((s) => s.label).join(", ")}`);
      const next = stageMove(p, st, moveToPhase);
      await savePost(next);
      return JSON.stringify({ ok: true, post: brief(next, c) });
    }
    case "comment_content": {
      const { p, c } = await findPost(a.post_id);
      const text = String(a.text ?? "").trim();
      if (!text) throw new ToolInputError(`"text" vazio`);
      const items = a.as_checklist ? splitChecklist(text) : [];
      const now = new Date().toISOString();
      const notes: Note[] = (items.length ? items : [text]).map((x) => ({ id: crypto.randomUUID(), by: "studio", author: "MediaMarques", text: x.slice(0, 2000), media: 0, round: p.round, done: false, at: now, updated: now }));
      const next = { ...p, notes: [...p.notes, ...notes] };
      await savePost(next);
      return JSON.stringify({ ok: true, added: notes.length, post: brief(next, c) });
    }
    case "set_client_process": {
      const c = await findCustomer(a.customer);
      const process = normalizeProcessDef(a.process);
      await saveCustomer({ ...c, process });
      return JSON.stringify({ ok: true, customer: c.name, stages: process.stages.map((s) => `${s.group} › ${s.label} (${s.days}d: ${s.phases.join("/") || "manual"})`) });
    }
    case "get_brand": {
      const c = await findCustomer(a.customer);
      const b = normalizeBrand(c.brand, c.name);
      return JSON.stringify({ customer: c.name, progress: brandProgress(b), brand: { ...b, logo: { ...b.logo, primary: b.logo.primary ? "(imagem)" : "", mark: b.logo.mark ? "(imagem)" : "" }, imagery: { notes: b.imagery.notes, images: b.imagery.images.length } } });
    }
    case "set_brand": {
      const c = await findCustomer(a.customer);
      const brand = { ...normalizeBrand({ ...(c.brand ?? {}), ...((a.brand as object) ?? {}) }, c.name), updated_at: new Date().toISOString() };
      await saveCustomer({ ...c, brand });
      return JSON.stringify({ ok: true, progress: brandProgress(brand).total });
    }
    case "create_task": {
      const raw = String(a.due ?? "today").trim();
      const due = raw === "today" ? today() : raw.slice(0, 10);
      const assignee = a.assignee ? String(a.assignee).toLowerCase() : undefined;
      const task = newTask({ title: String(a.title ?? ""), by: "MediaMarques", side: "studio", due, post_id: String(a.post_id ?? ""), assignee, progress: "todo", mentions: [...new Set([...(assignee ? [assignee] : []), ...(Array.isArray(a.mentions) ? a.mentions.map((x) => String(x).toLowerCase()) : [])])], ...(a.internal || !a.customer ? { internal: true } : {}) });
      if (!task.title) throw new ToolInputError(`"title" vazio`);
      if (!a.customer) {
        const s = await settings();
        await saveSettings({ ...s, tasks: mergeTasks(s.tasks, [task]) });
        return JSON.stringify({ ok: true, task: { id: task.id, title: task.title, due: task.due, customer: "XMEDIA (interno)" } });
      }
      const c = await findCustomer(a.customer);
      await saveCustomer({ ...c, tasks: mergeTasks(c.tasks, [task]) });
      return JSON.stringify({ ok: true, task: { id: task.id, title: task.title, due: task.due, customer: c.name } });
    }
    case "list_today": {
      const [cs, s, ps] = await Promise.all([customers(), settings(), allPosts()]);
      const tasks: StudioTask[] = [...allTasks(cs), ...(s.tasks ?? []).filter((t) => !t.deleted).map((t) => ({ ...t, customer_id: COMPANY, customer: "XMEDIA" }))];
      const who = a.assignee ? String(a.assignee).toLowerCase() : "";
      const list = todayTasks(tasks, ps, s.process).filter((x) => x.bucket !== "later" && (!who || taskOwner(x.t) === who));
      return JSON.stringify({
        today: today(),
        tasks: list.map((x) => ({ id: x.t.id, title: x.t.title, customer: x.t.customer, bucket: x.bucket, due: x.t.due, done: x.t.done, assignee: taskOwner(x.t) || undefined, alerts: x.alerts, video: x.post ? { id: x.post.id, title: x.post.title } : undefined })),
        videos_needing_action: suggestions(ps, tasks, s.process).slice(0, 10).map((x) => ({ post_id: x.p.id, title: x.p.title, customer: cs.find((c) => c.id === x.p.customer_id)?.name, reason: x.reason, due: x.due })),
      });
    }
    case "update_task": {
      const id = String(a.task_id ?? "");
      const patch = (t: Task): Task => ({
        ...t,
        ...(typeof a.done === "boolean" ? { done: a.done } : {}),
        ...(typeof a.title === "string" && a.title.trim() ? { title: a.title.trim().slice(0, 200) } : {}),
        ...(typeof a.due === "string" ? { due: a.due === "today" ? today() : a.due.slice(0, 10) } : {}),
        ...(typeof a.assignee === "string" ? { assignee: a.assignee.toLowerCase() || undefined } : {}),
        ...(typeof a.progress === "string" ? { progress: a.progress as Task["progress"] } : {}),
        ...(a.deleted === true ? { deleted: true } : {}),
        updated: new Date().toISOString(),
      });
      const s = await settings();
      const own = (s.tasks ?? []).find((t) => t.id === id);
      if (own) {
        const t = patch(own);
        await saveSettings({ ...s, tasks: mergeTasks(s.tasks, [t]) });
        return JSON.stringify({ ok: true, task: { id, title: t.title, done: t.done, due: t.due } });
      }
      const c = (await customers()).find((x) => (x.tasks ?? []).some((t) => t.id === id));
      if (!c) throw new ToolInputError(`tarefa "${id}" não encontrada — use list_today`);
      const t = patch(c.tasks!.find((x) => x.id === id)!);
      await saveCustomer({ ...c, tasks: mergeTasks(c.tasks, [t]) });
      return JSON.stringify({ ok: true, task: { id, title: t.title, done: t.done, due: t.due, customer: c.name } });
    }
    // ---- skill "rascunhos de conteúdo" (lib/ai/contentSkill.ts)
    case "find_customers": {
      const all = await customers();
      const ps = all.length ? await allPosts() : [];
      return JSON.stringify(matchCustomers(all, a.query).slice(0, 30).map((c) => ({ id: c.id, name: c.name, kind: c.kind ?? "company", contact: c.contact, lang: c.lang, posts: ps.filter((p) => p.customer_id === c.id).length })));
    }
    case "get_customer_brief": {
      const c = pickCustomer(await customers(), a.customer);
      return JSON.stringify(customerBrief(c, await posts(c.id)));
    }
    case "create_content_drafts": {
      const c = pickCustomer(await customers(), a.customer);
      const created = buildDrafts(c, a.drafts);
      for (const p of created) await savePost(p);
      return JSON.stringify({ ok: true, summary: draftLines(c.name, created), created: created.map((p) => ({ id: p.id, type: p.type, title: p.title, scheduled_at: p.scheduled_at || undefined })) });
    }
    case "find_content": {
      const hits = matchPosts(await allPosts(), await customers(), a.query, a.customer);
      return JSON.stringify(hits.slice(0, 15).map(({ post: p, customer: c }) => ({ id: p.id, title: p.title, customer: c.name, type: p.type, status: p.status, round: p.round, open_comments: openNotes(p).length })));
    }
    case "log_change_requests": {
      const hit = pickPost(await allPosts(), await customers(), a.content, a.customer);
      const r = applyChangeRequests(hit.post, { changes: a.changes, from: String(a.from ?? ""), source: String(a.source ?? "") });
      await savePost(r.post);
      return JSON.stringify({ ok: true, summary: changeLines(hit, r, splitChanges(a.changes)), content: { id: r.post.id, status: r.post.status }, added: r.added, moved_to_changes: r.moved, open_comments: r.open });
    }
    case "import_client_json": {
      const c = await findCustomer(a.customer);
      const r = applyClientJson(c, JSON.stringify(a.json ?? {}), "MediaMarques");
      await saveCustomer(r.customer);
      for (const p of r.posts) await savePost(p);
      return JSON.stringify({ ok: true, customer: r.customer.name, imported: r.parts });
    }
  }
  throw new ToolInputError(`ferramenta desconhecida: ${name}`);
}
