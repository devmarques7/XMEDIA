import { describe, expect, it } from "vitest";
import { pinnedFirst } from "./pins";

describe("pinnedFirst", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  it("fixados (pela ordem em que foram fixados), depois recentes, depois o resto", () => {
    expect(pinnedFirst(items, ["c", "a"], { d: 200, b: 100 }).map((x) => x.id)).toEqual(["c", "a", "d", "b"]);
  });
  it("sem fixados nem recentes mantém a ordem", () => {
    expect(pinnedFirst(items, [], {}).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
});
