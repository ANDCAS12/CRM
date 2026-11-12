/**
 * @file Small object helpers.
 */

/** Deep clone for JSON-safe data (records never hold functions or Dates). */
export const clone = (o) => JSON.parse(JSON.stringify(o));

/** Short random id with a type prefix, e.g. "de_k3j9x2abc". Prefix makes ids readable in logs. */
export const uid = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

/** True for '', null, undefined, empty arrays and false. */
export const isBlank = (v) => v === '' || v === null || v === undefined || v === false || (Array.isArray(v) && v.length === 0);

/** Stable equality for scalar/array/object field values (used to skip no-op updates). */
export const sameValue = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
