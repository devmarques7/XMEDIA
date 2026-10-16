"use client";

// Guia de primeira utilização: destaca um elemento de cada vez (data-tour="…") com uma explicação curta,
// "Seguinte" / "Saltar". Fica marcado como visto neste browser (por chave). Reutilizável em qualquer página.
import { Icon } from "@/components/Icon";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useT } from "@/lib/i18n";

export type TourStep = { target: string; title: string; text: string };

const seen = (key: string) => {
  try {
    return localStorage.getItem(`xmedia:tour:${key}`) === "1";
  } catch {
    return true;
  }
};
const markSeen = (key: string) => {
  try {
    localStorage.setItem(`xmedia:tour:${key}`, "1");
  } catch {}
};
export const resetTour = (key: string) => {
  try {
    localStorage.removeItem(`xmedia:tour:${key}`);
  } catch {}
};

export function Tour({ id, steps, start = true, onEnd }: { id: string; steps: TourStep[]; start?: boolean; onEnd?: () => void }) {
  const { t } = useT();
  const [i, setI] = useState<number | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (start && !seen(id)) setI(0);
  }, [start, id]);
  const valid = steps.filter((s) => typeof document === "undefined" || document.querySelector(`[data-tour="${s.target}"]`));
  const step = i !== null ? valid[i] : null;
  const place = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return setBox(null);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => setBox(el.getBoundingClientRect()), 260);
  }, [step]);
  useLayoutEffect(() => {
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [place]);
  const end = () => {
    markSeen(id);
    setI(null);
    onEnd?.();
  };
  if (i === null || !step) return null;
  const last = i >= valid.length - 1;
  const below = box ? box.bottom + 190 < window.innerHeight : true;
  const left = box ? Math.min(Math.max(12, box.left), window.innerWidth - 332) : 12;
  return (
    <div className="tour" role="dialog" aria-label={step.title}>
      {box && <div className="tour-hole" style={{ left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 }} />}
      <div className="tour-card" style={box ? { left, top: below ? box.bottom + 14 : Math.max(12, box.top - 14 - 170) } : { left: "50%", top: "40%", transform: "translate(-50%,-50%)" }}>
        <span className="tile-t muted">
          {i + 1} / {valid.length}
        </span>
        <b>{step.title}</b>
        <p>{step.text}</p>
        <div className="row between">
          <button className="btn ghost small" onClick={end} data-testid="tour-skip">
            {t("tour.skip")}
          </button>
          <span className="row" style={{ gap: 6 }}>
            {i > 0 && (
              <button className="btn small" onClick={() => setI(i - 1)}>
                <Icon name="back" size={14} />
              </button>
            )}
            <button className="btn accent small" onClick={() => (last ? end() : setI(i + 1))} data-testid="tour-next">
              {last ? t("tour.done") : t("tour.next")} <Icon name="next" size={14} />
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
