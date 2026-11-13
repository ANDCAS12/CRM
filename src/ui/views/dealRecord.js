/**
 * @file Deal record (build brief slide 9): key fields with inline edit (B-02, B-05), close won/lost (B-07),
 * stage progress, history and time in stage (B-06), the always-on summary with sources (H-04, I-01),
 * timeline with Fireflies calls (H-03), source/partner/next step (B-08, B-09), contacts with buying roles (D-02)
 * and SharePoint files (J-01).
 */
import { BUYING_ROLES, PROGRESS_STAGES, STAGE_DESCRIPTIONS, STAGES } from '../../config/constants.js';
import { canEdit } from '../../core/permissions.js';
import { isOpen, timeInStage, weighted } from '../../core/deals.js';
import { contactName, userName } from '../../core/lookups.js';
import { latestSummary, stubFiles } from '../../ai/summary.js';
import { dayDiff, today } from '../../utils/dates.js';
import { esc, fmtDate, kmoney } from '../../utils/format.js';
import { closeDealModal, dealForm, initials, moveStage, refreshSummary } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { inputHtml } from '../forms.js';
import { renderAiCard } from '../components/aiCard.js';
import { recentActivityHtml, renderRecordPage, sideCard } from '../components/recordPage.js';
import { callHtml } from '../components/timeline.js';

/** Stage progress across the selling path; On Hold, Partners and closed deals show their state instead. */
function progressHtml(deal, now) {
  const idx = PROGRESS_STAGES.indexOf(deal.stage);
  const won = deal.stage === 'Closed won';
  const bars = PROGRESS_STAGES.map((st, i) => {
    const cls = won || i < idx ? 'done' : i === idx ? 'cur' : '';
    return `<div title="${esc(STAGE_DESCRIPTIONS[st])}"><div class="bar ${cls}"></div><div class="lab ${i === idx ? 'cur' : ''}">${esc(st)}</div></div>`;
  }).join('');
  const days = timeInStage(deal, now);
  const age = dayDiff(deal.createdAt, today(now));
  const note = idx >= 0 ? `${days} days in ${deal.stage}, ${age} days open` : `${deal.stage} for ${days} days${isOpen(deal) ? `, ${age} days open` : ''}`;
  return `<div class="progress" aria-label="Stage progress">${bars}</div><div class="progmeta">${esc(note)}</div>`;
}

