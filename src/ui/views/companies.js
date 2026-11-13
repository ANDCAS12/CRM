/**
 * @file Companies index and company page (C-01..C-04), with HubSpot-style associations:
 * add existing contacts to a company and jump to the filtered contact list.
 */
import { RELATIONSHIP_TYPES } from '../../config/constants.js';
import { canEdit } from '../../core/permissions.js';
import { isOpen } from '../../core/deals.js';
import { firstName, userName } from '../../core/lookups.js';
import { ago, esc, fmtDate, kmoney } from '../../utils/format.js';
import { companyForm, contactForm, dealForm } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { filesCardHtml } from '../components/filesCard.js';
import { openImportDialog, viewImportedRecords } from '../components/importDialog.js';
import { renderListView } from '../components/listView.js';
import { renderRecordPage, sideCard, recentActivityHtml } from '../components/recordPage.js';
import { callHtml } from '../components/timeline.js';

export function renderCompanies(root) {
  const deals = ctx.api.all('deal');
  const openValue = new Map(); // company id -> open value, computed once for sorting and display
  for (const d of deals.filter(isOpen)) openValue.set(d.companyId, (openValue.get(d.companyId) || 0) + (+d.amount || 0));
  const canImport = ['admin', 'gtm'].includes(ctx.user.role);
  const lastActivityByCompany = new Map(); // newest activity per company, for the Last activity column and filter
  for (const a of state().activities) if (a.companyId && (lastActivityByCompany.get(a.companyId) || '') < a.at) lastActivityByCompany.set(a.companyId, a.at);
  renderListView(root, {
    type: 'company',
    title: 'Companies',
    rows: ctx.api.all('company'),
    defaultSort: { field: 'name', dir: 1 },
    searchFields: ['name', 'domain', 'industry', 'hq'],
    accessors: {
      openValue: (c) => openValue.get(c.id) || 0,
      ownerName: (c) => userName(state(), c.ownerId),
      lastActivity: (c) => lastActivityByCompany.get(c.id) || '',
    },
    columns: [
      { k: 'name', l: 'Company', render: (c) => `<a class="lnk" href="#company-${c.id}">${esc(c.name)}</a><div class="small faint">${esc(c.domain)}</div>` },
      { k: 'relationship', l: 'Relationship', edit: true },
      { k: 'industry', l: 'Industry', edit: true },
      {
        k: 'ownership',
        l: 'Ownership',
        render: (c) =>
          `${esc(c.ownership || '—')}${c.peSponsorId ? `<div class="small muted">${esc(state().companies.find((x) => x.id === c.peSponsorId)?.name || '')}</div>` : ''}`,
      },
      { k: 'hq', l: 'HQ', edit: true },
      { k: 'employees', l: 'Employees', edit: true, num: true },
      { k: 'openValue', l: 'Open pipeline', num: true, render: (c) => kmoney(openValue.get(c.id) || 0) },
      { k: 'ownerId', l: 'Owner', render: (c) => esc(firstName(state(), c.ownerId)) },
    ],
    headerActions: `<button class="btn" id="lvExp">Export</button>${canImport ? '<button class="btn" id="impCo">Import CSV</button>' : ''}${canEdit(ctx.user, 'company', null) ? '<button class="btn pri" id="newCo">Create company</button>' : ''}`,
    quickFilters: [
      { field: 'relationship', label: 'Relationship', options: RELATIONSHIP_TYPES.map((r) => [r, r]) },
      { field: 'industry', label: 'Industry', options: state().settings.industries.map((r) => [r, r]) },
      {
        field: 'ownerId',
        label: 'Owner',
        options: state()
          .users.filter((u) => u.status === 'active')
          .map((u) => [u.id, u.name]),
      },
      { field: 'icpTier', label: 'ICP tier', options: ['Tier 1', 'Tier 2', 'Tier 3'].map((r) => [r, r]) },
      {
        field: 'lastActivity',
        label: 'Last activity',
        op: 'lastDays',
        numeric: true,
        options: [
          ['7', 'Active: last 7 days'],
          ['30', 'Active: last 30 days'],
          ['90', 'Active: last 90 days'],
        ],
      },
    ],
    toExport: (rows) =>
      rows.map((c) => ({
        Name: c.name,
        Domain: c.domain,
        Relationship: c.relationship,
        Industry: c.industry,
        'Sub-industry': c.subIndustry,
        HQ: c.hq,
        Employees: c.employees,
        'Revenue band': c.revenueBand,
        Ownership: c.ownership,
        'PE sponsor': state().companies.find((x) => x.id === c.peSponsorId)?.name || '',
        Owner: userName(state(), c.ownerId),
        'ICP tier': c.icpTier,
      })),
    onBind: (r) => {
      $('#newCo', r)?.addEventListener('click', () => companyForm());
      $('#impCo', r)?.addEventListener('click', () => openImportDialog('contactsCompanies', viewImportedRecords));
    },
  });
}

