/**
 * @file Hash route parsing, shared by the shell and panels (kept separate to avoid import cycles).
 */

/** Parses "#deal-d_123" into { page: 'deal', id: 'd_123' }; empty hash means home. */
export function parseRoute(hash) {
  const h = String(hash || '').replace(/^#/, '') || 'home';
  const dash = h.indexOf('-');
  return dash === -1 ? { page: h, id: '' } : { page: h.slice(0, dash), id: h.slice(dash + 1) };
}
