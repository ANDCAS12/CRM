// Import engine (D-03, F-02, M-01) including HubSpot-style create-and-update and "don't overwrite".
import { describe, expect, it } from 'vitest';
import {
  buildPatch,
  canImport,
  getPreset,
  guessMapping,
  icpTierFrom,
  mapHubSpotStage,
  parseDealName,
  revenueBandFrom,
  runImport,
  templateHeader,
  toNumber,
} from '../../src/core/importer.js';
import { parseCSV } from '../../src/utils/csv.js';
import { NOW, setup } from './helpers.js';

/** Runs an import from CSV text with auto-guessed mapping. */
function importCsv(t, presetKey, csv, options = {}) {
  const [headers, ...rows] = parseCSV(csv);
  const mapping = guessMapping(getPreset(presetKey), headers);
  return runImport({ api: t.api, store: t.store, user: t.user, presetKey, headers, rows, mapping, options, now: NOW });
}

describe('HubSpot deals (slides 20 and 21)', () => {
  const HEAD =
    'dealname,dealstage,amount,closedate,pipeline,hubspot_owner_id,createdate,hs_next_step,closed_lost_reason,description,dealtype,hs_priority,hs_deal_stage_probability,Lifecycle,Associated contact';
  it('maps stages one to one, parses Company_Opp NNN_Description, keeps created dates and reports gaps', () => {
    const t = setup();
    const r = importCsv(
      t,
      'hsDeals',
      `${HEAD}\nAcme Corp_Opp 003_BI rollout,Proposal sent (40%),"150,000",12/15/2026,Deals pipeline,Cristina Frieri,03/02/2026,Send pricing,,Wants a phased plan,newbusiness,HIGH,0.4,x,mia.lopez@acme.com\nNorthwind Foods_Opp 011_Old work,Closed lost,5,2026-01-10,Deals pipeline,Nobody,2025-11-01,,No budget,,existingbusiness,LOW,0,y,dana.whitfield@northwindfoods.com\n,Prospect,1,,,,,,,,,,,,\nNorthwind Foods_Opp 012_No contact,Prospect,1,,,,,,,,,,,,`,
    );
    expect(r).toMatchObject({
      skipped: ['Row 4: no deal name', 'Row 5: no associated contact: link one in HubSpot, then export again'],
      unmappedColumns: ['Lifecycle'],
    });
    const acme = t.state.deals.find((d) => d.name === 'BI rollout');
    expect(acme).toMatchObject({
      stage: 'Proposal sent',
      probability: 40,
      amount: 150000,
      ownerId: 'u_cristina',
      expectedClose: '2026-12-15',
      nextStep: 'Send pricing',
      dealType: 'New business',
      priority: 'High',
      hubspotRef: 'Opp 003',
      pipeline: 'Consulting projects',
    });
    expect(t.state.companies.find((c) => c.id === acme.companyId).name).toBe('Acme Corp'); // company from the deal name
    expect(acme.createdAt.startsWith('2026-03-02')).toBe(true);
    expect(t.state.notes.find((n) => n.refId === acme.id).body).toContain('Wants a phased plan'); // description is the first note
    const old = t.state.deals.find((d) => d.name === 'Old work');
    expect(old).toMatchObject({
      stage: 'Closed lost',
      companyId: 'c_northwind',
      primaryContactId: 'p_dana',
      winLossReason: 'No budget',
      dealType: 'Existing business',
      priority: 'Low',
    });
    expect(t.state.contacts.find((p) => p.id === acme.primaryContactId)).toMatchObject({
      name: 'Mia Lopez',
      email: 'mia.lopez@acme.com',
      companyId: acme.companyId,
    }); // unknown email creates the contact
    expect(r.notes).toEqual(expect.arrayContaining(['Owner “Nobody” not found; assigned to you']));
    expect(t.state.imports[0].name).toBe('HubSpot deals 2026-11-11');
  });
  it('skips the Test Pipeline and assigns staffing deals to Data Science as a Service', () => {
    const t = setup();
    const r = importCsv(
      t,
      'hsDeals',
      'Deal Name,Deal Stage,Pipeline,Associated contact\nX_Opp 1_Thing,Suspect,Test Pipeline,a@x.com\nY Co_Opp 2_Two data engineers,Prospect,Deals pipeline,b@y.com',
    );
    expect(r.skipped).toEqual(['Row 2: Test Pipeline, not migrated']);
    expect(t.state.deals.at(-1)).toMatchObject({ name: 'Two data engineers', pipeline: 'Data Science as a Service' });
  });
  it('maps unknown stages to Suspect with a note', () => {
    const t = setup();
    const r = importCsv(t, 'hsDeals', 'Deal Name,Deal Stage,Associated company,Associated contact\nX,weird,Acme,a@acme.com');
    expect(t.state.deals.at(-1).stage).toBe('Suspect');
    expect(r.notes).toContain('Stage “weird” mapped to Suspect');
  });
  it('helpers parse names and stages', () => {
    expect(parseDealName('Altamira Logistics_Opp 003_Network optimization')).toEqual({
      company: 'Altamira Logistics',
      name: 'Network optimization',
      oppRef: 'Opp 003',
    });
    expect(parseDealName('Plain deal')).toEqual({ company: '', name: 'Plain deal', oppRef: '' });
    expect(mapHubSpotStage('Verbal Approval (80%)')).toBe('Verbal Approval');
    expect(mapHubSpotStage('closedwon')).toBe('Closed won');
    expect(mapHubSpotStage('appointmentscheduled')).toBe('');
  });
});

