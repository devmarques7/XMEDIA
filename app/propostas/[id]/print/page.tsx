"use client";

import { Icon } from "@/components/Icon";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PrintAll } from "@/components/proposal/Deck";
import { useT } from "@/lib/i18n";
import { emptyProposal, normalizeProposal, type Proposal } from "@/lib/proposal";
import { proposalStore } from "@/lib/proposalStore";

/** Abre a janela de impressão com todos os slides (Guardar como PDF). */
export default function PrintProposal() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const [p, setP] = useState<Proposal | null>(null);
  useEffect(() => {
    // ?template=1 → imprime o template MediaMarques (sem dados guardados)
    if (new URLSearchParams(location.search).get("template")) return setP({ ...emptyProposal("MediaMarques — Template") });
    // #data=<base64url JSON> → imprime uma proposta passada no endereço (gerar PDF sem a guardar no browser)
    const h = location.hash.match(/^#data=(.+)$/);
    if (h) {
      try {
        const json = decodeURIComponent(escape(atob(h[1].replace(/-/g, "+").replace(/_/g, "/"))));
        const x = normalizeProposal(JSON.parse(json));
        document.title = x.title;
        return setP(x);
      } catch {
        return;
      }
    }
    proposalStore.get(id).then((x) => {
      setP(x);
      if (x) document.title = x.title;
    });
  }, [id]);
  useEffect(() => {
    if (!p) return;
    // espera pelas fontes e imagens antes de imprimir
    if (new URLSearchParams(location.search).get("noprint")) return;
    const go = () => setTimeout(() => window.print(), 600);
    document.fonts?.ready.then(go) ?? go();
  }, [p]);
  if (!p) return null;
  return (
    <main className="printshell">
      <p className="noprint muted small" style={{ padding: 16 }}>
        {t("pr.printHint")}{" "}
        <button className="btn small" onClick={() => window.print()}>
          <Icon name="download" size={14} /> PDF
        </button>
      </p>
      <PrintAll doc={p.doc} />
    </main>
  );
}
