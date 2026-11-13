/**
 * @file "Ask Claude" side panel (build brief slide 15). Questions in plain language (I-05) and one-click
 * drafting are V2; the MVP's Claude feature is the always-on deal summary with sources (H-04, I-01).
 */
import { parseRoute } from '../routes.js';
import { esc } from '../../utils/format.js';
import { ctx, state } from '../context.js';
import { drawer } from '../dom.js';

/** One-click actions planned for V2 and V3 (slide 15), listed so testers know what is coming. */
const PLANNED = [
  ['Win/loss review of recent deals', 'I-02', 'V2'],
  ['SOW outline in the IK Word template', 'I-03', 'V2'],
  ['Financials draft from the rate card', 'I-04', 'V2'],
  ['Ask questions about the CRM in plain language', 'I-05', 'V2'],
  ['Pre-call brief before each meeting', 'I-06', 'V2'],
  ['Proposal outline and follow-up email', 'I-07', 'V3'],
];

/** Opens the panel, scoped to the deal on screen when there is one. */
export function openAskClaude() {
  const { page, id } = parseRoute(location.hash);
  const deal = page === 'deal' ? state().deals.find((d) => d.id === id) : null; // scope to the record you are on
  const body = `
    <p style="margin-top:0">${deal ? `On <b>${esc(deal.name)}</b>, the` : 'Today, the'} <b>deal summary</b> on every deal page is written by Claude from its calls, notes and documents, and lists its sources.</p>
    ${deal ? '<button class="btn pri block" id="askGoSummary">Go to this deal’s summary</button>' : '<a class="btn block" href="#deals" id="askGoDeals">Open a deal</a>'}
    <div class="card placeholder" style="margin-top:16px"><div class="cardh"><h2>Ask in plain language</h2><span class="v2">V2</span></div>
      <input class="f" disabled placeholder="Which Staff aug deals have had no call in three weeks?" aria-label="Question for Claude (available in V2)">
      <p>Every answer will cite the calls, notes and documents it used.</p></div>
    <div class="card placeholder"><div class="cardh"><h2>One-click actions</h2></div>
      <ul class="mini">${PLANNED.map(([l, sid, phase]) => `<li><span class="tx">${esc(l)}<span> · ${sid}</span></span><span class="v2">${phase}</span></li>`).join('')}</ul></div>`;
  const panel = drawer('Ask Claude', body);
  panel.body.querySelector('#askGoSummary')?.addEventListener('click', () => {
    panel.close();
    ctx.ui.recordTab.deal = 'overview';
    document.getElementById('aiCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  panel.body.querySelector('#askGoDeals')?.addEventListener('click', () => panel.close());
}
