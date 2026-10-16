"use client";

// Link do email: escolher o código novo (4–6 dígitos, como no onboarding) e entrar logo. Mesmo layout do login.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthSplit } from "@/components/AuthSplit";
import { CreatePasscode } from "@/components/customer/CreatePasscode";
import { useErr } from "@/components/customer/PortalChrome";
import { Icon } from "@/components/Icon";
import { useT, type Key } from "@/lib/i18n";
import { resetApi } from "@/lib/resetApi";

const LS_LEN = "xmedia:login:len";

export default function ResetCode() {
  const { t } = useT();
  const tErr = useErr();
  const { token } = useParams<{ token: string }>();
  const [email, setEmail] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    resetApi
      .check(token)
      .then((r) => setEmail(r.email))
      .catch((e) => setErr((e as Error).message));
  }, [token]);

  return (
    <AuthSplit top={t("rs.top")}>
      <span className="lg2-kicker">XMEDIA</span>
      {err ? (
        <>
          <h1 className="lg2-title">{t(`rs.err.${err}` as Key) === `rs.err.${err}` ? t("rs.err.invalid") : t(`rs.err.${err}` as Key)}</h1>
          <Link className="lg2-primary" href="/redefinir" style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>
            {t("rs.newLink")}
          </Link>
        </>
      ) : !email ? (
        <p className="muted">…</p>
      ) : (
        <>
          <h1 className="lg2-title">{t("rs.newTitle")}</h1>
          <p className="lg2-sub">{t("rs.newSub", { email })}</p>
          <CreatePasscode
            onDone={async (code) => {
              let to = "/home";
              try {
                const r = await resetApi.apply(token, code);
                to = r.to;
              } catch (e) {
                throw new Error(tErr(e));
              }
              // o login passa a saber o tamanho do código (não volta a perguntar)
              try {
                localStorage.removeItem(LS_LEN);
              } catch {}
              location.href = to;
            }}
          />
        </>
      )}
      <Link className="lg2-ghost" href="/login">
        <Icon name="back" size={14} /> {t("rs.back")}
      </Link>
    </AuthSplit>
  );
}
