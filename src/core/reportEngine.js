/**
 * @file Report engine for Dashboards (L-12 to L-14): a report is an object, a measure, a grouping, an optional
 * second grouping, filters and a chart type. It runs on records the signed-in user is allowed to see, so role
 * rules and restricted fields (F-04) apply to every chart. Pure functions: no DOM, easy to test.
 */
import { SERVICE_SEP, STAGES, serviceCategory } from '../config/constants.js';
import { companyName, userName } from './lookups.js';
import { dayDiff, today } from '../utils/dates.js';

const ym = (d) => String(d || '').slice(0, 7);
const quarterOf = (d) => (d ? `${String(d).slice(0, 4)}-Q${Math.ceil(Number(String(d).slice(5, 7)) / 3)}` : '');
const dealStatus = (d) => (d.stage === 'Closed won' ? 'Won' : d.stage === 'Closed lost' ? 'Lost' : 'Open');

/**
 * Objects a report can use (L-13). Placements and invoices arrive in V2.
 * date: field the dashboard date range applies to; owner: field the owner filter applies to.
 */
export const REPORT_OBJECTS = Object.freeze({
  deal: {
    label: 'Deals',
    date: 'expectedClose',
    owner: 'ownerId',
    measures: [
      ['count', 'Count of deals'],
      ['sum:amount', 'Sum of amount'],
      ['avg:amount', 'Average amount'],
      ['sum:weighted', 'Sum of weighted amount'],
    ],
    groups: [
      ['stage', 'Stage'],
      ['status', 'Open, won or lost'],
      ['pipeline', 'Pipeline'],
      ['ownerId', 'Deal owner'],
      ['source', 'Source'],
      ['serviceCategory', 'Service line (category)'],
      ['service', 'Service'],
      ['industry', 'Industry'],
      ['dealType', 'Deal type'],
      ['priority', 'Priority'],
      ['closeMonth', 'Close month'],
      ['closeQuarter', 'Close quarter'],
      ['closeYear', 'Close year'],
      ['createMonth', 'Create month'],
      ['reachedStage', 'Stage reached (funnel)'],
    ],
  },
  company: {
    label: 'Companies',
    date: 'createdAt',
    owner: 'ownerId',
    measures: [
      ['count', 'Count of companies'],
      ['sum:employees', 'Sum of employees'],
    ],
    groups: [
      ['relationship', 'Relationship type'],
      ['industry', 'Industry'],
      ['ownerId', 'Account owner'],
      ['ownership', 'Ownership'],
      ['revenueBand', 'Revenue band'],
    ],
  },
  contact: {
    label: 'Contacts',
    date: 'createdAt',
    owner: 'ownerId',
    measures: [['count', 'Count of contacts']],
    groups: [
      ['seniority', 'Seniority'],
      ['source', 'Source'],
      ['ownerId', 'Contact owner'],
      ['companyId', 'Company'],
    ],
  },
  task: {
    label: 'Tasks',
    date: 'dueDate',
    owner: 'assigneeId',
    measures: [['count', 'Count of tasks']],
    groups: [
      ['type', 'Task type'],
      ['status', 'Status'],
      ['assigneeId', 'Assigned to'],
      ['dueMonth', 'Due month'],
    ],
  },
  call: {
    label: 'Calls',
    date: 'date',
    owner: '',
    measures: [
      ['count', 'Count of calls'],
      ['sum:durationMin', 'Total minutes'],
    ],
    groups: [
      ['matched', 'Matched or unmatched'],
      ['callMonth', 'Month'],
      ['companyId', 'Company'],
    ],
  },
  contract: {
    label: 'Contracts',
    date: 'effectiveDate',
    owner: 'renewalOwnerId',
    measures: [
      ['count', 'Count of contracts'],
      ['sum:totalValue', 'Sum of total value (restricted)'],
    ],
    groups: [
      ['type', 'Type'],
      ['status', 'Status'],
      ['renewalOwnerId', 'Renewal owner'],
      ['endQuarter', 'End quarter'],
    ],
  },
});

/** Objects listed in the builder but not available yet. */
export const FUTURE_OBJECTS = Object.freeze([
  ['placement', 'Placements (V2)'],
  ['invoice', 'Invoices (V2)'],
]);

