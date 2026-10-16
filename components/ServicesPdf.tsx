// Tabela de serviços em PDF no template MediaMarques (mesma capa, cabeçalho [MEDIAMARQUES] e rodapé do invoice).
import { Circle, Document, Image, Page, Svg, Text, View } from "@react-pdf/renderer";
import { COMPANY, THEMES, money } from "@/lib/invoice";
import { hourlyOf, type PricingRules, type Service, type ServiceFolder } from "@/lib/services";
import { DOTS } from "./InvoicePdf";

const th = THEMES.original;
const at = (left: number, top: number, extra: object = {}) => ({ position: "absolute" as const, left, top, ...extra });
const UNIT: Record<string, string> = { hour: "HOUR", day: "DAY", item: "ITEM", session: "SESSION", month: "MONTH", trip: "TRIP" };

type P = { services: Service[]; folders: ServiceFolder[]; rules: PricingRules; title?: string; intro?: string; iconSrc?: string; date: string };

function Footer({ iconSrc }: { iconSrc: string }) {
  const t = { fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 };
  return (
    <>
      <View style={{ position: "absolute", left: 19, top: 748, width: 563, borderTopWidth: 0.9, borderTopColor: th.ink }} fixed />
      <Text style={at(19.5, 758.5, t)} fixed>{`${COMPANY.brand} \n[${COMPANY.address} ]`}</Text>
      <Text style={at(199, 758.5, t)} fixed>{`[KVK - ${COMPANY.kvk}] \n[BTW - ${COMPANY.btw}] `}</Text>
      <Text style={at(383, 758.5, { ...t, width: 202, textAlign: "right" })} fixed>{`[BSN - ${COMPANY.bsn}] \n[Tel ${COMPANY.tel}]`}</Text>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={iconSrc} style={at(19, 794, { width: 27, height: 27 })} fixed />
      <Text style={at(500, 800, { width: 76, textAlign: "right", fontSize: 8 })} render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} fixed />
    </>
  );
}

export function ServicesDocument({ services, folders, rules, title = "SERVICES", intro, iconSrc = "/invoice/mm-icon.png", date }: P) {
  const year = date.slice(0, 4);
  const groups = folders.map((f) => ({ f, list: services.filter((s) => s.folder === f.id && !s.archived && (s.pass_through || s.price > s.crp)).sort((a, b) => a.price - b.price) })).filter((g) => g.list.length);
  const cell = { fontSize: 8, letterSpacing: -0.38 };
  const head = { fontSize: 9, fontWeight: 700, letterSpacing: -0.45 };
  return (
    <Document title={`MediaMarques — ${title} ${year}`} author="MediaMarques" creator="XMEDIA">
      <Page size="A4" style={{ backgroundColor: th.bg, color: th.coverInk, fontFamily: "Montserrat" }}>
        <Text style={at(44, 26.5, { fontSize: 12, lineHeight: 1.42, letterSpacing: -0.5 })}>{`Media Marques ©\nServices [${year}]`}</Text>
        <Svg viewBox="0 0 100 100" style={at(440, 15, { width: 100, height: 100 })}>
          {DOTS.map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={6} fill={th.dots} />
          ))}
        </Svg>
        <Text style={at(60.5, 476.5, { fontSize: 62.9, fontWeight: 700, letterSpacing: -1.3 })}>{title}</Text>
        <Text style={at(59.5, 734, { width: 418, fontSize: 12, fontStyle: "italic", lineHeight: 1.375, letterSpacing: -0.51 })}>
          {intro ?? "Rates for audiovisual production, editing and photography by Media Marques. All prices exclude BTW and refer to the On-Demand rate unless stated otherwise."}
        </Text>
      </Page>

      <Page size="A4" style={{ backgroundColor: th.bg, color: th.ink, fontFamily: "Montserrat", paddingTop: 120, paddingBottom: 110, paddingHorizontal: 17 }} wrap>
        <Text style={at(14.4, 19.7, { fontSize: 58, fontWeight: 700, letterSpacing: 0.1 })} fixed>
          {COMPANY.brand}
        </Text>
        {groups.map(({ f, list }) => (
          <View key={f.id} style={{ marginBottom: 16 }} wrap={false}>
            <Text style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.6, marginBottom: 4 }}>
              <Text style={{ color: th.accent }}>[{String(f.order).padStart(2, "0")}]</Text> {f.label.toUpperCase()}
            </Text>
            <View style={{ borderTopWidth: 0.9, borderTopColor: th.ink, borderBottomWidth: 0.9, borderBottomColor: th.ink, flexDirection: "row", paddingVertical: 4 }}>
              <Text style={{ ...head, width: 290 }}>ITEM</Text>
              <Text style={{ ...head, width: 60, textAlign: "center" }}>UNIT</Text>
              <Text style={{ ...head, width: 60, textAlign: "center" }}>HRS</Text>
              <Text style={{ ...head, width: 70, textAlign: "right" }}>€/H</Text>
              <Text style={{ ...head, flex: 1, textAlign: "right" }}>RATE</Text>
            </View>
            {list.map((s) => (
              <View key={s.id} style={{ flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.3, borderBottomColor: "#00000033" }}>
                <View style={{ width: 290, paddingRight: 8 }}>
                  <Text style={{ ...cell, fontWeight: 700 }}>{s.invoice_label.replace(/^®\s*\[MM\]\s*/, "")}</Text>
                  {s.deliverable ? <Text style={{ fontFamily: "Open Sans", fontSize: 6.6, lineHeight: 1.15, marginTop: 1.5, color: "#333" }}>{s.deliverable}</Text> : null}
                </View>
                <Text style={{ ...cell, width: 60, textAlign: "center" }}>{UNIT[s.unit]}</Text>
                <Text style={{ ...cell, width: 60, textAlign: "center" }}>{s.hours ? String(+s.hours.toFixed(2)) : "—"}</Text>
                <Text style={{ ...cell, width: 70, textAlign: "right" }}>{hourlyOf(s) ? money(hourlyOf(s)!, "EUR").replace(" EUR", "") : "—"}</Text>
                <Text style={{ ...cell, flex: 1, textAlign: "right", fontWeight: 700 }}>{money(s.price, "EUR")}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={{ marginTop: 6 }} wrap={false}>
          <Text style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.6, marginBottom: 4 }}>
            <Text style={{ color: th.accent }}>[%]</Text> DISCOUNTS
          </Text>
          <Text style={{ fontFamily: "Open Sans", fontSize: 7.5, lineHeight: 1.3 }}>
            {`Hours (same day/location): ${rules.hours_tiers.filter((t) => t.pct).map((t) => `${t.min}h+ ${t.pct}%`).join(" · ")}.  Deliverables per cycle: ${rules.volume_tiers.filter((t) => t.pct).map((t) => `${t.min}+ ${t.pct}%`).join(" · ")}.  Recurring contract: ${rules.recurring.map((r) => `${r.months} months ${r.pct}%`).join(" · ")}.  Combined discounts never exceed ${rules.cap_pct}%. Travel is charged at cost (€0.40/km + parking). Prices excl. BTW ${rules.btw}%; ${rules.deposit_pct}% deposit to confirm a date.`}
          </Text>
        </View>
        <Footer iconSrc={iconSrc} />
      </Page>
    </Document>
  );
}
