"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthSplit } from "@/components/AuthSplit";
import { CreatePasscode } from "@/components/customer/CreatePasscode";
import { OnboardSteps } from "@/components/customer/OnboardSteps";
import { useErr } from "@/components/customer/PortalChrome";
import { useT } from "@/lib/i18n";
import { portalApi, rememberWho, type InviteInfo } from "@/lib/portalApi";

/**
 * Convite de uma pessoa do cliente — passo 1 do onboarding: escolher o código de 4–6 dígitos (entra logo no portal).
 * Os passos seguintes (validar o email com Google, Instagram) ficam em /portal/bem-vindo e são opcionais.
 */
export default function PortalInvite() {
  const { t } = useT();
  const tErr = useErr();
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    portalApi
      .checkInvite(token)
      .then((i) => {
        setInfo(i);
      })
      .catch((e) => setErr(tErr(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthSplit top={info ? `${t("po.inviteTitle")} · ${info.name}` : t("po.inviteTitle")}>
      {info && <OnboardSteps step="code" />}
      <span className="lg2-kicker">{info?.name ?? ""}</span>
      <h1 className="lg2-title">{info ? t("po.inviteHi", { name: (info.person || info.email).split(" ")[0] }) : err ? "" : "…"}</h1>
      {info && (
        <>
          <CreatePasscode
            onDone={async (code) => {
              let to = "/portal/bem-vindo";
              try {
                to = (await portalApi.acceptWithCode(token, code)).to;
              } catch (e) {
                throw new Error(tErr(e));
              }
              rememberWho({ name: info.name, email: info.email, len: code.length });
              location.href = to;
            }}
          />
          <p className="lg2-legal">{t("au.legal")}</p>
        </>
      )}
      {err && <p className="lg2-err">{err}</p>}
    </AuthSplit>
  );
}
