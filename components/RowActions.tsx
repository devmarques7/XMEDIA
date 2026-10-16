"use client";

// Ações por linha, iguais em todas as tabelas: no computador um único botão "⋯" (menu com ver, editar, excluir…);
// no telemóvel a linha mostra só o nome e, ao tocar, expande com os detalhes e as ações em botões grandes.
// Cada ação pode ser escondida pela permissão (role) de quem está a ver.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { useT } from "@/lib/i18n";

export type RowAction = {
  key: string;
  label: string;
  icon?: IconName;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  danger?: boolean;
  /** false = sem permissão (não aparece). */
  allowed?: boolean;
  /** Pergunta antes de executar (ex.: excluir). */
  confirm?: string;
};

const visible = (a: RowAction[]) => a.filter((x) => x.allowed !== false);

function run(a: RowAction) {
  if (a.confirm && !window.confirm(a.confirm)) return;
  a.onClick?.();
}

/** Botão "⋯" com o menu de ações (computador). */
export function RowActions({ actions, label }: { actions: RowAction[]; label?: string }) {
  const { t } = useT();
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
  const list = visible(actions);
  if (!list.length) return null;
  return (
    <div className="menuwrap ra" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button className="ra-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={label ?? t("ra.actions")} data-testid="row-actions">
        <Icon name="more" size={18} />
      </button>
      {open && (
        <div className="menu menu-right" role="menu">
          {list.map((a) =>
            a.href ? (
              <Link key={a.key} role="menuitem" href={a.href} target={a.external ? "_blank" : undefined} rel={a.external ? "noreferrer" : undefined} onClick={() => setOpen(false)}>
                {a.icon && <Icon name={a.icon} size={16} />} {a.label}
              </Link>
            ) : (
              <button
                key={a.key}
                role="menuitem"
                className={a.danger ? "danger" : ""}
                onClick={() => {
                  setOpen(false);
                  run(a);
                }}
                data-testid={`ra-${a.key}`}
              >
                {a.icon && <Icon name={a.icon} size={16} />} {a.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Ações em botões grandes, dentro da linha expandida (telemóvel). */
export function ExpandedActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="ra-exp" onClick={(e) => e.stopPropagation()}>
      {visible(actions).map((a) =>
        a.href ? (
          <Link key={a.key} className={`btn ${a.key === "open" ? "accent" : ""}`} href={a.href} target={a.external ? "_blank" : undefined} rel={a.external ? "noreferrer" : undefined}>
            {a.icon && <Icon name={a.icon} size={15} />} {a.label}
          </Link>
        ) : (
          <button key={a.key} className={`btn ${a.danger ? "danger" : ""}`} onClick={() => run(a)}>
            {a.icon && <Icon name={a.icon} size={15} />} {a.label}
          </button>
        )
      )}
    </div>
  );
}

const MOBILE = "(max-width: 760px)";
/** Clique na linha: no telemóvel expande/recolhe; no computador abre (fallback). */
export function useRowExpand() {
  const [openId, setOpenId] = useState<string | null>(null);
  const onRow = useCallback((id: string, open?: () => void) => {
    if (typeof window !== "undefined" && window.matchMedia(MOBILE).matches) setOpenId((x) => (x === id ? null : id));
    else open?.();
  }, []);
  return { isOpen: (id: string) => openId === id, onRow };
}
