/**
 * @file "View all properties" panel: searchable, grouped properties with inline editing.
 * Restricted fields show as restricted; system (auto-filled) fields are read-only (§4 "auto").
 */
import { fieldDefs } from '../../config/fields.js';
import { canEdit, canSeeRestricted, fieldEditable } from '../../core/permissions.js';
import { esc } from '../../utils/format.js';
import { saveField } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, drawer } from '../dom.js';
import { displayValue, inputHtml } from '../forms.js';

/** Groups field definitions in declaration order. */
function grouped(fields) {
  const groups = new Map();
  for (const f of fields) {
    const g = f.g || 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(f);
  }
  return groups;
}

/** Read-only grouped property list used by the record "About" tab. */
export function propertiesHtml(type, record) {
  const groups = grouped(fieldDefs(type, state()));
  return [...groups]
    .map(
      ([g, fields]) =>
        `<div class="propgroup"><h3>${esc(g)}</h3><dl class="kv">${fields.map((f) => `<dt>${esc(f.l)}</dt><dd>${f.restricted && !canSeeRestricted(ctx.user.role) ? '<span class="lock">Restricted</span>' : displayValue(f, record[f.k])}</dd>`).join('')}</dl></div>`,
    )
    .join('');
}

/**
 * Opens the side panel for a record.
 * @param {string} type
 * @param {string} id
 */
export function openPropertiesPanel(type, id) {
  const panel = drawer(
    'All properties',
    `<input class="f" id="propQ" placeholder="Search properties" aria-label="Search properties" autocomplete="off"><div id="propList" style="margin-top:10px"></div>`,
  );
  const draw = () => {
    const record = ctx.api.get(type, id); // scrubbed: restricted values never reach the panel
    const q = $('#propQ', panel.body).value.trim().toLowerCase();
    const editable = canEdit(ctx.user, type, ctx.api.raw(type, id));
    const fields = fieldDefs(type, state()).filter((f) => !q || f.l.toLowerCase().includes(q)); // search by label
    const groups = grouped(fields);
    $('#propList', panel.body).innerHTML = fields.length
      ? [...groups]
          .map(
            ([g, list]) =>
              `<div class="propgroup"><h3>${esc(g)}</h3>${list
                .map((f) => {
                  const restricted = f.restricted && !canSeeRestricted(ctx.user.role);
                  const canWrite = editable && !f.system && !restricted && fieldEditable(ctx.user, type, f.k);
                  const tag = restricted
                    ? '<span class="lock">restricted</span>'
                    : f.system
                      ? '<span class="faint">auto</span>'
                      : !canWrite
                        ? '<span class="faint">read only</span>'
                        : '';
                  return `<div class="prop"><div class="pl">${esc(f.l)} ${tag}</div><div class="pv ${canWrite ? 'ed' : ''}" ${canWrite ? `data-edit="${f.k}" tabindex="0" role="button" aria-label="Edit ${esc(f.l)}"` : ''}>${restricted ? '—' : displayValue(f, record[f.k])}</div></div>`;
                })
                .join('')}</div>`,
          )
          .join('')
      : '<div class="empty">No property matches that search.</div>';
    for (const el of $$('[data-edit]', panel.body)) {
      const open = () =>
        startEdit(
          el,
          fieldDefs(type, state()).find((f) => f.k === el.dataset.edit),
          record,
        );
      el.onclick = open;
      el.onkeydown = (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open());
    }
  };
  /** Swaps a value for an input; Enter or change saves, Escape cancels. */
  const startEdit = (el, f, record) => {
    if (el.querySelector('input,select,textarea')) return;
    el.innerHTML = inputHtml(f, record[f.k]);
    const input = el.querySelector('input,select,textarea');
    input.focus();
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      let value = f.t === 'multi' ? [...input.selectedOptions].map((o) => o.value) : f.t === 'check' ? input.checked : input.value.trim();
      if (f.t === 'number') value = value === '' ? '' : Number(value);
      if (saveField(type, id, f.k, value)) rerender(); // refresh the page behind the panel
      draw();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && f.t !== 'multi') commit();
      if (e.key === 'Escape') {
        e.stopPropagation(); // don't close the whole panel
        done = true;
        draw();
      }
    });
    input.addEventListener(f.t === 'select' || f.t === 'check' || f.t === 'date' ? 'change' : 'blur', commit);
    if (f.t !== 'select' && f.t !== 'check' && f.t !== 'date') input.addEventListener('change', commit);
  };
  $('#propQ', panel.body).addEventListener('input', draw);
  draw();
}
