"use client";

// Histórico de versões de um item (conteúdo, invoice, proposta, cliente…): lista as versões guardadas a cada alteração
// e restaura qualquer uma (a versão atual também fica guardada, por isso dá para voltar atrás outra vez).
import { History } from "lucide-react";
import { useState } from "react";
import { journal, type Entity, type Version } from "@/lib/journal";
import { useT, type Key } from "@/lib/i18n";

export function VersionHistory({ entity, id, className = "btn ghost small" }: { entity: Entity; id: string; className?: string }) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Version[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  async function show() {
    setOpen((o) => !o);
    if (open) return;
    setErr("");
    try {
      setList(await journal.versions(entity, id));
    } catch (e) {
      setErr(/relation|does not exist|schema cache/i.test((e as Error).message) ? t("un.noTable") : (e as Error).message);
      setList([]);
    }
  }
  async function restore(v: Version) {
    setBusy(v.id);
    try {
      await journal.restore(v);
      try {
        sessionStorage.setItem("xmedia:undo:msg", t("un.restored", { when: new Date(v.created_at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) }));
      } catch {}
      location.reload();
    } catch (e) {
      setErr((e as Error).message);
      setBusy("");
    }
  }

  return (
    <span className="vh" data-testid="vh">
      <button className={className} onClick={show} aria-expanded={open} data-testid="vh-btn">
        <History size={14} /> {t("un.history")}
      </button>
      {open && (
        <div className="vh-pop" role="dialog" aria-label={t("un.history")}>
          <b>{t("un.history")}</b>
          <span className="muted small">{t("un.historyHint")}</span>
          {list === null && <span className="muted small">…</span>}
          {err && <p className="tone-danger small" style={{ margin: 0 }}>{err}</p>}
          {list && !list.length && !err && <span className="muted small">{t("un.noVersions")}</span>}
          <ol className="vh-list">
            {(list ?? []).map((v) => (
              <li key={v.id} data-testid="vh-item">
                <span className="vh-when mono small">{new Date(v.created_at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="vh-what small">
                  {t(`un.op.${v.op}` as Key)}
                  {v.by_email && <span className="muted"> · {v.by_email.split("@")[0]}</span>}
                </span>
                {v.snapshot ? (
                  <button className="btn small" onClick={() => restore(v)} disabled={!!busy} data-testid="vh-restore">
                    {busy === v.id ? "…" : t("un.restore")}
                  </button>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </span>
  );
}
