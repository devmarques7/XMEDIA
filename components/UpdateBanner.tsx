"use client";

// Aviso de nova versão: depois de um deploy, uma aba aberta continua com o código antigo até recarregar.
// Verifica ao voltar à aba e a cada 5 minutos; um clique recarrega.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n";

const MINE = process.env.NEXT_PUBLIC_BUILD_ID || "";

export function UpdateBanner() {
  const { t } = useT();
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (!MINE) return;
    let last = 0;
    const check = () => {
      if (Date.now() - last < 60_000) return;
      last = Date.now();
      fetch("/api/version", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.build && j.build !== MINE && setStale(true))
        .catch(() => {});
    };
    const vis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("focus", vis);
    const id = setInterval(check, 5 * 60_000);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("focus", vis);
      clearInterval(id);
    };
  }, []);
  if (!stale) return null;
  return (
    <div className="upd" role="status" data-testid="update-banner">
      <Icon name="refresh" size={14} /> {t("upd.text")}
      <button className="btn small accent" onClick={() => location.reload()}>
        {t("upd.reload")}
      </button>
    </div>
  );
}
