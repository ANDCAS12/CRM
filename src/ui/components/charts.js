/**
 * @file Minimal SVG charts in brand colours (§7: primary series ik-primary, secondary ik-olive).
 */
import { esc, kmoney, truncate } from '../../utils/format.js';

const PRIMARY = '#742208'; // ik-primary
const OLIVE = '#6B7D2E'; // ik-olive

/**
 * Horizontal bars: label, value bar, "value · count" caption.
 * @param {{label:string, value:number, count?:number}[]} rows
 */
export function barChart(rows) {
  if (!rows.length) return '<div class="empty">No data yet.</div>';
  const max = Math.max(1, ...rows.map((r) => r.value)); // avoid divide-by-zero
  const W = 560;
  const L = 150; // label gutter
  const h = 26;
  const H = rows.length * (h + 8) + 10;
  const bars = rows.map((r, i) => {
    const y = i * (h + 8) + 4;
    const w = Math.max(1, ((W - L - 80) * r.value) / max);
    return `<text x="${L - 8}" y="${y + h / 2 + 4}" text-anchor="end" font-size="12" fill="currentColor">${esc(truncate(r.label, 22))}</text><rect x="${L}" y="${y}" width="${w}" height="${h}" rx="4" fill="${PRIMARY}"/><text x="${L + w + 6}" y="${y + h / 2 + 4}" font-size="12" fill="currentColor">${kmoney(r.value)}${r.count !== undefined ? ` · ${r.count}` : ''}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${bars.join('')}</svg></div>`;
}

/**
 * Paired columns: weighted (primary) vs unweighted (olive) per period.
 * @param {{label:string, weighted:number, value:number}[]} rows
 * @param {number} [W] viewBox width; wider charts keep text small on full-width cards
 */
export function columnChart(rows, W = 560) {
  if (!rows.length) return '<div class="empty">No close dates set.</div>';
  const max = Math.max(1, ...rows.map((r) => Math.max(r.weighted, r.value)));
  const H = 220;
  const B = 30; // bottom axis gutter
  const gw = (W - 20) / rows.length;
  const bw = Math.min(26, gw / 2.6);
  const cols = rows.map((r, i) => {
    const x = 10 + i * gw + gw / 2;
    const hw = ((H - B - 24) * r.weighted) / max;
    const hv = ((H - B - 24) * r.value) / max;
    return `<rect x="${x - bw - 1}" y="${H - B - hv}" width="${bw}" height="${Math.max(1, hv)}" rx="3" fill="${OLIVE}"/><rect x="${x + 1}" y="${H - B - hw}" width="${bw}" height="${Math.max(1, hw)}" rx="3" fill="${PRIMARY}"/><text x="${x + bw / 2}" y="${H - B - hw - 5}" text-anchor="middle" font-size="11" fill="currentColor">${kmoney(r.weighted)}</text><text x="${x}" y="${H - 10}" text-anchor="middle" font-size="12" fill="currentColor">${esc(r.label)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weighted versus unweighted forecast">${cols.join('')}</svg></div><div class="legend"><span><i style="background:${PRIMARY}"></i>Weighted</span><span><i style="background:${OLIVE}"></i>Unweighted</span></div>`;
}
