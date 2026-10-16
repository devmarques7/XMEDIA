import { describe, expect, it } from "vitest";
import { inviteEmail } from "./inviteEmail";
import { codeHint, maskEmail, newSerialCode, normalizeCode, signSession, verifySession } from "./codes";

describe("códigos de série", () => {
  it("gera códigos no formato XM-XXXXX-XXXXX, únicos", () => {
    const codes = new Set(Array.from({ length: 500 }, newSerialCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^XM-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  });
  it("aceita o código escrito de forma desleixada", () => {
    const c = newSerialCode();
    expect(normalizeCode(c.toLowerCase().replace(/-/g, " "))).toBe(c);
    expect(normalizeCode("xm-abcde-fghjk")).toBe("XM-ABCDE-FGHJK");
    expect(normalizeCode("XM-0O1IL-22222")).toBe("XM-00111-22222");
    expect(normalizeCode("XM-123")).toBeNull();
    expect(codeHint("XM-ABCDE-FGHJK")).toBe("••••-GHJK");
  });
  it("sessão assinada: válida, adulterada, expirada", async () => {
    const v = await signSession("member-1", "segredo");
    expect(await verifySession(v, "segredo")).toBe("member-1");
    expect(await verifySession(v, "outro")).toBeNull();
    expect(await verifySession(v.replace("member-1", "member-2"), "segredo")).toBeNull();
    expect(await verifySession(await signSession("m", "segredo", -1), "segredo")).toBeNull();
  });
  it("mascara o email", () => {
    expect(maskEmail("daniel@mediamarques.com")).toBe("da••••@mediamarques.com");
  });
  it("email de convite nas três línguas, com link e escape de HTML", () => {
    const base = { name: "Ana <b>", inviter: "Daniel", link: "https://x.app/convite/abc", expiresAt: new Date("2026-10-14"), logoUrl: "https://x.app/pwa-icon/128" };
    expect(inviteEmail({ ...base, lang: "pt" }).subject).toBe("Daniel convidou-o para a equipa XMEDIA");
    expect(inviteEmail({ ...base, lang: "en" }).subject).toBe("Daniel invited you to the XMEDIA team");
    expect(inviteEmail({ ...base, lang: "nl" }).html).toContain("Uitnodiging accepteren");
    const pt = inviteEmail({ ...base, lang: "pt" });
    expect(pt.html).toContain("Ana &lt;b&gt;");
    expect(pt.text).toContain(base.link);
  });
});
