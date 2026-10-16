"use client";

// "Enviar por email" de uma invoice: gera o mesmo PDF do botão PDF, envia-o em anexo a partir de invoices@… (Resend)
// e a invoice passa a "enviada" com o envio registado.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Invoice } from "@/lib/invoice";
import { useT, type Lang } from "@/lib/i18n";
import { invoiceBlob, invoiceFileName } from "@/lib/invoicePdf";
import { supabaseEnabled } from "@/lib/supabase/client";

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

const toBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

export function SendInvoice({ inv, onSent, align = "right", className = "btn", autoOpen = false }: { inv: Invoice; onSent: (msg: string) => void; align?: "left" | "right"; className?: string; autoOpen?: boolean }) {
  const { t } = useT();
  const [open, setOpen] = useState(autoOpen);
  const [from, setFrom] = useState("");
  const [configured, setConfigured] = useState(true);
  const [to, setTo] = useState(inv.client.email ?? "");
  const [cc, setCc] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setTo((x) => x || inv.client.email || "");
    setErr("");
    fetch("/api/invoices/send")
      .then((r) => r.json())
      .then((j: { from?: string; configured?: boolean }) => {
        setFrom(j.from ?? "");
        setConfigured(j.configured !== false);
      })
      .catch(() => {});
  }, [open, inv.client.email]);

  if (!supabaseEnabled) return null; // o envio precisa do servidor (Resend)

  const ccList = cc.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  const valid = EMAIL.test(to.trim()) && ccList.every((x) => EMAIL.test(x)) && !inv.void;
  const file = invoiceFileName(inv);

  async function send() {
    setBusy(true);
    setErr("");
    try {
      const pdf = await toBase64(await invoiceBlob(inv));
      const r = await fetch("/api/invoices/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inv.id, to: to.trim(), cc: ccList, lang, message, pdf, filename: file, name: inv.client.name }),
      });
      const j = (await r.json().catch(() => ({}))) as { sent?: boolean; reason?: string; from?: string; error?: string };
      if (!r.ok) throw new Error(j.error === "bad_email" ? t("fin.sendBadEmail") : j.error === "void" ? t("fin.sendVoid") : j.error || `HTTP ${r.status}`);
      if (!j.sent) throw new Error(t("fin.sendFail", { r: j.reason === "no_provider" ? t("fin.sendNoKey") : String(j.reason ?? "") }));
      onSent(t("fin.sent", { number: inv.number, to: to.trim(), from: j.from ?? from }));
      setOpen(false);
      setMessage("");
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <span className="rr-wrap" onClick={(e) => e.stopPropagation()}>
      <button className={className} onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={inv.void} data-testid="inv-send">
        <Icon name="send" size={14} /> {t("fin.send")}
      </button>
      {open && (
        <div className={`rr-pop rr-down ${align === "left" ? "rr-left" : ""}`} role="dialog" aria-label={t("fin.sendTitle")} data-testid="inv-send-pop">
          <b>{t("fin.sendTitle")}</b>
          <p className="muted small" style={{ margin: 0 }}>
            {t("fin.sendFrom")}: <span className="mono">{from || "invoices@mediamarques.com"}</span>
          </p>
          {!configured && <p className="note tone-warn" style={{ margin: 0 }}>{t("fin.sendNoKey")}</p>}
          <label className="small">
            {t("fin.sendTo")}
            <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="finance@client.com" autoFocus data-testid="inv-send-to" />
          </label>
          <label className="small">
            {t("fin.sendCc")}
            <input className="input" value={cc} onChange={(e) => setCc(e.target.value)} />
          </label>
          <label className="small">
            {t("fin.sendLang")}
            <span className="seg" role="group">
              {(["en", "pt", "nl"] as Lang[]).map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </span>
          </label>
          <label className="small">
            {t("fin.sendMsg")}
            <textarea className="textarea" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("fin.sendMsgPh")} />
          </label>
          <span className="muted small">
            <Icon name="page" size={12} /> {t("fin.sendAttach", { file })}
          </span>
          {err && <p className="note tone-danger" style={{ margin: 0 }}>{err}</p>}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              {t("fin.sendCancel")}
            </button>
            <button className="btn accent" disabled={!valid || busy || !configured} onClick={send} data-testid="inv-send-go">
              {busy ? "…" : t("fin.sendGo")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
