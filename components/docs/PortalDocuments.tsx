"use client";

// Portal do cliente · Documentos: o que tem para assinar (em destaque), todos os documentos partilhados e o que o
// cliente carregou. Carregar por drag & drop; assinar abre a página de assinatura com um link novo.
import { useCallback, useEffect, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { Icon } from "@/components/Icon";
import { activeSigners, statusOf, type Doc } from "@/lib/documents";
import { docApi, docLocal } from "@/lib/docApi";
import { useT, type Key } from "@/lib/i18n";
import { resolveMedia } from "@/lib/media";

export function PortalDocuments({ email, readOnly, onToast }: { email: string; readOnly: boolean; onToast: (m: string) => void }) {
  const { t, locale } = useT();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [tab, setTab] = useState<"sign" | "all" | "mine">("all");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => docApi.portalList().then(setDocs).catch((e) => (onToast((e as Error).message), setDocs([]))), [onToast]);
  useEffect(() => void load(), [load]);

  const toSign = (docs ?? []).filter((d) => activeSigners(d).some((r) => r.email.toLowerCase() === email.toLowerCase()));
  useEffect(() => {
    if (toSign.length) setTab("sign");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs?.length]);
  const list = tab === "sign" ? toSign : tab === "mine" ? (docs ?? []).filter((d) => d.uploaded_by === "client") : docs ?? [];

  async function open(d: Doc, which: "original" | "signed" = "original") {
    const url = docApi.portalFileUrl(d, which);
    window.open(docLocal ? await resolveMedia(url) : url, "_blank", "noopener");
  }
  async function sign(d: Doc) {
    try {
      location.href = await docApi.portalSignLink(d.id);
    } catch (e) {
      onToast((e as Error).message);
    }
  }

  return (
    <section className="pdocs">
      <nav className="td-tabs" role="tablist">
        {(["sign", "all", "mine"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(`pd.tab.${k}` as Key)} <span className="mono">{k === "sign" ? toSign.length : k === "mine" ? (docs ?? []).filter((d) => d.uploaded_by === "client").length : docs?.length ?? 0}</span>
          </button>
        ))}
      </nav>
      {!readOnly && (
        <DropZone
          target="document"
          busy={busy}
          onFiles={async (files) => {
            setBusy(true);
            try {
              for (const f of files) await docApi.portalUpload(f, "");
              onToast(t("dd.uploaded", { n: files.length }));
              await load();
            } catch (e) {
              onToast((e as Error).message);
            }
            setBusy(false);
          }}
          testId="pd-drop"
        />
      )}
      {docs && !list.length && <p className="muted small">{tab === "sign" ? t("pd.nothingToSign") : t("dd.empty")}</p>}
      <div className="dh-grid">
        {list.map((d) => {
          const s = statusOf(d);
          const mine = toSign.includes(d);
          return (
            <article key={d.id} className={`dh-card s-${s} ${mine ? "todo" : ""}`} data-testid="pd-card">
              <div className="dh-card-b">
                <span className="dh-ic">
                  <Icon name={d.recipients.length ? "edit" : "page"} size={22} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <b className="dh-title">{d.title}</b>
                  <span className="muted small">
                    {new Date(d.updated_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })} · {d.uploaded_by === "client" ? t("dd.fromYou") : "MediaMarques"}
                  </span>
                </span>
              </div>
              <footer className="dh-card-f">
                <span className={`dh-st s-${s}`}>{t(`dd.s.${s}` as Key)}</span>
                <span className="dh-acts">
                  {mine && !readOnly && (
                    <button className="btn small accent" onClick={() => sign(d)} data-testid="pd-sign">
                      <Icon name="edit" size={13} /> {t("pd.sign")}
                    </button>
                  )}
                  <button className="iconbtn" onClick={() => open(d)} aria-label={t("dd.open")}>
                    <Icon name="eye" size={15} />
                  </button>
                  {d.signed && (
                    <button className="iconbtn" onClick={() => open(d, "signed")} aria-label={t("dd.signedPdf")}>
                      <Icon name="download" size={15} />
                    </button>
                  )}
                </span>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
