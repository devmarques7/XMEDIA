"use client";

// Esqueci o código: pede o email e envia um link para escolher um código novo. Mesmo layout do login.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthSplit } from "@/components/AuthSplit";
import { Icon } from "@/components/Icon";
import { useErr } from "@/components/customer/PortalChrome";
import { useT } from "@/lib/i18n";
import { resetApi } from "@/lib/resetApi";

export default function Page() {
  return (
    <Suspense>
      <ResetRequest />
    </Suspense>
  );
}

function ResetRequest() {
  const { t, lang } = useT();
  const tErr = useErr();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [local, setLocal] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => setEmail(sp.get("email") ?? ""), [sp]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr(t("po.err.bad_email"));
    setBusy(true);
    setErr("");
    try {
      const r = await resetApi.request(email, lang);
      setLocal(r.localLink);
      setSent(true);
    } catch (x) {
      setErr(tErr(x));
    }
    setBusy(false);
  }

  return (
    <AuthSplit top={t("rs.top")}>
      <span className="lg2-kicker">XMEDIA</span>
      <h1 className="lg2-title">{sent ? t("rs.sentTitle") : t("rs.title")}</h1>
      <p className="lg2-sub">{sent ? t("rs.sentSub", { email: email.trim() }) : t("rs.sub")}</p>
      {!sent ? (
        <form className="lg2-form" onSubmit={submit}>
          <input className="lg2-input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder={t("au.email")} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required data-testid="rs-email" />
          <button className="lg2-primary" type="submit" disabled={busy} data-testid="rs-send">
            {busy ? "…" : t("rs.send")}
          </button>
        </form>
      ) : (
        <>
          {local && (
            <a className="lg2-outline" href={local} data-testid="rs-local-link">
              {t("rs.localLink")} <Icon name="arrow" size={14} />
            </a>
          )}
          <button className="lg2-ghost" onClick={() => setSent(false)}>
            {t("rs.again")}
          </button>
        </>
      )}
      {err && <p className="lg2-err">{err}</p>}
      <Link className="lg2-ghost" href="/login">
        <Icon name="back" size={14} /> {t("rs.back")}
      </Link>
    </AuthSplit>
  );
}
