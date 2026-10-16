import { describe, expect, it } from "vitest";
import { SEED_SERVICES } from "./services-seed";
import {
  DEFAULT_RULES,
  catalogStats,
  exportCatalog,
  DEFAULT_FOLDERS,
  folderStats,
  fromNotionRow,
  marginOf,
  marketPosition,
  parseCatalog,
  popular,
  priceForMargin,
  quote,
  searchServices,
  unitsForHours,
  verdict,
  withHistory,
} from "./services";

const S = SEED_SERVICES;
const get = (id: string) => S.find((s) => s.id === id)!;
const base = { client: { name: "Teste" }, partner: false, recurring_months: 0, rush: false };

describe("catálogo (Notion)", () => {
  it("tem as 35 linhas do MM - Program Worksheet em 6 pastas, ids únicos", () => {
    expect(S).toHaveLength(35);
    expect(new Set(S.map((s) => s.id)).size).toBe(35);
    expect(new Set(S.map((s) => s.folder))).toEqual(new Set(DEFAULT_FOLDERS.map((f) => f.id)));
  });
  it("margem real bate com o Notion", () => {
    expect(marginOf(960, 480)).toBe(50);
    expect(marginOf(114, 80)).toBeCloseTo(29.8, 1);
    expect(marginOf(185, 65)).toBeCloseTo(64.86, 1);
    expect(priceForMargin(65, 65)).toBeCloseTo(185.71, 1);
  });
  it("veredito: bloqueio quando preço ≤ CRP, repasse sem margem", () => {
    expect(verdict(get("cap-basic-simple-frequency"))).toBe("blocked");
    expect(verdict(get("travel-on-demand"))).toBe("passthrough");
    expect(verdict(get("edit-pro"))).toBe("healthy");
    expect(verdict(get("edit-pro-frequency"))).toBe("below_floor");
    expect(verdict(get("photo-sub-on-demand"))).toBe("premium");
  });
});

describe("mercado", () => {
  it("posiciona €/h e diária na banda", () => {
    const pro = marketPosition(get("cap-pro-on-demand"))!;
    expect(pro.value).toBe(114);
    expect(pro.segment).toBe("entry");
    const day = marketPosition(get("cap-day-pro"))!;
    expect(day.value).toBe(960);
    expect(day.pct).toBeCloseTo(12, 0);
    expect(marketPosition(get("travel-on-demand"))).toBeNull();
  });
  it("estatísticas do catálogo e por pasta", () => {
    const st = catalogStats(S);
    expect(st.count).toBe(35);
    expect(st.verdicts.blocked).toBe(1);
    const f = folderStats(S);
    expect(f.find((x) => x.folder.id === "capture")!.count).toBe(5);
    expect(f.reduce((n, x) => n + x.count, 0)).toBe(35);
  });
});

describe("orçamento", () => {
  it("1 Reel PRO = €185 + BTW 21%, sem descontos", () => {
    const q = quote({ ...base, lines: [{ service_id: "edit-pro", qty: 1 }] }, S);
    expect(q.subtotal).toBe(185);
    expect(q.btw).toBe(38.85);
    expect(q.total).toBe(223.85);
    expect(q.deposit).toBe(111.93);
  });
  it("B: 4 reels → 8%; C: 6 meses → 18%; parceiro → +10%; o piso de 50% limita", () => {
    const q = quote({ ...base, partner: true, recurring_months: 6, lines: [{ service_id: "edit-pro", qty: 4 }] }, S);
    const l = q.lines[0];
    expect(l.discounts).toMatchObject({ volume: 8, recurring: 18, partner: 10 });
    expect(l.requested_pct).toBe(36);
    expect(l.capped).toBe(true);
    expect(l.floor_limited).toBe(true);
    expect(l.applied_pct).toBe(29.7);
    expect(l.margin).toBeGreaterThanOrEqual(50);
    expect(q.contract_total).toBe(q.subtotal * 6);
  });
  it("teto de 35% quando a margem aguenta", () => {
    const q = quote({ ...base, recurring_months: 12, lines: [{ service_id: "photo-shooting-on-demand", qty: 8 }] }, S);
    const l = q.lines[0];
    expect(l.requested_pct).toBe(40);
    expect(l.applied_pct).toBe(35);
    expect(l.net).toBe(634.4);
    expect(q.warnings.some((w) => w.code === "capped")).toBe(true);
  });
  it("A suspensa na captação; piso de margem limita o desconto", () => {
    const q = quote({ ...base, recurring_months: 12, lines: [{ service_id: "cap-pro-on-demand", qty: 8 }] }, S);
    const l = q.lines[0];
    expect(l.discounts.hours).toBe(0);
    expect(l.floor_limited).toBe(true);
    expect(l.margin).toBeGreaterThanOrEqual(25);
    expect(l.applied_pct).toBeLessThan(25);
  });
  it("A aplica-se à fotografia por horas", () => {
    const q = quote({ ...base, lines: [{ service_id: "photo-event-on-demand", qty: 8 }] }, S);
    expect(q.lines[0].discounts.hours).toBe(15);
    expect(q.lines[0].net).toBe(884);
  });
  it("repasse nunca tem desconto e linha ao custo fica bloqueada", () => {
    const q = quote({ ...base, partner: true, lines: [{ service_id: "travel-on-demand", qty: 1 }, { service_id: "cap-basic-simple-frequency", qty: 2 }] }, S);
    expect(q.lines[0].applied_pct).toBe(0);
    expect(q.lines[0].net).toBe(150);
    expect(q.lines[1].blocked).toBe(true);
    expect(q.warnings.some((w) => w.code === "blocked")).toBe(true);
  });
  it("urgência +125% só nas linhas de edição", () => {
    const q = quote({ ...base, rush: true, lines: [{ service_id: "edit-pro", qty: 1 }, { service_id: "photo-shooting-on-demand", qty: 1 }] }, S);
    expect(q.lines[0].unit_price).toBe(416.25);
    expect(q.lines[1].unit_price).toBe(122);
  });
  it("horas → unidades", () => {
    expect(unitsForHours(get("cap-day-pro"), 10)).toBe(2);
    expect(unitsForHours(get("cap-pro-on-demand"), 3)).toBe(3);
  });
});

