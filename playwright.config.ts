import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// mesmas variáveis que o next dev (Supabase local) para os testes lerem o banco
if (!process.env.BASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

// Testes E2E visíveis (janela do Chromium aberta).
// BASE_URL=https://<domínio> aponta para produção; sem ela usa o `next dev` local.
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/, // não colide com os *.test.ts do vitest
  timeout: 5 * 60_000, // envios de vídeo podem demorar
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: !!process.env.HEADLESS, // HEADLESS=1 para correr sem janela
    launchOptions: { slowMo: 150 },
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL ? undefined : { command: "npm run dev", url: baseURL, reuseExistingServer: true },
});
