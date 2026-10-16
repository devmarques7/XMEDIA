"use client";

// Definições → Assistente IA: por omissão só o administrador usa o assistente. Aqui autoriza-se cada pessoa da equipa
// (permissão "ai.use", verificada também no servidor). Só pessoas com acesso à plataforma podem ser autorizadas.
import { useEffect, useState } from "react";
import { Avatar } from "@/components/team/Avatar";
import { useT } from "@/lib/i18n";
import { supabaseEnabled } from "@/lib/supabase/client";
import { team, type Member } from "@/lib/team";

export function AiAccessPanel({ onToast }: { onToast: (m: string) => void }) {
  const { t } = useT();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    team.members().then(setMembers).catch(() => setMembers([]));
  }, []);
  if (!supabaseEnabled) return <p className="muted small">{t("aia.local")}</p>;

  async function toggle(m: Member, on: boolean) {
    setBusy(m.id);
    try {
      const app_permissions = on ? [...new Set([...m.app_permissions, "ai.use" as const])] : m.app_permissions.filter((p) => p !== "ai.use");
      const saved = await team.saveMember({ ...m, app_permissions });
      setMembers((l) => (l ?? []).map((x) => (x.id === m.id ? { ...x, ...saved, app_permissions } : x)));
      onToast(on ? t("aia.granted", { name: m.name }) : t("aia.revoked", { name: m.name }));
    } catch (e) {
      onToast((e as Error).message);
    }
    setBusy("");
  }

  const list = (members ?? []).filter((m) => m.status !== "disabled");
  return (
    <div className="aia" data-testid="ai-access">
      <p className="muted small" style={{ margin: 0 }}>
        {t("aia.sub")}
      </p>
      <div className="aia-row me">
        <span className="aia-ic" aria-hidden>
          ✦
        </span>
        <span className="aia-who">
          <b>{t("aia.admin")}</b>
          <span className="muted small">{t("aia.adminHint")}</span>
        </span>
        <span className="label tone-ok">{t("aia.always")}</span>
      </div>
      {members === null && <p className="muted small">…</p>}
      {members && !list.length && <p className="muted small">{t("aia.none")}</p>}
      {list.map((m) => {
        const platform = m.active && m.status === "active" && m.app_role !== "none";
        const on = platform && m.app_permissions.includes("ai.use");
        return (
          <label key={m.id} className={`aia-row ${platform ? "" : "off"}`} data-testid="aia-member">
            <Avatar name={m.name} photo={m.photo_url || undefined} size={30} />
            <span className="aia-who">
              <b>{m.name}</b>
              <span className="muted small">{platform ? `${m.email} · ${t(`rl.role.${m.app_role}` as never)}` : t("aia.noPlatform")}</span>
            </span>
            <span className="aia-switch">
              <input type="checkbox" role="switch" checked={on} disabled={!platform || busy === m.id} onChange={(e) => toggle(m, e.target.checked)} aria-label={t("aia.allow", { name: m.name })} data-testid="aia-toggle" />
              <span className="small">{on ? t("aia.on") : t("aia.off")}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
