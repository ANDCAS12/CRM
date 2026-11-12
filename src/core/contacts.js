/**
 * @file Contact-derived values: last touch and relationship strength (§4 Contact, auto fields).
 */
import { dayDiff, today } from '../utils/dates.js';

/** All touch timestamps for a contact: calls they attended and notes on their record. */
export function touches(state, contactId) {
  const callTimes = state.calls.filter((c) => c.matched && (c.contactIds || []).includes(contactId)).map((c) => c.date);
  const noteTimes = state.notes.filter((n) => n.refType === 'contact' && n.refId === contactId).map((n) => n.createdAt);
  return [...callTimes, ...noteTimes].sort();
}

/**
 * Last touch and a simple strength score from touches in the last 90 days.
 * @returns {{lastTouch:string|undefined, recent:number, strength:'Strong'|'Warm'|'Cold'}}
 */
export function relationship(state, contactId, now = new Date()) {
  const list = touches(state, contactId);
  const recent = list.filter((t) => dayDiff(t, today(now)) <= 90).length;
  return { lastTouch: list.at(-1), recent, strength: recent >= 3 ? 'Strong' : recent >= 1 ? 'Warm' : 'Cold' };
}
