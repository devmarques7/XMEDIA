"use client";

// Página Histórico → "Alterações recentes": tudo o que foi alterado na app (quem, quando, o quê), com ligação ao item,
// onde está o botão Histórico para restaurar uma versão.
import Link from "next/link";
import { useEffect, useState } from "react";
import { journal, type Version } from "@/lib/journal";
import { useT, type Key } from "@/lib/i18n";

const hrefOf = (v: Version) =>
  v.entity === "invoice" ? `/financas/${v.entity_id}` : v.entity === "proposal" ? `/propostas/${v.entity_id}` : v.entity === "customer" ? `/clientes/${v.entity_id}` : v.entity === "post" && v.customer_id ? `/clientes/${v.customer_id}?tab=content&post=${v.entity_id}` : v.entity === "service" ? "/servicos" : "/definicoes";

export function RecentChanges() {
  const { t, locale } = useT();
  const [list, setList] = useState<Version[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    journal
      .recent(150)
      .then(setList)
      .catch((e) => (setErr(/relation|does not exist|schema cache/i.test(e.message) ? t("un.noTable") : e.message), setList([])));
  }, [t]);
  return (
    <section className="w stack" data-testid="recent-changes">
      <span className="label muted">{t("un.recent")}</span>
      <span className="muted small">{t("un.recentHint")}</span>
      {err && <p className="tone-warn small">{err}</p>}
      {list === null && <span className="muted small">…</span>}
      {list && !list.length && !err && <span className="muted small">{t("un.noVersions")}</span>}
      <ol className="rc-list">
        {(list ?? []).map((v) => (
          <li key={v.id}>
            <span className="mono small muted">{new Date(v.created_at).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            <span className="label">{t(`un.e.${v.entity}` as Key)}</span>
            <Link href={hrefOf(v)} className="rc-t">
              {v.label || "—"}
            </Link>
            <span className="small muted">
              {t(`un.op.${v.op}` as Key)}
              {v.by_email && ` · ${v.by_email.split("@")[0]}`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
