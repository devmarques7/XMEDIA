"use client";

// Moldura das páginas de entrada (login, convites): arte em gradiente à esquerda e conteúdo à direita.
import { Logo } from "@/components/Logo";
import { LangSwitch, ThemeToggle } from "@/components/ui";
import { useT } from "@/lib/i18n";

export function AuthSplit({ top, children }: { top?: React.ReactNode; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <main className="lg2">
      <aside className="lg2-art" aria-hidden>
        <div className="lg2-grain" />
        <div className="lg2-brand">
          <Logo size={26} color="#fff" />
          <span>XMEDIA</span>
        </div>
        <blockquote className="lg2-quote">
          <p>{t("au.quote")}</p>
          <span>{t("au.who")}</span>
        </blockquote>
      </aside>
      <section className="lg2-main">
        <header className="lg2-top">
          <span className="label">{top}</span>
          <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
            <LangSwitch />
            <ThemeToggle />
          </span>
        </header>
        <div className="lg2-box">{children}</div>
      </section>
    </main>
  );
}
