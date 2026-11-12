/**
 * @file Dashboard (A-01..A-04): pipeline summary, deal count by stage, recent activity,
 * my tasks due today or overdue, scope toggle, and contract renewal alerts (F-03).
 */
import { contractAlerts, pipelineSummary } from '../../core/reports.js';
import { userName } from '../../core/lookups.js';
import { dayDiff, today } from '../../utils/dates.js';
import { ago, esc, fmtDate, kmoney } from '../../utils/format.js';
import { refLink } from '../actions.js';
import { ctx, state } from '../context.js';
import { $$, svg } from '../dom.js';
import { bindTaskChecks, taskRow } from '../components/tasks.js';

/** Greeting by local hour. */
const greeting = (d) => (d.getHours() < 12 ? 'morning' : d.getHours() < 18 ? 'afternoon' : 'evening');

export function renderDashboard(root) {
  const now = ctx.now();
  const t = today(now);
  const mine = ctx.ui.dashScope === 'mine';
  const deals = ctx.api.all('deal').filter((d) => !mine || d.ownerId === ctx.user.id || (d.collaborators || []).includes(ctx.user.id)); // A-04
  const s = pipelineSummary(deals, now);
  const ids = new Set(deals.map((d) => d.id));
  const acts = state()
    .activities.filter((a) => a.dealId && ids.has(a.dealId) && dayDiff(a.at, t) <= 7)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 14); // A-02 last 7 days
  const tasks = state()
    .tasks.filter((x) => x.assigneeId === ctx.user.id && !x.done && x.dueDate <= t)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)); // A-03
  const doneToday = state().tasks.filter((x) => x.assigneeId === ctx.user.id && x.done && x.doneAt?.slice(0, 10) === t);
  const alerts = ctx.user.role === 'gtm' ? [] : contractAlerts(ctx.api.all('contract'), now);

  root.innerHTML = `<div class="pagehead"><div><h1>Good ${greeting(now)}, ${esc(ctx.user.name.split(' ')[0])}</h1><div class="sub">${fmtDate(t)} · ${mine ? 'Your deals' : 'Whole team'}</div></div><div class="sp"></div>
    <div class="seg" role="group" aria-label="Deal scope"><button data-scope="mine" class="${mine ? 'on' : ''}" aria-pressed="${mine}">My deals</button><button data-scope="team" class="${!mine ? 'on' : ''}" aria-pressed="${!mine}">Whole team</button></div></div>
  <div class="stats">
    <div class="stat"><div class="k">Open pipeline</div><div class="v key">${kmoney(s.open)}</div><div class="k">${s.openCount} open deals</div></div>
    <div class="stat"><div class="k">Weighted pipeline</div><div class="v">${kmoney(s.weighted)}</div><div class="k">by stage probability</div></div>
    ${[30, 60, 90].map((n) => `<div class="stat"><div class="k">Closing in ${n} days</div><div class="v">${kmoney(s.closing[n].value)}</div><div class="k">${s.closing[n].count} deals</div></div>`).join('')}
  </div>
  <div class="stagebar" aria-label="Deal count by stage">${s.byStage.map(([stage, n]) => `<div title="${esc(stage)}"><b>${n}</b><span>${esc(stage)}</span></div>`).join('')}</div>
  <div class="dash">
    <div class="card"><div class="cardh"><h2>Recent activity</h2><span class="faint small">last 7 days</span></div>
      ${acts.length ? `<ul class="feed">${acts.map((a) => `<li><div class="ic">${svg(a.kind === 'call' ? 'call' : a.kind === 'note' ? 'note' : 'stage')}</div><div class="b"><div><b>${esc(userName(state(), a.by))}</b> ${esc(a.text)}</div><div class="small muted">${refLink('deal', a.dealId)} · ${ago(a.at, now)}</div></div></li>`).join('')}</ul>` : `<div class="empty">No calls, notes or stage changes on ${mine ? 'your' : 'team'} deals this week.</div>`}
    </div>
    <div>
      <div class="card"><div class="cardh"><h2>My tasks</h2><span class="faint small">due today and overdue</span><div class="sp"></div><a class="small lnk" href="#tasks">All tasks</a></div>
        ${tasks.length || doneToday.length ? tasks.concat(doneToday).map(taskRow).join('') : '<div class="empty">Nothing due today.</div>'}
      </div>
      ${
        alerts.length
          ? `<div class="card"><div class="cardh"><h2>Contract renewals</h2><span class="faint small">next 90 days</span></div><ul class="mini">${alerts
              .slice(0, 6)
              .map(
                (a) =>
                  `<li><span style="flex:1">${refLink('contract', a.contract.id)}<div class="small muted">${esc(a.contract.type)}</div></span><span class="${a.band === 30 ? 'warn' : ''} small">${a.days}d</span></li>`,
              )
              .join('')}</ul></div>`
          : ''
      }
    </div>
  </div>`;
  $$('[data-scope]', root).forEach(
    (b) =>
      (b.onclick = () => {
        ctx.ui.dashScope = b.dataset.scope;
        ctx.render();
      }),
  );
  bindTaskChecks(root);
}
