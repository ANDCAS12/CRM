/**
 * @file Contracts (F-01..F-04): list with 30/60/90-day alerts, restricted values, import, contract page.
 */
import { CONTRACT_STATUSES } from '../../config/constants.js';
import { canEdit, canSeeRestricted } from '../../core/permissions.js';
import { contractAlerts } from '../../core/reports.js';
import { canImport } from '../../core/importer.js';
import { firstName, userName, companyName } from '../../core/lookups.js';
import { addDays, dayDiff, today } from '../../utils/dates.js';
import { esc, fmtDate, kmoney, money } from '../../utils/format.js';
import { renderRecordPage, sideCard } from '../components/recordPage.js';
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
  const s = state();
  const company = s.companies.find((c) => c.id === k.companyId);
  const children = s.contracts.filter((x) => x.parentMsaId === id);
  const days = k.endDate ? dayDiff(today(ctx.now()), k.endDate) : null;
  const visible = 'totalValue' in k;
  const statuses = CONTRACT_STATUSES.filter((x) => x !== 'Expired');
  const cur = statuses.indexOf(k.status);
  const head = `<h1>${esc(k.name)}</h1><div class="subt">${esc(company?.name || '')}</div>
    <div class="badges"><span class="badge dark">${esc(k.type)}</span><span class="badge ${k.status === 'Signed' ? '' : 'dark'}">${esc(k.status)}</span></div>
    <div class="big">${visible ? kmoney(k.totalValue) : '<span class="lock" style="font-size:15px">Restricted</span>'}</div><div class="small muted">Total contract value (restricted field)</div>
    <div class="note">Rates and margins: Finance and Admin only</div>
    ${canEdit(ctx.user, 'contract', k) ? '<div class="row2"><button class="btn sm" id="eK">Edit</button></div>' : ''}`;
  const right = [
    children.length || k.type === 'MSA'
      ? sideCard(
          'Contracts under this MSA',
          children.length,
          children.length
            ? `<ul class="mini">${children.map((c) => `<li><span class="tx"><a class="lnk" href="#contract-${c.id}">${esc(c.name)}</a><span>${esc(c.status)}${c.endDate ? `, ends ${fmtDate(c.endDate)}` : ''}</span></span></li>`).join('')}</ul>`
            : '<div class="small muted">No SOWs under this MSA yet.</div>',
        )
      : '',
    k.parentMsaId ? sideCard('Parent MSA', 1, refLink('contract', k.parentMsaId)) : '',
    sideCard(
      'Linked deals',
      (k.dealIds || []).length,
      (k.dealIds || []).length
        ? `<ul class="mini">${k.dealIds
            .map((d) => {
              const deal = s.deals.find((x) => x.id === d) || {};
              return `<li><span class="tx">${refLink('deal', d)}<span>${kmoney(deal.amount)}, ${esc(deal.stage || '')}</span></span></li>`;
            })
            .join('')}</ul>`
        : '<div class="small muted">No deals linked.</div>',
    ),
    sideCard(
      'Placements',
      '',
      '<div class="small muted">Placements on this contract arrive with the Placements screen.</div>',
      '<span class="v2" style="margin-left:auto">V2</span>',
    ),
  ].join('');
  renderRecordPage(root, {
    type: 'contract',
    record: k,
    back: ['#contracts', 'Contracts'],
    head,
    about: [
      'effectiveDate',
      'endDate',
      'noticeDays',
      'autoRenew',
      'billingModel',
      'paymentTerms',
      'billingSchedule',
      { label: 'Next invoice date', html: '', tag: 'V2' },
      'ikSignatory',
      'clientSignatory',
      'renewalOwnerId',
      'fileUrl',
    ],
    center:
      days !== null && days >= 0
        ? `<div class="banner">Ends in ${days} days. Renewal alerts at 90, 60 and 30 days.${k.noticeDays ? ` Notice deadline ${fmtDate(addDays(k.endDate, -k.noticeDays))}.` : ''}</div>`
        : '',
    tabs: [
      ['overview', 'Overview'],
      ['invoices', 'Invoices'],
      ['placements', 'Placements'],
      ['files', 'Files'],
    ],
    tab: {
      overview:
        () => `<div class="card"><div class="cardh"><h2>Contract status</h2></div><div class="progress">${statuses.map((st, i) => `<div><div class="bar ${i < cur || k.status === 'Signed' ? 'done' : i === cur ? 'cur' : ''}"></div><div class="lab ${i === cur ? 'cur' : ''}">${esc(st)}</div></div>`).join('')}</div></div>
        <div class="card placeholder"><div class="cardh"><h2>Invoices</h2><span class="v2">V2</span></div><p style="margin:0" class="small muted">Invoice log, time-to-invoice reminders from billing terms or Buddy Punch hours, and overdue alerts (F-08 to F-10).</p></div>`,
      invoices: () =>
        '<div class="card placeholder"><div class="cardh"><h2>Invoices</h2><span class="v2">V2</span></div><p style="margin:0" class="small muted">Arrives in V2.</p></div>',
      placements: () =>
        '<div class="card placeholder"><div class="cardh"><h2>Placements on this contract</h2><span class="v2" style="margin-left:auto">V2</span></div><p style="margin:0" class="small muted">Who is placed under this contract, with dates and hours from Buddy Punch (G-01, G-04).</p></div>',
      files: () =>
        k.fileUrl
          ? `<div class="card"><a href="${esc(k.fileUrl)}" target="_blank" rel="noopener">Open the contract file in SharePoint</a></div>`
          : '<div class="empty">No file linked.</div>',
    },
    right,
    composerRef: { refType: 'contract', refId: id },
    noQuick: true, // contracts have no activity timeline in the MVP
    onBind: (r) => $('#eK', r)?.addEventListener('click', () => contractForm(ctx.api.get('contract', id))),
  });
}
