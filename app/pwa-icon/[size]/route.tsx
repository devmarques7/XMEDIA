import { ImageResponse } from "next/og";
import { LOGO_PATH, LOGO_VIEWBOX } from "@/components/Logo";

/** Ícone XMEDIA em PNG (PWA / iOS / logo dos emails): logo branco sobre fundo escuro, legível em tema claro e escuro. */
export function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  return params.then(({ size }) => {
    const s = Math.min(1024, Math.max(32, parseInt(size, 10) || 512));
    const maskable = new URL(req.url).searchParams.has("maskable");
    const mark = Math.round(s * (maskable ? 0.46 : 0.58)); // maskable: o sistema corta até 20% de cada lado
    return new ImageResponse(
      (
        <div style={{ width: s, height: s, background: "#0b0b0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={mark} height={mark} viewBox={LOGO_VIEWBOX}>
            <path d={LOGO_PATH} fill="#ffffff" />
          </svg>
        </div>
      ),
      { width: s, height: s, headers: { "Cache-Control": "public, max-age=31536000, immutable" } }
    );
  });
}
