"use client";

// Seletor de idioma global (o mesmo do dashboard): ícone do globo + código; menu com todas as LANGS.
// Usado na app, no portal e em todas as páginas de entrada — cresce sozinho quando se acrescenta uma língua.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { LANGS, LANG_NAMES, useT } from "@/lib/i18n";

export function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function LangMenu() {
  const { lang, setLang, t } = useT();
  const { open, setOpen, ref } = useMenu();
  return (
    <div className="menuwrap" ref={ref}>
      <button className="iconpill" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t("lang.label")} title={t("lang.label")} data-testid="lang-menu">
        <Icon name="globe" size={17} />
        <span className="mono">{lang.toUpperCase()}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          {LANGS.map((l) => (
            <button
              key={l}
              role="menuitemradio"
              aria-checked={lang === l}
              onClick={() => {
                setLang(l);
                setOpen(false);
              }}
            >
              <span className="mono small">{l.toUpperCase()}</span> {LANG_NAMES[l]} {lang === l && <span className="menu-check"><Icon name="check" size={14} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