export function renderDealRecord(root, id) {
  const deal = ctx.api.get('deal', id);
  if (!deal) {
    root.innerHTML = '<div class="empty">This deal doesn’t exist or isn’t visible to your role. <a href="#deals">Back to deals</a></div>';
    return;
  }
  const s = state();
  const now = ctx.now();
  const editable = canEdit(ctx.user, 'deal', deal);
  const company = s.companies.find((c) => c.id === deal.companyId) || {};
  const roles = s.dealContacts.filter((x) => x.dealId === id);
  const contracts = ctx.api.all('contract').filter((k) => (k.dealIds || []).includes(id));
  const email = s.contacts.find((p) => p.id === deal.primaryContactId)?.email;
  const ref = { type: 'deal', id };

  const head = `<h1>${esc(deal.name)}</h1><div class="subt"><a class="lnk" href="#company-${company.id}">${esc(company.name || '')}</a>${deal.archived ? ' · Archived' : ''}</div>
    <div class="big">${kmoney(deal.amount)}<small>Weighted ${kmoney(weighted(deal))} (${deal.probability ?? 0}%)</small></div>
    ${
      editable
        ? `<select class="f" id="stSel" style="margin-top:12px" aria-label="Stage">${STAGES.map((x) => `<option value="${esc(x)}"${x === deal.stage ? ' selected' : ''}>Stage: ${esc(x)}</option>`).join('')}</select>
    <div class="row2">${isOpen(deal) ? '<button class="btn block" id="wonBtn">Close won</button><button class="btn block" id="lostBtn">Close lost</button>' : `<span class="badge ${deal.stage === 'Closed won' ? '' : 'dark'}" style="justify-self:start">${esc(deal.stage)}</span><span class="small muted">${esc(deal.winLossReason || '')}</span>`}</div>
    <div class="row2"><button class="btn sm" id="eBtn">Edit</button><button class="btn sm" id="cBtn">Clone</button></div>`
        : `<div class="badges"><span class="badge dark">${esc(deal.stage)}</span></div><p class="small faint">Read only for your role</p>`
    }`;

  const contactsCard = sideCard(
    'Contacts',
    roles.length,
    roles.length
      ? `<ul class="mini">${roles
          .map((r) => {
            const p = s.contacts.find((c) => c.id === r.contactId) || {};
            return `<li><span class="av" aria-hidden="true">${esc(initials(p.name))}</span><span class="tx"><a class="lnk" href="#contact-${p.id}">${esc(p.name)}</a><span>${esc(p.title || '')}</span></span>${editable ? `<select class="fsel" data-role="${r.id}" aria-label="Buying role for ${esc(p.name)}">${BUYING_ROLES.map((b) => `<option${b === r.role ? ' selected' : ''}>${b}</option>`).join('')}</select><button class="btn ghost sm" data-unrole="${r.id}" aria-label="Remove ${esc(p.name)}">✕</button>` : `<span class="badge">${esc(r.role)}</span>`}</li>`;
          })
          .join('')}</ul>`
      : '<div class="small muted">No contacts tagged yet.</div>',
    editable ? '<button class="btn sm" id="addRole" style="margin-left:auto">Add</button>' : '',
  );

  const right = [
    sideCard(
      'Company',
      1,
      `<a class="lnk" href="#company-${company.id}">${esc(company.name || '—')}</a><div class="small muted">${esc([company.relationship, company.industry, company.ownership].filter(Boolean).join(', '))}</div>`,
    ),
    contactsCard,
    sideCard(
      'Contracts',
      contracts.length,
      contracts.length
        ? `<ul class="mini">${contracts.map((k) => `<li><span class="tx"><a class="lnk" href="#contract-${k.id}">${esc(k.name)}</a><span>${k.endDate ? `Ends ${fmtDate(k.endDate)}` : esc(k.type)}</span></span><span class="badge ${k.status === 'Signed' ? '' : 'dark'}">${esc(k.status)}</span></li>`).join('')}</ul>`
        : '<div class="small muted">No contracts linked.</div>',
    ),
    sideCard(
      'Files in SharePoint',
      deal.folderUrl ? 4 : 0,
      deal.folderUrl
        ? `<ul class="mini files">${stubFiles(deal.name)
            .slice(0, 3)
            .map(([n]) => `<li><span class="ic" aria-hidden="true"></span><span class="tx">${esc(n)}</span></li>`)
            .join('')}</ul><a class="small lnk" href="${esc(deal.folderUrl)}" target="_blank" rel="noopener">Open folder</a>`
        : '<div class="small muted">No folder linked. Add one under Folder.</div>',
    ),
    sideCard(
      'Collaborators',
      (deal.collaborators || []).length,
      `<div style="display:flex;gap:6px;align-items:center">${(deal.collaborators || []).map((u) => `<span class="av" title="${esc(userName(s, u))}">${esc(initials(userName(s, u)))}</span>`).join('') || '<span class="small muted">None yet</span>'}<span class="v2" style="margin-left:auto" title="@mentions arrive in V2 (B-12)">V2</span></div>`,
    ),
  ].join('');

  renderRecordPage(root, {
    type: 'deal',
    record: deal,
    back: ['#deals', 'Deals'],
    head,
    email,
    about: [
      'pipeline',
      'expectedClose',
      'ownerId',
      'serviceLine',
      'dealType',
      'priority',
      'source',
      'referringPartnerId',
      'probability',
      'expectedStart',
      'durationMonths',
      'nextStep',
      'nextStepDate',
      'competitors',
      {
        label: 'Folder',
        html: deal.folderUrl ? `<a href="${esc(deal.folderUrl)}" target="_blank" rel="noopener">SharePoint › ${esc(company.name || '')}</a>` : '',
      },
      'folderUrl',
    ],
    center: progressHtml(deal, now),
    tabs: [
      ['overview', 'Overview'],
      ['activities', 'Activities'],
      ['calls', 'Calls'],
      ['files', 'Files'],
    ],
    tab: {
      overview: () => `<div id="aiCard"></div>${recentActivityHtml(ref)}`,
      calls: () => {
        const calls = s.calls.filter((c) => c.matched && c.dealId === id).sort((a, b) => b.date.localeCompare(a.date));
        return calls.length
          ? `<ul class="tl">${calls.map((c) => `<li data-kind="call">${callHtml(c)}</li>`).join('')}</ul>`
          : '<div class="empty">No calls on this deal yet.</div>';
      },
      files: () =>
        deal.folderUrl
          ? `<div class="card"><ul class="mini files">${stubFiles(deal.name)
              .map(
                ([n, k, d]) => `<li><span class="ic" aria-hidden="true"></span><span class="tx"><b>${esc(n)}</b><span>${k} · ${d} days ago</span></span></li>`,
              )
              .join('')}</ul><p class="small faint">Sample file list until Microsoft Graph is connected (J-01).</p></div>`
          : '<div class="empty">No SharePoint folder linked.</div>',
    },
    right,
    composerRef: { refType: 'deal', refId: id, dealId: id, companyId: deal.companyId },
    onBind: (r) => {
      ctx.onAiChange = (dealId) => dealId === id && renderAiCard(id); // repaint the summary when generation finishes
      renderAiCard(id);
      if (!latestSummary(state(), id)) refreshSummary(id, { auto: true }); // always-on (H-04): write the first summary on first visit
      if (!editable) return;
      $('#stSel', r).onchange = (e) => moveStage(deal, e.target.value);
      $('#wonBtn', r)?.addEventListener('click', () => closeDealModal(deal, 'Closed won'));
      $('#lostBtn', r)?.addEventListener('click', () => closeDealModal(deal, 'Closed lost'));
      $('#eBtn', r).onclick = () => dealForm(ctx.api.get('deal', id));
      $('#cBtn', r).onclick = () => dealForm(null, ctx.api.get('deal', id));
      $$('[data-role]', r).forEach(
        (sel) => (sel.onchange = () => (ctx.api.update('dealContact', sel.dataset.role, { role: sel.value }), toast('Buying role updated'))),
      );
      $$('[data-unrole]', r).forEach((b) => (b.onclick = () => (ctx.api.remove('dealContact', b.dataset.unrole), rerender())));
      $('#addRole', r)?.addEventListener('click', () => addContactRole(deal, company));
    },
  });
}

