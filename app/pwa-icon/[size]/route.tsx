import { ImageResponse } from "next/og";

/** Ícone XMEDIA em PNG (PWA / iOS), desenhado a partir do logo. */
export function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  return params.then(({ size }) => {
    const s = Math.min(1024, Math.max(32, parseInt(size, 10) || 512));
    const maskable = new URL(req.url).searchParams.has("maskable");
    const d = Math.round(s * (maskable ? 0.56 : 0.72)); // diâmetro do círculo
    const side = Math.round(d * 0.68);
    return new ImageResponse(
      (
        <div style={{ width: s, height: s, background: "#0b0b0b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: d, height: d, borderRadius: d, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: side, height: side, borderRadius: Math.round(d * 0.11), background: "#0b0b0b", transform: "rotate(45deg)" }} />
          </div>
        </div>
      ),
      { width: s, height: s, headers: { "Cache-Control": "public, max-age=31536000, immutable" } }
    );
  });
}
