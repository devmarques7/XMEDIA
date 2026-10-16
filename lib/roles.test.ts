import { describe, expect, it } from "vitest";
import { ADMIN_ACCESS, ROLE_PRESETS, can, canOpen, cleanPerms, effectivePerms, type Access } from "./roles";

const member = (perms: string[]): Access => ({ admin: false, role: "production", perms: new Set(cleanPerms(perms)) });

describe("roles", () => {
  it("production: projetos e clientes, regista invoices, sem finanças", () => {
    const a = member(ROLE_PRESETS.production);
    expect(can(a, "projects.edit")).toBe(true);
    expect(can(a, "invoices.create")).toBe(true);
    expect(can(a, "finance.view")).toBe(false);
    expect(can(a, "proposals.view")).toBe(false);
    expect(canOpen(a, "/financas")).toBe(true); // só para registar invoices
    expect(canOpen(a, "/propostas")).toBe(false);
    expect(canOpen(a, "/equipa")).toBe(false);
    expect(canOpen(a, "/definicoes")).toBe(false);
    expect(canOpen(a, "/p/123")).toBe(true);
    expect(canOpen(a, "/home")).toBe(true);
  });
  it("admin pode tudo; viewer não regista invoices", () => {
    expect(canOpen(ADMIN_ACCESS, "/definicoes")).toBe(true);
    const v = member(ROLE_PRESETS.viewer);
    expect(canOpen(v, "/financas")).toBe(false);
    expect(canOpen(v, "/clientes/abc")).toBe(true);
  });
  it("editar implica ver; sem papel não há nada", () => {
    expect(effectivePerms("production", ["customers.edit"])).toEqual(["customers.view", "customers.edit"]);
    expect(effectivePerms("none", ["finance.view"])).toEqual([]);
    expect(cleanPerms(["finance.view", "hack"])).toEqual(["finance.view"]);
  });
});
