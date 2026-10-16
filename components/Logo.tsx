/** Logo XMEDIA: círculo com um quadrado arredondado (losango) recortado. */
export function Logo({ size = 28, color = "currentColor", title = "XMEDIA" }: { size?: number; color?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={title}>
      <defs>
        <mask id="xmedia-cut">
          <rect width="100" height="100" fill="#fff" />
          <rect x="16" y="16" width="68" height="68" rx="11" transform="rotate(45 50 50)" fill="#000" />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="50" fill={color} mask="url(#xmedia-cut)" />
    </svg>
  );
}

/** Mesmo desenho como string, para ícones gerados (PWA / favicon). */
export const LOGO_SVG = (fg = "#ffffff", bg = "#0b0b0b", pad = 0) => {
  const s = 100 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${s} ${s}"><rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" fill="${bg}"/><path fill="${fg}" fill-rule="evenodd" d="M50 0a50 50 0 1 1 0 100A50 50 0 1 1 50 0Z ${diamond()}"/></svg>`;
};

// losango arredondado (quadrado 68 rodado 45°, raio 11) como path, para o evenodd
function diamond() {
  const c = 50,
    h = (68 * Math.SQRT2) / 2, // meia-diagonal
    r = 11,
    k = r * Math.SQRT2; // recuo do vértice
  const top = c - h,
    bot = c + h,
    left = c - h,
    right = c + h;
  const d = (n: number) => n.toFixed(2);
  return [
    `M${d(c - k / 2)} ${d(top + k / 2)}`,
    `Q${d(c)} ${d(top)} ${d(c + k / 2)} ${d(top + k / 2)}`,
    `L${d(right - k / 2)} ${d(c - k / 2)}`,
    `Q${d(right)} ${d(c)} ${d(right - k / 2)} ${d(c + k / 2)}`,
    `L${d(c + k / 2)} ${d(bot - k / 2)}`,
    `Q${d(c)} ${d(bot)} ${d(c - k / 2)} ${d(bot - k / 2)}`,
    `L${d(left + k / 2)} ${d(c + k / 2)}`,
    `Q${d(left)} ${d(c)} ${d(left + k / 2)} ${d(c - k / 2)}`,
    "Z",
  ].join(" ");
}
