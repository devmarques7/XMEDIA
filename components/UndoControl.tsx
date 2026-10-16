"use client";

// Desfazer / refazer em toda a app: botões no cabeçalho + atalhos (⌘/Ctrl+Z, ⌘/Ctrl+Shift+Z ou Ctrl+Y). Dentro de um
// campo de texto o atalho continua a ser o do próprio campo. Depois de desfazer, a página recarrega com os dados certos.
import { Redo2, Undo2 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { journal, type Change } from "@/lib/journal";
import { useT, type Key } from "@/lib/i18n";

const LS_MSG = "xmedia:undo:msg";
const editable = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']");

export function UndoControl() {
  const { t } = useT();
  const snap = useSyncExternalStore(journal.subscribe, () => `${journal.last()?.at ?? 0}:${journal.canUndo()}:${journal.canRedo()}`, () => "0:false:false");
  void snap;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const what = (c: Change | null) => (c ? `${t(`un.e.${c.entity}` as Key)}${c.label ? ` · ${c.label}` : ""}` : "");

  async function run(kind: "undo" | "redo") {
    if (busy || !(kind === "undo" ? journal.canUndo() : journal.canRedo())) return;
    setBusy(true);
    try {
      const c = kind === "undo" ? await journal.undo() : await journal.redo();
      if (c) {
        try {
          sessionStorage.setItem(LS_MSG, t(kind === "undo" ? "un.undone" : "un.redone", { what: what(c) }));
        } catch {}
        location.reload(); // os ecrãs voltam a ler os dados
      }
    } catch (e) {
      setMsg((e as Error).message);
      setBusy(false);
    }
  }

  useEffect(() => {
    try {
      const m = sessionStorage.getItem(LS_MSG);
      if (m) {
        setMsg(m);
        sessionStorage.removeItem(LS_MSG);
        setTimeout(() => setMsg(""), 4000);
      }
    } catch {}
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || editable(e.target)) return;
      const z = e.key.toLowerCase() === "z";
      if (z && !e.shiftKey) (e.preventDefault(), run("undo"));
      else if ((z && e.shiftKey) || (e.ctrlKey && e.key.toLowerCase() === "y")) (e.preventDefault(), run("redo"));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const last = journal.last();
  const next = journal.next();
  return (
    <>
      <span className="undo-ctl" data-testid="undo-ctl">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="sb-iconbtn" onClick={() => run("undo")} disabled={busy || !journal.canUndo()} aria-label={t("un.undo")} data-testid="undo-btn">
              <Undo2 size={17} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <b>
              {t("un.undo")} <span className="tt-hint">{mac ? "⌘Z" : "Ctrl+Z"}</span>
            </b>
            <span className="tt-sub">{last ? what(last) : t("un.nothing")}</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="sb-iconbtn" onClick={() => run("redo")} disabled={busy || !journal.canRedo()} aria-label={t("un.redo")} data-testid="redo-btn">
              <Redo2 size={17} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <b>
              {t("un.redo")} <span className="tt-hint">{mac ? "⇧⌘Z" : "Ctrl+Y"}</span>
            </b>
            <span className="tt-sub">{next ? what(next) : t("un.nothing")}</span>
          </TooltipContent>
        </Tooltip>
      </span>
      {msg && (
        <div className="toast undo-toast" role="status" data-testid="undo-toast">
          {msg}
        </div>
      )}
    </>
  );
}
