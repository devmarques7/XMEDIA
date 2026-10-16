import { describe, expect, it } from "vitest";
import { handleRpc } from "./rpc";

const run = async (name: string, args: Record<string, unknown>) => {
  if (name === "get_invoice" && !args.id) throw new Error('falta "id"');
  return JSON.stringify({ name, args });
};

describe("servidor MCP (JSON-RPC)", () => {
  it("initialize negoceia a versão e anuncia ferramentas", async () => {
    const r = await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, run);
    expect(r?.result).toMatchObject({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "xmedia" } });
    const r2 = await handleRpc({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }, run);
    expect((r2?.result as { protocolVersion: string }).protocolVersion).toBe("2025-06-18");
  });
  it("lista invoices e propostas como ferramentas", async () => {
    const r = await handleRpc({ jsonrpc: "2.0", id: 3, method: "tools/list" }, run);
    const names = (r?.result as { tools: { name: string; inputSchema: object }[] }).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["list_invoices", "set_invoice_items", "get_proposal", "update_proposal_slide", "create_proposal"]));
  });
  it("tools/call devolve texto; erros da ferramenta voltam como isError", async () => {
    const ok = await handleRpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_proposals", arguments: { stage: "sent" } } }, run);
    expect(ok?.result).toMatchObject({ isError: false, content: [{ type: "text" }] });
    const bad = await handleRpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_invoice", arguments: {} } }, run);
    expect(bad?.result).toMatchObject({ isError: true, content: [{ text: 'falta "id"' }] });
    const unknown = await handleRpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "rm_rf" } }, run);
    expect(unknown?.error?.code).toBe(-32602);
  });
  it("notificações não têm resposta; métodos desconhecidos dão -32601", async () => {
    expect(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }, run)).toBeNull();
    expect((await handleRpc({ jsonrpc: "2.0", id: 7, method: "resources/list" }, run))?.error?.code).toBe(-32601);
  });
});
