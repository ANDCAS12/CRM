/**
 * @file Always-on deal summary (H-04) with source tracking (I-01).
 * Pure functions build sources and prompts; the caller supplies the Claude client.
 */
import { fmtDate, money, stripHtml } from '../utils/format.js';
import { today } from '../utils/dates.js';
import { companyName, contactName, firstName } from '../core/lookups.js';

/** Section keys and labels, in display order (H-04). */
export const SUMMARY_SECTIONS = Object.freeze([
  ['situation', 'Situation'],
  ['stakeholders', 'Stakeholders'],
  ['needs', 'Needs'],
  ['objections', 'Objections'],
  ['next_steps', 'Next steps'],
  ['risks', 'Risks'],
]);

/** Model required by the build prompt §2. */
export const SUMMARY_MODEL = 'claude-sonnet-5-5';

/** Placeholder sample SharePoint file names (J-01 stub until Graph is connected). */
export const stubFiles = (name) => {
  const base = String(name || 'Record')
    .split(' ')
    .slice(0, 2)
    .join(' ');
  return [
    [`Proposal v3 — ${base}.docx`, 'Word', 3],
    ['Pricing model.xlsx', 'Excel', 5],
    ['Kickoff deck.pptx', 'PowerPoint', 12],
    ['Signed NDA.pdf', 'PDF', 40],
  ];
};

/**
 * Collects the evidence for a deal: recent calls, notes and the document list.
 * Each source gets a short ref (S1, S2…) the model cites back.
 */
export function buildSources(state, dealId) {
  const deal = state.deals.find((d) => d.id === dealId);
  const sources = [];
  state.calls
    .filter((c) => c.matched && c.dealId === dealId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8) // newest 8 calls keep the prompt small
    .forEach((c) =>
      sources.push({
        type: 'call',
        id: c.id,
        label: `Call: ${c.title} (${fmtDate(c.date)})`,
        text: `Call "${c.title}" on ${c.date.slice(0, 10)}. Summary: ${c.summary}. Action items: ${(c.actionItems || []).join('; ')}`,
      }),
    );
  state.notes
    .filter((n) => n.refType === 'deal' && n.refId === dealId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .forEach((n) =>
      sources.push({ type: 'note', id: n.id, label: `Note by ${firstName(state, n.by)} (${fmtDate(n.createdAt)})`, text: `Note: ${stripHtml(n.body)}` }),
    );
  if (deal?.folderUrl)
    sources.push({
      type: 'document',
      id: 'folder',
      label: 'SharePoint folder (file names only)',
      text: `Documents in folder: ${stubFiles(deal.name)
        .map((f) => f[0])
        .join(', ')}`,
    });
  return sources.map((s, i) => ({ ...s, ref: `S${i + 1}` }));
}

/** Prompt that asks for strict JSON grounded only in the listed sources. */
export function buildPrompt(state, deal, sources) {
  const roles =
    state.dealContacts
      .filter((x) => x.dealId === deal.id)
      .map((x) => `${contactName(state, x.contactId)} = ${x.role}`)
      .join('; ') || 'none';
  return `You maintain the always-on deal summary in Insight Kitchen's CRM. IK sells data and analytics consulting projects and staff augmentation.
Deal: ${deal.name}. Company: ${companyName(state, deal.companyId)}. Stage: ${deal.stage}. Amount: ${money(deal.amount)}. Expected close: ${deal.expectedClose}. Next step in CRM: ${deal.nextStep} (${deal.nextStepDate}). Competitors: ${deal.competitors || 'none recorded'}.
Buying roles: ${roles}.

Sources (use only these; cite by id):
${sources.map((s) => `${s.ref}: ${s.text}`).join('\n')}

Return ONLY a JSON object, no markdown, with keys "situation","stakeholders","needs","objections","next_steps","risks" (each 1-3 plain sentences, specific, no hype; write "Not covered in sources yet." when unknown) and "source_ids" (array of the source ids you relied on).`;
}

/** Fallback summary built from the records themselves when Claude is unavailable. */
export function localSummary(state, deal, sources, now = new Date()) {
  const callSrc = sources.find((s) => s.type === 'call');
  const noteSrc = sources.find((s) => s.type === 'note');
  const lastCall = callSrc && state.calls.find((c) => c.id === callSrc.id);
  const lastNote = noteSrc && state.notes.find((n) => n.id === noteSrc.id);
  return {
    situation: lastCall ? lastCall.summary : lastNote ? stripHtml(lastNote.body) : '',
    stakeholders: state.dealContacts
      .filter((x) => x.dealId === deal.id)
      .map((x) => `${contactName(state, x.contactId)} (${x.role})`)
      .join(', '),
    needs: '',
    objections: deal.competitors ? `Competing with ${deal.competitors}.` : '',
    next_steps: [deal.nextStep, ...(lastCall ? lastCall.actionItems : [])].filter(Boolean).join('; '),
    risks: deal.nextStepDate && deal.nextStepDate < today(now) ? 'Next step is overdue.' : '',
  };
}

/**
 * Generates and saves a summary. Uses Claude when `sample` is provided; falls back to a local draft.
 * @param {{api:object, state:object, dealId:string, sample:Function|null, now?:Date, onError?:(e:any)=>void}} args
 * @returns {Promise<object|null>} saved AiOutput, or null when there is nothing to summarise
 */
export async function generateSummary({ api, state, dealId, sample, now = new Date(), onError = () => {} }) {
  const deal = state.deals.find((d) => d.id === dealId);
  if (!deal) return null;
  const sources = buildSources(state, dealId);
  let sections = null;
  let used = sources;
  let model = SUMMARY_MODEL;
  if (sample) {
    try {
      const json = await sample.json(buildPrompt(state, deal, sources), { model: SUMMARY_MODEL, modelTier: 'default' });
      sections = json;
      used = sources.filter((s) => (json.source_ids || []).includes(s.ref)); // keep only cited sources (I-01)
      if (!used.length) used = sources; // model cited nothing: show all inputs rather than none
    } catch (e) {
      onError(e); // caller decides how to tell the user
    }
  }
  if (!sections) {
    model = 'local';
    sections = localSummary(state, deal, sources, now);
  }
  const output = {
    refType: 'deal',
    refId: dealId,
    kind: 'deal_summary',
    sections,
    text: SUMMARY_SECTIONS.map(([k]) => sections[k])
      .filter(Boolean)
      .join('\n'),
    sources: used.map(({ type, id, label }) => ({ type, id, label })),
    at: now.toISOString(),
    model,
    stale: false,
  };
  return api.create('aiOutput', output, { system: true }); // every AI output is saved to the record (I-01)
}

/** Latest saved summary for a deal. */
export const latestSummary = (state, dealId) =>
  state.aiOutputs.filter((o) => o.refType === 'deal' && o.refId === dealId).sort((a, b) => b.at.localeCompare(a.at))[0] || null;
