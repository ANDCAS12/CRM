/**
 * @file Calls (H-01..H-03): Fireflies sync, matching, unmatched inbox and assignment.
 * In this prototype "Sync Fireflies now" replays sample calls; production polls the GraphQL API.
 */
import { IK_DOMAIN } from '../../config/constants.js';
import { matchCall } from '../../core/matching.js';
import { isOpen } from '../../core/deals.js';
import { companyName, dealName } from '../../core/lookups.js';
import { canEdit } from '../../core/permissions.js';
import { addDays, daysAgoISO, isoDay } from '../../utils/dates.js';
import { esc, fmtDate } from '../../utils/format.js';
import { refreshSummary } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { formHtml, inputHtml, readForm } from '../forms.js';

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

/** Parses a due date out of an action item such as "Send revised pricing by Nov 19" (falls back to +7 days). */
export function dueFromText(text, now = new Date()) {
  const m = String(text).match(/\bby\s+([A-Z][a-z]{2,8}\.?\s+\d{1,2})\b/);
  if (m) {
    const d = new Date(`${m[1].replace('.', '')} ${now.getFullYear()} 12:00`);
    if (!Number.isNaN(d.getTime())) return isoDay(d < now ? new Date(d.setFullYear(d.getFullYear() + 1)) : d); // a date already passed means next year
  }
  return addDays(isoDay(now), 7);
}

/** Calls shown for the active tab: all, unmatched (H-02) or calls I attended. */
function callsFor(tab) {
  const s = state();
  const mine = (c) => (c.attendees || []).map((a) => a.toLowerCase()).includes(ctx.user.email);
  const list = s.calls.filter((c) => (tab === 'unmatched' ? !c.matched : tab === 'mine' ? mine(c) : true));
  return list.sort((a, b) => Number(a.matched) - Number(b.matched) || b.date.localeCompare(a.date)); // unmatched first, newest first
}

export function renderCalls(root) {
  const ui = ctx.ui;
  const s = state();
  const tab = ['all', 'unmatched', 'mine'].includes(ui.callsTab) ? ui.callsTab : 'all';
  const list = callsFor(tab);
  const unmatched = s.calls.filter((c) => !c.matched).length;
  if (!list.some((c) => c.id === ui.callSel)) ui.callSel = list[0]?.id || ''; // keep a call selected
  const sel = s.calls.find((c) => c.id === ui.callSel);
  const openDeals = s.deals.filter((d) => isOpen(d) && !d.archived);
  const dealOptions = (c) =>
    `<option value="">${c.matched ? 'Move to another deal' : 'Assign to deal or company'}</option><optgroup label="Open deals">${openDeals.map((d) => `<option value="deal:${d.id}">${esc(d.name)} · ${esc(companyName(s, d.companyId))}</option>`).join('')}</optgroup><optgroup label="Company only">${s.companies.map((co) => `<option value="company:${co.id}">${esc(co.name)}</option>`).join('')}</optgroup>`;
  const domainOf = (c) => (c.attendees || []).map((a) => a.split('@')[1]).find((d) => d && d !== IK_DOMAIN) || '';
  root.innerHTML = `<div class="pagehead"><h1>Calls</h1><div class="sp"></div>
      <div class="search" style="max-width:320px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input disabled placeholder="Search all transcripts, e.g. “pricing”" aria-label="Search all transcripts (V2)"></div><span class="v2" title="Transcript search arrives in V2 (H-06)">V2</span>
      <button class="btn pri" id="ffSync">Sync Fireflies now</button></div>
    <div class="tabs" role="tablist"><button role="tab" data-ct2="all" class="${tab === 'all' ? 'on' : ''}">All calls</button><button role="tab" data-ct2="unmatched" class="${tab === 'unmatched' ? 'on' : ''}">Unmatched (${unmatched})</button><button role="tab" data-ct2="mine" class="${tab === 'mine' ? 'on' : ''}">My calls</button></div>
    ${
      list.length
        ? `<div class="split"><div>${list
            .map(
              (
                c,
              ) => `<div class="callcard ${c.id === ui.callSel ? 'on' : ''}" data-call="${c.id}" tabindex="0" role="button" aria-pressed="${c.id === ui.callSel}">
        <div class="t">${esc(c.title)}<span>${fmtDate(c.date).replace(/, \d{4}$/, '')}, ${c.durationMin} min</span></div>
        <div class="small muted">${domainOf(c) ? `@${esc(domainOf(c))}, ` : ''}${(c.attendees || []).length} attendees</div>
        <div class="row">${c.matched ? `<span class="badge">${esc(c.dealId ? dealName(s, c.dealId) : companyName(s, c.companyId))}</span>` : `<span class="badge dark">Unmatched</span><select data-assign="${c.id}" aria-label="Assign ${esc(c.title)}">${dealOptions(c)}</select>`}</div></div>`,
            )
            .join('')}</div>
      <div id="callDetail">${sel ? detailHtml(sel, s) : ''}</div></div>`
        : `<div class="empty">${tab === 'unmatched' ? 'Inbox is clear. Calls that can’t be matched land here.' : 'No calls yet. Click “Sync Fireflies now”.'}</div>`
    }`;

  $$('[data-ct2]', root).forEach((b) => (b.onclick = () => ((ui.callsTab = b.dataset.ct2), ctx.render())));
  $('#ffSync', root).onclick = () => {
    const r = syncFireflies();
    toast(r.added ? `Fireflies: ${r.added} new calls, ${r.matched} matched, ${r.added - r.matched} unmatched` : 'Fireflies is up to date. No new calls.');
    ctx.render();
  };
  $$('[data-call]', root).forEach((c) => {
    c.onclick = (e) => {
      if (e.target.closest('select')) return; // the assign menu has its own handler
      ui.callSel = c.dataset.call;
      rerender();
    };
    c.onkeydown = (e) => e.key === 'Enter' && c.onclick(e);
  });
  $$('[data-assign]', root).forEach(
    (sel2) =>
      (sel2.onchange = () =>
        sel2.value &&
        assign(
          s.calls.find((c) => c.id === sel2.dataset.assign),
          sel2.value,
        )),
  );
  bindDetail(root, sel);
}

