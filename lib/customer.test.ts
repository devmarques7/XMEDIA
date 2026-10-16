import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  addPaidMonth,
  cleanHandle,
  clientReview,
  duePosts,
  emptyCustomer,
  emptyPost,
  gridItems,
  igAuthorizeUrl,
  journeyState,
  monthGrid,
  mrr,
  nextSlots,
  normalizeSettings,
  parseInsights,
  postsByDay,
  seedCustomers,
  stageProgress,
  validHandle,
  validPasscode,
  weakPasscode,
} from "./customer";

describe("código do portal", () => {
  it("aceita 4 a 6 dígitos", () => {
    expect(validPasscode("1234")).toBe(true);
    expect(validPasscode("123456")).toBe(true);
    expect(validPasscode("123")).toBe(false);
    expect(validPasscode("1234567")).toBe(false);
    expect(validPasscode("12a4")).toBe(false);
  });
  it("avisa códigos fracos", () => {
    expect(weakPasscode("0000")).toBe(true);
    expect(weakPasscode("1234")).toBe(true);
    expect(weakPasscode("654321")).toBe(true);
    expect(weakPasscode("2580")).toBe(false);
    expect(weakPasscode("193746")).toBe(false);
  });
});

describe("clientes", () => {
  it("importa os 6 clientes do Notion com marcos das fases anteriores feitos", () => {
    const list = seedCustomers();
    expect(list).toHaveLength(6);
    const carioca = list.find((c) => c.name === "Carioca Restaurant")!;
    expect(carioca.stage).toBe("stage3");
    expect(carioca.lang).toBe("nl");
    expect(carioca.done).toContain("02.6");
    expect(stageProgress(carioca)).toEqual({ done: 0, total: 8, pct: 0 });
    expect(stageProgress({ stage: "complete", done: [] }).pct).toBe(100);
  });
  it("jornada do portal", () => {
    expect(journeyState("stage3", "stage2")).toBe("done");
    expect(journeyState("stage3", "stage3")).toBe("now");
    expect(journeyState("stage3", "stage4")).toBe("next");
  });
  it("mensalidade: 12 € por omissão, com preço próprio por cliente", () => {
    const a = emptyCustomer("A");
    const b = { ...emptyCustomer("B"), plan: { active: true, price: 20, since: "", paid_until: "" } };
    const c = { ...emptyCustomer("C"), plan: { active: false, price: null, since: "", paid_until: "" } };
    expect(mrr([a, b, c], DEFAULT_SETTINGS)).toBe(32);
    expect(mrr([a], normalizeSettings({ price: 15 }))).toBe(15);
    expect(addPaidMonth("", "2026-10-09")).toBe("2026-11-09");
    expect(addPaidMonth("2026-12-01", "2026-10-09")).toBe("2027-01-01");
  });
  it("instagram handle", () => {
    expect(cleanHandle(" https://www.instagram.com/Carioca.Restaurant/?hl=en")).toBe("carioca.restaurant");
    expect(cleanHandle("@mediamarques")).toBe("mediamarques");
    expect(validHandle("media_marques")).toBe(true);
    expect(validHandle("bad handle")).toBe(false);
  });
});

describe("conteúdos", () => {
  it("fila: próximos horários livres", () => {
    const from = new Date(2026, 9, 9, 13, 0); // sexta 9 out 13:00
    const slots = { days: [0, 4], times: ["18:30", "12:00"] }; // seg e sex
    const taken = [new Date(2026, 9, 9, 18, 30).toISOString()];
    const [a, b] = nextSlots(slots, taken, from, 2).map((s) => new Date(s));
    expect([a.getDate(), a.getHours()]).toEqual([12, 12]); // seg 12:00
    expect([b.getDate(), b.getHours(), b.getMinutes()]).toEqual([12, 18, 30]);
    expect(nextSlots({ days: [], times: ["10:00"] }, [], from)).toEqual([]);
  });
  it("calendário: semanas seg→dom e posts por dia", () => {
    const weeks = monthGrid("2026-10");
    expect(weeks[0][0]).toBe("2026-09-28");
    expect(weeks.at(-1)!.at(-1)).toBe("2026-11-01");
    const p = { ...emptyPost("c"), scheduled_at: new Date(2026, 9, 14, 12).toISOString() };
    expect(postsByDay([p]).get("2026-10-14")).toHaveLength(1);
  });
  it("grid: planeados no topo, stories fora, sem duplicar media do Instagram", () => {
    const a = { ...emptyPost("c", "reel"), id: "a", cover: "a.jpg", status: "scheduled" as const, scheduled_at: "2026-10-20T10:00:00Z" };
    const b = { ...emptyPost("c", "post"), id: "b", cover: "b.jpg", status: "draft" as const, scheduled_at: "2026-10-25T10:00:00Z" };
    const s = { ...emptyPost("c", "story"), id: "s", scheduled_at: "2026-10-21T10:00:00Z" };
    const pub = { ...emptyPost("c", "post"), id: "p", status: "published" as const, published_at: "2026-10-01T10:00:00Z", ig_media_id: "ig1" };
    const ig = [
      { id: "ig1", caption: "", media_type: "IMAGE", product: "FEED", url: "x", permalink: "", timestamp: "2026-10-01T10:00:00Z", likes: 0, comments: 0 },
      { id: "ig0", caption: "", media_type: "IMAGE", product: "FEED", url: "y", permalink: "", timestamp: "2026-09-01T10:00:00Z", likes: 0, comments: 0 },
    ];
    expect(gridItems([a, b, s, pub], ig).map((g) => g.key)).toEqual(["b", "a", "p", "ig0"]);
  });
  it("aprovação do cliente e publicação automática", () => {
    const p = { ...emptyPost("c"), status: "review" as const, scheduled_at: "2026-10-20T10:00:00Z" };
    const ok = clientReview(p, "approve", "");
    expect(ok.status).toBe("scheduled");
    expect(ok.feedback[0].by).toBe("client");
    expect(clientReview(p, "changes", "Trocar a capa").status).toBe("draft");
    expect(() => clientReview(ok, "approve", "")).toThrow();
    expect(duePosts([ok], new Date("2026-10-20T10:01:00Z"))).toHaveLength(1);
    expect(duePosts([{ ...ok, auto: false }], new Date("2026-10-20T10:01:00Z"))).toHaveLength(0);
  });
});

describe("Instagram API", () => {
  it("URL de autorização com os scopes de métricas e publicação", () => {
    const u = new URL(igAuthorizeUrl({ appId: "123", redirectUri: "https://x.app/api/portal/instagram/callback", state: "s" }));
    expect(u.origin + u.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(u.searchParams.get("scope")).toBe("instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish,instagram_business_manage_comments");
    expect(u.searchParams.get("response_type")).toBe("code");
  });
  it("lê métricas total_value", () => {
    expect(parseInsights({ data: [{ name: "reach", total_value: { value: 1200 } }, { name: "views", total_value: { value: 5400 } }, { name: "x" }] })).toEqual({ reach: 1200, views: 5400 });
    expect(parseInsights(null)).toEqual({});
  });
});
