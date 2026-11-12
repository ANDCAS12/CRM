/**
 * @file Fireflies call matching (H-01): attendee email domain first, then meeting title.
 */
import { IK_DOMAIN } from '../config/constants.js';
import { domainOf } from '../utils/format.js';
import { isOpen } from './deals.js';

/**
 * Matches a call to a company, deal and contacts.
 * - One external company by domain (or title) is required.
 * - A company with one open deal matches it; several open deals are split by title words.
 * - Anything ambiguous goes to the unmatched inbox (H-02) with the company pre-filled.
 * @param {object} state
 * @param {{title:string, attendees:string[]}} call
 * @returns {{companyId:string, dealId:string, contactIds:string[], matched:boolean}}
 */
export function matchCall(state, call, ikDomain = IK_DOMAIN) {
  const domains = [...new Set(call.attendees.map(domainOf).filter((d) => d && d !== ikDomain))]; // external domains only
  let companies = state.companies.filter((c) => c.domain && domains.includes(c.domain));
  if (!companies.length) {
    const title = call.title.toLowerCase();
    companies = state.companies.filter((c) => title.includes(c.name.toLowerCase().split(' ')[0])); // fallback: first word of company name in title
  }
  const emails = call.attendees.map((a) => a.toLowerCase());
  const contactIds = state.contacts.filter((p) => p.email && emails.includes(p.email.toLowerCase())).map((p) => p.id);
  if (companies.length !== 1) return { companyId: companies[0]?.id || '', dealId: '', contactIds, matched: false }; // none or ambiguous
  const company = companies[0];
  const open = state.deals.filter((d) => d.companyId === company.id && isOpen(d) && !d.archived);
  const words = call.title
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .filter((w) => w.length > 2); // ignore short words like "the"
  const scored = open.map((d) => ({ d, s: words.filter((w) => d.name.toLowerCase().includes(w)).length })).sort((a, b) => b.s - a.s);
  let deal = null;
  if (open.length === 1)
    deal = open[0]; // only one candidate
  else if (scored[0]?.s > 0 && (!scored[1] || scored[0].s > scored[1].s)) deal = scored[0].d; // clear title winner
  return { companyId: company.id, dealId: deal?.id || '', contactIds, matched: Boolean(deal) };
}
