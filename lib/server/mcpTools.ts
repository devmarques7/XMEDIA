// Ferramentas MCP executadas no servidor sobre o Supabase (service role), sempre no âmbito do dono (owner_id).
import { ToolInputError, applyItems, applyUpdate, buildNew } from "../ai/apply";
import { nextNumber, normalizeInvoice, totals, type Invoice } from "../invoice";
import { STAGES, emptyProposal, normalizeProposal, normalizeSlide, type Proposal, type Stage } from "../proposal";
import { SERVICE_READ_TOOLS, SERVICE_WRITE_TOOLS, prepareServiceWrite, runServiceRead, type CatalogData } from "../ai/serviceTools";
import { SEED_SERVICES } from "../services-seed";
import { DEFAULT_FOLDERS, normalizeRules, normalizeService, withHistory, type PricingRules, type Service, type ServiceFolder } from "../services";
import { serviceClient } from "./admin";
import { CLIENT_TOOL_NAMES } from "../ai/clientTools";
import { CONTENT_READ_TOOLS, CONTENT_WRITE_TOOLS } from "../ai/contentSkill";
import { runClientTool } from "./clientMcp";
import { ownerId } from "./owner";

type Json = Record<string, unknown>;

const invRow = (inv: Invoice, owner: string) => {
  const t = totals(inv);
  return { id: inv.id, owner_id: owner, number: inv.number, issue_date: inv.issue_date, status: inv.status, currency: inv.currency, subtotal: t.subtotal, btw_amount: t.btwAmount, total: t.total, client_name: inv.client.name, data: inv };
};
const invSummary = (inv: Invoice) => {
  const t = totals(inv);
  return { id: inv.id, number: inv.number, client: inv.client.name, issue_date: inv.issue_date, status: inv.status, currency: inv.currency, subtotal: t.subtotal, btw: t.btw.label || "no BTW", total: t.total };
};
const propRow = (p: Proposal, owner: string) => {
  const { created_at: _c, updated_at: _u, ...data } = p;
  return { id: p.id, owner_id: owner, title: p.title, client_name: p.client.name, value: p.value, currency: p.currency, stage: p.stage, data };
};

