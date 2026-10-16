"use client";

// Convite rápido (admin) a partir do cliente: 1) quem · 2) que acesso · 3) enviar o email ou copiar o link.
// A pessoa abre o link, entra com o Google e fica com acesso ao portal — o mesmo fluxo do portal (Conta → Membros).
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { CUSTOMER_USER_ROLES, type Customer, type CustomerUser, type CustomerUserRole } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { portalApi, type InviteResult } from "@/lib/portalApi";

export function InviteDialog({ customer, onClose, onDone }: { customer: Customer; onClose: () => void; onDone?: (msg: string) => void }) {
  const { t, locale } = useT();
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [step, setStep] = useState(1);
  const [name, setName] = useState(customer.portal.status === "none" ? customer.contact : "");
  const [email, setEmail] = useState(customer.portal.status === "none" ? customer.email : "");
  const [role, setRole] = useState<CustomerUserRole>(customer.portal.status === "none" ? "owner" : "member");
  const [res, setRes] = useState<{ email: string; invite: InviteResult } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    portalApi.users(customer.id).then(setUsers).catch(() => {});
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [customer.id, onClose]);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function finish(send: boolean) {
    if (send && !confirm(t("pu.sendConfirm", { email: email.trim() }))) return;
    setBusy(true);
    setErr("");
    try {
      const e = email.trim().toLowerCase();
      let u = users.find((x) => x.email === e);
      if (!u) {
        const list = await portalApi.saveUser(customer.id, { name: name.trim(), email: e, role });
        u = list.find((x) => x.email === e);
        setUsers(list);
      } else if (u.role !== role) await portalApi.saveUser(customer.id, { id: u.id, name: name.trim() || u.name, email: e, role });
      if (!u) throw new Error("not_found");
      const invite = await portalApi.invite(customer.id, u.id, send);
      setRes({ email: e, invite });
      setStep(4);
      onDone?.(invite.email.sent ? t("cu.inviteSent", { email: e }) : t("tm.done"));
      portalApi.users(customer.id).then(setUsers).catch(() => {});
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog stack iv" role="dialog" aria-modal="true" aria-label={t("iv.title")}>
        <div className="row between">
          <span>
            <span className="tile-t muted">{customer.name}</span>
            <b style={{ display: "block", fontSize: 18 }}>{t("iv.title")}</b>
          </span>
          <button className="btn ghost" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {t("iv.how")}
        </p>
        <ol className="tmw-steps">
          {(["tm.step1", "tm.step2", "tm.step3"] as const).map((k, i) => (
            <li key={k} className={step > i + 1 ? "done" : step === i + 1 ? "now" : ""}>
              <span className="mono">{i + 1}</span> {t(k)}
            </li>
          ))}
        </ol>
        {step === 1 && (
          <>
            <label className="field">
              <span>{t("fb.name")}</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus data-testid="iv-name" />
            </label>
            <label className="field">
              <span>{t("fb.email")}</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="iv-email" />
            </label>
            <button className="btn accent" style={{ alignSelf: "flex-end" }} onClick={() => setStep(2)} disabled={!valid} data-testid="iv-next">
              {t("tm.next")} <Icon name="next" size={14} />
            </button>
          </>
        )}
        {step === 2 && (
          <>
            {CUSTOMER_USER_ROLES.map((r) => (
              <label key={r} className={`tmw-role ${role === r ? "on" : ""}`}>
                <input type="radio" name="iv-role" checked={role === r} onChange={() => setRole(r)} />
                <span>
                  <b>{t(`pu.role.${r}` as Key)}</b>
                  <span className="muted small" style={{ display: "block" }}>
                    {t(`pu.roleHint.${r}` as Key)}
                  </span>
                </span>
              </label>
            ))}
            <div className="row between">
              <button className="btn ghost" onClick={() => setStep(1)}>
                <Icon name="back" size={14} /> {t("tm.back")}
              </button>
              <button className="btn accent" onClick={() => setStep(3)} data-testid="iv-next2">
                {t("tm.next")} <Icon name="next" size={14} />
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="statrow">
              <span>
                <b>{name || email}</b>
                <span className="muted small" style={{ display: "block" }}>
                  {email}
                </span>
              </span>
              <span className="label" style={{ marginLeft: "auto" }}>
                {t(`pu.role.${role}` as Key)}
              </span>
            </div>
            {err && <p className="note tone-danger small">{err}</p>}
            <div className="row between">
              <button className="btn ghost" onClick={() => setStep(2)}>
                <Icon name="back" size={14} /> {t("tm.back")}
              </button>
              <span className="row" style={{ gap: 6 }}>
                <button className="btn" onClick={() => finish(false)} disabled={busy} data-testid="iv-link">
                  {t("tm.linkOnly")}
                </button>
                <button className="btn accent" onClick={() => finish(true)} disabled={busy}>
                  <Icon name="mail" size={14} /> {t("tm.send")}
                </button>
              </span>
            </div>
          </>
        )}
        {step === 4 && res && (
          <>
            <b><Icon name="check" size={14} /> {t("tm.done")}</b>
            <p className="small" style={{ margin: 0 }}>
              {res.invite.email.sent ? t("tm.doneSent", { email: res.email }) : t("tm.doneLink", { email: res.email })}
            </p>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input className="input mono small" readOnly value={res.invite.link} onFocus={(e) => e.target.select()} data-testid="iv-linkval" />
              <button className="btn small" onClick={() => navigator.clipboard?.writeText(res.invite.link)}>
                {t("fb.copy")}
              </button>
            </div>
            <button
              className="btn ghost"
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                setStep(1);
                setName("");
                setEmail("");
                setRole("member");
                setRes(null);
              }}
            >
              + {t("iv.cta")}
            </button>
          </>
        )}
        {users.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            <span className="tile-t muted">{t("iv.people")}</span>
            {users.map((u) => (
              <div key={u.id} className="statrow small">
                <span>{u.name || u.email}</span>
                <span className="muted">{u.email}</span>
                <span className={`label ${u.status === "active" ? "tone-ok" : "tone-warn"}`} style={{ marginLeft: "auto" }}>
                  {t(`pu.role.${u.role}` as Key)} · {t(`pu.status.${u.status}` as Key)}
                </span>
                {u.last_login_at && <span className="mono muted">{new Date(u.last_login_at).toLocaleDateString(locale)}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
