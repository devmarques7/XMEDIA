"use client";

// Skill "rascunhos de conteúdo" no assistente XMEDIA: leituras correm logo; a criação é confirmada na interface.
import { customerStore } from "../customerStore";
import { DraftError, buildDrafts, customerBrief, draftLines, matchCustomers, pickCustomer } from "../contentDrafts";
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
  throw new ToolInputError(`ferramenta desconhecida: ${name}`);
}

export async function prepareContentWrite(name: string, input: Json) {
  if (name !== "create_content_drafts") throw new ToolInputError(`ferramenta desconhecida: ${name}`);
  const customers = await customerStore.list();
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
