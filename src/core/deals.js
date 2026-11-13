/**
 * @file Deal rules: weighting, validation, filtering and export (B, L-02, L-04).
 */
import { CLOSED_STAGES } from '../config/constants.js';
import { dayDiff, today } from '../utils/dates.js';
import { ValidationError } from './errors.js';
import { companyName, userName } from './lookups.js';

/** Weighted amount = amount × probability (§4 "weighted amount auto"). */
export const weighted = (deal) => ((+deal.amount || 0) * (+deal.probability || 0)) / 100;

/** A deal is open until it is closed won or lost. On hold counts as open. */
export const isOpen = (deal) => !CLOSED_STAGES.includes(deal.stage);

/** Latest activity timestamp on a deal, falling back to its creation time. */
export function lastActivity(state, deal) {
  let latest = deal.createdAt;
  for (const a of state.activities) if (a.dealId === deal.id && a.at > latest) latest = a.at; // ISO strings sort lexically
  return latest;
}

/** Days since the deal entered its current stage (B-06). */
export function timeInStage(deal, now = new Date()) {
  const last = (deal.stageHistory || []).at(-1);
  return last ? dayDiff(last.at, today(now)) : 0;
}

/** True when an open deal has no next step date or it is in the past (B-09 visual flag). */
export const nextStepOverdue = (deal, now = new Date()) => isOpen(deal) && (!deal.nextStepDate || deal.nextStepDate < today(now));

/**
 * Enforces B-07 (close needs reason and competitor) and B-09 (open needs next step and date).
 * @throws {ValidationError}
 */
export function validateDeal(deal) {
  if (!deal.name) throw new ValidationError('Give the deal a name.');
  if (!deal.companyId) throw new ValidationError('Pick a company.');
  if (CLOSED_STAGES.includes(deal.stage)) {
    if (!deal.winLossReason) throw new ValidationError('Closing a deal needs a win or loss reason.');
    if (deal.stage === 'Closed lost' && !deal.competitors) throw new ValidationError('Add the competitor involved (or “None”).');
  } else if (!deal.nextStep || !deal.nextStepDate) {
    throw new ValidationError('Every open deal needs a next step and a date.');
  }
}

/**
 * Applies the L-02 deal filters.
 * @param {object} state dataset (for company and activity lookups)
 * @param {object[]} deals visible deals
 * @param {object} f filter values
 * @param {string} pipeline pipeline name or "All"
 */
export function filterDeals(state, deals, f, pipeline = 'All', now = new Date()) {
  const companies = new Map(state.companies.map((c) => [c.id, c])); // O(1) company lookups for large datasets
  const q = String(f.q || '')
    .toLowerCase()
    .trim();
  return deals.filter((d) => {
    if (pipeline !== 'All' && d.pipeline !== pipeline) return false;
    if (q && !`${d.name} ${companies.get(d.companyId)?.name || ''}`.toLowerCase().includes(q)) return false; // board search
    if (f.stage && d.stage !== f.stage) return false;
    if (f.openOnly && !isOpen(d)) return false;
    if (f.ownerId && d.ownerId !== f.ownerId) return false;
    if (f.mine && d.ownerId !== f.mine && !(d.collaborators || []).includes(f.mine)) return false; // "My open deals": owner or collaborator
    if (f.closeYear && String(d.expectedClose || '').slice(0, 4) !== String(f.closeYear)) return false; // A-04 / L-02 close year
    if (f.createdFrom && (d.createdAt || '').slice(0, 10) < f.createdFrom) return false;
    if (
      f.serviceLine &&
      !String(d.serviceLine || '')
        .toLowerCase()
        .includes(String(f.serviceLine).toLowerCase())
    )
      return false; // free text (Nov 13)
    const c = companies.get(d.companyId) || {};
    if (f.industry && c.industry !== f.industry) return false;
    if (f.icpTier && c.icpTier !== f.icpTier) return false;
    if (f.minAmt !== undefined && f.minAmt !== '' && (+d.amount || 0) < +f.minAmt) return false;
    if (f.maxAmt !== undefined && f.maxAmt !== '' && (+d.amount || 0) > +f.maxAmt) return false;
    if (f.closeFrom && (!d.expectedClose || d.expectedClose < f.closeFrom)) return false;
    if (f.closeTo && (!d.expectedClose || d.expectedClose > f.closeTo)) return false;
    if (f.source && d.source !== f.source) return false;
    if (f.partnerId && d.referringPartnerId !== f.partnerId) return false;
    if (f.activity) {
      const days = dayDiff(lastActivity(state, d), today(now));
      if (f.activity === '7' && days > 7) return false;
      if (f.activity === '30' && days > 30) return false;
      if (f.activity === 'stale' && days <= 30) return false;
    }
    return true;
  });
}

/** Flat rows for CSV/Excel export (L-04). */
export function dealExportRows(state, deals, now = new Date()) {
  return deals.map((d) => {
    const c = state.companies.find((x) => x.id === d.companyId) || {};
    return {
      Deal: d.name,
      Company: c.name || '',
      Pipeline: d.pipeline,
      Stage: d.stage,
      'Amount (USD)': +d.amount || 0,
      'Probability %': +d.probability || 0,
      'Weighted (USD)': Math.round(weighted(d)),
      'Expected close': d.expectedClose || '',
      'Expected start': d.expectedStart || '',
      'Duration (months)': d.durationMonths || '',
      Owner: userName(state, d.ownerId),
      'Service line': d.serviceLine || '',
      Industry: c.industry || '',
      Source: d.source || '',
      'Referring partner': companyName(state, d.referringPartnerId),
      'Next step': d.nextStep || '',
      'Next step date': d.nextStepDate || '',
      Competitors: d.competitors || '',
      'Win/loss reason': d.winLossReason || '',
      'Deal type': d.dealType || '',
      Priority: d.priority || '',
      'Days in stage': timeInStage(d, now),
      'Last activity': lastActivity(state, d).slice(0, 10),
    };
  });
}
