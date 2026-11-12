/**
 * @file Date helpers. All functions accept an optional `now` so tests are deterministic.
 * Calendar dates are stored as "YYYY-MM-DD"; timestamps as ISO 8601 strings.
 */

/** Left-pads a number to two digits ("7" -> "07"). */
export const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Formats a Date as a local calendar day.
 * @param {Date} d
 * @returns {string} YYYY-MM-DD
 */
export const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Today's calendar date in local time. */
export const today = (now = new Date()) => isoDay(now);

/**
 * Parses a YYYY-MM-DD or ISO string at local noon, which avoids DST and UTC-offset day shifts.
 * @param {string} value
 * @returns {Date}
 */
export const parseDay = (value) => new Date(`${String(value).slice(0, 10)}T12:00:00`);

/** Adds `n` days (negative allowed) to a calendar date. */
export function addDays(day, n) {
  const d = parseDay(day); // noon anchor keeps the date stable
  d.setDate(d.getDate() + n); // Date handles month/year rollover
  return isoDay(d);
}

/** Whole days from `a` to `b` (b - a). Accepts dates or ISO timestamps. */
export const dayDiff = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86_400_000);

/** An ISO timestamp `n` days before `now`, at a varied hour so seeded timelines look natural. */
export function daysAgoISO(n, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 7), 15 * (n % 4), 0, 0); // spread seeded events across the day
  return d.toISOString();
}

/**
 * Normalises user-supplied dates from imports: ISO, US M/D/YYYY, or Excel serial numbers.
 * @param {unknown} value
 * @returns {string} YYYY-MM-DD, or '' when the value cannot be read
 */
export function toISODate(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    // Excel serial date: days since 1899-12-30 (25569 = days to 1970-01-01)
    const d = new Date(Math.round((value - 25569) * 86_400_000));
    return isoDay(new Date(d.getTime() + d.getTimezoneOffset() * 60_000));
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // ISO-like
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // US M/D/Y, as HubSpot exports it
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
  const d = new Date(s); // last resort: let the engine try (e.g. "Dec 5, 2026")
  return Number.isNaN(d.getTime()) ? '' : isoDay(d);
}

/** Calendar quarter label for a day, e.g. "2026 Q4". */
export function quarterLabel(day) {
  const d = parseDay(day);
  return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
}
