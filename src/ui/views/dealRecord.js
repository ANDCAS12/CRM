/**
 * @file Deal page (B-05): key fields, always-on AI summary, timeline, buying roles (D-02),
 * company, contracts, documents (J-01), stage history and time in stage (B-06).
 */
import { BUYING_ROLES, STAGES } from '../../config/constants.js';
import { canEdit } from '../../core/permissions.js';
import { contactName, firstName, userName } from '../../core/lookups.js';
import { isOpen, lastActivity, timeInStage, weighted } from '../../core/deals.js';
import { dayDiff, today } from '../../utils/dates.js';
import { ago, esc, fmtDate, money } from '../../utils/format.js';
import { dealForm, moveStage, refLink } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { inputHtml } from '../forms.js';
import { renderAiCard } from '../components/aiCard.js';
import { filesCardHtml } from '../components/filesCard.js';
import { renderRecord } from '../components/recordLayout.js';
import { taskRow } from '../components/tasks.js';

export function renderDealRecord(root, id) {
  const deal = ctx.api.get('deal', id);
  if (!deal) {
    root.innerHTML = '<div class="empty">This deal doesn’t exist or isn’t visible to your role. <a href="#deals">Back to deals</a></div>';
    return;
  }
  const now = ctx.now();
  const editable = canEdit(ctx.user, 'deal', deal);
  const company = state().companies.find((c) => c.id === deal.companyId) || {};
  const roles = state().dealContacts.filter((x) => x.dealId === id);
  const contracts = ctx.api.all('contract').filter((k) => (k.dealIds || []).includes(id));
  const history = (deal.stageHistory || []).slice().reverse();

  const actions = editable
    ? `<select class="f" id="stSel" style="width:auto" aria-label="Move stage">${STAGES.map((s) => `<option${s === deal.stage ? ' selected' : ''}>${s}</option>`).join('')}</select><button class="btn" id="eBtn">Edit</button><button class="btn" id="cBtn">Clone</button><button class="btn" id="aBtn">${deal.archived ? 'Restore' : 'Archive'}</button>`
    : '';
  renderRecord(root, {
    type: 'deal',
    record: deal,
    crumb: `<a href="#deals">Deals</a> / ${esc(deal.pipeline)}`,
    title: deal.name,
    subtitle: `${refLink('company', deal.companyId)} · ${money(deal.amount)} · <span class="pill ${deal.stage === 'Closed won' ? 'won' : ''}">${esc(deal.stage)}</span>${deal.archived ? ' <span class="pill">Archived</span>' : ''}`,
    actions: actions || undefined,
    keyProps: [
      ['Owner', esc(userName(state(), deal.ownerId))],
      ['Pipeline', `<span class="badge">${esc(deal.pipeline)}</span>`],
      ['Amount', money(deal.amount)],
      ['Probability', `${deal.probability ?? ''}%`],
      ['Weighted', money(weighted(deal))],
      ['Expected close', fmtDate(deal.expectedClose)],
      ['Service line', deal.serviceLine ? `<span class="badge">${esc(deal.serviceLine)}</span>` : ''],
      ['Source', esc(deal.source) + (deal.referringPartnerId ? ` · ${refLink('company', deal.referringPartnerId)}` : '')],
      [
        'Next step',
        isOpen(deal)
          ? `${esc(deal.nextStep)}<div class="small ${deal.nextStepDate && deal.nextStepDate < today(now) ? 'warn' : 'muted'}">${fmtDate(deal.nextStepDate)}</div>`
          : '—',
      ],
      ['Last activity', ago(lastActivity(state(), deal), now)],
      ['Time in stage', `${timeInStage(deal, now)} days`],
    ],
    leftCards: `
      <div class="card"><div class="cardh"><h2>Contacts and buying roles</h2><div class="sp"></div>${editable ? '<button class="btn sm" id="addRole">Add</button>' : ''}</div>
        ${roles.length ? `<ul class="mini">${roles.map((r) => `<li><span style="flex:1;min-width:0">${refLink('contact', r.contactId)}<div class="small muted">${esc(state().contacts.find((p) => p.id === r.contactId)?.title || '')}</div></span>${editable ? `<select class="cellin" style="width:auto;min-width:0" data-role="${r.id}" aria-label="Buying role for ${esc(contactName(state(), r.contactId))}">${BUYING_ROLES.map((b) => `<option${b === r.role ? ' selected' : ''}>${b}</option>`).join('')}</select><button class="btn ghost sm" data-unrole="${r.id}" aria-label="Remove ${esc(contactName(state(), r.contactId))}">✕</button>` : `<span class="badge">${esc(r.role)}</span>`}</li>`).join('')}</ul>` : '<div class="small muted">No contacts tagged yet.</div>'}
        <div class="small muted" style="margin-top:8px">Primary: ${refLink('contact', deal.primaryContactId)} · Decision maker: ${refLink('contact', deal.decisionMakerId)} · Champion: ${refLink('contact', deal.championId)}</div></div>
      <div class="card"><div class="cardh"><h2>Company</h2></div><dl class="kv"><dt>Name</dt><dd>${refLink('company', company.id)}</dd><dt>Relationship</dt><dd>${esc(company.relationship || '—')}</dd><dt>Industry</dt><dd>${esc(company.industry || '—')}</dd><dt>Ownership</dt><dd>${esc(company.ownership || '—')}${company.peSponsorId ? ` · ${refLink('company', company.peSponsorId)}` : ''}</dd></dl></div>
      <div class="card"><div class="cardh"><h2>Contracts</h2></div>${contracts.length ? `<ul class="mini">${contracts.map((k) => `<li><span style="flex:1">${refLink('contract', k.id)}</span><span class="pill">${esc(k.status)}</span></li>`).join('')}</ul>` : '<div class="small muted">No contracts linked.</div>'}</div>
      ${filesCardHtml(deal)}`,
    centerTop: '<div id="aiCard" style="margin-bottom:14px"></div>',
    rightCards: `
      <div class="card"><div class="cardh"><h2>Stage history</h2></div><ul class="hist">${history.map((h, i) => `<li><span><b>${esc(h.stage)}</b><div class="small muted">${fmtDate(h.at)} · ${esc(firstName(state(), h.by))}</div></span><span class="small">${dayDiff(h.at, i === 0 ? today(now) : history[i - 1].at)}d${i === 0 ? ' (now)' : ''}</span></li>`).join('')}</ul></div>
      <div class="card"><div class="cardh"><h2>Open tasks</h2></div>${
        state()
          .tasks.filter((t) => t.refType === 'deal' && t.refId === id && !t.done)
          .map(taskRow)
          .join('') || '<div class="small muted">None.</div>'
      }</div>`,
    composerRef: { refType: 'deal', refId: id, dealId: id, companyId: deal.companyId },
  });
  ctx.onAiChange = (dealId) => dealId === id && renderAiCard(id); // repaint summary when generation finishes
  renderAiCard(id);

  if (!editable) return;
  $('#stSel', root).onchange = (e) => moveStage(deal, e.target.value);
  $('#eBtn', root).onclick = () => dealForm(ctx.api.get('deal', id));
  $('#cBtn', root).onclick = () => dealForm(null, ctx.api.get('deal', id));
  $('#aBtn', root).onclick = () => {
    ctx.api.update('deal', id, { archived: !deal.archived });
    toast(deal.archived ? 'Deal restored' : 'Deal archived');
    rerender();
  };
  $$('[data-role]', root).forEach((s) => (s.onchange = () => (ctx.api.update('dealContact', s.dataset.role, { role: s.value }), toast('Buying role updated'))));
  $$('[data-unrole]', root).forEach((b) => (b.onclick = () => (ctx.api.remove('dealContact', b.dataset.unrole), rerender())));
  $('#addRole', root).onclick = () => {
    const sameCompany = state().contacts.filter((p) => p.companyId === deal.companyId);
    const others = state().contacts.filter((p) => p.companyId !== deal.companyId);
    const options = [['', ''], ...sameCompany.map((p) => [p.id, `${p.name} · ${company.name}`]), ...others.map((p) => [p.id, p.name])]; // company's contacts first
    modal(
      'Tag a contact on this deal',
      `<div class="grid2"><div><label class="l" for="f_rc">Contact</label>${inputHtml({ k: 'rc', t: 'select', o: options }, '')}</div><div><label class="l" for="f_rr">Buying role</label>${inputHtml({ k: 'rr', t: 'select', o: BUYING_ROLES.map((b) => [b, b]) }, 'Influencer')}</div></div>`,
      {
        saveLabel: 'Tag contact',
        onSave: (body) => {
          const contactId = $('#f_rc', body).value;
          if (!contactId) throw new Error('Pick a contact.');
          if (state().dealContacts.some((x) => x.dealId === id && x.contactId === contactId)) throw new Error('Already on this deal.');
          ctx.api.create('dealContact', { dealId: id, contactId, role: $('#f_rr', body).value });
          rerender();
        },
      },
    );
  };
}
