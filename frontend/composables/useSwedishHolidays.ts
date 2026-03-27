/**
 * Swedish public holidays for a given year.
 * Returns a Set<string> of YYYY-MM-DD date strings.
 *
 * Included:
 *  - Fixed: New Year, Epiphany (6 Jan), 1 May, National Day (6 Jun),
 *           Christmas (25-26 Dec)
 *  - Variable (Easter-based): Good Friday, Easter Sunday + Monday,
 *    Ascension Thursday (+39), Whit Sunday/Pentecost (+49)
 *  - Midsommarafton – Friday between 19–25 June (treated as red day per spec)
 *  - Midsommardagen – Saturday between 20–26 June
 *  - Alla helgons dag – Saturday between 31 Oct – 6 Nov
 */
export function useSwedishHolidays() {
  function pad2(n: number) {
    return String(n).padStart(2, '0')
  }

  function fmt(year: number, month: number, day: number) {
    return `${year}-${pad2(month)}-${pad2(day)}`
  }

  /** Anonymous Gregorian algorithm (Meeus/Jones/Butcher) */
  function easterDate(year: number): { month: number; day: number } {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return { month, day }
  }

  function addDaysToDate(
    year: number,
    month: number,
    day: number,
    delta: number
  ) {
    const d = new Date(year, month - 1, day + delta)
    return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }

  function getHolidays(year: number): Set<string> {
    const h = new Set<string>()

    // ── Fixed dates ──────────────────────────────────────────────────────────
    h.add(fmt(year, 1, 1))   // Nyårsdagen
    h.add(fmt(year, 1, 6))   // Trettondedag jul
    h.add(fmt(year, 5, 1))   // Första maj
    h.add(fmt(year, 6, 6))   // Nationaldagen
    h.add(fmt(year, 12, 25)) // Juldagen
    h.add(fmt(year, 12, 26)) // Annandag jul

    // ── Easter-based ─────────────────────────────────────────────────────────
    const { month: em, day: ed } = easterDate(year)
    h.add(addDaysToDate(year, em, ed, -2))  // Långfredag  (Good Friday)
    h.add(fmt(year, em, ed))                // Påskdagen   (Easter Sunday)
    h.add(addDaysToDate(year, em, ed, 1))   // Annandag påsk (Easter Monday)
    h.add(addDaysToDate(year, em, ed, 39))  // Kristi himmelsfärd
    h.add(addDaysToDate(year, em, ed, 49))  // Pingstdagen

    // ── Midsommarafton – Friday between 19–25 June ───────────────────────────
    for (let d = 19; d <= 25; d++) {
      const dt = new Date(year, 5, d)
      if (dt.getDay() === 5) {
        h.add(fmt(year, 6, d))
        break
      }
    }

    // ── Midsommardagen – Saturday between 20–26 June ─────────────────────────
    for (let d = 20; d <= 26; d++) {
      const dt = new Date(year, 5, d)
      if (dt.getDay() === 6) {
        h.add(fmt(year, 6, d))
        break
      }
    }

    // ── Alla helgons dag – Saturday between 31 Oct – 6 Nov ───────────────────
    for (let d = 0; d < 7; d++) {
      const dt = new Date(year, 9, 31 + d)
      if (dt.getDay() === 6) {
        h.add(fmt(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()))
        break
      }
    }

    return h
  }

  return { getHolidays }
}
