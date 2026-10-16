"use client";

// Arrastar cartões entre colunas de qualquer quadro (conteúdos, tarefas, campanhas) — rato e toque.
// Enquanto arrasta: um "fantasma" segue o ponteiro, as outras colunas ficam esbatidas e a coluna de destino
// fica em destaque (opacity 1). Ao soltar chama onDrop(id, coluna). No toque, começa com um toque longo.
import { useCallback, useEffect, useRef, useState } from "react";

type Drag = { id: string; from: string };

export function useBoardDrag({ onDrop, canDrop, disabled }: { onDrop: (id: string, to: string, from: string) => unknown; canDrop?: (id: string, to: string, from: string) => boolean; disabled?: boolean }) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const st = useRef<{ drag: Drag | null; over: string | null; ghost: HTMLElement | null; dx: number; dy: number; scroller: HTMLElement | null }>({ drag: null, over: null, ghost: null, dx: 0, dy: 0, scroller: null });
  const cb = useRef({ onDrop, canDrop });
  cb.current = { onDrop, canDrop };

  const allowed = useCallback((to: string) => {
    const d = st.current.drag;
    return !!d && to !== d.from && (cb.current.canDrop?.(d.id, to, d.from) ?? true);
  }, []);

  const end = useCallback((commit: boolean) => {
    const s = st.current;
    s.ghost?.remove();
    if (commit && s.drag && s.over && allowed(s.over)) cb.current.onDrop(s.drag.id, s.over, s.drag.from);
    if (s.drag) {
      // o click que segue o pointerup não deve abrir o cartão
      const stop = (e: Event) => (e.stopPropagation(), e.preventDefault());
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 50);
    }
    s.drag = null;
    s.over = null;
    s.ghost = null;
    document.body.classList.remove("kb-body-drag");
    setDrag(null);
    setOver(null);
  }, [allowed]);

  useEffect(() => () => end(false), [end]);

  function start(el: HTMLElement, id: string, from: string, x: number, y: number) {
    const r = el.getBoundingClientRect();
    const g = el.cloneNode(true) as HTMLElement;
    g.classList.add("kb-ghost");
    Object.assign(g.style, { width: `${r.width}px`, left: "0px", top: "0px", transform: `translate(${r.left}px, ${r.top}px) rotate(2deg)` });
    document.body.appendChild(g);
    st.current = { ...st.current, drag: { id, from }, over: from, ghost: g, dx: x - r.left, dy: y - r.top, scroller: el.closest<HTMLElement>("[data-kb-scroll]") };
    document.body.classList.add("kb-body-drag");
    navigator.vibrate?.(8);
    setDrag({ id, from });
    setOver(from);
  }

  function move(x: number, y: number) {
    const s = st.current;
    if (!s.ghost) return;
    s.ghost.style.transform = `translate(${x - s.dx}px, ${y - s.dy}px) rotate(2deg)`;
    const col = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-kb-col]")?.dataset.kbCol ?? null;
    if (col !== s.over) (s.over = col), setOver(col);
    const sc = s.scroller;
    if (sc) {
      const r = sc.getBoundingClientRect();
      if (x < r.left + 48) sc.scrollBy({ left: -18 });
      else if (x > r.right - 48) sc.scrollBy({ left: 18 });
    }
  }

  /** Props para cada cartão arrastável. */
  function card(id: string, from: string) {
    return {
      "data-kb-card": id,
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (disabled || e.button !== 0 || (e.target as HTMLElement).closest("button, a, input, textarea, select, [data-no-drag]")) return;
        const el = e.currentTarget;
        const x0 = e.clientX, y0 = e.clientY;
        const touch = e.pointerType !== "mouse";
        let started = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        if (touch) timer = setTimeout(() => ((started = true), start(el, id, from, x0, y0)), 280);
        const onMove = (ev: PointerEvent) => {
          if (!started) {
            const far = Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6;
            if (touch) return far && (clearTimeout(timer), cleanup()); // toque: mexer antes do toque longo = scroll
            if (!far) return;
            started = true;
            start(el, id, from, x0, y0);
          }
          move(ev.clientX, ev.clientY);
        };
        const onTouchMove = (ev: TouchEvent) => started && ev.preventDefault();
        const onUp = () => (clearTimeout(timer), cleanup(), started && end(true));
        const onCancel = () => (clearTimeout(timer), cleanup(), started && end(false));
        const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onCancel();
        function cleanup() {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          window.removeEventListener("keydown", onKey);
          window.removeEventListener("touchmove", onTouchMove);
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
        window.addEventListener("keydown", onKey);
        window.addEventListener("touchmove", onTouchMove, { passive: false });
      },
      className: drag?.id === id ? "kb-src" : "",
    };
  }

  /** Props para cada coluna (destino). */
  function col(id: string) {
    const dragging = !!drag;
    const ok = dragging && (id === drag!.from || allowed(id));
    return {
      "data-kb-col": id,
      className: dragging ? `kb-col ${over === id ? (ok ? "kb-over" : "kb-deny") : ""} ${ok ? "" : "kb-no"} ${id === drag!.from ? "kb-from" : ""}` : "kb-col",
    };
  }

  return { drag, over, card, col, board: drag ? "kb-dragging" : "", canDropHere: (id: string) => !!drag && allowed(id) };
}
