import { describe, expect, it } from "vitest";
import { convert, entryMinutes, monthRange, monthSummary, shiftMonth, type Rates } from "./team";

const R: Rates = { base: "EUR", date: "2026-10-07", rates: { EUR: 1, GBP: 0.85, BRL: 5.6 }, live: true };

describe("equipa", () => {
  it("conta minutos com pausa e turno depois da meia-noite", () => {
    expect(entryMinutes({ start: "09:00", end: "17:30", break_min: 30 })).toBe(480);
    expect(entryMinutes({ start: "22:00", end: "01:00", break_min: 0 })).toBe(180);
    expect(entryMinutes({ start: "9h", end: "10:00", break_min: 0 })).toBe(0);
  });
  it("resume o mês na moeda do valor/hora", () => {
    const s = monthSummary({ rate: 25, rate_currency: "GBP" }, [
      { id: "1", member_id: "m", date: "2026-10-01", start: "08:00", end: "12:00", break_min: 0, project: "", note: "" },
      { id: "2", member_id: "m", date: "2026-10-02", start: "08:00", end: "09:30", break_min: 0, project: "", note: "" },
    ]);
    expect(s).toMatchObject({ minutes: 330, amount: 137.5, currency: "GBP", days: 2 });
  });
  it("converte o mesmo valor entre EUR, GBP e BRL", () => {
    expect(convert(100, "EUR", "BRL", R)).toBeCloseTo(560);
    expect(convert(85, "GBP", "EUR", R)).toBeCloseTo(100);
    expect(convert(convert(42, "BRL", "GBP", R), "GBP", "BRL", R)).toBeCloseTo(42);
  });
  it("navega meses", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});
