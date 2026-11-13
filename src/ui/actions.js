/**
 * @file User actions shared across views: forms, stage moves, inline saves, exports, AI refresh.
 * Business rules come from src/core; this file only wires them to dialogs and toasts.
 */
import { CLOSED_STAGES, DEFAULT_STAGE, STAGE_DESCRIPTIONS, STAGE_PROBABILITY } from '../config/constants.js';
import { canEdit } from '../core/permissions.js';
import { isOpen, validateDeal } from '../core/deals.js';
import { recordName } from '../core/lookups.js';
import { ValidationError } from '../core/errors.js';
import { generateSummary, latestSummary } from '../ai/summary.js';
import { saveFile } from '../platform/capabilities.js';
import { toCSV } from '../utils/csv.js';
import { addDays, today } from '../utils/dates.js';
import { esc, normalizeDomain, domainOf } from '../utils/format.js';
import { clone } from '../utils/object.js';
import { ctx, rerender, state } from './context.js';
import { $, modal, toast } from './dom.js';
import { formHtml, inputHtml, readForm } from './forms.js';

/** Link to a record page, or an em dash when empty. */
export function refLink(type, id) {
  if (!id) return '—';
  const name = recordName(state(), type, id);
  return name ? `<a class="lnk" href="#${type}-${id}">${esc(name)}</a>` : '—';
}

/* ---------------- deals ---------------- */

/** Dialog that closes a deal; requires a reason in the team's own words and, when lost, a competitor (B-07). */
export function closeDealModal(deal, stage) {
  const won = stage === 'Closed won';
  modal(
    won ? 'Close as won' : 'Close as lost',
    `<p class="muted" style="margin-top:0">${esc(deal.name)}: a reason is required${won ? '' : ' and the competitor involved'}.</p>
    <div class="grid2"><div class="full"><label class="l" for="f_winLossReason">${won ? 'Why we won' : 'Why we lost'} *</label><textarea class="f" id="f_winLossReason" style="min-height:70px" placeholder="${won ? 'e.g. Existing relationship and faster start' : 'e.g. Our proposal was the most expensive'}">${esc(deal.winLossReason || '')}</textarea></div>
    <div class="full"><label class="l" for="f_competitors">Competitor involved${won ? '' : ' *'}</label>${inputHtml({ k: 'competitors', t: 'text', ph: 'None' }, deal.competitors)}</div></div>`,
    {
      saveLabel: won ? 'Close as won' : 'Close as lost',
      onSave: (body) => {
        const winLossReason = $('#f_winLossReason', body).value.trim(); // free text, not a picklist (Nov 13)
        const competitors = $('#f_competitors', body).value.trim();
        validateDeal({ ...deal, stage, winLossReason, competitors }); // same rule as the API-level validator
        ctx.api.update('deal', deal.id, { stage, winLossReason, competitors });
        toast(won ? 'Closed as won' : 'Closed as lost');
        rerender();
      },
    },
  );
}

/** Moves a deal to a stage, enforcing B-07 and B-09 before writing. */
export function moveStage(deal, stage) {
  if (stage === deal.stage) return;
  if (!canEdit(ctx.user, 'deal', deal)) {
    toast('Your role can’t edit this deal.');
    rerender();
    return;
  }
  if (CLOSED_STAGES.includes(stage)) return closeDealModal(deal, stage); // closing needs a reason first
  if (!deal.nextStep || !deal.nextStepDate) {
    toast('Add a next step with a date before moving this deal.'); // B-09
    rerender();
    return;
  }
  ctx.api.update('deal', deal.id, { stage });
  // Cristina, Nov 13: partner deals move to Prospect once we meet the client; they never go to Suspect.
  toast(
    deal.stage === 'Partners' && stage === 'Suspect'
      ? 'Moved to Suspect. Note: partner deals usually move to Prospect once you meet the client.'
      : `Moved to ${stage}`,
  );
  rerender();
}

