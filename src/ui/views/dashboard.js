/**
 * @file Home dashboard (build brief slide 6; A-01 to A-04): pipeline summary, deals by stage,
 * my deals or whole team by close year, my tasks overdue first, recent activity on my deals,
 * contract renewal alerts (F-03) and the V2 weekly brief placeholder.
 */
import { CLOSED_STAGES, STAGES } from '../../config/constants.js';
import { contractAlerts, pipelineSummary } from '../../core/reports.js';
import { companyName, dealName, userName } from '../../core/lookups.js';
import { addDays, dayDiff, today } from '../../utils/dates.js';
import { esc, fmtDate, kmoney } from '../../utils/format.js';
import { ctx, state } from '../context.js';
import { $, $$ } from '../dom.js';
import { bindTaskChecks } from '../components/tasks.js';

/** Greeting by local hour. */
const greeting = (d) => (d.getHours() < 12 ? 'morning' : d.getHours() < 18 ? 'afternoon' : 'evening');

/** Short relative time for the activity feed: "now", "5m", "2h", "3d". */
function shortAgo(iso, now) {
  const m = (now - new Date(iso)) / 60_000;
  if (m < 1) return 'now';
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

/** Stage labels shortened for the mini chart, as in the mockup. */
const SHORT = {
  'On Hold': 'Hold',
  Partners: 'Partn',
  Suspect: 'Susp',
  Prospect: 'Prosp',
  'Proposal sent': 'Prop',
  'Verbal Approval': 'Verbal',
  'Contract Sent': 'Contr',
};

/** One activity row: letter avatar (C call, S stage, N note), title, context and time. */
function activityRow(a, now) {
  const s = state();
  const deal = dealName(s, a.dealId);
  const company = companyName(s, a.companyId || s.deals.find((d) => d.id === a.dealId)?.companyId);
  let title = deal;
  let sub = company;
  if (a.kind === 'call') {
    title = `${company}: ${a.text.replace(/^(recorded|logged|assigned the call) /, '').replace(/[“”]/g, '')}`;
    sub = a.by === 'system' ? 'Fireflies call' : `Logged by ${userName(s, a.by)}`;
  } else if (a.kind === 'stage') title = `${deal} ${a.text}`;
  else if (a.kind === 'note') title = `Note on ${deal}`;
  else if (a.kind === 'created') title = `${deal} created`;
  const letter = { call: 'C', stage: 'S', note: 'N', created: 'D' }[a.kind] || 'A';
  return `<li><span class="av ${a.kind === 'call' ? 'ol' : ''}" aria-hidden="true">${letter}</span><div class="b"><a class="t lnk" href="#deal-${a.dealId}">${esc(title)}</a><div class="small muted">${esc(sub)}</div></div><span class="small faint">${shortAgo(a.at, now)}</span></li>`;
}

/** Task row with the due label on the right, as in the mockup. */
function homeTask(t, now) {
  const d = today(now);
  const label = t.done
    ? 'Done'
    : t.dueDate < d
      ? 'Overdue'
      : t.dueDate === d
        ? 'Today'
        : t.dueDate === addDays(d, 1)
          ? 'Tomorrow'
          : fmtDate(t.dueDate).replace(/, \d{4}$/, '');
  const ref = t.refType === 'deal' ? companyName(state(), state().deals.find((x) => x.id === t.refId)?.companyId) : '';
  return `<div class="task ${t.done ? 'done' : ''}"><input type="checkbox" data-task="${t.id}" ${t.done ? 'checked' : ''} aria-label="Mark “${esc(t.title)}” done"><div style="min-width:0"><div class="tt">${esc(t.title)}</div><div class="small muted">${esc(ref)}</div></div><span class="due ${label === 'Overdue' ? 'warn' : ''}">${label}</span></div>`;
}

export function renderDashboard(root) {
  const now = ctx.now();
  const t = today(now);
  const ui = ctx.ui;
  const mine = ui.dashScope === 'mine';
  const all = ctx.api.all('deal');
  const years = [...new Set(all.map((d) => (d.expectedClose || '').slice(0, 4)).filter(Boolean))].sort();
  if (ui.dashYear === undefined) ui.dashYear = years.includes(t.slice(0, 4)) ? t.slice(0, 4) : ''; // default: this year
  const deals = all.filter(
    (d) =>
      (!mine || d.ownerId === ctx.user.id || (d.collaborators || []).includes(ctx.user.id)) &&
      (!ui.dashYear || (d.expectedClose || '').startsWith(ui.dashYear)),
  ); // A-04
  const s = pipelineSummary(deals, now);
  const openStages = STAGES.filter((x) => !CLOSED_STAGES.includes(x));
  const stageCounts = openStages.map((x) => [x, deals.filter((d) => d.stage === x).length]);
  const maxCount = Math.max(1, ...stageCounts.map(([, n]) => n));
  const ids = new Set(deals.map((d) => d.id));
  const acts = state()
    .activities.filter((a) => a.dealId && ids.has(a.dealId) && dayDiff(a.at, t) <= 7)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 7); // A-02
  const mineTasks = state().tasks.filter((x) => x.assigneeId === ctx.user.id);
  const open = mineTasks
    .filter((x) => !x.done)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6); // overdue first (A-03)
  const overdue = mineTasks.filter((x) => !x.done && x.dueDate < t).length;
  const alerts =
    ctx.user.role === 'gtm'
      ? contractAlerts(ctx.api.all('contract'), now).filter((a) => a.contract.renewalOwnerId === ctx.user.id)
      : contractAlerts(ctx.api.all('contract'), now);
  const pct = s.open ? Math.round((s.weighted / s.open) * 100) : 0;

  root.innerHTML = `<div class="pagehead"><h1>Good ${greeting(now)}, ${esc(ctx.user.name.split(' ')[0])}</h1><div class="sp"></div>
    <div class="seg" role="group" aria-label="Deal scope"><button data-scope="mine" class="${mine ? 'on' : ''}" aria-pressed="${mine}">My deals</button><button data-scope="team" class="${!mine ? 'on' : ''}" aria-pressed="${!mine}">Whole team</button></div>
    <select class="fsel" id="dashYear" aria-label="Close year"><option value="">Close year: all</option>${years.map((y) => `<option value="${y}"${ui.dashYear === y ? ' selected' : ''}>Close year: ${y}</option>`).join('')}</select></div>
  <div class="stats">
    <div class="stat"><div class="k">Open pipeline</div><div class="v">${kmoney(s.open)}</div><div class="k">${s.openCount} open deals</div></div>
    <div class="stat"><div class="k">Weighted pipeline</div><div class="v">${kmoney(s.weighted)}</div><div class="k">${pct}% of open value</div></div>
    <div class="stat"><div class="k">Closing in 30 / 60 / 90 days</div><div class="v">${s.closing[30].count} / ${s.closing[60].count} / ${s.closing[90].count}</div><div class="k">deals by expected close date</div></div>
    <div class="stat"><div class="k">Deals by stage</div><div class="minibars" role="img" aria-label="${stageCounts.map(([x, n]) => `${x}: ${n}`).join(', ')}">${stageCounts.map(([, n]) => `<div style="height:${Math.max(6, (n / maxCount) * 100)}%"></div>`).join('')}</div><div class="minilabels">${stageCounts.map(([x]) => `<span>${SHORT[x]}</span>`).join('')}</div></div>
  </div>
  <div class="dash">
    <div class="card"><div class="cardh"><h2>My tasks</h2>${overdue ? `<span class="warn small" style="margin-left:auto">${overdue} overdue</span>` : ''}</div>
      ${open.length ? open.map((x) => homeTask(x, now)).join('') : '<div class="empty">Nothing due. Nice.</div>'}
      <a class="small lnk muted" href="#tasks" style="display:inline-block;margin-top:10px">View all tasks</a></div>
    <div class="card"><div class="cardh"><h2>Recent activity on ${mine ? 'my' : 'team'} deals</h2><span class="count">Last 7 days</span></div>
      ${acts.length ? `<ul class="feed">${acts.map((a) => activityRow(a, now)).join('')}</ul>` : '<div class="empty">No calls, notes or stage changes this week.</div>'}</div>
    <div class="col">
      <div class="card placeholder"><div class="cardh"><h2>Weekly brief from Claude</h2><span class="v2" style="margin-left:auto">V2</span></div><p style="margin:0" class="small muted">Every Monday: what moved, what stalled and what needs attention, with sources (A-05).</p></div>
      <div class="card alerts"><div class="cardh"><h2>Alerts</h2><span class="count">next 90 days</span></div>
        ${
          alerts.length
            ? alerts
                .slice(0, 5)
                .map(
                  (a) =>
                    `<div class="al"><div class="k">Contract ending</div><a class="lnk" href="#contract-${a.contract.id}">${esc(a.contract.name)}</a> <span class="small ${a.band === 30 ? 'warn' : 'muted'}">ends ${fmtDate(a.contract.endDate).replace(/, \d{4}$/, '')}</span></div>`,
                )
                .join('')
            : '<div class="small muted">No contracts ending in the next 90 days.</div>'
        }
        <div class="al"><div class="k">Placements ending, time to invoice, overdue invoices</div><span class="v2">V2</span></div></div>
    </div>
  </div>`;
  $$('[data-scope]', root).forEach((b) => (b.onclick = () => ((ui.dashScope = b.dataset.scope), ctx.render())));
  $('#dashYear', root).onchange = (e) => ((ui.dashYear = e.target.value), ctx.render());
  bindTaskChecks(root);
}
