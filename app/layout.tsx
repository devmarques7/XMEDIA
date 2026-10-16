import type { Metadata, Viewport } from "next";
import { Fragment_Mono } from "next/font/google";
import { AppearanceStyle } from "@/components/Appearance";
import { PwaRegister } from "@/components/Pwa";
import { FileDropGuard } from "@/components/FileDropGuard";
import { UpdateBanner } from "@/components/UpdateBanner";
import { UploadTray } from "@/components/UploadTray";
import { APPEARANCE_LS, DEFAULT_APPEARANCE, appearanceCss } from "@/lib/appearance";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

// Tipografia: BioGrotesk (texto, ficheiros carregados na página Aparência) + Fragment Mono (etiquetas e números).
const mono = Fragment_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-fragment", weight: "400" });
const BASE_CSS = appearanceCss(DEFAULT_APPEARANCE);
// aplica a aparência guardada (cores, fontes, tema por omissão) antes de pintar
const BOOT = `try{var a=localStorage.getItem("${APPEARANCE_LS}");if(a){a=JSON.parse(a);var s=document.createElement("style");s.id="xm-appearance";s.textContent=a.css;document.head.appendChild(s)}var t=localStorage.getItem("xmedia:theme")||(a&&a.theme);if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const metadata: Metadata = {
  title: "XMEDIA",
  description: "Pre-production projects, reels and shoot checklist.",
  applicationName: "XMEDIA",
  appleWebApp: { capable: true, title: "XMEDIA", statusBarStyle: "black-translucent" },
  icons: { apple: "/pwa-icon/180?v=2" },
};

export const viewport: Viewport = { themeColor: "#0b0b0b", width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "dark light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" data-theme="dark" className={mono.variable} suppressHydrationWarning>
      <head>
        <style id="xm-base" dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
        {/* aplica a aparência e o tema guardados antes de pintar (evita piscar) */}
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <LangProvider>
          {children}
          <UpdateBanner />
          <UploadTray />
        </LangProvider>
        <AppearanceStyle />
        <PwaRegister />
        <FileDropGuard />
      </body>
    </html>
  );
}
