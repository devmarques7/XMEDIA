"use client";

import { Icon } from "@/components/Icon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Keypad } from "@/components/customer/parts";
import { useErr } from "@/components/customer/PortalChrome";
import { Logo } from "@/components/Logo";
import { useInstall } from "@/components/Pwa";
import { LangSwitch, ThemeToggle } from "@/components/ui";
import { passcodeLogin } from "@/lib/authApi";
import { useT } from "@/lib/i18n";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const LS_EMAIL = "xmedia:login:email";
/** Página para onde voltar depois de entrar (ex.: autorizar o MCP); só caminhos desta app. */
const nextPath = () => {
  const n = new URLSearchParams(location.search).get("next") ?? "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "";
};
const LS_LEN = "xmedia:login:len";
/** Tamanho do código por email (guardado depois de entrar uma vez neste dispositivo). */
const lens = (): Record<string, number> => {
  try {
    const v = JSON.parse(localStorage.getItem(LS_LEN) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};
const lenFor = (email: string) => {
  const l = Number(lens()[email.trim().toLowerCase()]);
  return l >= 4 && l <= 6 ? l : 0;
};

/**
 * Login único (ref. "Create an account"): à esquerda a arte em gradiente, à direita email → código de 4–6
 * dígitos (teclado do iPhone). O servidor decide se é admin, equipa ou cliente. Google fica como alternativa.
 */
export default function Login() {
  const { t, setLang } = useT();
  const tErr = useErr();
  const { canPrompt, install } = useInstall();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  // tamanho do código conhecido neste dispositivo (por email); sem isso aceita 4–6 dígitos sem perguntar
  const [len, setLen] = useState(0);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("error")) setErr(q.get("error") === "not_allowed" ? t("lg.notAllowed") : t("lg.googleFailed"));
    const qe = q.get("email");
    if (qe && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(qe)) {
      setEmail(qe);
      setStep("code");
      return;
    }
    try {
      const e = localStorage.getItem(LS_EMAIL);
      if (e) {
        setEmail(e);
        setStep("code");
        setLen(lenFor(e));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr(t("po.err.bad_email"));
    setErr("");
    setLen(lenFor(email));
    setStep("code");
  }

  async function submit(c = code) {
    if (c.length < 4) return;
    setBusy(true);
    setErr("");
    try {
      const r = await passcodeLogin(email.trim(), c);
      try {
        localStorage.setItem(LS_EMAIL, email.trim().toLowerCase());
        localStorage.setItem(LS_LEN, JSON.stringify({ ...lens(), [email.trim().toLowerCase()]: c.length }));
      } catch {}
      if (r.lang) setLang(r.lang);
      location.href = (r.role === "admin" && nextPath()) || r.to;
    } catch (e) {
      setCode("");
      setErr(tErr(e));
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback${nextPath() ? `?next=${encodeURIComponent(nextPath())}` : ""}`, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setErr("");
    try {
      localStorage.removeItem(LS_EMAIL);
    } catch {}
  }

  return (
    <main className="lg2">
      <aside className="lg2-art" aria-hidden>
        <div className="lg2-grain" />
        <div className="lg2-brand">
          <Logo size={26} color="#fff" />
          <span>XMEDIA</span>
        </div>
        <blockquote className="lg2-quote">
          <p>{t("au.quote")}</p>
          <span>{t("au.who")}</span>
        </blockquote>
      </aside>

      <section className="lg2-main">
        <header className="lg2-top">
          <span className="lg2-mbrand">
            <Logo size={22} /> XMEDIA
          </span>
          <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
            <Link href="/" className="lg2-link">
              {t("au.site")}
            </Link>
            <LangSwitch />
            <ThemeToggle />
          </span>
        </header>

        <div className="lg2-box">
          <h1 className="lg2-title">{t("au.title")}</h1>
          <p className="lg2-sub">{step === "email" ? t("au.sub") : t("au.codeFor", { email })}</p>

          {step === "email" ? (
            <form className="lg2-form" onSubmit={toCode}>
              <input
                className="lg2-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder={t("au.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
                data-testid="login-email"
              />
              <button className="lg2-primary" type="submit">
                {t("au.continue")}
              </button>
            </form>
          ) : (
            <div className="lg2-form">
              <Keypad
                length={len}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  setErr("");
                  if (len && v.length === len) submit(v);
                }}
                onEnter={() => submit()}
                error={shake}
                disabled={busy}
              />
              <button className="lg2-primary" onClick={() => submit()} disabled={busy || code.length < 4}>
                {busy ? t("auth.wait") : t("po.enter")}
              </button>
              <Link className="lg2-ghost" href={`/redefinir?email=${encodeURIComponent(email.trim())}`} data-testid="login-forgot">
                {t("rs.forgot")}
              </Link>
              <button className="lg2-ghost" onClick={changeEmail}>
                <Icon name="back" size={14} /> {t("au.change")}
              </button>
            </div>
          )}

          {err && <p className="lg2-err">{err}</p>}

          <div className="lg2-or">
            <span>{t("au.or")}</span>
          </div>
          {supabaseEnabled ? (
            <button className="lg2-outline" onClick={google} disabled={busy}>
              <GoogleG /> Google
            </button>
          ) : (
            <Link className="lg2-outline" href="/home">
              {t("au.localOpen")} <Icon name="arrow" size={14} />
            </Link>
          )}

          <p className="lg2-legal">{t("au.invite")}</p>
          <p className="lg2-legal">{t("au.legal")}</p>
          {canPrompt && (
            <button className="lg2-ghost" onClick={install}>
              <Icon name="download" size={14} /> {t("login.install")}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
