"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthSplit } from "@/components/AuthSplit";
import { CreatePasscode } from "@/components/customer/CreatePasscode";
import { OnboardSteps, type ObStep } from "@/components/customer/OnboardSteps";
import { useErr } from "@/components/customer/PortalChrome";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";
import { ApiError, portalApi, rememberWho, type PortalData } from "@/lib/portalApi";

export default function Page() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}

/**
 * Onboarding depois do convite (mesma moldura de duas colunas): o passo é decidido pelo estado DA PESSOA
 * (código já criado? email validado?), nunca por um resumo do cliente — assim o código nunca é pedido duas vezes.
 * Código → Email (Google, opcional mas recomendado) → Instagram (só o responsável, opcional) → portal.
 * Com ?change=1 só troca o código.
 */
function Welcome() {
  const { t } = useT();
  const tErr = useErr();
  const router = useRouter();
  const sp = useSearchParams();
  const change = sp.get("change") === "1";
  const [data, setData] = useState<PortalData | null>(null);
  const [step, setStep] = useState<ObStep | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const next = (d: PortalData, from?: ObStep): ObStep | "done" => {
    if (!d.me.passcode_set && from !== "code") return "code";
    if (!d.me.email_verified && from !== "email" && from !== "ig") return "email";
    if (d.me.role === "owner" && !d.customer.instagram.handle && from !== "ig") return "ig";
    return "done";
  };
  const go = (d: PortalData, from?: ObStep) => {
    const s = next(d, from);
    if (s === "done") router.replace("/portal");
    else setStep(s);
  };

  useEffect(() => {
    portalApi
      .me()
      .then((d) => {
        setData(d);
        setHandle(d.customer.instagram.handle);
        if (change) setStep("code");
        else if (sp.get("step") === "ig") setStep("ig");
        else go(d);
      })
      .catch((e) => (e instanceof ApiError && e.message === "unauthorized" ? router.replace("/portal/login") : setMsg(tErr(e))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function google() {
    setBusy(true);
    setMsg("");
    try {
      await portalApi.linkGoogle();
      // remoto: o browser segue para o Google e volta a /portal/bem-vindo?verified=1; local: já ficou validado
      const d = await portalApi.me();
      setData(d);
      if (d.me.email_verified) go(d, "email");
    } catch (e) {
      setMsg(tErr(e));
    }
    setBusy(false);
  }
  async function saveHandle() {
    setBusy(true);
    try {
      if (handle.trim()) await portalApi.setHandle(handle);
      router.replace("/portal");
    } catch (e) {
      setMsg(tErr(e));
      setBusy(false);
    }
  }

  const c = data?.customer;
  const top = c ? `${t("po.inviteTitle")} · ${c.name}` : t("po.inviteTitle");
  const done: ObStep[] = data ? [...(data.me.passcode_set ? (["code"] as ObStep[]) : []), ...(data.me.email_verified ? (["email"] as ObStep[]) : [])] : [];

  return (
    <AuthSplit top={top}>
      {!data || !step ? (
        <p className="muted">{msg || "…"}</p>
      ) : step === "code" ? (
        <>
          {!change && <OnboardSteps step="code" done={done} />}
          <CreatePasscode
            onDone={async (code) => {
              try {
                await portalApi.setPasscode(code);
              } catch (e) {
                throw new Error(tErr(e));
              }
              rememberWho({ name: data.customer.name, email: data.me.email, len: code.length });
              if (change) return router.replace("/portal?tab=account&saved=passcode");
              const d = { ...data, me: { ...data.me, passcode_set: true } };
              setData(d);
              go(d, "code");
            }}
          />
        </>
      ) : step === "email" ? (
        <>
          <OnboardSteps step="email" done={done} />
          <span className="lg2-kicker">{c!.name}</span>
          <h1 className="lg2-title">{t("ob.emailTitle")}</h1>
          <p className="lg2-sub">{t("ob.emailSub")}</p>
          <input className="lg2-input" value={data.me.email} readOnly aria-label="email" />
          <button className="lg2-primary" onClick={google} disabled={busy} data-testid="ob-google">
            {busy ? "…" : t("po.continueGoogle")}
          </button>
          <button className="lg2-link" onClick={() => go(data, "email")} style={{ marginTop: 12 }} data-testid="ob-skip">
            {t("po.skip")} <Icon name="next" size={14} />
          </button>
        </>
      ) : (
        <>
          <OnboardSteps step="ig" done={done} />
          <span className="lg2-kicker">{c!.name}</span>
          <h1 className="lg2-title">{t("po.igTitle")}</h1>
          <p className="lg2-sub">{t("po.igHint")}</p>
          <label className="lg2-handle">
            <span>@</span>
            <input className="lg2-input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="instagram" autoCapitalize="none" autoCorrect="off" spellCheck={false} data-testid="ob-handle" />
          </label>
          <button className="lg2-primary" onClick={saveHandle} disabled={busy || !handle.trim()}>
            {t("po.save")}
          </button>
          {data.info.igConnect && (
            <a className="lg2-outline" href="/api/portal/instagram/connect">
              <Icon name="instagram" size={16} /> {t("mt.connect")}
            </a>
          )}
          <button className="lg2-link" onClick={() => router.replace("/portal")} style={{ marginTop: 12 }}>
            {t("po.skip")} <Icon name="next" size={14} />
          </button>
        </>
      )}
      {data && step && msg && <p className="lg2-err">{msg}</p>}
    </AuthSplit>
  );
}