/** Create, edit or clone a deal (B-02). */
export function dealForm(existing = null, cloneFrom = null, preset = {}) {
  const ui = ctx.ui;
  const defaults = {
    ownerId: ctx.user.id,
    pipeline: ui.pipeline !== 'All' ? ui.pipeline : 'Consulting projects',
    stage: DEFAULT_STAGE, // new deals start in Suspect
    probability: STAGE_PROBABILITY[DEFAULT_STAGE],
    source: 'Inbound',
    collaborators: [],
    ...preset,
  };
  const record = existing || (cloneFrom ? { ...clone(cloneFrom), id: undefined, name: `${cloneFrom.name} (copy)` } : defaults);
  const m = modal(existing ? 'Edit deal' : cloneFrom ? 'Clone deal' : 'New deal', formHtml('deal', record), {
    saveLabel: existing ? 'Save changes' : 'Create deal',
    onSave: (body) => {
      const data = readForm('deal', body);
      if (data.probability === '') data.probability = STAGE_PROBABILITY[data.stage]; // blank = stage default
      validateDeal({ ...(existing || {}), ...data });
      if (existing) {
        ctx.api.update('deal', existing.id, data);
        toast('Deal saved');
        rerender();
      } else {
        const created = ctx.api.create('deal', data);
        toast(cloneFrom ? 'Deal cloned' : 'Deal created');
        location.hash = `deal-${created.id}`;
      }
    },
  });
  const stage = $('#f_stage', m.body);
  const prob = $('#f_probability', m.body);
  // Show what the chosen stage means (Cristina's definitions), under the stage picker.
  stage?.insertAdjacentHTML('afterend', `<div class="small muted" id="stageHelp" style="margin-top:4px">${esc(STAGE_DESCRIPTIONS[stage.value] || '')}</div>`);
  stage?.addEventListener('change', () => ($('#stageHelp', m.body).textContent = STAGE_DESCRIPTIONS[stage.value] || ''));
  if (stage && prob) stage.addEventListener('change', () => (prob.value = STAGE_PROBABILITY[stage.value])); // keep probability in sync with stage
}

/* ---------------- companies and contacts ---------------- */

/** Finds another company using the same domain (C-03). */
export const duplicateDomain = (domain, exceptId) => (domain ? state().companies.find((c) => c.domain === domain && c.id !== exceptId) : null);

/** Create or edit a company with a live duplicate-domain warning (C-01, C-03). */
export function companyForm(existing = null) {
  let acknowledged = false;
  const m = modal(
    existing ? 'Edit company' : 'New company',
    `${formHtml('company', existing || { ownerId: ctx.user.id, relationship: 'Prospect' })}<div id="dupWarn" class="small" style="margin-top:10px" aria-live="polite"></div>`,
    {
      saveLabel: existing ? 'Save changes' : 'Create company',
      onSave: (body) => {
        const data = readForm('company', body);
        if (!data.name) throw new ValidationError('Name the company.');
        data.domain = normalizeDomain(data.domain);
        const dup = duplicateDomain(data.domain, existing?.id);
        if (dup && !acknowledged) {
          acknowledged = true; // second click confirms the duplicate on purpose
          throw new ValidationError(`${dup.name} already uses ${data.domain}. Save again to create it anyway.`);
        }
        if (existing) {
          ctx.api.update('company', existing.id, data);
          toast('Company saved');
          rerender();
        } else {
          const created = ctx.api.create('company', data);
          toast('Company created');
          location.hash = `company-${created.id}`;
        }
      },
    },
  );
  const input = $('#f_domain', m.body);
  input?.addEventListener('input', () => {
    const dup = duplicateDomain(normalizeDomain(input.value), existing?.id);
    $('#dupWarn', m.body).innerHTML = dup
      ? `<span class="warn">Possible duplicate:</span> <a href="#company-${dup.id}">${esc(dup.name)}</a> already uses ${esc(dup.domain)}.`
      : '';
  });
}

/** Initials for avatar circles, e.g. "Cristina Frieri" -> "CV". */
export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** Create a task from anywhere (E-02), optionally linked to a deal. */
export function taskForm(preset = {}) {
  const due = addDays(today(ctx.now()), 1);
  const deals = [['', ''], ...ctx.api.all('deal').map((d) => [d.id, d.name])];
  modal(
    'Create task',
    `${formHtml('task', { assigneeId: ctx.user.id, dueDate: due, reminderDate: due, emailReminder: true })}<div style="margin-top:12px"><label class="l" for="f_tdeal">Linked deal</label>${inputHtml({ k: 'tdeal', t: 'select', o: deals }, preset.dealId || '')}</div>`,
    {
      saveLabel: 'Create task',
      onSave: (body) => {
        const task = readForm('task', body);
        if (!task.title) throw new ValidationError('Name the task.');
        const dealId = $('#f_tdeal', body).value;
        ctx.api.create('task', { ...task, done: false, refType: dealId ? 'deal' : '', refId: dealId });
        toast('Task created');
        rerender();
      },
    },
  );
}

