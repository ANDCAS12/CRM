/**
 * @file Reports (L-05, L-06): weighted forecast by month and quarter; pipeline by stage, owner,
 * service line, industry and source.
 */
import { PIPELINES, STAGES } from '../../config/constants.js';
import { isOpen } from '../../core/deals.js';
import { userName } from '../../core/lookups.js';
import { forecastByMonth, forecastByQuarter, groupPipeline, sumAmount } from '../../core/reports.js';
import { kmoney } from '../../utils/format.js';
import { exportRows } from '../actions.js';
import { ctx, state } from '../context.js';
import { $ } from '../dom.js';
import { barChart, columnChart } from '../components/charts.js';

export function renderReports(root) {
  const now = ctx.now();
  const deals = ctx.api.all('deal').filter((d) => !ctx.ui.reportPipeline || d.pipeline === ctx.ui.reportPipeline);
  const open = deals.filter(isOpen);
  const won = deals.filter((d) => d.stage === 'Closed won');
  const lost = deals.filter((d) => d.stage === 'Closed lost');
  const companies = new Map(state().companies.map((c) => [c.id, c]));
  const byStage = STAGES.filter((s) => isOpen({ stage: s })).map((s) => ({
    ...(groupPipeline(
      open.filter((d) => d.stage === s),
      () => s,
    )[0] || { label: s, value: 0, count: 0 }),
  }));
  const months = forecastByMonth(deals, now);
  const quarters = forecastByQuarter(deals);
  root.innerHTML = `<div class="pagehead"><div><h1>Reports</h1><div class="sub">Open pipeline ${kmoney(sumAmount(open))} · won ${kmoney(sumAmount(won))} (${won.length}) · lost ${lost.length}</div></div><div class="sp"></div>
    <select class="f" id="rp" style="width:auto" aria-label="Pipeline"><option value="">All pipelines</option>${PIPELINES.map((p) => `<option${ctx.ui.reportPipeline === p ? ' selected' : ''}>${p}</option>`).join('')}</select><button class="btn" id="rExp">Export forecast</button></div>
  <div class="card"><div class="cardh"><h2>Weighted forecast by month</h2><span class="faint small">expected close, next 6 months</span></div>${columnChart(months, 1100)}</div>
  <div class="chartgrid" style="margin-top:14px">
    <div class="card"><div class="cardh"><h2>Weighted forecast by quarter</h2></div>${columnChart(quarters)}</div>
    <div class="card"><div class="cardh"><h2>Pipeline by stage</h2><span class="faint small">value · deals</span></div>${barChart(byStage)}</div>
    <div class="card"><div class="cardh"><h2>By owner</h2></div>${barChart(groupPipeline(open, (d) => userName(state(), d.ownerId)))}</div>
    <div class="card"><div class="cardh"><h2>By service line</h2></div>${barChart(groupPipeline(open, (d) => d.serviceLine))}</div>
    <div class="card"><div class="cardh"><h2>By industry</h2></div>${barChart(groupPipeline(open, (d) => companies.get(d.companyId)?.industry))}</div>
    <div class="card"><div class="cardh"><h2>By source</h2></div>${barChart(groupPipeline(open, (d) => d.source))}</div>
  </div>`;
  $('#rp', root).onchange = (e) => ((ctx.ui.reportPipeline = e.target.value), ctx.render());
  $('#rExp', root).onclick = () =>
    exportRows(
      'ik-forecast',
      [...months, ...quarters].map((m) => ({
        Period: m.label,
        'Weighted (USD)': Math.round(m.weighted),
        'Unweighted (USD)': Math.round(m.value),
        Deals: m.count,
      })),
      'xlsx',
    );
}
