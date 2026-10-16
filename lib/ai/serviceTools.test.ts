import { describe, expect, it } from "vitest";
import { SEED_SERVICES } from "../services-seed";
import { DEFAULT_FOLDERS, DEFAULT_RULES } from "../services";
import { handleRpc } from "../mcp/rpc";
import { SERVICE_TOOLS, prepareServiceWrite, runServiceRead } from "./serviceTools";

const cat = { services: SEED_SERVICES, folders: DEFAULT_FOLDERS, rules: DEFAULT_RULES };

describe("ferramentas do catálogo", () => {
  it("visão geral, pesquisa e ficha", () => {
    const o = JSON.parse(runServiceRead("service_catalog", {}, cat));
    expect(o.folders).toHaveLength(6);
    expect(o.rules.cap_pct).toBe(35);
    const l = JSON.parse(runServiceRead("list_services", { query: "reel", folder: "video_pkg" }, cat));
    expect(l.services.every((s: { folder: string }) => s.folder === "video_pkg")).toBe(true);
    const g = JSON.parse(runServiceRead("get_service", { id: "Production | Editing PRO" }, cat));
    expect(g.id).toBe("edit-pro");
    expect(g.analysis.max_discount_pct).toBeCloseTo(29.7, 1);
  });
  it("orçamento resolve nomes aproximados e devolve texto da proposta", () => {
    const q = JSON.parse(runServiceRead("quote_services", { client: { company: "Sanctum BV" }, lines: [{ service_id: "edit-pro", qty: 3 }], partner: true }, cat));
    expect(q.totals.subtotal).toBeGreaterThan(0);
    expect(q.proposal_text).toContain("| PRICE | PACKAGE | INCLUDES |");
    expect(q.document_items.some((i: { rate: number }) => i.rate < 0)).toBe(true);
  });
  it("escritas: cria, atualiza, organiza e muda regras sem gravar", () => {
    const c = prepareServiceWrite("create_service", { name: "Drone | PRO", folder: "capture", price: 180, crp: 90, unit: "hour" }, cat);
    expect(c.services?.[0].id).toBe("drone-pro");
    expect(() => prepareServiceWrite("create_service", { name: "x", folder: "nope", price: 1 }, cat)).toThrow(/pasta/);
    const u = prepareServiceWrite("update_service", { id: "edit-pro", price: 195 }, cat);
    expect(u.lines.join(" ")).toMatch(/185 → 195/);
    const o = prepareServiceWrite("organize_services", { folders: [{ label: "Drone" }], moves: [{ id: "edit-pro", folder: "drone" }] }, cat);
    expect(o.folders?.[0].id).toBe("drone");
    expect(o.services?.[0].folder).toBe("drone");
    const r = prepareServiceWrite("set_pricing_rules", { partner_pct: 12 }, cat);
    expect(r.rules?.partner_pct).toBe(12);
  });
  it("aparece no tools/list do MCP", async () => {
    const res = await handleRpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, async () => "");
    const names = (res!.result as { tools: { name: string }[] }).tools.map((t) => t.name);
    for (const t of SERVICE_TOOLS) expect(names).toContain(t.name);
  });
});
