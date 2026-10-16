"use client";

import { Icon } from "@/components/Icon";
import Link from "next/link";
import { Logo } from "./Logo";
import { useEffect, useState } from "react";
import { LANGS, LANG_NAMES, useT, type Lang } from "@/lib/i18n";
import { Select } from "@/components/Select";
import { LangMenu } from "./LangMenu";
import { isLocalMode, store } from "@/lib/store";
import { supabase, supabaseEnabled } from "@/lib/supabase/client";
import type { Block } from "@/lib/types";
import { at, fmtDate, fmtDuration, isoDay, pad, toMin } from "@/lib/util";

// ---------- hooks ----------
/** Hora atual, atualizada a cada segundo. null antes de montar (evita mismatch SSR). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type User = { name: string; email: string; avatar?: string };
/** Utilizador: perfil guardado tem prioridade sobre os dados da conta Google. */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    (async () => {
      let base: User = { name: "", email: "" };
      if (supabaseEnabled) {
        const { data } = await supabase().auth.getUser();
        const u = data.user;
        if (u) {
          const m = u.user_metadata ?? {};
          base = { name: m.full_name || m.name || u.email?.split("@")[0] || "", email: u.email ?? "", avatar: m.avatar_url };
        }
      }
      const p = await store.profile().catch(() => null);
      setUser({ ...base, name: p?.display_name || base.name, avatar: p?.avatar_url || base.avatar });
    })();
  }, []);
  return user;
}

export function useToast() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2800);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg] as const;
}

export function Toast({ msg }: { msg: string }) {
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

// ---------- header ----------
/** Seletor de idioma — o mesmo menu com o globo em todo o sistema (app, portal, páginas de entrada). */
export function LangSwitch() {
  return <LangMenu />;
}

/** Seletor compacto de língua (lista de LANGS — cresce sozinho quando se acrescenta uma língua). */
export function LangSelect({ className = "" }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <Select className={`select lang-sel ${className}`} value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language" data-testid="lang-select">
      {LANGS.map((l) => (
        <option key={l} value={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </Select>
  );
}

/** Tema: escuro (padrão) ou claro editorial. Guardado neste navegador. */
export function useTheme() {
  const [theme, setThemeState] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setThemeState(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const setTheme = (t: "dark" | "light") => {
    document.documentElement.dataset.theme = t;
    setThemeState(t);
    try {
      localStorage.setItem("xmedia:theme", t);
    } catch {}
  };
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

export function ThemeToggle() {
  const { t } = useT();
  const { theme, toggle } = useTheme();
  return (
    <button className="themetoggle" onClick={toggle} aria-label={theme === "dark" ? t("theme.light") : t("theme.dark")} title={theme === "dark" ? t("theme.light") : t("theme.dark")}>
      <span aria-hidden>{theme === "dark" ? "○" : "●"}</span>
    </button>
  );
}

export function Avatar({ user }: { user: User | null }) {
  const initials = (user?.name || "·")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="avatar">
      {user?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar} alt="" width={36} height={36} referrerPolicy="no-referrer" />
      ) : (
        initials
      )}
    </span>
  );
}

// Navegação e estrutura da área privada: ver ./Shell.tsx
export { AppShell, Header } from "./Shell";

// ---------- visual primitives (dot-matrix) ----------
/** Grelha de pontos: os primeiros `filled` ficam acesos. */
export function DotGrid({
  total,
  filled,
  cols = 12,
  color = "var(--yellow)",
  size = 7,
  gap = 6,
}: {
  total: number;
  filled: number;
  cols?: number;
  color?: string;
  size?: number;
  gap?: number;
}) {
  const n = Math.max(total, cols * 4);
  return (
    <div
      aria-hidden
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap, direction: "ltr" }}
    >
      {Array.from({ length: n }, (_, i) => {
        // acende de baixo para cima, como na referência
        const row = Math.floor(i / cols);
        const rows = Math.ceil(n / cols);
        const idx = (rows - 1 - row) * cols + (i % cols);
        const on = idx < filled;
        const exists = idx < total;
        return (
          <span
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              background: on ? color : exists ? "#3a3a3a" : "#222",
            }}
          />
        );
      })}
    </div>
  );
}

