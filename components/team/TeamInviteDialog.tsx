"use client";

// Convidar alguém para a equipa XMEDIA em 2 passos: (1) email + acesso à plataforma → (2) link pronto a copiar.
// A pessoa completa nome, função, foto e código no link; o admin só define o valor/hora depois.
import { supabaseEnabled } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useT, type Key, type Lang } from "@/lib/i18n";
import { memberApi, type InviteResult } from "@/lib/memberApi";
import { PERMS, ROLE_PRESETS, type AppRole, type Perm } from "@/lib/roles";
import { emptyMember, team, type Member } from "@/lib/team";

type Level = "admin" | AppRole;
const LEVELS: { k: Level; icon: "lock" | "briefcase" | "film" | "eye" | "clock" }[] = [
  { k: "admin", icon: "lock" },
  { k: "manager", icon: "briefcase" },
  { k: "production", icon: "film" },
  { k: "viewer", icon: "eye" },
  { k: "none", icon: "clock" },
];
const access = (l: Level): { app_role: AppRole; app_permissions: Perm[]; access: Member["access"] } =>
  l === "admin" ? { app_role: "manager", app_permissions: [...PERMS], access: "admin" } : { app_role: l, app_permissions: ROLE_PRESETS[l], access: "member" };

export function TeamInviteDialog({ onClose, onDone }: { onClose: () => void; onDone: (m: Member) => void }) {
  const { t, lang: myLang } = useT();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<Level>("production");
  const [lang, setLang] = useState<Lang>(myLang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [res, setRes] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  // por omissão o convite sai logo por email (antes só criava o link e era preciso um 2.º clique)
  const [mailNow, setMailNow] = useState(supabaseEnabled);
  /** Motivo real quando o email não sai (ex.: domínio recusado pela Resend), em vez de uma mensagem genérica. */
  const why = (r?: string) => (!r || r === "no_provider" ? t("ti.mailFail") : r === "local_mode" ? t("inv.reason.local_mode") : t("ti.mailFailWhy", { r: r.replace(/^provider_/, "").slice(0, 180) }));

  useEffect(() => {
    first.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function create() {
    if (!ok) return;
    setBusy(true);
    setErr("");
    try {
      const e = email.trim().toLowerCase();
      const existing = (await team.members()).find((m) => m.email.toLowerCase() === e);
      const local = e.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const m = await team.saveMember({ ...(existing ?? emptyMember()), id: existing?.id, name: existing?.name || local, email: e, lang, active: true, ...access(level) });
      const r = await memberApi.invite(m.id, mailNow);
      setMember(m);
      setRes(r);
      if (mailNow && !r.email.sent) setErr(why(r.email.reason));
      setStep(2);
      onDone(m);
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  }
  async function copy() {
    if (!res) return;
    try {
      await navigator.clipboard.writeText(res.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  async function sendMail() {
    if (!member) return;
    setBusy(true);
    try {
      const r = await memberApi.invite(member.id, true);
      setRes(r);
      setErr(r.email.sent ? "" : why(r.email.reason));
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog ti" role="dialog" aria-modal="true" aria-label={t("ti.title")}>
        <header className="row between">
          <span className="ti-steps mono small">
            <b className={step === 1 ? "on" : ""}>01 {t("ti.s1")}</b>
            <i />
            <b className={step === 2 ? "on" : ""}>02 {t("ti.s2")}</b>
          </span>
          <button className="btn ghost" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </header>

        {step === 1 && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <h2 className="ti-h">{t("ti.title")}</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {t("ti.sub")}
            </p>
            <label className="field">
              <span>{t("cu.email")}</span>
              <input ref={first} className="input big" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" data-testid="ti-email" />
            </label>
            <div className="field">
              <span>{t("ti.access")}</span>
              <div className="ti-levels" role="radiogroup">
                {LEVELS.map(({ k, icon }) => (
                  <button type="button" key={k} role="radio" aria-checked={level === k} className={`ti-level ${level === k ? "on" : ""}`} onClick={() => setLevel(k)} data-testid={`ti-level-${k}`}>
                    <Icon name={icon} size={16} />
                    <b>{t(`ti.level.${k}` as Key)}</b>
                    <span className="muted small">{t(`ti.levelHint.${k}` as Key)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="row between">
              <div className="seg" role="group" aria-label={t("cu.lang")}>
                {(["pt", "en", "nl"] as Lang[]).map((l) => (
                  <button type="button" key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <button className="btn accent" disabled={!ok || busy} data-testid="ti-create">
                <Icon name={mailNow ? "mail" : "link"} size={14} /> {busy ? "…" : mailNow ? t("ti.createSend") : t("ti.create")}
              </button>
            </div>
            {supabaseEnabled && (
              <label className="row small" style={{ gap: 8 }}>
                <input type="checkbox" checked={mailNow} onChange={(e) => setMailNow(e.target.checked)} data-testid="ti-mailnow" /> {t("ti.mailNow")}
              </label>
            )}
            {err && <p className="tone-danger small">{err}</p>}
          </form>
        )}

        {step === 2 && res && member && (
          <div className="stack">
            <h2 className="ti-h" data-testid="ti-result">{res.email.sent ? t("ti.sentTitle") : t("ti.ready")}</h2>
            <p className="muted small" style={{ margin: 0 }}>
              {res.email.sent ? t("ti.sentSub", { email: member.email }) : t("ti.readySub", { email: member.email })}
            </p>
            <button className="codechip ti-link" onClick={copy} data-testid="ti-link">
              {res.link}
            </button>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn accent" onClick={copy}>
                <Icon name={copied ? "check" : "copy"} size={14} /> {copied ? t("inv.copied") : t("inv.copy")}
              </button>
              <button className="btn" onClick={sendMail} disabled={busy}>
                <Icon name="mail" size={14} /> {res.email.sent ? t("inv.sent", { email: member.email }) : t("ti.sendMail")}
              </button>
              <a className="btn ghost" href={`https://wa.me/?text=${encodeURIComponent(t("inv.mailBody", { name: "", link: res.link }))}`} target="_blank" rel="noreferrer">
                <Icon name="send" size={14} /> {t("inv.whatsapp")}
              </a>
            </div>
            <ol className="ti-next small">
              <li>{t("ti.next1")}</li>
              <li>{t("ti.next2")}</li>
              <li>{t("ti.next3")}</li>
            </ol>
            {err && <p className="tone-warn small" data-testid="ti-err">{err}</p>}
            <div className="row between">
              <button
                className="btn ghost"
                onClick={() => {
                  setStep(1);
                  setEmail("");
                  setRes(null);
                  setMember(null);
                }}
              >
                + {t("ti.another")}
              </button>
              <button className="btn" onClick={onClose}>
                {t("ti.done")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
