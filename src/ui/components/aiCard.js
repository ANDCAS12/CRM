/**
 * @file Always-on deal summary card (H-04) showing the sources used (I-01), laid out as in slide 9.
 */
import { SUMMARY_SECTIONS, latestSummary } from '../../ai/summary.js';
import { canEdit } from '../../core/permissions.js';
import { esc, fmtDate } from '../../utils/format.js';
import { aiBusy, refreshSummary } from '../actions.js';
import { ctx, state } from '../context.js';
import { $, modal } from '../dom.js';

/** Paints the summary card into #aiCard for a deal. */
export function renderAiCard(dealId) {
  const el = $('#aiCard');
  if (!el) return;
  const out = latestSummary(state(), dealId);
  const busy = aiBusy.has(dealId);
  const canRun = canEdit(ctx.user, 'aiOutput', null);
  const lastCall = out?.sources.find((x) => x.type === 'call');
  const updated = busy
    ? 'Updating…'
    : out
      ? `${out.model === 'local' ? 'Draft without Claude' : 'Updated'} ${lastCall ? 'after call' : 'on'} ${fmtDate(out.at).replace(/, \d{4}$/, '')}${out.stale ? ' · new activity since' : ''}`
      : '';
  const short = (src) => `${src.type === 'document' ? 'folder' : src.type} ${src.label.match(/\(([^)]+)\)$/)?.[1]?.replace(/, \d{4}$/, '') || ''}`.trim(); // "call Nov 11"
  const body =
    busy && !out
      ? '<p class="muted">Reading calls, notes and documents…</p>'
      : out
        ? `<div class="grid">${SUMMARY_SECTIONS.map(([k, l]) => `<div><h4>${l}</h4><p>${esc(out.sections[k] || 'Not covered in sources yet.')}</p></div>`).join('')}</div>
         <div class="srcs"><span>Sources: ${out.sources.length ? out.sources.map((x) => esc(short(x))).join(', ') : 'none'}</span><span class="sp"></span><a href="#" id="viewSrc">View sources</a></div>`
        : `<p class="muted">No summary yet.${canRun ? ' Generate one from this deal’s calls, notes and documents.' : ''}</p>`;
  el.innerHTML = `<div class="card ai"><div class="cardh"><h2>Deal summary</h2><span class="badge">auto</span><span class="small faint" style="margin-left:auto" aria-live="polite">${esc(updated)}</span>${canRun ? `<button class="linkbtn" id="aiGo" ${busy ? 'disabled' : ''}>${out ? 'Refresh' : 'Generate'}</button>` : ''}</div>${body}</div>`;
  $('#aiGo', el)?.addEventListener('click', () => refreshSummary(dealId));
  $('#viewSrc', el)?.addEventListener('click', (e) => {
    e.preventDefault();
    const srcs = out.sources.map((x) => `<li><span class="tx"><b>${esc(x.label)}</b><span>${esc(x.type)}</span></span></li>`).join('');
    modal(
      'Sources used',
      `<p class="small muted" style="margin-top:0">The summary was written only from these records (I-01).</p><ul class="mini">${srcs}</ul>`,
      { cancelLabel: 'Close' },
    );
  });
}
