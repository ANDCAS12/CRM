/**
 * @file Tasks page (build brief slide 14; E-02, E-08, L-03): every task, open or past, with All and My views
 * plus saved custom views, quick views (all, due today, overdue, upcoming) and filters (assigned to, task type,
 * due date, linked record). Ticking a task completes it.
 */
import { TASK_TYPES } from '../../config/constants.js';
import { canEdit } from '../../core/permissions.js';
import { companyName, userName } from '../../core/lookups.js';
import { addDays, today } from '../../utils/dates.js';
import { esc, fmtDate } from '../../utils/format.js';
import { clone } from '../../utils/object.js';
import { taskForm } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';

const QUICK = [
  ['all', 'All'],
  ['today', 'Due today'],
  ['overdue', 'Overdue'],
  ['upcoming', 'Upcoming'],
];
const DUE = [
  ['', 'Due date'],
  ['week', 'Due: next 7 days'],
  ['month', 'Due: next 30 days'],
  ['past', 'Due: before today'],
];
const LINKS = [
  ['', 'Linked record'],
  ['deal', 'Linked to a deal'],
  ['company', 'Linked to a company'],
  ['contact', 'Linked to a contact'],
  ['contract', 'Linked to a contract'],
  ['none', 'Not linked'],
];

/** "Company: Deal" for deals, otherwise the record's name (slide 14 "Linked to"). */
function linkedLabel(t) {
  const s = state();
  if (t.refType === 'deal') {
    const d = s.deals.find((x) => x.id === t.refId);
    return d ? [`${companyName(s, d.companyId)}: ${d.name}`, `#deal-${d.id}`] : ['', ''];
  }
  const col = { company: s.companies, contact: s.contacts, contract: s.contracts }[t.refType];
  const r = col?.find((x) => x.id === t.refId);
  return r ? [r.name, `#${t.refType}-${r.id}`] : ['', ''];
}

/** Status shown in the table: Completed, Overdue or Open. */
const statusOf = (t, day) => (t.done ? 'Completed' : t.dueDate < day ? 'Overdue' : 'Open');

/** Applies the view, filters and (optionally) the quick view. */
function select(tasks, ui, day, withQuick = true) {
  const f = ui.f;
  const mine = ui.view === 'mine';
  return tasks.filter((t) => {
    if (mine && t.assigneeId !== ctx.user.id) return false;
    if (f.assigneeId && t.assigneeId !== f.assigneeId) return false;
    if (f.type && (t.type || 'To-do') !== f.type) return false;
    if (f.link === 'none' ? t.refType : f.link && t.refType !== f.link) return false;
    if (f.due === 'week' && !(t.dueDate >= day && t.dueDate <= addDays(day, 7))) return false;
    if (f.due === 'month' && !(t.dueDate >= day && t.dueDate <= addDays(day, 30))) return false;
    if (f.due === 'past' && !(t.dueDate < day)) return false;
    if (!withQuick || ui.quick === 'all') return true;
    if (t.done) return false; // quick views other than All show open tasks only
    return ui.quick === 'today' ? t.dueDate === day : ui.quick === 'overdue' ? t.dueDate < day : t.dueDate > day;
  });
}

