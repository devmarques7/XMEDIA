// Ferramentas do catálogo de serviços (assistente + servidor MCP). Núcleo puro: recebe o catálogo,
// devolve o texto do resultado (leitura) ou as alterações a gravar (escrita). Quem chama grava no sítio certo.
import type Anthropic from "@anthropic-ai/sdk";
import {
  DEFAULT_FOLDERS,
  alternatives,
  catalogStats,
  folderStats,
  hourlyOf,
  marginOf,
  marketPosition,
  normalizeRules,
  normalizeService,
  priceForMargin,
  proposalText,
  quote,
  quoteItems,
  searchServices,
  slug,
  verdict,
  type PricingRules,
  type QuoteInput,
  type Service,
  type ServiceFolder,
} from "../services";
import { ToolInputError } from "./apply";

type Json = Record<string, unknown>;
export type CatalogData = { services: Service[]; folders: ServiceFolder[]; rules: PricingRules };
export type CatalogChange = { lines: string[]; services?: Service[]; folders?: ServiceFolder[]; rules?: PricingRules; quote?: { title: string; input: QuoteInput; subtotal: number; total: number } };

export const SERVICE_READ_TOOLS = new Set(["service_catalog", "list_services", "get_service", "quote_services"]);
export const SERVICE_WRITE_TOOLS = new Set(["create_service", "update_service", "organize_services", "set_pricing_rules", "save_quote"]);

const serviceFields = {
  name: { type: "string" },
  folder: { type: "string", description: "id da pasta (ver service_catalog)" },
  kind: { type: "string", enum: ["capture", "edit", "reel", "photo", "strategy", "travel"], description: "família de desconto" },
  plan: { type: ["string", "null"], enum: ["on_demand", "frequency", "day", "extra", "package", null] },
  tier: { type: ["string", "null"], enum: ["simple", "pro", null] },
  unit: { type: "string", enum: ["hour", "day", "item", "session", "month", "trip"] },
  price: { type: "number", description: "preço ao cliente por unidade, excl. BTW" },
  crp: { type: "number", description: "custo real de produção por unidade" },
  hours: { type: "number", description: "horas efetivas por unidade" },
  min_margin: { type: "number", description: "piso de margem desta linha (%) — 50 produção própria, 25 captação/parceiro" },
  pass_through: { type: "boolean", description: "repasse sem margem (só deslocamento/parking)" },
  potential: { type: "string", enum: ["high", "medium", "review", "passthrough"] },
  deliverable: { type: "string" },
  includes: { type: "array", items: { type: "string" } },
  use_for: { type: "array", items: { type: "string" } },
  not_for: { type: "string" },
  notes: { type: "string" },
  invoice_label: { type: "string", description: "texto na proposta/invoice, ex.: '® [MM] Post-Production / Reel PRO: - Complete Edit'" },
  tags: { type: "array", items: { type: "string" } },
  archived: { type: "boolean" },
  market: {
    type: ["object", "null"],
    properties: { low: { type: "number" }, high: { type: "number" }, per: { type: "string", enum: ["hour", "day", "item", "month"] }, label: { type: "string" }, sources: { type: "array", items: { type: "string" } } },
  },
};

const quoteSchema = {
  type: "object" as const,
  properties: {
    client: { type: "object", properties: { name: { type: "string" }, company: { type: "string" }, email: { type: "string" }, country: { type: "string", description: "ISO-2; decide o BTW" } }, additionalProperties: false },
    lines: { type: "array", minItems: 1, items: { type: "object", properties: { service_id: { type: "string" }, qty: { type: "number", description: "horas para serviços à hora; unidades nos restantes" } }, required: ["service_id", "qty"], additionalProperties: false } },
    partner: { type: "boolean", description: "cliente parceiro (desconto de parceiro)" },
    recurring_months: { type: "number", description: "0 = avulso/On-Demand; 3, 6 ou 12 = contrato Frequency" },
    rush: { type: "boolean", description: "urgência same-day (+% só na edição)" },
    extra_discount_pct: { type: "number", description: "condição especial manual — conta para o teto" },
    note: { type: "string" },
  },
  required: ["lines"],
  additionalProperties: false,
};

