"use client";

// "Enviar por email": convite para ver a proposta online, no estilo do convite do portal.
// Primeiro mostra a pré-visualização; só envia quando a equipa confirma. Cria um link /v/ novo no envio.
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { useMemo, useState } from "react";
import { useT, type Lang } from "@/lib/i18n";
import type { Proposal } from "@/lib/proposal";
import { proposalEmail } from "@/lib/proposalEmail";
import { supabaseEnabled } from "@/lib/supabase/client";

type Res = { sent: boolean; reason: string | null; link: string; expiresAt: string };

export function EmailPanel({ p, onToast, onSent }: { p: Proposal; onToast: (m: string) => void; onSent: () => void }) {
  const { t, locale } = useT();
  const [to, setTo] = useState(p.client.email);
  const [cc, setCc] = useState("contact@mediamarques.com");
  const [name, setName] = useState(p.client.name || p.client.company);
  const [lang, setLang] = useState<Lang>("en");
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState("");
  const [sender, setSender] = useState("Daniel Marques · MediaMarques");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Res | null>(null);
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim());

  const preview = useMemo(() => {
    const origin = typeof location !== "undefined" ? location.origin : "";
    return proposalEmail({
      lang,
      name: name || to,
      title: p.title,
      link: `${origin}/v/••••••••`,
      linkExpires: new Date(Date.now() + days * 86_400_000),
      origin,
      value: p.value || undefined,
      extras: p.pricing?.lines.filter((l) => l.group === "extra").length || undefined,
      validUntil: p.valid_until || undefined,
      message,
      sender,
    });
  }, [lang, name, to, p, days, message, sender]);

  async function send() {
    if (!confirm(t("pe.confirm", { email: to.trim() + (cc.trim() ? ` (cc ${cc.trim()})` : "") }))) return;
    setBusy(true);
    try {
      const r = await fetch("/api/proposals/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: p.id, to: to.trim(), cc, name, lang, days, message, sender }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `http_${r.status}`);
      setRes(j);
      onToast(j.sent ? t("pe.sent", { email: to.trim() }) : String(j.reason ?? "").startsWith("provider_") ? `Resend: ${j.reason}` : t("pe.notSent"));
      if (j.sent) onSent();
    } catch (e) {
      onToast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="w stack pe" style={{ marginBottom: 14 }}>
      <div className="label">{t("pe.title")}</div>
      <div className="grid4">
        <label className="field">
          <span>{t("pe.name")}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com" data-testid="pe-to" />
        </label>
        <label className="field">
          <span>{t("pe.lang")}</span>
          <Select className="select" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
            <option value="en">English</option>
            <option value="pt">Português</option>
            <option value="nl">Nederlands</option>
          </Select>
        </label>
        <label className="field">
          <span>{t("pr.shareDays")}</span>
          <Select className="select" value={days} onChange={(e) => setDays(+e.target.value)}>
            {[7, 14, 30, 60].map((d) => (
              <option key={d} value={d}>
                {t("pr.days", { n: d })}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label className="field">
        <span>Cc</span>
        <input className="input" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="contact@mediamarques.com" />
      </label>
      <label className="field">
        <span>{t("pe.message")}</span>
        <textarea className="textarea small" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("pe.messagePh")} />
      </label>
      <label className="field">
        <span>{t("pe.sender")}</span>
        <input className="input" value={sender} onChange={(e) => setSender(e.target.value)} />
      </label>
      <div className="small">
        <span className="muted">{t("pu.subject")}:</span> <b>{preview.subject}</b>
      </div>
      <iframe className="pu-frame pe-frame" title="email" srcDoc={preview.html} sandbox="allow-popups" />
      <div className="row">
        <button className="btn accent" onClick={send} disabled={busy || !valid || !supabaseEnabled} data-testid="pe-send">
          <Icon name="mail" size={14} /> {t("pe.send")}
        </button>
        {!valid && <span className="muted small">{t("pe.needEmail")}</span>}
        {!supabaseEnabled && <span className="muted small">{t("pr.shareNeedsSupabase")}</span>}
      </div>
      <span className="muted small">{t("pe.note")}</span>
      {res && (
        <div className="jsonbox stack">
          <span className={`small ${res.sent ? "tone-ok" : "tone-warn"}`}>{res.sent ? t("pe.sent", { email: to.trim() }) : res.reason?.startsWith("provider_") ? `Resend: ${res.reason}` : `${t("pe.notSent")} (${res.reason})`}</span>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <input className="input mono" readOnly value={res.link} onFocus={(e) => e.target.select()} />
            <button
              className="btn"
              onClick={() => {
                navigator.clipboard?.writeText(res.link);
                onToast(t("pr.shareCopied"));
              }}
            >
              {t("pr.shareCopy")}
            </button>
          </div>
          <span className="muted small">{t("pr.shareExpires", { date: new Date(res.expiresAt).toLocaleDateString(locale) })}</span>
        </div>
      )}
    </div>
  );
}
