import { describe, expect, it } from "vitest";
import { splitActions } from "../lib/ai/actions";

describe("splitActions", () => {
  it("tira a linha de ações do texto e devolve os botões", () => {
    const r = splitActions("Invoice criada.\n\n[[ações: Enviar ao cliente | Criar proposta | Ver por pagar]]");
    expect(r.text).toBe("Invoice criada.");
    expect(r.actions).toEqual(["Enviar ao cliente", "Criar proposta", "Ver por pagar"]);
  });
  it("aceite em inglês/neerlandês e sem acento; no máximo 4", () => {
    expect(splitActions("ok [[actions: a | b]]").actions).toEqual(["a", "b"]);
    expect(splitActions("ok [[acties: a|b|c|d|e]]").actions).toHaveLength(4);
    expect(splitActions("ok [[acoes: x]]").actions).toEqual(["x"]);
  });
  it("sem linha de ações: texto intacto", () => {
    expect(splitActions("Olá [[nota]] fim")).toEqual({ text: "Olá [[nota]] fim", actions: [] });
  });
});
