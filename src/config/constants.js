/**
 * @file Domain constants for Central Kitchen (IK's in-house CRM).
 * Single source of truth for picklists, stage rules and access rules,
 * so business rules never get hard-coded inside views.
 */

/** Product name shown in the app (Central Kitchen build brief, slide 1). */
export const APP_NAME = 'Central Kitchen';

/**
 * Deal stages in board order, matching IK's HubSpot pipeline one to one (build brief, slides 17 and 20).
 * On Hold and Partners come first, as in the board mockup.
 */
export const STAGES = Object.freeze([
  'On Hold',
  'Partners',
  'Suspect',
  'Prospect',
  'Proposal sent',
  'Verbal Approval',
  'Contract Sent',
  'Closed won',
  'Closed lost',
]);

/** Default probability (%) per stage; editable per deal (slide 17). */
export const STAGE_PROBABILITY = Object.freeze({
  'On Hold': 1,
  Partners: 1,
  Suspect: 10,
  Prospect: 20,
  'Proposal sent': 40,
  'Verbal Approval': 80,
  'Contract Sent': 90,
  'Closed won': 100,
  'Closed lost': 0,
});

/** The active selling path shown as a progress bar on the deal page (deal record mockup). */
export const PROGRESS_STAGES = Object.freeze(['Suspect', 'Prospect', 'Proposal sent', 'Verbal Approval', 'Contract Sent']);

/** Stage a new deal starts in; MGI leads land here too (K-01). */
export const DEFAULT_STAGE = 'Suspect';

/** Stages that end a deal and therefore require a win/loss reason (B-07). */
export const CLOSED_STAGES = Object.freeze(['Closed won', 'Closed lost']);

/**
 * Two pipelines (B-04). Cristina renamed staff augmentation to "Data Science as a Service" (DSaaS) in the
 * Nov 13 walkthrough. Partner deals sit in the Partners stage of the main pipeline.
 */
export const PIPELINES = Object.freeze(['Consulting projects', 'Data Science as a Service']);

/** Older pipeline names mapped forward when saved data or imports use them. */
export const LEGACY_PIPELINE_MAP = Object.freeze({
  'Staff augmentation': 'Data Science as a Service',
  'Partner-sourced': 'Consulting projects',
  DSaaS: 'Data Science as a Service',
});

/** What each stage means, in Cristina's words (Nov 13 walkthrough), shown as help in the app. */
export const STAGE_DESCRIPTIONS = Object.freeze({
  'On Hold': 'The client changed priorities; we talk again in a few months. Not lost, kept in view (1%).',
  Partners: 'A partner told us about a possible deal, but we have not met the client yet. Moves to Prospect once we meet.',
  Suspect: 'We want to talk to this company, but they don’t know we exist yet.',
  Prospect: 'First meeting held and there is a fit; we can keep talking.',
  'Proposal sent': 'We sent a proposal.',
  'Verbal Approval': 'The client told us they chose us.',
  'Contract Sent': 'We sent the contract after the verbal approval.',
  'Closed won': 'Signed.',
  'Closed lost': 'Lost; record why in your own words.',
});

/** Deal type and priority picklists (slide 17, mapped from HubSpot dealtype and hs_priority). */
export const DEAL_TYPES = Object.freeze(['New business', 'Existing business']);
export const PRIORITIES = Object.freeze(['Low', 'Medium', 'High']);

/** Pre-Central-Kitchen stage names, mapped forward when older saved data is loaded. */
export const LEGACY_STAGE_MAP = Object.freeze({
  Lead: 'Suspect',
  Qualified: 'Prospect',
  Discovery: 'Prospect',
  'Solution design': 'Prospect',
  'Negotiation and contracting': 'Contract Sent',
});

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
export const SCHEMA_VERSION = 3;

/** Delivery and talent only see deals in contracting and won (§3 table): Verbal Approval onward. */
export const DELIVERY_VISIBLE_STAGES = Object.freeze(['Verbal Approval', 'Contract Sent', 'Closed won']);

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
