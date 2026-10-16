"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { EntryFrame, useErr } from "@/components/customer/PortalChrome";
import { Keypad } from "@/components/customer/parts";
import { useT } from "@/lib/i18n";
import { portalApi, portalLocal, readWho, rememberWho, type Who } from "@/lib/portalApi";

export default function Page() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

/**
 * Entrada do cliente: como o ecrã de bloqueio do iPhone — se o dispositivo já é conhecido, pede só o código.
 * O código tem 4, 5 ou 6 dígitos: num dispositivo conhecido entra sozinho ao completar; senão usa o botão Entrar.
 */
function Login() {
  const { t } = useT();
  const tErr = useErr();
  const router = useRouter();
  const urlErr = useSearchParams().get("error");
  const [who, setWho] = useState<Who | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");

  useEffect(() => {
    setWho(readWho());
    if (urlErr) setMsg(tErr(new Error(urlErr)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(c = code) {
    const e = who?.email || email;
    if (!e || c.length < 4) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await portalApi.login(e, c);
      rememberWho({ name: r.name, email: e, len: c.length });
      router.replace("/portal");
    } catch (err) {
      setCode("");
      setMsg(tErr(err));
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setBusy(false);
    }
  }

  async function google() {
    setMsg("");
    try {
      await portalApi.google(googleEmail || who?.email);
      if (portalLocal) router.replace("/portal");
    } catch (e) {
      setMsg(tErr(e));
    }
  }

  return (
    <EntryFrame>
      <span className="label muted">{t("po.loginTitle")}</span>
      <h1 className="login-name" style={{ fontSize: "clamp(32px, 9vw, 56px)" }}>
        {who ? who.name : "MediaMarques"}
      </h1>
      {!who && (
        <input
          className="input po-email"
          type="email"
          placeholder={t("po.emailPh")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
        />
      )}
      <Keypad
        length={who?.len ?? 0}
        value={code}
        onChange={(v) => {
          setCode(v);
          setMsg("");
          if (who?.len && v.length === who.len) submit(v);
        }}
        onEnter={() => submit()}
        error={shake}
        disabled={busy}
      />
      <div className="login-actions">
        <button className="btn solid" onClick={() => submit()} disabled={busy || code.length < 4 || !(who?.email || email)}>
          {busy ? "…" : t("po.enter")}
        </button>
        {portalLocal && <input className="input" type="email" placeholder={t("po.localEmail")} value={googleEmail} onChange={(e) => setGoogleEmail(e.target.value)} />}
        <a className="btn ghost" href={`/redefinir?email=${encodeURIComponent(who?.email || email)}`} data-testid="portal-forgot">
          {t("rs.forgot")}
        </a>
        <button className="btn ghost" onClick={google}>
          {t("po.withGoogle")}
        </button>
        {who && (
          <button
            className="btn ghost small"
            onClick={() => {
              rememberWho(null);
              setWho(null);
            }}
          >
            {t("po.notYou", { name: who.name })}
          </button>
        )}
      </div>
      {msg && <p className="note tone-danger">{msg}</p>}
    </EntryFrame>
  );
}
