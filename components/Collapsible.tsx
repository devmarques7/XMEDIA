"use client";

// Secção colapsável: aberta no computador, fechada no telemóvel (abre ao tocar no cabeçalho).
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Collapsible({ title, count, right, children, className = "", mobileOpen = false, testId }: { title: ReactNode; count?: number; right?: ReactNode; children: ReactNode; className?: string; mobileOpen?: boolean; testId?: string }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setOpen(mobileOpen);
  }, [mobileOpen]);
  return (
    <section className={`clp ${open ? "open" : ""} ${className}`} data-testid={testId}>
      <header className="clp-h">
        <button className="clp-t" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="tile-t">{title}</span>
          {count !== undefined && <span className="clp-n mono">{String(count).padStart(2, "0")}</span>}
          <Icon name="chevronDown" size={15} className="clp-chev" />
        </button>
        {open && right}
      </header>
      {open && <div className="clp-b">{children}</div>}
    </section>
  );
}