/** Valid email check used by forms and inline edits. */
export const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/** Create or edit a contact (D-01). New contacts are linked to a company by email domain. */
export function contactForm(existing = null, preset = {}) {
  modal(existing ? 'Edit contact' : 'New contact', formHtml('contact', existing || { ownerId: ctx.user.id, source: 'Inbound', ...preset }), {
    saveLabel: existing ? 'Save changes' : 'Create contact',
    onSave: (body) => {
      const data = readForm('contact', body);
      if (!data.name) throw new ValidationError('Add a name.');
      if (data.email && !isEmail(data.email)) throw new ValidationError('That email doesn’t look right.');
      if (data.email && state().contacts.some((p) => p.email?.toLowerCase() === data.email.toLowerCase() && p.id !== existing?.id))
        throw new ValidationError('Another contact already uses this email.');
      if (!data.companyId && data.email) data.companyId = state().companies.find((c) => c.domain && c.domain === domainOf(data.email))?.id || ''; // auto-associate by domain
      if (existing) {
        ctx.api.update('contact', existing.id, data);
        toast('Contact saved');
        rerender();
      } else {
        const created = ctx.api.create('contact', data);
        toast(data.companyId ? `Contact created and linked to ${recordName(state(), 'company', data.companyId)}` : 'Contact created');
        location.hash = `contact-${created.id}`;
      }
    },
  });
}

/** Create or edit a contract (F-01). Delivery sees its limited fields enabled only. */
export function contractForm(existing = null) {
  const note = ctx.user.role === 'delivery' ? '<p class="small muted">Your role can change dates, notice period, auto-renew and status.</p>' : '';
  modal(
    existing ? 'Edit contract' : 'New contract',
    formHtml('contract', existing || { status: 'Drafting', type: 'SOW', noticeDays: 30, ikSignatory: ctx.user.name, renewalOwnerId: ctx.user.id }) + note,
    {
      saveLabel: existing ? 'Save changes' : 'Create contract',
      onSave: (body) => {
        const data = readForm('contract', body);
        if (!existing && (!data.name || !data.companyId)) throw new ValidationError('A contract needs a name and a company.');
        if (data.effectiveDate && data.endDate && data.endDate < data.effectiveDate) throw new ValidationError('End date is before the effective date.');
        if (existing) {
          ctx.api.update('contract', existing.id, data);
          toast('Contract saved');
          rerender();
        } else {
          const created = ctx.api.create('contract', data);
          toast('Contract created');
          location.hash = `contract-${created.id}`;
        }
      },
    },
  );
}

/**
 * Saves one property from the properties panel or a list cell, applying the same rules as forms.
 * @returns {boolean} true when saved
 */
export function saveField(type, id, key, value) {
  const record = ctx.api.raw(type, id);
  try {
    if (type === 'deal' && key === 'stage') {
      moveStage(record, value); // stage changes go through B-07/B-09 checks
      return true;
    }
    if (type === 'deal' && ['nextStep', 'nextStepDate'].includes(key) && !value && isOpen(record))
      throw new ValidationError('Open deals need a next step and a date.');
    if (key === 'name' && !String(value).trim()) throw new ValidationError('Name can’t be empty.');
    if (key === 'email' && value && !isEmail(value)) throw new ValidationError('That email doesn’t look right.');
    if (type === 'company' && key === 'domain') {
      value = normalizeDomain(value);
      const dup = duplicateDomain(value, id);
      if (dup) toast(`Heads up: ${dup.name} also uses ${value}.`); // warn, don't block (C-03)
    }
    ctx.api.update(type, id, { [key]: value });
    return true;
  } catch (e) {
    toast(e.message);
    return false;
  }
}

/* ---------------- exports (L-04) ---------------- */

/** Exports rows as CSV or Excel through the runtime download capability. */
export async function exportRows(baseName, rows, format = 'csv') {
  if (!rows.length) {
    toast('Nothing to export');
    return;
  }
  const filename = `${baseName}-${today(ctx.now())}.${format}`;
  let data;
  if (format === 'csv') data = toCSV(rows);
  else {
    if (!window.XLSX) return toast('Excel export didn’t load. Use CSV.');
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rows), 'Export');
    data = new Blob([window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]);
  }
  await saveFile(ctx.caps.downloads, filename, data, toast);
}

/* ---------------- AI summary (H-04) ---------------- */

/** Deals with a summary request in flight (prevents duplicate Claude calls). */
export const aiBusy = new Set();

/** Regenerates a deal summary; called on demand and after each new call or note. */
export async function refreshSummary(dealId, { auto = false } = {}) {
  if (!dealId || aiBusy.has(dealId)) return;
  const prior = latestSummary(state(), dealId);
  if (prior) prior.stale = true; // show "new activity since" while regenerating
  aiBusy.add(dealId);
  ctx.onAiChange?.(dealId);
  const sample = await ctx.caps.sample;
  try {
    await generateSummary({
      api: ctx.api,
      state: state(),
      dealId,
      sample,
      now: ctx.now(),
      onError: (e) => {
        if (e?.code === 'not_granted') toast('Claude access was declined, so a local draft was used.');
        else if (e?.code === 'rate_limited') toast('Claude is busy. Try refreshing in a minute.');
        else if (!auto) toast('Claude couldn’t write the summary, so a local draft was used.');
      },
    });
  } finally {
    aiBusy.delete(dealId);
    ctx.onAiChange?.(dealId); // repaint the summary card if it is on screen
  }
}
