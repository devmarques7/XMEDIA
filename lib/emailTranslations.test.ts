// Todos os emails que saem para fora existem em EN, PT e NL: o texto muda com a língua (nada fica por traduzir),
// nenhum marcador {x} fica por preencher e uma língua desconhecida cai em inglês.
import { describe, expect, it } from "vitest";
import type { Lang } from "./i18n";
import { docEmail } from "./docEmail";
import { feedbackEmail } from "./feedbackEmail";
import { inviteEmail } from "./inviteEmail";
import { emptyInvoice } from "./invoice";
import { invoiceEmail } from "./invoiceEmail";
import { portalInviteEmail } from "./portalInviteEmail";
import { proposalEmail } from "./proposalEmail";
import { resetEmail } from "./resetEmail";
import { reviewEmail } from "./reviewEmail";

type Mail = { subject: string; html: string; text: string };
const O = "https://x.app";
const exp = new Date("2026-10-30T12:00:00Z");
const inv = { ...emptyInvoice("Q4 - #0051", "2026-10-14"), btw: 0 as const, client: { name: "ACME", address: "", country: "NL", vat: "", email: "a@b.co" }, items: [{ id: "i", description: "Reel", qty: 1, rate: 100 }] };

const EMAILS: Record<string, (lang: Lang) => Mail> = {
  "team invite": (lang) => inviteEmail({ lang, name: "Ana", inviter: "Daniel", link: `${O}/l`, expiresAt: exp, logoUrl: `${O}/logo.png`, origin: O }),
  "portal invite": (lang) => portalInviteEmail({ lang, name: "Ana", customer: "ACME", email: "a@b.co", link: `${O}/l`, expiresAt: exp, origin: O }),
  "review app": (lang) => reviewEmail({ lang, origin: O, link: `${O}/l`, customer: "ACME", title: "Launch", type: "reel", files: 1, from: "Daniel" }),
  "review onboarding": (lang) => reviewEmail({ lang, origin: O, link: `${O}/l`, customer: "ACME", title: "Launch", type: "carousel", files: 3, from: "Daniel", mode: "onboarding" }),
  feedback: (lang) => feedbackEmail({ lang, name: "Ana", link: `${O}/l`, expires: exp, origin: O, sender: "Daniel", company: "ACME" }),
  proposal: (lang) => proposalEmail({ lang, name: "Ana", title: "Brand film", link: `${O}/l`, linkExpires: exp, origin: O, value: 1000, extras: 2, validUntil: "2026-11-01" }),
  invoice: (lang) => invoiceEmail(inv, { lang, origin: O, name: "Ana" }),
  reset: (lang) => resetEmail({ lang, origin: O, link: `${O}/l` }),
  "doc request": (lang) => docEmail("request", { lang, origin: O, name: "Ana", title: "Contract", from: "Daniel", link: `${O}/l` }),
  "doc otp": (lang) => docEmail("otp", { lang, origin: O, name: "Ana", title: "Contract", from: "Daniel", code: "123456" }),
  "doc completed": (lang) => docEmail("completed", { lang, origin: O, name: "Ana", title: "Contract", from: "Daniel", link: `${O}/l` }),
};

describe("traduções de todos os emails", () => {
  for (const [name, build] of Object.entries(EMAILS)) {
    it(name, () => {
      const m = { en: build("en"), pt: build("pt"), nl: build("nl") };
      for (const x of Object.values(m)) {
        expect(x.subject.trim()).not.toBe("");
        expect(x.html).not.toMatch(/\{[a-z]\w*\}/i);
        expect(x.text).not.toMatch(/\{[a-z]\w*\}/i);
      }
      expect(m.pt.subject).not.toBe(m.en.subject);
      expect(m.nl.subject).not.toBe(m.en.subject);
      expect(m.pt.text).not.toBe(m.en.text);
      expect(m.nl.text).not.toBe(m.en.text);
      expect(build("xx" as Lang).subject).toBe(m.en.subject); // inglês por omissão
    });
  }
});
