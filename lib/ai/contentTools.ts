"use client";

// Skill "rascunhos de conteúdo" no assistente XMEDIA: leituras correm logo; a criação é confirmada na interface.
import { customerStore } from "../customerStore";
import { DraftError, buildDrafts, customerBrief, draftLines, matchCustomers, pickCustomer } from "../contentDrafts";
import { applyChangeRequests, changeLines, matchPosts, pickPost, splitChanges } from "../changeRequests";
import { openNotes } from "../customer";
import { ToolInputError } from "./apply";
export { CONTENT_READ_TOOLS, CONTENT_WRITE_TOOLS } from "./contentSkill";

type Json = Record<string, unknown>;

/** Erros de validação voltam ao modelo como erro de ferramenta (ele corrige e tenta de novo). */
const asInput = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof DraftError) throw new ToolInputError(e.message);
    throw e;
  }
};

export async function runContentRead(name: string, input: Json): Promise<string> {
  const customers = await customerStore.list();
  if (name === "find_customers") {
    const posts = await customerStore.posts();
    return JSON.stringify(
      matchCustomers(customers, input.query)
        .slice(0, 30)
        .map((c) => ({ id: c.id, name: c.name, kind: c.kind ?? "company", contact: c.contact, lang: c.lang, posts: posts.filter((p) => p.customer_id === c.id && !p.deleted_at).length }))
    );
  }
  if (name === "get_customer_brief") {
    const c = asInput(() => pickCustomer(customers, input.customer));
    return JSON.stringify(customerBrief(c, await customerStore.posts(c.id)));
  }
  if (name === "find_content") {
    const hits = matchPosts(await customerStore.posts(), customers, input.query, input.customer);
    return JSON.stringify(hits.slice(0, 15).map(({ post: p, customer: c }) => ({ id: p.id, title: p.title, customer: c.name, type: p.type, status: p.status, round: p.round, open_comments: openNotes(p).length })));
  }
  throw new ToolInputError(`ferramenta desconhecida: ${name}`);
}

export async function prepareContentWrite(name: string, input: Json) {
  const customers = await customerStore.list();
  if (name === "log_change_requests") {
    const all = await customerStore.posts();
    const hit = asInput(() => pickPost(all, customers, input.content, input.customer));
    const r = asInput(() => applyChangeRequests(hit.post, { changes: input.changes, from: String(input.from ?? ""), source: String(input.source ?? "") }));
    return {
      name,
      lines: changeLines(hit, r, splitChanges(input.changes)),
      commit: async () => {
        await customerStore.savePost(r.post);
        return JSON.stringify({ ok: true, applied: true, content: { id: r.post.id, title: r.post.title, customer: hit.customer.name, status: r.post.status }, added: r.added, moved_to_changes: r.moved, open_comments: r.open });
      },
    };
  }
  if (name !== "create_content_drafts") throw new ToolInputError(`ferramenta desconhecida: ${name}`);
  const c = asInput(() => pickCustomer(customers, input.customer));
  const posts = asInput(() => buildDrafts(c, input.drafts));
  return {
    name,
    lines: draftLines(c.name, posts),
    commit: async () => {
      for (const p of posts) await customerStore.savePost(p);
      return JSON.stringify({ ok: true, applied: true, customer: c.name, created: posts.map((p) => ({ id: p.id, type: p.type, title: p.title, scheduled_at: p.scheduled_at || undefined })) });
    },
  };
}
