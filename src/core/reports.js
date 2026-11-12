/**
 * @file Pipeline metrics and forecasts (A-01, L-05, L-06, F-03).
 */
import { CONTRACT_ALERT_BANDS, STAGES } from '../config/constants.js';
import { dayDiff, isoDay, quarterLabel, today } from '../utils/dates.js';
import { isOpen, weighted } from './deals.js';

/** Sum of deal amounts. */
export const sumAmount = (deals) => deals.reduce((s, d) => s + (+d.amount || 0), 0);
/** Sum of weighted amounts. */
export const sumWeighted = (deals) => deals.reduce((s, d) => s + weighted(d), 0);

/**
 * Dashboard summary bar (A-01).
 * @returns {{open:number, openCount:number, weighted:number, closing:Record<number,{value:number,count:number}>, byStage:[string,number][]}}
 */
export function pipelineSummary(deals, now = new Date()) {
  const open = deals.filter(isOpen);
  const t = today(now);
  const closing = {};
  for (const n of [30, 60, 90]) {
    const list = open.filter((d) => d.expectedClose && dayDiff(t, d.expectedClose) >= 0 && dayDiff(t, d.expectedClose) <= n); // closes within n days, not overdue
    closing[n] = { value: sumAmount(list), count: list.length };
  }
  return {
    open: sumAmount(open),
    openCount: open.length,
    weighted: sumWeighted(open),
    closing,
    byStage: STAGES.map((s) => [s, deals.filter((d) => d.stage === s).length]),
  };
}

/** Groups open deals by a key and returns rows sorted by value (L-05). */
export function groupPipeline(deals, keyFn) {
  const groups = new Map();
  for (const d of deals.filter(isOpen)) {
    const key = keyFn(d) || 'Not set';
    const g = groups.get(key) || { label: key, value: 0, weighted: 0, count: 0 };
    g.value += +d.amount || 0;
    g.weighted += weighted(d);
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.value - a.value);
}

/** Weighted forecast for the next `months` calendar months by expected close (L-06). */
export function forecastByMonth(deals, now = new Date(), months = 6) {
  const open = deals.filter(isOpen);
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1); // first of each month avoids day overflow
    const key = isoDay(d).slice(0, 7);
    const list = open.filter((x) => (x.expectedClose || '').slice(0, 7) === key);
    return { key, label: d.toLocaleDateString('en-US', { month: 'short' }), weighted: sumWeighted(list), value: sumAmount(list), count: list.length };
  });
}

/** Weighted forecast by calendar quarter (L-06). */
export function forecastByQuarter(deals, limit = 6) {
  const groups = new Map();
  for (const d of deals.filter(isOpen)) {
    if (!d.expectedClose) continue; // undated deals cannot be forecast
    const key = quarterLabel(d.expectedClose);
    const g = groups.get(key) || { key, label: key, weighted: 0, value: 0, count: 0 };
    g.weighted += weighted(d);
    g.value += +d.amount || 0;
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(0, limit);
}

/**
 * Contracts ending within 90 days, tagged with the 30/60/90 band (F-03).
 * @returns {{contract:object, days:number, band:number}[]}
 */
export function contractAlerts(contracts, now = new Date()) {
  const t = today(now);
  const max = Math.max(...CONTRACT_ALERT_BANDS);
  return contracts
    .filter((k) => k.endDate && k.status !== 'Expired')
    .map((k) => {
      const days = dayDiff(t, k.endDate);
      return { contract: k, days, band: CONTRACT_ALERT_BANDS.find((b) => days <= b) ?? max };
    })
    .filter((a) => a.days >= 0 && a.days <= max)
    .sort((a, b) => a.days - b.days);
}