/** Right-hand call detail: suggested match, summary, action items with "Create task", links. */
function detailHtml(c, s) {
  const attendees = (c.attendees || []).map((a) => s.contacts.find((p) => p.email?.toLowerCase() === a.toLowerCase())?.name || a).join(', ');
  const guess = !c.matched && c.companyId ? s.companies.find((co) => co.id === c.companyId) : null;
  const guessDeal = guess && s.deals.find((d) => d.companyId === guess.id && isOpen(d) && !d.archived);
  const match = c.matched
    ? `<div class="match"><span class="tx" style="flex:1"><span class="small muted">${c.source === 'fireflies' ? 'Matched automatically' : 'Logged manually'}</span><br><b>${esc(companyName(s, c.companyId))}${c.dealId ? `, deal: ${esc(dealName(s, c.dealId))}` : ''}</b></span><button class="btn sm" id="chgMatch">Change</button></div>`
    : guess
      ? `<div class="match"><span class="tx" style="flex:1"><span class="small muted">Suggested match (auto, by email domain)</span><br><b>${esc(guess.name)}${guessDeal ? `, deal: ${esc(guessDeal.name)}` : ''}</b></span><button class="btn pri sm" id="okMatch" data-target="${guessDeal ? `deal:${guessDeal.id}` : `company:${guess.id}`}">Confirm</button><button class="btn sm" id="chgMatch">Change</button></div>`
      : '<div class="match"><span class="small muted" style="flex:1">No company matches these attendees. Assign it on the left, or remove it if it wasn’t a client call.</span></div>';
  const canTask = canEdit(ctx.user, 'task', null);
  return `<div class="card"><div class="cardh"><h2>${esc(c.title)}</h2><span class="count">${c.source === 'fireflies' ? 'From Fireflies' : 'Logged manually'}</span></div>
    <div class="small muted">${fmtDate(c.date)}, ${c.durationMin} min. Attendees: ${esc(attendees)}</div>
    ${match}
    <h3 style="margin:14px 0 4px">Summary</h3><p style="margin:0">${esc(c.summary || 'No summary.')}</p>
    ${(c.actionItems || []).length ? `<h3 style="margin:16px 0 4px">Action items</h3><ul class="mini">${c.actionItems.map((a, i) => `<li><span class="tx">${esc(a)}</span>${canTask ? `<button class="btn sm" data-mktask="${i}">Create task</button>` : ''}</li>`).join('')}</ul><p class="small faint" style="margin:6px 0 0">Choose who owns each task and when it’s due before creating it. Automatic task suggestions and calendar alerts arrive in V2.</p>` : ''}
    <div style="display:flex;gap:16px;margin-top:14px;font-weight:600">${c.recordingUrl ? `<a href="${esc(c.recordingUrl)}" target="_blank" rel="noopener">Recording</a>` : ''}${c.transcriptUrl ? `<a href="${esc(c.transcriptUrl)}" target="_blank" rel="noopener">Full transcript</a>` : ''}${!c.matched ? '<button class="linkbtn muted" id="notClient" style="margin-left:auto">Not a client call</button>' : ''}</div></div>`;
}

