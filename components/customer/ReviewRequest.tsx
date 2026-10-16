"use client";

// "Pedir revisão" de um conteúdo: envia por email ao responsável (ou a outro endereço) o pedido "Solicito que revise
// este conteúdo", com o material e o link direto. Grava o conteúdo antes, para o link abrir a versão atual.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { ContentPost } from "@/lib/customer";
import { useT } from "@/lib/i18n";
import { supabaseEnabled } from "@/lib/supabase/client";
import { team } from "@/lib/team";

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

export function ReviewRequest({ post, disabled, beforeSend, onDone }: { post: ContentPost; disabled?: boolean; beforeSend: () => Promise<void>; onDone: (msg: string) => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
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
        body: JSON.stringify({ post_id: post.id, to: to.trim(), cc: ccList, message, lang, name: people.find((x) => x.email === to.trim().toLowerCase())?.name }),
      });
      const j = (await r.json().catch(() => ({}))) as { sent?: boolean; reason?: string; link?: string; error?: string };
      if (!r.ok) throw new Error(j.error === "bad_email" ? t("rr.badEmail") : j.error || `HTTP ${r.status}`);
      if (j.sent) {
        onDone(t("rr.sent", { to: to.trim() }));
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