/** `owner`: dono dos dados (login OAuth); sem ele usa MCP_OWNER_EMAIL / ADMIN_EMAILS (chave fixa MCP_TOKEN). */
export async function runServerTool(name: string, a: Json, ownerOverride?: string): Promise<string> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("XMEDIA ainda está em modo local (dados no navegador). Ligue o Supabase para usar o MCP.");
  const db = serviceClient();
  const owner = ownerOverride || (await ownerId());
  if (CLIENT_TOOL_NAMES.has(name) || CONTENT_READ_TOOLS.has(name) || CONTENT_WRITE_TOOLS.has(name)) return runClientTool(name, a, db, owner);

  const invoices = async () => {
    const { data, error } = await db.from("invoices").select("id, data").eq("owner_id", owner).order("issue_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => normalizeInvoice({ ...r.data, id: r.id }));
  };
  const findInvoice = async (key: unknown) => {
    const k = String(key ?? "").replace(/\s+/g, "").toLowerCase();
    const hit = (await invoices()).find((i) => i.id === key || i.number.replace(/\s+/g, "").toLowerCase() === k);
    if (!hit) throw new ToolInputError(`invoice "${key}" não encontrada`);
    return hit;
  };
  const saveInvoice = async (inv: Invoice) => {
    const { error } = await db.from("invoices").upsert(invRow(inv, owner));
    if (error) throw error;
    return JSON.stringify({ ok: true, invoice: invSummary(inv) });
  };
  const proposals = async () => {
    const { data, error } = await db.from("proposals").select("id, data, updated_at").eq("owner_id", owner).order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => normalizeProposal({ ...r.data, id: r.id, updated_at: r.updated_at }));
  };
  const findProposal = async (key: unknown) => {
    const hit = (await proposals()).find((p) => p.id === key || p.title.toLowerCase() === String(key ?? "").toLowerCase());
    if (!hit) throw new ToolInputError(`proposta "${key}" não encontrada`);
    return hit;
  };
  const saveProposal = async (p: Proposal) => {
    const { error } = await db.from("proposals").upsert(propRow(p, owner));
    if (error) throw error;
    return JSON.stringify({ ok: true, proposal: { id: p.id, title: p.title, stage: p.stage, value: p.value, slides: p.doc.slides.length } });
  };
  const today = new Date().toISOString().slice(0, 10);

  // ---- catálogo de serviços (mesmo núcleo do assistente; no MCP as escritas aplicam logo)
  const serviceRow = (sv: Service) => {
    const { created_at: _c, updated_at: _u, ...data } = sv;
    return { id: sv.id, owner_id: owner, folder: sv.folder, name: sv.name, price: sv.price, archived: sv.archived, uses: sv.uses, data };
  };
  const loadCatalog = async (): Promise<CatalogData> => {
    const [{ data: rows, error }, { data: cat }] = await Promise.all([
      db.from("services").select("id, data, uses").eq("owner_id", owner),
      db.from("service_catalog").select("folders, rules").eq("owner_id", owner).maybeSingle(),
    ]);
    if (error) throw new Error(`${error.message} — corra a migração 0013_services.sql no Supabase.`);
    const folders = Array.isArray(cat?.folders) && cat!.folders.length ? (cat!.folders as ServiceFolder[]) : DEFAULT_FOLDERS;
    let services = (rows ?? []).map((r) => normalizeService({ ...(r.data as Service), id: r.id, uses: r.uses }, folders));
    if (!services.length) {
      services = SEED_SERVICES.map((sv) => withHistory(null, sv, "Notion"));
      await db.from("services").upsert(services.map(serviceRow), { onConflict: "owner_id,id" });
    }
    return { services, folders, rules: normalizeRules((cat?.rules as PricingRules) ?? null) };
  };
  if (SERVICE_READ_TOOLS.has(name)) return runServiceRead(name, a, await loadCatalog());
  if (SERVICE_WRITE_TOOLS.has(name)) {
    const cat = await loadCatalog();
    const ch = prepareServiceWrite(name, a, cat);
    if (ch.folders || ch.rules) {
      const { error } = await db.from("service_catalog").upsert({ owner_id: owner, folders: ch.folders ?? cat.folders, rules: ch.rules ?? cat.rules }, { onConflict: "owner_id" });
      if (error) throw error;
    }
    if (ch.services?.length) {
      const rows = ch.services.map((sv) => serviceRow(withHistory(cat.services.find((x) => x.id === sv.id) ?? null, sv, "mcp")));
      const { error } = await db.from("services").upsert(rows, { onConflict: "owner_id,id" });
      if (error) throw error;
    }
    if (ch.quote) {
      const id = crypto.randomUUID();
      const { error } = await db.from("service_quotes").insert({ id, owner_id: owner, client_name: ch.quote.input.client.company || ch.quote.input.client.name, total: ch.quote.total, data: { id, status: "draft", ...ch.quote } });
      if (error) throw error;
      return JSON.stringify({ ok: true, quote: { id, ...ch.quote, input: undefined }, changes: ch.lines });
    }
    return JSON.stringify({ ok: true, changes: ch.lines });
  }

  switch (name) {
    // ---- invoices
    case "list_invoices": {
      const q = String(a.query ?? "").toLowerCase();
      const list = (await invoices()).filter((i) => (!a.status || i.status === a.status) && (!q || `${i.number} ${i.client.name}`.toLowerCase().includes(q)));
      return JSON.stringify({ count: list.length, invoices: list.slice(0, 50).map(invSummary) });
    }
    case "get_invoice": {
      const inv = await findInvoice(a.id);
      const t = totals(inv);
      return JSON.stringify({ ...invSummary(inv), client: inv.client, items: t.lines, note: inv.note, btw_setting: inv.btw, btw_rule: t.btw.reason, payment: inv.payment });
    }
    case "update_invoice":
      return saveInvoice(applyUpdate(await findInvoice(a.id), a));
    case "set_invoice_items":
      return saveInvoice(applyItems(await findInvoice(a.id), a));
    case "create_invoice": {
      const all = await invoices();
      return saveInvoice(buildNew(a, nextNumber(all.map((i) => i.number), String(a.issue_date ?? today), 50), today));
    }
    // ---- propostas
    case "list_proposals": {
      const q = String(a.query ?? "").toLowerCase();
      const list = (await proposals()).filter((p) => (!a.stage || p.stage === a.stage) && (!q || `${p.title} ${p.client.company} ${p.client.name}`.toLowerCase().includes(q)));
      return JSON.stringify(list.slice(0, 50).map((p) => ({ id: p.id, title: p.title, client: p.client, value: p.value, stage: p.stage, sent_at: p.sent_at, slides: p.doc.slides.length })));
    }
    case "get_proposal": {
      const p = await findProposal(a.id);
      return JSON.stringify({ ...p, doc: { ...p.doc, slides: p.doc.slides.map((s, index) => ({ index, ...s })) } });
    }
    case "update_proposal": {
      const p = await findProposal(a.id);
      if (a.stage !== undefined && !STAGES.includes(a.stage as Stage)) throw new ToolInputError(`"stage" inválido`);
      return saveProposal({
        ...p,
        title: typeof a.title === "string" ? a.title : p.title,
        client: a.client && typeof a.client === "object" ? { ...p.client, ...(a.client as Proposal["client"]) } : p.client,
        value: a.value !== undefined ? Number(a.value) || 0 : p.value,
        currency: a.currency === "GBP" || a.currency === "EUR" ? a.currency : p.currency,
        stage: (a.stage as Stage) ?? p.stage,
        sent_at: typeof a.sent_at === "string" ? a.sent_at : p.sent_at,
        valid_until: typeof a.valid_until === "string" ? a.valid_until : p.valid_until,
        notes: typeof a.notes === "string" ? a.notes : p.notes,
        doc: typeof a.fao === "string" ? { ...p.doc, meta: { ...p.doc.meta, fao: a.fao } } : p.doc,
      });
    }
    case "update_proposal_slide": {
      const p = await findProposal(a.id);
      const i = Number(a.index);
      if (!Number.isInteger(i) || i < 0 || i >= p.doc.slides.length) throw new ToolInputError(`"index" fora do intervalo (0–${p.doc.slides.length - 1})`);
      const slide = normalizeSlide({ ...(a.slide as Json), id: p.doc.slides[i].id }, i);
      return saveProposal({ ...p, doc: { ...p.doc, slides: p.doc.slides.map((s, k) => (k === i ? slide : s)) } });
    }
    case "set_proposal_slides": {
      const p = await findProposal(a.id);
      if (!Array.isArray(a.slides) || !a.slides.length) throw new ToolInputError(`"slides" deve ser uma lista`);
      return saveProposal({ ...p, doc: { ...p.doc, slides: a.slides.map((s, i) => normalizeSlide(s, i)) } });
    }
    case "create_proposal": {
      const p = emptyProposal(String(a.title ?? "New proposal"));
      if (a.client && typeof a.client === "object") p.client = { ...p.client, ...(a.client as Proposal["client"]) };
      if (a.value !== undefined) p.value = Number(a.value) || 0;
      if (Array.isArray(a.slides)) p.doc.slides = a.slides.map((s, i) => normalizeSlide(s, i));
      p.doc.meta.fao = `[ ${p.client.company || p.client.name || "Client"} Proposal ]`;
      return saveProposal(p);
    }
    case "list_projects": {
      const { data, error } = await db.from("projects").select("id, title, data").eq("owner_id", owner).limit(50);
      if (error) throw error;
      return JSON.stringify((data ?? []).map((p) => ({ id: p.id, title: p.title, client: p.data?.client, shoot_date: p.data?.shootDate, sessions: (p.data?.sessions ?? []).length })));
    }
  }
  throw new ToolInputError(`ferramenta desconhecida: ${name}`);
}