describe('HubSpot companies and contacts (slide 21)', () => {
  it('maps customer lifecycle to Client, ICP tier, revenue band and HQ', () => {
    const t = setup();
    importCsv(
      t,
      'hsCompanies',
      'Company name,Company Domain Name,Type,Lifecycle Stage,Industry,hs_ideal_customer_profile,Number of Employees,Annual Revenue,City,Country/Region\nAltamira Logistics,altamira-logistics.com,PROSPECT,customer,Logistics,tier_1,2000,750000000,Monterrey,Mexico',
    );
    expect(t.state.companies.at(-1)).toMatchObject({
      name: 'Altamira Logistics',
      relationship: 'Client',
      icpTier: 'Tier 1',
      revenueBand: '$500M–$1B',
      hq: 'Monterrey, Mexico',
      employees: 2000,
    });
  });
  it('moves hs_buying_role onto each associated deal', () => {
    const t = setup();
    const r = importCsv(
      t,
      'hsContacts',
      'First Name,Last Name,Email,Associated Company,hs_buying_role,Associated Deal\nLaura,Mendez,laura@northwindfoods.com,Northwind Foods,DECISION_MAKER,Northwind Foods_Opp 001_Northwind FP&A modernization;Ghost deal\nAl,Bo,al@northwindfoods.com,,BLOCKER,',
    );
    const laura = t.state.contacts.find((p) => p.email === 'laura@northwindfoods.com');
    expect(t.state.dealContacts.find((x) => x.contactId === laura.id)).toMatchObject({ dealId: 'd_nw_fpa', role: 'Decision maker' });
    expect(r.notes).toEqual(expect.arrayContaining(['Deal “Ghost deal” not found for buying role', 'Buying role “BLOCKER” not recognised']));
  });
  it('helpers', () => {
    expect(icpTierFrom('tier_2')).toBe('Tier 2');
    expect(icpTierFrom('')).toBe('');
    expect(revenueBandFrom(5e6)).toBe('<$10M');
    expect(revenueBandFrom(2e9)).toBe('$1B+');
    expect(revenueBandFrom('')).toBe('');
  });
});

