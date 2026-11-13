/**
 * @file CSV/Excel import engine (D-03, F-02, M-01). Pure logic: the UI only collects
 * headers, rows and the column mapping, then calls `runImport`.
 *
 * Features from the HubSpot setup flow that the build prompt covers:
 *  - column-to-property mapping with auto-guess
 *  - "create" or "create and update" mode (match contacts by email, companies by domain/name)
 *  - per-property "don't overwrite" on updates
 *  - one file creating companies and contacts together, with associations
 *  - a summary of created / updated / skipped rows and unmapped columns
 */
import {
  BILLING_MODELS,
  CLOSED_STAGES,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  DEAL_TYPES,
  DEFAULT_STAGE,
  LEGACY_PIPELINE_MAP,
  PIPELINES,
  PRIORITIES,
  RELATIONSHIP_TYPES,
  SOURCES,
  STAGES,
  STAGE_PROBABILITY,
} from '../config/constants.js';
import { addDays, today, toISODate } from '../utils/dates.js';
import { domainOf, esc, normalizeDomain } from '../utils/format.js';
import { PermissionError } from './errors.js';
import { findUser } from './lookups.js';

/**
 * IK's HubSpot stages carry over one to one (build brief, slide 20). Keys are lower-cased labels
 * and internal ids, with or without the probability suffix HubSpot shows, e.g. "Proposal sent (40%)".
 */
export const HUBSPOT_STAGE_MAP = Object.freeze({
  'on hold': 'On Hold',
  partners: 'Partners',
  suspect: 'Suspect',
  prospect: 'Prospect',
  'proposal sent': 'Proposal sent',
  'verbal approval': 'Verbal Approval',
  'contract sent': 'Contract Sent',
  contractsent: 'Contract Sent',
  'closed won': 'Closed won',
  closedwon: 'Closed won',
  'closed lost': 'Closed lost',
  closedlost: 'Closed lost',
});

/** Maps a HubSpot stage label to a Central Kitchen stage, ignoring a trailing "(40%)". */
export const mapHubSpotStage = (value) =>
  HUBSPOT_STAGE_MAP[
    String(value || '')
      .toLowerCase()
      .replace(/\(\s*\d+\s*%\s*\)/, '')
      .trim()
  ] || '';

/**
 * Splits IK's HubSpot naming convention "Company_Opp NNN_Description" into company and deal name.
 * Names that don't follow the convention are returned unchanged.
 */
export function parseDealName(raw) {
  const m = String(raw || '').match(/^(.+?)_(Opp\s*\d+)_(.+)$/i);
  return m ? { company: m[1].trim(), name: m[3].trim(), oppRef: m[2].replace(/\s+/, ' ') } : { company: '', name: String(raw || '').trim(), oppRef: '' };
}

/** HubSpot pipelines that must not be migrated (slide 20). */
export const SKIPPED_PIPELINES = Object.freeze(['test pipeline']);

/** Reads HubSpot probability as either 0.4 or 40. */
const toProbability = (v) => {
  const n = toNumber(v);
  if (n === '') return '';
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
};

/** Parses money/number cells such as "$150,000" ('' when not numeric). */
export const toNumber = (v) => {
  if (v === '' || v === null || v === undefined) return '';
  const n = +String(v).replace(/[$,\s]/g, '');
  return Number.isNaN(n) ? '' : n;
};

/** Case-insensitive pick from a picklist, or '' when absent. */
const pickFrom = (list, v) =>
  list.find(
    (x) =>
      x.toLowerCase() ===
      String(v || '')
        .toLowerCase()
        .trim(),
  ) || '';

/** Who may run each import (§3: Admin manages migration; GTM owns contacts and companies). */
const IMPORT_ROLES = Object.freeze({
  contacts: ['admin', 'gtm'],
  companies: ['admin', 'gtm'],
  contactsCompanies: ['admin', 'gtm'],
  contracts: ['admin'],
  hsDeals: ['admin'],
  hsCompanies: ['admin'],
  hsContacts: ['admin'],
  hsNotes: ['admin'],
  hsTasks: ['admin'],
});

/** Whether a user may run a given import preset. */
export const canImport = (user, presetKey) => Boolean(user && (IMPORT_ROLES[presetKey] || []).includes(user.role));

