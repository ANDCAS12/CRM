/**
 * @file Pure formatting helpers (no DOM), safe to use in Node tests.
 */
import { parseDay } from './dates.js';

/** HTML-escapes any value for safe interpolation into templates (prevents XSS). */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Full USD amount, e.g. "$420,000"; em dash when empty. */
export function money(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(+n)) return '—';
  return `$${Math.round(+n).toLocaleString('en-US')}`;
}

/** Compact USD amount for cards and charts, e.g. "$1.4M", "$420K". */
export function kmoney(n) {
  const v = +n || 0;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

/** "Dec 5, 2026" from a day or timestamp. */
export function fmtDate(value) {
  if (!value) return '—';
  const d = String(value).length <= 10 ? parseDay(value) : new Date(value); // days at noon, timestamps as-is
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Nov 10, 11:15 AM" from a timestamp. */
export function fmtDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Relative time, e.g. "3 days ago". */
export function ago(iso, now = new Date()) {
  if (!iso) return '—';
  const minutes = (now - new Date(iso)) / 60_000;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
  const days = Math.round(minutes / 1440);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Strips tags from rich-text notes so they can be searched and sent to the AI as plain text. */
export const stripHtml = (html) =>
  String(html || '')
    .replace(/<br\s*\/?>/gi, ' ') // line breaks become spaces
    .replace(/<\/(p|li|div)>/gi, ' ') // block ends become spaces
    .replace(/<[^>]*>/g, '') // drop remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&') // decode &amp; last so "&amp;lt;" stays literal
    .replace(/\s+/g, ' ')
    .trim();

/** Lower-cased domain part of an email address ('' when missing). */
export const domainOf = (email) => (String(email || '').split('@')[1] || '').toLowerCase().trim();

/** Normalises a website or domain to a bare host: "https://www.acme.com/x" -> "acme.com". */
export const normalizeDomain = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');

/** Truncates text with an ellipsis. */
export const truncate = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
