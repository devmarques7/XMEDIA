import { describe, expect, it } from "vitest";
import { checkFiles, fontWeightOf, mergeMedia } from "./uploadRules";
import { colOf, goalProgress, weekDays, weekOf, withCol, workload } from "./studio";
import { clientDropAction, DEFAULT_CLIENT_PROCESS } from "./clientProcess";
import { emptyPost } from "./customer";
import { newTask } from "./tasks";

const f = (name: string, type: string) => new File(["x"], name, { type });

describe("regras de importação", () => {
  it("reel aceita só 1 vídeo e substitui", () => {
    const r = checkFiles("reel", [f("a.mp4", "video/mp4"), f("b.mp4", "video/mp4"), f("c.png", "image/png")]);
    expect(r.ok.map((x) => x.name)).toEqual(["a.mp4"]);
    expect(r.rejected.map((x) => x.reason)).toEqual(["limit", "type"]);
  });
  it("carrossel aceita imagens e vídeos até 10, contando os existentes", () => {
    const files = Array.from({ length: 6 }, (_, i) => f(`${i}.jpg`, "image/jpeg"));
    const r = checkFiles("carousel", [...files, f("v.mp4", "video/mp4")], 5);
    expect(r.ok.length).toBe(5);
    expect(r.rejected.every((x) => x.reason === "limit")).toBe(true);
  });
  it("mergeMedia: reel substitui, carrossel acrescenta", () => {
    const a = [{ src: "1", kind: "image" as const }];
    const b = [{ src: "2", kind: "video" as const }];
    expect(mergeMedia("reel", a, b)).toEqual(b);
    expect(mergeMedia("carousel", a, b)).toEqual([...a, ...b]);
  });
  it("peso da fonte pelo nome do ficheiro", () => {
    expect(fontWeightOf("BioGrotesk-Bold.woff2")).toBe(700);
    expect(fontWeightOf("BioGrotesk-SemiBold.woff2")).toBe(600);
    expect(fontWeightOf("BioGrotesk-Regular.woff2")).toBe(400);
  });
});

describe("estúdio", () => {
  it("semana começa à segunda e tem 7 dias", () => {
    const w = weekOf(new Date(2026, 9, 14, 12)); // quarta
    expect(w).toBe("2026-10-12");
    expect(weekDays(w)[6]).toBe("2026-10-18");
  });
  it("tarefas: coluna e conclusão", () => {
    const t = newTask({ title: "x", by: "a", side: "studio" });
    expect(colOf(t)).toBe("todo");
    expect(colOf(withCol(t, "doing"))).toBe("doing");
    expect(withCol(t, "done").done).toBe(true);
  });
  it("carga e metas de uma pessoa", () => {
    const week = "2026-10-12";
    const mk = (id: string, status: "draft" | "approved") => ({ ...emptyPost("c1", "reel"), id, status, assignee: "ana@x.com", phase_since: "2026-10-13T10:00:00Z" });
    const posts = [mk("p1", "draft"), mk("p2", "approved")];
    const tasks = [{ ...newTask({ title: "t", by: "a", side: "studio", assignee: "ana@x.com", due: "2026-10-14" }), customer_id: "c1", customer: "C" }];
    const w = workload("ana@x.com", week, posts, tasks, []);
    expect(w.openPosts.length).toBe(1);
    expect(w.delivered.length).toBe(1);
    expect(w.load).toBe(2);
    expect(goalProgress({ id: "g", member: "ana@x.com", title: "", kind: "posts", target: 2, week }, w)).toEqual({ value: 1, pct: 50, done: false });
  });
});

describe("cliente arrasta no portal", () => {
  const st = (id: string) => DEFAULT_CLIENT_PROCESS.stages.find((s) => s.id === id)!;
  it("só pode aprovar ou pedir alterações a algo em revisão", () => {
    expect(clientDropAction({ status: "review" }, st("approved"))).toBe("approve");
    expect(clientDropAction({ status: "review" }, st("auto"))).toBe("approve");
    expect(clientDropAction({ status: "review" }, st("inquiry"))).toBe("changes");
    expect(clientDropAction({ status: "review" }, st("drafts"))).toBeNull();
    expect(clientDropAction({ status: "draft" }, st("approved"))).toBeNull();
  });
});

import { bucketOf, todayTasks, suggestions as suggest } from "./today";
import { DEFAULT_PROCESS } from "./customer";

describe("hoje", () => {
  const now = new Date(2026, 9, 15, 12);
  const mk = (p: Partial<ReturnType<typeof newTask>>) => ({ ...newTask({ title: "t", by: "a", side: "studio", ...p }), customer_id: "", customer: "XMEDIA" });
  it("classifica por prazo", () => {
    expect(bucketOf(mk({ due: "2026-10-14" }), "2026-10-15")).toBe("late");
    expect(bucketOf(mk({ due: "2026-10-15" }), "2026-10-15")).toBe("today");
    expect(bucketOf(mk({ due: "2026-10-17" }), "2026-10-15")).toBe("week");
    expect(bucketOf(mk({ due: "2026-10-30" }), "2026-10-15")).toBe("later");
  });
  it("atrasadas primeiro e vídeo ligado não volta a ser sugerido", () => {
    const post = { ...emptyPost("c1", "reel"), id: "p1", status: "draft" as const, notes: [{ id: "n", by: "client" as const, text: "x", media: 0, round: 0, done: false, at: "", updated: "" }] };
    const list = todayTasks([mk({ due: "2026-10-15", title: "hoje" }), mk({ due: "2026-10-10", title: "atrasada" })], [post], DEFAULT_PROCESS, now);
    expect(list[0].t.title).toBe("atrasada");
    expect(suggest([post], [], DEFAULT_PROCESS, now).length).toBe(1);
    expect(suggest([post], [mk({ post_id: "p1" })], DEFAULT_PROCESS, now).length).toBe(0);
  });
});

import { autoPlan } from "./today";
describe("planear automaticamente", () => {
  it("cria tarefas pelos prazos e não duplica vídeos com tarefa", () => {
    const now = new Date(2026, 9, 15, 12);
    const late = { ...emptyPost("c1", "reel"), id: "a", status: "draft" as const, phase_since: "2026-10-01T10:00:00Z" };
    const done = { ...emptyPost("c1", "reel"), id: "b", status: "published" as const };
    const today = autoPlan("today", [late, done], [], DEFAULT_PROCESS, now);
    expect(today.map((x) => x.post_id)).toEqual(["a"]);
    expect(today[0].due).toBe("2026-10-15");
    const linked = [{ ...newTask({ title: "x", by: "a", side: "studio", post_id: "a" }), customer_id: "c1", customer: "C" }];
    expect(autoPlan("week", [late], linked, DEFAULT_PROCESS, now)).toEqual([]);
  });
});