/* ---------- column definitions shared by presets ---------- */
const CONTACT_COLS = [
  ['name', 'Full name', ['name', 'full name', 'contact name']],
  ['firstName', 'First name', ['first name', 'firstname']],
  ['lastName', 'Last name', ['last name', 'lastname']],
  ['email', 'Email', ['email', 'email address']],
  ['title', 'Job title', ['title', 'job title']],
  ['phone', 'Phone number', ['phone', 'phone number', 'mobile', 'mobile phone number']],
  ['linkedin', 'LinkedIn', ['linkedin', 'linkedin url']],
  ['location', 'Location', ['location', 'city', 'country/region']],
  ['owner', 'Contact owner', ['owner', 'contact owner']],
];
const COMPANY_COLS = [
  ['companyName', 'Company name', ['company', 'company name', 'associated company']],
  ['domain', 'Company domain name', ['domain', 'company domain name', 'website', 'website url']],
  ['industry', 'Industry', ['industry']],
  ['hq', 'HQ location', ['hq', 'company city', 'hq location']],
  ['employees', 'Employees', ['employees', 'number of employees']],
  ['relationship', 'Relationship type', ['relationship', 'type', 'lifecycle stage']],
];

/**
 * Builds an update patch that respects "don't overwrite": a listed field keeps any existing value.
 * Empty incoming values never blank out existing data.
 */
export function buildPatch(existing, incoming, noOverwrite = []) {
  const patch = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v === '' || v === undefined || v === null) continue; // never erase data with blanks
    const has = existing[k] !== '' && existing[k] !== undefined && existing[k] !== null;
    if (noOverwrite.includes(k) && has) continue; // user ticked "don't overwrite" for this property
    patch[k] = v;
  }
  return patch;
}

/** HubSpot ICP values ("tier_1", "Tier 1", "1") to Central Kitchen ICP tiers. */
export const icpTierFrom = (v) => {
  const m = String(v || '').match(/([123])/);
  return m ? `Tier ${m[1]}` : '';
};

/** Annual revenue in USD to the company revenue bands. */
export function revenueBandFrom(v) {
  const n = toNumber(v);
  if (n === '' || n <= 0) return '';
  const bands = [
    [10e6, '<$10M'],
    [50e6, '$10M–$50M'],
    [100e6, '$50M–$100M'],
    [250e6, '$100M–$250M'],
    [500e6, '$250M–$500M'],
    [1e9, '$500M–$1B'],
  ];
  return bands.find(([max]) => n < max)?.[1] || '$1B+';
}

/** HubSpot buying-role codes and labels (lower-cased, letters only) to Central Kitchen buying roles (D-02). */
const HUBSPOT_BUYING_ROLES = Object.freeze({
  champion: 'Champion',
  decisionmaker: 'Decision maker',
  budgetholder: 'Decision maker',
  executivesponsor: 'Decision maker',
  influencer: 'Influencer',
  procurement: 'Procurement',
  legal: 'Legal',
  legalandcompliance: 'Legal',
});

