import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "XMEDIA",
    short_name: "XMEDIA",
    description: "Pre-production & shoot checklist",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [
      { src: "/pwa-icon/192?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1&v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
