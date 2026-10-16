"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { Icon } from "@/components/Icon";
import { CreatePasscode } from "@/components/customer/CreatePasscode";
import { useErr } from "@/components/customer/PortalChrome";
import { Logo } from "@/components/Logo";
import { LangSwitch, ThemeToggle } from "@/components/ui";
import { useT, type Key } from "@/lib/i18n";
import { ApiError, memberApi, type InviteInfo } from "@/lib/memberApi";

type State = { kind: "checking" } | { kind: "error"; code: string } | { kind: "ready"; info: InviteInfo };

/** Convite da equipa em passos: nome → função → foto → código de 4–6 dígitos. O admin só pôs o email e o acesso. */
export default function AcceptInvite() {
  const { t, suggestLang } = useT();
  const tErr = useErr();
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    memberApi
      .checkInvite(token)
      .then((info) => {
        suggestLang(info.lang);
        setState({ kind: "ready", info });
      })
      .catch((e) => setState({ kind: "error", code: e instanceof ApiError ? e.message : "invalid" }));
  }, [token, suggestLang]);

  const errKey = (c: string) => (c === "expired" ? "acc.expired" : c === "disabled" ? "acc.disabled" : "acc.invalid");

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
          <span className="label">{t("inv.title")}</span>
          <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
            <LangSwitch />
            <ThemeToggle />
          </span>
        </header>
        <div className="lg2-box">
          {state.kind === "checking" && <p className="muted">{t("acc.checking")}</p>}
          {state.kind === "error" && (
            <>
              <h1 className="lg2-title">{t(errKey(state.code))}</h1>
              <Link href="/login" className="lg2-outline">
                {t("lg.enter")}
              </Link>
            </>
          )}
          {state.kind === "ready" && <Steps token={token} info={state.info} />}
        </div>
      </section>
    </main>
  );
}

const STEPS = ["name", "role", "photo", "code"] as const;
type Step = (typeof STEPS)[number];

/** Recorte quadrado ao centro, 320px, JPEG — leve para guardar como foto de perfil. */
async function avatar(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const c = Object.assign(document.createElement("canvas"), { width: 320, height: 320 });
  c.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 320, 320);
  return c.toDataURL("image/jpeg", 0.85);
}

function Steps({ token, info }: { token: string; info: InviteInfo }) {
  const { t } = useT();
  const tErr = useErr();
  const fromEmail = !info.name || info.name.toLowerCase() === info.email.split("@")[0].replace(/[._-]+/g, " ").toLowerCase();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(fromEmail ? "" : info.name);
  const [role, setRole] = useState(info.role ?? "");
  const [photo, setPhoto] = useState("");
  const [err, setErr] = useState("");
  const cam = useRef<HTMLInputElement>(null);
  const i = STEPS.indexOf(step);
  const go = (d: number) => (setErr(""), setStep(STEPS[Math.max(0, Math.min(STEPS.length - 1, i + d))]));
  const canNext = step === "name" ? name.trim().length > 1 : step === "role" ? role.trim().length > 1 : true;
  const pick = async (f?: File) => {
    if (!f) return;
    try {
      setPhoto(await avatar(f));
    } catch {
      setErr(t("dz.type", { n: 1 }));
    }
  };

  return (
    <div className="ac2">
      <ol className="ac2-steps" aria-label="steps">
        {STEPS.map((k, j) => (
          <li key={k} className={j < i ? "done" : j === i ? "on" : ""}>
            <i>{j < i ? <Icon name="check" size={12} /> : j + 1}</i>
            <span>{t(`ac2.step.${k}` as Key)}</span>
          </li>
        ))}
      </ol>

      {step === "name" && (
        <form className="ac2-pane" onSubmit={(e) => (e.preventDefault(), canNext && go(1))}>
          <h1 className="lg2-title">{t("ac2.nameQ")}</h1>
          <p className="lg2-sub">{t("au.inviteFor", { email: info.email })}</p>
          <input className="input big ac2-in" autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-testid="ac2-name" />
          <button className="lg2-primary" disabled={!canNext}>
            {t("ac2.next")}
          </button>
        </form>
      )}

      {step === "role" && (
        <form className="ac2-pane" onSubmit={(e) => (e.preventDefault(), canNext && go(1))}>
          <h1 className="lg2-title">{t("ac2.roleQ")}</h1>
          <input className="input big ac2-in" autoFocus value={role} onChange={(e) => setRole(e.target.value)} placeholder={t("ac2.rolePh")} data-testid="ac2-role" />
          <div className="ac2-chips">
            {t("ac2.roles")
              .split(",")
              .map((r) => (
                <button type="button" key={r} className={`cb-chip ${role === r ? "on" : ""}`} onClick={() => setRole(r)}>
                  {r}
                </button>
              ))}
          </div>
          <div className="ac2-nav">
            <button type="button" className="lg2-outline" onClick={() => go(-1)}>
              {t("ac2.back")}
            </button>
            <button className="lg2-primary" disabled={!canNext}>
              {t("ac2.next")}
            </button>
          </div>
        </form>
      )}

      {step === "photo" && (
        <div className="ac2-pane">
          <h1 className="lg2-title">{t("ac2.photoQ")}</h1>
          <p className="lg2-sub">{t("ac2.photoSub")}</p>
          <DropZone target="cover" onFiles={([f]) => pick(f)} noPick>
            <button type="button" className="ac2-avatar" onClick={() => cam.current?.click()} aria-label={t("ac2.take")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <img src={photo} alt="" /> : <span>{(name || "?").trim().slice(0, 2).toUpperCase()}</span>}
            </button>
          </DropZone>
          <div className="ac2-nav">
            <label className="lg2-outline ac2-btn">
              <Icon name="image" size={15} /> {t("ac2.take")}
              <input ref={cam} type="file" accept="image/*" capture="user" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
            </label>
            <label className="lg2-outline ac2-btn">
              <Icon name="upload" size={15} /> {t("ac2.upload")}
              <input type="file" accept="image/*" hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
            </label>
          </div>
          <div className="ac2-nav">
            <button type="button" className="lg2-outline" onClick={() => go(-1)}>
              {t("ac2.back")}
            </button>
            <button className="lg2-primary" onClick={() => go(1)} data-testid="ac2-photo-next">
              {photo ? t("ac2.next") : t("ac2.skip")}
            </button>
          </div>
        </div>
      )}

      {step === "code" && (
        <div className="ac2-pane">
          <h1 className="lg2-title">{t("ac2.codeQ")}</h1>
          <CreatePasscode
            onDone={async (code) => {
              let to = "/eu";
              try {
                to = (await memberApi.acceptInvite(token, code, { name: name.trim(), role: role.trim(), photo: photo || undefined })).to ?? "/eu";
              } catch (e) {
                throw new Error(tErr(e));
              }
              location.href = to;
            }}
          />
          <button type="button" className="btn ghost small" onClick={() => go(-1)}>
            {t("ac2.back")}
          </button>
        </div>
      )}
      {err && <p className="tone-danger small">{err}</p>}
      <p className="lg2-legal">{t("au.legal")}</p>
    </div>
  );
}