/**
 * Relationship snapshot (Cristina, Nov 13): since when we work with the company, deals won and open, contracts.
 * Built from the deals and contracts the viewer can see.
 */
function snapshotHtml(deals, contracts) {
  const won = deals.filter((d) => d.stage === 'Closed won');
  const open = deals.filter(isOpen);
  const first = deals
    .map((d) => d.createdAt)
    .filter(Boolean)
    .sort()[0];
  const sum = (list) => list.reduce((a, d) => a + (+d.amount || 0), 0);
  const cell = (k, v, sub = '') =>
    `<div><span class="l">${k}</span><b style="font-size:18px">${v}</b>${sub ? `<div class="small muted">${sub}</div>` : ''}</div>`;
  return `<div class="card" style="margin-bottom:12px"><div class="cardh"><h2>Relationship snapshot</h2></div><div class="snap">
    ${cell('Working together since', first ? new Date(first).getFullYear() : '—')}${cell('Deals won', won.length, kmoney(sum(won)))}${cell('Open deals', open.length, kmoney(sum(open)))}${cell('Contracts', contracts.length, `${contracts.filter((k) => k.status === 'Signed').length} signed`)}</div></div>`;
}

export function renderCompanyRecord(root, id) {
  const company = ctx.api.get('company', id);
  if (!company) {
    root.innerHTML = '<div class="empty">Company not found. <a href="#companies">Back to companies</a></div>';
    return;
  }
  const s = state();
  const deals = ctx.api.all('deal', { includeArchived: true }).filter((d) => d.companyId === id);
  const contacts = s.contacts.filter((p) => p.companyId === id);
  const contracts = ctx.api.all('contract').filter((k) => k.companyId === id);
  const calls = s.calls.filter((c) => c.matched && c.companyId === id).sort((a, b) => b.date.localeCompare(a.date));
  const portfolio = s.companies.filter((c) => c.peSponsorId === id); // C-04: a sponsor lists its portfolio
  const dup = company.domain ? s.companies.find((c) => c.id !== id && c.domain === company.domain) : null; // C-03
  const lastAct = s.activities
    .filter((a) => a.companyId === id)
    .map((a) => a.at)
    .sort()
    .pop();
  const ref = { type: 'company', id };
  const head = `<h1>${esc(company.name)}</h1><div class="subt">${esc(company.domain || '')}</div>
    <div class="badges"><span class="badge ${['Client', 'Partner'].includes(company.relationship) ? '' : 'dark'}">${esc(company.relationship)}</span>${company.industry ? `<span class="badge dark">${esc(company.industry)}</span>` : ''}</div>`;
  const right = [
    sideCard(
      'Deals',
      deals.length,
      deals.length
        ? `<ul class="mini">${deals.map((d) => `<li><span class="tx"><a class="lnk" href="#deal-${d.id}">${esc(d.name)}</a><span>${kmoney(d.amount)}, ${esc(d.stage)}</span></span>${d.stage === 'Closed won' ? '<span class="badge">Won</span>' : ''}</li>`).join('')}</ul>`
        : '<div class="small muted">No deals visible.</div>',
      canEdit(ctx.user, 'deal', null) ? '<button class="btn sm" id="addD" style="margin-left:auto">Add</button>' : '',
    ),
    sideCard(
      'Contacts',
      contacts.length,
      contacts.length
        ? `<ul class="mini">${contacts
            .slice(0, 6)
            .map((p) => `<li><span class="tx"><a class="lnk" href="#contact-${p.id}">${esc(p.name)}</a><span>${esc(p.title || '')}</span></span></li>`)
            .join('')}</ul><a href="#contacts" class="small lnk" id="viewAssoc">View associated contacts</a>`
        : '<div class="small muted">No contacts yet.</div>',
      canEdit(ctx.user, 'contact', null) ? '<button class="btn sm" id="assocP" style="margin-left:auto">Add</button>' : '',
    ),
    sideCard(
      'Contracts',
      contracts.length,
      contracts.length
        ? `<ul class="mini">${contracts.map((k) => `<li><span class="tx"><a class="lnk" href="#contract-${k.id}">${esc(k.name)}</a><span>${k.endDate ? `Ends ${fmtDate(k.endDate)}` : esc(k.type)}</span></span><span class="badge ${k.status === 'Signed' ? '' : 'dark'}">${esc(k.status)}</span></li>`).join('')}</ul>`
        : '<div class="small muted">No contracts.</div>',
    ),
    sideCard(
      'Calls',
      calls.length,
      calls.length
        ? `<b>Last call ${fmtDate(calls[0].date).replace(/, \d{4}$/, '')}</b><div class="small muted">${esc(calls[0].title)}</div>`
        : '<div class="small muted">No calls yet.</div>',
    ),
    sideCard(
      'Files in SharePoint',
      '',
      company.folderUrl
        ? `<b>${esc(company.name)} folder</b><div class="small"><a href="${esc(company.folderUrl)}" target="_blank" rel="noopener">Opens in SharePoint</a></div>`
        : '<div class="small muted">No folder linked.</div>',
    ),
    portfolio.length
      ? sideCard(
          'Portfolio companies',
          portfolio.length,
          `<ul class="mini">${portfolio.map((p) => `<li><span class="tx"><a class="lnk" href="#company-${p.id}">${esc(p.name)}</a></span><span class="badge ${p.relationship === 'Client' ? '' : 'dark'}">${esc(p.relationship)}</span></li>`).join('')}</ul>`,
        )
      : '',
  ].join('');
  renderRecordPage(root, {
    type: 'company',
    record: company,
    back: ['#companies', 'Companies'],
    head,
    about: [
      'ownerId',
      'industry',
      'subIndustry',
      'hq',
      'employees',
      'revenueBand',
      'ownership',
      'peSponsorId',
      { label: 'Parent company', html: company.parentId ? esc(s.companies.find((c) => c.id === company.parentId)?.name || '') : '', tag: 'V2' },
      { label: 'ICP tier and score', html: esc(company.icpTier || ''), tag: 'V2' },
      'folderUrl',
      { label: 'Last activity', html: lastAct ? `${ago(lastAct, ctx.now())} (auto)` : '' },
    ],
    center: dup
      ? `<div class="banner" role="alert">Possible duplicate: “${esc(dup.name)}” has the same domain<button id="dupReview">Review</button></div>`
      : '',
    tabs: [
      ['overview', 'Overview'],
      ['activities', 'Activities'],
      ['calls', 'Calls'],
      ['files', 'Files'],
    ],
    tab: {
      overview: () =>
        `${snapshotHtml(deals, contracts)}<div class="card placeholder"><div class="cardh"><h2>Account research from MGI</h2><span class="v2" style="margin-left:auto">V2</span></div><p style="margin:0" class="small muted">Priorities, market fit, recent news and SEC filings, synced from MGI (C-06).</p></div>${recentActivityHtml(ref)}`,
      calls: () =>
        calls.length
          ? `<ul class="tl">${calls.map((c) => `<li data-kind="call">${callHtml(c, true)}</li>`).join('')}</ul>`
          : '<div class="empty">No calls yet.</div>',
      files: () => filesCardHtml(company),
    },
    right,
    composerRef: { refType: 'company', refId: id, companyId: id },
    onBind: (r) => {
      $('#dupReview', r)?.addEventListener('click', () => (location.hash = `company-${dup.id}`));
      $('#addD', r)?.addEventListener('click', () => dealForm(null, null, { companyId: id }));
      $('#assocP', r)?.addEventListener('click', () => associateContacts(company));
      $('#viewAssoc', r)?.addEventListener('click', (e) => {
        e.preventDefault();
        ctx.ui.lists.contact = {
          viewId: 'all',
          search: '',
          filters: [{ field: 'companyId', op: 'is', value: id }],
          sort: { field: 'name', dir: 1 },
          ids: null,
          idsLabel: '',
          page: 0,
        }; // filtered contact list
        location.hash = 'contacts';
      });
    },
  });
}

