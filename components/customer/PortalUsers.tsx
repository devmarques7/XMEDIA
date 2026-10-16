"use client";

// "Portal & acesso" na ficha do cliente: várias pessoas do cliente, cada uma com papel, estado e convite.
// Gerar o convite NÃO envia nada: mostra o link e a pré-visualização do email. Enviar é um passo à parte.
import { Select } from "@/components/Select";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { CUSTOMER_USER_ROLES, type Customer, type CustomerUser, type CustomerUserRole } from "@/lib/customer";
import { useT, type Key } from "@/lib/i18n";
import { portalApi, type IntegrationStatus, type InviteResult } from "@/lib/portalApi";
import { useErr } from "./PortalChrome";

export function PortalUsers({ customer: c, onChanged, onToast }: { customer: Customer; onChanged: () => Promise<void> | void; onToast: (m: string) => void }) {
  const { t, locale } = useT();
  const tErr = useErr();
  const [users, setUsers] = useState<CustomerUser[] | null>(null);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [invites, setInvites] = useState<Record<string, InviteResult>>({});
  const [preview, setPreview] = useState<{ html?: string; src?: string; subject?: string; to: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "", role: "member" as CustomerUserRole });

  const load = useCallback(async () => {
    try {
      setUsers(await portalApi.users(c.id));
    } catch (e) {
      onToast(tErr(e));
      setUsers([]);
    }
  }, [c.id, onToast, tErr]);
  useEffect(() => {
    load();
    portalApi.status().then(setStatus).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  const run = async (key: string, f: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await f();
      await onChanged();
    } catch (e) {
      onToast(tErr(e));
    }
    setBusy(null);
  };
  const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : t("cu.never"));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    run("add", async () => {
      setUsers(await portalApi.saveUser(c.id, draft));
      setDraft({ name: "", email: "", role: "member" });
    });
  };
  const invite = (u: CustomerUser) =>
    run(`inv:${u.id}`, async () => {
      const r = await portalApi.invite(c.id, u.id, false);
      setInvites((m) => ({ ...m, [u.id]: r }));
      await load();
    });
  const send = (u: CustomerUser) => {
    if (!confirm(t("pu.sendConfirm", { email: u.email }))) return;
    run(`send:${u.id}`, async () => {
      const r = await portalApi.invite(c.id, u.id, true);
      setInvites((m) => ({ ...m, [u.id]: r }));
      onToast(r.email.sent ? t("cu.inviteSent", { email: u.email }) : t("pu.notSent", { reason: r.email.reason ?? "" }));
      await load();
    });
  };
  const showPreview = (u: CustomerUser) => {
    const inv = invites[u.id];
    if (inv?.preview) return setPreview({ html: inv.preview.html, subject: inv.preview.subject, to: inv.preview.to });
    const q = new URLSearchParams({ name: u.name || u.email, customer: c.name, email: u.email, lang: c.lang, ...(inv ? { link: inv.link } : {}) });
    setPreview({ src: `/api/email/preview?${q}`, to: u.email });
  };

  return (
    <section className="w span-7 stack">
      <div className="row between">
        <span className="label muted">{t("pu.title")}</span>
        <span className={`label ${c.portal.status === "active" ? "tone-ok" : c.portal.status === "disabled" ? "tone-danger" : "tone-warn"}`}>{t(`cu.portal.${c.portal.status}` as Key)}</span>
      </div>
      <p className="muted small">{t("pu.flow")}</p>

      {users?.length === 0 && <p className="muted">{t("pu.empty")}</p>}
      <ul className="pu-list">
        {(users ?? []).map((u) => {
          const inv = invites[u.id];
          return (
            <li key={u.id} className="pu-user">
              <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                <span style={{ minWidth: 0 }}>
                  <b>{u.name || u.email}</b>
                  <span className="muted small" style={{ display: "block", overflowWrap: "anywhere" }}>
                    {u.email}
                  </span>
                  <span className="muted small">
                    {u.status === "active" ? `${u.passcode_set ? t("pu.codeSet") : t("pu.noCode")} · ${t("cu.lastLogin")}: ${date(u.last_login_at)}` : u.invite_expires_at ? t("pu.inviteUntil", { date: date(u.invite_expires_at) }) : ""}
                  </span>
                </span>
                <span className={`label ${u.status === "active" ? "tone-ok" : u.status === "disabled" ? "tone-danger" : "tone-warn"}`}>{t(`pu.status.${u.status}` as Key)}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Select
                  className="select statussel"
                  value={u.role}
                  onChange={(e) => run(`role:${u.id}`, async () => setUsers(await portalApi.saveUser(c.id, { id: u.id, name: u.name, email: u.email, role: e.target.value as CustomerUserRole })))}
                  aria-label={t("pu.role")}
                >
                  {CUSTOMER_USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`pu.role.${r}` as Key)}
                    </option>
                  ))}
                </Select>
                {u.status !== "disabled" && (
                  <button className="btn small" onClick={() => invite(u)} disabled={!!busy}>
                    <Icon name="page" size={14} /> {u.status === "active" ? t("cu.reinvite") : t("cu.invite")}
                  </button>
                )}
                <button className="btn small ghost" onClick={() => showPreview(u)}>
                  <Icon name="eye" size={14} /> {t("pu.preview")}
                </button>
                {u.passcode_set && (
                  <button className="btn small ghost" onClick={() => confirm(t("cu.resetConfirm")) && run(`reset:${u.id}`, () => portalApi.access(c.id, "reset", u.id).then(load))}>
                    {t("cu.resetPasscode")}
                  </button>
                )}
                <button
                  className="btn small ghost"
                  onClick={() => run(`dis:${u.id}`, () => portalApi.access(c.id, u.status === "disabled" ? "enable" : "disable", u.id).then(load))}
                >
                  {u.status === "disabled" ? t("pu.enable") : t("pu.disable")}
                </button>
                <button
                  className="btn small ghost danger"
                  onClick={() => confirm(t("pu.removeConfirm", { name: u.name || u.email })) && run(`rm:${u.id}`, async () => setUsers(await portalApi.removeUser(c.id, u.id)))}
                  aria-label={t("remove")}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
              <span className="muted small">{t(`pu.roleHint.${u.role}` as Key)}</span>
              {inv && (
                <div className="jsonbox stack">
                  <div className="label muted">{t("pu.linkFor", { name: u.name || u.email, date: date(inv.expiresAt) })}</div>
                  <code className="mono small" style={{ display: "block", wordBreak: "break-all" }}>
                    {inv.link}
                  </code>
                  <div className="row">
                    <button
                      className="btn small"
                      onClick={async () => {
                        await navigator.clipboard.writeText(inv.link).catch(() => {});
                        onToast(t("cu.copied"));
                      }}
                    >
                      <Icon name="copy" size={14} /> {t("cu.copy")}
                    </button>
                    <button className="btn small accent" onClick={() => send(u)} disabled={!!busy || !status?.email} title={status?.email ? "" : t("pu.needsKey")}>
                      <Icon name="mail" size={14} /> {t("pu.send")}
                    </button>
                    <span className={`small ${inv.email.sent ? "tone-ok" : "muted"}`}>{inv.email.sent ? t("cu.inviteSent", { email: u.email }) : status?.email ? t("pu.notSentYet") : t("pu.needsKey")}</span>
                  </div>
                  <span className="muted small">{t("pu.regenWarn")}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form className="pu-add" onSubmit={add}>
        <span className="label muted">+ {t("pu.add")}</span>
        <div className="grid2">
          <input className="input" placeholder={t("pu.name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          <input className="input" type="email" placeholder={t("cu.email")} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required />
        </div>
        <div className="row">
          <Select className="select statussel" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as CustomerUserRole })} aria-label={t("pu.role")}>
            {CUSTOMER_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`pu.role.${r}` as Key)}
              </option>
            ))}
          </Select>
          <button className="btn accent" type="submit" disabled={busy === "add"}>
            + {t("pu.add")}
          </button>
        </div>
      </form>

      <div className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        {c.portal.status === "disabled" ? (
          <button className="btn small" onClick={() => run("all", () => portalApi.access(c.id, "enable"))}>
            {t("pu.unblockAll")}
          </button>
        ) : (
          <button className="btn small ghost danger" onClick={() => confirm(t("pu.blockAllConfirm")) && run("all", () => portalApi.access(c.id, "disable"))}>
            {t("pu.blockAll")}
          </button>
        )}
      </div>

      {preview && (
        <div className="overlay ov-top" onMouseDown={(e) => e.target === e.currentTarget && setPreview(null)}>
          <div className="dialog pu-preview" role="dialog" aria-modal="true">
            <header className="row between">
              <span className="stack" style={{ gap: 2 }}>
                <span className="label muted">{t("pu.preview")} · {t("pu.notSentYet")}</span>
                <span className="small">
                  {t("pu.to")}: <b>{preview.to}</b>
                  {preview.subject && (
                    <>
                      {" "}
                      · {t("pu.subject")}: <b>{preview.subject}</b>
                    </>
                  )}
                </span>
              </span>
              <button className="btn ghost" onClick={() => setPreview(null)} aria-label={t("ct.close")}>
                <Icon name="close" />
              </button>
            </header>
            <iframe className="pu-frame" title="email" {...(preview.html ? { srcDoc: preview.html } : { src: preview.src })} sandbox="allow-popups" />
          </div>
        </div>
      )}
    </section>
  );
}
