"use client";

// Executa as ferramentas do assistente com os dados do utilizador (no browser).
import { nextNumber, totals, type Invoice } from "../invoice";
import { STAGES, emptyProposal, normalizeSlide, type Proposal, type Stage } from "../proposal";
import { proposalStore } from "../proposalStore";
import { invoiceStore } from "../invoiceStore";
import { store } from "../store";
import { projectStats } from "../util";
import { serviceStore } from "../serviceStore";
import { ToolInputError, applyItems, applyUpdate, buildNew, describeChange } from "./apply";
import { PLAN_READ_TOOLS, PLAN_WRITE_TOOLS, preparePlanWrite, runPlanRead } from "./planTools";
import { SERVICE_READ_TOOLS, SERVICE_WRITE_TOOLS, prepareServiceWrite, runServiceRead, type CatalogChange } from "./serviceTools";

type Json = Record<string, unknown>;
export const INVOICE_SAVED = "xmedia:invoice-saved";

const summary = (inv: Invoice) => {
  const t = totals(inv);
  return {
    id: inv.id,
    number: inv.number,
    client: inv.client.name,
    country: inv.client.country,
    issue_date: inv.issue_date,
    status: inv.status,
    currency: inv.currency,
    subtotal: t.subtotal,
    btw: t.btw.label || "no BTW",
    btw_amount: t.btwAmount,
    total: t.total,
  };
};

