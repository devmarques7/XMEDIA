"use client";

// Equipa → Convites: quem foi convidado, quem se registou, quem já entrou e quem ficou para trás (convite pendente ou
// caducado). Reenviar o convite por email (com o motivo real se falhar) ou copiar um link novo.
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Avatar } from "./Avatar";
import { INVITE_STATES, INVITE_TONE, inviteState, needsInviteAction, type InviteState } from "@/lib/inviteState";
import { memberApi } from "@/lib/memberApi";
import { useT, type Key } from "@/lib/i18n";
import type { Member } from "@/lib/team";

type Filter = "todo" | InviteState | "all";

export function InviteBadge({ m }: { m: Member }) {
  const { t } = useT();
  const s = inviteState(m);
  return (
    <span className={`label ${INVITE_TONE[s]}`} data-testid="invite-badge">
      ● {t(`tinv.s.${s}` as Key)}
    </span>
  );
}

export function InvitesView({ members, onOpen, onChanged, onToast }: { members: Member[]; onOpen: (id: string) => void; onChanged: () => Promise<void> | void; onToast: (m: string) => void }) {
  const { t, locale } = useT();
  const [filter, setFilter] = useState<Filter>("todo");
  const [busy, setBusy] = useState("");
  const rows = members.map((m) => ({ m, s: inviteState(m) }));
  const count = (f: Filter) => rows.filter((r) => match(r.s, f)).length;
  const shown = rows.filter((r) => match(r.s, filter)).sort((a, b) => INVITE_STATES.indexOf(a.s) - INVITE_STATES.indexOf(b.s) || a.m.name.localeCompare(b.m.name));
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "—");

  async function resend(m: Member, mail: boolean) {
    setBusy(m.id + (mail ? ":mail" : ":link"));
    try {
      const r = await memberApi.invite(m.id, mail);
      if (mail) {
        const why = r.email.reason === "no_provider" ? t("ti.mailFail") : r.email.reason ? t("ti.mailFailWhy", { r: r.email.reason.replace(/^provider_/, "").slice(0, 160) }) : "";
        onToast(r.email.sent ? t("inv.sent", { email: m.email }) : why);
      } else {
        await navigator.clipboard.writeText(r.link).catch(() => {});
        onToast(t("tinv.linkCopied", { name: m.name }));
      }
      await onChanged();
    } catch (e) {
      onToast((e as Error).message);
    }
    setBusy("");
  }

  return (
    <div className="tinv" data-testid="team-invites">
      <div className="tinv-filters" role="group">
        {(["todo", "pending", "expired", "registered", "not_invited", "active", "all"] as Filter[]).map((f) => (
          <button key={f} className={`chip ${filter === f ? "on" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)} data-testid={`tinv-f-${f}`}>
            {t(`tinv.f.${f}` as Key)} <span className="muted">{count(f)}</span>
          </button>
        ))}
      </div>
      {!shown.length && <p className="muted small">{filter === "todo" ? t("tinv.allGood") : t("tinv.none")}</p>}
      <ul className="tinv-list">
        {shown.map(({ m, s }) => (
          <li key={m.id} className="tinv-row" data-testid="tinv-row">
            <button className="tinv-who" onClick={() => onOpen(m.id)}>
              <Avatar name={m.name} photo={m.photo_url} size={34} />
              <span className="tinv-name">
                <b>{m.name}</b>
                <span className="muted small">{m.email || t("inv.needEmail")}</span>
              </span>
            </button>
            <span className={`label ${INVITE_TONE[s]}`}>● {t(`tinv.s.${s}` as Key)}</span>
            <dl className="tinv-dates">
              <div>
                <dt>{t("tinv.d.invited")}</dt>
                <dd>{fmt(m.invited_at)}</dd>
              </div>
              <div>
                <dt>{s === "expired" ? t("tinv.d.expired") : t("tinv.d.expires")}</dt>
                <dd className={s === "expired" ? "tone-danger" : ""}>{s === "pending" || s === "expired" ? fmt(m.invite_expires_at) : "—"}</dd>
              </div>
              <div>
                <dt>{t("tinv.d.registered")}</dt>
                <dd>{fmt(m.registered_at)}</dd>
              </div>
              <div>
                <dt>{t("tinv.d.login")}</dt>
                <dd>{fmt(m.last_login_at)}</dd>
              </div>
            </dl>
            <span className="tinv-act">
              {needsInviteAction(s) && m.email && (
                <>
                  <button className="btn small accent" onClick={() => resend(m, true)} disabled={!!busy} data-testid="tinv-resend">
                    <Icon name="mail" size={13} /> {busy === m.id + ":mail" ? "…" : s === "not_invited" ? t("inv.send") : t("inv.resend")}
                  </button>
                  <button className="btn small ghost" onClick={() => resend(m, false)} disabled={!!busy} title={t("tinv.copyHint")}>
                    <Icon name="link" size={13} /> {t("inv.copy")}
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function match(s: InviteState, f: Filter) {
  if (f === "all") return true;
  if (f === "todo") return needsInviteAction(s);
  return s === f;
}