/** Associates existing contacts with a company, or creates a new one (HubSpot "Add" on associations). */
function associateContacts(company) {
  const candidates = state()
    .contacts.filter((p) => p.companyId !== company.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const m = modal(
    `Add contacts to ${company.name}`,
    `<input class="f" id="acQ" placeholder="Search contacts" aria-label="Search contacts" autocomplete="off"><div id="acList" style="max-height:320px;overflow:auto;margin-top:10px"></div><div style="margin-top:10px"><button class="btn sm" id="acNew">Create a new contact instead</button></div>`,
    {
      saveLabel: 'Save',
      onSave: (body) => {
        const ids = $$('[data-ac]:checked', body).map((b) => b.dataset.ac);
        if (!ids.length) throw new Error('Tick at least one contact.');
        for (const cid of ids) ctx.api.update('contact', cid, { companyId: company.id }, { persist: false });
        ctx.store.save();
        toast(`${ids.length} contact${ids.length > 1 ? 's' : ''} added to ${company.name}`);
        rerender();
      },
    },
  );
  const draw = () => {
    const q = $('#acQ', m.body).value.toLowerCase();
    const list = candidates.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(q)).slice(0, 100);
    $('#acList', m.body).innerHTML = list.length
      ? list
          .map(
            (p) =>
              `<label class="chk" style="padding:6px 0;border-top:1px solid var(--line)"><input type="checkbox" data-ac="${p.id}"> <span>${esc(p.name)} <span class="small muted">${esc(p.email || '')}${p.companyId ? ` · now at ${esc(state().companies.find((c) => c.id === p.companyId)?.name || '')}` : ''}</span></span></label>`,
          )
          .join('')
      : '<div class="small muted">No matching contacts.</div>';
  };
  $('#acQ', m.body).addEventListener('input', draw);
  $('#acNew', m.body).onclick = () => contactForm(null, { companyId: company.id });
  draw();
}