/** Chart types (L-13). */
export const CHART_TYPES = Object.freeze([
  ['kpi', 'KPI'],
  ['bar', 'Bar'],
  ['line', 'Line'],
  ['table', 'Table'],
  ['funnel', 'Funnel'],
]);

/** Dashboard date ranges (L-14). */
export const DATE_RANGES = Object.freeze([
  ['all', 'Date: all'],
  ['this_year', 'Date: this year'],
  ['last_12', 'Date: last 12 months'],
  ['next_12', 'Date: next 12 months'],
  ['last_year', 'Date: last year'],
]);

/** Templates for "start from a template" in the report builder (slide 20). */
export const REPORT_TEMPLATES = Object.freeze([
  {
    id: 'won_by_month',
    name: 'Deals won by month',
    object: 'deal',
    measure: 'sum:amount',
    groupBy: 'closeMonth',
    thenBy: '',
    filters: [{ field: 'status', value: 'Won' }],
    chart: 'bar',
  },
  {
    id: 'pipeline_by_owner',
    name: 'Pipeline by owner',
    object: 'deal',
    measure: 'sum:amount',
    groupBy: 'ownerId',
    thenBy: '',
    filters: [{ field: 'status', value: 'Open' }],
    chart: 'bar',
  },
  {
    id: 'deals_by_service',
    name: 'Deals by service line',
    object: 'deal',
    measure: 'sum:amount',
    groupBy: 'closeQuarter',
    thenBy: 'serviceCategory',
    filters: [{ field: 'status', value: 'Won' }],
    chart: 'bar',
  },
  {
    id: 'tasks_overdue_by_owner',
    name: 'Tasks overdue by owner',
    object: 'task',
    measure: 'count',
    groupBy: 'assigneeId',
    thenBy: '',
    filters: [{ field: 'status', value: 'Overdue' }],
    chart: 'bar',
  },
]);

const def = (id, name, extra) => ({ id, name, object: 'deal', thenBy: '', filters: [], ...extra });

/**
 * Default dashboards (L-12): pipeline, funnel, revenue and marketing return. They are built in and read-only;
 * "Create dashboard" can start from any of them. Marketing return needs marketing spend (L-11, V3).
 */
export const DEFAULT_DASHBOARDS = Object.freeze([
  {
    id: 'def_pipeline',
    name: 'Pipeline',
    reports: [
      def('dp1', 'Open pipeline', { measure: 'sum:amount', groupBy: 'status', filters: [{ field: 'status', value: 'Open' }], chart: 'kpi' }),
      def('dp2', 'Weighted open pipeline', { measure: 'sum:weighted', groupBy: 'status', filters: [{ field: 'status', value: 'Open' }], chart: 'kpi' }),
      def('dp3', 'Weighted forecast by month', { measure: 'sum:weighted', groupBy: 'closeMonth', filters: [{ field: 'status', value: 'Open' }], chart: 'bar' }),
      def('dp4', 'Weighted forecast by quarter', {
        measure: 'sum:weighted',
        groupBy: 'closeQuarter',
        filters: [{ field: 'status', value: 'Open' }],
        chart: 'bar',
      }),
      def('dp5', 'Open pipeline by stage', { measure: 'sum:amount', groupBy: 'stage', filters: [{ field: 'status', value: 'Open' }], chart: 'bar' }),
      def('dp6', 'Open pipeline by owner', { measure: 'sum:amount', groupBy: 'ownerId', filters: [{ field: 'status', value: 'Open' }], chart: 'bar' }),
      def('dp7', 'Open pipeline by service line', {
        measure: 'sum:amount',
        groupBy: 'serviceCategory',
        filters: [{ field: 'status', value: 'Open' }],
        chart: 'bar',
      }),
      def('dp8', 'Open pipeline by industry', { measure: 'sum:amount', groupBy: 'industry', filters: [{ field: 'status', value: 'Open' }], chart: 'bar' }),
    ],
  },
  {
    id: 'def_funnel',
    name: 'Funnel and sources',
    tag: 'V2',
    reports: [
      def('df1', 'Stage conversion', { measure: 'count', groupBy: 'reachedStage', chart: 'funnel' }),
      def('df2', 'Deals created by source', { measure: 'count', groupBy: 'source', chart: 'table' }),
      def('df3', 'Revenue won by source', { measure: 'sum:amount', groupBy: 'source', filters: [{ field: 'status', value: 'Won' }], chart: 'table' }),
    ],
  },
  {
    id: 'def_revenue',
    name: 'Revenue',
    reports: [
      def('dr1', 'Closed won revenue', { measure: 'sum:amount', groupBy: 'status', filters: [{ field: 'status', value: 'Won' }], chart: 'kpi' }),
      def('dr2', 'Closed won revenue by month', { measure: 'sum:amount', groupBy: 'closeMonth', filters: [{ field: 'status', value: 'Won' }], chart: 'bar' }),
      def('dr3', 'Closed won revenue by service line', {
        measure: 'sum:amount',
        groupBy: 'closeQuarter',
        thenBy: 'serviceCategory',
        filters: [{ field: 'status', value: 'Won' }],
        chart: 'bar',
      }),
      def('dr4', 'Deals won by owner', { measure: 'count', groupBy: 'ownerId', filters: [{ field: 'status', value: 'Won' }], chart: 'table' }),
    ],
  },
  { id: 'def_marketing', name: 'Marketing return', tag: 'V3', reports: [] },
]);

