"use client";

// Página pública de assinatura (link pessoal). O destinatário vê o documento, preenche os campos dele (os automáticos
// já vêm preenchidos), confirma o email com um código, aceita assinar eletronicamente e assina. Também pode recusar.
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { LangMenu } from "@/components/LangMenu";
import { Logo } from "@/components/Logo";
import { PdfView } from "@/components/docs/PdfView";
import { SignaturePad } from "@/components/docs/SignaturePad";
import { AUTO_FIELDS, STATIC_FIELDS, autoValue, colorOf, type DocField } from "@/lib/documents";
import { docApi, docLocal, type SignView } from "@/lib/docApi";
import { useT, type Key } from "@/lib/i18n";
import { resolveMedia } from "@/lib/media";

export default function SignPage() {
  const { t, suggestLang } = useT();
  const { token } = useParams<{ token: string }>();
  const [v, setV] = useState<SignView | null>(null);
  const [err, setErr] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [pad, setPad] = useState<DocField | null>(null);
  const [step, setStep] = useState<"fill" | "confirm" | "done" | "declined">("fill");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    docApi
      .view(token)
      .then((x) => {
        setV(x);
        suggestLang(x.me.lang);
        if (x.me.status === "signed") setStep("done");
        if (x.me.status === "declined") setStep("declined");
      })
      .catch((e) => setErr((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const mine = useMemo(() => (v ? v.doc.fields.filter((f) => f.recipient_id === v.me.id && !AUTO_FIELDS.includes(f.type) && !STATIC_FIELDS.includes(f.type)) : []), [v]);
  const required = mine.filter((f) => f.required && f.type !== "radio");
  const done = required.filter((f) => (values[f.id] ?? "").trim()).length;
  const ready = done === required.length;
  const meRec = v?.doc.recipients.find((r) => r.id === v.me.id);
  const src = v ? v.file : null;

  async function sendCode() {
    setBusy(true);
    setErr("");
    try {
      const r = await docApi.otp(token);
      setCodeSent(r.code ?? "");
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }
  async function sign() {
    setBusy(true);
    setErr("");
    try {
      await docApi.sign(token, { code: code.trim(), values, consent });
      setStep("done");
      setV(await docApi.view(token));
    } catch (e) {
      const m = (e as Error).message;
      setErr(t(`sg.err.${m.split(":")[0]}` as Key) === `sg.err.${m.split(":")[0]}` ? m : t(`sg.err.${m.split(":")[0]}` as Key));
    }
    setBusy(false);
  }
  async function decline() {
    const reason = prompt(t("sg.declineWhy")) ?? "";
    if (!reason.trim()) return;
    await docApi.decline(token, reason);
    setStep("declined");
  }
  async function download() {
    if (!v?.signed) return;
    window.open(docLocal ? await resolveMedia(v.signed) : v.signed, "_blank", "noopener");
  }

  const fieldUi = (f: DocField) => {
    const isMine = v && f.recipient_id === v.me.id && step === "fill";
    const val = AUTO_FIELDS.includes(f.type) && v && f.recipient_id === v.me.id ? autoValue(f, meRec) : (values[f.id] ?? f.value ?? "");
    const style = { left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%`, ["--rc" as string]: v ? colorOf(v.doc as never, f.recipient_id) : "#888" };
    const cls = `sg-fld t-${f.type} ${isMine ? "mine" : ""} ${isMine && f.required && !val ? "need" : ""}`;
    if (!isMine || AUTO_FIELDS.includes(f.type) || STATIC_FIELDS.includes(f.type))
      return (
        <div key={f.id} className={`${cls} ro`} style={style}>
          {val.startsWith("data:image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={val} alt="" />
          ) : f.type === "hyperlink" ? (
            <a href={val} target="_blank" rel="noreferrer">
              {val}
            </a>
          ) : (
            <span>{val}</span>
          )}
        </div>
      );
    if (f.type === "signature" || f.type === "initials" || f.type === "drawing" || f.type === "image")
      return (
        <button key={f.id} className={cls} style={style} onClick={() => (f.type === "image" ? undefined : setPad(f))} data-testid={`sg-${f.type}`}>
          {val ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={val} alt="" />
          ) : f.type === "image" ? (
            <label className="sg-up">
              <Icon name="upload" size={14} /> {t("df.t.image")}
              <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = () => setValues((x) => ({ ...x, [f.id]: String(r.result) }));
                r.readAsDataURL(file);
              }} />
            </label>
          ) : (
            <span>
              <Icon name="edit" size={13} /> {t(`df.t.${f.type}` as Key)}
            </span>
          )}
        </button>
      );
    if (f.type === "checkbox")
      return (
        <label key={f.id} className={cls} style={style}>
          <input type="checkbox" checked={val === "true"} onChange={(e) => setValues((x) => ({ ...x, [f.id]: e.target.checked ? "true" : "" }))} />
        </label>
      );
    if (f.type === "radio")
      return (
        <div key={f.id} className={`${cls} sg-radio`} style={{ ...style, height: "auto" }}>
          {(f.label || "A|B").split("|").map((o) => (
            <label key={o}>
              <input type="radio" name={f.id} checked={val === o} onChange={() => setValues((x) => ({ ...x, [f.id]: o }))} /> {o}
            </label>
          ))}
        </div>
      );
    return <input key={f.id} className={cls} style={style} type={f.type === "date" ? "date" : "text"} value={val} placeholder={f.label || t(`df.t.${f.type}` as Key)} onChange={(e) => setValues((x) => ({ ...x, [f.id]: e.target.value }))} data-testid={`sg-${f.type}`} />;
  };

  return (
    <main className="sg">
      <header className="sg-top">
        <span className="row" style={{ gap: 10 }}>
          <Logo size={22} />
          <b className="mono">XMEDIA</b>
          <span className="muted small hide-sm">· {t("sg.secure")}</span>
        </span>
        <LangMenu />
      </header>
      {err && !v && <p className="sg-msg tone-danger">{t(`sg.err.${err}` as Key) === `sg.err.${err}` ? err : t(`sg.err.${err}` as Key)}</p>}
      {v && (
        <>
          <section className="sg-head">
            <span className="label muted">{t("sg.for", { name: v.me.name })}</span>
            <h1 className="sg-title">{v.doc.title}</h1>
            {v.doc.message && <p className="muted">{v.doc.message}</p>}
            {step === "fill" && !v.canSign && v.me.role !== "viewer" && <p className="note small">{t("sg.waitTurn")}</p>}
            {step === "done" && (
              <p className="note small">
                <Icon name="check" size={14} /> {v.doc.status === "completed" ? t("sg.doneAll") : t("sg.doneMe")}{" "}
                {v.signed && (
                  <button className="lnk" onClick={download}>
                    {t("de.download")}
                  </button>
                )}
              </p>
            )}
            {step === "declined" && <p className="note small tone-danger">{t("sg.declined")}</p>}
          </section>
          <PdfView src={src} className="sg-pdf" overlay={(pg) => <div className="sg-ov">{v.doc.fields.filter((f) => f.page === pg).map(fieldUi)}</div>} />

          {step === "fill" && v.canSign && (
            <footer className="sg-bar">
              <span className="small">
                <b>{done}</b>/{required.length} {t("sg.fields")}
              </span>
              <span className="row" style={{ gap: 8 }}>
                <button className="btn ghost small" onClick={decline}>
                  {t("sg.decline")}
                </button>
                <button className="btn accent" disabled={!ready} onClick={() => setStep("confirm")} data-testid="sg-finish">
                  {t("sg.finish")} <Icon name="next" size={14} />
                </button>
              </span>
            </footer>
          )}
          {step === "confirm" && (
            <div className="overlay">
              <div className="dialog stack sg-confirm" role="dialog" aria-modal="true">
                <span className="tile-t">{t("sg.confirmTitle")}</span>
                <label className="row small" style={{ gap: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="sg-consent" />
                  <span>{t("sg.consent", { name: v.me.name, email: v.me.email })}</span>
                </label>
                {codeSent === null ? (
                  <button className="btn accent" onClick={sendCode} disabled={!consent || busy} data-testid="sg-code-send">
                    <Icon name="mail" size={14} /> {t("sg.sendCode", { email: v.me.email })}
                  </button>
                ) : (
                  <>
                    <p className="small muted" style={{ margin: 0 }}>
                      {codeSent ? t("sg.localCode", { code: codeSent }) : t("sg.codeSent", { email: v.me.email })}
                    </p>
                    <input className="input big mono" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" autoFocus data-testid="sg-code" />
                    <button className="btn accent" onClick={sign} disabled={busy || code.length !== 6 || !consent} data-testid="sg-sign">
                      <Icon name="edit" size={14} /> {t("sg.sign")}
                    </button>
                    <button className="lnk small" onClick={sendCode} disabled={busy}>
                      {t("sg.resendCode")}
                    </button>
                  </>
                )}
                {err && <p className="tone-danger small">{err}</p>}
                <button className="btn ghost small" onClick={() => setStep("fill")}>
                  {t("ac2.back")}
                </button>
                <p className="muted small" style={{ margin: 0 }}>
                  {t("sg.legal")}
                </p>
              </div>
            </div>
          )}
        </>
      )}
      {pad && v && (
        <SignaturePad
          kind={pad.type === "initials" ? "initials" : pad.type === "drawing" ? "drawing" : "signature"}
          name={v.me.name}
          initial={values[pad.id]}
          onClose={() => setPad(null)}
          onDone={(png) => {
            // a mesma assinatura serve para os outros campos do mesmo tipo
            setValues((x) => {
              const next = { ...x, [pad.id]: png };
              for (const f of mine) if (f.type === pad.type && !next[f.id] && pad.type !== "drawing") next[f.id] = png;
              return next;
            });
            setPad(null);
          }}
        />
      )}
    </main>
  );
}
