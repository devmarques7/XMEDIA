// Acesso público a uma proposta pelo link /v/<token>: lê o link (ou regista um link incluído na app), a proposta e a decisão.
import { BUNDLED_PROPOSALS, BUNDLED_SHARES, needsBundle } from "@/lib/bundled";
import { normalizeDoc, normalizeProposal, type Proposal, type ProposalDoc } from "@/lib/proposal";
import { hashToken, serviceClient } from "./admin";
import { ownerId } from "./owner";

export type ShareCtx = { shareId: string; ownerId: string; title: string; doc: ProposalDoc; proposal: Proposal | null; expiresAt: string };
export const TOKEN_RE = /^[\w-]{20,80}$/;

type Row = { id: string; proposal_id: string; owner_id: string; title: string; doc: ProposalDoc; expires_at: string; revoked: boolean; views: number };

/** Regista na base de dados um link incluído na app (e a proposta, se ainda não existir). */
async function materialize(hash: string): Promise<Row | null> {
  const b = BUNDLED_SHARES.find((x) => x.token_hash === hash);
  if (!b || new Date(b.expires_at) < new Date()) return null;
  const bundled = BUNDLED_PROPOSALS.find((p) => p.id === b.proposal_id);
  if (!bundled) return null;
  const db = serviceClient();
  const owner = await ownerId();
  const { data: existing } = await db.from("proposals").select("id, owner_id, data").eq("id", bundled.id).maybeSingle();
  if (!existing) {
    const { id, created_at: _c, updated_at: _u, ...data } = bundled;
    await db.from("proposals").insert({ id, owner_id: owner, title: bundled.title, client_name: bundled.client.company || bundled.client.name, value: bundled.value, currency: bundled.currency, stage: bundled.stage, data });
  }
  const doc = existing ? normalizeDoc(existing.data.doc) : bundled.doc;
  const { data, error } = await db
    .from("proposal_shares")
    .insert({ proposal_id: bundled.id, owner_id: existing?.owner_id ?? owner, token_hash: hash, title: bundled.title, doc, expires_at: b.expires_at })
    .select("id, proposal_id, owner_id, title, doc, expires_at, revoked, views")
    .single();
  return error ? null : (data as Row);
}

export async function loadShare(token: string, opts: { countView?: boolean } = {}): Promise<ShareCtx | null> {
  if (!TOKEN_RE.test(token)) return null;
  const db = serviceClient();
  const hash = await hashToken(`share:${token}`);
  let { data: row } = await db.from("proposal_shares").select("id, proposal_id, owner_id, title, doc, expires_at, revoked, views").eq("token_hash", hash).maybeSingle();
  if (!row) row = await materialize(hash);
  if (!row || row.revoked || new Date(row.expires_at) < new Date()) return null;
  if (opts.countView) await db.from("proposal_shares").update({ views: (row.views ?? 0) + 1, last_view_at: new Date().toISOString() }).eq("id", row.id);
  let { data: p } = await db.from("proposals").select("id, data, created_at, updated_at").eq("id", row.proposal_id).maybeSingle();
  // proposta incluída com versão nova (ex.: destinatário corrigido): atualiza, sem nunca apagar uma decisão
  const bundled = BUNDLED_PROPOSALS.find((x) => x.id === row!.proposal_id);
  if (p && bundled && needsBundle(p.data, bundled)) {
    const { id, created_at: _c, updated_at: _u, ...data } = bundled;
    await db.from("proposals").update({ title: bundled.title, client_name: bundled.client.company || bundled.client.name, value: bundled.value, data }).eq("id", id);
    p = { ...p, data };
  }
  // link incluído na app: mostra sempre o documento atual da proposta (igual ao PDF), não a cópia do 1.º acesso
  let doc = normalizeDoc(row.doc);
  if (p && BUNDLED_SHARES.some((b) => b.token_hash === hash) && JSON.stringify(row.doc) !== JSON.stringify(p.data.doc)) {
    doc = normalizeDoc(p.data.doc);
    await db.from("proposal_shares").update({ doc, title: p.data.title ?? row.title }).eq("id", row.id);
  }
  return {
    shareId: row.id,
    ownerId: row.owner_id,
    title: row.title,
    doc,
    proposal: p ? normalizeProposal({ ...p.data, id: p.id }) : null,
    expiresAt: row.expires_at,
  };
}