describe('contacts and companies in one file', () => {
  const csv =
    'First Name,Last Name,Email,Job Title,Company Name,Company Domain Name\nMia,Lopez,mia@apex.com,CMO,Apex Media,apex.com\nLeo,Park,leo@apex.com,CFO,Apex Media,apex.com\nRyan,Hale,ryan@brightside.co,Owner,Brightside Creative,brightside.co';
  it('creates companies once and associates contacts', () => {
    const t = setup();
    const r = importCsv(t, 'contactsCompanies', csv);
    expect(r.recordIds.company).toHaveLength(2);
    expect(r.recordIds.contact).toHaveLength(3);
    const apex = t.state.companies.find((c) => c.domain === 'apex.com');
    expect(t.state.contacts.filter((p) => p.companyId === apex.id).map((p) => p.name)).toEqual(['Mia Lopez', 'Leo Park']);
  });
  it('create-only mode skips existing emails', () => {
    const t = setup();
    importCsv(t, 'contactsCompanies', csv);
    const r = importCsv(t, 'contactsCompanies', csv);
    expect(r.created).toBe(0);
    expect(r.skipped).toHaveLength(3);
  });
  it('create-and-update mode updates existing records', () => {
    const t = setup();
    importCsv(t, 'contactsCompanies', csv);
    const r = importCsv(t, 'contactsCompanies', 'Email,Job Title\nmia@apex.com,Chief Marketing Officer', { mode: 'upsert' });
    expect(r).toMatchObject({ created: 0, updated: 1 });
    expect(t.state.contacts.find((p) => p.email === 'mia@apex.com').title).toBe('Chief Marketing Officer');
  });
  it('"don’t overwrite" keeps existing values', () => {
    const t = setup();
    importCsv(t, 'contactsCompanies', csv);
    importCsv(t, 'contactsCompanies', 'Email,Job Title,Phone\nmia@apex.com,Intern,555', { mode: 'upsert', noOverwrite: ['title'] });
    const mia = t.state.contacts.find((p) => p.email === 'mia@apex.com');
    expect(mia.title).toBe('CMO');
    expect(mia.phone).toBe('555');
  });
  it('auto-associates contacts to an existing company by email domain', () => {
    const t = setup();
    importCsv(t, 'contacts', 'Email,Name\nnew.person@northwindfoods.com,New Person');
    expect(t.state.contacts.at(-1).companyId).toBe('c_northwind');
  });
  it('rejects invalid emails', () => {
    const t = setup();
    expect(importCsv(t, 'contacts', 'Email,Name\nnot-an-email,X').skipped[0]).toMatch(/invalid email/);
  });
});

describe('contract matrix', () => {
  it('parses values, dates, booleans and picklists', () => {
    const t = setup();
    const r = importCsv(
      t,
      'contracts',
      'Contract,Type,Client,Status,Effective date,End date,Notice,Auto-renew,Value\nNew SOW,sow,Northwind Foods,signed,1/1/2026,12/31/2026,30,yes,"$90,000"\nOdd,Letter,Acme,,,,,,',
    );
    expect(r.created).toBe(3); // 2 contracts + Acme company
    const k = t.state.contracts.find((x) => x.name === 'New SOW');
    expect(k).toMatchObject({
      type: 'SOW',
      status: 'Signed',
      companyId: 'c_northwind',
      endDate: '2026-12-31',
      autoRenew: true,
      totalValue: 90000,
      noticeDays: 30,
    });
    expect(r.notes).toContain('Type “Letter” mapped to SOW');
  });
});

describe('notes and tasks', () => {
  it('attaches notes to deals or companies and tasks to deals', () => {
    const t = setup();
    const n = importCsv(t, 'hsNotes', 'Note body,Associated deal,Associated company\nHello,Northwind FP&A modernization,\nCo note,,Vela Pharma\nOrphan,,');
    expect(n).toMatchObject({ created: 2, skipped: ['Row 4: no matching deal or company'] });
    const k = importCsv(t, 'hsTasks', 'Task title,Due date,Status,Associated deal\nCall,2026-12-01,COMPLETED,Northwind FP&A modernization\nOther,,,Ghost deal');
    expect(k.created).toBe(2);
    expect(t.state.tasks.find((x) => x.title === 'Call')).toMatchObject({ done: true, refId: 'd_nw_fpa' });
    expect(k.notes).toContain('Deal “Ghost deal” not found; task left unlinked');
  });
});