export const SERVICE_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "service_catalog",
    description: "Visão geral do catálogo de serviços: pastas (com contagem, preço médio, €/h médio, margem média), regras de preço (descontos A horas, B reels, C recorrência, parceiro, teto, piso, urgência, BTW, depósito) e saúde das margens. Use primeiro para conhecer as pastas e as regras.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_services",
    description: "Pesquisa no catálogo de serviços (nome, pasta, plano, entregável, etiquetas; aceita preço como '<150' ou '>500'). Devolve id, nome, pasta, plano, nível, unidade, preço, €/h, margem, veredito de margem e posição de mercado.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, folder: { type: "string" }, plan: { type: "string", enum: ["on_demand", "frequency", "day", "extra", "package"] }, include_archived: { type: "boolean" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_service",
    description: "Ficha completa de um serviço: o que inclui, quando usar/não usar, preço, CRP, margem, desconto máximo sem furar o piso, preço para a margem-alvo, banda de mercado com fontes e alternativas da mesma família.",
    input_schema: { type: "object", properties: { id: { type: "string", description: "id ou nome exato" } }, required: ["id"], additionalProperties: false },
  },
  {
    name: "quote_services",
    description:
      "Calcula um orçamento com o motor de preços MediaMarques (descontos A/B/C + parceiro + condição especial, teto, piso de margem por linha, urgência, BTW pelo país, depósito). Não grava. Devolve linhas, totais, avisos (teto, piso, BLOQUEADO), as linhas do documento (descontos como linhas negativas) e o texto da proposta no formato padrão (CONTEXT → pacote → PRICE | PACKAGE | INCLUDES).",
    input_schema: quoteSchema,
  },
  {
    name: "create_service",
    description: "Cria um serviço novo no catálogo. Se não souber o preço, defina o CRP e use preço = CRP ÷ (1 − margem-alvo). O utilizador confirma.",
    input_schema: { type: "object", properties: { id: { type: "string", description: "slug opcional" }, ...serviceFields }, required: ["name", "folder", "price"], additionalProperties: false },
  },
  {
    name: "update_service",
    description: "Altera campos de um serviço (só os enviados). Fica registado no histórico. O utilizador confirma.",
    input_schema: { type: "object", properties: { id: { type: "string" }, ...serviceFields }, required: ["id"], additionalProperties: false },
  },
  {
    name: "organize_services",
    description: "Organiza o catálogo: move serviços entre pastas e/ou cria, renomeia, recolore e reordena pastas. O utilizador confirma.",
    input_schema: {
      type: "object",
      properties: {
        moves: { type: "array", items: { type: "object", properties: { id: { type: "string" }, folder: { type: "string" } }, required: ["id", "folder"], additionalProperties: false } },
        folders: {
          type: "array",
          description: "pastas a criar/atualizar (por id); a ordem da lista passa a ser a ordem das pastas enviadas",
          items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" }, color: { type: "string" }, hint: { type: "string" } }, required: ["label"], additionalProperties: false },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "set_pricing_rules",
    description: "Altera as regras de preço (só os campos enviados): hours_tiers/volume_tiers [{min,pct}], recurring [{months,pct}], partner_pct, cap_pct, floor_margin, target_margin, healthy [a,b], rush_pct, btw, deposit_pct, hours_on_capture. O utilizador confirma.",
    input_schema: {
      type: "object",
      properties: {
        hours_tiers: { type: "array", items: { type: "object", properties: { min: { type: "number" }, pct: { type: "number" } } } },
        volume_tiers: { type: "array", items: { type: "object", properties: { min: { type: "number" }, pct: { type: "number" } } } },
        recurring: { type: "array", items: { type: "object", properties: { months: { type: "number" }, pct: { type: "number" } } } },
        partner_pct: { type: "number" },
        cap_pct: { type: "number" },
        floor_margin: { type: "number" },
        target_margin: { type: "number" },
        healthy: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
        rush_pct: { type: "number" },
        btw: { type: "number" },
        deposit_pct: { type: "number" },
        hours_on_capture: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "save_quote",
    description: "Guarda um orçamento (mesmos campos de quote_services + title) na lista de orçamentos da calculadora. O utilizador confirma.",
    input_schema: { ...quoteSchema, properties: { title: { type: "string" }, ...quoteSchema.properties } },
  },
];

const eur = (n: number) => `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function find(c: CatalogData, key: unknown) {
  const k = String(key ?? "").trim();
  if (!k) throw new ToolInputError(`falta "id"`);
  const hit = c.services.find((s) => s.id === k) ?? c.services.find((s) => s.name.toLowerCase() === k.toLowerCase()) ?? searchServices(c.services, k, c.folders)[0];
  if (!hit) throw new ToolInputError(`serviço "${k}" não encontrado`);
  return hit;
}

const summary = (s: Service, r: PricingRules) => ({
  id: s.id,
  name: s.name,
  folder: s.folder,
  plan: s.plan,
  tier: s.tier,
  unit: s.unit,
  price: s.price,
  hourly: hourlyOf(s),
  margin: s.pass_through ? null : marginOf(s.price, s.crp),
  verdict: verdict(s, r),
  market: marketPosition(s) ? { segment: marketPosition(s)!.segment, pct: marketPosition(s)!.pct } : null,
  uses: s.uses,
  archived: s.archived || undefined,
});

function toInput(a: Json): QuoteInput {
  if (!Array.isArray(a.lines) || !a.lines.length) throw new ToolInputError(`"lines" deve ser uma lista com service_id e qty`);
  const c = (a.client ?? {}) as Json;
  return {
    client: { name: String(c.name ?? ""), company: String(c.company ?? ""), email: String(c.email ?? ""), country: String(c.country ?? "NL").toUpperCase() },
    lines: (a.lines as Json[]).map((l) => ({ service_id: String(l.service_id ?? ""), qty: Number(l.qty) || 0 })),
    partner: Boolean(a.partner),
    recurring_months: Number(a.recurring_months) || 0,
    rush: Boolean(a.rush),
    extra_discount_pct: Number(a.extra_discount_pct) || 0,
    note: typeof a.note === "string" ? a.note : "",
  };
}

/** Resolve ids aproximados ("reel pro") para ids reais antes de calcular. */
function resolveLines(c: CatalogData, input: QuoteInput): QuoteInput {
  return { ...input, lines: input.lines.map((l) => ({ ...l, service_id: find(c, l.service_id).id })) };
}

export function runServiceRead(name: string, a: Json, c: CatalogData): string {
  const r = c.rules;
  switch (name) {
    case "service_catalog": {
      const st = catalogStats(c.services, r);
      return JSON.stringify({
        folders: folderStats(c.services, c.folders).map((f) => ({ id: f.folder.id, label: f.folder.label, hint: f.folder.hint, count: f.count, avg_price: f.avg_price, avg_hourly: f.avg_hourly, avg_margin: f.avg_margin, range: [f.min, f.max], review: f.review })),
        rules: r,
        stats: st,
      });
    }
    case "list_services": {
      let list = searchServices(a.include_archived ? c.services.map((s) => ({ ...s, archived: false })) : c.services, String(a.query ?? ""), c.folders);
      if (a.folder) list = list.filter((s) => s.folder === a.folder);
      if (a.plan) list = list.filter((s) => s.plan === a.plan);
      return JSON.stringify({ count: list.length, services: list.slice(0, 60).map((s) => summary(c.services.find((x) => x.id === s.id) ?? s, r)) });
    }
    case "get_service": {
      const s = find(c, a.id);
      const maxDiscount = s.pass_through || !s.price ? 0 : Math.max(0, Math.floor((1 - s.crp / (s.price * (1 - s.min_margin / 100))) * 1000) / 10);
      return JSON.stringify({
        ...s,
        history: s.history.slice(-8),
        analysis: {
          hourly: hourlyOf(s),
          margin: marginOf(s.price, s.crp),
          verdict: verdict(s, r),
          max_discount_pct: maxDiscount,
          price_for_target_margin: priceForMargin(s.crp, r.target_margin),
          market: marketPosition(s),
        },
        alternatives: alternatives(s, c.services).map((x) => ({ id: x.id, name: x.name, price: x.price, unit: x.unit, plan: x.plan, tier: x.tier })),
      });
    }
    case "quote_services": {
      const input = resolveLines(c, toInput(a));
      const q = quote(input, c.services, r);
      return JSON.stringify({
        lines: q.lines.map((l) => ({ id: l.service.id, name: l.service.name, qty: l.qty, hours: l.hours, unit_price: l.unit_price, gross: l.gross, discounts: l.discounts, requested_pct: l.requested_pct, applied_pct: l.applied_pct, capped: l.capped, floor_limited: l.floor_limited, net: l.net, margin: l.margin, blocked: l.blocked })),
        totals: { gross: q.gross, discount: q.discount, subtotal: q.subtotal, btw_rate: q.btw_rate, btw: q.btw, total: q.total, deposit: q.deposit, months: q.months, contract_total: q.contract_total, crp: q.crp, margin: q.margin },
        warnings: q.warnings,
        document_items: quoteItems(q, r),
        proposal_text: proposalText(q, input),
      });
    }
  }
  throw new ToolInputError(`ferramenta desconhecida: ${name}`);
}

const pick = (a: Json) => {
  const out: Json = {};
  for (const k of Object.keys(serviceFields)) if (a[k] !== undefined) out[k] = a[k];
  return out;
};

export function prepareServiceWrite(name: string, a: Json, c: CatalogData): CatalogChange {
  const r = c.rules;
  switch (name) {
    case "create_service": {
      const id = slug(String(a.id || a.name || ""));
      if (c.services.some((s) => s.id === id)) throw new ToolInputError(`já existe um serviço com id "${id}" — use update_service`);
      if (!c.folders.some((f) => f.id === a.folder)) throw new ToolInputError(`pasta "${a.folder}" não existe (pastas: ${c.folders.map((f) => f.id).join(", ")})`);
      const s = normalizeService({ ...pick(a), id }, c.folders);
      return { lines: [`+ ${s.name} · ${s.folder} · ${eur(s.price)} / ${s.unit} · margem ${marginOf(s.price, s.crp)}% (${verdict(s, r)})`], services: [s] };
    }
    case "update_service": {
      const before = find(c, a.id);
      const after = normalizeService({ ...before, ...pick(a), id: before.id }, c.folders);
      if (!c.folders.some((f) => f.id === after.folder)) throw new ToolInputError(`pasta "${after.folder}" não existe`);
      const lines = (Object.keys(pick(a)) as (keyof Service)[])
        .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
        .map((k) => `${before.name} · ${k}: ${JSON.stringify(before[k]).slice(0, 60)} → ${JSON.stringify(after[k]).slice(0, 60)}`);
      if (before.price !== after.price || before.crp !== after.crp) lines.push(`margem ${marginOf(before.price, before.crp)}% → ${marginOf(after.price, after.crp)}% (${verdict(after, r)})`);
      return { lines: lines.length ? lines : ["(sem alterações)"], services: [after] };
    }
    case "organize_services": {
      const lines: string[] = [];
      let folders = c.folders.slice();
      if (Array.isArray(a.folders)) {
        (a.folders as Json[]).forEach((f, i) => {
          const id = String(f.id || slug(String(f.label)));
          const prev = folders.find((x) => x.id === id);
          const next: ServiceFolder = { id, label: String(f.label ?? prev?.label ?? id), color: String(f.color ?? prev?.color ?? "#8a8f98"), hint: String(f.hint ?? prev?.hint ?? ""), order: i + 1 };
          lines.push(prev ? `pasta ${id}: ${prev.label} → ${next.label}` : `+ pasta ${next.label} (${id})`);
          folders = prev ? folders.map((x) => (x.id === id ? next : x)) : [...folders, next];
        });
        const sent = (a.folders as Json[]).map((f) => String(f.id || slug(String(f.label))));
        folders = [...sent.map((id) => folders.find((f) => f.id === id)!), ...folders.filter((f) => !sent.includes(f.id))].map((f, i) => ({ ...f, order: i + 1 }));
      }
      const moved: Service[] = [];
      for (const m of (a.moves as Json[] | undefined) ?? []) {
        const s = find(c, m.id);
        const to = String(m.folder);
        if (!folders.some((f) => f.id === to)) throw new ToolInputError(`pasta "${to}" não existe`);
        if (s.folder !== to) {
          moved.push({ ...s, folder: to });
          lines.push(`${s.name}: ${s.folder} → ${to}`);
        }
      }
      return { lines: lines.length ? lines : ["(sem alterações)"], services: moved.length ? moved : undefined, folders: Array.isArray(a.folders) ? folders : undefined };
    }
    case "set_pricing_rules": {
      const next = normalizeRules({ ...r, ...(a as Partial<PricingRules>) });
      const lines = (Object.keys(a) as (keyof PricingRules)[]).filter((k) => JSON.stringify(r[k]) !== JSON.stringify(next[k])).map((k) => `${k}: ${JSON.stringify(r[k])} → ${JSON.stringify(next[k])}`);
      return { lines: lines.length ? lines : ["(sem alterações)"], rules: next };
    }
    case "save_quote": {
      const input = resolveLines(c, toInput(a));
      const q = quote(input, c.services, r);
      const title = String(a.title || input.client.company || input.client.name || "Quote");
      return {
        lines: [`${title}: ${q.lines.map((l) => `${l.qty}× ${l.service.name}`).join(", ")}`, `subtotal ${eur(q.subtotal)} · BTW ${eur(q.btw)} · total ${eur(q.total)}`, ...q.warnings.map((w) => `⚠ ${w.code}${w.line ? ` (${w.line})` : ""}`)],
        quote: { title, input, subtotal: q.subtotal, total: q.total },
      };
    }
  }
  throw new ToolInputError(`ferramenta desconhecida: ${name}`);
}

export const EMPTY_FOLDERS = DEFAULT_FOLDERS;

/** Habilidade do agente: como ler o catálogo, calcular e apresentar propostas MediaMarques. */
export const PROPOSAL_SKILL = `
Serviços, preços e propostas (catálogo XMEDIA — fonte: Notion "MM - Program Worksheet" + "Análise de Mercado & Motor de Margem"):
- Nunca invente preços: leia com list_services/get_service e calcule SEMPRE com quote_services (o motor aplica as regras). Antes de propor, confirme o "entregável válido" e o "quando não usar" do serviço.
- Escolher o serviço certo: pergunte-se (1) só material bruto ou vídeo final? captação = bruto; pacotes/Reel = final; (2) Basic (constância, bastidores, corte seco) ou PRO (marca, campanha, cinematográfico)? (3) avulso (On-Demand) ou contrato ≥3 meses (Frequency)? (4) >6h no mesmo dia → compare com a diária. Se houver alternativa mais barata que cumpra o pedido, diga-o.
- Descontos: A horas (mesmo dia/local; suspenso na captação), B nº de reels por ciclo, C recorrência (3/6/12 meses), parceiro, condição especial. Soma com teto (35% por defeito) e nunca abaixo do piso de margem da linha — o motor limita e avisa. Descontos aparecem como linhas negativas e são explicados na NOTE.
- Color grading: 1 Reel com edição completa → preço de tabela (o grading já está incluído). Só com 2+ Reels a partilhar UMA passagem de grading: CRP total ÷ (1 − margem-alvo), arredondado na banda saudável.
- Urgência/same-day: +rush_pct apenas nas linhas de edição. Deslocamento: repasse ao custo, sem margem nem desconto.
- BLOQUEADO (preço ≤ custo) ou abaixo do piso: não envie; proponha uma das 4 correções (reduzir âmbito, limitar desconto, aumentar volume, separar fornecedor externo).
- Formato da proposta (texto): 1) **CONTEXT** — um parágrafo em prosa, nunca bullets; 2) nome do pacote em destaque (um bloco por opção Basic/PRO se houver); 3) tabela | PRICE | PACKAGE | INCLUDES | — preço excl. BTW com o plano (On-Demand/Frequency), includes numerados com lead-in a negrito; 4) linha de fecho com o próximo passo (depósito), sem oferecer "quick call". Use o proposal_text do quote_services como base e ajuste o CONTEXT ao cliente.
- Para PDF/invoice: a calculadora (/servicos/calculadora) gera o PDF no template MediaMarques e cria a invoice em rascunho; create_invoice/set_invoice_items devem usar os document_items do quote_services.
- CRP e margem são internos: nunca os mostre ao cliente nem os ponha em textos de proposta.`;