/** Tags a contact on the deal with a buying role (D-02). The deal's company contacts are listed first. */
function addContactRole(deal, company) {
  const s = state();
  const same = s.contacts.filter((p) => p.companyId === deal.companyId);
  const others = s.contacts.filter((p) => p.companyId !== deal.companyId);
  const options = [['', ''], ...same.map((p) => [p.id, `${p.name} · ${company.name}`]), ...others.map((p) => [p.id, p.name])];
  modal(
    'Tag a contact on this deal',
    `<div class="grid2"><div><label class="l" for="f_rc">Contact</label>${inputHtml({ k: 'rc', t: 'select', o: options }, '')}</div><div><label class="l" for="f_rr">Buying role</label>${inputHtml({ k: 'rr', t: 'select', o: BUYING_ROLES.map((b) => [b, b]) }, 'Influencer')}</div></div>`,
    {
      saveLabel: 'Tag contact',
      onSave: (body) => {
        const contactId = $('#f_rc', body).value;
        if (!contactId) throw new Error('Pick a contact.');
        if (s.dealContacts.some((x) => x.dealId === deal.id && x.contactId === contactId))
          throw new Error(`${contactName(s, contactId)} is already on this deal.`);
        ctx.api.create('dealContact', { dealId: deal.id, contactId, role: $('#f_rr', body).value });
        rerender();
      },
    },
  );
}
