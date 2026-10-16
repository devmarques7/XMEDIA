"use client";

// Pré-visualização do modelo único de emails (lib/email/layout.ts) com dados de exemplo, em PT/EN/NL.
// Mostra exatamente o HTML que é enviado, para validar o design antes de mandar convites ou avaliações.
import { useMemo, useState } from "react";
import { Select } from "@/components/Select";
import { bookingEmail, declineEmail } from "@/lib/decision";
import { feedbackEmail } from "@/lib/feedbackEmail";
import type { Lang } from "@/lib/i18n";
import { useT, type Key } from "@/lib/i18n";
import { inviteEmail } from "@/lib/inviteEmail";
import { portalInviteEmail } from "@/lib/portalInviteEmail";
import { proposalEmail } from "@/lib/proposalEmail";
import { resetEmail } from "@/lib/resetEmail";

const KINDS = ["team", "portal", "reset", "proposal", "feedback", "booking", "decline"] as const;
type Kind = (typeof KINDS)[number];

export function EmailPreview() {
  const { t, lang: uiLang } = useT();
  const [kind, setKind] = useState<Kind>("team");
  const [lang, setLang] = useState<Lang>(uiLang);
  const mail = useMemo(() => {
    const origin = typeof window === "undefined" ? "" : location.origin;
    const in7 = new Date(Date.now() + 7 * 86_400_000);
    const link = `${origin}/exemplo/abc123`;
    switch (kind) {
      case "team":
        return inviteEmail({ lang, name: "Ana", inviter: "Daniel Marques", link, expiresAt: in7, logoUrl: `${origin}/pwa-icon/128`, origin });
      case "reset":
        return resetEmail({ lang, origin, link });
      case "portal":
        return portalInviteEmail({ lang, name: "Gabriel", customer: "Sanctum BV", email: "gabriel@exemplo.com", link, expiresAt: in7, origin });
      case "proposal":
        return proposalEmail({ lang, name: "Gabriel", title: "Brand Film 2026", link, linkExpires: in7, origin, value: 5950, extras: 2, message: "" });
      case "feedback":
        return feedbackEmail({ lang, name: "Gabriel", link, expires: in7, origin, company: "Sanctum BV" });
      case "booking":
        return bookingEmail({ name: "Gabriel", title: "Brand Film 2026", link, origin, booking: { date: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10), time: "09:00", place: "Amsterdam" } });
      case "decline":
        return declineEmail({ name: "Gabriel", title: "Brand Film 2026", link, origin });
    }
  }, [kind, lang]);
  const oneLang = kind === "booking" || kind === "decline";

  return (
    <div className="emp">
      <div className="row between" style={{ gap: 10, flexWrap: "wrap" }}>
        <Select className="select" value={kind} onChange={(e) => setKind(e.target.value as Kind)} style={{ width: 240 }} aria-label={t("em.kind")}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`em.k.${k}` as Key)}
            </option>
          ))}
        </Select>
        <div className="seg" role="group" aria-label="lang">
          {(["pt", "en", "nl"] as Lang[]).map((l) => (
            <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} disabled={oneLang}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <p className="small" style={{ margin: 0 }}>
        <span className="label muted">{t("em.subject")}</span> {mail.subject}
      </p>
      <iframe className="emp-frame" title={mail.subject} srcDoc={mail.html} sandbox="allow-same-origin allow-popups" data-testid="email-preview" />
    </div>
  );
}
