/**
 * @file Form rendering and reading from field definitions (src/config/fields.js).
 */
import { fieldDefs } from '../config/fields.js';
import { canSeeRestricted, fieldEditable } from '../core/permissions.js';
import { esc } from '../utils/format.js';
import { ctx, state } from './context.js';

/**
 * Renders one input for a field definition.
 * @param {object} f field definition
 * @param {any} value current value
 * @param {boolean} [disabled]
 */
export function inputHtml(f, value, disabled = false) {
  const id = `f_${f.k}`;
  const dis = disabled ? ' disabled' : '';
  const req = f.req ? ' required aria-required="true"' : '';
  if (f.t === 'select')
    return `<select class="f" id="${id}" name="${f.k}"${dis}${req}>${f.o.map(([v, l]) => `<option value="${esc(v)}"${String(value ?? '') === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  if (f.t === 'multi') {
    const set = new Set(value || []);
    return `<select class="f" multiple id="${id}" name="${f.k}"${dis}>${f.o.map(([v, l]) => `<option value="${esc(v)}"${set.has(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  }
  if (f.t === 'check') return `<label class="chk"><input type="checkbox" id="${id}" name="${f.k}"${value ? ' checked' : ''}${dis}> ${esc(f.l)}</label>`;
  if (f.t === 'textarea') return `<textarea class="f" id="${id}" name="${f.k}"${dis}>${esc(value)}</textarea>`;
  const type = { number: 'number', date: 'date', url: 'url', email: 'email' }[f.t] || 'text';
  const list = f.suggest?.length ? `<datalist id="${id}_list">${f.suggest.map((x) => `<option value="${esc(x)}"></option>`).join('')}</datalist>` : ''; // free text with suggestions
  return `<input class="f" type="${type}" id="${id}" name="${f.k}" value="${esc(value)}"${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}${list ? ` list="${id}_list"` : ''}${type === 'number' ? ' step="any"' : ''}${dis}${req}>${list}`;
}

/**
 * Renders a two-column form for a record type.
 * @param {string} type
 * @param {object|null} record existing values (null/undefined id = create)
 * @param {{only?: string[]}} [opts] limit to some fields
 */
export function formHtml(type, record, { only } = {}) {
  const user = ctx.user;
  const fields = fieldDefs(type, state()).filter((f) => !f.system && (!only || only.includes(f.k))); // system fields are never typed
  return `<div class="grid2">${fields
    .map((f) => {
      if (f.restricted && !canSeeRestricted(user.role)) return `<div><span class="l">${esc(f.l)}</span><div class="lock">Restricted for your role</div></div>`; // F-04
      const disabled = Boolean(record?.id) && !fieldEditable(user, type, f.k); // field-level edit rule
      const label = f.t === 'check' ? '' : `<label class="l" for="f_${f.k}">${esc(f.l)}${f.req ? ' *' : ''}</label>`;
      return `<div class="${f.full ? 'full' : ''}">${label}${inputHtml(f, record ? record[f.k] : '', disabled)}</div>`;
    })
    .join('')}</div>`;
}

/**
 * Reads form values back into a plain object, typed by field definition.
 * Disabled and hidden fields are skipped so they can never be written.
 */
export function readForm(type, root, { only } = {}) {
  const out = {};
  for (const f of fieldDefs(type, state())) {
    if (f.system || (only && !only.includes(f.k))) continue;
    const el = root.querySelector(`#f_${f.k}`);
    if (!el || el.disabled) continue; // restricted or read-only for this role
    if (f.t === 'multi') out[f.k] = [...el.selectedOptions].map((o) => o.value);
    else if (f.t === 'check') out[f.k] = el.checked;
    else if (f.t === 'number') out[f.k] = el.value === '' ? '' : Number(el.value);
    else out[f.k] = el.value.trim();
  }
  return out;
}

/** Displays a stored value for read-only property views. */
export function displayValue(f, value) {
  if (value === '' || value === null || value === undefined || (Array.isArray(value) && !value.length)) return '—';
  if (f.t === 'select') return esc(f.o.find(([v]) => String(v) === String(value))?.[1] ?? value);
  if (f.t === 'multi') return esc(value.map((v) => f.o.find(([o]) => o === v)?.[1] ?? v).join(', '));
  if (f.t === 'check') return value ? 'Yes' : 'No';
  if (f.t === 'url')
    return `<a href="${esc(value)}" target="_blank" rel="noopener">${esc(
      String(value)
        .replace(/^https?:\/\//, '')
        .slice(0, 48),
    )}</a>`;
  if (f.t === 'email') return `<a href="mailto:${esc(value)}">${esc(value)}</a>`;
  if (f.t === 'number' && /amount|value/i.test(f.k)) return `$${Number(value).toLocaleString('en-US')}`;
  if (f.t === 'datetime') return esc(new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }));
  if (f.t === 'date') return esc(new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  return esc(value);
}
