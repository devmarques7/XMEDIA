"use client";

// "Pedir revisão" de um conteúdo: envia por email ao responsável (ou a outro endereço) o pedido de revisão, com o material
// e o link certo (equipa → app; cliente → portal, com o onboarding do convite se ainda não tiver acesso). Língua do
// email à escolha, inglês por omissão. Grava o conteúdo antes, para o link abrir a versão atual.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ContentPost } from "@/lib/customer";
import { useT, type Lang } from "@/lib/i18n";
import { supabaseEnabled } from "@/lib/supabase/client";
import { team } from "@/lib/team";

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

export function ReviewRequest({ post, disabled, beforeSend, onDone }: { post: ContentPost; disabled?: boolean; beforeSend: () => Promise<void>; onDone: (msg: string) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [mailLang, setMailLang] = useState<Lang>("en");
  const [to, setTo] = useState(post.assignee ?? "");
  const [cc, setCc] = useState("");
  const [message, setMessage] = useState("");
  const [people, setPeople] = useState<{ email: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    if (!open) return;
    setTo((x) => x || post.assignee || "");
    team
      .members()
      .then((ms) => setPeople(ms.filter((m) => m.email).map((m) => ({ email: m.email.toLowerCase(), name: m.name }))))
      .catch(() => {});
  }, [open, post.assignee]);

  if (!supabaseEnabled) return null; // o envio de email precisa do servidor

  const ccList = cc.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const valid = EMAIL.test(to.trim()) && ccList.every((x) => EMAIL.test(x));

  async function send() {
    setBusy(true);
    setErr("");
    setLink("");
    try {
      await beforeSend();
      const r = await fetch("/api/content/review-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: post.id, to: to.trim(), cc: ccList, message, lang: mailLang, name: people.find((x) => x.email === to.trim().toLowerCase())?.name }),
      });
      const j = (await r.json().catch(() => ({}))) as { sent?: boolean; reason?: string; link?: string; error?: string; mode?: string };
      if (!r.ok) throw new Error(j.error === "bad_email" ? t("rr.badEmail") : j.error === "portal_disabled" || j.error === "user_disabled" ? t("rr.portalOff") : j.error || `HTTP ${r.status}`);
      if (j.sent) {
        onDone(t(j.mode === "onboarding" ? "rr.sentOnb" : j.mode === "portal" ? "rr.sentPortal" : "rr.sent", { to: to.trim() }));
        setOpen(false);
        setMessage("");
      } else {
        setErr(t("rr.notSent", { r: j.reason === "no_provider" ? t("rr.noProvider") : String(j.reason ?? "") }));
        setLink(j.link ?? "");
      }
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      <button className="btn" disabled={disabled || busy} onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="pe-ask-review">
        <Icon name="send" size={14} /> {t("rr.button")}
      </button>
      {open && (
        <div className="rr-pop" role="dialog" aria-label={t("rr.button")} data-testid="rr-pop">
          <b>{t("rr.title")}</b>
          <p className="muted small" style={{ margin: 0 }}>
            {t("rr.body")} · <i>{post.title || t(`ct.type.${post.type}` as never)}</i>
          </p>
          <label className="small">
            {t("rr.to")}
            <input className="input" type="email" list="rr-people" value={to} onChange={(e) => setTo(e.target.value)} placeholder="nome@exemplo.com" autoFocus data-testid="rr-to" />
          </label>
          {!post.assignee && <span className="muted small">{t("rr.noAssignee")}</span>}
          {EMAIL.test(to.trim()) && (
            <span className="muted small" data-testid="rr-path">
              {people.some((x) => x.email === to.trim().toLowerCase()) ? t("rr.pathTeam") : t("rr.pathClient")}
            </span>
          )}
          <datalist id="rr-people">
            {people.map((x) => (
              <option key={x.email} value={x.email}>
                {x.name}
              </option>
            ))}
          </datalist>
          <label className="small">
            {t("rr.cc")}
            <input className="input" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="opcional@exemplo.com" data-testid="rr-cc" />
          </label>
          <label className="small">
            {t("rr.message")}
            <textarea className="textarea" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("rr.messagePh")} data-testid="rr-message" />
          </label>
          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <span className="small">{t("rr.lang")}</span>
            <div className="seg" role="group" aria-label={t("rr.lang")}>
              {(["en", "pt", "nl"] as Lang[]).map((l) => (
                <button key={l} type="button" className={mailLang === l ? "on" : ""} aria-pressed={mailLang === l} onClick={() => setMailLang(l)} data-testid={`rr-lang-${l}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="note tone-danger" style={{ margin: 0 }}>{err}</p>}
          {link && (
            <input className="input mono small" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="link" />
          )}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              {t("rr.cancel")}
            </button>
            <button className="btn accent" disabled={!valid || busy} onClick={send} data-testid="rr-send">
              {busy ? "…" : t("rr.send")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
