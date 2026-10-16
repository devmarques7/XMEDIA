// Links temporários de proposta (/v/<token>): cópia do documento no momento da partilha.
import { randomToken } from "@/lib/codes";
import { normalizeDoc, type ProposalDoc } from "@/lib/proposal";
import { hashToken, serviceClient } from "./admin";

export async function createShare(o: { proposalId: string; ownerId: string; title: string; doc: ProposalDoc; days: number; origin: string }) {
  const days = Math.min(90, Math.max(1, Math.floor(Number(o.days) || 7)));
  const token = randomToken(24);
  const expires = new Date(Date.now() + days * 86_400_000);
  const { error } = await serviceClient()
    .from("proposal_shares")
    .insert({ proposal_id: o.proposalId, owner_id: o.ownerId, token_hash: await hashToken(`share:${token}`), title: o.title, doc: normalizeDoc(o.doc), expires_at: expires.toISOString() });
  if (error) throw error;
  return { url: `${o.origin}/v/${token}`, expiresAt: expires.toISOString() };
}
