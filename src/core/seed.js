/**
 * @file Demo dataset (§9 "runs with seed data") and a large generator for stress tests.
 * All dates are relative to `now` so the demo always looks current.
 */
import { IK_DOMAIN, SCHEMA_VERSION, STAGES, STAGE_PROBABILITY, PIPELINES, SOURCES, USER_STATUS } from '../config/constants.js';
import { addDays, daysAgoISO, today } from '../utils/dates.js';
import { uid } from '../utils/object.js';

/** Picklists IK will replace with its own lists (§10). */
export const DEFAULT_SETTINGS = Object.freeze({
  serviceLines: ['Data & analytics strategy', 'BI & reporting', 'Data engineering', 'AI & automation', 'Staff augmentation'],
  lossReasons: ['Price', 'Timing', 'Chose competitor', 'No budget', 'Went in-house', 'No decision', 'Existing relationship', 'Scope fit'],
  industries: [
    'Financial services',
    'Food and beverage',
    'Retail',
    'Healthcare',
    'Transportation',
    'Insurance',
    'Professional services',
    'Manufacturing',
    'Life sciences',
    'Technology',
    'Energy',
  ],
});

/**
 * Builds the demo dataset.
 * @param {Date} [now]
 */
export function createSeed(now = new Date()) {
  const T = today(now);
  const D = (n) => addDays(T, n); // date n days from today
  const ago = (n) => daysAgoISO(n, now); // timestamp n days ago

  const user = (id, name, role) => ({
    id,
    name,
    email: `${name.split(' ')[0].toLowerCase()}@${IK_DOMAIN}`,
    role,
    status: USER_STATUS.ACTIVE,
    demo: true,
    createdAt: ago(300),
  });
  const users = [
    user('u_russell', 'Russell Grant', 'admin'),
    user('u_cristina', 'Cristina Vega', 'gtm'),
    user('u_rod', 'Rod Mendez', 'delivery'),
    user('u_alejandro', 'Alejandro Samudio', 'finance'),
  ];

  // Company factory: keeps the seed list readable.
  const co = (id, name, domain, relationship, industry, subIndustry, hq, employees, revenueBand, ownership, x = {}) => ({
    id,
    name,
    domain,
    ownerId: x.ownerId || 'u_cristina',
    relationship,
    industry,
    subIndustry,
    hq,
    employees,
    revenueBand,
    ownership,
    peSponsorId: x.pe || '',
    parentId: '',
    icpTier: x.icp || '',
    icpScore: '',
    researchSummary: '',
    secUrl: '',
    folderUrl: `https://insightkitchen.sharepoint.com/sites/Clients/${encodeURIComponent(name)}`,
    createdAt: ago(200),
    createdBy: 'u_russell',
  });
  const companies = [
    co(
      'c_harbor',
      'Harbor Ridge Capital',
      'harborridgecap.com',
      'Partner',
      'Financial services',
      'Private equity',
      'Boston, MA',
      120,
      '$50M–$100M',
      'Private',
      { icp: 'Tier 1' },
    ),
    co('c_northwind', 'Northwind Foods', 'northwindfoods.com', 'Client', 'Food and beverage', 'Packaged foods', 'Chicago, IL', 2400, '$500M–$1B', 'PE-backed', {
      pe: 'c_harbor',
      icp: 'Tier 1',
    }),
    co('c_cascade', 'Cascade Retail Group', 'cascaderetail.com', 'Prospect', 'Retail', 'Specialty retail', 'Seattle, WA', 5200, '$1B+', 'Public', {
      icp: 'Tier 2',
    }),
    co('c_meridian', 'Meridian Health Systems', 'meridianhealth.org', 'Client', 'Healthcare', 'Provider networks', 'Nashville, TN', 8800, '$1B+', 'Private', {
      ownerId: 'u_russell',
      icp: 'Tier 1',
    }),
    co('c_atlas', 'Atlas Logistics', 'atlaslogistics.com', 'Prospect', 'Transportation', '3PL', 'Dallas, TX', 1500, '$250M–$500M', 'PE-backed', {
      pe: 'c_harbor',
      icp: 'Tier 2',
    }),
    co('c_brightline', 'Brightline Insurance', 'brightlineins.com', 'Client', 'Insurance', 'Specialty P&C', 'Hartford, CT', 950, '$250M–$500M', 'Private', {
      ownerId: 'u_russell',
    }),
    co(
      'c_summit',
      'Summit Analytics Partners',
      'summitanalytics.io',
      'Partner',
      'Professional services',
      'Data consulting',
      'Denver, CO',
      60,
      '$10M–$50M',
      'Private',
    ),
    co(
      'c_pioneer',
      'Pioneer Manufacturing',
      'pioneermfg.com',
      'Former client',
      'Manufacturing',
      'Industrial equipment',
      'Cleveland, OH',
      3100,
      '$500M–$1B',
      'PE-backed',
      { pe: 'c_harbor' },
    ),
    co('c_vela', 'Vela Pharma', 'velapharma.com', 'Prospect', 'Life sciences', 'Specialty pharma', 'Princeton, NJ', 700, '$100M–$250M', 'Public', {
      icp: 'Tier 3',
    }),
    co('c_mgi', 'Mega Impacts', 'megaimpacts.com', 'Vendor', 'Professional services', 'Outbound prospecting', 'Remote', 40, '$10M–$50M', 'Private', {
      ownerId: 'u_russell',
    }),
  ];

  // Contact factory.
  const ct = (id, name, title, seniority, fn, companyId, email, ownerId = 'u_cristina', location = '', timezone = '') => ({
    id,
    name,
    title,
    seniority,
    function: fn,
    companyId,
    previousCompanies: '',
    email,
    phone: '',
    linkedin: `https://www.linkedin.com/in/${name.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    location,
    timezone,
    ownerId,
    source: 'Inbound',
    doNotContact: false,
    createdAt: ago(150),
    createdBy: 'u_cristina',
  });
  const contacts = [
    ct(
      'p_dana',
      'Dana Whitfield',
      'Chief Financial Officer',
      'C-level',
      'Finance',
      'c_northwind',
      'dana.whitfield@northwindfoods.com',
      'u_cristina',
      'Chicago, IL',
      'US Central',
    ),
    ct('p_marco', 'Marco Ruiz', 'VP Data and Analytics', 'VP', 'Data', 'c_northwind', 'mruiz@northwindfoods.com', 'u_cristina', 'Chicago, IL', 'US Central'),
    ct('p_lena', 'Lena Ortiz', 'Director of Procurement', 'Director', 'Procurement', 'c_northwind', 'lortiz@northwindfoods.com'),
    ct(
      'p_james',
      'James Okafor',
      'SVP Merchandising',
      'SVP',
      'Operations',
      'c_cascade',
      'jokafor@cascaderetail.com',
      'u_cristina',
      'Seattle, WA',
      'US Pacific',
    ),
    ct('p_priya', 'Priya Natarajan', 'Director, BI', 'Director', 'Data', 'c_cascade', 'pnatarajan@cascaderetail.com'),
    ct(
      'p_helen',
      'Helen Brooks',
      'Chief Information Officer',
      'C-level',
      'IT',
      'c_meridian',
      'hbrooks@meridianhealth.org',
      'u_russell',
      'Nashville, TN',
      'US Central',
    ),
    ct('p_sam', 'Sam Delgado', 'Head of Data Engineering', 'Director', 'Data', 'c_meridian', 'sdelgado@meridianhealth.org', 'u_russell'),
    ct(
      'p_tom',
      'Tom Becker',
      'Operating Partner',
      'Partner',
      'Portfolio operations',
      'c_harbor',
      'tbecker@harborridgecap.com',
      'u_russell',
      'Boston, MA',
      'US Eastern',
    ),
    ct('p_ava', 'Ava Lindqvist', 'COO', 'C-level', 'Operations', 'c_atlas', 'ava.l@atlaslogistics.com'),
    ct('p_raj', 'Raj Patel', 'VP Analytics', 'VP', 'Data', 'c_brightline', 'rpatel@brightlineins.com', 'u_russell'),
    ct('p_nina', 'Nina Cole', 'Managing Director', 'Partner', 'Leadership', 'c_summit', 'nina@summitanalytics.io', 'u_russell'),
    ct('p_omar', 'Omar Haddad', 'Head of Commercial Analytics', 'Director', 'Commercial', 'c_vela', 'ohaddad@velapharma.com'),
  ];

  /** Deal factory that also fabricates a believable stage history. */
  const dl = (id, name, companyId, ownerId, pipeline, stage, amount, close, serviceLine, source, x = {}) => {
    const order = STAGES.slice(0, 6); // linear stages a deal walks through
    let idx = order.indexOf(stage);
    if (stage === 'Closed won') idx = 6;
    if (stage === 'Closed lost' || stage === 'On hold') idx = Math.max(2, x.reach || 2);
    const start = x.age || 60;
    const steps = Math.min(idx, order.length - 1) + 1;
    const stageHistory = [];
    for (let i = 0; i < steps; i++) {
      const daysAgo = Math.round(start - ((start - (x.inStage || 8)) * i) / Math.max(1, steps - 1)); // evenly spaced moves
      stageHistory.push({ stage: order[Math.min(i, 5)], at: ago(daysAgo), by: ownerId });
    }
    if (['Closed won', 'Closed lost', 'On hold'].includes(stage)) stageHistory.push({ stage, at: ago(x.inStage || 5), by: ownerId });
    return {
      id,
      name,
      companyId,
      ownerId,
      collaborators: x.collab || [],
      pipeline,
      stage,
      amount,
      probability: STAGE_PROBABILITY[stage],
      expectedClose: close,
      expectedStart: x.start || addDays(close, 21),
      durationMonths: x.dur || 6,
      serviceLine,
      source,
      referringPartnerId: x.partner || '',
      primaryContactId: x.pc || '',
      decisionMakerId: x.dm || '',
      championId: x.ch || '',
      nextStep: x.ns || '',
      nextStepDate: x.nsd || '',
      competitors: x.comp || '',
      winLossReason: x.wl || '',
      folderUrl: `https://insightkitchen.sharepoint.com/sites/Deals/${encodeURIComponent(name)}`,
      archived: false,
      stageHistory,
      createdAt: stageHistory[0].at,
      createdBy: ownerId,
    };
  };
  const deals = [
    dl(
      'd_nw_fpa',
      'Northwind FP&A modernization',
      'c_northwind',
      'u_cristina',
      'Consulting projects',
      'Proposal sent',
      420000,
      D(24),
      'Data & analytics strategy',
      'Referral',
      {
        pc: 'p_marco',
        dm: 'p_dana',
        ch: 'p_marco',
        ns: 'Walk Dana through pricing options',
        nsd: D(2),
        comp: 'Deloitte',
        inStage: 9,
        partner: 'c_harbor',
        dur: 7,
        collab: ['u_russell'],
      },
    ),
    dl(
      'd_nw_aug',
      'Northwind data engineers (3)',
      'c_northwind',
      'u_cristina',
      'Staff augmentation',
      'Negotiation and contracting',
      310000,
      D(12),
      'Staff augmentation',
      'Referral',
      { pc: 'p_marco', dm: 'p_dana', ns: 'Send redlined SOW back to procurement', nsd: D(1), inStage: 6, dur: 9 },
    ),
    dl(
      'd_cascade',
      'Cascade merchandising analytics',
      'c_cascade',
      'u_cristina',
      'Consulting projects',
      'Discovery',
      260000,
      D(55),
      'BI & reporting',
      'MGI outbound',
      { pc: 'p_priya', dm: 'p_james', ch: 'p_priya', ns: 'Second discovery with merchandising leads', nsd: D(4), inStage: 12 },
    ),
    dl(
      'd_meridian_ai',
      'Meridian claims triage automation',
      'c_meridian',
      'u_russell',
      'Consulting projects',
      'Solution design',
      540000,
      D(40),
      'AI & automation',
      'Inbound',
      { pc: 'p_sam', dm: 'p_helen', ch: 'p_sam', ns: 'Architecture review with Helen', nsd: D(6), inStage: 15, comp: 'Accenture' },
    ),
    dl(
      'd_meridian_bi',
      'Meridian BI managed team',
      'c_meridian',
      'u_russell',
      'Staff augmentation',
      'Closed won',
      480000,
      D(-20),
      'Staff augmentation',
      'Inbound',
      { pc: 'p_sam', dm: 'p_helen', wl: 'Existing relationship', inStage: 20, dur: 12, start: D(-10) },
    ),
    dl('d_atlas', 'Atlas network cost model', 'c_atlas', 'u_cristina', 'Partner-sourced', 'Qualified', 180000, D(70), 'Data & analytics strategy', 'Partner', {
      partner: 'c_harbor',
      pc: 'p_ava',
      dm: 'p_ava',
      ns: 'Intro call with Tom and Ava',
      nsd: D(-2),
      inStage: 18,
    }),
    dl(
      'd_bright',
      'Brightline pricing data platform',
      'c_brightline',
      'u_russell',
      'Consulting projects',
      'Negotiation and contracting',
      350000,
      D(18),
      'Data engineering',
      'Referral',
      { pc: 'p_raj', dm: 'p_raj', ns: 'Confirm start date and staffing plan', nsd: D(3), inStage: 5 },
    ),
    dl(
      'd_summit_sub',
      'Summit subcontract: retail forecasting',
      'c_cascade',
      'u_russell',
      'Partner-sourced',
      'Lead',
      90000,
      D(85),
      'AI & automation',
      'Partner',
      { partner: 'c_summit', ns: 'Scope call with Nina', nsd: D(9), inStage: 4 },
    ),
    dl(
      'd_vela',
      'Vela commercial analytics assessment',
      'c_vela',
      'u_cristina',
      'Consulting projects',
      'Lead',
      120000,
      D(95),
      'BI & reporting',
      'MGI outbound',
      { pc: 'p_omar', ns: 'Qualify budget and timing', nsd: D(5), inStage: 3, age: 10 },
    ),
    dl(
      'd_pioneer',
      'Pioneer plant analytics phase 2',
      'c_pioneer',
      'u_cristina',
      'Consulting projects',
      'Closed lost',
      220000,
      D(-35),
      'Data engineering',
      'Inbound',
      { wl: 'No budget', comp: 'In-house team', inStage: 30, reach: 4 },
    ),
    dl(
      'd_bright_aug',
      'Brightline BI developer',
      'c_brightline',
      'u_russell',
      'Staff augmentation',
      'Qualified',
      95000,
      D(30),
      'Staff augmentation',
      'Referral',
      { pc: 'p_raj', ns: 'Share two candidate profiles', nsd: D(0), inStage: 7 },
    ),
    dl('d_atlas_ops', 'Atlas ops dashboard sprint', 'c_atlas', 'u_cristina', 'Partner-sourced', 'On hold', 75000, D(110), 'BI & reporting', 'Partner', {
      partner: 'c_harbor',
      ns: 'Check back after budget cycle',
      nsd: D(45),
      inStage: 25,
    }),
  ];

  const roles = [
    ['d_nw_fpa', 'p_dana', 'Decision maker'],
    ['d_nw_fpa', 'p_marco', 'Champion'],
    ['d_nw_fpa', 'p_lena', 'Procurement'],
    ['d_nw_aug', 'p_marco', 'Champion'],
    ['d_nw_aug', 'p_lena', 'Procurement'],
    ['d_cascade', 'p_priya', 'Champion'],
    ['d_cascade', 'p_james', 'Decision maker'],
    ['d_meridian_ai', 'p_helen', 'Decision maker'],
    ['d_meridian_ai', 'p_sam', 'Champion'],
    ['d_meridian_bi', 'p_sam', 'Champion'],
    ['d_atlas', 'p_ava', 'Decision maker'],
    ['d_atlas', 'p_tom', 'Influencer'],
    ['d_bright', 'p_raj', 'Decision maker'],
    ['d_vela', 'p_omar', 'Influencer'],
    ['d_summit_sub', 'p_nina', 'Influencer'],
    ['d_bright_aug', 'p_raj', 'Decision maker'],
  ];
  const dealContacts = roles.map(([dealId, contactId, role]) => ({ id: uid('dc_'), dealId, contactId, role }));

  const k = (
    id,
    name,
    type,
    companyId,
    status,
    eff,
    end,
    notice,
    autoRenew,
    totalValue,
    billingModel,
    paymentTerms,
    clientSignatory,
    renewalOwnerId,
    x = {},
  ) => ({
    id,
    name,
    type,
    companyId,
    dealIds: x.deals || [],
    parentMsaId: x.parent || '',
    status,
    effectiveDate: eff,
    endDate: end,
    noticeDays: notice,
    autoRenew,
    totalValue,
    billingModel,
    paymentTerms,
    ikSignatory: 'Russell Grant',
    clientSignatory,
    renewalOwnerId,
    fileUrl: x.file || '',
    createdAt: ago(90),
    createdBy: 'u_russell',
  });
  const contracts = [
    k('k_nw_msa', 'Northwind Foods MSA', 'MSA', 'c_northwind', 'Signed', D(-640), D(85), 60, false, 0, 'T&M', 'Net 45', 'Dana Whitfield', 'u_cristina', {
      file: 'https://insightkitchen.sharepoint.com/sites/Contracts/Northwind/MSA.pdf',
    }),
    k('k_nw_sow', 'Northwind data engineers SOW', 'SOW', 'c_northwind', 'Redlines', D(14), D(290), 30, false, 310000, 'T&M', 'Net 45', 'Lena Ortiz', 'u_rod', {
      deals: ['d_nw_aug'],
      parent: 'k_nw_msa',
    }),
    k('k_mer_msa', 'Meridian Health MSA', 'MSA', 'c_meridian', 'Signed', D(-400), D(330), 90, true, 0, 'T&M', 'Net 30', 'Helen Brooks', 'u_russell'),
    k(
      'k_mer_sow',
      'Meridian BI managed team SOW',
      'SOW',
      'c_meridian',
      'Signed',
      D(-10),
      D(355),
      30,
      false,
      480000,
      'Retainer',
      'Net 30',
      'Helen Brooks',
      'u_rod',
      { deals: ['d_meridian_bi'], parent: 'k_mer_msa' },
    ),
    k(
      'k_bri_sow',
      'Brightline reporting SOW 2',
      'SOW',
      'c_brightline',
      'Signed',
      D(-300),
      D(27),
      30,
      false,
      185000,
      'Fixed fee',
      'Net 30',
      'Raj Patel',
      'u_russell',
    ),
    k('k_harbor_nda', 'Harbor Ridge portfolio NDA', 'NDA', 'c_harbor', 'Signed', D(-700), D(52), 0, true, 0, '', '', 'Tom Becker', 'u_russell'),
    k(
      'k_summit_sub',
      'Summit Analytics subcontract',
      'Subcontract',
      'c_summit',
      'Drafting',
      '',
      '',
      30,
      false,
      90000,
      'T&M',
      'Net 60',
      'Nina Cole',
      'u_russell',
      { deals: ['d_summit_sub'] },
    ),
  ];

  // Placement table exists now; UI is V2 (§4).
  const placements = [
    {
      id: 'pl_1',
      person: 'Jordan Lee',
      role: 'Senior BI developer',
      clientId: 'c_meridian',
      contractId: 'k_mer_sow',
      nextDealId: '',
      engagementType: 'Contractor',
      startDate: D(-10),
      endDate: D(170),
      extensionLikelihood: 'High',
      billRate: 145,
      costRate: 98,
      margin: 32.4,
      status: 'Active',
    },
  ];

  const call = (id, title, daysAgo, durationMin, attendees, dealId, companyId, contactIds, summary, actionItems) => ({
    id,
    title,
    date: ago(daysAgo),
    durationMin,
    attendees,
    firefliesId: `ff_${id}`,
    dealId,
    companyId,
    contactIds,
    summary,
    actionItems,
    transcriptUrl: `https://app.fireflies.ai/view/${id}`,
    recordingUrl: `https://app.fireflies.ai/view/${id}#recording`,
    source: 'fireflies',
    matched: true,
    createdAt: ago(daysAgo),
  });
  const calls = [
    call(
      'cl_1',
      'Northwind FP&A: proposal walkthrough',
      2,
      48,
      [`cristina@${IK_DOMAIN}`, 'dana.whitfield@northwindfoods.com', 'mruiz@northwindfoods.com'],
      'd_nw_fpa',
      'c_northwind',
      ['p_dana', 'p_marco'],
      'Dana and Marco reviewed the proposal. They like the phased plan but want phase 1 under $250K to stay inside Dana’s approval limit. Deloitte has pitched a larger transformation; Dana sees it as too heavy. Board meeting in five weeks is the forcing event.',
      ['Cristina to send a two-option pricing page', 'Marco to share the current close calendar', 'Book a session with Lena from procurement'],
    ),
    call(
      'cl_2',
      'Meridian claims automation: architecture',
      5,
      55,
      [`russell@${IK_DOMAIN}`, 'sdelgado@meridianhealth.org'],
      'd_meridian_ai',
      'c_meridian',
      ['p_sam'],
      'Sam walked through the claims intake flow. Roughly 40% of claims are manually triaged. Concern about PHI handling with LLMs; needs a private deployment answer. Helen must approve anything touching patient data.',
      ['Russell to draft a reference architecture with PHI controls', 'Sam to pull last quarter’s triage volumes'],
    ),
    call(
      'cl_3',
      'Cascade BI: discovery 1',
      9,
      40,
      [`cristina@${IK_DOMAIN}`, 'pnatarajan@cascaderetail.com'],
      'd_cascade',
      'c_cascade',
      ['p_priya'],
      'Priya described 14 disconnected merchandising reports and no single view of sell-through. James owns the budget and is skeptical of another dashboard project. Tableau licenses already owned.',
      ['Prepare a sell-through prototype for James', 'Confirm data access to the POS warehouse'],
    ),
    call(
      'cl_4',
      'Brightline: staffing and start date',
      3,
      30,
      [`russell@${IK_DOMAIN}`, 'rpatel@brightlineins.com'],
      'd_bright',
      'c_brightline',
      ['p_raj'],
      'Raj confirmed budget is approved. Needs the team to start within three weeks to hit the Q1 rate filing. Legal is reviewing liability caps.',
      ['Confirm two named engineers', 'Send revised liability language'],
    ),
  ];

  const note = (id, refType, refId, body, by, daysAgo) => ({ id, refType, refId, body, by, createdAt: ago(daysAgo) });
  const notes = [
    note(
      'n_1',
      'deal',
      'd_nw_fpa',
      '<p>Harbor Ridge (Tom) made the intro. Northwind is 18 months into the hold period and the sponsor wants faster monthly close before a possible sale.</p>',
      'u_cristina',
      20,
    ),
    note('n_2', 'deal', 'd_nw_fpa', '<p><b>Pricing:</b> Dana hinted a phase 1 under $250K gets signed without board approval.</p>', 'u_cristina', 1),
    note(
      'n_3',
      'deal',
      'd_meridian_ai',
      '<p>Accenture is in a parallel conversation with the CIO office. Our edge is speed and the existing BI team relationship.</p>',
      'u_russell',
      8,
    ),
    note('n_4', 'company', 'c_harbor', '<p>Tom wants a quarterly portfolio review of IK work across Harbor companies.</p>', 'u_russell', 14),
    note('n_5', 'deal', 'd_atlas', '<p>Ava is new in role; first 90-day priority is network cost visibility.</p>', 'u_cristina', 18),
    note('n_6', 'contact', 'p_dana', '<p>Prefers a one-page summary before any call.</p>', 'u_cristina', 6),
  ];

  const task = (id, title, due, assigneeId, refType, refId) => ({
    id,
    title,
    dueDate: due,
    assigneeId,
    reminderDate: due,
    emailReminder: true,
    done: false,
    refType,
    refId,
    createdAt: ago(5),
    createdBy: assigneeId,
  });
  const tasks = [
    task('t_1', 'Send two-option pricing to Dana', D(0), 'u_cristina', 'deal', 'd_nw_fpa'),
    task('t_2', 'Book procurement session with Lena', D(-1), 'u_cristina', 'deal', 'd_nw_fpa'),
    task('t_3', 'Draft PHI reference architecture', D(2), 'u_russell', 'deal', 'd_meridian_ai'),
    task('t_4', 'Confirm named engineers for Brightline', D(0), 'u_rod', 'deal', 'd_bright'),
    task('t_5', 'Renewal plan for Brightline reporting SOW', D(-3), 'u_russell', 'contract', 'k_bri_sow'),
    task('t_6', 'Build sell-through prototype for Cascade', D(5), 'u_cristina', 'deal', 'd_cascade'),
    task('t_7', 'Follow up with Ava on intro call', D(-2), 'u_cristina', 'deal', 'd_atlas'),
  ];

  // Activities derived from the records above so the dashboard feed is populated.
  const activities = [];
  for (const d of deals)
    d.stageHistory.forEach(
      (h, i) =>
        i > 0 &&
        activities.push({ id: uid('a_'), kind: 'stage', text: `moved to ${h.stage}`, dealId: d.id, companyId: d.companyId, contactId: '', by: h.by, at: h.at }),
    );
  for (const c of calls)
    activities.push({
      id: uid('a_'),
      kind: 'call',
      text: `recorded “${c.title}”`,
      dealId: c.dealId,
      companyId: c.companyId,
      contactId: '',
      by: 'system',
      at: c.date,
    });
  for (const n of notes)
    activities.push({
      id: uid('a_'),
      kind: 'note',
      text: 'added a note',
      dealId: n.refType === 'deal' ? n.refId : '',
      companyId: n.refType === 'company' ? n.refId : '',
      contactId: n.refType === 'contact' ? n.refId : '',
      by: n.by,
      at: n.createdAt,
    });

  const savedViews = [
    {
      id: 'sv_1',
      objectType: 'deal',
      name: 'Closing in 30 days',
      filters: { closeTo: D(30), openOnly: true },
      mode: 'table',
      pipeline: 'All',
      ownerId: 'u_russell',
      shared: true,
    },
    {
      id: 'sv_2',
      objectType: 'contact',
      name: 'Data leaders',
      query: { filters: [{ field: 'function', op: 'is', value: 'Data' }] },
      ownerId: 'u_russell',
      shared: true,
    },
  ];

  return {
    version: SCHEMA_VERSION,
    users,
    companies,
    contacts,
    deals,
    dealContacts,
    contracts,
    placements,
    calls,
    notes,
    tasks,
    activities,
    aiOutputs: [],
    savedViews,
    audit: [],
    imports: [],
    settings: { ...structuredClone(DEFAULT_SETTINGS), firefliesCursor: 0, lastBackup: null },
  };
}

