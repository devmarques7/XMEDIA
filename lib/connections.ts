// Ligações do assistente a aplicações externas por MCP (Canva, Notion, servidores próprios…). Guardadas em
// app_settings.data.connections (sem SQL). Os tokens vão cifrados com VAULT_KEY e nunca saem do servidor:
// o browser só vê a forma pública (PublicConnection).
import type { Cipher } from "./vault";

export type ConnAuth = "oauth" | "token" | "none";

export type Connection = {
  id: string;
  /** nome curto usado pelo Claude para identificar o servidor (a-z, 0-9, -) */
  name: string;
  label: string;
  url: string;
  preset?: string;
  auth: ConnAuth;
  enabled: boolean;
  created_at: string;
  /** cifrado: { access, refresh?, expires_at?, client_id?, client_secret?, token_endpoint? } */
  secret?: Cipher;
  connected_at?: string;
  error?: string;
};

export type PublicConnection = Omit<Connection, "secret"> & { connected: boolean };

export type Preset = { id: string; label: string; url: string; auth: ConnAuth; hint: string };

/** Só servidores com endereço oficial confirmado; os restantes entram como "personalizado" (URL do próprio serviço). */
export const PRESETS: Preset[] = [
  { id: "canva", label: "Canva", url: "https://mcp.canva.com/mcp", auth: "oauth", hint: "designs, exportar, marca" },
  { id: "notion", label: "Notion", url: "https://mcp.notion.com/mcp", auth: "oauth", hint: "páginas, bases de dados" },
];

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "mcp";

/** Endereço aceite: https (ou http://localhost em desenvolvimento), sem credenciais no URL. */
export function validUrl(u: string) {
  try {
    const x = new URL(u.trim());
    if (x.username || x.password) return false;
    return x.protocol === "https:" || (x.protocol === "http:" && ["localhost", "127.0.0.1"].includes(x.hostname));
  } catch {
    return false;
  }
}

export function normalizeConnections(v: unknown): Connection[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is Connection => !!c && typeof c === "object" && typeof (c as Connection).id === "string" && typeof (c as Connection).url === "string")
    .map((c) => ({ ...c, name: slug(c.name || c.label), auth: (["oauth", "token", "none"] as const).includes(c.auth) ? c.auth : "oauth", enabled: c.enabled !== false }));
}

export const publicConnection = ({ secret, ...c }: Connection): PublicConnection => ({ ...c, connected: c.auth === "none" || !!secret });
