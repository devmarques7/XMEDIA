import { describe, expect, it } from "vitest";
import { DraftError, buildDrafts, customerBrief, draftLines, matchCustomers, pickCustomer, toScheduledIso } from "./contentDrafts";
import { emptyPost, normalizeCustomer } from "./customer";

const c = normalizeCustomer({ id: "c1", name: "Carioca Restaurant", brand: { tagline: "Sabor do Rio", dos: ["Falar de família"] } as never });

describe("toScheduledIso (hora de Amesterdão)", () => {
  it("verão: 18:00 em Amesterdão = 16:00 UTC", () => expect(toScheduledIso("2026-07-10 18:00")).toBe("2026-07-10T16:00:00.000Z"));
  it("inverno: 18:00 em Amesterdão = 17:00 UTC", () => expect(toScheduledIso("2026-12-10 18:00")).toBe("2026-12-10T17:00:00.000Z"));
  it("só o dia → 10:00 local", () => expect(toScheduledIso("2026-12-10")).toBe("2026-12-10T09:00:00.000Z"));
  it("ISO com fuso fica igual", () => expect(toScheduledIso("2026-10-20T08:30:00Z")).toBe("2026-10-20T08:30:00.000Z"));
  it("vazio → sem data", () => expect(toScheduledIso("")).toBe(""));
  it("lixo → erro", () => expect(() => toScheduledIso("amanhã")).toThrow(DraftError));
});

describe("buildDrafts", () => {
  it("cria rascunhos internos, sem ficheiros, com legenda + hashtags + notas de produção", () => {
    const [p] = buildDrafts(c, [{ type: "reel", title: "Bastidores", caption: "O nosso feijão #rio", hashtags: ["#Rio", "amsterdam", "amsterdam"], production_notes: "Gancho: tampa a abrir", shot_list: ["Close panela", "Sorriso do chef"], scheduled_at: "2026-10-20 18:00", due_finish: "2026-10-18", music: "Bossa" }]);
    expect(p).toMatchObject({ customer_id: "c1", type: "reel", status: "draft", title: "Bastidores", internal: true, media: [], cover: "", due_finish: "2026-10-18", refs: { music: "Bossa" } });
    expect(p.caption).toContain("O nosso feijão #rio\n\n#amsterdam");
    expect(p.caption).not.toMatch(/#rio.*#rio/is);
    expect(p.caption).toContain("— PRODUCTION NOTES (remove before publishing) —");
    expect(p.caption).toContain("• Sorriso do chef");
    expect(p.scheduled_at).toBe("2026-10-20T16:00:00.000Z");
  });
  it("valida tipo, título, quantidade e datas", () => {
    expect(() => buildDrafts(c, [])).toThrow(/sem rascunhos/);
    expect(() => buildDrafts(c, [{ type: "tiktok", title: "x" }])).toThrow(/tipo/);
    expect(() => buildDrafts(c, [{ type: "post", title: " " }])).toThrow(/título/);
    expect(() => buildDrafts(c, [{ type: "post", title: "x", due_finish: "18/10" }])).toThrow(/due_finish/);
    expect(() => buildDrafts(c, Array.from({ length: 41 }, () => ({ type: "post", title: "x" })))).toThrow(/máx/);
  });
  it("resumo para confirmar", () => {
    const ps = buildDrafts(c, [{ type: "post", title: "Menu" }]);
    expect(draftLines(c.name, ps)[1]).toBe("+ post · Menu · sem data");
  });
});

describe("customerBrief", () => {
  it("marca, publicações recentes e datas ocupadas (sem apagados)", () => {
    const now = new Date("2026-10-16T10:00:00Z");
    const a = { ...emptyPost("c1", "reel"), title: "Antigo", caption: "Olá\n\n— PRODUCTION NOTES x", scheduled_at: "2026-10-01T16:00:00.000Z" };
    const b = { ...emptyPost("c1", "post"), title: "Futuro", scheduled_at: "2026-10-22T16:00:00.000Z" };
    const gone = { ...emptyPost("c1", "post"), title: "Apagado", deleted_at: "2026-10-02" };
    const r = customerBrief(c, [a, b, gone], now);
    expect(r.brand.tagline).toBe("Sabor do Rio");
    expect(r.brand.dos).toEqual(["Falar de família"]);
    expect(r.recent_posts.map((p) => p.title)).toEqual(["Futuro", "Antigo"]);
    expect(r.recent_posts[1].caption_start).toBe("Olá");
    expect(r.busy_slots).toEqual([{ at: "2026-10-22T16:00:00.000Z", type: "post", title: "Futuro" }]);
  });
});

describe("pickCustomer / matchCustomers", () => {
  const all = [
    normalizeCustomer({ id: "a", name: "Carioca Restaurant", email: "rio@x.nl" }),
    normalizeCustomer({ id: "b", name: "Carine Hair Salon" }),
    normalizeCustomer({ id: "c", name: "Luuk Melisse | Personal Brand" }),
  ];
  it("parte do nome, sem acentos nem maiúsculas", () => expect(pickCustomer(all, "cariocá").id).toBe("a"));
  it("palavra do meio do nome", () => expect(pickCustomer(all, "melisse").id).toBe("c"));
  it("ambíguo → erro com candidatos", () => expect(() => pickCustomer(all, "car")).toThrow(/vários clientes: Carioca Restaurant \(a\), Carine Hair Salon \(b\)/));
  it("inexistente → erro", () => expect(() => pickCustomer(all, "zzz")).toThrow(/não encontrado/));
  it("por email", () => expect(matchCustomers(all, "rio@x").map((c) => c.id)).toEqual(["a"]));
});
