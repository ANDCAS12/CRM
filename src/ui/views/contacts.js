/**
 * @file Contacts index and contact page (D-01..D-03): list views with filters, inline edits,
 * import, and a record page with relationship strength and buying roles.
 */
import { SENIORITY, SOURCES } from '../../config/constants.js';
import { canEdit } from '../../core/permissions.js';
import { relationship } from '../../core/contacts.js';
import { companyName, firstName, userName } from '../../core/lookups.js';
import { ago, esc, fmtDate, kmoney } from '../../utils/format.js';
import { contactForm, refLink } from '../actions.js';
import { ctx, state } from '../context.js';
import { $ } from '../dom.js';
import { openImportDialog, viewImportedRecords } from '../components/importDialog.js';
import { renderListView } from '../components/listView.js';
import { recentActivityHtml, renderRecordPage, sideCard } from '../components/recordPage.js';
import { callHtml } from '../components/timeline.js';

export function renderContacts(root) {
  const s = state();
  const canImport = ['admin', 'gtm'].includes(ctx.user.role);
  renderListView(root, {
    type: 'contact',
    title: 'Contacts',
    rows: ctx.api.all('contact'),
    defaultSort: { field: 'name', dir: 1 },
    searchFields: ['name', 'email', 'title', 'companyName'],
    accessors: { companyName: (p) => companyName(s, p.companyId), ownerName: (p) => userName(s, p.ownerId) },
    columns: [
      {
        k: 'name',
        l: 'Name',
        render: (p) => `<a class="lnk" href="#contact-${p.id}">${esc(p.name)}</a>${p.doNotContact ? ' <span class="pill">Do not contact</span>' : ''}`,
      },
      { k: 'email', l: 'Email', render: (p) => (p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '—') },
      { k: 'title', l: 'Job title', edit: true },
      { k: 'phone', l: 'Phone number', edit: true },
      { k: 'companyName', l: 'Company', render: (p) => refLink('company', p.companyId) },
      { k: 'location', l: 'Location', edit: true },
      { k: 'ownerName', l: 'Owner', render: (p) => esc(firstName(s, p.ownerId)) },
      { k: 'createdAt', l: 'Create date', render: (p) => `<span class="small muted">${ago(p.createdAt, ctx.now())}</span>` },
    ],
    headerActions: `<button class="btn" id="lvExp">Export</button>${canImport ? '<button class="btn" id="impP">Import CSV</button>' : ''}${canEdit(ctx.user, 'contact', null) ? '<button class="btn pri" id="newP">Create contact</button>' : ''}`,
    quickFilters: [
      { field: 'companyId', label: 'Company', options: [...s.companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.name]) },
      { field: 'seniority', label: 'Seniority', options: SENIORITY.map((r) => [r, r]) },
      { field: 'ownerId', label: 'Owner', options: s.users.filter((u) => u.status === 'active').map((u) => [u.id, u.name]) },
      { field: 'source', label: 'Source', options: SOURCES.map((r) => [r, r]) },
    ],
    toExport: (rows) =>
      rows.map((p) => ({
        Name: p.name,
        Title: p.title,
        Company: companyName(s, p.companyId),
        Email: p.email,
        Phone: p.phone,
        LinkedIn: p.linkedin,
        Location: p.location,
        'Time zone': p.timezone,
        Owner: userName(s, p.ownerId),
        Source: p.source,
        'Do not contact': p.doNotContact ? 'Yes' : 'No',
      })),
    onBind: (r) => {
      $('#newP', r)?.addEventListener('click', () => contactForm());
      $('#impP', r)?.addEventListener('click', () => openImportDialog('contactsCompanies', viewImportedRecords));
    },
  });
}

