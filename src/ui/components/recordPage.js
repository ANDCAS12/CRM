/**
 * @file Shared record page (build brief slides 9 to 12): a left panel with the record's header, quick actions
 * and an "About" list editable in place; centre tabs (Overview, Activities, Calls, Files); related records on the right.
 */
import { fieldDefs } from '../../config/fields.js';
import { canEdit, canSeeRestricted, fieldEditable } from '../../core/permissions.js';
import { esc } from '../../utils/format.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$ } from '../dom.js';
import { displayValue } from '../forms.js';
import { bindComposer, composerHtml } from './composer.js';
import { openPropertiesPanel, startInlineEdit } from './propertiesPanel.js';
import { bindTaskChecks } from './tasks.js';
import { bindTimeline, timelineHtml, timelineItems } from './timeline.js';

/**
 * "About" list. Items are field keys (edited in place when allowed) or {label, html, tag} for derived values.
 * @param {string} type
 * @param {object} record scrubbed record
 * @param {(string|{label:string, html:string, tag?:string})[]} items
 */
export function aboutHtml(type, record, items) {
  const defs = fieldDefs(type, state());
  const editable = canEdit(ctx.user, type, ctx.api.raw(type, record.id));
  return items
    .map((it) => {
      if (typeof it !== 'string')
        return `<div class="pr"><div class="k">${esc(it.label)}${it.tag ? ` <span class="v2">${it.tag}</span>` : ''}</div><div class="vv">${it.html || '—'}</div></div>`;
      const f = defs.find((d) => d.k === it);
      if (!f) return '';
      const restricted = f.restricted && !canSeeRestricted(ctx.user.role);
      const can = editable && !f.system && !restricted && fieldEditable(ctx.user, type, f.k);
      return `<div class="pr"><div class="k">${esc(f.l)}</div><div class="vv ${can ? 'ed' : ''}" ${can ? `data-prop="${f.k}" role="button" tabindex="0" aria-label="Edit ${esc(f.l)}"` : ''}>${restricted ? '<span class="lock">Restricted</span>' : displayValue(f, record[f.k])}</div></div>`;
    })
    .join('');
}

/** A right-hand card: title, count and body. */
export const sideCard = (title, count, body, extra = '') =>
  `<div class="card"><div class="cardh"><h2>${esc(title)}</h2>${extra}${count !== undefined && count !== '' ? `<span class="count">${count}</span>` : ''}</div>${body}</div>`;

/** Compact recent-activity list for the Overview tab, with links that open the Activities tab filtered. */
export function recentActivityHtml(ref, limit = 5) {
  const items = timelineItems(ref).slice(0, limit);
  return `<div class="cardh" style="margin:18px 0 8px"><h2>Activity</h2><span class="count"><a href="#" data-goact="all">All</a> | <a href="#" data-goact="call">Calls</a> | <a href="#" data-goact="note">Notes</a> | <a href="#" data-goact="task">Tasks</a></span></div>${items.length ? `<ul class="tl">${items.map((i) => `<li data-kind="${i.kind}">${i.html}</li>`).join('')}</ul>` : '<div class="empty">No activity yet.</div>'}`;
}

/**
 * Renders a record page.
 * @param {HTMLElement} root
 * @param {{type:string, record:object, back:[string,string], head:string, about:any[], center?:string,
 *   tabs:[string,string][], tab:Record<string,()=>string>, right:string, composerRef:object, email?:string, noQuick?:boolean, onBind?:(root:HTMLElement)=>void}} cfg
 */
export function renderRecordPage(root, cfg) {
  const ui = ctx.ui;
  const tab = cfg.tabs.some(([k]) => k === ui.recordTab[cfg.type]) ? ui.recordTab[cfg.type] : cfg.tabs[0][0];
  const canLog = canEdit(ctx.user, 'note', null);
  const quick =
    canLog && !cfg.noQuick
      ? `<div class="quick">${[
          ['note', 'N', 'Note'],
          ['task', 'T', 'Task'],
          ['call', 'L', 'Log call'],
        ]
          .filter(([k]) => canEdit(ctx.user, k, null))
          .map(([k, l, label]) => `<button data-quick="${k}"><span class="av" aria-hidden="true">${l}</span>${label}</button>`)
          .join('')}${cfg.email ? `<button data-quick="email"><span class="av" aria-hidden="true">E</span>Email</button>` : ''}</div>`
      : '';
  const body = tab === 'activities' ? `${composerHtml()}${timelineHtml({ type: cfg.type, id: cfg.record.id })}` : (cfg.tab[tab] || (() => ''))();
  root.innerHTML = `<div class="rec3">
    <aside class="lp"><a class="back" href="${cfg.back[0]}">‹ ${esc(cfg.back[1])}</a>${cfg.head}${quick}
      <div class="about"><h2>About this ${esc(cfg.type === 'company' ? 'company' : cfg.type)}</h2>${aboutHtml(cfg.type, cfg.record, cfg.about)}
      <button class="linkbtn muted" id="allProps" style="padding:0">View all properties</button></div></aside>
    <section class="cp">${cfg.center || ''}
      <div class="rectabs" role="tablist">${cfg.tabs.map(([k, l]) => `<button role="tab" data-rt="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      <div id="tabBody">${body}</div></section>
    <aside class="rp">${cfg.right}</aside></div>`;

  $('#allProps', root).onclick = () => openPropertiesPanel(cfg.type, cfg.record.id);
  $$('[data-prop]', root).forEach((el) => {
    const open = () =>
      startInlineEdit(
        el,
        cfg.type,
        cfg.record.id,
        fieldDefs(cfg.type, state()).find((f) => f.k === el.dataset.prop),
        ctx.api.get(cfg.type, cfg.record.id),
        rerender,
      );
    el.onclick = open;
    el.onkeydown = (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open());
  });
  $$('[data-rt]', root).forEach((b) => (b.onclick = () => ((ui.recordTab[cfg.type] = b.dataset.rt), rerender())));
  $$('[data-goact]', root).forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        ui.recordTab[cfg.type] = 'activities';
        ui.timelineFilter = a.dataset.goact;
        rerender();
      }),
  );
  const openTab = tab === 'activities' ? bindComposer(root, cfg.composerRef) : null;
  $$('[data-quick]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.quick === 'email') return void (location.href = `mailto:${cfg.email}`);
        if (openTab) return openTab(b.dataset.quick);
        ui.recordTab[cfg.type] = 'activities'; // quick actions always land on the Activities tab
        rerender();
        document.querySelector(`[data-ct="${b.dataset.quick}"]`)?.click();
        document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }),
  );
  bindTimeline(root);
  bindTaskChecks(root);
  cfg.onBind?.(root);
}
