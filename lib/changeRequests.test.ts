import { describe, expect, it } from "vitest";
import { applyChangeRequests, changeLines, matchPosts, pickPost, splitChanges } from "./changeRequests";
import { emptyPost, normalizeCustomer, phaseOf } from "./customer";

const cs = [normalizeCustomer({ id: "a", name: "Carioca Restaurant" }), normalizeCustomer({ id: "b", name: "Carine Hair Salon" })];
const reel = { ...emptyPost("a", "reel"), title: "[WEEK 43 · POST #1] Feijoada de sábado", status: "review" as const, round: 1 };
const menu = { ...emptyPost("a", "carousel"), title: "[WEEK 43 · POST #2] Menu novo" };
const hair = { ...emptyPost("b", "reel"), title: "Antes e depois — feijoada não" };
const gone = { ...emptyPost("a", "reel"), title: "Feijoada antiga", deleted_at: "2026-10-01" };
const posts = [reel, menu, hair, gone];

describe("encontrar o conteúdo pelo nome", () => {
  it("parte do título, sem acentos", () => expect(pickPost(posts, cs, "feijoada de sabado").post.id).toBe(reel.id));
  it("ignora apagados e filtra por cliente", () => {
    expect(matchPosts(posts, cs, "feijoada").map((h) => h.post.id)).not.toContain(gone.id);
    expect(pickPost(posts, cs, "feijoada", "carioca").post.id).toBe(reel.id);
  });
  it("ambíguo → pergunta com candidatos", () => expect(() => pickPost(posts, cs, "week 43")).toThrow(/vários conteúdos/));
  it("inexistente → erro", () => expect(() => pickPost(posts, cs, "natal")).toThrow(/não encontrado/));
});

describe("registar alterações", () => {
  it("separa o texto do email em pedidos", () => {
    expect(splitChanges("Olá!\n- Trocar a música\n2) Logo maior no fim\n• Cortar 3s no início")).toEqual(["Olá!", "Trocar a música", "Logo maior no fim", "Cortar 3s no início"]);
  });
  it("cada pedido vira comentário do cliente e o conteúdo passa para Alterações pedidas", () => {
    const r = applyChangeRequests(reel, { changes: ["Trocar a música", "Logo maior no fim"], from: "Ana (Carioca)", source: "email", at: "2026-10-16T10:00:00Z" });
    expect(r).toMatchObject({ added: 2, moved: true, open: 2, published: false });
    expect(r.post.status).toBe("draft");
    expect(phaseOf(r.post)).toBe("changes");
    expect(r.post.notes.map((n) => [n.by, n.author, n.text, n.round])).toEqual([
      ["client", "Ana (Carioca) · via email", "Trocar a música", 1],
      ["client", "Ana (Carioca) · via email", "Logo maior no fim", 1],
    ]);
    expect(changeLines({ post: reel, customer: cs[0], score: 90 }, r, ["Trocar a música"])[0]).toContain("→ Alterações pedidas");
  });
  it("vazio → erro; publicado → só regista", () => {
    expect(() => applyChangeRequests(reel, { changes: " " })).toThrow(/sem alterações/);
    const r = applyChangeRequests({ ...reel, status: "published" }, { changes: "Erro na legenda" });
    expect(r).toMatchObject({ moved: false, published: true });
    expect(r.post.status).toBe("published");
  });
});
