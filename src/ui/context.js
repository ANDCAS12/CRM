/**
 * @file Shared runtime context for the UI layer.
 * Holds the store, API, session and per-screen UI state so views stay stateless functions.
 */

/** Mutable app context, filled in by main.js at boot. */
export const ctx = {
  /** @type {ReturnType<import('../core/store.js').createStore>} */ store: null,
  /** @type {ReturnType<import('../core/api.js').createApi>} */ api: null,
  /** Signed-in user (raw record) or null. */ user: null,
  /** Runtime capability promises: { sample, downloads }. */ caps: { sample: Promise.resolve(null), downloads: Promise.resolve(null) },
  /** Clock, injectable for tests. */ now: () => new Date(),
  /** Re-renders the current route; set by the router. */ render: () => {},
  /** Per-screen UI state that survives re-renders but not reloads. */
  ui: {
    dealMode: 'board', // board | table (B-01, B-03)
    pipeline: 'Consulting projects', // B-04
    dealFilters: {}, // L-02
    showFilters: false,
    dealSort: { k: 'expectedClose', dir: 1 },
    selected: new Set(), // bulk edit selection (B-03)
    collapsed: new Set(), // collapsed board columns
    dashScope: 'mine', // A-04
    callsTab: 'inbox',
    tasksTab: 'mine',
    adminTab: 'users',
    contractStatus: '',
    reportPipeline: '',
    auditFilter: '',
    recordTab: {}, // per record type: 'activities' | 'about'
    timelineFilter: 'all',
    lists: {}, // contact/company list state, keyed by record type
  },
};

/** Live dataset shortcut. */
export const state = () => ctx.store.state;

/** Re-render while keeping the scroll position (used after inline edits). */
export function rerender() {
  const view = document.getElementById('view');
  const top = view ? view.scrollTop : 0;
  ctx.render();
  if (view) view.scrollTop = top; // inline edits should not jump the page
}