/** Values a record has for a grouping key; several for multi-valued keys (services, stages reached). */
export function groupValues(state, object, r, key, now = new Date()) {
  const one = (v) => [v === undefined || v === null || v === '' ? '(none)' : String(v)];
  if (object === 'deal') {
    if (key === 'status') return [dealStatus(r)];
    if (key === 'serviceCategory') return (r.serviceLines || []).length ? [...new Set(r.serviceLines.map(serviceCategory))] : ['(none)'];
    if (key === 'service') return (r.serviceLines || []).length ? r.serviceLines : ['(none)'];
    if (key === 'industry') return one(state.companies.find((c) => c.id === r.companyId)?.industry);
    if (key === 'closeMonth') return one(ym(r.expectedClose));
    if (key === 'closeQuarter') return one(quarterOf(r.expectedClose));
    if (key === 'closeYear') return one(String(r.expectedClose || '').slice(0, 4));
    if (key === 'createMonth') return one(ym(r.createdAt));
    if (key === 'reachedStage') return [...new Set([...(r.stageHistory || []).map((h) => h.stage), r.stage])]; // every stage the deal passed through
  }
  if (object === 'task') {
    if (key === 'type') return [r.type || 'To-do'];
    if (key === 'status') return [r.done ? 'Completed' : r.dueDate < today(now) ? 'Overdue' : 'Open'];
    if (key === 'dueMonth') return one(ym(r.dueDate));
  }
  if (object === 'call') {
    if (key === 'matched') return [r.matched ? 'Matched' : 'Unmatched'];
    if (key === 'callMonth') return one(ym(r.date));
  }
  if (object === 'contract' && key === 'endQuarter') return one(quarterOf(r.endDate));
  return one(r[key]);
}

