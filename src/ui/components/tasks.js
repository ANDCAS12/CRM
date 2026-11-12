/**
 * @file Task row with a tick box (A-03, E-02).
 */
import { firstName } from '../../core/lookups.js';
import { today } from '../../utils/dates.js';
import { esc, fmtDate } from '../../utils/format.js';
import { refLink } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $$, toast } from '../dom.js';

/** One task line; overdue dates are emphasised. */
export function taskRow(t) {
  const overdue = !t.done && t.dueDate < today(ctx.now());
  return `<div class="task ${t.done ? 'done' : ''}"><input type="checkbox" data-task="${t.id}" ${t.done ? 'checked' : ''} aria-label="Mark “${esc(t.title)}” done"><div style="flex:1;min-width:0"><div class="tt">${esc(t.title)}</div><div class="small muted">${t.refType ? `${refLink(t.refType, t.refId)} · ` : ''}<span class="${overdue ? 'warn' : ''}">${overdue ? 'Overdue · ' : ''}${fmtDate(t.dueDate)}</span> · ${esc(firstName(state(), t.assigneeId))}${t.emailReminder ? ' · email reminder' : ''}</div></div></div>`;
}

/** Wires every task checkbox inside `root` to toggle done. */
export function bindTaskChecks(root) {
  for (const box of $$('[data-task]', root)) {
    box.onchange = () => {
      try {
        ctx.api.update('task', box.dataset.task, { done: box.checked, doneAt: box.checked ? ctx.now().toISOString() : '' });
        toast(box.checked ? 'Task done' : 'Task reopened');
      } catch (e) {
        toast(e.message);
      }
      rerender();
    };
  }
}
