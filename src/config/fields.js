/**
 * @file Property (field) definitions per record type.
 * One definition drives create/edit forms, the "View all properties" panel,
 * list columns and list filters, so a field is declared exactly once.
 *
 * Field shape:
 *  k: key on the record, l: label, t: input type, g: property group,
 *  o: options [value,label][], req: required, full: full-width in forms,
 *  restricted: hidden from roles without financial access, system: read-only (auto-filled)
 */
import {
  BILLING_MODELS,
  DEAL_TYPES,
  PRIORITIES,
  BUYING_ROLES,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  OWNERSHIP_TYPES,
  PIPELINES,
  RELATIONSHIP_TYPES,
  REVENUE_BANDS,
  SENIORITY,
  SOURCES,
  STAGES,
  USER_STATUS,
} from './constants.js';

/** Turns a list of strings into [value,label] options with a leading blank. */
const opts = (list, blank = true) => (blank ? [['', '']] : []).concat(list.map((x) => [x, x]));

/** Active users as options. */
const userOptions = (state, blank = false) =>
  (blank ? [['', 'No owner']] : []).concat(state.users.filter((u) => u.status === USER_STATUS.ACTIVE).map((u) => [u.id, u.name]));

/** Companies sorted by name as options. */
const companyOptions = (state) => [['', '']].concat([...state.companies].sort((a, b) => a.name.localeCompare(b.name)).map((c) => [c.id, c.name]));

/** Contacts as options. */
const contactOptions = (state) => [['', '']].concat(state.contacts.map((c) => [c.id, c.name]));

/**
 * Returns field definitions for a record type.
 * @param {'deal'|'company'|'contact'|'contract'|'task'} type
 * @param {object} state dataset (for dynamic options)
 */
