"use client";

// Brand book em PDF: os mesmos slides 1920×1080 e a mesma impressão das propostas (Guardar como PDF).
// Os dados vêm deste browser (o editor grava-os antes de abrir esta página) — nada passa pelo endereço.
import { Icon } from "@/components/Icon";
import { useEffect, useState } from "react";
import { BRANDBOOK_PRINT_KEY } from "@/components/brand/BrandEditor";
import { BRAND_SLIDES, BrandSlide, useBrandFonts } from "@/components/brand/BrandSlides";
import { emptyBrand, normalizeBrand, type BrandIdentity } from "@/lib/brand";
import { useT } from "@/lib/i18n";

export default function BrandBookPrint() {
  const { t } = useT();
  const [b, setB] = useState<BrandIdentity | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BRANDBOOK_PRINT_KEY);
      const x = raw ? normalizeBrand(JSON.parse(raw)) : emptyBrand("Brand");
      document.title = `${x.name || "Brand"} — Brand Book`;
      setB(x);
    } catch {
      setB(emptyBrand("Brand"));
    }
  }, []);
  useBrandFonts(b ?? emptyBrand());
  useEffect(() => {
    if (!b || new URLSearchParams(location.search).get("noprint")) return;
    const go = () => setTimeout(() => window.print(), 900);
    document.fonts?.ready.then(go) ?? go();
  }, [b]);
  if (!b) return null;
  return (
    <main className="printshell">
      <p className="noprint muted small" style={{ padding: 16 }}>
        {t("br.pdfHint")}{" "}
        <button className="btn small" onClick={() => window.print()}>
          <Icon name="download" size={14} /> PDF
        </button>
      </p>
      <div className="print-all">
        {BRAND_SLIDES.map((k) => (
          <div key={k} className="print-page">
            <BrandSlide k={k} b={b} />
          </div>
        ))}
      </div>
    </main>
  );
}
