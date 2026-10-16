import { describe, expect, it } from "vitest";
import { DEFAULT_CLIENT_PROCESS, normalizeProcessDef, stageCounts, stageMove, stageOf } from "./clientProcess";
import { emptyPost, moveToPhase } from "./customer";
import { brandProgress, emptyBrand, hexToCmyk, inkOn, normalizeBrand } from "./brand";
import { mergeTasks, newTask, parseMentions } from "./tasks";
import { splitChecklist, validationState } from "./validation";

const post = (status: Parameters<typeof emptyPost>[1] extends never ? never : string, extra = {}) => ({ ...emptyPost("c1"), status: status as "draft", ...extra });

describe("processo por cliente", () => {
  it("todas as fases ficam cobertas mesmo com etapas removidas ou renomeadas", () => {
    const p = normalizeProcessDef({ stages: [{ label: "Em curso", phases: ["editing"] }, { label: "Revisão", phases: ["client_review"], client: true }, { label: "Feito", phases: ["published"] }] });
    const covered = p.stages.flatMap((s) => s.phases);
    expect(new Set(covered).size).toBe(8);
    expect(p.stages.map((s) => s.id)).toEqual(["em-curso", "revisao", "feito"]);
    expect(stageOf(post("approved"), p).label).toBe("Revisão"); // aprovado → vizinho mais próximo
  });
  it("conta por etapa e move (etapa fixada só vale nas fases dela)", () => {
    const posts = [post("draft"), post("review"), post("review"), post("scheduled", { scheduled_at: "2026-10-20T10:00:00Z" })];
    const c = stageCounts(posts, DEFAULT_CLIENT_PROCESS);
    expect(c.find((x) => x.stage.id === "preview")).toMatchObject({ n: 2, pct: 50 });
    const moved = stageMove(posts[0], DEFAULT_CLIENT_PROCESS.stages[1], moveToPhase);
    expect([moved.status, moved.stage]).toEqual(["review", "preview"]);
    expect(stageOf({ ...moved, status: "approved" }, DEFAULT_CLIENT_PROCESS).id).toBe("approved");
  });
});

describe("marca, tarefas e validação", () => {
  it("normaliza a identidade e calcula o progresso", () => {
    const b = normalizeBrand({ name: "Carioca", colors: [{ name: "Brasa", hex: "#FF5A1F", role: "primary" }, { hex: "nope" }], fonts: { primary: { family: "Syne<script>" } } });
    expect(b.colors[0].hex).toBe("#ff5a1f");
    expect(b.colors[1].hex).toBe("#000000");
    expect(b.fonts.primary.family).toBe(emptyBrand().fonts.primary.family);
    expect(brandProgress(b).total).toBeGreaterThan(0);
    expect(inkOn("#ffffff")).toBe("#111111");
    expect(hexToCmyk("#ff5a1f")).toEqual([0, 65, 88, 0]);
  });
  it("menções e junção de tarefas", () => {
    const people = [{ name: "Ana Silva", email: "ana@x.pt" }, { name: "Rui", email: "rui@y.com" }];
    expect(parseMentions("ver com @ana e @rui@y.com", people)).toEqual(["ana@x.pt", "rui@y.com"]);
    const a = newTask({ title: "Enviar logo", by: "Ana", side: "client" });
    const b = { ...a, done: true, updated: new Date(Date.now() + 1000).toISOString() };
    expect(mergeTasks([a], [b])[0].done).toBe(true);
  });
  it("checklist a partir do comentário e estado da validação", () => {
    expect(splitChecklist("Trocar a música. Aumentar as legendas; cortar o início")).toEqual(["Trocar a música", "Aumentar as legendas", "cortar o início"]);
    expect(splitChecklist("Está ótimo")).toEqual([]);
    expect(validationState({ type: "post", validation: { image: "ok", copy: "fix" } })).toMatchObject({ ok: 1, fix: 1, done: false });
  });
});

describe("importação JSON do cliente", async () => {
  const { applyClientJson, CLIENT_JSON_EXAMPLE } = await import("./clientJson");
  const { emptyCustomer } = await import("./customer");
  it("aplica só as partes presentes e cria os posts", () => {
    const c = { ...emptyCustomer("Old"), id: "c1" };
    const r = applyClientJson(c, CLIENT_JSON_EXAMPLE, "Admin");
    expect(r.customer.name).toBe("Carioca Restaurant");
    expect(r.customer.kind).toBe("company");
    expect(r.customer.process?.stages.length).toBe(2);
    expect(r.customer.brand?.fonts.primary.family).toBe("Syne");
    expect(r.customer.tasks?.[0].title).toBe("Enviar menu de outono");
    expect(r.posts[0]).toMatchObject({ customer_id: "c1", type: "reel", title: "Bastidores da cozinha" });
    expect(applyClientJson(c, '{"kind":"person"}', "A").parts).toEqual(["kind"]);
  });
});
