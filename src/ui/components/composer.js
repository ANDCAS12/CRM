/**
 * @file Activity composer on record pages: rich-text note (E-01), task with reminder (E-02, E-03),
 * and manually logged meeting or call (E-04). New notes and calls refresh the deal summary (H-04).
 */
import { canEdit } from '../../core/permissions.js';
import { addDays, today } from '../../utils/dates.js';
import { stripHtml } from '../../utils/format.js';
import { refreshSummary } from '../actions.js';
import { ctx, rerender } from '../context.js';
import { $, $$, sanitizeHtml, toast } from '../dom.js';
import { formHtml, readForm } from '../forms.js';

/** Composer tabs the current role may use. */
function availableTabs() {
  const u = ctx.user;
  return [
    ['note', 'Note', canEdit(u, 'note', null)],
    ['task', 'Task', canEdit(u, 'task', null)],
    ['call', 'Log meeting or call', canEdit(u, 'call', null)],
  ].filter((t) => t[2]);
}

/** Composer markup; empty for read-only roles. */
export function composerHtml() {
  const tabs = availableTabs();
  if (!tabs.length) return '';
  return `<div class="composer" id="composer"><div class="tabs" style="margin-bottom:10px" role="tablist">${tabs.map(([k, l], i) => `<button role="tab" data-ct="${k}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div><div id="ctBody"></div></div>`;
}

/**
 * Wires the composer.
 * @param {{refType:string, refId:string, dealId?:string, companyId?:string, contactId?:string}} ref
 * @returns {(tab:string)=>void} function that opens a tab (used by quick-action buttons)
 */
export function bindComposer(root, { refType, refId, dealId = '', companyId = '', contactId = '' }) {
  const body = $('#ctBody', root);
  if (!body) return () => {};
  const afterEvidence = () => dealId && refreshSummary(dealId, { auto: true }); // H-04: regenerate after each new note or call

  const show = (tab) => {
    $$('[data-ct]', root).forEach((b) => b.classList.toggle('on', b.dataset.ct === tab));
    if (tab === 'note') {
      body.innerHTML = `<div class="rtebar"><button type="button" data-cmd="bold" aria-label="Bold"><b>B</b></button><button type="button" data-cmd="italic" aria-label="Italic"><i>I</i></button><button type="button" data-cmd="insertUnorderedList">• List</button></div><div class="rte" contenteditable="true" id="rte" role="textbox" aria-multiline="true" aria-label="Note"></div><div style="text-align:right;margin-top:8px"><button class="btn pri sm" id="addNote">Save note</button></div>`;
      $$('[data-cmd]', body).forEach(
        (b) =>
          (b.onmousedown = (e) => {
            e.preventDefault(); // keep the editor's selection
            document.execCommand(b.dataset.cmd); // simple formatting; production uses a rich-text library
          }),
      );
      $('#addNote', body).onclick = () => {
        const html = $('#rte', body).innerHTML.trim();
        if (!stripHtml(html)) return toast('Write something first');
        ctx.api.create('note', { refType, refId, body: sanitizeHtml(html), by: ctx.user.id }); // sanitise before storing
        ctx.api.logActivity('note', { dealId, companyId, contactId, text: 'added a note' });
        ctx.store.save();
        toast('Note saved');
        afterEvidence();
        rerender();
      };
    }
    if (tab === 'task') {
      const due = addDays(today(ctx.now()), 2);
      body.innerHTML = `${formHtml('task', { assigneeId: ctx.user.id, dueDate: due, reminderDate: due, emailReminder: true })}<div style="text-align:right;margin-top:8px"><button class="btn pri sm" id="addTask">Create task</button></div>`;
      $('#addTask', body).onclick = () => {
        const t = readForm('task', body);
        if (!t.title || !t.dueDate) return toast('A task needs a title and due date');
        ctx.api.create('task', { ...t, refType, refId, done: false });
        toast('Task created');
        rerender();
      };
    }
    if (tab === 'call') {
      body.innerHTML = `<div class="grid2"><div class="full"><label class="l" for="mcT">Title</label><input class="f" id="mcT" placeholder="e.g. Pricing call with CFO"></div><div><label class="l" for="mcD">Date</label><input class="f" type="date" id="mcD" value="${today(ctx.now())}"></div><div><label class="l" for="mcM">Duration (min)</label><input class="f" type="number" id="mcM" value="30" min="0"></div><div class="full"><label class="l" for="mcS">Summary</label><textarea class="f" id="mcS"></textarea></div><div class="full"><label class="l" for="mcA">Action items (one per line)</label><textarea class="f" id="mcA" style="min-height:60px"></textarea></div></div><div style="text-align:right;margin-top:8px"><button class="btn pri sm" id="addCall">Log it</button></div>`;
      $('#addCall', body).onclick = () => {
        const title = $('#mcT', body).value.trim();
        if (!title) return toast('Add a title');
        ctx.api.create('call', {
          title,
          date: new Date(`${$('#mcD', body).value}T12:00:00`).toISOString(),
          durationMin: Number($('#mcM', body).value) || 0,
          attendees: [ctx.user.email],
          firefliesId: '',
          dealId,
          companyId,
          contactIds: contactId ? [contactId] : [],
          summary: $('#mcS', body).value.trim(),
          actionItems: $('#mcA', body)
            .value.split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          transcriptUrl: '',
          recordingUrl: '',
          source: 'manual',
          matched: true,
        });
        ctx.api.logActivity('call', { dealId, companyId, contactId, text: `logged “${title}”` });
        ctx.store.save();
        toast('Meeting logged');
        afterEvidence();
        rerender();
      };
    }
  };
  $$('[data-ct]', root).forEach((b) => (b.onclick = () => show(b.dataset.ct)));
  show($('[data-ct].on', root)?.dataset.ct || 'note');
  return (tab) => {
    show(tab);
    $('#composer', root)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}

/** Quick-action buttons under the key properties (HubSpot record layout). */
export function quickActionsHtml() {
  const tabs = availableTabs();
  if (!tabs.length) return '';
  const icon = { note: 'note', task: 'task', call: 'call' };
  const short = { note: 'Note', task: 'Task', call: 'Log call' };
  return `<div class="quick">${tabs.map(([k]) => `<button data-quick="${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${{ note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', task: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8L8 9.9a16 16 0 0 0 6 6l1.4-1.8c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1z"/>' }[icon[k]]}</svg>${short[k]}</button>`).join('')}</div>`;
}