export function fieldDefs(type, state) {
  const s = state.settings;
  switch (type) {
    case 'deal':
      return [
        { k: 'name', l: 'Deal name', t: 'text', req: true, full: true, g: 'Deal information' },
        { k: 'companyId', l: 'Company', t: 'select', o: companyOptions(state), req: true, g: 'Deal information' },
        { k: 'ownerId', l: 'Owner', t: 'select', o: userOptions(state), req: true, g: 'Deal information' },
        { k: 'pipeline', l: 'Pipeline', t: 'select', o: opts(PIPELINES, false), req: true, g: 'Deal information' },
        { k: 'stage', l: 'Stage', t: 'select', o: opts(STAGES, false), req: true, g: 'Deal information' },
        { k: 'dealType', l: 'Deal type', t: 'select', o: opts(DEAL_TYPES), g: 'Deal information' },
        { k: 'priority', l: 'Priority', t: 'select', o: opts(PRIORITIES), g: 'Deal information' },
        { k: 'amount', l: 'Amount (USD, total contract value)', t: 'number', g: 'Value and timing' },
        { k: 'probability', l: 'Probability % (stage default)', t: 'number', g: 'Value and timing' },
        { k: 'expectedClose', l: 'Expected close date', t: 'date', g: 'Value and timing' },
        { k: 'expectedStart', l: 'Expected start date', t: 'date', g: 'Value and timing' },
        { k: 'durationMonths', l: 'Duration (months)', t: 'number', g: 'Value and timing' },
        { k: 'serviceLine', l: 'Service line', t: 'text', suggest: s.serviceLines, ph: 'e.g. Optimization', g: 'Deal information' },
        { k: 'source', l: 'Source', t: 'select', o: opts(SOURCES), g: 'Source' },
        {
          k: 'referringPartnerId',
          l: 'Referring partner',
          t: 'select',
          o: [['', '']].concat(state.companies.filter((c) => c.relationship === 'Partner').map((c) => [c.id, c.name])),
          g: 'Source',
        },
        { k: 'primaryContactId', l: 'Primary contact', t: 'select', o: contactOptions(state), g: 'People' },
        { k: 'decisionMakerId', l: 'Decision maker', t: 'select', o: contactOptions(state), g: 'People' },
        { k: 'championId', l: 'Champion', t: 'select', o: contactOptions(state), g: 'People' },
        { k: 'nextStep', l: 'Next step', t: 'text', full: true, g: 'Next step' },
        { k: 'nextStepDate', l: 'Next step date', t: 'date', g: 'Next step' },
        { k: 'competitors', l: 'Competitors', t: 'text', g: 'Outcome' },
        { k: 'winLossReason', l: 'Win or loss reason', t: 'text', g: 'Outcome' },
        { k: 'collaborators', l: 'Collaborators', t: 'multi', o: userOptions(state), g: 'People' },
        { k: 'folderUrl', l: 'SharePoint folder link', t: 'url', full: true, g: 'Documents' },
        { k: 'createdAt', l: 'Create date', t: 'datetime', system: true, g: 'System' },
      ];
    case 'company':
      return [
        { k: 'name', l: 'Company name', t: 'text', req: true, g: 'Company information' },
        { k: 'domain', l: 'Company domain name', t: 'text', ph: 'example.com', g: 'Company information' },
        { k: 'ownerId', l: 'Account owner', t: 'select', o: userOptions(state, true), g: 'Company information' },
        { k: 'relationship', l: 'Relationship type', t: 'select', o: opts(RELATIONSHIP_TYPES, false), req: true, g: 'Company information' },
        { k: 'industry', l: 'Industry', t: 'select', o: opts(s.industries), g: 'Firmographics' },
        { k: 'subIndustry', l: 'Sub-industry', t: 'text', g: 'Firmographics' },
        { k: 'hq', l: 'HQ location', t: 'text', g: 'Firmographics' },
        { k: 'employees', l: 'Employees', t: 'number', g: 'Firmographics' },
        { k: 'revenueBand', l: 'Revenue band', t: 'select', o: opts(REVENUE_BANDS), g: 'Firmographics' },
        { k: 'ownership', l: 'Ownership', t: 'select', o: opts(OWNERSHIP_TYPES), g: 'Ownership' },
        { k: 'peSponsorId', l: 'PE sponsor', t: 'select', o: companyOptions(state), g: 'Ownership' },
        { k: 'parentId', l: 'Parent company', t: 'select', o: companyOptions(state), g: 'Ownership' },
        { k: 'folderUrl', l: 'SharePoint folder link', t: 'url', full: true, g: 'Documents' },
        { k: 'createdAt', l: 'Create date', t: 'datetime', system: true, g: 'System' },
      ];
    case 'contact':
      return [
        { k: 'name', l: 'Full name', t: 'text', req: true, g: 'Contact information' },
        { k: 'email', l: 'Email', t: 'email', g: 'Contact information' },
        { k: 'title', l: 'Job title', t: 'text', g: 'Contact information' },
        { k: 'phone', l: 'Phone number', t: 'text', g: 'Contact information' },
        { k: 'companyId', l: 'Company', t: 'select', o: companyOptions(state), g: 'Contact information' },
        { k: 'seniority', l: 'Seniority', t: 'select', o: opts(SENIORITY), g: 'Role' },
        { k: 'function', l: 'Function', t: 'text', g: 'Role' },
        { k: 'previousCompanies', l: 'Previous companies', t: 'text', g: 'Role' },
        { k: 'linkedin', l: 'LinkedIn', t: 'url', g: 'Contact information' },
        { k: 'location', l: 'Location', t: 'text', g: 'Location' },
        { k: 'timezone', l: 'Time zone', t: 'text', g: 'Location' },
        { k: 'ownerId', l: 'Contact owner', t: 'select', o: userOptions(state, true), g: 'Ownership' },
        { k: 'source', l: 'Source', t: 'select', o: opts(SOURCES), g: 'Ownership' },
        { k: 'doNotContact', l: 'Do not contact', t: 'check', g: 'Ownership' },
        { k: 'createdAt', l: 'Create date', t: 'datetime', system: true, g: 'System' },
      ];
    case 'contract':
      return [
        { k: 'name', l: 'Contract name', t: 'text', req: true, full: true, g: 'Contract' },
        { k: 'type', l: 'Type', t: 'select', o: opts(CONTRACT_TYPES, false), req: true, g: 'Contract' },
        { k: 'companyId', l: 'Company', t: 'select', o: companyOptions(state), req: true, g: 'Contract' },
        { k: 'dealIds', l: 'Linked deals', t: 'multi', o: state.deals.map((d) => [d.id, d.name]), g: 'Contract' },
        {
          k: 'parentMsaId',
          l: 'Parent MSA',
          t: 'select',
          o: [['', '']].concat(state.contracts.filter((k) => k.type === 'MSA').map((k) => [k.id, k.name])),
          g: 'Contract',
        },
        { k: 'status', l: 'Status', t: 'select', o: opts(CONTRACT_STATUSES, false), req: true, g: 'Contract' },
        { k: 'effectiveDate', l: 'Effective date', t: 'date', g: 'Terms' },
        { k: 'endDate', l: 'End date', t: 'date', g: 'Terms' },
        { k: 'noticeDays', l: 'Notice period (days)', t: 'number', g: 'Terms' },
        { k: 'autoRenew', l: 'Auto-renew', t: 'check', g: 'Terms' },
        { k: 'totalValue', l: 'Total value (USD)', t: 'number', restricted: true, g: 'Commercials' },
        { k: 'billingModel', l: 'Billing model', t: 'select', o: opts(BILLING_MODELS), g: 'Commercials' },
        { k: 'paymentTerms', l: 'Payment terms', t: 'text', ph: 'Net 30', g: 'Commercials' },
        { k: 'ikSignatory', l: 'IK signatory', t: 'text', g: 'Parties' },
        { k: 'clientSignatory', l: 'Client signatory', t: 'text', g: 'Parties' },
        { k: 'renewalOwnerId', l: 'Renewal owner', t: 'select', o: [['', '']].concat(userOptions(state)), g: 'Parties' },
        { k: 'fileUrl', l: 'File link (SharePoint)', t: 'url', full: true, g: 'Parties' },
      ];
    case 'task':
      return [
        { k: 'title', l: 'Task', t: 'text', req: true, full: true },
        { k: 'dueDate', l: 'Due date', t: 'date', req: true },
        { k: 'assigneeId', l: 'Assignee', t: 'select', o: userOptions(state), req: true },
        { k: 'reminderDate', l: 'Reminder date', t: 'date' },
        { k: 'emailReminder', l: 'Also send an email reminder', t: 'check' },
      ];
    default:
      return [];
  }
}

/** Buying role picklist re-exported for forms. */
export const BUYING_ROLE_OPTIONS = BUYING_ROLES.map((b) => [b, b]);
