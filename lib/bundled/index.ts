// Propostas incluídas na app: são criadas/atualizadas diretamente no sistema (sem SQL) quando a equipa abre as Propostas.
// Só substituem a versão guardada se esta for de uma versão anterior do conteúdo (bundle_version) — edições feitas na app ficam.
import type { Proposal } from "../proposal";
import boatEvent from "./boat-event.json";

export const BUNDLED_PROPOSALS: Proposal[] = [boatEvent as unknown as Proposal];

/** Decide se a proposta incluída deve ser (re)escrita sobre a guardada. */
export const needsBundle = (saved: { bundle_version?: number; decision?: unknown } | null | undefined, bundled: Proposal) =>
  !saved || (!saved.decision && (saved.bundle_version ?? 0) < (bundled.bundle_version ?? 0)); // nunca apaga uma decisão do cliente

/**
 * Links digitais incluídos (já enviados a clientes): só o hash do token fica no código. Na primeira visita o link
 * é registado em proposal_shares (e a proposta criada, se ainda não existir) — funciona sem ninguém abrir a app antes.
 */
export const BUNDLED_SHARES: { proposal_id: string; token_hash: string; expires_at: string }[] = [
  { proposal_id: "6f1c2a3e-8b4d-4f5a-9c7e-2d1b0a9e8f71", token_hash: "096fe6c5a3a572223aaab8aa59cdcebfac9f2d8e69abb4bcdef0eaec5e5f60b3", expires_at: "2026-12-31T23:59:59Z" },
];

/**
 * Invoices incluídas na app: Q4 - #0047 (re-emitida com a morada completa), Q4 - #0051 (morada corrigida) e as invoices
 * de 2026 importadas do Notion (Finance › Invoices), com categoria, PDF original e cliente. Substituem a invoice com o mesmo número.
 * Gerado por scripts/invoices-2026.ts a partir de data/invoices-2026.json.
 */
import sanctum0047 from "./invoice-sanctum-0047.json";
import invoices2026 from "./invoices-2026.json";
import customers2026 from "./customers-2026.json";
import type { Invoice } from "../invoice";
import type { Customer } from "../customer";
export const BUNDLED_INVOICES: Invoice[] = [sanctum0047 as unknown as Invoice, ...(invoices2026 as unknown as Invoice[])];
export const needsInvoiceBundle = (saved: { bundle_version?: number } | null | undefined, bundled: Invoice) => !saved || (saved.bundle_version ?? 0) < (bundled.bundle_version ?? 0);

/** Clientes das invoices (dados de faturação). `match` = nomes/emails para encontrar o cliente que já existe na app. */
export type BundledCustomer = Customer & { match: string[] };
export const BUNDLED_CUSTOMERS = customers2026 as unknown as BundledCustomer[];
const key = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9@.]/gi, "").toLowerCase();
/** Encontra o cliente já guardado que corresponde ao incluído (id, nome, alias ou email). */
export function matchCustomer<T extends { id: string; name: string; email: string }>(saved: T[], b: BundledCustomer): T | undefined {
  const keys = new Set(b.match.map(key).filter(Boolean));
  return saved.find((c) => c.id === b.id) ?? saved.find((c) => keys.has(key(c.name))) ?? saved.find((c) => !!c.email && keys.has(key(c.email)));
}
/** Junta os dados de faturação ao cliente existente sem mexer em fase, portal, Instagram ou plano. */
export function mergeBundledCustomer(saved: Customer | undefined, b: BundledCustomer): Customer | null {
  const { match: _m, ...doc } = b;
  if (!saved) return doc;
  if ((saved.bundle_version ?? 0) >= (b.bundle_version ?? 0)) return null;
  return {
    ...saved,
    contact: saved.contact || doc.contact,
    email: saved.email || doc.email,
    billing: { ...doc.billing!, ...Object.fromEntries(Object.entries(saved.billing ?? {}).filter(([, v]) => v)) } as Customer["billing"],
    notes: saved.notes ? (saved.notes.includes("Notion (Finance") ? saved.notes : `${saved.notes}\n${doc.notes}`) : doc.notes,
    bundle_version: b.bundle_version,
  };
}
