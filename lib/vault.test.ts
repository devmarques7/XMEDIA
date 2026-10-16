import { describe, expect, it } from "vitest";
import { canManage, canReveal, newEntry, platformOf, publicEntry, strength, type Viewer } from "./vault";

const owner: Viewer = { side: "client", email: "ceo@c.com", customer_id: "c1", owner: true };
const member: Viewer = { side: "client", email: "m@c.com", customer_id: "c1", owner: false };
const studio: Viewer = { side: "studio", email: "ana@x.com", admin: false };
const admin: Viewer = { side: "studio", email: "boss@x.com", admin: true };

describe("cofre", () => {
  it("entrada do cliente: só o cliente vê até dar acesso ao estúdio", () => {
    const e = { ...newEntry({ customer_id: "c1", created_by: { email: "ceo@c.com", side: "client" } }), secret: { iv: "a", ct: "b" } };
    expect(canReveal(e, owner)).toBe(true);
    expect(canReveal(e, member)).toBe(false);
    expect(canReveal(e, studio)).toBe(false);
    expect(canReveal(e, admin)).toBe(false); // nem o admin do estúdio
    const granted = { ...e, grants: [{ kind: "member" as const, email: "ana@x.com" }] };
    expect(canReveal(granted, studio)).toBe(true);
    expect(canManage(e, owner)).toBe(true);
    expect(canManage(e, admin)).toBe(false);
  });
  it("interna: equipa vê, só o admin gere", () => {
    const e = newEntry({ customer_id: "", created_by: { email: "boss@x.com", side: "studio" } });
    expect(canReveal(e, studio)).toBe(true);
    expect(canManage(e, studio)).toBe(false);
    expect(canManage(e, admin)).toBe(true);
  });
  it("a cifra nunca sai para o browser", () => {
    const e = { ...newEntry({ customer_id: "c1", created_by: { email: "ceo@c.com", side: "client" } }), secret: { iv: "a", ct: "b" } };
    expect("secret" in publicEntry(e, owner)).toBe(false);
  });
  it("plataforma pelo link e força da senha", () => {
    expect(platformOf("https://business.facebook.com/x")).toBe("Meta Business");
    expect(platformOf("canva.com")).toBe("Canva");
    expect(strength("abc")).toBe(0);
    expect(strength("Abcdefghij1!xyz")).toBe(4);
  });
});