/** Wires the detail panel. */
function bindDetail(root, c) {
  if (!c) return;
  $('#okMatch', root)?.addEventListener('click', (e) => assign(c, e.target.dataset.target));
  $('#chgMatch', root)?.addEventListener('click', () => assignDialog(c));
  $('#notClient', root)?.addEventListener('click', () => {
    ctx.api.remove('call', c.id);
    toast('Removed: not a client call');
    ctx.render();
  });
  $$('[data-mktask]', root).forEach((b) => (b.onclick = () => taskFromActionItem(c, c.actionItems[Number(b.dataset.mktask)])));
}

/** Assigns a call to "deal:<id>" or "company:<id>" and refreshes the deal summary (H-02, H-04). */
function assign(call, target) {
  const s = state();
  const [kind, id] = target.split(':');
  const deal = kind === 'deal' ? s.deals.find((d) => d.id === id) : null;
  const companyId = deal ? deal.companyId : id;
  const emails = (call.attendees || []).map((a) => a.toLowerCase());
  const contactIds = s.contacts.filter((p) => p.email && emails.includes(p.email.toLowerCase())).map((p) => p.id); // link known attendees
  ctx.api.update('call', call.id, { companyId, dealId: deal?.id || '', contactIds, matched: true });
  ctx.api.logActivity('call', { dealId: deal?.id || '', companyId, text: `assigned the call “${call.title}”` });
  ctx.store.save();
  toast(deal ? `Call added to ${deal.name}` : 'Call added to the company');
  if (deal) refreshSummary(deal.id, { auto: true });
  ctx.render();
}

/** Full assignment dialog (company, deal and contacts), used by "Change". */
function assignDialog(call) {
  const s = state();
  modal(
    'Assign call',
    `<p class="muted" style="margin-top:0">${esc(call.title)}</p><div class="grid2">
    <div><label class="l" for="f_ac">Company</label>${inputHtml({ k: 'ac', t: 'select', o: [['', ''], ...s.companies.map((c) => [c.id, c.name])] }, call.companyId)}</div>
    <div><label class="l" for="f_ad">Deal (optional)</label>${inputHtml({ k: 'ad', t: 'select', o: [['', ''], ...s.deals.filter(isOpen).map((d) => [d.id, `${d.name} — ${companyName(s, d.companyId)}`])] }, call.dealId)}</div>
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

/** Turns a call action item into a task; the person confirms owner and due date first (Nov 13 walkthrough). */
function taskFromActionItem(call, item) {
  const s = state();
  const due = dueFromText(item, ctx.now());
  const owner = s.users.find((u) => u.status === 'active' && item.toLowerCase().startsWith(u.name.split(' ')[0].toLowerCase()))?.id || ctx.user.id; // "Russell to draft…" -> Russell
  modal(
    'Create task from action item',
    `<p class="small muted" style="margin-top:0">From “${esc(call.title)}”. Check who owns it and when it’s due.</p>${formHtml('task', { title: item, assigneeId: owner, dueDate: due, reminderDate: due, emailReminder: true })}`,
    {
      saveLabel: 'Create task',
      onSave: (body) => {
        const t = readForm('task', body);
        if (!t.title || !t.dueDate) throw new Error('A task needs a title and a due date.');
        ctx.api.create('task', {
          ...t,
          done: false,
          refType: call.dealId ? 'deal' : call.companyId ? 'company' : '',
          refId: call.dealId || call.companyId || '',
        });
        toast('Task created');
        ctx.render();
      },
    },
  );
}
