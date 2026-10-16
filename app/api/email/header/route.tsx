import { ImageResponse } from "next/og";
import { LOGO_PATH, LOGO_VIEWBOX } from "@/components/Logo";

export const runtime = "edge";

/**
 * Cabeçalho dos emails (1200×520): a mesma arte em gradiente da página de login, como imagem
 * — os clientes de email não suportam gradientes/blur em CSS de forma fiável.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const label = (q.get("label") || "CLIENT PORTAL").slice(0, 40).toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          color: "#fff",
          backgroundColor: "#1a0b08",
          backgroundImage: [
            "radial-gradient(circle at 28% 78%, #ff8a1e 0%, rgba(255,120,30,0.55) 28%, rgba(255,120,30,0) 55%)",
            "radial-gradient(circle at 58% 38%, #c9c3bb 0%, rgba(184,179,173,0.5) 22%, rgba(184,179,173,0) 45%)",
            "radial-gradient(circle at 88% 90%, #9e1f12 0%, rgba(158,31,18,0) 45%)",
            "linear-gradient(165deg, #140c0a 0%, #3a1912 35%, #c2381f 72%, #1a0807 100%)",
          ].join(", "),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width={44} height={44} viewBox={LOGO_VIEWBOX}>
            <path d={LOGO_PATH} fill="#ffffff" />
          </svg>
          <span style={{ fontSize: 40, letterSpacing: 2 }}>XMEDIA</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 26, letterSpacing: 6, opacity: 0.85 }}>{label}</span>
          <span style={{ fontSize: 30, opacity: 0.8 }}>MediaMarques · Brand Elevation Studio</span>
        </div>
      </div>
    ),
    { width: 1200, height: 520, headers: { "cache-control": "public, max-age=86400, immutable" } }
  );
}
