/**
 * @file Calls (H-01..H-03): Fireflies sync, matching, unmatched inbox and assignment.
 * In this prototype "Sync Fireflies now" replays sample calls; production polls the GraphQL API.
 */
import { IK_DOMAIN } from '../../config/constants.js';
import { matchCall } from '../../core/matching.js';
import { isOpen } from '../../core/deals.js';
import { companyName } from '../../core/lookups.js';
import { daysAgoISO } from '../../utils/dates.js';
import { esc, fmtDate, truncate } from '../../utils/format.js';
import { refLink, refreshSummary } from '../actions.js';
import { ctx, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { inputHtml } from '../forms.js';
import { callHtml } from '../components/timeline.js';

/** Sample Fireflies payloads replayed by the demo sync. */
export const FIREFLIES_SAMPLES = Object.freeze([
  {
    title: 'Northwind FP&A: procurement check-in',
    attendees: [`cristina@${IK_DOMAIN}`, 'lortiz@northwindfoods.com', 'mruiz@northwindfoods.com'],
    durationMin: 35,
    summary:
      'Lena confirmed the vendor onboarding steps. Insurance certificate and updated W-9 needed. Phase 1 pricing at $240K is acceptable to procurement; payment terms Net 45 requested.',
    actionItems: ['Send insurance certificate and W-9', 'Update proposal to Net 45'],
  },
  {
    title: 'Intro: Harbor Ridge portfolio review',
    attendees: [`russell@${IK_DOMAIN}`, 'tbecker@harborridgecap.com'],
    durationMin: 45,
    summary:
      'Tom asked for a quarterly view of IK work across Harbor portfolio companies. Atlas budget unfreezes next quarter. Interest in a data due-diligence offer for new acquisitions.',
    actionItems: ['Draft a one-page portfolio review', 'Re-engage Atlas in the new quarter'],
  },
  {
    title: 'Catch-up with Jen',
    attendees: [`cristina@${IK_DOMAIN}`, 'jen.morales@gmail.com'],
    durationMin: 25,
    summary: 'Jen is moving to a VP Analytics role at a regional grocery chain next month and wants to talk about a reporting overhaul once she starts.',
    actionItems: ['Follow up after her start date'],
  },
  {
    title: 'Cascade: sell-through prototype review',
    attendees: [`cristina@${IK_DOMAIN}`, 'jokafor@cascaderetail.com', 'pnatarajan@cascaderetail.com'],
    durationMin: 50,
    summary:
      'James reacted well to the prototype and asked for a phased estimate covering three categories first. Concern about internal BI team capacity to maintain it.',
    actionItems: ['Send phased estimate for three categories', 'Include a handover and training plan'],
  },
  {
    title: 'Weekly sync',
    attendees: [`rod@${IK_DOMAIN}`, 'partner@unknownco.com'],
    durationMin: 30,
    summary: 'General sync about availability of two data engineers in Q3.',
    actionItems: [],
  },
]);

/** Ingests the next batch of sample calls, auto-matching each (H-01). */
export function syncFireflies(batchSize = 3) {
  const s = state();
  const start = s.settings.firefliesCursor || 0;
  if (start >= FIREFLIES_SAMPLES.length) return { added: 0, matched: 0 };
  const batch = FIREFLIES_SAMPLES.slice(start, start + batchSize);
  s.settings.firefliesCursor = start + batch.length; // cursor stands in for Fireflies' "since" timestamp
  const touched = new Set();
  let matched = 0;
  batch.forEach((x, i) => {
    const base = {
      ...x,
      date: daysAgoISO(0, ctx.now()),
      firefliesId: `ff_demo_${start + i}`,
      transcriptUrl: `https://app.fireflies.ai/view/demo${start + i}`,
      recordingUrl: `https://app.fireflies.ai/view/demo${start + i}#recording`,
      source: 'fireflies',
    };
    const match = matchCall(s, base);
    const call = ctx.api.create('call', { ...base, ...match }, { system: true, persist: false });
    if (match.matched) {
      matched++;
      ctx.api.logActivity('call', { dealId: call.dealId, companyId: call.companyId, text: `recorded “${call.title}”` });
      touched.add(call.dealId);
    }
  });
  ctx.store.save();
  touched.forEach((dealId) => refreshSummary(dealId, { auto: true })); // H-04 after each new call
  return { added: batch.length, matched };
}

export function renderCalls(root) {
  const tab = ctx.ui.callsTab;
  const inbox = state().calls.filter((c) => !c.matched);
  const all = state()
    .calls.filter((c) => c.matched)
    .sort((a, b) => b.date.localeCompare(a.date));
  root.innerHTML = `<div class="pagehead"><div><h1>Calls</h1><div class="sub">Fireflies calls are matched by attendee email domain and meeting title. Unmatched calls wait in the inbox.</div></div><div class="sp"></div><button class="btn pri" id="ffSync">Sync Fireflies now</button></div>
  <div class="tabs" role="tablist"><button role="tab" data-ct2="inbox" class="${tab === 'inbox' ? 'on' : ''}">Unmatched inbox (${inbox.length})</button><button role="tab" data-ct2="all" class="${tab === 'all' ? 'on' : ''}">All calls (${all.length})</button></div>
  ${
    tab === 'inbox'
      ? inbox.length
        ? inbox
            .map(
              (c) =>
                `<div class="card"><div class="tl">${callHtml(c)}</div><div class="small muted" style="margin-top:6px">Attendees: ${c.attendees.map(esc).join(', ')}${c.companyId ? ` · Company guess: ${refLink('company', c.companyId)}` : ''}</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm pri" data-assign="${c.id}">Assign to deal or company</button><button class="btn sm" data-dismiss="${c.id}">Not a client call</button></div></div>`,
            )
            .join('')
        : '<div class="empty">Inbox is clear. New calls that can’t be matched will land here.</div>'
      : `<div class="tablewrap"><table class="t"><thead><tr><th>Call</th><th>Date</th><th>Duration</th><th>Deal</th><th>Company</th><th>Source</th></tr></thead><tbody>${all.map((c) => `<tr><td><b>${esc(c.title)}</b><div class="small muted">${esc(truncate(c.summary || '', 110))}</div></td><td>${fmtDate(c.date)}</td><td>${c.durationMin} min</td><td>${refLink('deal', c.dealId)}</td><td>${refLink('company', c.companyId)}</td><td>${c.source === 'fireflies' ? 'Fireflies' : 'Manual'}</td></tr>`).join('')}</tbody></table></div>`
  }`;

  $$('[data-ct2]', root).forEach((b) => (b.onclick = () => ((ctx.ui.callsTab = b.dataset.ct2), ctx.render())));
  $('#ffSync', root).onclick = () => {
    const r = syncFireflies();
    toast(r.added ? `Fireflies: ${r.added} new calls, ${r.matched} matched, ${r.added - r.matched} in the inbox` : 'Fireflies is up to date. No new calls.');
    ctx.render();
  };
  $$('[data-dismiss]', root).forEach(
    (b) => (b.onclick = () => (ctx.api.remove('call', b.dataset.dismiss), toast('Call removed from the inbox'), ctx.render())),
  );
  $$('[data-assign]', root).forEach((b) => (b.onclick = () => assignCall(ctx.api.raw('call', b.dataset.assign))));
}

/** Assigns an inbox call to a company, deal and contacts (H-02). */
function assignCall(call) {
  const s = state();
  modal(
    'Assign call',
    `<p class="muted" style="margin-top:0">${esc(call.title)}</p><div class="grid2">
    <div><label class="l" for="f_ac">Company</label>${inputHtml({ k: 'ac', t: 'select', o: [['', ''], ...s.companies.map((c) => [c.id, c.name])] }, call.companyId)}</div>
    <div><label class="l" for="f_ad">Deal (optional)</label>${inputHtml({ k: 'ad', t: 'select', o: [['', ''], ...s.deals.filter(isOpen).map((d) => [d.id, `${d.name} — ${companyName(s, d.companyId)}`])] }, '')}</div>
    <div class="full"><label class="l" for="f_ap">Contacts</label>${inputHtml({ k: 'ap', t: 'multi', o: s.contacts.map((p) => [p.id, `${p.name} (${companyName(s, p.companyId)})`]) }, call.contactIds)}</div></div>`,
    {
      saveLabel: 'Assign',
      onSave: (body) => {
        const dealId = $('#f_ad', body).value;
        const companyId = $('#f_ac', body).value || (dealId ? s.deals.find((d) => d.id === dealId).companyId : ''); // deal implies its company
        if (!companyId) throw new Error('Pick at least a company.');
        ctx.api.update('call', call.id, { companyId, dealId, contactIds: [...$('#f_ap', body).selectedOptions].map((o) => o.value), matched: true });
        ctx.api.logActivity('call', { dealId, companyId, text: `assigned the call “${call.title}”` });
        ctx.store.save();
        toast('Call assigned');
        if (dealId) refreshSummary(dealId, { auto: true });
        ctx.render();
      },
    },
  );
}