describe('importer rules', () => {
  it('only permitted roles can import', () => {
    expect(canImport({ role: 'gtm' }, 'contacts')).toBe(true);
    expect(canImport({ role: 'gtm' }, 'hsDeals')).toBe(false);
    expect(canImport({ role: 'finance' }, 'contacts')).toBe(false);
    const t = setup();
    t.as('u_alejandro');
    expect(() => importCsv(t, 'contacts', 'Email\na@b.co')).toThrow(/can’t run/);
  });
  it('audits each import', () => {
    const t = setup();
    importCsv(t, 'companies', 'Company Name,Domain\nZed,zed.io');
    expect(t.state.audit[0]).toMatchObject({ action: 'import', entity: 'import' });
  });
  it('helpers', () => {
    expect(toNumber('$1,200')).toBe(1200);
    expect(toNumber('abc')).toBe('');
    expect(buildPatch({ a: 'x', b: '' }, { a: 'y', b: 'z', c: '' }, ['a'])).toEqual({ b: 'z' });
    expect(templateHeader(getPreset('hsTasks'))[0]).toBe('Task Title');
    expect(getPreset('hsContacts').label).toBe('HubSpot contacts');
    expect(getPreset('hsCompanies').fields.length).toBeGreaterThan(5);
    expect(() => getPreset('nope')).toThrow();
  });
});

describe('HubSpot emails, calls and meetings (slide 21)', () => {
  it('puts calls and meetings on the timeline and emails as notes', () => {
    const t = setup();
    const r = importCsv(
      t,
      'hsActivities',
      'Activity type,Subject,Body,Activity date,Duration,Associated deal,Associated company\nCall,Pricing follow-up,Dana asked for two options,2026-10-02,25,Northwind Foods_Opp 001_Northwind FP&A modernization,\nEmail,Revised SOW,Attached the redlines,2026-10-03,,,Vela Pharma\nMeeting,QBR,,2026-10-04,60,,Nowhere Inc',
    );
    expect(r.created).toBe(2);
    expect(r.skipped).toEqual(['Row 4: no matching deal or company']);
    expect(t.state.calls.at(-1)).toMatchObject({ title: 'Pricing follow-up', dealId: 'd_nw_fpa', durationMin: 25, source: 'hubspot', matched: true });
    expect(t.state.calls.at(-1).date.startsWith('2026-10-02')).toBe(true);
    expect(t.state.notes.at(-1)).toMatchObject({ refType: 'company', refId: 'c_vela' });
    expect(t.state.notes.at(-1).body).toContain('Email: Revised SOW');
  });
});

describe('contract matrix billing schedule (slide 19)', () => {
  it('imports the billing schedule column', () => {
    const t = setup();
    importCsv(t, 'contracts', 'Contract,Client,Billing schedule\nNew SOW,Northwind Foods,"Monthly, first business day"');
    expect(t.state.contracts.at(-1)).toMatchObject({ name: 'New SOW', billingSchedule: 'Monthly, first business day' });
  });
});

describe('Nov 18: 11 industries and new company fields', () => {
  it('maps HubSpot industry values and keeps unmatched ones as sub-industry', () => {
    const t = setup();
    const r = importCsv(
      t,
      'hsCompanies',
      'Company name,Company Domain Name,Industry,City,State/Region,Postal code,Description,LinkedIn company page\nOrion,orion.com,COMPUTER_SOFTWARE,Columbus,OH,43215,Regional distributor,https://linkedin.com/company/orion\nZeta,zeta.com,Insurance,,,,,',
    );
    expect(t.state.companies.find((c) => c.name === 'Orion')).toMatchObject({
      industry: 'SaaS',
      city: 'Columbus',
      state: 'OH',
      postalCode: '43215',
      description: 'Regional distributor',
      linkedinUrl: 'https://linkedin.com/company/orion',
    });
    expect(t.state.companies.find((c) => c.name === 'Zeta')).toMatchObject({ industry: '', subIndustry: 'Insurance' });
    expect(r.notes.join(' ')).toContain('matches none of the 11 IK industries');
  });
  it('maps HubSpot task types', () => {
    const t = setup();
    importCsv(t, 'hsTasks', 'Task title,Due date,Task type\nCall Dana,2026-12-01,CALL\nSend deck,2026-12-02,EMAIL\nPrep,2026-12-03,TODO');
    expect(t.state.tasks.slice(-3).map((x) => x.type)).toEqual(['Call', 'Email', 'To-do']);
  });
});