async function findInvoice(idOrNumber: unknown) {
  const key = String(idOrNumber ?? "").trim();
  if (!key) throw new ToolInputError(`falta "id"`);
  const byId = await invoiceStore.get(key).catch(() => null);
  if (byId) return byId;
  const all = await invoiceStore.list();
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const hit = all.find((i) => norm(i.number) === norm(key) || norm(i.number).endsWith(norm(key).replace(/^#/, "#")));
  if (!hit) throw new ToolInputError(`invoice "${key}" não encontrada`);
  return hit;
}

/** Ferramentas de leitura: correm logo. Devolve o texto do tool_result. */
export async function runRead(name: string, input: Json): Promise<string> {
  if (SERVICE_READ_TOOLS.has(name)) return runServiceRead(name, input, await serviceStore.load());
  if (PLAN_READ_TOOLS.has(name)) return runPlanRead(name, input);
  if (name === "list_invoices") {
    const q = String(input.query ?? "").toLowerCase();
    const list = (await invoiceStore.list())
      .filter((i) => !input.status || i.status === input.status)
      .filter((i) => !q || `${i.number} ${i.client.name}`.toLowerCase().includes(q));
    return JSON.stringify({ count: list.length, invoices: list.slice(0, 50).map(summary) });
  }
  if (name === "get_invoice") {
    const inv = await findInvoice(input.id);
    const t = totals(inv);
    return JSON.stringify({
      ...summary(inv),
      client: inv.client,
      items: t.lines.map((l) => ({ description: l.description, qty: l.qty, rate: l.rate, subtotal: l.subtotal })),
      note: inv.note,
      btw_setting: inv.btw,
      btw_rule: t.btw.reason,
      payment: inv.payment,
    });
  }
  if (name === "list_proposals") {
    const q = String(input.query ?? "").toLowerCase();
    const list = (await proposalStore.list())
      .filter((p) => !input.stage || p.stage === input.stage)
      .filter((p) => !q || `${p.title} ${p.client.company} ${p.client.name}`.toLowerCase().includes(q));
    return JSON.stringify(list.slice(0, 50).map((p) => ({ id: p.id, title: p.title, client: p.client, value: p.value, currency: p.currency, stage: p.stage, sent_at: p.sent_at, valid_until: p.valid_until, slides: p.doc.slides.length })));
  }
  if (name === "get_proposal") {
    const p = await findProposal(input.id);
    const { created_at: _c, updated_at: _u, ...rest } = p;
    return JSON.stringify({ ...rest, doc: { ...p.doc, slides: p.doc.slides.map((sl, index) => ({ index, ...sl })) } });
  }
  if (name === "list_projects") {
    const ps = await store.list();
    return JSON.stringify(
      ps.slice(0, 50).map((p) => {
        const s = projectStats(p.data);
        return { id: p.id, title: p.title, client: p.data.client, shoot_date: p.data.shootDate, reels: s.reels, scenes_done: s.done, scenes_total: s.scenes, sessions: p.data.sessions.map((x) => `${x.label} ${x.date} ${x.start}-${x.end}`) };
      })
    );
  }
  throw new ToolInputError(`ferramenta desconhecida: ${name}`);
}

export type PreparedWrite = { name: string; lines: string[]; commit: () => Promise<string> };

async function findProposal(idOrTitle: unknown) {
  const key = String(idOrTitle ?? "").trim();
  if (!key) throw new ToolInputError(`falta "id"`);
  const byId = await proposalStore.get(key).catch(() => null);
  if (byId) return byId;
  const hit = (await proposalStore.list()).find((p) => p.title.toLowerCase() === key.toLowerCase());
  if (!hit) throw new ToolInputError(`proposta "${key}" não encontrada`);
  return hit;
}

const saveProposal = async (p: Proposal) => {
  const saved = await proposalStore.save(p);
  return JSON.stringify({ ok: true, applied: true, proposal: { id: saved.id, title: saved.title, stage: saved.stage, value: saved.value, slides: saved.doc.slides.length } });
};

function slideLines(slides: { type: string; title?: string; number?: string }[]) {
  return slides.slice(0, 14).map((s, i) => `${String(i + 1).padStart(2, "0")} · ${s.type}${s.title ? ` — ${s.title}` : s.number ? ` ${s.number}` : ""}`);
}

/** Ferramentas de escrita: calcula o resultado sem gravar (para o utilizador confirmar). */
export async function prepareWrite(name: string, input: Json, today: string): Promise<PreparedWrite> {
  if (PLAN_WRITE_TOOLS.has(name)) return preparePlanWrite(name, input);
  if (SERVICE_WRITE_TOOLS.has(name)) {
    const change = prepareServiceWrite(name, input, await serviceStore.load());
    return { name, lines: change.lines, commit: () => commitCatalog(change) };
  }
  // ---- invoices
  if (name === "create_invoice") {
    const all = await invoiceStore.list();
    const after = buildNew(input, nextNumber(all.map((i) => i.number), String(input.issue_date ?? today), 50), today);
    return { name, lines: describeChange(null, after), commit: () => saveInvoice(after) };
  }
  if (name === "update_invoice" || name === "set_invoice_items") {
    const before = await findInvoice(input.id);
    const after = name === "set_invoice_items" ? applyItems(before, input) : applyUpdate(before, input);
    return { name, lines: describeChange(before, after), commit: () => saveInvoice(after) };
  }
  // ---- propostas
  if (name === "create_proposal") {
    const p = emptyProposal(String(input.title ?? "New proposal"));
    if (input.client && typeof input.client === "object") p.client = { ...p.client, ...(input.client as Proposal["client"]) };
    if (input.value !== undefined) p.value = Number(input.value) || 0;
    if (Array.isArray(input.slides)) p.doc.slides = input.slides.map((x, i) => normalizeSlide(x, i));
    p.doc.meta.fao = `[ ${p.client.company || p.client.name || "Client"} Proposal ]`;
    return { name, lines: [`+ ${p.title} · ${p.client.company || p.client.name || "—"} · €${p.value}`, ...slideLines(p.doc.slides as never)], commit: () => saveProposal(p) };
  }
  const before = await findProposal(input.id);
  if (name === "update_proposal") {
    if (input.stage !== undefined && !STAGES.includes(input.stage as Stage)) throw new ToolInputError(`"stage" inválido`);
    const after: Proposal = {
      ...before,
      title: typeof input.title === "string" ? input.title : before.title,
      client: input.client && typeof input.client === "object" ? { ...before.client, ...(input.client as Proposal["client"]) } : before.client,
      value: input.value !== undefined ? Number(input.value) || 0 : before.value,
      currency: input.currency === "GBP" || input.currency === "EUR" ? input.currency : before.currency,
      stage: (input.stage as Stage) ?? before.stage,
      sent_at: typeof input.sent_at === "string" ? input.sent_at : before.sent_at,
      valid_until: typeof input.valid_until === "string" ? input.valid_until : before.valid_until,
      notes: typeof input.notes === "string" ? input.notes : before.notes,
      doc: typeof input.fao === "string" ? { ...before.doc, meta: { ...before.doc.meta, fao: input.fao } } : before.doc,
    };
    const lines: string[] = [];
    for (const k of ["title", "value", "currency", "stage", "sent_at", "valid_until", "notes"] as const)
      if (before[k] !== after[k]) lines.push(`${k}: ${String(before[k]).slice(0, 50) || "—"} → ${String(after[k]).slice(0, 50) || "—"}`);
    if (JSON.stringify(before.client) !== JSON.stringify(after.client)) lines.push(`client: ${after.client.company || ""} ${after.client.name || ""} ${after.client.email || ""}`.trim());
    if (before.doc.meta.fao !== after.doc.meta.fao) lines.push(`FAO: ${after.doc.meta.fao}`);
    return { name, lines: lines.length ? lines : ["(sem alterações)"], commit: () => saveProposal(after) };
  }
  if (name === "update_proposal_slide") {
    const index = Number(input.index);
    if (!Number.isInteger(index) || index < 0 || index >= before.doc.slides.length) throw new ToolInputError(`"index" fora do intervalo (0–${before.doc.slides.length - 1})`);
    const slide = normalizeSlide({ ...(input.slide as Json), id: before.doc.slides[index].id }, index);
    const after = { ...before, doc: { ...before.doc, slides: before.doc.slides.map((x, i) => (i === index ? slide : x)) } };
    const preview = JSON.stringify(slide).slice(0, 220);
    return { name, lines: [`${before.title} · slide ${index + 1} (${slide.type})`, preview + (preview.length >= 220 ? "…" : "")], commit: () => saveProposal(after) };
  }
  if (name === "set_proposal_slides") {
    if (!Array.isArray(input.slides) || !input.slides.length) throw new ToolInputError(`"slides" deve ser uma lista`);
    const slides = input.slides.map((x, i) => normalizeSlide(x, i));
    const after = { ...before, doc: { ...before.doc, slides } };
    return { name, lines: [`${before.title}: ${before.doc.slides.length} → ${slides.length} slides`, ...slideLines(slides as never)], commit: () => saveProposal(after) };
  }
  throw new ToolInputError(`ferramenta desconhecida: ${name}`);
}

async function saveInvoice(after: Invoice) {
  const saved = await invoiceStore.save(after);
  window.dispatchEvent(new CustomEvent(INVOICE_SAVED, { detail: { id: saved.id } }));
  return JSON.stringify({ ok: true, applied: true, invoice: summary(saved) });
}

export async function commitWrite(p: PreparedWrite): Promise<string> {
  return p.commit();
}

/** Grava as alterações do catálogo pedidas pelo assistente (serviços, pastas, regras, orçamento). */
async function commitCatalog(c: CatalogChange) {
  if (c.folders) await serviceStore.saveFolders(c.folders);
  if (c.rules) await serviceStore.saveRules(c.rules);
  if (c.services?.length) await serviceStore.saveMany(c.services, "assistant");
  if (c.quote) {
    const saved = await serviceStore.saveQuote({ id: crypto.randomUUID(), status: "draft", ...c.quote });
    await serviceStore.bump(c.quote.input.lines.map((l) => l.service_id));
    return JSON.stringify({ ok: true, applied: true, quote: { id: saved.id, title: saved.title, subtotal: saved.subtotal, total: saved.total, url: `/servicos/calculadora?q=${saved.id}` } });
  }
  return JSON.stringify({ ok: true, applied: true, changes: c.lines });
}
