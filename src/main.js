/**
 * @file Entry point: builds the store and API, restores the session and starts the router.
 */
import { STORAGE_KEY, USER_STATUS } from './config/constants.js';
import { createApi } from './core/api.js';
import { createMemoryStorage, createStore } from './core/store.js';
import { createLargeSeed, createSeed } from './core/seed.js';
import { initCapabilities } from './platform/capabilities.js';
import { ctx, state } from './ui/context.js';
import { $ } from './ui/dom.js';
import { initShell, render } from './ui/shell.js';
import { renderLogin } from './ui/views/login.js';

/** Session key in sessionStorage: survives reloads, not new tabs. */
const SESSION_KEY = 'ikcrm.session';

/** Returns localStorage, or an in-memory fallback when it is blocked. */
function pickStorage() {
  try {
    const probe = '__ikcrm_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return createMemoryStorage(); // private mode or sandbox: the app still works, data is per tab
  }
}

/** Reads a session value without throwing in restricted frames. */
const session = {
  get: () => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      sessionStorage.setItem(SESSION_KEY, v);
    } catch {
      /* ignore */
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Shows the app for a signed-in user. */
function enter(user) {
  ctx.user = user;
  session.set(user.id);
  $('#login').hidden = true;
  $('#app').hidden = false;
  render();
}

/** Signs out and returns to the sign-in screen. */
function signOut() {
  ctx.user = null;
  session.clear();
  $('#app').hidden = true;
  $('#login').hidden = false;
  renderLogin(enter);
}

/** Boots the application. Exposed for e2e tests via window.__ikcrm (read-only use). */
export function boot() {
  const params = new URLSearchParams(location.search);
  const large = params.get('seed') === 'large'; // ?seed=large loads 10k contacts for manual stress testing
  const storage = large ? createMemoryStorage() : pickStorage();
  ctx.store = createStore({ storage, key: STORAGE_KEY, seed: () => (large ? createLargeSeed() : createSeed()) });
  ctx.store.load();
  ctx.api = createApi({ store: ctx.store, getUser: () => ctx.user, now: () => ctx.now() });
  ctx.caps = initCapabilities(window);
  ctx.render = render;
  ctx.signOut = signOut;
  initShell();
  const savedId = session.get();
  const user = savedId && state().users.find((u) => u.id === savedId && u.status === USER_STATUS.ACTIVE);
  if (user) enter(user);
  else signOut();
  window.__ikcrm = { ctx }; // test hook: lets Playwright assert data-layer rules in the browser
}

boot();
