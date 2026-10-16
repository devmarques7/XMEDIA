import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

// Envio de vídeo numa proposta → ficheiro no Storage (bucket proposal-media) + URL guardada na tabela proposals.
// Só corre contra o Supabase LOCAL (npm run db:start): lê o banco com a service role local para confirmar.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EMAIL = process.env.E2E_EMAIL ?? "contact@mediamarques.com";
const CODE = process.env.E2E_CODE ?? "123456";
const VIDEO = path.join(__dirname, "fixtures", "teste.mp4");

test.skip(!/127\.0\.0\.1|localhost/.test(SUPABASE_URL), "este teste escreve no banco: só no Supabase local");

test("vídeo enviado fica guardado no Storage e no banco", async ({ page }) => {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  await test.step("login de admin (email + código)", async () => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByTestId("login-email").fill(EMAIL);
    await page.getByRole("button", { name: /continue with email|continuar com email/i }).click();
    await page.keyboard.type(CODE);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/home/);
  });

  const id = await test.step("nova proposta", async () => {
    await page.goto("/propostas", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^\+ / }).first().click();
    await page.waitForURL(/\/propostas\/[0-9a-f-]{36}$/);
    await page.waitForLoadState("networkidle");
    return page.url().split("/").pop()!;
  });

  const uploaded = page.waitForResponse((r) => r.url().includes("/storage/v1/object/proposal-media/") && r.request().method() === "POST");
  await test.step("enviar vídeo", async () => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByText(/drag several images and videos/i).click();
    await (await chooser).setFiles(VIDEO);
    expect((await uploaded).ok()).toBeTruthy();
  });

  await test.step("ficheiro existe no Storage", async () => {
    const { data, error } = await db.storage.from("proposal-media").list(id);
    expect(error).toBeNull();
    expect(data?.some((f) => f.name.endsWith(".mp4"))).toBeTruthy();
  });

  await test.step("URL guardada na proposta (banco)", async () => {
    await expect
      .poll(async () => {
        const { data } = await db.from("proposals").select("data").eq("id", id).single();
        return JSON.stringify(data?.data ?? {});
      }, { timeout: 30_000 })
      .toContain(`/proposal-media/${id}/`);
  });

  await test.step("vídeo continua lá depois de recarregar", async () => {
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator(`video[src*="/proposal-media/${id}/"], source[src*="/proposal-media/${id}/"]`).first()).toBeAttached();
  });
});