export function renderTasks(root) {
  const ui = ctx.ui.tasks;
  const day = today(ctx.now());
  const all = state().tasks;
  const views = state().savedViews.filter((v) => v.objectType === 'task' && (v.shared || v.ownerId === ctx.user.id));
  const base = select(all, ui, day, false);
  const count = (q) => select(all, { ...ui, quick: q }, day).length;
  const rows = select(all, ui, day).sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate)); // open first, by due date
  const canCreate = canEdit(ctx.user, 'task', null);
  const users = state().users.filter((u) => u.status === 'active');
  const fsel = (k, opts, label) =>
    `<select class="fsel ${ui.f[k] ? 'on' : ''}" data-tf="${k}" aria-label="${label}">${opts.map(([v, l]) => `<option value="${esc(v)}"${(ui.f[k] || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;

  root.innerHTML = `<div class="pagehead"><h1>Tasks</h1><div class="sp"></div>${canCreate ? '<button class="btn pri" id="newT">+ Create task</button>' : ''}</div>
  <div class="viewtabs" role="tablist" aria-label="Task views">
    <button class="v ${ui.view === 'all' ? 'on' : ''}" data-tv="all" role="tab">All tasks</button>
    <button class="v ${ui.view === 'mine' ? 'on' : ''}" data-tv="mine" role="tab">My tasks</button>
    ${views.map((v) => `<button class="v ${ui.view === v.id ? 'on' : ''}" data-tv="${v.id}" role="tab">${esc(v.name)}${v.ownerId === ctx.user.id ? `<span class="x" data-tdel="${v.id}" role="button" aria-label="Delete view ${esc(v.name)}">✕</span>` : ''}</button>`).join('')}
    <button class="add" id="tSave" aria-label="Save view">+ Save view</button>
  </div>
  <div class="fbar">
    ${QUICK.map(([k, l]) => `<button class="chipbtn ${ui.quick === k ? 'on' : ''}" data-tq="${k}" aria-pressed="${ui.quick === k}">${l} <b>${count(k)}</b></button>`).join('')}
    ${fsel('assigneeId', [['', 'Assigned to'], ...users.map((u) => [u.id, `Assigned to: ${u.id === ctx.user.id ? 'Me' : u.name}`])], 'Assigned to')}
    ${fsel('type', [['', 'Task type'], ...TASK_TYPES.map((t) => [t, t])], 'Task type')}
    ${fsel('due', DUE, 'Due date')}
    ${fsel('link', LINKS, 'Linked record')}
  </div>
  <div class="tablewrap"><table class="t"><thead><tr><th class="cb"></th><th>Task</th><th>Type</th><th>Linked to</th><th>Due</th><th>Assigned to</th><th>Status</th></tr></thead><tbody>
  ${rows
    .map((t) => {
      const [label, href] = linkedLabel(t);
      const st = statusOf(t, day);
      const editable = canEdit(ctx.user, 'task', t);
      return `<tr class="${t.done ? 'done' : ''}"><td class="cb"><input type="checkbox" data-tdone="${t.id}" ${t.done ? 'checked' : ''} ${editable ? '' : 'disabled'} aria-label="Mark “${esc(t.title)}” ${t.done ? 'open' : 'complete'}"></td>
        <td><b class="${t.done ? 'faint' : ''}">${esc(t.title)}</b></td><td><span class="badge dark">${esc(t.type || 'To-do')}</span></td>
        <td class="small">${href ? `<a class="lnk" href="${href}" style="font-weight:500">${esc(label)}</a>` : '<span class="faint">—</span>'}</td>
        <td>${t.dueDate === day ? 'Today' : fmtDate(t.dueDate).replace(`, ${day.slice(0, 4)}`, '')}</td><td>${esc(userName(state(), t.assigneeId))}</td>
        <td class="${st === 'Overdue' ? 'warn' : st === 'Completed' ? 'faint' : ''}">${st}</td></tr>`;
    })
    .join('')}</tbody></table>${rows.length ? '' : '<div class="empty">No tasks match. Try another view or filter.</div>'}</div>
  <div class="tfoot">Showing ${rows.length} of ${base.length} tasks, open and past</div>`;

  $('#newT', root)?.addEventListener('click', () => taskForm());
  $$('[data-tv]', root).forEach(
    (b) =>
      (b.onclick = (e) => {
        if (e.target.dataset.tdel) return;
        const v = views.find((x) => x.id === b.dataset.tv);
        Object.assign(ui, v ? { view: v.id, quick: v.filters?.quick || 'all', f: clone(v.filters?.f || {}) } : { view: b.dataset.tv, quick: 'all', f: {} });
        ctx.render();
      }),
  );
  $$('[data-tdel]', root).forEach(
    (x) =>
      (x.onclick = () => {
        ctx.api.remove('savedView', x.dataset.tdel);
        if (ui.view === x.dataset.tdel) ui.view = 'all';
        ctx.render();
      }),
  );
  $$('[data-tq]', root).forEach((b) => (b.onclick = () => ((ui.quick = b.dataset.tq), rerender())));
  $$('[data-tf]', root).forEach((s) => (s.onchange = () => ((ui.f[s.dataset.tf] = s.value), rerender())));
  $$('[data-tdone]', root).forEach(
    (c) =>
      (c.onchange = () => {
        ctx.api.update('task', c.dataset.tdone, { done: c.checked });
        toast(c.checked ? 'Task completed' : 'Task reopened');
        rerender();
      }),
  );
  $('#tSave', root).onclick = () =>
    modal(
      'Save view',
      '<label class="l" for="svName">Name</label><input class="f" id="svName" placeholder="e.g. Overdue calls"><label class="chk" style="margin-top:12px"><input type="checkbox" id="svShared" checked> Share with the team</label>',
      {
        saveLabel: 'Save view',
        onSave: (body) => {
          const name = $('#svName', body).value.trim();
          if (!name) throw new Error('Name the view.');
          const v = ctx.api.create('savedView', {
            objectType: 'task',
            name,
            filters: { quick: ui.quick, f: clone(ui.f) },
            ownerId: ctx.user.id,
            shared: $('#svShared', body).checked,
          });
          ui.view = v.id;
          toast('View saved');
          ctx.render();
        },
      },
    );
}
