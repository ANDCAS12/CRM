// Import engine (D-03, F-02, M-01) including HubSpot-style create-and-update and "don't overwrite".
import { describe, expect, it } from 'vitest';
import { buildPatch, canImport, getPreset, guessMapping, runImport, templateHeader, toNumber } from '../../src/core/importer.js';
import { parseCSV } from '../../src/utils/csv.js';
import { NOW, setup } from './helpers.js';

/** Runs an import from CSV text with auto-guessed mapping. */
function importCsv(t, presetKey, csv, options = {}) {
  const [headers, ...rows] = parseCSV(csv);
  const mapping = guessMapping(getPreset(presetKey), headers);
  return runImport({ api: t.api, store: t.store, user: t.user, presetKey, headers, rows, mapping, options, now: NOW });
}

describe('HubSpot deals', () => {
  it('maps stages, owners and companies, keeps created dates and reports gaps', () => {
    const t = setup();
    const r = importCsv(
      t,
      'hsDeals',
      'Deal Name,Deal Stage,Amount,Close Date,Pipeline,Deal owner,Associated Company,Create Date,Lifecycle\nAcme BI rollout,presentationscheduled,"150,000",12/15/2026,Sales Pipeline,Cristina Vega,Acme Corp,03/02/2026,x\nOld,closedlost,5,2026-01-10,Sales,Nobody,Northwind Foods,2025-11-01,y\n,qualifiedtobuy,1,,,,,,',
    );
    expect(r).toMatchObject({ created: 3, skipped: ['Row 4: no deal name'], unmappedColumns: ['Lifecycle'] }); // 2 deals + new company Acme (Northwind is reused)
    const acme = t.state.deals.find((d) => d.name === 'Acme BI rollout');
    expect(acme).toMatchObject({
      stage: 'Solution design',
      amount: 150000,
      ownerId: 'u_cristina',
      expectedClose: '2026-12-15',
      nextStep: 'Review imported deal',
    });
    expect(acme.createdAt.startsWith('2026-03-02')).toBe(true);
    expect(r.notes).toEqual(expect.arrayContaining(['Owner “Nobody” not found; assigned to you']));
    expect(t.state.deals.find((d) => d.name === 'Old')).toMatchObject({
      stage: 'Closed lost',
      companyId: 'c_northwind',
      winLossReason: 'Imported from HubSpot',
    });
    expect(t.state.imports[0].name).toBe('HubSpot deals 2026-11-11');
  });
  it('maps unknown stages to Lead with a note', () => {
    const t = setup();
    const r = importCsv(t, 'hsDeals', 'Deal Name,Deal Stage\nX,weird');
    expect(t.state.deals.at(-1).stage).toBe('Lead');
    expect(r.notes).toContain('Stage “weird” mapped to Lead');
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
    expect(() => getPreset('nope')).toThrow();
  });
});
