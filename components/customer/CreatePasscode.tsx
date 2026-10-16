"use client";

// Criar código de 4–6 dígitos (como no iPhone): escolher → aviso se for fácil → confirmar.
// Usado nos convites de clientes e de funcionários.
import { useState } from "react";
import { weakPasscode } from "@/lib/customer";
import { useT } from "@/lib/i18n";
import { Keypad } from "./parts";

export function CreatePasscode({ onDone, disabled }: { onDone: (code: string) => Promise<void>; disabled?: boolean }) {
  const { t } = useT();
  const [len, setLen] = useState(6);
  const [phase, setPhase] = useState<"choose" | "weak" | "confirm">("choose");
  const [first, setFirst] = useState("");
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (m: string) => {
    setMsg(m);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  async function onChange(v: string) {
    setValue(v);
    setMsg("");
    if (v.length < len) return;
    if (phase === "choose") {
      setFirst(v);
      setValue("");
      setPhase(weakPasscode(v) ? "weak" : "confirm");
      return;
    }
    if (v !== first) {
      setValue("");
      setFirst("");
      setPhase("choose");
      return fail(t("po.mismatch"));
    }
    setBusy(true);
    try {
      await onDone(v);
      setValue("");
      setFirst("");
      setPhase("choose");
    } catch (e) {
      setValue("");
      setFirst("");
      setPhase("choose");
      fail(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <div className="cp">
      <b className="cp-title">{phase === "confirm" ? t("po.confirmTitle") : t("po.setTitle")}</b>
      <span className="muted small">
        {t("po.digits", { n: len })} · {t("po.setHint")}
      </span>
      {phase === "weak" ? (
        <div className="stack" style={{ width: "100%" }}>
          <p className="note">{t("po.weak")}</p>
          <button className="btn" onClick={() => setPhase("confirm")}>
            {t("po.useWeak")}
          </button>
          <button
            className="btn solid"
            onClick={() => {
              setFirst("");
              setPhase("choose");
            }}
          >
            {t("po.tryAnother")}
          </button>
        </div>
      ) : (
        <Keypad length={len} value={value} onChange={onChange} error={shake} disabled={busy || disabled} />
      )}
      {phase === "choose" && (
        <div className="seg" role="group" aria-label={t("po.options")}>
          {[4, 5, 6].map((n) => (
            <button
              key={n}
              aria-pressed={len === n}
              onClick={() => {
                setLen(n);
                setValue("");
              }}
            >
              {t("po.digits", { n })}
            </button>
          ))}
        </div>
      )}
      {msg && <p className="note tone-danger">{msg}</p>}
    </div>
  );
}
