"use client";

// Aparência: todas as cores (por tema), as duas fontes (BioGrotesk + Fragment Mono, com ficheiros próprios),
// cantos, intervalo, números e títulos. Pré-visualização ao vivo; grava em app_settings e aplica a toda a app.
import { fontWeightOf } from "@/lib/uploadRules";
import { DropZone } from "@/components/DropZone";
import { Select } from "@/components/Select";
import { Icon } from "@/components/Icon";
import { useEffect, useRef, useState } from "react";
import { Bars, Ring, Tile, TileLines } from "@/components/bento";
import { AppShell, Toast, useToast } from "@/components/ui";
import { COLOR_GROUPS, COLOR_TOKENS, DEFAULT_APPEARANCE, normalizeAppearance, type Appearance, type ColorToken, type FontFile } from "@/lib/appearance";
import { applyAppearance, loadAppearance, saveAppearance } from "@/lib/appearanceStore";
import { useT, type Key } from "@/lib/i18n";
import { uploadMedia } from "@/lib/media";
import { supabaseEnabled } from "@/lib/supabase/client";

const readDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^;]*;/, `data:font/${(f.name.split(".").pop() || "woff2").toLowerCase()};`));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });

export default function AppearancePage() {
  const { t } = useT();
  const [toast, setToast] = useToast();
  const [a, setA] = useState<Appearance | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAppearance().then((x) => {
      setA(x);
      setSaved(JSON.stringify(x));
      setMode((document.documentElement.dataset.theme as "dark" | "light") || x.defaultTheme);
    });
  }, []);
  // pré-visualização ao vivo (sem gravar)
  useEffect(() => {
    if (a) applyAppearance(a, false);
  }, [a]);
  // ao sair sem gravar, volta ao que estava gravado
  useEffect(() => () => void loadAppearance().then((x) => applyAppearance(x)), []);
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  if (!a) return <AppShell>{null}</AppShell>;
  const dirty = JSON.stringify(a) !== saved;
  const setColor = (k: ColorToken, v: string) => setA({ ...a, [mode]: { ...a[mode], [k]: v } });
  const setFont = (k: "sans" | "mono", p: Partial<Appearance["fonts"]["sans"]>) => setA({ ...a, fonts: { ...a.fonts, [k]: { ...a.fonts[k], ...p } } });

  async function save() {
    setBusy(true);
    try {
      const n = normalizeAppearance(a);
      await saveAppearance(n);
      setA(n);
      setSaved(JSON.stringify(n));
      try {
        localStorage.setItem("xmedia:theme", mode);
      } catch {}
      setToast(t("ap.saved"));
    } catch (e) {
      setToast((e as Error).message);
    }
    setBusy(false);
  }
  async function addFont(k: "sans" | "mono", file: File, weight: number) {
    setBusy(true);
    try {
      const url = supabaseEnabled ? (await uploadMedia(file, "fonts")).src : await readDataUrl(file);
      setA((cur) => {
        if (!cur) return cur;
        const files: FontFile[] = [...cur.fonts[k].files.filter((f) => f.weight !== weight), { weight, url, name: file.name }].sort((x, y) => x.weight - y.weight);
        return { ...cur, fonts: { ...cur.fonts, [k]: { ...cur.fonts[k], files } } };
      });
    } catch (e) {
      setToast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <AppShell>
      <section className="pagehead">
        <div>
          <span className="label muted">{t("ap.sub")}</span>
          <h1 className="h1">{t("nav.appearance")}</h1>
        </div>
        <div className="row">
          {dirty && <span className="label tone-warn">● {t("ap.unsaved")}</span>}
          <button className="btn" onClick={() => confirm(t("ap.resetConfirm")) && setA(normalizeAppearance(DEFAULT_APPEARANCE))}>
            {t("ap.reset")}
          </button>
          <button className="btn accent" onClick={save} disabled={busy || !dirty} data-testid="ap-save">
            {t("ap.save")}
          </button>
        </div>
      </section>

      <section className="widgets" style={{ paddingTop: 0 }}>
        {/* tema */}
        <div className="w span-12 row between ap-bar">
          <div className="row" style={{ gap: 10 }}>
            <span className="tile-t">{t("ap.editing")}</span>
            <div className="seg" role="group">
              {(["dark", "light"] as const).map((m) => (
                <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                  {t(`ap.${m}` as Key)}
                </button>
              ))}
            </div>
          </div>
          <label className="row small" style={{ gap: 8 }}>
            <span className="tile-t muted">{t("ap.defaultTheme")}</span>
            <Select className="select" style={{ width: "auto" }} value={a.defaultTheme} onChange={(e) => setA({ ...a, defaultTheme: e.target.value as "dark" | "light" })}>
              <option value="dark">{t("ap.dark")}</option>
              <option value="light">{t("ap.light")}</option>
            </Select>
          </label>
        </div>

        {/* cores */}
        {COLOR_GROUPS.map((g) => (
          <section key={g} className={`w stack ${g === "base" ? "span-6" : g === "brand" ? "span-6" : "span-6"}`}>
            <span className="tile-t">{t(`ap.group.${g}` as Key)}</span>
            <div className="ap-colors">
              {COLOR_TOKENS.filter((c) => c.group === g).map(({ k }) => (
                <label key={k} className="ap-color">
                  <input type="color" value={a[mode][k].slice(0, 7)} onChange={(e) => setColor(k, e.target.value)} aria-label={t(`ap.c.${k}` as Key)} />
                  <span className="small">{t(`ap.c.${k}` as Key)}</span>
                  <input className="input mono small" value={a[mode][k]} onChange={(e) => /^#[0-9a-f]{0,8}$/i.test(e.target.value) && setColor(k, e.target.value)} spellCheck={false} />
                </label>
              ))}
            </div>
          </section>
        ))}

        {/* tipografia */}
        {(["sans", "mono"] as const).map((k) => (
          <section key={k} className="w span-6 stack">
            <span className="tile-t">{k === "sans" ? t("ap.fontSans") : t("ap.fontMono")}</span>
            <p className="ap-sample" style={{ fontFamily: k === "sans" ? "var(--font-sans)" : "var(--font-mono)" }}>
              {k === "sans" ? "Aa — Brand Elevation Studio 0123" : "AA · 36 694 € · +15,4% · Q4 #0051"}
            </p>
            <div className="grid4" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
              <label className="field">
                <span>{t("ap.family")}</span>
                <input className="input" value={a.fonts[k].family} onChange={(e) => setFont(k, { family: e.target.value })} />
              </label>
              <label className="field">
                <span>{t("ap.fallback")}</span>
                <input className="input small" value={a.fonts[k].fallback} onChange={(e) => setFont(k, { fallback: e.target.value })} />
              </label>
            </div>
            {a.fonts[k].files.length ? (
              a.fonts[k].files.map((f) => (
                <div key={f.weight} className="statrow">
                  <span className="mono small">{f.weight}</span>
                  <span className="small" style={{ flex: 1 }}>
                    {f.name || f.url.slice(0, 40)}
                  </span>
                  <button className="btn ghost small" onClick={() => setFont(k, { files: a.fonts[k].files.filter((x) => x !== f) })} aria-label="remove">
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                {k === "mono" ? t("ap.monoGoogle") : t("ap.noFiles")}
              </p>
            )}
            <DropZone target="font" compact busy={busy} onFiles={async (files) => { for (const f of files) await addFont(k, f, fontWeightOf(f.name)); }} testId={`font-drop-${k}`} />
            <div className="row">
              {[400, 500, 700].map((w) => (
                <label key={w} className="btn small" style={{ cursor: "pointer" }}>
                  + {t("ap.weight")} {w}
                  <input
                    ref={w === 400 && k === "sans" ? fileRef : undefined}
                    type="file"
                    accept=".woff2,.woff,.otf,.ttf,font/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) addFont(k, f, w);
                      e.target.value = "";
                    }}
                  />
                </label>
              ))}
            </div>
            <span className="muted small">
              {t("ap.upload")} · {t("ap.license")}
            </span>
          </section>
        ))}

        {/* opções */}
        <section className="w span-4 stack">
          <span className="tile-t">{t("ap.options")}</span>
          <label className="field">
            <span>
              {t("ap.radius")} · {a.radius}px
            </span>
            <input type="range" min={0} max={24} value={a.radius} onChange={(e) => setA({ ...a, radius: +e.target.value })} />
          </label>
          <label className="field">
            <span>
              {t("ap.gap")} · {a.gap}px
            </span>
            <input type="range" min={4} max={32} value={a.gap} onChange={(e) => setA({ ...a, gap: +e.target.value })} />
          </label>
          <div className="field">
            <span>{t("ap.numbers")}</span>
            <div className="seg" role="group">
              {(["mono", "sans"] as const).map((n) => (
                <button key={n} aria-pressed={a.numbers === n} onClick={() => setA({ ...a, numbers: n })}>
                  {n === "mono" ? a.fonts.mono.family : a.fonts.sans.family}
                </button>
              ))}
            </div>
          </div>
          <label className="row small" style={{ gap: 8 }}>
            <input type="checkbox" checked={a.uppercaseTitles} onChange={(e) => setA({ ...a, uppercaseTitles: e.target.checked })} /> {t("ap.upper")}
          </label>
          <div className="row">
            <button
              className="btn small"
              onClick={() => {
                const b = new Blob([JSON.stringify(a, null, 2)], { type: "application/json" });
                const u = URL.createObjectURL(b);
                Object.assign(document.createElement("a"), { href: u, download: "xmedia-appearance.json" }).click();
                URL.revokeObjectURL(u);
              }}
            >
              <Icon name="download" size={14} /> {t("ap.export")}
            </button>
            <label className="btn small" style={{ cursor: "pointer" }}>
              <Icon name="upload" size={14} /> {t("ap.import")}
              <input type="file" accept="application/json,.json" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setA(normalizeAppearance(JSON.parse(await f.text())));
                e.target.value = "";
              }} />
            </label>
          </div>
        </section>

        {/* pré-visualização */}
        <Tile span={2} tone="blue" title={t("ap.preview")} value="1.8" of="/ 6H" />
        <Tile span={3} title="Paid invoices" value="24" of="/ 32" foot={<><span>Total</span><span>€6,000 / 12,000</span></>} />
        <div className="w tile span-3">
          <span className="tile-t">Bars</span>
          <Bars values={[3, 4, 7, 5, 4]} on={2} tip="1.83" small />
          <Ring value={0.78}>
            <span className="tile-num sm">7.8</span>
          </Ring>
        </div>
        <div className="w tile blue span-4 feature" style={{ minHeight: 200 }}>
          <TileLines />
          <span />
          <h2 className="tile-big">Aesthetic-usability effect</h2>
        </div>
        <div className="w tile sand span-4" style={{ minHeight: 200 }}>
          <span className="tile-t">Custom dashboard</span>
          <h2 className="tile-big">10 / 20</h2>
        </div>
        <section className="w span-4 stack">
          <div className="row" style={{ gap: 6 }}>
            {(["reel", "post", "carousel", "story"] as const).map((x) => (
              <span key={x} className={`cb-chip on ty-${x}`}>
                {t(`ct.type.${x}` as Key)}
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span className="label tone-ok">● ok</span>
            <span className="label tone-warn">● warn</span>
            <span className="label tone-danger">● danger</span>
          </div>
          <div className="row">
            <button className="btn accent">Accent</button>
            <button className="btn solid">Solid</button>
            <button className="btn">Outline</button>
          </div>
          <input className="input" placeholder="Input" />
        </section>
      </section>
      <Toast msg={toast} />
    </AppShell>
  );
}
