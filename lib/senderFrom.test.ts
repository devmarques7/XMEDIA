import { describe, expect, it } from "vitest";
import { senderFrom } from "./inviteEmail";

describe("senderFrom (remetente Resend)", () => {
  it("vazio → remetente por omissão", () => expect(senderFrom("")).toBe("MediaMarques <contact@mediamarques.com>"));
  it("só o nome → nome com o endereço por omissão", () => expect(senderFrom("MediaMarques Studio")).toBe("MediaMarques Studio <contact@mediamarques.com>"));
  it("Nome <email> fica igual", () => expect(senderFrom("XMEDIA <convites@mediamarques.com>")).toBe("XMEDIA <convites@mediamarques.com>"));
  it("só o email fica igual", () => expect(senderFrom("convites@mediamarques.com")).toBe("convites@mediamarques.com"));
  it("aspas e < > soltos são limpos", () => expect(senderFrom('"MediaMarques" <')).toBe("MediaMarques <contact@mediamarques.com>"));
});