/** Anel de pontos (ref. "Device overview"). value 0..1 = fração acesa. */
export function DotRing({
  value,
  size = 180,
  dots = 72,
  color = "var(--accent)",
  children,
}: {
  value: number;
  size?: number;
  dots?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = size / 2 - 8;
  const lit = Math.round(Math.min(1, Math.max(0, value)) * dots);
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {Array.from({ length: dots }, (_, i) => {
          const a = (i / dots) * Math.PI * 2 - Math.PI / 2;
          const on = i < lit;
          return (
            <line
              key={i}
              x1={size / 2 + Math.cos(a) * (r - 10)}
              y1={size / 2 + Math.sin(a) * (r - 10)}
              x2={size / 2 + Math.cos(a) * r}
              y2={size / 2 + Math.sin(a) * r}
              stroke={on ? color : "#3a3a3a"}
              strokeWidth={on ? 2.6 : 2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>{children}</div>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- relógio (ref. "Tuesday 17 / 08:26 43") ----------
export function ClockWidget({
  sessions,
  day,
  isToday,
}: {
  sessions: { id: string; label: string; start: string; end: string }[];
  day: string | null;
  isToday: boolean;
}) {
  const { t, locale } = useT();
  const now = useNow();
  const from = 6 * 60,
    to = 22 * 60;
  const x = (min: number) => `${((Math.min(to, Math.max(from, min)) - from) / (to - from)) * 100}%`;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0;

  return (
    <div className="w span-5" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="w-head">
        <span className="label">
          <b>01</b>
          {t("w.clock")}
        </span>
        <span className="label muted">{now ? Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop() : ""}</span>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500 }}>
        {now ? cap(now.toLocaleDateString(locale, { weekday: "long", day: "numeric" })) : " "}
      </div>
      <div className="row" style={{ alignItems: "flex-start", gap: 10, flexWrap: "nowrap" }}>
        <span
          className="mono"
          style={{ fontSize: "clamp(64px, 9vw, 104px)", fontWeight: 200, lineHeight: 0.9, letterSpacing: "-0.04em" }}
        >
          {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : "--:--"}
        </span>
        <span className="mono" style={{ fontSize: 26, fontWeight: 200 }}>
          {now ? pad(now.getSeconds()) : ""}
        </span>
      </div>

      <div className="row between">
        <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
          {day ? (isToday ? t("w.today") : `${t("w.next")} · ${fmtDate(day, locale, { weekday: "short", day: "2-digit", month: "short" })}`) : t("w.nothingScheduled")}
        </span>
        <span className="pill accent">{t("w.sessions", { n: sessions.length })}</span>
      </div>
      {/* barra do dia com as sessões (ref. barra de sono laranja) */}
      <div style={{ background: "var(--accent)", color: "var(--accent-ink)", borderRadius: 18, padding: "16px 18px 14px" }}>
        <div style={{ position: "relative", height: 62 }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 28,
              height: 8,
              backgroundImage: "repeating-linear-gradient(90deg, rgba(0,0,0,.55) 0 1px, transparent 1px 5px)",
            }}
          />
          {sessions.map((s) => {
            const a = toMin(s.start),
              b = toMin(s.end);
            if (a === null) return null;
            return (
              <div key={s.id} style={{ position: "absolute", left: x(a), width: `calc(${x(b ?? a + 60)} - ${x(a)})`, top: 0 }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
                  {s.start}
                </div>
                <div style={{ height: 6, background: "var(--accent-ink)", marginTop: 9, borderRadius: 3 }} />
                <div className="label" style={{ marginTop: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.label}
                </div>
              </div>
            );
          })}
          {isToday && now && nowMin >= from && nowMin <= to && (
            <div style={{ position: "absolute", left: x(nowMin), top: 18, bottom: 18, width: 2, background: "#fff" }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- temporizador de sessão ----------
type Manual = { startedAt: number; minutes: number };
const manualKey = (id: string) => `preprod:timer:${id}`;
function readManual(id: string): Manual | null {
  try {
    return JSON.parse(localStorage.getItem(manualKey(id)) || "null");
  } catch {
    return null;
  }
}

/**
 * Tempo disponível para encerrar a sessão.
 * - Se a sessão é hoje: conta até ao fim do horário.
 * - Noutro dia: mostra a duração planeada + "Iniciar agora" (cronómetro manual com a mesma duração).
 */
export function SessionTimer({
  id,
  label,
  date,
  start,
  end,
  blocks = [],
  allDone = false,
  size = 200,
  compact = false,
}: {
  id: string;
  label: string;
  date: string;
  start: string;
  end: string;
  blocks?: Block[];
  allDone?: boolean;
  size?: number;
  compact?: boolean;
}) {
  const { t, locale } = useT();
  const now = useNow();
  const [manual, setManual] = useState<Manual | null>(null);
  useEffect(() => setManual(readManual(id)), [id]);

  const a = toMin(start),
    b = toMin(end);
  const minutes = a !== null && b !== null ? b - a : null;

  if (!now) return <DotRing value={0} size={size} />;
  if (minutes === null || minutes <= 0)
    return (
      <div className="muted" style={{ fontSize: 13 }}>
        {t("timer.noTimes")}
      </div>
    );

  let startMs: number, endMs: number;
  const scheduled = !manual && date === isoDay(now);
  if (manual) {
    startMs = manual.startedAt;
    endMs = manual.startedAt + manual.minutes * 60_000;
  } else if (scheduled) {
    startMs = at(date, start);
    endMs = at(date, end);
  } else {
    startMs = endMs = 0;
  }

  const t0 = now.getTime();
  let state: "planned" | "before" | "running" | "after" = "planned";
  if (manual || scheduled) state = t0 < startMs ? "before" : t0 < endMs ? "running" : "after";

  const left = endMs - t0;
  const warn = state === "running" && left < 15 * 60_000;
  const color = state === "after" ? (allDone ? "var(--ok)" : "var(--danger)") : warn ? "var(--danger)" : "var(--accent)";
  const value = state === "running" ? left / (endMs - startMs) : state === "before" ? 1 : 0;

  // divisão atual (pelo relógio do plano, deslocado se manual)
  const elapsedMin = state === "running" ? (t0 - startMs) / 60_000 : -1;
  const current = blocks.find((bl) => {
    const s = toMin(bl.start),
      e = toMin(bl.end);
    return s !== null && e !== null && elapsedMin >= s - a! && elapsedMin < e - a!;
  });

  const big =
    state === "before" ? fmtDuration(startMs - t0) : state === "running" ? fmtDuration(left) : state === "after" ? `+${fmtDuration(t0 - endMs)}` : fmtDuration(minutes * 60_000);
  const caption =
    state === "before"
      ? t("timer.startsIn")
      : state === "running"
        ? t("timer.remaining")
        : state === "after"
          ? allDone
            ? t("timer.ended")
            : t("timer.overtime")
          : t("timer.planned", { date: fmtDate(date, locale) || "—" });

  function startManual() {
    const m = { startedAt: Date.now(), minutes: minutes! };
    localStorage.setItem(manualKey(id), JSON.stringify(m));
    setManual(m);
  }
  function reset() {
    localStorage.removeItem(manualKey(id));
    setManual(null);
  }

  return (
    <div className="row" style={{ gap: 20, alignItems: "center", flexWrap: compact ? "nowrap" : "wrap" }}>
      <DotRing value={value} size={size} color={color}>
        <div>
          <div className="mono" style={{ fontSize: size * 0.135, fontWeight: 300, color: state === "after" || warn ? color : undefined }}>
            {big}
          </div>
          <div className="label muted" style={{ marginTop: 6, fontSize: 9.5, maxWidth: size * 0.6 }}>
            {caption}
          </div>
        </div>
      </DotRing>
      <div className="stack" style={{ minWidth: 0, flex: 1 }}>
        <div>
          <div className="label muted">{label}</div>
          <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>
            {start}–{end}
            {manual && <span className="tone-warn"> · {t("timer.manual")}</span>}
          </div>
        </div>
        {(state === "running" || state === "before") && (
          <div className="mono" style={{ fontSize: 13 }}>
            {t("timer.ends", { time: new Date(endMs).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) })}
          </div>
        )}
        {current && (
          <div className="row" style={{ gap: 8 }}>
            <span className="dot" style={{ background: "var(--live)" }} />
            <span style={{ fontSize: 13 }}>{t("timer.current", { block: current.title })}</span>
          </div>
        )}
        <div className="row">
          {!manual && state !== "running" && (
            <button className="btn accent" onClick={startManual}>
              <Icon name="play" size={14} /> {t("timer.startNow")}
            </button>
          )}
          {manual && (
            <button className="btn" onClick={reset}>
              {t("timer.reset")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
