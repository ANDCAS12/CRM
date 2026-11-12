/**
 * @file Contracts (F-01..F-04): list with 30/60/90-day alerts, restricted values, import, contract page.
 */
import { CONTRACT_STATUSES } from '../../config/constants.js';
import { canEdit, canSeeRestricted } from '../../core/permissions.js';
import { contractAlerts } from '../../core/reports.js';
import { canImport } from '../../core/importer.js';
import { firstName, userName, companyName } from '../../core/lookups.js';
import { addDays, dayDiff, today } from '../../utils/dates.js';
import { esc, fmtDate, money } from '../../utils/format.js';
import { contractForm, exportRows, refLink } from '../actions.js';
import { ctx, state } from '../context.js';
import { $ } from '../dom.js';
import { openImportDialog } from '../components/importDialog.js';

export function renderContracts(root) {
  const now = ctx.now();
  const all = ctx.api.all('contract');
  const list = all
    .filter((k) => !ctx.ui.contractStatus || k.status === ctx.ui.contractStatus)
    .sort((a, b) => (a.endDate || '9999').localeCompare(b.endDate || '9999')); // undated last
  const alerts = contractAlerts(all, now);
  const band = (n) => alerts.filter((a) => a.band === n);
  const see = canSeeRestricted(ctx.user.role);
  root.innerHTML = `<div class="pagehead"><div><h1>Contracts</h1><div class="sub">${list.length} contracts${see ? '' : ' · values are restricted for your role'}</div></div><div class="sp"></div>
    <select class="f" id="kS" style="width:auto" aria-label="Status filter"><option value="">All statuses</option>${CONTRACT_STATUSES.map((s) => `<option${ctx.ui.contractStatus === s ? ' selected' : ''}>${s}</option>`).join('')}</select>
    ${canImport(ctx.user, 'contracts') ? '<button class="btn" id="impK">Import contract matrix</button>' : ''}<button class="btn" id="expK">Export CSV</button>${canEdit(ctx.user, 'contract', null) ? '<button class="btn pri" id="newK">Create contract</button>' : ''}</div>
  <div class="stats" style="grid-template-columns:repeat(3,1fr)">${[30, 60, 90]
    .map(
      (n) =>
        `<div class="stat"><div class="k">${n === 30 ? 'Ending within 30 days' : n === 60 ? '31–60 days' : '61–90 days'}</div><div class="v ${n === 30 && band(30).length ? 'key' : ''}">${band(n).length}</div><div class="k">${
          band(n)
            .map((a) => esc(a.contract.name))
            .join(', ') || 'None'
        }</div></div>`,
    )
    .join('')}</div>
  <div class="tablewrap"><table class="t frozen"><thead><tr><th>Contract</th><th>Type</th><th>Company</th><th>Status</th><th>Effective</th><th>End</th><th>Notice</th><th>Auto-renew</th><th class="num">Total value</th><th>Billing</th><th>Renewal owner</th></tr></thead><tbody>
  ${list
    .map((k) => {
      const days = k.endDate ? dayDiff(today(now), k.endDate) : null;
      return `<tr><td style="min-width:200px"><a class="lnk" href="#contract-${k.id}">${esc(k.name)}</a>${k.parentMsaId ? `<div class="small faint">under ${esc(state().contracts.find((x) => x.id === k.parentMsaId)?.name || '')}</div>` : ''}</td><td><span class="badge">${esc(k.type)}</span></td><td>${refLink('company', k.companyId)}</td><td><span class="pill">${esc(k.status)}</span></td><td>${fmtDate(k.effectiveDate)}</td><td>${fmtDate(k.endDate)}${days !== null && days >= 0 && days <= 90 ? `<div class="small ${days <= 30 ? 'warn' : 'muted'}">in ${days} days</div>` : ''}</td><td>${k.noticeDays ? `${k.noticeDays}d` : '—'}</td><td>${k.autoRenew ? 'Yes' : 'No'}</td><td class="num">${'totalValue' in k ? money(k.totalValue) : '<span class="lock">Restricted</span>'}</td><td>${esc(k.billingModel)}</td><td>${esc(firstName(state(), k.renewalOwnerId))}</td></tr>`;
    })
    .join('')}</tbody></table>${list.length ? '' : '<div class="empty">No contracts with this status.</div>'}</div>`;

  $('#kS', root).onchange = (e) => ((ctx.ui.contractStatus = e.target.value), ctx.render());
  $('#newK', root)?.addEventListener('click', () => contractForm());
  $('#impK', root)?.addEventListener('click', () => openImportDialog('contracts'));
  $('#expK', root).onclick = () =>
    exportRows(
      'ik-contracts',
      list.map((k) => {
        const row = {
          Name: k.name,
          Type: k.type,
          Company: companyName(state(), k.companyId),
          Status: k.status,
          'Effective date': k.effectiveDate,
          'End date': k.endDate,
          'Notice (days)': k.noticeDays,
          'Auto-renew': k.autoRenew ? 'Yes' : 'No',
        };
        if ('totalValue' in k) row['Total value'] = k.totalValue; // restricted column only for permitted roles
        return {
          ...row,
          'Billing model': k.billingModel,
          'Payment terms': k.paymentTerms,
          'IK signatory': k.ikSignatory,
          'Client signatory': k.clientSignatory,
          'Renewal owner': userName(state(), k.renewalOwnerId),
          'File link': k.fileUrl,
        };
      }),
      'csv',
    );
}