/** Tags a contact on deals named in a HubSpot "Associated Deal" cell with their buying role (D-02). */
function tagBuyingRoles(ctx, contactId, dealNames, role) {
  if (!role) return;
  const buyingRole =
    HUBSPOT_BUYING_ROLES[
      String(role)
        .toLowerCase()
        .replace(/[^a-z]/g, '')
    ]; // "DECISION_MAKER" -> "decisionmaker"
  if (!buyingRole) return ctx.note(`Buying role “${role}” not recognised`);
  for (const raw of String(dealNames || '')
    .split(/[;|]/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const target = parseDealName(raw).name.toLowerCase(); // accept "Company_Opp 003_Name" or the plain name
    const deal = ctx.state.deals.find((d) => d.name.toLowerCase() === target || d.name.toLowerCase() === raw.toLowerCase());
    if (!deal) {
      ctx.note(`Deal “${raw}” not found for buying role`);
      continue;
    }
    if (ctx.state.dealContacts.some((x) => x.dealId === deal.id && x.contactId === contactId)) continue; // already tagged
    ctx.api.create('dealContact', { dealId: deal.id, contactId, role: buyingRole }, { system: true, persist: false }); // role lives on the deal link
  }
}

/* ---------- row handlers ---------- */

/** Creates or updates a company from row values; returns its id. */
function upsertCompany(ctx, r) {
  const name = String(r.companyName || '').trim();
  const domain = normalizeDomain(r.domain);
  if (!name && !domain) return '';
  const existing = (domain && ctx.idx.companyByDomain.get(domain)) || (name && ctx.idx.companyByName.get(name.toLowerCase())); // domain is the stronger key
  // HubSpot: type (PROSPECT, PARTNER, VENDOR…) plus lifecyclestage "customer" means Client (slide 21).
  const lifecycle = String(r.lifecycle || '').toLowerCase();
  const relationship = lifecycle.includes('customer')
    ? 'Client'
    : pickFrom(RELATIONSHIP_TYPES, r.relationship) ||
      (String(r.relationship || '')
        .toLowerCase()
        .includes('customer')
        ? 'Client'
        : '');
  const data = {
    name,
    domain,
    industry: r.industry || '',
    hq: r.hq || [r.city, r.country].filter(Boolean).join(', '),
    employees: toNumber(r.employees),
    relationship,
    icpTier: icpTierFrom(r.icp),
    revenueBand: revenueBandFrom(r.revenue),
  };
  if (r.industry && !ctx.state.settings.industries.includes(r.industry)) ctx.note(`Industry “${r.industry}” kept as text`);
  if (existing) {
    if (ctx.mode !== 'upsert') return existing.id; // create-only mode links to the existing company without changing it
    const patch = buildPatch(existing, data, ctx.noOverwrite);
    if (Object.keys(patch).length) ctx.api.update('company', existing.id, patch, { system: true, persist: false });
    ctx.track('company', existing.id, 'updated');
    return existing.id;
  }
  const rec = ctx.api.create(
    'company',
    { ...data, name: name || domain, relationship: relationship || 'Prospect', ownerId: ctx.userId },
    { system: true, persist: false },
  );
  ctx.idx.addCompany(rec); // later rows in the same file must find it
  ctx.track('company', rec.id, 'created');
  return rec.id;
}

/** Creates or updates a contact; links it to a company from the row or by email domain. */
function upsertContact(ctx, r, companyId = '') {
  const name = r.name || [r.firstName, r.lastName].filter(Boolean).join(' ').trim();
  const email = String(r.email || '')
    .trim()
    .toLowerCase();
  if (!name && !email) throw new Error('no name or email');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error(`invalid email “${email}”`);
  let cid = companyId;
  if (!cid && email) cid = ctx.idx.companyByDomain.get(domainOf(email))?.id || ''; // auto-associate by email domain
  const owner = findUser(ctx.state, r.owner);
  if (r.owner && !owner) ctx.note(`Owner “${r.owner}” not found; assigned to you`);
  const data = { name, email, title: r.title || '', phone: r.phone || '', linkedin: r.linkedin || '', location: r.location || '', companyId: cid };
  const existing = email && ctx.idx.contactByEmail.get(email);
  if (existing) {
    if (ctx.mode !== 'upsert') throw new Error(`duplicate email ${email}`); // create-only mode skips known emails
    const patch = buildPatch(existing, data, ctx.noOverwrite);
    if (Object.keys(patch).length) ctx.api.update('contact', existing.id, patch, { system: true, persist: false });
    ctx.track('contact', existing.id, 'updated');
    return existing.id;
  }
  const rec = ctx.api.create(
    'contact',
    {
      ...data,
      name: name || email,
      ownerId: owner?.id || ctx.userId,
      source: '',
      doNotContact: false,
      previousCompanies: '',
      seniority: '',
      function: '',
      timezone: '',
    },
    { system: true, persist: false },
  );
  ctx.idx.addContact(rec);
  ctx.track('contact', rec.id, 'created');
  return rec.id;
}

/** Converts a "created" cell into an ISO timestamp, keeping HubSpot's original date (M-01). */
const createdAtFrom = (v, now) => (toISODate(v) ? new Date(`${toISODate(v)}T12:00:00`).toISOString() : now.toISOString());

/* ---------- presets ---------- */

/**
 * Import presets. `fields` = [key, label, header aliases]; `row` writes one row.
 * `modes` lists supported modes; presets without it are create-only.
 */
export const PRESETS = Object.freeze({
  contacts: {
    label: 'Contacts',
    object: 'contact',
    modes: ['create', 'upsert'],
    fields: CONTACT_COLS.concat([['companyName', 'Company name', ['company', 'company name']]]),
    row: (ctx, r) => upsertContact(ctx, r, r.companyName ? upsertCompany(ctx, { companyName: r.companyName }) : ''),
  },
  companies: {
    label: 'Companies',
    object: 'company',
    modes: ['create', 'upsert'],
    fields: COMPANY_COLS,
    row: (ctx, r) => {
      if (!upsertCompany(ctx, r)) throw new Error('no company name or domain');
    },
  },
  contactsCompanies: {
    label: 'Contacts and companies (one file)',
    object: 'contact',
    modes: ['create', 'upsert'],
    fields: CONTACT_COLS.concat(COMPANY_COLS),
    row: (ctx, r) => upsertContact(ctx, r, upsertCompany(ctx, r)),
  },
  contracts: {
    label: 'Contract matrix',
    object: 'contract',
    fields: [
      ['name', 'Contract name', ['contract', 'contract name', 'name']],
      ['type', 'Type', ['type', 'contract type']],
      ['companyName', 'Client', ['client', 'company', 'customer']],
      ['status', 'Status', ['status']],
      ['effectiveDate', 'Effective date', ['effective date', 'start date', 'effective']],
      ['endDate', 'End date', ['end date', 'expiry', 'expiration date']],
      ['noticeDays', 'Notice period (days)', ['notice', 'notice period', 'notice days']],
      ['autoRenew', 'Auto-renew', ['auto-renew', 'auto renew', 'autorenew']],
      ['totalValue', 'Total value', ['value', 'total value', 'tcv', 'amount']],
      ['billingModel', 'Billing model', ['billing', 'billing model']],
      ['paymentTerms', 'Payment terms', ['payment terms', 'terms']],
      ['ikSignatory', 'IK signatory', ['ik signatory']],
      ['clientSignatory', 'Client signatory', ['client signatory']],
      ['fileUrl', 'File link', ['file', 'link', 'file link', 'url']],
    ],
    row(ctx, r) {
      if (!r.name) throw new Error('no contract name');
      const type = pickFrom(CONTRACT_TYPES, r.type) || 'SOW';
      if (r.type && !pickFrom(CONTRACT_TYPES, r.type)) ctx.note(`Type “${r.type}” mapped to SOW`);
      const rec = ctx.api.create(
        'contract',
        {
          name: r.name,
          type,
          companyId: upsertCompany(ctx, { companyName: r.companyName }),
          dealIds: [],
          parentMsaId: '',
          status: pickFrom(CONTRACT_STATUSES, r.status) || 'Signed',
          effectiveDate: toISODate(r.effectiveDate),
          endDate: toISODate(r.endDate),
          noticeDays: toNumber(r.noticeDays) || 0,
          autoRenew: /^(y|yes|true|1)$/i.test(String(r.autoRenew || '')),
          totalValue: toNumber(r.totalValue) || 0,
          billingModel: pickFrom(BILLING_MODELS, r.billingModel),
          paymentTerms: r.paymentTerms || '',
          ikSignatory: r.ikSignatory || '',
          clientSignatory: r.clientSignatory || '',
          renewalOwnerId: ctx.userId,
          fileUrl: r.fileUrl || '',
        },
        { system: true, persist: false },
      );
      ctx.track('contract', rec.id, 'created');
    },
  },
  hsDeals: {
    label: 'HubSpot deals',
    object: 'deal',
    fields: [
      ['name', 'Deal name', ['deal name', 'dealname', 'name']],
      ['stage', 'Deal stage', ['deal stage', 'dealstage', 'stage']],
      ['amount', 'Amount', ['amount']],
      ['close', 'Close date', ['close date', 'closedate']],
      ['pipeline', 'Pipeline', ['pipeline']],
      ['probability', 'Probability', ['deal probability', 'hs_deal_stage_probability', 'probability']],
      ['owner', 'Deal owner', ['deal owner', 'hubspot_owner_id', 'owner', 'hubspot owner']],
      ['companyName', 'Associated company', ['associated company', 'company', 'company name']],
      ['created', 'Create date', ['create date', 'createdate', 'created date', 'created at']],
      ['source', 'Source', ['original source', 'source', 'deal source']],
      ['nextStep', 'Next step', ['next step', 'hs_next_step']],
      ['wonReason', 'Closed won reason', ['closed won reason', 'closed_won_reason']],
      ['lostReason', 'Closed lost reason', ['closed lost reason', 'closed_lost_reason']],
      ['description', 'Deal description', ['deal description', 'description']],
      ['dealType', 'Deal type', ['deal type', 'dealtype']],
      ['priority', 'Priority', ['priority', 'hs_priority']],
    ],
    row(ctx, r) {
      if (!r.name) throw new Error('no deal name');
      if (
        SKIPPED_PIPELINES.includes(
          String(r.pipeline || '')
            .toLowerCase()
            .trim(),
        )
      )
        throw new Error('Test Pipeline, not migrated'); // slide 20
      const parsed = parseDealName(r.name); // Company_Opp NNN_Description
      let stage = mapHubSpotStage(r.stage) || pickFrom(STAGES, r.stage);
      if (!stage) {
        stage = DEFAULT_STAGE;
        if (r.stage) ctx.note(`Stage “${r.stage}” mapped to ${DEFAULT_STAGE}`);
      }
      // HubSpot's single "Sales Pipeline" / "Deals pipeline" is split per deal: staffing language goes to Staff augmentation (assigned per deal, slide 20).
      const pl = String(r.pipeline || '');
      const staffing = /data science as a service|dsaas|staff|aug|engineer|developer|analyst|contractor/i.test(`${pl} ${parsed.name} ${r.description || ''}`);
      const pipeline = pickFrom(PIPELINES, pl) || LEGACY_PIPELINE_MAP[pl] || (staffing ? 'Data Science as a Service' : 'Consulting projects');
      if (!pickFrom(PIPELINES, pl) && !LEGACY_PIPELINE_MAP[pl]) ctx.note(`Pipeline assigned from deal wording; check “${parsed.name}” is in ${pipeline}`);
      const owner = findUser(ctx.state, r.owner);
      if (r.owner && !owner) ctx.note(`Owner “${r.owner}” not found; assigned to you`);
      const ownerId = owner?.id || ctx.userId;
      const createdAt = createdAtFrom(r.created, ctx.now); // preserve HubSpot created date
      const open = !CLOSED_STAGES.includes(stage);
      if (open && !r.nextStep) ctx.note(`“${parsed.name}” given a placeholder next step`); // B-09 needs one
      const reason = stage === 'Closed won' ? r.wonReason : stage === 'Closed lost' ? r.lostReason : '';
      const typeKey = String(r.dealType || '')
        .toLowerCase()
        .replace(/[\s_]/g, '');
      const dealType = typeKey.startsWith('new') ? 'New business' : typeKey.startsWith('existing') ? 'Existing business' : pickFrom(DEAL_TYPES, r.dealType);
      const rec = ctx.api.create(
        'deal',
        {
          name: parsed.name,
          companyId: upsertCompany(ctx, { companyName: r.companyName || parsed.company || 'Unknown company' }),
          ownerId,
          pipeline,
          stage,
          dealType,
          priority: pickFrom(PRIORITIES, r.priority),
          amount: toNumber(r.amount),
          probability: toProbability(r.probability) === '' ? STAGE_PROBABILITY[stage] : toProbability(r.probability),
          expectedClose: toISODate(r.close),
          expectedStart: '',
          durationMonths: '',
          serviceLine: '',
          source: pickFrom(SOURCES, r.source),
          referringPartnerId: '',
          primaryContactId: '',
          decisionMakerId: '',
          championId: '',
          nextStep: r.nextStep || (open ? 'Review imported deal' : ''),
          nextStepDate: open ? addDays(today(ctx.now), 7) : '',
          competitors: '',
          winLossReason: open ? '' : reason || 'Imported from HubSpot',
          folderUrl: '',
          collaborators: [],
          hubspotRef: parsed.oppRef,
          createdAt,
          stageHistory: [{ stage, at: createdAt, by: ownerId }],
        },
        { system: true, persist: false },
      );
      ctx.track('deal', rec.id, 'created');
      if (r.description) {
        const note = ctx.api.create(
          'note',
          { refType: 'deal', refId: rec.id, body: `<p>${esc(r.description)}</p>`, by: ownerId, createdAt },
          { system: true, persist: false },
        ); // description becomes the first note
        ctx.track('note', note.id, 'created');
      }
    },
  },
  hsCompanies: {
    label: 'HubSpot companies',
    object: 'company',
    modes: ['create', 'upsert'],
    fields: [
      ['companyName', 'Company name', ['company name', 'name']],
      ['domain', 'Company domain name', ['company domain name', 'domain', 'website url']],
      ['relationship', 'Type', ['type']],
      ['lifecycle', 'Lifecycle stage', ['lifecycle stage', 'lifecyclestage']],
      ['industry', 'Industry', ['industry']],
      ['icp', 'Ideal customer profile tier', ['ideal customer profile tier', 'hs_ideal_customer_profile', 'icp tier']],
      ['employees', 'Number of employees', ['number of employees', 'numberofemployees']],
      ['revenue', 'Annual revenue', ['annual revenue', 'annualrevenue']],
      ['city', 'City', ['city']],
      ['country', 'Country/Region', ['country/region', 'country']],
    ],
    row: (ctx, r) => {
      if (!upsertCompany(ctx, r)) throw new Error('no company name or domain');
    },
  },
  hsContacts: {
    label: 'HubSpot contacts',
    object: 'contact',
    modes: ['create', 'upsert'],
    fields: [
      ['firstName', 'First name', ['first name', 'firstname']],
      ['lastName', 'Last name', ['last name', 'lastname']],
      ['email', 'Email', ['email']],
      ['phone', 'Phone number', ['phone number', 'phone']],
      ['title', 'Job title', ['job title', 'jobtitle']],
      ['companyName', 'Associated company', ['associated company', 'company name']],
      ['owner', 'Contact owner', ['contact owner', 'hubspot_owner_id']],
      ['buyingRole', 'Buying role', ['buying role', 'hs_buying_role']],
      ['deals', 'Associated deal', ['associated deal', 'associated deals']],
    ],
    row: (ctx, r) => {
      const id = upsertContact(ctx, r, r.companyName ? upsertCompany(ctx, { companyName: r.companyName }) : '');
      tagBuyingRoles(ctx, id, r.deals, r.buyingRole); // hs_buying_role moves to each deal (slide 21)
    },
  },
  hsNotes: {
    label: 'HubSpot notes',
    object: 'note',
    fields: [
      ['body', 'Note body', ['note body', 'body', 'note', 'activity body']],
      ['created', 'Create date', ['create date', 'created', 'activity date']],
      ['deal', 'Associated deal', ['associated deal', 'deal', 'deal name']],
      ['companyName', 'Associated company', ['associated company', 'company']],
      ['owner', 'Created by', ['created by', 'activity assigned to', 'owner']],
    ],
    row(ctx, r) {
      if (!r.body) throw new Error('empty note');
      const deal = r.deal && ctx.state.deals.find((d) => d.name.toLowerCase() === String(r.deal).toLowerCase());
      const company = !deal && ctx.idx.companyByName.get(String(r.companyName || '').toLowerCase());
      if (!deal && !company) throw new Error('no matching deal or company');
      const rec = ctx.api.create(
        'note',
        {
          refType: deal ? 'deal' : 'company',
          refId: deal ? deal.id : company.id,
          body: `<p>${esc(r.body)}</p>`,
          by: findUser(ctx.state, r.owner)?.id || ctx.userId,
          createdAt: createdAtFrom(r.created, ctx.now),
        },
        { system: true, persist: false },
      );
      ctx.track('note', rec.id, 'created');
    },
  },
  hsTasks: {
    label: 'HubSpot tasks',
    object: 'task',
    fields: [
      ['title', 'Task title', ['task title', 'title', 'subject']],
      ['due', 'Due date', ['due date', 'due']],
      ['assignee', 'Assigned to', ['assigned to', 'task owner', 'owner']],
      ['status', 'Status', ['status', 'task status']],
      ['deal', 'Associated deal', ['associated deal', 'deal']],
    ],
    row(ctx, r) {
      if (!r.title) throw new Error('no title');
      const deal = r.deal && ctx.state.deals.find((d) => d.name.toLowerCase() === String(r.deal).toLowerCase());
      if (r.deal && !deal) ctx.note(`Deal “${r.deal}” not found; task left unlinked`);
      const due = toISODate(r.due) || today(ctx.now);
      const rec = ctx.api.create(
        'task',
        {
          title: r.title,
          dueDate: due,
          assigneeId: findUser(ctx.state, r.assignee)?.id || ctx.userId,
          reminderDate: due,
          emailReminder: false,
          done: /complete|done/i.test(r.status || ''),
          refType: deal ? 'deal' : '',
          refId: deal ? deal.id : '',
        },
        { system: true, persist: false },
      );
      ctx.track('task', rec.id, 'created');
    },
  },
});

/** Resolves alias presets (e.g. HubSpot contacts uses the contacts preset). */
export function getPreset(key) {
  const p = PRESETS[key];
  if (!p) throw new Error(`Unknown import type: ${key}`);
  return p.alias ? { ...PRESETS[p.alias], label: p.label, key } : { ...p, key };
}

/** Auto-maps file headers to preset fields by alias; returns {fieldKey: columnIndex}. */
export function guessMapping(preset, headers) {
  const lower = headers.map((h) => String(h).trim().toLowerCase());
  const mapping = {};
  const used = new Set(); // one column maps to at most one field
  for (const [key, , aliases] of preset.fields) {
    const idx = lower.findIndex((h, i) => !used.has(i) && aliases.includes(h));
    if (idx >= 0) {
      mapping[key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

/** Lookup indexes so each row is O(1) instead of scanning all records (matters at 10k+ rows). */
function buildIndexes(state) {
  const companyByDomain = new Map();
  const companyByName = new Map();
  const contactByEmail = new Map();
  const addCompany = (c) => {
    if (c.domain) companyByDomain.set(c.domain, c);
    companyByName.set(c.name.toLowerCase(), c);
  };
  const addContact = (p) => p.email && contactByEmail.set(p.email.toLowerCase(), p);
  state.companies.forEach(addCompany);
  state.contacts.forEach(addContact);
  return { companyByDomain, companyByName, contactByEmail, addCompany, addContact };
}

/**
 * Runs an import.
 * @param {{api:object, store:object, user:object, presetKey:string, headers:string[], rows:any[][], mapping:Record<string,number>,
 *   options?:{mode?:'create'|'upsert', noOverwrite?:string[], name?:string, fileName?:string}, now?:Date}} args
 * @returns {{id:string, name:string, created:number, updated:number, skipped:string[], notes:string[], unmappedColumns:string[], recordIds:Record<string,string[]>}}
 */
export function runImport({ api, store, user, presetKey, headers, rows, mapping, options = {}, now = new Date() }) {
  if (!canImport(user, presetKey)) throw new PermissionError('Your role can’t run this import.');
  const preset = getPreset(presetKey);
  const state = store.state;
  const report = { created: 0, updated: 0, skipped: [], notes: new Set(), recordIds: {} };
  const seen = new Map(); // `${type}:${id}` -> action, so a record touched twice counts once
  const ctx = {
    api,
    state,
    now,
    userId: user.id,
    idx: buildIndexes(state),
    mode: (preset.modes || ['create']).includes(options.mode) ? options.mode : 'create',
    noOverwrite: options.noOverwrite || [],
    note: (n) => report.notes.add(n),
    track(type, id, action) {
      const key = `${type}:${id}`;
      if (seen.has(key)) return; // already counted in this import
      seen.set(key, action);
      report.recordIds[type] = report.recordIds[type] || [];
      report.recordIds[type].push(id);
      report[action] += 1;
    },
  };
  rows.forEach((row, i) => {
    const r = {};
    for (const [key, col] of Object.entries(mapping)) {
      const v = row[col];
      r[key] = v === null || v === undefined ? '' : typeof v === 'string' ? v.trim() : v; // trim text, keep numbers (Excel serials)
    }
    try {
      preset.row(ctx, r);
    } catch (e) {
      report.skipped.push(`Row ${i + 2}: ${e.message}`); // +2 = header row + 1-based numbering
    }
  });
  const used = new Set(Object.values(mapping));
  const entry = {
    id: `im_${now.getTime().toString(36)}`,
    name: options.name || `${preset.label} ${today(now)}`,
    preset: presetKey,
    label: preset.label,
    file: options.fileName || '',
    mode: ctx.mode,
    created: report.created,
    updated: report.updated,
    skipped: report.skipped.length,
    unmappedColumns: headers.filter((_, i) => !used.has(i)),
    recordIds: report.recordIds,
    at: now.toISOString(),
    by: user.id,
  };
  state.imports.unshift(entry); // past imports list
  api.audit('import', 'import', entry.id, '', '', `${entry.name}: ${entry.created} created, ${entry.updated} updated`);
  store.save(); // single write for the whole file
  return { ...entry, skipped: report.skipped, notes: [...report.notes] };
}

/** Header row for a downloadable template, using each field's first alias. */
export const templateHeader = (preset) => preset.fields.map(([, , aliases]) => aliases[0].replace(/\b\w/g, (c) => c.toUpperCase()));
