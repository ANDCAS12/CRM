/**
 * @file Generic list query engine for contact and company views:
 * search, property filters, sorting (L-01..L-03; HubSpot-style "views + filters").
 */
import { dayDiff, today } from '../utils/dates.js';

/**
 * Filter operators. Each takes the record's value and the filter's value.
 * Kept as data so the UI can list them and tests can cover each one.
 */
export const OPERATORS = Object.freeze({
  is: { label: 'is', test: (v, x) => String(v ?? '').toLowerCase() === String(x ?? '').toLowerCase() },
  isNot: { label: 'is not', test: (v, x) => String(v ?? '').toLowerCase() !== String(x ?? '').toLowerCase() },
  contains: {
    label: 'contains',
    test: (v, x) =>
      String(v ?? '')
        .toLowerCase()
        .includes(String(x ?? '').toLowerCase()),
  },
  known: { label: 'is known', noValue: true, test: (v) => !(v === '' || v === null || v === undefined || v === false) },
  unknown: { label: 'is unknown', noValue: true, test: (v) => v === '' || v === null || v === undefined || v === false },
  gte: { label: 'is at least', test: (v, x) => v !== '' && v !== undefined && (typeof v === 'number' ? v >= +x : String(v) >= String(x)) },
  lte: { label: 'is at most', test: (v, x) => v !== '' && v !== undefined && (typeof v === 'number' ? v <= +x : String(v) <= String(x)) },
  lastDays: { label: 'in the last N days', test: (v, x, now) => Boolean(v) && dayDiff(String(v), today(now)) <= +x && dayDiff(String(v), today(now)) >= 0 },
});

/**
 * Runs a query over rows.
 * @param {object[]} rows records
 * @param {{search?: string, filters?: {field:string, op:string, value?:any}[], sort?: {field:string, dir:1|-1}, ids?: string[]}} query
 * @param {Record<string, (row:object)=>any>} accessors computed values per field (e.g. company name)
 * @param {string[]} searchFields fields searched by the free-text box
 */
export function runQuery(rows, query, accessors = {}, searchFields = [], now = new Date()) {
  const get = (row, field) => (accessors[field] ? accessors[field](row) : row[field]); // computed or stored value
  const term = String(query.search || '')
    .toLowerCase()
    .trim();
  const idSet = query.ids ? new Set(query.ids) : null; // "view imported records" pins a set of ids
  let out = rows.filter((row) => {
    if (idSet && !idSet.has(row.id)) return false;
    if (
      term &&
      !searchFields.some((f) =>
        String(get(row, f) ?? '')
          .toLowerCase()
          .includes(term),
      )
    )
      return false;
    for (const f of query.filters || []) {
      const op = OPERATORS[f.op];
      if (op && !op.test(get(row, f.field), f.value, now)) return false; // every filter must pass (AND)
    }
    return true;
  });
  if (query.sort?.field) {
    const { field, dir } = query.sort;
    out = out.slice().sort((a, b) => {
      const x = get(a, field) ?? '';
      const y = get(b, field) ?? '';
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir; // numeric sort
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir; // natural text sort
    });
  }
  return out;
}
