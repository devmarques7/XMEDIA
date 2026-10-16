import type { Metadata } from "next";
import { ShareViewer, type PublicDecision } from "./viewer";
import { loadShare } from "@/lib/server/shareAccess";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Media Marques — Proposal", robots: { index: false, follow: false } };

/** Link temporário de uma proposta (público, sem login, expira). Permite aprovar ou recusar. */
export default async function SharedProposal({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const ctx = await loadShare(token, { countView: true }).catch(() => null);
  if (!ctx) return <ShareViewer shared={null} token={token} />;
  const p = ctx.proposal;
  const decision: PublicDecision | null = p?.decision ? { status: p.decision.status, at: p.decision.at, name: p.decision.name, package: p.decision.package, extras: p.decision.extras } : null;
  return (
    <ShareViewer
      token={token}
      shared={{ title: ctx.title, doc: ctx.doc }}
      offer={p?.pricing?.offer ?? null}
      booking={p?.booking ?? null}
      decision={decision}
      client={p ? { name: p.client.name, email: p.client.email } : null}
    />
  );
}
