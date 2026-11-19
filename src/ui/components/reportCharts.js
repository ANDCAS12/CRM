/**
 * @file Charts for dashboard reports (L-13): KPI, bar, line, table and funnel. Colours come from CSS variables
 * (--c1 charcoal, olive, warm gold, primary) so light and dark themes both read well.
 */
import { esc, kmoney, truncate } from '../../utils/format.js';

const PALETTE = ['var(--c1)', 'var(--olive)', 'var(--gold)', 'var(--primary)'];
const fmt = (v, money) => (money ? kmoney(v) : Math.round(v).toLocaleString('en-US'));
const isTime = (key) => /Month$|Quarter$|Year$/.test(key || '');

/** Legend for series (second grouping). */
const legend = (series) =>
  series.length
    ? `<div class="legend">${series.map((s, i) => `<span><i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(s.label)}</span>`).join('')}</div>`
    : '';

/** Values per row: one per series, or the row total when there is no second grouping. */
const valuesOf = (row, series) => (series.length ? series.map((s) => row.series[s.key] || 0) : [row.value]);

function kpi(res) {
  return `<div class="kpi"><div class="v">${fmt(res.total, res.money)}</div><div class="small muted">${res.count} record${res.count === 1 ? '' : 's'}</div></div>`;
}

/** Vertical columns for time groupings, horizontal bars otherwise (long labels stay readable). */
function bar(res, groupBy) {
  const { rows, series } = res;
  const max = Math.max(1, ...rows.flatMap((r) => valuesOf(r, series)));
  const k = Math.max(1, series.length);
  if (isTime(groupBy)) {
    const W = 600;
    const H = 230;
    const B = 32;
    const gw = (W - 20) / rows.length;
    const bw = Math.min(30, (gw * 0.75) / k);
    const cols = rows
      .map((r, i) => {
        const x0 = 10 + i * gw + (gw - bw * k) / 2;
        const bars = valuesOf(r, series)
          .map((v, j) => {
            const h = Math.max(1, ((H - B - 22) * v) / max);
            return `<rect x="${x0 + j * bw}" y="${H - B - h}" width="${bw - 2}" height="${h}" rx="2" style="fill:${PALETTE[j % PALETTE.length]}"><title>${esc(r.label)}${series[j] ? ` · ${esc(series[j].label)}` : ''}: ${fmt(v, res.money)}</title></rect>`;
          })
          .join('');
        const top =
          k === 1
            ? `<text x="${x0 + bw / 2}" y="${H - B - Math.max(1, ((H - B - 22) * r.value) / max) - 5}" text-anchor="middle" font-size="11" fill="currentColor">${fmt(r.value, res.money)}</text>`
            : '';
        return `${bars}${top}<text x="${10 + i * gw + gw / 2}" y="${H - 12}" text-anchor="middle" font-size="11" fill="currentColor">${esc(truncate(r.label, 10))}</text>`;
      })
      .join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Column chart">${cols}</svg></div>${legend(series)}`;
  }
  const W = 600;
  const L = 170;
  const h = Math.max(10, 24 / k);
  const gap = 10;
  const H = rows.length * (h * k + gap) + 6;
  const body = rows
    .map((r, i) => {
      const y0 = i * (h * k + gap) + 4;
      const vals = valuesOf(r, series);
      const bars = vals
        .map(
          (v, j) =>
            `<rect x="${L}" y="${y0 + j * h}" width="${Math.max(1, ((W - L - 70) * v) / max)}" height="${h - 2}" rx="2" style="fill:${PALETTE[j % PALETTE.length]}"><title>${esc(r.label)}${series[j] ? ` · ${esc(series[j].label)}` : ''}: ${fmt(v, res.money)}</title></rect>`,
        )
        .join('');
      return `<text x="${L - 8}" y="${y0 + (h * k) / 2 + 4}" text-anchor="end" font-size="12" fill="currentColor">${esc(truncate(r.label, 24))}</text>${bars}<text x="${L + Math.max(1, ((W - L - 70) * Math.max(...vals)) / max) + 6}" y="${y0 + (h * k) / 2 + 4}" font-size="11" fill="currentColor">${fmt(r.value, res.money)}</text>`;
    })
    .join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${body}</svg></div>${legend(series)}`;
}

function line(res) {
  const { rows, series } = res;
  const W = 600;
  const H = 220;
  const B = 32;
  const max = Math.max(1, ...rows.flatMap((r) => valuesOf(r, series)));
  const step = rows.length > 1 ? (W - 60) / (rows.length - 1) : 0;
  const x = (i) => 30 + i * step;
  const y = (v) => H - B - ((H - B - 20) * v) / max;
  const lines = (series.length ? series : [{ key: null }])
    .map((s, j) => {
      const pts = rows.map((r, i) => [x(i), y(s.key === null ? r.value : r.series[s.key] || 0)]);
      return `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke-width="2.5" style="stroke:${PALETTE[j % PALETTE.length]}"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" style="fill:${PALETTE[j % PALETTE.length]}"/>`).join('')}`;
    })
    .join('');
  const labels = rows
    .map((r, i) => `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="currentColor">${esc(truncate(r.label, 10))}</text>`)
    .join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart">${lines}${labels}</svg></div>${legend(series)}`;
}

function table(res, groupLabel) {
  const { rows, series } = res;
  return `<div class="tablewrap"><table class="t"><thead><tr><th>${esc(groupLabel)}</th>${series.map((s) => `<th class="num">${esc(s.label)}</th>`).join('')}<th class="num">${series.length ? 'Total' : 'Value'}</th></tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr><td>${esc(r.label)}</td>${series.map((s) => `<td class="num">${fmt(r.series[s.key] || 0, res.money)}</td>`).join('')}<td class="num"><b>${fmt(r.value, res.money)}</b></td></tr>`,
    )
    .join('')}</tbody></table></div>`;
}

/** Horizontal funnel with the conversion from the previous step (L-07, L-09). */
function funnel(res) {
  const rows = res.rows.filter((r) => r.key !== 'Closed lost' && r.key !== 'On Hold' && r.key !== 'Partners'); // the selling path only
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<div class="funnel">${rows
    .map((r, i) => {
      const prev = rows[i - 1]?.value;
      const pct = prev ? `${Math.round((r.value / prev) * 100)}%` : '';
      return `<div class="fr"><span class="fl">${esc(r.label)}</span><span class="fb"><i style="width:${Math.max(2, (r.value / max) * 100)}%;background:${r.key === 'Closed won' ? 'var(--olive)' : 'var(--c1)'}"></i><b>${fmt(r.value, res.money)}</b></span><span class="fp">${pct}</span></div>`;
    })
    .join(
      '',
    )}<div class="small faint" style="margin-top:6px">Percent = conversion from the previous stage. Every stage change is time-stamped (B-06), so this builds up from day one.</div></div>`;
}

/**
 * Renders a report result as the chosen chart type.
 * @param {object} res runReport() result
 * @param {{chart:string, groupBy:string}} report
 * @param {string} groupLabel label of the grouping, for tables
 */
export function renderChart(res, report, groupLabel = 'Group') {
  if (report.chart === 'kpi') return kpi(res);
  if (!res.rows.length) return '<div class="empty">No data for these filters.</div>';
  if (report.chart === 'line') return line(res);
  if (report.chart === 'table') return table(res, groupLabel);
  if (report.chart === 'funnel') return funnel(res);
  return bar(res, report.groupBy);
}
