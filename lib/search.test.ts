import { describe, expect, it } from "vitest";
import { emptyCustomer, emptyPost } from "./customer";
import { emptyInvoice } from "./invoice";
import { emptyProposal } from "./proposal";
import { buildIndex, search } from "./search";
import { emptyData, type Project } from "./types";

const project: Project = {
  id: "p1",
  title: "Sanctum Retreat Ibiza",
  version: 1,
  created_at: "",
  updated_at: "",
  data: {
    ...emptyData(),
    client: "Sanctum",
    sessions: [{ id: "s", label: "Sex 2", date: "2026-10-02", start: "08:00", end: "22:00", notes: "", blocks: [{ id: "b", title: "Breathwork with Anika", start: "11:15", end: "12:30", scenes: [{ id: "c", title: "Anika a trabalhar a sala", description: "Sem close-ups de caras.", links: [], done: false }] }] }],
  },
};

describe("pesquisa global", () => {
  const inv = { ...emptyInvoice("Q4 - #0051", "2026-10-08"), client: { name: "Sanctum BV", address: "", country: "NL", vat: "", email: "" } };
  inv.items = [{ id: "1", description: "® [MM] Partnership Discount — Venue Launch", qty: 1, rate: -629 }];
  const prop = { ...emptyProposal("Shirley — Brand Elevation"), id: "pr1" };
  const index = buildIndex({ projects: [project], invoices: [inv], proposals: [prop], pages: [{ href: "/financas", label: "Finanças" }] });

  it("encontra texto dentro de cenas, com excerto e link para o separador", () => {
    const [hit] = search(index, "close-ups");
    expect(hit.doc.kind).toBe("project");
    expect(hit.field.label).toBe("Cena · Breathwork with Anika");
    expect(hit.snippet.match).toBe("close-ups");
    expect(hit.field.href).toBe("/p/p1?tab=cenas");
  });
  it("ignora acentos e maiúsculas, e exige todos os termos", () => {
    expect(search(index, "FINANCAS")[0].doc.kind).toBe("page");
    expect(search(index, "venue launch")[0].doc.title).toBe("Q4 - #0051");
    expect(search(index, "venue zzz")).toHaveLength(0);
  });
  it("procura no texto dos slides e aponta o slide", () => {
    const hit = search(index, "price is what you pay").find((h) => h.doc.kind === "proposal")!;
    expect(hit.field.label).toMatch(/^Slide \d+ · /);
    expect(hit.field.href).toMatch(/^\/propostas\/pr1\?slide=\d+$/);
  });
  it("encontra legendas dos conteúdos de um cliente", () => {
    const c = { ...emptyCustomer("Carioca Restaurant"), id: "c1" };
    const post = { ...emptyPost("c1"), id: "x", title: "Reel picanha", caption: "A melhor picanha de Amsterdam" };
    const [hit] = search(buildIndex({ customers: [c], posts: [post] }), "picanha amsterdam");
    expect(hit.doc.kind).toBe("customer");
    expect(hit.field.href).toBe("/clientes/c1?tab=content&post=x");
  });
  it("títulos têm prioridade", () => {
    const r = search(index, "sanctum");
    expect(r[0].doc.title).toBe("Sanctum Retreat Ibiza");
  });
});
