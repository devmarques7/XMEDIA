// Logo XMEDIA: um "X" numa grelha 3×3 (células de 46, espaço de 8 → 154). Os quadrados soltos (cima-esquerda e
// baixo-direita) arredondam o canto virado para o centro; a diagonal ↗ liga canto → centro → canto por "pescoços"
// de arcos côncavos (raio 28). Uma só cor (currentColor) → acompanha o tema claro/escuro sem variantes.

export const LOGO_VIEWBOX = "0 0 154 154";
export const LOGO_PATH =
  "M1 0H45Q46 0 46 1V38Q46 46 38 46H1Q0 46 0 45V1Q0 0 1 0Z" +
  "M109 0H153Q154 0 154 1V45Q154 46 153 46H128A28 28 0 0 0 100 74V99Q100 100 99 100H74A28 28 0 0 0 46 128V153Q46 154 45 154H1Q0 154 0 153V109Q0 108 1 108H26A28 28 0 0 0 54 80V55Q54 54 55 54H80A28 28 0 0 0 108 26V1Q108 0 109 0Z" +
  "M116 108H153Q154 108 154 109V153Q154 154 153 154H109Q108 154 108 153V116Q108 108 116 108Z";

export function Logo({ size = 28, color = "currentColor", title = "XMEDIA" }: { size?: number; color?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox={LOGO_VIEWBOX} role="img" aria-label={title} style={{ flex: "none" }}>
      <path d={LOGO_PATH} fill={color} />
    </svg>
  );
}

/** O logo como SVG em texto (ícones gerados, ficheiros). `pad` em unidades do desenho (154 = largura do logo). */
export const LOGO_SVG = (fg = "#ffffff", bg = "#0b0b0b", pad = 0) => {
  const s = 154 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${s} ${s}"><rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" fill="${bg}"/><path fill="${fg}" d="${LOGO_PATH}"/></svg>`;
};
