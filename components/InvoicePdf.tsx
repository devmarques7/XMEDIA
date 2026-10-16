// Template React PDF do invoice MediaMarques — réplica do PDF oficial (A4, coordenadas em pt medidas no original).
import { Circle, Document, Font, Image, Page, Svg, Text, View } from "@react-pdf/renderer";
import { COMPANY, STANDARD_TERMS, TERMS_FOOTNOTE, invoiceDate, money, totals, type Invoice } from "@/lib/invoice";

let registered = "";
/** Regista Montserrat + Open Sans (TTF estático). `base`: URL ("/fonts") ou pasta local (testes). */
export function registerInvoiceFonts(base = "/fonts") {
  if (registered === base) return;
  registered = base;
  Font.register({
    family: "Montserrat",
    fonts: [
      { src: `${base}/Montserrat-Regular.ttf` },
      { src: `${base}/Montserrat-Italic.ttf`, fontStyle: "italic" },
      { src: `${base}/Montserrat-Bold.ttf`, fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Open Sans",
    fonts: [{ src: `${base}/OpenSans-Regular.ttf` }, { src: `${base}/OpenSans-Bold.ttf`, fontWeight: 700 }],
  });
  Font.registerHyphenationCallback((w) => [w]); // nunca hifenizar
}

// círculo de 19 pontos da capa (medido no original: caixa 100×100pt em x=440, y=15)
export const DOTS: [number, number][] = [
  [49.9, 10.4], [30.2, 15.6], [69.8, 15.6], [15.4, 30.3], [84.5, 30.3], [40.1, 32.9], [60, 33], [10.1, 50.3], [30.1, 50.3], [50, 50.2],
  [69.8, 50.4], [89.7, 50.3], [39.9, 67.6], [60, 67.6], [15.6, 70.1], [84.5, 70], [30, 85], [69.8, 84.9], [49.9, 90],
];

const W = 595.28;
type P = { invoice: Invoice; qrDataUrl: string | null; iconSrc?: string; heading?: string; docName?: string };

/** Posição absoluta em pt (top = topo da caixa de texto). */
const at = (left: number, top: number, extra: object = {}) => ({ position: "absolute" as const, left, top, ...extra });
const rule = (left: number, top: number, right: number, color: string, w = 0.9) => ({
  position: "absolute" as const,
  left,
  top,
  width: right - left,
  borderTopWidth: w,
  borderTopColor: color,
});

export function InvoiceDocument({ invoice: inv, qrDataUrl, iconSrc = "/invoice/mm-icon.png", heading = "INVOICE", docName = "invoice" }: P) {
  const th = inv.theme;
  const t = totals(inv);
  const cur = inv.currency;

  // ---- área de itens cresce com o número de linhas; o resto desce por igual (delta)
  const ROW = 13.5;
  const itemsEnd = Math.max(320, 231 + t.lines.length * ROW + 8);
  const addrLines = inv.client.address.split("\n").filter((l) => l.trim());
  const extraHeader = Math.max(0, addrLines.length - 2) * 9.5 + (inv.client.vat ? 13 : 0);
  const d = itemsEnd - 320 + extraHeader;
  const noteLines = Math.ceil((inv.note.length || 1) / 68);
  const noteEnd = 348 + d + noteLines * 8.7;
  const summaryRows = 1 + (t.btw.label ? 1 : 0);
  const summaryEnd = 354 + d + (summaryRows - 1) * 18 + 20;
  const paymentOnNewPage = Math.max(noteEnd, summaryEnd) > 560;

  const footer = (
    <>
      <View style={rule(19, 748, 582, th.ink, 0.9)} />
      <Text style={at(19.5, 758.5, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 })}>
        {`${COMPANY.brand} \n[${COMPANY.address} ]`}
      </Text>
      <Text style={at(199, 758.5, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 })}>
        {`[KVK - ${COMPANY.kvk}] \n[BTW - ${COMPANY.btw}] `}
      </Text>
      <Text style={at(383, 758.5, { width: 202, textAlign: "right", fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.9, lineHeight: 1.27, letterSpacing: -0.5 })}>
        {`[BSN - ${COMPANY.bsn}] \n[Tel ${COMPANY.tel}]`}
      </Text>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={iconSrc} style={at(19, 794, { width: 27, height: 27 })} />
    </>
  );

  const payment = (
    <>
      <View style={rule(22, 575, 585, th.ink, 0.9)} />
      <Text style={at(19, 583, { fontFamily: "Montserrat", fontWeight: 700, fontSize: 32.4, letterSpacing: -1 })}>PAYMENT</Text>
      <View style={at(22, 644, { width: 180 })}>
        <Text style={{ fontFamily: "Open Sans", fontSize: 12, letterSpacing: -0.6 }}>[BANK TRANSFER]</Text>
        <Text style={{ fontFamily: "Open Sans", fontSize: 12, marginTop: 18.5, letterSpacing: -0.6 }}>{`[${COMPANY.name}]`}</Text>
        <Text style={{ fontFamily: "Open Sans", fontSize: 12, marginTop: -3.5, letterSpacing: -0.6 }}>{`[${COMPANY.iban}] `}</Text>
        <Text style={{ fontFamily: "Open Sans", fontSize: 9.9, marginTop: 11.6, letterSpacing: -0.5 }}>{`[TERMS: ${inv.payment.termsDays} DAYS FROM ISSUE DATE] `}</Text>
      </View>
      {qrDataUrl && (
        <>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qrDataUrl} style={at(207, 643, { width: 75, height: 75 })} />
          <Text style={at(207.3, 721, { width: 82, fontFamily: "Montserrat", fontWeight: 700, fontSize: 9.2, letterSpacing: -0.45 })}>SCAN QR TO PAY</Text>
        </>
      )}
      <View style={at(302, 589, { width: 266 })}>
        <Text style={{ fontFamily: "Open Sans", fontWeight: 700, fontSize: 8, marginBottom: 4 }}>{"TERMS & CONDITIONS"}</Text>
        {STANDARD_TERMS.map((t0) => t0.replace(/\binvoice\b/g, docName)).map((term, i) => (
          <View key={i} style={{ flexDirection: "row", marginLeft: 3 }}>
            <Text style={{ fontFamily: "Open Sans", fontSize: 6.4, lineHeight: 1.08, width: 6 }}>{`${i + 1}.`}</Text>
            <Text style={{ fontFamily: "Open Sans", fontSize: 6.4, lineHeight: 1.08, flex: 1 }}>{term}</Text>
          </View>
        ))}
        <Text style={{ fontFamily: "Open Sans", fontSize: 6.4, lineHeight: 1.08, marginTop: 5, marginLeft: -2 }}>{` ${TERMS_FOOTNOTE.replace(/\binvoice\b/g, docName)}`}</Text>
      </View>
    </>
  );

  return (
    <Document title={`${heading[0]}${heading.slice(1).toLowerCase()} ${inv.number} — ${inv.client.name}`} author="MediaMarques" creator="XMEDIA">
      {/* ---------- capa ---------- */}
      <Page size="A4" style={{ backgroundColor: th.bg, color: th.coverInk, fontFamily: "Montserrat" }}>
        <Text style={at(44, 26.5, { fontSize: 12, lineHeight: 1.42, letterSpacing: -0.5 })}>{`${inv.cover.line1}\n${inv.cover.line2}`}</Text>
        <Svg viewBox="0 0 100 100" style={at(440, 15, { width: 100, height: 100 })}>
          {DOTS.map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={6} fill={th.dots} />
          ))}
        </Svg>
        <Text style={at(60.5, 476.5, { fontSize: 62.9, fontWeight: 700, letterSpacing: -1.3 })}>{inv.cover.title}</Text>
        <Text style={at(59.5, 734, { width: 418, fontSize: 12, fontStyle: "italic", lineHeight: 1.375, letterSpacing: -0.51 })}>{inv.cover.text}</Text>
      </Page>

      {/* ---------- detalhes ---------- */}
      <Page size="A4" style={{ backgroundColor: th.bg, color: th.ink, fontFamily: "Montserrat" }}>
        <Text style={at(14.4, 19.7, { fontSize: 58, fontWeight: 700, letterSpacing: 0.1 })}>{COMPANY.brand}</Text>

        <Text style={at(17, 114, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>{"CLIENT’S DETAILS "}</Text>
        <Text style={at(17, 137.5, { fontSize: 10, letterSpacing: -0.5 })}>
          <Text style={{ color: th.accent }}>[TO]</Text> {inv.client.name}
        </Text>
        <View style={at(17, 155.5, { width: 300 })}>
          {addrLines.length > 0 && (
            <Text style={{ fontSize: 10, lineHeight: 0.92, letterSpacing: -0.5 }}>
              <Text style={{ color: th.accent }}>[ADDRESS]</Text>
              {`  ${addrLines.join("\n")}`}
            </Text>
          )}
          {inv.client.vat ? (
            <Text style={{ fontSize: 10, marginTop: 4, letterSpacing: -0.5 }}>
              <Text style={{ color: th.accent }}>[VAT]</Text> {inv.client.vat}
            </Text>
          ) : null}
        </View>
        <Text style={at(17, 182 + extraHeader, { fontSize: 10, letterSpacing: -0.5 })}>
          [<Text style={{ color: th.accent }}>ID </Text>
          {`${inv.number}]  [ ${invoiceDate(inv.issue_date)} ]`}
        </Text>

        <Text style={at(300, 130, { width: 274.5 - 0, textAlign: "right", fontSize: 51.2, fontWeight: 700, letterSpacing: -2.2 })}>{heading}</Text>

        {/* tabela */}
        <View style={rule(17, 199 + extraHeader, 576, th.ink)} />
        <Text style={at(17, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>ITEM</Text>
        <Text style={at(246, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>HRS/QTY</Text>
        <Text style={at(392, 204 + extraHeader, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>RATE</Text>
        <Text style={at(480, 204 + extraHeader, { width: 96, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>SUBTOTAL</Text>
        <View style={rule(17, 223.5 + extraHeader, 576, th.ink)} />
        {t.lines.map((l, i) => {
          const y = 231.3 + extraHeader + i * ROW;
          return (
            <View key={l.id} style={at(17, y, { width: 559, height: ROW })}>
              <Text style={at(0, 0, { width: 225, fontSize: 8, letterSpacing: -0.38, maxLines: 1, textOverflow: "ellipsis" })}>{l.description}</Text>
              <Text style={at(230, 0, { width: 45, textAlign: "center", fontSize: 8, letterSpacing: -0.38 })}>{String(+l.qty.toFixed(2))}</Text>
              <Text style={at(353, 0, { width: 90, textAlign: "center", fontSize: 8, letterSpacing: -0.38 })}>{money(l.rate, cur)}</Text>
              <Text style={at(459, 0, { width: 100, textAlign: "right", fontSize: 8, letterSpacing: -0.38 })}>{money(l.subtotal, cur)}</Text>
            </View>
          );
        })}
        <View style={rule(18, 320 + d, 577, th.ink)} />

        {/* nota + resumo */}
        <Text style={at(20, 332 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>NOTE:</Text>
        {inv.note ? (
          <Text style={at(19.7, 347.8 + d, { width: 278, fontFamily: "Open Sans", fontSize: 8, lineHeight: 1.08 })}>{`NOTE: ${inv.note}`}</Text>
        ) : null}
        <Text style={at(347, 335.1 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>SUBTOTAL [EXCL. BTW]:</Text>
        <Text style={at(470, 335.1 + d, { width: 106.5, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>{money(t.subtotal, cur)}</Text>
        {t.btw.label ? (
          <>
            <Text style={at(347, 353.1 + d, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>{`${t.btw.label}:`}</Text>
            <Text style={at(470, 353.1 + d, { width: 106.5, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5 })}>{money(t.btwAmount, cur)}</Text>
          </>
        ) : null}
        <View style={rule(347, 354 + d + (summaryRows - 1) * 18, 576, th.ink, 0.8)} />
        <Text style={at(347, 359.1 + d + (summaryRows - 1) * 18, { fontSize: 10, fontWeight: 700, letterSpacing: -0.5, color: th.total })}>TOTAL :</Text>
        <Text style={at(470, 359.1 + d + (summaryRows - 1) * 18, { width: 105, textAlign: "right", fontSize: 10, fontWeight: 700, letterSpacing: -0.5, color: th.total })}>
          {money(t.total, cur)}
        </Text>

        {!paymentOnNewPage && payment}
        {!paymentOnNewPage && footer}
      </Page>

      {paymentOnNewPage && (
        <Page size="A4" style={{ backgroundColor: th.bg, color: th.ink, fontFamily: "Montserrat" }}>
          {payment}
          {footer}
        </Page>
      )}
    </Document>
  );
}
