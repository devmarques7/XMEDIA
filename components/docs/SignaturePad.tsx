"use client";

// Assinatura / rubrica / desenho: desenhar com o dedo ou rato, ou escrever o nome. Devolve um PNG (data URL).
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";

export function SignaturePad({ initial, name, kind, onDone, onClose }: { initial?: string; name: string; kind: "signature" | "initials" | "drawing"; onDone: (png: string) => void; onClose: () => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<"draw" | "type">(kind === "drawing" ? "draw" : "type");
  const [text, setText] = useState(kind === "initials" ? name.split(/\s+/).map((w) => w[0] ?? "").join("").toUpperCase() : name);
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (mode === "type") {
      ctx.fillStyle = "#111";
      ctx.font = `italic ${kind === "initials" ? 64 : 56}px "Snell Roundhand", "Segoe Script", "Brush Script MT", cursive`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(text, c.width / 2, c.height / 2, c.width - 40);
      setDirty(!!text.trim());
    } else if (initial && initial.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = initial;
    }
  }, [mode, text, kind, initial]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height] as const;
  };

  function done() {
    const c = cv.current!;
    // recorta o espaço vazio à volta
    const ctx = c.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (data[(y * width + x) * 4 + 3] > 10) {
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
    if (x1 <= x0) return;
    const pad = 8;
    const out = Object.assign(document.createElement("canvas"), { width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 });
    out.getContext("2d")!.drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
    onDone(out.toDataURL("image/png"));
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog sigpad" role="dialog" aria-modal="true" aria-label={t(`df.t.${kind}` as never)}>
        <header className="row between">
          {kind !== "drawing" ? (
            <div className="seg" role="group">
              <button aria-pressed={mode === "type"} onClick={() => setMode("type")}>
                {t("sg.type")}
              </button>
              <button aria-pressed={mode === "draw"} onClick={() => setMode("draw")}>
                {t("sg.draw")}
              </button>
            </div>
          ) : (
            <span className="tile-t">{t("df.t.drawing")}</span>
          )}
          <button className="btn ghost" onClick={onClose} aria-label={t("close")}>
            <Icon name="close" />
          </button>
        </header>
        {mode === "type" && <input className="input big" value={text} onChange={(e) => setText(e.target.value)} autoFocus aria-label={t("sg.type")} />}
        <canvas
          ref={cv}
          width={900}
          height={kind === "initials" ? 260 : 300}
          className={`sigpad-cv ${mode}`}
          onPointerDown={(e) => {
            if (mode !== "draw") return;
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const ctx = e.currentTarget.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d")!;
            const [x, y] = pos(e);
            ctx.lineWidth = 4.5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "#111";
            ctx.lineTo(x, y);
            ctx.stroke();
            setDirty(true);
          }}
          onPointerUp={() => (drawing.current = false)}
        />
        <div className="row between">
          <button
            className="btn ghost small"
            onClick={() => {
              cv.current?.getContext("2d")!.clearRect(0, 0, 900, 300);
              setDirty(false);
              if (mode === "type") setText("");
            }}
          >
            <Icon name="trash" size={13} /> {t("sg.clear")}
          </button>
          <button className="btn accent" onClick={done} disabled={!dirty} data-testid="sig-done">
            <Icon name="check" size={14} /> {t("sg.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
