// Investimento da proposta ligado ao catálogo de serviços, em três camadas:
// 1) produção (o valor base de estar lá), 2) o entregável principal, 3) extras opcionais (cada um com preço próprio).
// Calcula com o motor de orçamento (descontos, teto, piso, BTW) e gera os slides "inv-*" da proposta. Funções puras.
import type { PricingGroup, PricingLine, Proposal, ProposalPricing, Slide } from "./proposal";
export const eurPkg = (n: number) => `€ ${n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
import { normalizeRules, quote, type PricingRules, type QuoteInput, type QuoteResult, type Service } from "./services";

export const GROUPS: PricingGroup[] = ["production", "deliverable", "extra"];
export const INV_PREFIX = "inv-";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const eur = (n: number) => `€${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const eur2 = (n: number) => `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function emptyPricing(): ProposalPricing {
  return { lines: [], partner: false, recurring_months: 0, rush: false, country: "NL" };
}

const input = (pr: ProposalPricing, lines: PricingLine[]): QuoteInput => ({
  client: { name: "", country: pr.country || "NL" },
  lines: lines.map((l) => ({ service_id: l.service_id, qty: l.qty, price_override: l.price_override ?? null })),
  partner: pr.partner,
  recurring_months: pr.recurring_months,
  rush: pr.rush,
});

export type ExtraPrice = { line: PricingLine; service: Service; price: number; total_with: number };
export type PackagePrice = { index: number; name: string; extras: ExtraPrice[]; quote: QuoteResult };
export type PricingSummary = {
  packages: PackagePrice[]; // preço de cada pacote (base + extras do pacote)
  production: QuoteResult; // só produção
  base: QuoteResult; // produção + entregável(eis) = valor da proposta
  extras: ExtraPrice[]; // preço marginal de cada extra somado à base (descontos de volume incluídos)
  full: QuoteResult; // tudo
};

export function pricingSummary(pr: ProposalPricing, catalog: Service[], rules?: Partial<PricingRules>): PricingSummary {
  const by = (g: PricingGroup) => pr.lines.filter((l) => l.group === g && l.qty > 0 && catalog.some((s) => s.id === l.service_id));
  const prod = by("production");
  const baseLines = [...prod, ...by("deliverable")];
  const base = quote(input(pr, baseLines), catalog, rules);
  const extraLines = pr.lines.filter((l) => l.group === "extra");
  const packages = (pr.packages ?? []).map((pk, index) => {
    const chosen = pk.extras.map((i) => extraLines[i]).filter((l): l is PricingLine => !!l && l.qty > 0 && catalog.some((s) => s.id === l.service_id));
    const q = quote(input(pr, [...baseLines, ...chosen]), catalog, rules);
    return { index, name: pk.name, quote: q, extras: chosen.map((line) => ({ line, service: catalog.find((s) => s.id === line.service_id)!, price: 0, total_with: q.subtotal })) };
  });
  return {
    packages,
    production: quote(input(pr, prod), catalog, rules),
    base,
    extras: by("extra").map((line) => {
      const withIt = quote(input(pr, [...baseLines, line]), catalog, rules);
      return { line, service: catalog.find((s) => s.id === line.service_id)!, price: round2(withIt.subtotal - base.subtotal), total_with: withIt.subtotal };
    }),
    full: quote(input(pr, [...baseLines, ...by("extra")]), catalog, rules),
  };
}

const short = (s: Service) => s.invoice_label.replace(/^®\s*\[MM\]\s*/, "");
const unitWord: Record<string, [string, string]> = { hour: ["hour", "hours"], day: ["day", "days"], item: ["", ""], session: ["session", "sessions"], month: ["month", "months"], trip: ["trip", "trips"] };
function lineMath(q: QuoteResult, id: string) {
  const l = q.lines.find((x) => x.service.id === id);
  if (!l) return "";
  const [one, many] = unitWord[l.service.unit] ?? ["", ""];
  const u = one ? ` ${l.qty === 1 ? one : many}` : "";
  const qty = l.qty === 1 && !u ? "" : `${+l.qty.toFixed(2)}${u} × ${eur2(l.unit_price)}`;
  const disc = l.applied_pct ? ` − ${l.applied_pct}%` : "";
  return qty ? `${qty}${disc} = ${eur2(l.net)}` : `${eur2(l.net)}${disc ? ` (${disc.trim()})` : ""}`;
}

/** Slides de investimento (EN, como o resto da proposta): base (produção + entregável), extras opcionais e condições. */
export function pricingSlides(pr: ProposalPricing, sum: PricingSummary, catalog: Service[], rulesIn?: Partial<PricingRules>, index = "4"): Slide[] {
  const rules = normalizeRules(rulesIn);
  const svc = (id: string) => catalog.find((s) => s.id === id)!;
  const b = sum.base;
  const n = (i: number) => String(i).padStart(2, "0");
  const prod = pr.lines.filter((l) => l.group === "production" && b.lines.some((x) => x.service.id === l.service_id));
  const deliv = pr.lines.filter((l) => l.group === "deliverable" && b.lines.some((x) => x.service.id === l.service_id));
  let k = 0;
  const rows = [
    ...prod.map((l) => ({ n: n(++k), name: l.label || short(svc(l.service_id)), text: `${l.note || svc(l.service_id).deliverable}\n${lineMath(b, l.service_id)}` })),
    ...deliv.map((l) => ({ n: n(++k), name: l.label || short(svc(l.service_id)), text: `${l.note || svc(l.service_id).deliverable}\n${lineMath(b, l.service_id)}` })),
    {
      n: "Σ",
      name: "Total",
      text: `*${eur2(b.subtotal)} excl. BTW* — BTW ${b.btw_rate}% ${eur2(b.btw)} — **${eur2(b.total)} incl. BTW**${b.months ? `\n[ Per month · ${b.months}-month contract ]` : ""}`,
    },
  ];
  const usePk = !!pr.packages?.length;
  const extraLines = pr.lines.filter((l) => l.group === "extra");
  const inPackage = new Set((pr.packages ?? []).flatMap((p) => p.extras));
  const itemOf = (l: PricingLine) => (l.item || `${l.label || short(svc(l.service_id))}`).toUpperCase();
  const slides: Slide[] = usePk
    ? [
        {
          id: `${INV_PREFIX}packages`,
          type: "packages",
          index: `${index}.1`,
          title: "Packages",
          packages: pr.packages!.map((pk, i) => ({
            name: pk.name,
            price: eurPkg(sum.packages[i]?.quote.subtotal ?? 0),
            recommended: !!pk.recommended,
            description: pk.description,
            items: (pk.items?.length
              ? pk.items
              : [...[...prod, ...deliv].map(itemOf), ...pk.extras.map((k) => extraLines[k]).filter(Boolean).map(itemOf), ...(pr.base_items ?? [])]
            ).slice(0, 6),
          })),
          note: pr.note || `Prices excl. BTW ${b.btw_rate}%. ${rules.deposit_pct}% deposit to confirm the date — balance within 5 days after final delivery.`,
          ...(pr.image ? { media: pr.image } : {}),
        },
      ]
    : [{ id: `${INV_PREFIX}base`, type: "list", index: `${index}.1`, title: "Investment", tone: "dark", rows }];

  const loose = usePk ? sum.extras.filter((e) => !inPackage.has(extraLines.indexOf(e.line))) : sum.extras;
  if (loose.length)
    slides.push({
      id: `${INV_PREFIX}extras`,
      type: "list",
      index: `${index}.2`,
      title: "Optional extras",
      tone: "light",
      rows: [
        ...loose.map((e, i) => ({
          n: String.fromCharCode(65 + i),
          name: e.line.label || short(e.service),
          text: `${e.line.note || e.service.deliverable}\n*+ ${eur2(e.price)} excl. BTW*${usePk ? " — can be added to any package" : ""}`,
        })),
        ...(usePk ? [] : [{ n: "—", name: "Everything", text: `Base plus all extras: ${eur2(sum.full.subtotal)} excl. BTW — ${eur2(sum.full.total)} incl. BTW.` }]),
      ],
    });

  const capture = catalog.find((s) => pr.lines.some((l) => l.group === "production" && l.service_id === s.id) && s.unit === "hour" && s.kind === "capture");
  const valid = pr.valid_until ? new Date(pr.valid_until + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "30 days";
  const discounts = b.discount > 0 || sum.full.discount > 0;
  slides.push({
    id: `${INV_PREFIX}terms`,
    type: "list",
    index: `${index}.${loose.length ? 3 : 2}`,
    title: "Conditions",
    tone: "light",
    rows: [
      { n: "A", name: "Basis", text: `MediaMarques ${new Date().getFullYear()} rate card — production first, then the deliverable; extras only if you need them.${discounts ? ` Volume conditions already applied (combined discounts never exceed ${rules.cap_pct}%).` : ""}` },
      ...(capture ? [{ n: "B", name: "Extra time", text: `If the event runs longer: ${eur2(capture.price)} per additional hour on location, agreed on the day.` }] : []),
      { n: capture ? "C" : "B", name: "Payment", text: `${rules.deposit_pct}% deposit to confirm the date; balance within 5 days after final delivery.` },
      { n: capture ? "D" : "C", name: "Validity", text: `Prices valid until ${valid}, excl. BTW ${b.btw_rate}%.` },
    ],
  });
  return slides;
}

/** Aplica o investimento à proposta: valor = base, slides "inv-*" substituídos no sítio certo. */
export function applyPricing(p: Proposal, catalog: Service[], rules?: Partial<PricingRules>): Proposal {
  const pr = p.pricing;
  if (!pr) return p;
  const sum = pricingSummary(pr, catalog, rules);
  const old = p.doc.slides;
  const firstInv = old.findIndex((s) => s.id.startsWith(INV_PREFIX));
  const kept = old.filter((s) => !s.id.startsWith(INV_PREFIX));
  let at = firstInv >= 0 ? old.slice(0, firstInv).filter((s) => !s.id.startsWith(INV_PREFIX)).length : -1;
  if (at < 0 && pr.insert_after) at = kept.findIndex((s) => s.id === pr.insert_after) + 1 || -1;
  if (at < 0) at = Math.max(0, kept.findLastIndex((s) => s.type === "closing"));
  const anchor = kept.slice(0, at).reverse().find((s) => s.type === "section") as Extract<Slide, { type: "section" }> | undefined;
  const slides = [...kept.slice(0, at), ...pricingSlides(pr, sum, catalog, rules, anchor?.number ?? "4"), ...kept.slice(at)];
  const rec = pr.packages?.findIndex((x) => x.recommended) ?? -1;
  const value = rec >= 0 && sum.packages[rec] ? sum.packages[rec].quote.subtotal : sum.base.subtotal;
  const r = normalizeRules(rules);
  const pkSlide = slides.find((x) => x.id === `${INV_PREFIX}packages`);
  const offer = {
    packages: sum.packages.length
      ? sum.packages.map((k, i) => ({ name: k.name, subtotal: k.quote.subtotal, recommended: !!pr.packages![i].recommended, items: pkSlide?.type === "packages" ? pkSlide.packages[i]?.items ?? [] : [] }))
      : [{ name: "Proposal", subtotal: sum.base.subtotal, recommended: true, items: [] }],
    extras: sum.extras
      .filter((e) => !(pr.packages ?? []).some((pk) => pk.extras.includes(pr.lines.filter((l) => l.group === "extra").indexOf(e.line))))
      .map((e) => ({ label: e.line.label || short(e.service), price: e.price })),
    btw_rate: sum.base.btw_rate,
    deposit_pct: r.deposit_pct,
    valid_until: pr.valid_until,
  };
  return { ...p, value, valid_until: pr.valid_until || p.valid_until, pricing: { ...pr, offer }, doc: { ...p.doc, slides } };
}

/** Agrupa linhas vindas da calculadora: captação/deslocação/estratégia → produção, edição/reels → entregável, resto → extra. */
export function groupFromCalculator(lines: { service_id: string; qty: number }[], catalog: Service[]): PricingLine[] {
  return lines.map((l) => {
    const k = catalog.find((s) => s.id === l.service_id)?.kind;
    const group: PricingGroup = k === "capture" || k === "travel" || k === "strategy" ? "production" : k === "edit" || k === "reel" ? "deliverable" : "extra";
    return { ...l, group };
  });
}
