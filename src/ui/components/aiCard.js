/**
 * @file Always-on deal summary card (H-04) showing the sources used (I-01).
 */
import { SUMMARY_SECTIONS, latestSummary } from '../../ai/summary.js';
import { canEdit } from '../../core/permissions.js';
import { ago, esc } from '../../utils/format.js';
import { aiBusy, refreshSummary } from '../actions.js';
import { ctx, state } from '../context.js';
import { $, $$ } from '../dom.js';

/** Paints the summary card into #aiCard for a deal. */
export function renderAiCard(dealId) {
  const el = $('#aiCard');
  if (!el) return;
  const out = latestSummary(state(), dealId);
  const busy = aiBusy.has(dealId);
  const canRun = canEdit(ctx.user, 'aiOutput', null);
  const meta = busy
    ? 'Updating…'
    : out
      ? `${out.model === 'local' ? 'Draft without Claude' : 'Claude'} · ${ago(out.at, ctx.now())}${out.stale ? ' · new activity since' : ''}`
      : '';
  const body =
    busy && !out
      ? '<p class="muted">Reading calls, notes and documents…</p>'
      : out
        ? `${SUMMARY_SECTIONS.map(([k, l]) => `<h4>${l}</h4><p>${esc(out.sections[k] || 'Not covered in sources yet.')}</p>`).join('')}<div class="srcs"><b>Sources used:</b> ${out.sources.length ? out.sources.map((s) => `<a href="#" data-src="${s.type}:${s.id}">${esc(s.label)}</a>`).join(' · ') : 'none'}</div>`
        : `<p class="muted">No summary yet.${canRun ? ' Generate one from this deal’s calls, notes and documents.' : ''}</p>`;
  el.innerHTML = `<div class="card ai"><div class="cardh"><h2>Deal summary</h2><span class="small faint" aria-live="polite">${meta}</span><div class="sp"></div>${canRun ? `<button class="btn sm" id="aiGo" ${busy ? 'disabled' : ''}>${out ? 'Refresh' : 'Generate'}</button>` : ''}</div>${body}</div>`;
  $('#aiGo', el)?.addEventListener('click', () => refreshSummary(dealId));
  for (const a of $$('[data-src]', el)) {
    a.onclick = (e) => {
      e.preventDefault();
      const [type] = a.dataset.src.split(':'); // source type selects the timeline filter
      if (type === 'document') {
        const url = state().deals.find((d) => d.id === dealId)?.folderUrl;
        if (url) window.open(url, '_blank', 'noopener');
        return;
      }
      ctx.ui.timelineFilter = type; // jump to the matching activity type
      ctx.ui.recordTab.deal = 'activities';
      ctx.render();
      document.querySelector(`.tl li[data-kind="${type}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }
}
