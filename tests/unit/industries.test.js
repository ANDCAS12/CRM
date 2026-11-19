import { describe, expect, it } from 'vitest';
import { mapIndustry } from '../../src/core/industries.js';

describe('mapIndustry (Nov 18: the 11 IK industries)', () => {
  it.each([
    ['CPG', 'CPG'],
    ['FOOD_BEVERAGES', 'CPG'],
    ['Consumer Goods', 'CPG'],
    ['RETAIL', 'Retail & e-Commerce'],
    ['LOGISTICS_AND_SUPPLY_CHAIN', 'Logistics & Transportation'],
    ['Airlines/Aviation', 'Logistics & Transportation'],
    ['MACHINERY', 'Manufacturing'],
    ['SEMICONDUCTORS', 'High Tech & Semiconductor'],
    ['UTILITIES', 'Energy & Utilities'],
    ['OIL_ENERGY', 'Oil & Gas'],
    ['AUTOMOTIVE', 'Automotive'],
    ['HOSPITAL_HEALTH_CARE', 'Life Sciences & Healthcare'],
    ['PHARMACEUTICALS', 'Life Sciences & Healthcare'],
    ['COMPUTER_SOFTWARE', 'SaaS'],
    ['VENTURE_CAPITAL_PRIVATE_EQUITY', 'Private Equity'],
    ['Insurance', ''],
    ['', ''],
  ])('%s -> %s', (input, expected) => expect(mapIndustry(input)).toBe(expected));
});