describe("pesquisa, popularidade e JSON", () => {
  it("pesquisa por texto e por preço", () => {
    expect(searchServices(S, "reel pro")[0].id).toMatch(/pro/);
    expect(searchServices(S, "fotografia <100").every((s) => s.price <= 100)).toBe(true);
    expect(searchServices(S, "diaria")[0].name).toMatch(/Diária/);
  });
  it("mais requisitados respeita o uso", () => {
    const list = S.map((s) => (s.id === "photo-retouch" ? { ...s, uses: 9 } : s));
    expect(popular(list, 3)[0].id).toBe("photo-retouch");
  });
  it("exporta e volta a importar sem perdas; aceita linhas do Notion", () => {
    const file = exportCatalog(S, DEFAULT_FOLDERS, DEFAULT_RULES);
    const back = parseCatalog(JSON.stringify(file));
    expect(back.errors).toEqual([]);
    expect(back.services).toHaveLength(35);
    expect(back.services[5]).toEqual(S[5]);
    const n = fromNotionRow({ Equipment: "Production | Editing PRO", Type: "MOV - [Material Edit]", "Plan Service": "Plan | On-Demand", "Service Cost": 185, "CRP (Custo Real)": 65, "Horas Reais": 1, "Potencial de Saída": "Alto" });
    expect(n).toMatchObject({ folder: "edit", plan: "on_demand", tier: "pro", price: 185, crp: 65, potential: "high" });
    expect(parseCatalog("{x").errors[0]).toMatch(/JSON/);
  });
  it("histórico regista o que mudou", () => {
    const s = get("edit-pro");
    const h = withHistory(s, { ...s, price: 195 }, "admin");
    expect(h.history.at(-1)).toMatchObject({ field: "price", from: "185", to: "195" });
  });
});

describe("documento", () => {
  it("descontos viram linhas negativas que fecham com o subtotal", async () => {
    const { quoteItems } = await import("./services");
    const q = quote({ ...base, partner: true, recurring_months: 12, lines: [{ service_id: "photo-shooting-on-demand", qty: 8 }, { service_id: "edit-pro", qty: 4 }] }, S);
    const items = quoteItems(q);
    const sum = items.reduce((s, i) => s + i.qty * i.rate, 0);
    expect(Math.round(sum * 100) / 100).toBe(q.subtotal);
    expect(items.some((i) => i.description.includes("Partnership"))).toBe(true);
  });
  it("BTW: NL 21%, UE 0%", () => {
    expect(quote({ ...base, lines: [{ service_id: "edit-pro", qty: 1 }] }, S).btw_rate).toBe(21);
    expect(quote({ ...base, client: { name: "x", country: "DE" }, lines: [{ service_id: "edit-pro", qty: 1 }] }, S).btw).toBe(0);
  });
});

describe("texto da proposta", () => {
  it("segue o formato CONTEXT → pacote → tabela PRICE | PACKAGE | INCLUDES", async () => {
    const { proposalText } = await import("./services");
    const input = { ...base, client: { name: "Ana", company: "Intuity Coaching" }, lines: [{ service_id: "pkg-pro", qty: 2 }] };
    const txt = proposalText(quote(input, S), input);
    expect(txt.indexOf("**CONTEXT**")).toBe(0);
    expect(txt).toContain("| PRICE | PACKAGE | INCLUDES |");
    expect(txt).toContain("€1,000** excl. BTW");
    expect(txt).toContain("1. **2× Reel PRO");
  });
});
