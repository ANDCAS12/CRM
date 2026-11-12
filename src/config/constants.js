/**
 * @file Domain constants for IK CRM.
 * Single source of truth for picklists, stage rules and access rules,
 * so business rules never get hard-coded inside views.
 */

/** Ordered deal stages (build prompt §4, Deal.stage). */
export const STAGES = Object.freeze([
  'Lead',
  'Qualified',
  'Discovery',
  'Solution design',
  'Proposal sent',
  'Negotiation and contracting',
  'Closed won',
  'Closed lost',
  'On hold',
]);

/** Default probability (%) per stage; editable per deal (§4 "probability: stage default, editable"). */
export const STAGE_PROBABILITY = Object.freeze({
  Lead: 10,
  Qualified: 20,
  Discovery: 30,
  'Solution design': 40,
  'Proposal sent': 60,
  'Negotiation and contracting': 80,
  'Closed won': 100,
  'Closed lost': 0,
  'On hold': 10,
});

/** Stages that end a deal and therefore require a win/loss reason (B-07). */
export const CLOSED_STAGES = Object.freeze(['Closed won', 'Closed lost']);

/** The three pipelines required by B-04. */
export const PIPELINES = Object.freeze(['Consulting projects', 'Staff augmentation', 'Partner-sourced']);

/** Deal and contact sources (B-08). */
export const SOURCES = Object.freeze(['Inbound', 'MGI outbound', 'Referral', 'Partner', 'Event']);

/** Roles from §3. Keys are stored on users; values are shown in the UI. */
export const ROLES = Object.freeze({
  admin: 'Admin',
  gtm: 'GTM',
  delivery: 'Delivery and talent',
  finance: 'Finance (read)',
});

/** Buying roles stored per deal (D-02). */
export const BUYING_ROLES = Object.freeze(['Champion', 'Decision maker', 'Influencer', 'Procurement', 'Legal']);

/** Company relationship types (C-01). */
export const RELATIONSHIP_TYPES = Object.freeze(['Prospect', 'Client', 'Partner', 'Vendor', 'Former client']);

/** Company ownership types (C-04). */
export const OWNERSHIP_TYPES = Object.freeze(['Public', 'PE-backed', 'Private']);

/** Contract picklists (F-01). */
export const CONTRACT_TYPES = Object.freeze(['MSA', 'SOW', 'PO', 'NDA', 'License', 'Subcontract']);
export const CONTRACT_STATUSES = Object.freeze(['Drafting', 'Internal review', 'With client', 'Redlines', 'Signed', 'Expired']);
export const BILLING_MODELS = Object.freeze(['T&M', 'Fixed fee', 'Retainer']);

/** Contact seniority picklist. */
export const SENIORITY = Object.freeze(['C-level', 'SVP', 'VP', 'Director', 'Manager', 'Individual contributor', 'Partner']);

/** Revenue bands for companies. */
export const REVENUE_BANDS = Object.freeze(['<$10M', '$10M–$50M', '$50M–$100M', '$100M–$250M', '$250M–$500M', '$500M–$1B', '$1B+']);

/** IK's own email domain: attendees on it are ignored when matching calls (H-01). */
export const IK_DOMAIN = 'insightkitchen.com';

/** localStorage key for the whole dataset; bump the suffix only with a migration. */
export const STORAGE_KEY = 'ikcrm.v1';

/** Current data schema version, used by store migrations. */
export const SCHEMA_VERSION = 2;

/** Delivery and talent only see deals in these stages (§3 table). */
export const DELIVERY_VISIBLE_STAGES = Object.freeze(['Negotiation and contracting', 'Closed won']);

/**
 * Fields hidden from roles without financial access (§3, F-04).
 * The API strips these before any record reaches a view.
 */
export const RESTRICTED_FIELDS = Object.freeze({
  contract: Object.freeze(['totalValue']),
  placement: Object.freeze(['billRate', 'costRate', 'margin']),
});

/** Maps a record type to the state collection that stores it. */
export const COLLECTIONS = Object.freeze({
  deal: 'deals',
  company: 'companies',
  contact: 'contacts',
  contract: 'contracts',
  placement: 'placements',
  call: 'calls',
  note: 'notes',
  task: 'tasks',
  user: 'users',
  dealContact: 'dealContacts',
  savedView: 'savedViews',
  aiOutput: 'aiOutputs',
});

/** Human labels per record type (audit log, error messages). */
export const LABELS = Object.freeze({
  deal: 'Deal',
  company: 'Company',
  contact: 'Contact',
  contract: 'Contract',
  placement: 'Placement',
  call: 'Call',
  note: 'Note',
  task: 'Task',
  user: 'User',
  dealContact: 'Buying role',
  savedView: 'Saved view',
  aiOutput: 'AI output',
});

/** User account statuses (Access: invite, deactivate). */
export const USER_STATUS = Object.freeze({ ACTIVE: 'active', INVITED: 'invited', DEACTIVATED: 'deactivated' });

/** Activity-type filter chips shown above every record timeline. */
export const TIMELINE_FILTERS = Object.freeze([
  ['all', 'All'],
  ['note', 'Notes'],
  ['call', 'Calls and meetings'],
  ['task', 'Tasks'],
  ['stage', 'Stage changes'],
  ['change', 'Property changes'],
]);

/** Contract alert bands in days (F-03). */
export const CONTRACT_ALERT_BANDS = Object.freeze([30, 60, 90]);