/**
 * Large synthetic dataset for performance and stress tests.
 * Deterministic for a given size (simple LCG), so failures are reproducible.
 * @param {{companies?:number, contacts?:number, deals?:number}} size
 */
export function createLargeSeed({ companies = 1000, contacts = 10000, deals = 5000 } = {}, now = new Date()) {
  const base = createSeed(now);
  let seed = 42;
  const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; // deterministic PRNG
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const T = today(now);
  for (let i = 0; i < companies; i++) {
    base.companies.push({
      id: `c_l${i}`,
      name: `Load Company ${i}`,
      domain: `load${i}.example.com`,
      ownerId: pick(base.users).id,
      relationship: 'Prospect',
      industry: pick(base.settings.industries),
      subIndustry: '',
      hq: '',
      employees: Math.floor(rand() * 10000),
      revenueBand: '',
      ownership: 'Private',
      peSponsorId: '',
      parentId: '',
      icpTier: pick(['Tier 1', 'Tier 2', 'Tier 3', '']),
      folderUrl: '',
      createdAt: daysAgoISO(Math.floor(rand() * 400), now),
      createdBy: 'u_russell',
    });
  }
  for (let i = 0; i < contacts; i++) {
    base.contacts.push({
      id: `p_l${i}`,
      name: `Load Contact ${i}`,
      title: pick(['VP Data', 'CFO', 'Director, BI', 'COO']),
      seniority: '',
      function: pick(['Data', 'Finance', 'Operations']),
      companyId: `c_l${i % companies}`,
      email: `contact${i}@load${i % companies}.example.com`,
      phone: '',
      linkedin: '',
      location: '',
      timezone: '',
      ownerId: pick(base.users).id,
      source: pick(SOURCES),
      doNotContact: false,
      createdAt: daysAgoISO(Math.floor(rand() * 400), now),
      createdBy: 'u_russell',
    });
  }
  for (let i = 0; i < deals; i++) {
    const stage = pick(STAGES);
    const at = daysAgoISO(Math.floor(rand() * 200), now);
    base.deals.push({
      id: `d_l${i}`,
      name: `Load Deal ${i}`,
      companyId: `c_l${i % companies}`,
      ownerId: pick(base.users).id,
      collaborators: [],
      pipeline: pick(PIPELINES),
      stage,
      amount: Math.round(rand() * 900000) + 10000,
      probability: STAGE_PROBABILITY[stage],
      expectedClose: addDays(T, Math.floor(rand() * 360) - 60),
      expectedStart: '',
      durationMonths: 6,
      serviceLine: pick(base.settings.serviceLines),
      source: pick(SOURCES),
      referringPartnerId: '',
      primaryContactId: '',
      decisionMakerId: '',
      championId: '',
      nextStep: 'Follow up',
      nextStepDate: addDays(T, Math.floor(rand() * 30)),
      competitors: '',
      winLossReason: stage.startsWith('Closed') ? 'Price' : '',
      folderUrl: '',
      archived: false,
      stageHistory: [{ stage, at, by: 'u_russell' }],
      createdAt: at,
      createdBy: 'u_russell',
    });
  }
  return base;
}
