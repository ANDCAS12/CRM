/**
 * @file Contacts index and contact page (D-01..D-03): list views with filters, inline edits,
 * import, and a record page with relationship strength and buying roles.
 */
import { canEdit } from '../../core/permissions.js';
import { relationship } from '../../core/contacts.js';
import { companyName, firstName, userName } from '../../core/lookups.js';
import { ago, esc } from '../../utils/format.js';
import { contactForm, refLink } from '../actions.js';
import { ctx, state } from '../context.js';
import { $ } from '../dom.js';
import { openImportDialog, viewImportedRecords } from '../components/importDialog.js';
import { renderListView } from '../components/listView.js';
import { renderRecord } from '../components/recordLayout.js';

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
    headerActions: `${canImport ? '<button class="btn" id="impP">Import</button>' : ''}${canEdit(ctx.user, 'contact', null) ? '<button class="btn pri" id="newP">Create contact</button>' : ''}`,
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
  const roles = s.dealContacts.filter((x) => x.contactId === id);
  const rel = relationship(s, id, ctx.now());
  renderRecord(root, {
    type: 'contact',
    record: p,
    crumb: '<a href="#contacts">Contacts</a>',
    title: p.name,
    subtitle: `${esc(p.title || '')}${p.companyId ? ` at ${refLink('company', p.companyId)}` : ''}${p.doNotContact ? ' · <span class="warn">Do not contact</span>' : ''}`,
    actions: canEdit(ctx.user, 'contact', p) ? '<button class="btn" id="eP">Edit</button>' : undefined,
    keyProps: [
      ['Email', p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''],
      ['Phone', esc(p.phone)],
      ['Job title', esc(p.title)],
      ['Owner', esc(userName(s, p.ownerId))],
      ['Location', esc([p.location, p.timezone].filter(Boolean).join(' · '))],
      ['Last touch', rel.lastTouch ? ago(rel.lastTouch, ctx.now()) : ''],
      ['Relationship', `${rel.strength} <span class="small faint">(${rel.recent} in 90 days)</span>`],
    ],
    rightCards: `
      <div class="card"><div class="cardh"><h2>Company</h2></div>${p.companyId ? `<ul class="mini"><li>${refLink('company', p.companyId)}</li></ul>` : '<div class="small muted">Not linked to a company. Set one in the properties.</div>'}</div>
      <div class="card"><div class="cardh"><h2>Deals and buying roles</h2></div>${roles.length ? `<ul class="mini">${roles.map((r) => `<li><span style="flex:1">${refLink('deal', r.dealId)}</span><span class="badge">${esc(r.role)}</span></li>`).join('')}</ul>` : '<div class="small muted">Not tagged on any deal. Tag contacts from a deal page.</div>'}</div>`,
    composerRef: { refType: 'contact', refId: id, companyId: p.companyId, contactId: id },
  });
  $('#eP', root)?.addEventListener('click', () => contactForm(ctx.api.get('contact', id)));
}
