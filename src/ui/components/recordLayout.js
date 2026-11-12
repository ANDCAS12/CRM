/**
 * @file Shared record page layout (B-05, C-02, D-01), modelled on the HubSpot record:
 * left = key properties, "View all properties" and quick actions; centre = About / Activities tabs;
 * right = associations.
 */
import { canEdit } from '../../core/permissions.js';
import { esc } from '../../utils/format.js';
import { ctx, rerender } from '../context.js';
import { $, $$ } from '../dom.js';
import { bindComposer, composerHtml, quickActionsHtml } from './composer.js';
import { openPropertiesPanel, propertiesHtml } from './propertiesPanel.js';
import { bindTaskChecks } from './tasks.js';
import { bindTimeline, timelineHtml } from './timeline.js';

/**
 * Renders a record page.
 * @param {HTMLElement} root
 * @param {{type:string, record:object, crumb:string, title:string, subtitle:string, actions?:string,
 *   keyProps:[string,string][], leftCards?:string, centerTop?:string, rightCards?:string,
 *   composerRef:{refType:string, refId:string, dealId?:string, companyId?:string, contactId?:string}}} cfg
 * @returns {{root:HTMLElement}}
 */
export function renderRecord(root, cfg) {
  const tab = ctx.ui.recordTab[cfg.type] || 'activities';
  const editable = canEdit(ctx.user, cfg.type, ctx.api.raw(cfg.type, cfg.record.id));
  root.innerHTML = `<div class="pagehead"><div><div class="small muted">${cfg.crumb}</div><h1>${esc(cfg.title)}</h1><div class="sub">${cfg.subtitle}</div></div><div class="sp"></div>${cfg.actions || (editable ? '' : '<span class="small faint">Read only for your role</span>')}</div>
  <div class="rec">
    <div class="left">
      <div class="card"><div class="cardh"><h2>Key properties</h2></div><dl class="kv">${cfg.keyProps.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v === '' || v === null || v === undefined ? '—' : v}</dd>`).join('')}</dl>
        <button class="btn sm" id="allProps" style="margin-top:12px;width:100%;justify-content:center">View all properties</button>
        ${quickActionsHtml()}
      </div>
      ${cfg.leftCards || ''}
    </div>
    <div class="center">
      ${cfg.centerTop || ''}
      <div class="rectabs" role="tablist"><button role="tab" data-rt="activities" class="${tab === 'activities' ? 'on' : ''}" aria-selected="${tab === 'activities'}">Activities</button><button role="tab" data-rt="about" class="${tab === 'about' ? 'on' : ''}" aria-selected="${tab === 'about'}">About</button></div>
      <div id="tabBody">${tab === 'about' ? `<div class="card">${propertiesHtml(cfg.type, cfg.record)}</div>` : `${composerHtml()}${timelineHtml({ type: cfg.type, id: cfg.record.id })}`}</div>
    </div>
    <div class="right">${cfg.rightCards || ''}</div>
  </div>`;

  $('#allProps', root).onclick = () => openPropertiesPanel(cfg.type, cfg.record.id);
  $$('[data-rt]', root).forEach(
    (b) =>
      (b.onclick = () => {
        ctx.ui.recordTab[cfg.type] = b.dataset.rt;
        rerender();
      }),
  );
  const openTab = tab === 'activities' ? bindComposer(root, cfg.composerRef) : null;
  $$('[data-quick]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (!openTab) {
          ctx.ui.recordTab[cfg.type] = 'activities'; // quick actions always land on the Activities tab
          rerender();
          document.querySelector(`[data-ct="${b.dataset.quick}"]`)?.click();
          document.getElementById('composer')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        openTab(b.dataset.quick);
      }),
  );
  bindTimeline(root);
  bindTaskChecks(root);
  return { root };
}