export function renderContractRecord(root, id) {
  const k = ctx.api.get('contract', id);
  if (!k) {
    root.innerHTML = '<div class="empty">Contract not found. <a href="#contracts">Back to contracts</a></div>';
    return;
  }
  const children = state().contracts.filter((x) => x.parentMsaId === id);
  const days = k.endDate ? dayDiff(today(ctx.now()), k.endDate) : null;
  const kv = (rows) => `<dl class="kv">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${b === '' || b === undefined ? '—' : b}</dd>`).join('')}</dl>`;
  root.innerHTML = `<div class="pagehead"><div><div class="small muted"><a href="#contracts">Contracts</a></div><h1>${esc(k.name)}</h1><div class="sub"><span class="badge">${esc(k.type)}</span> ${refLink('company', k.companyId)} · <span class="pill">${esc(k.status)}</span>${days !== null && days >= 0 && days <= 90 ? ` · <span class="${days <= 30 ? 'warn' : ''}">ends in ${days} days</span>` : ''}</div></div><div class="sp"></div>${canEdit(ctx.user, 'contract', k) ? '<button class="btn" id="eK">Edit</button>' : ''}</div>
  <div class="rec" style="grid-template-columns:1fr 1fr">
    <div class="card"><div class="cardh"><h2>Terms</h2></div>${kv([
      ['Effective date', fmtDate(k.effectiveDate)],
      ['End date', fmtDate(k.endDate)],
      ['Notice period', k.noticeDays ? `${k.noticeDays} days` : ''],
      ['Notice deadline', k.endDate && k.noticeDays ? fmtDate(addDays(k.endDate, -k.noticeDays)) : ''],
      ['Auto-renew', k.autoRenew ? 'Yes' : 'No'],
      ['Total value', 'totalValue' in k ? money(k.totalValue) : '<span class="lock">Restricted for your role</span>'],
      ['Billing model', esc(k.billingModel)],
      ['Payment terms', esc(k.paymentTerms)],
    ])}</div>
    <div><div class="card"><div class="cardh"><h2>Parties and links</h2></div>${kv([
      ['IK signatory', esc(k.ikSignatory)],
      ['Client signatory', esc(k.clientSignatory)],
      ['Renewal owner', esc(userName(state(), k.renewalOwnerId))],
      ['Parent MSA', refLink('contract', k.parentMsaId)],
      ['Linked deals', (k.dealIds || []).map((d) => refLink('deal', d)).join(', ')],
      ['File', k.fileUrl ? `<a href="${esc(k.fileUrl)}" target="_blank" rel="noopener">Open in SharePoint</a>` : ''],
    ])}</div>
    ${children.length ? `<div class="card"><div class="cardh"><h2>Under this MSA</h2></div><ul class="mini">${children.map((c) => `<li>${refLink('contract', c.id)}<span class="sp"></span><span class="pill">${esc(c.status)}</span></li>`).join('')}</ul></div>` : ''}</div>
  </div>`;
  $('#eK', root)?.addEventListener('click', () => contractForm(ctx.api.get('contract', id)));
}
