import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { checkAuthRequest, exchange, issueCode, ownerFromAccessToken, registerClient, validRedirect } from "./mcpOAuth";

beforeAll(() => {
  process.env.MCP_OAUTH_SECRET = "teste-segredo-oauth-xmedia-123456";
});

const verifier = "v".repeat(50);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const CB = "https://claude.ai/api/mcp/auth_callback";

function authorize() {
  const { client_id } = registerClient({ redirect_uris: [CB], client_name: "Claude" });
  const req = checkAuthRequest({ response_type: "code", client_id, redirect_uri: CB, code_challenge: challenge, code_challenge_method: "S256", state: "s1" });
  return { client_id, code: issueCode(req, "owner-1") };
}

describe("MCP OAuth", () => {
  it("redirects: https ou localhost", () => {
    expect(validRedirect(CB)).toBe(true);
    expect(validRedirect("http://localhost:33418/callback")).toBe(true);
    expect(validRedirect("http://evil.com/cb")).toBe(false);
    expect(() => registerClient({ redirect_uris: ["http://evil.com/cb"] })).toThrow(/redirect_uris/);
  });

  it("pedido de autorização valida cliente, redirect e PKCE", () => {
    const { client_id } = registerClient({ redirect_uris: [CB] });
    expect(() => checkAuthRequest({ response_type: "code", client_id, redirect_uri: "https://outro.com/cb", code_challenge: challenge, code_challenge_method: "S256" })).toThrow(/não registado/);
    expect(() => checkAuthRequest({ response_type: "code", client_id, redirect_uri: CB, code_challenge: challenge, code_challenge_method: "plain" })).toThrow(/PKCE/);
    expect(() => checkAuthRequest({ response_type: "code", client_id: client_id + "x", redirect_uri: CB, code_challenge: challenge, code_challenge_method: "S256" })).toThrow(/client_id/);
  });

  it("código + verifier certo → token de acesso com o dono", async () => {
    const { client_id, code } = authorize();
    const t = await exchange(new URLSearchParams({ grant_type: "authorization_code", client_id, code, redirect_uri: CB, code_verifier: verifier }));
    expect(t.token_type).toBe("Bearer");
    expect(ownerFromAccessToken(t.access_token)).toBe("owner-1");
    expect(ownerFromAccessToken(t.refresh_token)).toBeNull(); // refresh não serve de acesso
  });

  it("verifier errado, outro cliente ou outro redirect → recusado", async () => {
    const { client_id, code } = authorize();
    await expect(exchange(new URLSearchParams({ grant_type: "authorization_code", client_id, code, redirect_uri: CB, code_verifier: "errado".repeat(8) }))).rejects.toThrow(/PKCE/);
    const other = registerClient({ redirect_uris: [CB] }).client_id;
    await expect(exchange(new URLSearchParams({ grant_type: "authorization_code", client_id: other, code, redirect_uri: CB, code_verifier: verifier }))).rejects.toThrow(/código/);
    await expect(exchange(new URLSearchParams({ grant_type: "authorization_code", client_id, code, redirect_uri: "https://claude.ai/x", code_verifier: verifier }))).rejects.toThrow(/redirect_uri/);
  });

  it("token adulterado ou com outro segredo → inválido", async () => {
    const { client_id, code } = authorize();
    const t = await exchange(new URLSearchParams({ grant_type: "authorization_code", client_id, code, redirect_uri: CB, code_verifier: verifier }));
    const [k, body, sig] = t.access_token.split(".");
    const forged = Buffer.from(JSON.stringify({ o: "intruso", exp: 9e9 })).toString("base64url");
    expect(ownerFromAccessToken(`${k}.${forged}.${sig}`)).toBeNull();
    process.env.MCP_OAUTH_SECRET = "outro-segredo-xmedia-oauth-987654";
    expect(ownerFromAccessToken(`${k}.${body}.${sig}`)).toBeNull();
    process.env.MCP_OAUTH_SECRET = "teste-segredo-oauth-xmedia-123456";
  });
});
