/**
 * @file Companies index and company page (C-01..C-04), with HubSpot-style associations:
 * add existing contacts to a company and jump to the filtered contact list.
 */
import { canEdit } from '../../core/permissions.js';
import { isOpen } from '../../core/deals.js';
import { firstName, userName } from '../../core/lookups.js';
import { esc, fmtDate, kmoney } from '../../utils/format.js';
import { companyForm, contactForm, dealForm, refLink } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { filesCardHtml } from '../components/filesCard.js';
import { openImportDialog, viewImportedRecords } from '../components/importDialog.js';
import { renderListView } from '../components/listView.js';
import { renderRecord } from '../components/recordLayout.js';

export function renderCompanies(root) {
  const deals = ctx.api.all('deal');
  const openValue = new Map(); // company id -> open value, computed once for sorting and display
  for (const d of deals.filter(isOpen)) openValue.set(d.companyId, (openValue.get(d.companyId) || 0) + (+d.amount || 0));
  const canImport = ['admin', 'gtm'].includes(ctx.user.role);
  renderListView(root, {
    type: 'company',
    title: 'Companies',
    rows: ctx.api.all('company'),
    defaultSort: { field: 'name', dir: 1 },
    searchFields: ['name', 'domain', 'industry', 'hq'],
    accessors: { openValue: (c) => openValue.get(c.id) || 0, ownerName: (c) => userName(state(), c.ownerId) },
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
    headerActions: `${canImport ? '<button class="btn" id="impCo">Import</button>' : ''}${canEdit(ctx.user, 'company', null) ? '<button class="btn pri" id="newCo">Create company</button>' : ''}`,
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

export function renderCompanyRecord(root, id) {
  const company = ctx.api.get('company', id);
  if (!company) {
    root.innerHTML = '<div class="empty">Company not found. <a href="#companies">Back to companies</a></div>';
    return;
  }
  const s = state();
  const editable = canEdit(ctx.user, 'company', company);
  const deals = ctx.api.all('deal', { includeArchived: true }).filter((d) => d.companyId === id);
  const contacts = s.contacts.filter((p) => p.companyId === id);
  const contracts = ctx.api.all('contract').filter((k) => k.companyId === id);
  const calls = s.calls.filter((c) => c.matched && c.companyId === id);
  const portfolio = s.companies.filter((c) => c.peSponsorId === id); // C-04: sponsor shows its portfolio
  renderRecord(root, {
    type: 'company',
    record: company,
    crumb: '<a href="#companies">Companies</a>',
    title: company.name,
    subtitle: `<span class="badge">${esc(company.relationship)}</span> ${esc(company.domain)}${company.hq ? ` · ${esc(company.hq)}` : ''}`,
    actions: editable ? '<button class="btn" id="eC">Edit</button>' : undefined,
    keyProps: [
      ['Domain', esc(company.domain)],
      ['Owner', esc(userName(s, company.ownerId))],
      ['Industry', esc(company.industry)],
      ['Employees', company.employees ? Number(company.employees).toLocaleString() : ''],
      ['Revenue band', esc(company.revenueBand)],
      ['Ownership', esc(company.ownership)],
      ['PE sponsor', refLink('company', company.peSponsorId)],
      ['Parent', refLink('company', company.parentId)],
      ['Create date', fmtDate(company.createdAt)],
    ],
    leftCards: filesCardHtml(company),
    rightCards: `
      <div class="card"><div class="cardh"><h2>Contacts</h2><span class="faint small">${contacts.length}</span><div class="sp"></div>${canEdit(ctx.user, 'contact', null) ? '<button class="btn sm" id="assocP">Add</button>' : ''}</div>
        ${
          contacts.length
            ? `<ul class="mini">${contacts
                .slice(0, 8)
                .map((p) => `<li><span>${refLink('contact', p.id)}<div class="small muted">${esc(p.title)}</div></span></li>`)
                .join('')}</ul><a href="#contacts" class="small lnk" id="viewAssoc">View associated contacts</a>`
            : '<div class="small muted">No contacts yet.</div>'
        }</div>
      <div class="card"><div class="cardh"><h2>Deals</h2><span class="faint small">${deals.length}</span><div class="sp"></div>${canEdit(ctx.user, 'deal', null) ? '<button class="btn sm" id="addD">Add</button>' : ''}</div>${deals.length ? `<ul class="mini">${deals.map((d) => `<li><span style="flex:1">${refLink('deal', d.id)}<div class="small muted">${esc(d.stage)} · ${kmoney(d.amount)}</div></span></li>`).join('')}</ul>` : '<div class="small muted">No deals visible.</div>'}</div>
      <div class="card"><div class="cardh"><h2>Contracts</h2></div>${contracts.length ? `<ul class="mini">${contracts.map((k) => `<li><span style="flex:1">${refLink('contract', k.id)}<div class="small muted">${esc(k.type)} · ends ${fmtDate(k.endDate)}</div></span></li>`).join('')}</ul>` : '<div class="small muted">No contracts.</div>'}</div>
      <div class="card"><div class="cardh"><h2>Calls</h2><span class="faint small">${calls.length}</span></div>${
        calls.length
          ? `<ul class="mini">${calls
              .slice(0, 5)
              .map((c) => `<li><span>${esc(c.title)}<div class="small muted">${fmtDate(c.date)}</div></span></li>`)
              .join('')}</ul>`
          : '<div class="small muted">No calls yet.</div>'
      }</div>
      ${portfolio.length ? `<div class="card"><div class="cardh"><h2>Portfolio companies</h2></div><ul class="mini">${portfolio.map((p) => `<li>${refLink('company', p.id)}<span class="sp"></span><span class="badge">${esc(p.relationship)}</span></li>`).join('')}</ul></div>` : ''}`,
    composerRef: { refType: 'company', refId: id, companyId: id },
  });
  $('#eC', root)?.addEventListener('click', () => companyForm(ctx.api.get('company', id)));
  $('#addD', root)?.addEventListener('click', () => dealForm(null, null, { companyId: id }));
  $('#viewAssoc', root)?.addEventListener('click', (e) => {
    e.preventDefault();
    ctx.ui.lists.contact = {
      viewId: 'all',
      search: '',
      filters: [{ field: 'companyId', op: 'is', value: id }],
      sort: { field: 'name', dir: 1 },
      ids: null,
      idsLabel: '',
      limit: 200,
    }; // filtered contact list
    location.hash = 'contacts';
  });
  $('#assocP', root)?.addEventListener('click', () => associateContacts(company));
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
