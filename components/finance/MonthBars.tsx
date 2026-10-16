"use client";

// Faturado por mês (12 meses), uma só série: barras finas em tom neutro, o mês atual em destaque (cor + valor escrito,
// nunca só a cor), dica ao passar o rato/focar em cada mês e uma tabela para leitores de ecrã.
import { useEffect, useRef, useState } from "react";

type Month = { key: string; total: number; paid: number };

export function MonthBars({ months, locale, money, label, paidLabel }: { months: Month[]; locale: string; money: (v: number) => string; label: string; paidLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // largura real do contentor: o desenho fica a 1:1 (altura e texto fixos em qualquer ecrã)
  const box = useRef<HTMLElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 120;
  const top = 18; // espaço para o valor do mês atual
  const max = Math.max(1, ...months.map((m) => m.total));
  const slot = W / months.length;
  const bw = Math.min(28, slot - 8);
  const name = (k: string, long = false) => new Date(k + "-15T12:00:00Z").toLocaleDateString(locale, { month: long ? "long" : "short", ...(long ? { year: "numeric" } : {}) }).replace(".", "");
  const last = months.length - 1;
  const h = (v: number) => (v / max) * (H - top);
  const tip = hover === null ? null : months[hover];

  return (
    <figure className="mbars" aria-label={label} ref={box}>
      <svg viewBox={`0 0 ${W} ${H + 20}`} width={W} height={H + 20} role="img" aria-hidden="true" onMouseLeave={() => setHover(null)}>
        <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} className="mbars-base" />
        {months.map((m, i) => {
          const x = i * slot + (slot - bw) / 2;
          const bh = Math.max(m.total ? 2 : 0, h(m.total));
          const r = Math.min(4, bh / 2, bw / 2);
          const y = H - bh;
          return (
            <g key={m.key}>
              {bh > 0 && <path d={`M${x} ${H}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${H}Z`} className={i === last ? "mbars-now" : hover === i ? "mbars-on" : "mbars-bar"} />}
              {i === last && m.total > 0 && (
                <text x={x + bw} y={Math.max(11, y - 6)} textAnchor="end" className="mbars-val">
                  {money(m.total)}
                </text>
              )}
              <text x={x + bw / 2} y={H + 15} textAnchor="middle" className="mbars-lab">
                {name(m.key)}
              </text>
              {/* alvo maior do que a barra (rato e teclado) */}
              <rect x={i * slot} y={0} width={slot} height={H + 20} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="mbars-tip" style={{ left: `${((hover! + 0.5) / months.length) * 100}%` }} role="status">
          <b>{name(tip.key, true)}</b>
          <span>{money(tip.total)}</span>
          {tip.total > 0 && <span className="muted">{paidLabel} {Math.round((tip.paid / tip.total) * 100)}%</span>}
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <th scope="row">{name(m.key, true)}</th>
              <td>{money(m.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
