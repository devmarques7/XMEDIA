"use client";

// Capacidade do dia no Hoje: quanto está planeado vs. o máximo (capacidade − margem), aviso quando passa,
// o que mover e para quando, calibração pelo ritmo real e a semana em miniatura. Configurável (horas e margem).
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Select } from "@/components/Select";
import { useT } from "@/lib/i18n";
import { fmtMin, type Calibration, type DayLoad, type PlanSettings } from "@/lib/plan";

export function CapacityBar({
  load,
  week,
  cal,
  plan,
  onPlan,
  moveTo,
  onMove,
}: {
  load: DayLoad;
  week: DayLoad[];
  cal: Calibration;
  plan: PlanSettings;
  onPlan: (p: PlanSettings) => void;
  /** Dia sugerido para o que não cabe. */
  moveTo?: string;
  /** Mover para esse dia as tarefas de menor prioridade que passam do máximo. */
  onMove?: () => void;
}) {
  const { t, locale } = useT();
  const [edit, setEdit] = useState(false);
  const pct = load.capacity ? Math.min(100, Math.round((load.planned / load.capacity) * 100)) : load.planned ? 100 : 0;
  const over = load.planned - load.capacity;
  const day = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T12:00:00").toLocaleDateString(locale, o);
  return (
    <section className={`cap cap-${load.level}`} data-testid="capacity">
      <div className="cap-top">
        <b>
          {t("cap.planned", { a: fmtMin(load.planned), b: fmtMin(load.capacity) })}
        </b>
        <button className="cap-cfg mono small" onClick={() => setEdit((x) => !x)} aria-expanded={edit} data-testid="cap-cfg">
          <Icon name="settings" size={12} /> {t("cap.cfg", { h: fmtMin(plan.capacity_min), m: Math.round(plan.buffer * 100) })}
        </button>
      </div>
      <div className="cap-track" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="cap-msg small" data-testid="cap-msg">
        {load.level === "off"
          ? t("cap.off")
          : load.level === "over"
            ? t("cap.over", { n: fmtMin(over) })
            : load.level === "tight"
              ? t("cap.tight", { n: fmtMin(load.free) })
              : t("cap.ok", { n: fmtMin(load.free) })}
        {load.level === "over" && moveTo && onMove && (
          <button className="btn small" onClick={onMove} data-testid="cap-move">
            <Icon name="next" size={13} /> {t("cap.moveTo", { day: day(moveTo, { weekday: "short", day: "2-digit" }) })}
          </button>
        )}
      </p>
      <p className="cap-cal muted small" data-testid="cap-cal">
        <Icon name="chart" size={12} />{" "}
        {cal.reliable
          ? t("cap.calibrated", { f: cal.factor.toFixed(2).replace(/\.?0+$/, ""), h: fmtMin(cal.dailyLogged) })
          : t("cap.notCalibrated")}
      </p>
      {edit && (
        <div className="cap-edit">
          <label className="field">
            <span>{t("cap.hours")}</span>
            <Select className="select" value={String(plan.capacity_min)} onChange={(e) => onPlan({ ...plan, capacity_min: Number(e.target.value) })}>
              {[240, 300, 360, 420, 480, 540, 600].map((m) => (
                <option key={m} value={String(m)}>
                  {fmtMin(m)}
                </option>
              ))}
            </Select>
          </label>
          <label className="field">
            <span>{t("cap.buffer")}</span>
            <Select className="select" value={String(plan.buffer)} onChange={(e) => onPlan({ ...plan, buffer: Number(e.target.value) })}>
              {[0, 0.1, 0.2, 0.3].map((b) => (
                <option key={b} value={String(b)}>
                  {Math.round(b * 100)}%
                </option>
              ))}
            </Select>
          </label>
          <span className="muted small">{t("cap.bufferHint")}</span>
        </div>
      )}
      <div className="cap-week" aria-label={t("cap.week")}>
        {week.map((d) => (
          <span key={d.day} className={`cap-day cap-${d.level}`} title={`${day(d.day, { weekday: "long", day: "2-digit" })} · ${fmtMin(d.planned)} / ${fmtMin(d.capacity)}`}>
            <span className="cap-day-bar">
              <i style={{ height: `${d.capacity ? Math.min(100, (d.planned / d.capacity) * 100) : d.planned ? 100 : 0}%` }} />
            </span>
            <span className="mono">{day(d.day, { weekday: "narrow" })}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
