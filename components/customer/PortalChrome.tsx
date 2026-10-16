"use client";

// Moldura dos ecrãs de entrada do portal (convite, código, login) no estilo do login XMEDIA.
import { Logo } from "@/components/Logo";
import { LangSwitch, ThemeToggle } from "@/components/ui";
import { useT, type Key } from "@/lib/i18n";

export function EntryFrame({ children, step }: { children: React.ReactNode; step?: 1 | 2 | 3 }) {
  const { t } = useT();
  return (
    <main className="login po-entry">
      <header className="login-top">
        <span className="row" style={{ gap: 10 }}>
          <Logo size={24} />
          <span className="label">[MEDIAMARQUES]</span>
        </span>
        <span className="row" style={{ gap: 8 }}>
          <LangSwitch />
          <ThemeToggle />
        </span>
      </header>
      <section className="login-center">
        {step && (
          <ol className="po-steps" aria-label="steps">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className={n < step ? "done" : n === step ? "now" : ""}>
                <span className="mono">{n}</span> {t(`po.step${n}` as Key)}
              </li>
            ))}
          </ol>
        )}
        {children}
      </section>
      <footer className="muted small" style={{ textAlign: "center" }}>
        MediaMarques · Brand Elevation Studio · Amsterdam
      </footer>
    </main>
  );
}

/** Traduz um código de erro da API (po.err.*), com o texto original como alternativa. */
export function useErr() {
  const { t } = useT();
  return (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e ?? "");
    const k = `po.err.${m}` as Key;
    const s = t(k);
    return s === k ? m : s;
  };
}
