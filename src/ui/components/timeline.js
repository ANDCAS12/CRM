/**
 * @file Record timeline (B-05, E-01..E-04, H-03) with HubSpot-style activity type filters.
 * Property changes come from the audit log and are shown to admins only (§3).
 */
import { TIMELINE_FILTERS } from '../../config/constants.js';
import { fieldDefs } from '../../config/fields.js';
import { isAdmin } from '../../core/permissions.js';
import { userName } from '../../core/lookups.js';
import { esc, fmtDateTime, truncate } from '../../utils/format.js';
import { refLink } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $$, svg } from '../dom.js';
import { taskRow } from './tasks.js';

/** Renders a call or meeting entry with summary, action items and links (H-03). */
export function callHtml(c, showDeal = false) {
  const links = [
    (c.contactIds || []).map((id) => refLink('contact', id)).join(', '),
    showDeal && c.dealId ? refLink('deal', c.dealId) : '',
    c.recordingUrl ? `<a href="${esc(c.recordingUrl)}" target="_blank" rel="noopener">Recording</a>` : '',
    c.transcriptUrl ? `<a href="${esc(c.transcriptUrl)}" target="_blank" rel="noopener">Transcript</a>` : '',
  ].filter(Boolean);
  return `<div class="h">${svg('call')}<b>${esc(c.title)}</b><span class="pill">${{ fireflies: 'Fireflies', hubspot: 'From HubSpot' }[c.source] || 'Logged manually'}</span><span class="sp"></span>${fmtDateTime(c.date)} · ${c.durationMin || 0} min</div>
    ${c.summary ? `<p style="margin:4px 0">${esc(c.summary)}</p>` : ''}
    ${(c.actionItems || []).length ? `<div class="small"><b>Action items</b><ul style="margin:4px 0 0;padding-left:18px">${c.actionItems.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    ${links.length ? `<div class="small muted" style="margin-top:6px">${links.join(' · ')}</div>` : ''}`;
}

/** Field label lookup for property-change entries. */
function fieldLabel(type, key) {
  return fieldDefs(type, state()).find((f) => f.k === key)?.l || key;
}

/**
 * Collects timeline items for a record.
 * @param {{type:'deal'|'company'|'contact', id:string}} ref
 * @returns {{kind:string, at:string, html:string}[]} newest first
 */
export function timelineItems({ type, id }) {
  const s = state();
  const items = [];
  const dealCompany = (dealId) => s.deals.find((d) => d.id === dealId)?.companyId;
  for (const n of s.notes) {
    const onRecord = n.refType === type && n.refId === id;
    const rolledUp = type === 'company' && n.refType === 'deal' && dealCompany(n.refId) === id; // company timeline includes its deals' notes
    if (onRecord || rolledUp)
      items.push({
        kind: 'note',
        at: n.createdAt,
        html: `<div class="h">${svg('note')}<b>Note</b> by ${esc(userName(s, n.by))}<span class="sp"></span>${fmtDateTime(n.createdAt)}</div><div class="notebody">${n.body}</div>${rolledUp ? `<div class="small muted">on ${refLink('deal', n.refId)}</div>` : ''}`,
      }); // note bodies are sanitised on save
  }
  for (const c of s.calls) {
    if (!c.matched) continue; // unmatched calls live in the inbox (H-02)
    const hit = (type === 'deal' && c.dealId === id) || (type === 'company' && c.companyId === id) || (type === 'contact' && (c.contactIds || []).includes(id));
    if (hit) items.push({ kind: 'call', at: c.date, html: callHtml(c, type !== 'deal') });
  }
  for (const t of s.tasks)
    if (t.refType === type && t.refId === id)
      items.push({
        kind: 'task',
        at: t.createdAt,
        html: `<div class="h">${svg('task')}<b>Task</b> for ${esc(userName(s, t.assigneeId))}<span class="sp"></span>${fmtDateTime(t.createdAt)}</div>${taskRow(t)}`,
      });
  if (type === 'deal') {
    const deal = s.deals.find((d) => d.id === id);
    (deal?.stageHistory || []).forEach((h, i) =>
      items.push({
        kind: 'stage',
        at: h.at,
        html: `<div class="h">${svg('stage')}<b>${i === 0 ? 'Created in' : 'Stage changed to'} ${esc(h.stage)}</b> by ${esc(userName(s, h.by))}<span class="sp"></span>${fmtDateTime(h.at)}</div>`,
      }),
    );
  }
  if (isAdmin(ctx.user)) {
    for (const a of s.audit) {
      if (a.entity !== type || a.entityId !== id || a.action !== 'update' || a.field === 'stage') continue; // stage moves already shown
      items.push({
        kind: 'change',
        at: a.at,
        html: `<div class="h">${svg('change')}<b>${esc(fieldLabel(type, a.field))}</b> changed by ${esc(userName(s, a.userId))}<span class="sp"></span>${fmtDateTime(a.at)}</div><div class="small"><span class="muted">${esc(truncate(a.old || 'empty', 60))}</span> → ${esc(truncate(a.new || 'empty', 60))}</div>`,
      });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** Timeline with filter chips; `ref` identifies the record. */
export function timelineHtml(ref) {
  const all = timelineItems(ref);
  const filter = ctx.ui.timelineFilter;
  const counts = Object.fromEntries(TIMELINE_FILTERS.map(([k]) => [k, k === 'all' ? all.length : all.filter((i) => i.kind === k).length]));
  const chips = TIMELINE_FILTERS.filter(([k]) => k === 'all' || counts[k] || k === filter) // hide empty types
    .map(([k, l]) => `<button class="chipbtn ${filter === k ? 'on' : ''}" data-tlf="${k}" aria-pressed="${filter === k}">${l} ${counts[k]}</button>`)
    .join('');
  const shown = filter === 'all' ? all : all.filter((i) => i.kind === filter);
  return `<div class="chips" style="margin-bottom:10px" role="group" aria-label="Filter activity">${chips}</div>${shown.length ? `<ul class="tl">${shown.map((i) => `<li data-kind="${i.kind}">${i.html}</li>`).join('')}</ul>` : '<div class="empty">No activity of this type yet.</div>'}`;
}

/** Wires the filter chips. */
export function bindTimeline(root) {
  for (const b of $$('[data-tlf]', root)) {
    b.onclick = () => {
      ctx.ui.timelineFilter = b.dataset.tlf;
      rerender();
    };
  }
}