export function renderContactRecord(root, id) {
  const p = ctx.api.get('contact', id);
  if (!p) {
    root.innerHTML = '<div class="empty">Contact not found. <a href="#contacts">Back to contacts</a></div>';
    return;
  }
  const s = state();
  const company = s.companies.find((c) => c.id === p.companyId);
  const roles = s.dealContacts.filter((x) => x.contactId === id);
  const rel = relationship(s, id, ctx.now());
  const calls = s.calls.filter((c) => c.matched && (c.contactIds || []).includes(id)).sort((a, b) => b.date.localeCompare(a.date));
  const ref = { type: 'contact', id };
  const strength = { Strong: 5, Warm: 3, Cold: 1 }[rel.strength];
  const head = `<h1>${esc(p.name)}</h1><div class="subt">${esc([p.title, company?.name].filter(Boolean).join(', '))}</div>
    <div class="badges">${company ? `<span class="badge ${company.relationship === 'Client' ? '' : 'dark'}">${esc(company.relationship)} contact</span>` : ''}${p.doNotContact ? '<span class="badge alert">Do not contact</span>' : ''}</div>`;
  const right = [
    sideCard(
      'Deals and buying role',
      roles.length,
      roles.length
        ? `<ul class="mini">${roles
            .map((r) => {
              const d = s.deals.find((x) => x.id === r.dealId) || {};
              return `<li><span class="tx"><a class="lnk" href="#deal-${d.id}">${esc(d.name || '')}</a><span>${kmoney(d.amount)}, ${esc(d.stage || '')}</span></span><span class="badge">${esc(r.role)}</span></li>`;
            })
            .join('')}</ul>`
        : '<div class="small muted">Not tagged on any deal. Tag contacts from a deal page.</div>',
    ),
    sideCard(
      'Company',
      company ? 1 : 0,
      company
        ? `<a class="lnk" href="#company-${company.id}">${esc(company.name)}</a><div class="small muted">${esc([company.relationship, company.industry].filter(Boolean).join(', '))}</div>`
        : '<div class="small muted">Not linked to a company yet.</div>',
    ),
    sideCard(
      'Calls',
      calls.length,
      calls.length
        ? `<b>Last call ${fmtDate(calls[0].date).replace(/, \d{4}$/, '')}</b><div class="small muted">${esc(calls[0].title)}</div>`
        : '<div class="small muted">No calls yet.</div>',
    ),
  ].join('');
  renderRecordPage(root, {
    type: 'contact',
    record: p,
    back: ['#contacts', 'Contacts'],
    head,
    email: p.email,
    about: [
      'email',
      'phone',
      'linkedin',
      { label: 'Location and time zone', html: esc([p.location, p.timezone && `(${p.timezone})`].filter(Boolean).join(' ')) },
      'seniority',
      'function',
      'ownerId',
      'source',
      { label: 'Previous companies', html: esc(p.previousCompanies || ''), tag: 'V2' },
      { label: 'Do-not-contact (synced with MGI)', html: p.doNotContact ? 'Yes' : 'No', tag: 'V2' },
    ],
    tabs: [
      ['overview', 'Overview'],
      ['activities', 'Activities'],
      ['calls', 'Calls'],
    ],
    tab: {
      overview:
        () => `<div class="card"><div class="cardh"><h2>Relationship</h2><span class="v2" style="margin-left:auto" title="Email touches arrive in V2 (D-05)">V2</span></div>
        <div class="grid2"><div><span class="l">Last touch</span><b>${rel.lastTouch ? `${fmtDate(rel.lastTouch).replace(/, \d{4}$/, '')}` : '—'}</b></div><div><span class="l">Strength: ${rel.strength}</span><div class="relbar" aria-label="Relationship strength ${rel.strength}">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= strength ? 'on' : ''}"></i>`).join('')}</div></div></div>
        <p class="small muted" style="margin:10px 0 0">${rel.recent} touches in the last 90 days, from calls and notes. Emails count once email logging arrives.</p></div>${recentActivityHtml(ref)}`,
      calls: () =>
        calls.length
          ? `<ul class="tl">${calls.map((c) => `<li data-kind="call">${callHtml(c, true)}</li>`).join('')}</ul>`
          : '<div class="empty">No calls yet.</div>',
    },
    right,
    composerRef: { refType: 'contact', refId: id, companyId: p.companyId, contactId: id },
  });
}
