/**
 * @file Maps free-text or HubSpot industry values onto the 11 IK industries (Nov 18, M-01).
 * HubSpot exports either labels ("Computer Software") or enum codes ("COMPUTER_SOFTWARE"); both are matched
 * by keywords. Anything that doesn't match returns '' so the importer can report it.
 */
import { INDUSTRIES } from '../config/constants.js';

/** Ordered keyword rules: the first match wins, so specific terms come before broad ones. */
const RULES = [
  [/private.?equity|venture|investment management|capital markets/, 'Private Equity'],
  [/oil|gas|petrol/, 'Oil & Gas'],
  [/automotive|auto parts|vehicle/, 'Automotive'],
  [/semiconductor|computer hardware|electronics|high.?tech|telecom/, 'High Tech & Semiconductor'],
  [/software|saas|internet|information technology|it services|computer/, 'SaaS'],
  [/health|hospital|pharma|biotech|medical|life science|clinical/, 'Life Sciences & Healthcare'],
  [/energy|utilit|renewable|power|electric/, 'Energy & Utilities'],
  [/logistic|transport|supply chain|freight|shipping|airline|aviation|trucking|railroad|warehous|3pl|distribution/, 'Logistics & Transportation'],
  [/retail|e-?commerce|apparel|fashion|wholesale/, 'Retail & e-Commerce'],
  [/consumer goods|cpg|food|beverage|cosmetic|household|tobacco|dairy|packaged/, 'CPG'],
  [/manufactur|industrial|machinery|chemical|plastics|paper|packaging|mechanical|materials|steel|mining/, 'Manufacturing'],
];

/** Returns one of the 11 IK industries, or '' when nothing matches. */
export function mapIndustry(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const exact = INDUSTRIES.find((i) => i.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const text = raw.toLowerCase().replace(/_/g, ' ');
  return RULES.find(([re]) => re.test(text))?.[1] || '';
}
