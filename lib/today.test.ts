import { describe, expect, it } from "vitest";
import { mineOrOpen } from "./today";

const base = { id: "t", title: "x", by: "", side: "studio", due: "", post_id: "", mentions: [], progress: "todo", done: false, customer_id: "c", customer: "C" } as unknown as Parameters<typeof mineOrOpen>[0];

describe("mineOrOpen (foco da página Hoje)", () => {
  it("as minhas e as sem responsável entram; as de outros não", () => {
    expect(mineOrOpen({ ...base, assignee: "eu@x.com" }, "EU@x.com")).toBe(true);
    expect(mineOrOpen({ ...base, assignee: undefined }, "eu@x.com")).toBe(true);
    expect(mineOrOpen({ ...base, assignee: "outra@x.com" }, "eu@x.com")).toBe(false);
  });
});