/** Display label for a grouping value. */
export function labelFor(state, key, value) {
  if (value === '(none)') return 'None';
  if (/^(ownerId|assigneeId|renewalOwnerId)$/.test(key)) return userName(state, value);
  if (key === 'companyId') return companyName(state, value);
  if (key === 'service') return value.split(SERVICE_SEP)[1] || value;
  if (/Month$/.test(key)) return new Date(`${value}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (/Quarter$/.test(key)) return value.replace(/^(\d{4})-(Q\d)$/, '$2 $1');
  return value;
}

/** Order of groups: time keys chronologically, stages in pipeline order, others by value (largest first). */
function orderKeys(key, keys, totals) {
  if (/Month$|Quarter$|Year$/.test(key)) return [...keys].sort((a, b) => (a === '(none)') - (b === '(none)') || a.localeCompare(b));
  if (key === 'stage' || key === 'reachedStage') return [...keys].sort((a, b) => STAGES.indexOf(a) - STAGES.indexOf(b));
  return [...keys].sort((a, b) => totals.get(b) - totals.get(a));
}

/** Value one record contributes to a measure. */
function measureOf(r, measure) {
  if (measure === 'count') return 1;
  const field = measure.split(':')[1];
  if (field === 'weighted') return ((+r.amount || 0) * (+r.probability || 0)) / 100;
  return +r[field] || 0;
}

/** Whether a record falls in the dashboard date range. Records with no date only show for "all". */
function inRange(value, range, now) {
  if (!range || range === 'all') return true;
  if (!value) return false;
  const d = String(value).slice(0, 10);
  const t = today(now);
  const y = t.slice(0, 4);
  if (range === 'this_year') return d.slice(0, 4) === y;
  if (range === 'last_year') return d.slice(0, 4) === String(Number(y) - 1);
  const diff = dayDiff(t, d); // positive = future
  return range === 'last_12' ? diff <= 0 && diff >= -365 : diff >= 0 && diff <= 365;
}

/** Applies report filters and dashboard filters (date range, owner, pipeline, source). */
export function filterRecords(state, object, records, report, dash = {}, now = new Date()) {
  const meta = REPORT_OBJECTS[object];
  return records.filter((r) => {
    if (!inRange(r[meta.date], dash.range, now)) return false;
    if (dash.ownerId && meta.owner && r[meta.owner] !== dash.ownerId) return false;
    if (object === 'deal' && dash.pipeline && r.pipeline !== dash.pipeline) return false;
    if (object === 'deal' && dash.source && r.source !== dash.source) return false;
    return (report.filters || []).every((f) => !f.field || !f.value || groupValues(state, object, r, f.field, now).includes(f.value));
  });
}

/**
 * Runs a report.
 * @returns {{rows:{key:string,label:string,value:number,series:Record<string,number>}[], series:{key:string,label:string}[],
 *   total:number, money:boolean, count:number}}
 */
export function runReport(state, records, report, dash = {}, now = new Date()) {
  const list = filterRecords(state, report.object, records, report, dash, now);
  const avg = report.measure.startsWith('avg:');
  const sums = new Map(); // group -> {sum, n, series: Map}
  const seriesKeys = new Set();
  for (const r of list) {
    const v = measureOf(r, report.measure);
    const subs = report.thenBy ? groupValues(state, report.object, r, report.thenBy, now) : [''];
    for (const g of groupValues(state, report.object, r, report.groupBy, now)) {
      const e = sums.get(g) || { sum: 0, n: 0, series: new Map() };
      e.sum += v;
      e.n += 1;
      for (const s of subs) {
        seriesKeys.add(s);
        const se = e.series.get(s) || { sum: 0, n: 0 };
        se.sum += v;
        se.n += 1;
        e.series.set(s, se);
      }
      sums.set(g, e);
    }
  }
  const val = (e) => (avg ? (e.n ? e.sum / e.n : 0) : e.sum);
  const totals = new Map([...sums].map(([k, e]) => [k, val(e)]));
  const keys = orderKeys(report.groupBy, [...sums.keys()], totals);
  const series = report.thenBy
    ? orderKeys(report.thenBy, [...seriesKeys], new Map([...seriesKeys].map((s) => [s, 0]))).map((s) => ({ key: s, label: labelFor(state, report.thenBy, s) }))
    : [];
  const rows = keys.map((k) => {
    const e = sums.get(k);
    return {
      key: k,
      label: labelFor(state, report.groupBy, k),
      value: val(e),
      series: Object.fromEntries([...e.series].map(([s, se]) => [s, avg ? se.sum / se.n : se.sum])),
    };
  });
  const total = avg
    ? list.length
      ? list.reduce((a, r) => a + measureOf(r, report.measure), 0) / list.length
      : 0
    : list.reduce((a, r) => a + measureOf(r, report.measure), 0);
  return { rows, series, total, money: report.measure !== 'count' && !/employees|durationMin/.test(report.measure), count: list.length };
}

/** Rows for exporting a dashboard (L-14): one line per report, group and series. */
export function exportDashboardRows(state, recordsFor, reports, dash, now = new Date()) {
  const out = [];
  for (const rep of reports) {
    const res = runReport(state, recordsFor(rep.object), rep, dash, now);
    if (rep.chart === 'kpi') out.push({ Report: rep.name, Group: 'Total', 'Then by': '', Value: Math.round(res.total * 100) / 100 });
    else
      for (const row of res.rows) {
        if (!res.series.length) out.push({ Report: rep.name, Group: row.label, 'Then by': '', Value: Math.round(row.value * 100) / 100 });
        else
          for (const s of res.series)
            out.push({ Report: rep.name, Group: row.label, 'Then by': s.label, Value: Math.round((row.series[s.key] || 0) * 100) / 100 });
      }
  }
  return out;
}
