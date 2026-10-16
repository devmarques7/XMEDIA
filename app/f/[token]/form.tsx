"use client";

// Formulário de avaliação do cliente, no estilo bento: NPS 0–10, 6 notas de 1 a 5, comentários e testemunho.
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LangSwitch, ThemeToggle } from "@/components/ui";
import { FB_DIMS, type FbAnswers, type FbDim } from "@/lib/feedback";
import { feedbackApi, type PublicState } from "@/lib/feedbackApi";
import { useT, type Key } from "@/lib/i18n";

export function FeedbackForm({ token }: { token: string }) {
  const { t, suggestLang } = useT();
  const [st, setSt] = useState<PublicState | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [scores, setScores] = useState<Partial<Record<FbDim, number>>>({});
  const [best, setBest] = useState("");
  const [improve, setImprove] = useState("");
  const [testimonial, setTestimonial] = useState<boolean | null>(null);
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    feedbackApi
      .get(token)
      .then((s) => {
        setSt(s);
        if (s.lang) suggestLang(s.lang);
      })
      .catch(() => setSt({ state: "invalid" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const complete = nps !== null && FB_DIMS.every((d) => scores[d]);
  const answered = (nps !== null ? 1 : 0) + FB_DIMS.filter((d) => scores[d]).length + (improve.trim() ? 1 : 0) + (testimonial !== null ? 1 : 0);

  async function submit() {
    if (!complete) return setErr(t("fb.required"));
    setBusy(true);
    setErr("");
    try {
      const answers: FbAnswers = { nps: nps!, scores: scores as Record<FbDim, number>, best, improve, testimonial: !!testimonial, quote: testimonial ? quote : "" };
      await feedbackApi.submit(token, answers);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const m = (e as Error).message;
      if (m === "used" || m === "expired") setSt((s) => ({ ...(s ?? {}), state: m }));
      else setErr(m === "bad_answers" ? t("fb.required") : m);
    }
    setBusy(false);
  }

  const first = (st?.name || "").split(" ")[0];
  return (
    <main className="fbf">
      <header className="fbf-top">
        <span className="row" style={{ gap: 10 }}>
          <Logo size={22} />
          <span className="label">[MEDIAMARQUES]</span>
        </span>
        <span className="row" style={{ gap: 8 }}>
          <LangSwitch />
          <ThemeToggle />
        </span>
      </header>

      {!st ? null : done || st.state !== "open" ? (
        <section className="w tile blue fbf-msg" data-testid="fb-done">
          <span className="tile-t">{st.company || "MediaMarques"}</span>
          <div>
            <h1 className="tile-big">{done ? t("fb.thanks") : st.state === "used" ? t("fb.thanks") : "—"}</h1>
            <p className="tile-text" style={{ marginTop: 14 }}>
              {done ? t("fb.thanksHint") : st.state === "used" ? t("fb.used") : st.state === "expired" ? t("fb.expired") : t("fb.invalid")}
            </p>
          </div>
        </section>
      ) : (
        <div className="widgets fbf-grid">
          <section className="w tile blue span-8 fbf-hero">
            <span className="tile-t">{st.company}</span>
            <div>
              <h1 className="tile-big">{t("fb.title")}</h1>
              <p className="tile-text" style={{ marginTop: 14 }}>
                {first ? `${first} — ` : ""}
                {t("fb.intro")}
              </p>
            </div>
          </section>
          <section className="w tile span-4">
            <span className="tile-t">{t("fb.private")}</span>
            <div className="tile-foot">
              <span className="tile-num">{answered}</span>
              <span className="tile-of">/ 9</span>
            </div>
            <div className="meter">
              <i style={{ width: `${(answered / 9) * 100}%` }} />
            </div>
          </section>

          <section className="w span-12 stack">
            <span className="tile-t">01 · {t("fb.q.nps")}</span>
            <div className="fbf-nps" role="radiogroup" aria-label={t("fb.q.nps")}>
              {Array.from({ length: 11 }, (_, n) => (
                <button key={n} role="radio" aria-checked={nps === n} className={`fbf-n ${nps === n ? "on" : ""} ${n <= 6 ? "lo" : n <= 8 ? "mid" : "hi"}`} onClick={() => setNps(n)} data-testid={`fb-nps-${n}`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="row between small muted">
              <span>0 · {t("fb.npsLow")}</span>
              <span>10 · {t("fb.npsHigh")}</span>
            </div>
          </section>

          <section className="w span-12 stack">
            <span className="tile-t">02 · {t("fb.q.scores")}</span>
            <div className="fbf-dims">
              {FB_DIMS.map((d) => (
                <div key={d} className="fbf-dim">
                  <span>{t(`fb.dim.${d}` as Key)}</span>
                  <div className="fbf-stars" role="radiogroup" aria-label={t(`fb.dim.${d}` as Key)}>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button key={v} role="radio" aria-checked={scores[d] === v} className={`fbf-n ${scores[d] === v ? "on" : ""} ${(scores[d] ?? 0) >= v ? "fill" : ""}`} onClick={() => setScores((s) => ({ ...s, [d]: v }))} data-testid={`fb-${d}-${v}`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="w span-6 stack">
            <span className="tile-t">03 · {t("fb.q.best")}</span>
            <textarea className="textarea" rows={4} value={best} onChange={(e) => setBest(e.target.value)} maxLength={1500} />
          </section>
          <section className="w span-6 stack">
            <span className="tile-t">04 · {t("fb.q.improve")}</span>
            <textarea className="textarea" rows={4} value={improve} onChange={(e) => setImprove(e.target.value)} placeholder={t("fb.q.improvePh")} maxLength={1500} data-testid="fb-improve" />
          </section>

          <section className="w span-12 stack">
            <span className="tile-t">05 · {t("fb.q.testimonial")}</span>
            <div className="row" style={{ gap: 8 }}>
              <button className={`chip ${testimonial === true ? "on" : ""}`} onClick={() => setTestimonial(true)}>
                {t("fb.yes")}
              </button>
              <button className={`chip ${testimonial === false ? "on" : ""}`} onClick={() => setTestimonial(false)}>
                {t("fb.no")}
              </button>
            </div>
            {testimonial && <textarea className="textarea" rows={2} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder={t("fb.q.quote")} maxLength={600} />}
          </section>

          <section className="w tile sand span-12 fbf-send">
            <div className="tile-foot" style={{ alignItems: "center" }}>
              <span className="tile-text">{err || t("fb.private")}</span>
              <button className="btn solid fbf-submit" onClick={submit} disabled={busy} data-testid="fb-submit">
                {busy ? "…" : `${t("fb.submit")} →`}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
