/**
 * @file Tasks page (E-02, E-03): overdue, today, upcoming and done, mine or the whole team.
 */
import { canEdit } from '../../core/permissions.js';
import { addDays, today } from '../../utils/dates.js';
import { ctx, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { formHtml, inputHtml, readForm } from '../forms.js';
import { bindTaskChecks, taskRow } from '../components/tasks.js';

export function renderTasks(root) {
  const t = today(ctx.now());
  const tab = ctx.ui.tasksTab;
  const list = state().tasks.filter((x) => tab === 'all' || x.assigneeId === ctx.user.id);
  const groups = [
    ['Overdue', list.filter((x) => !x.done && x.dueDate < t)],
    ['Today', list.filter((x) => !x.done && x.dueDate === t)],
    ['Upcoming', list.filter((x) => !x.done && x.dueDate > t)],
    ['Done', list.filter((x) => x.done).slice(-15)], // recent completions only
  ];
  root.innerHTML = `<div class="pagehead"><div><h1>Tasks</h1><div class="sub">Reminders show in the bell and go out by email when the reminder date arrives.</div></div><div class="sp"></div>${canEdit(ctx.user, 'task', null) ? '<button class="btn pri" id="newT">Create task</button>' : ''}</div>
  <div class="tabs" role="tablist"><button role="tab" data-tt="mine" class="${tab === 'mine' ? 'on' : ''}">My tasks</button><button role="tab" data-tt="all" class="${tab === 'all' ? 'on' : ''}">Whole team</button></div>
  ${
    groups
      .map(([g, items]) =>
        items.length
          ? `<div class="card"><div class="cardh"><h2>${g}</h2><span class="faint small">${items.length}</span></div>${items
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .map(taskRow)
              .join('')}</div>`
          : '',
      )
      .join('') || '<div class="empty">No tasks yet. Create one here or from any record.</div>'
  }`;
  $$('[data-tt]', root).forEach((b) => (b.onclick = () => ((ctx.ui.tasksTab = b.dataset.tt), ctx.render())));
  bindTaskChecks(root);
  $('#newT', root)?.addEventListener('click', () => {
    const due = addDays(t, 1);
    modal(
      'Create task',
      `${formHtml('task', { assigneeId: ctx.user.id, dueDate: due, reminderDate: due, emailReminder: true })}<div style="margin-top:12px"><label class="l" for="f_tdeal">Linked deal</label>${inputHtml({ k: 'tdeal', t: 'select', o: [['', ''], ...ctx.api.all('deal').map((d) => [d.id, d.name])] }, '')}</div>`,
      {
        saveLabel: 'Create task',
        onSave: (body) => {
          const task = readForm('task', body);
          if (!task.title) throw new Error('Name the task.');
          const dealId = $('#f_tdeal', body).value;
          ctx.api.create('task', { ...task, done: false, refType: dealId ? 'deal' : '', refId: dealId });
          toast('Task created');
          ctx.render();
        },
      },
    );
  });
}
