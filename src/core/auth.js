/**
 * @file Sign-in and invitations for the prototype.
 * Passwords are never stored in plain text: we keep a salted SHA-256 hash.
 * Production replaces this module with Auth.js (email + password, Entra SSO later).
 */
import { USER_STATUS } from '../config/constants.js';

/** Demo accounts accept this password so testers can switch roles quickly. */
export const DEMO_PASSWORD = 'demo';

/** Minimum length for passwords set through an invite. */
export const MIN_PASSWORD_LENGTH = 8;

/** Hex-encodes a byte buffer. */
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Salted SHA-256 hash using Web Crypto (available in browsers and Node 18+).
 * @param {string} password
 * @param {string} salt
 */
export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await globalThis.crypto.subtle.digest('SHA-256', data));
}

/** Random hex token for invite links and salts. */
export function randomToken(bytes = 16) {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr); // cryptographically strong randomness
  return toHex(arr);
}

/**
 * Verifies credentials.
 * @returns {Promise<{ok:true,user:object}|{ok:false,error:string}>}
 */
export async function signIn(state, email, password) {
  const user = state.users.find((u) => u.email === String(email).trim().toLowerCase());
  const generic = 'That email and password don’t match.'; // same message for unknown email and wrong password
  if (!user) return { ok: false, error: generic };
  if (user.status === USER_STATUS.DEACTIVATED) return { ok: false, error: 'This account is deactivated. Ask an admin.' };
  if (user.status === USER_STATUS.INVITED) return { ok: false, error: 'Accept your invite first, using the link from your admin.' };
  const valid = user.passwordHash ? (await hashPassword(password, user.salt)) === user.passwordHash : user.demo && password === DEMO_PASSWORD;
  return valid ? { ok: true, user } : { ok: false, error: generic };
}

/**
 * Completes an invite: sets the password and activates the account.
 * @returns {Promise<object>} the activated user
 */
export async function acceptInvite(api, state, token, password) {
  const user = state.users.find((u) => u.inviteToken && u.inviteToken === token && u.status === USER_STATUS.INVITED);
  if (!user) throw new Error('This invite link is invalid or was already used.');
  if (String(password).length < MIN_PASSWORD_LENGTH) throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  const salt = randomToken(8);
  api.update('user', user.id, { salt, passwordHash: await hashPassword(password, salt), status: USER_STATUS.ACTIVE, inviteToken: '' }, { system: true }); // audited as a system change
  return user;
}
