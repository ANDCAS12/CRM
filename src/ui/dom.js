/**
 * @file DOM helpers: query shortcuts, icons, toast, modal dialogs, drawers and HTML sanitising.
 */
import { esc } from '../utils/format.js';

/** First element matching a selector. */
export const $ = (sel, root = document) => root.querySelector(sel);
/** All elements matching a selector, as an array. */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Inline SVG icon paths (24×24, stroke-based). */
const ICONS = {
  dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  deals: '<path d="M3 6h18M3 12h18M3 18h12"/>',
  co: '<path d="M3 21V7l9-4 9 4v14M9 21v-6h6v6"/>',
  ct: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  task: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  k: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  rep: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  stage: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  change: '<path d="M4 4v6h6M20 20v-6h-6"/><path d="M20 10a8 8 0 0 0-14.9-3M4 14a8 8 0 0 0 14.9 3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
};

/** Returns an inline SVG icon by name (decorative, so aria-hidden). */
export const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/** Shows a short message at the bottom of the screen. */
export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status'); // announced by screen readers
  el.textContent = message; // textContent, never innerHTML, for user-facing strings
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/**
 * Opens a modal dialog. `onSave` may throw to show an inline error and keep the dialog open,
 * or return false to keep it open silently.
 * @param {string} title
 * @param {string} bodyHtml trusted HTML (callers escape user data with esc())
 * @param {{saveLabel?:string, onSave?:(body:HTMLElement)=>any, wide?:boolean, cancelLabel?:string}} [opts]
 * @returns {{root:HTMLElement, body:HTMLElement, close:()=>void}}
 */
export function modal(title, bodyHtml, { saveLabel = 'Save', onSave, wide = false, cancelLabel = 'Cancel' } = {}) {
  const root = $('#modalRoot');
  const opener = document.activeElement; // restore focus on close (accessibility)
  root.innerHTML = `<div class="ov" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal" style="${wide ? 'width:min(980px,100%)' : ''}">
    <header><h2>${esc(title)}</h2><div class="sp"></div><button class="btn ghost" data-x aria-label="Close">✕</button></header>
    <div class="mb">${bodyHtml}</div>
    <footer><span class="err" id="mErr" role="alert"></span><button class="btn" data-x>${esc(cancelLabel)}</button>${onSave ? `<button class="btn pri" id="mSave">${esc(saveLabel)}</button>` : ''}</footer></div></div>`;
  const body = $('.mb', root);
  const onKey = (e) => e.key === 'Escape' && close(); // Escape closes, like native dialogs
  function close() {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    opener?.focus?.();
  }
  document.addEventListener('keydown', onKey);
  $$('[data-x]', root).forEach((b) => (b.onclick = close));
  $('.ov', root).addEventListener('mousedown', (e) => e.target.classList.contains('ov') && close()); // click outside closes
  if (onSave) {
    $('#mSave', root).onclick = async () => {
      const btn = $('#mSave', root);
      btn.disabled = true; // prevent double submits
      try {
        if ((await onSave(body)) !== false) close();
      } catch (e) {
        $('#mErr', root).textContent = e.message; // validation errors appear inline
      } finally {
        if (btn.isConnected) btn.disabled = false;
      }
    };
  }
  setTimeout(() => $('input:not([type=hidden]),select,textarea,[contenteditable]', body)?.focus(), 30); // focus first field
  return { root, body, close, setError: (m) => ($('#mErr', root).textContent = m) };
}

/**
 * Opens a right-side drawer (used for "View all properties").
 * @returns {{body:HTMLElement, close:()=>void}}
 */
export function drawer(title, bodyHtml) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="scrim" data-x></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><div class="sp"></div><button class="btn ghost" data-x aria-label="Close">✕</button></header><div class="db">${bodyHtml}</div></aside>`;
  const onKey = (e) => e.key === 'Escape' && close();
  function close() {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
  }
  document.addEventListener('keydown', onKey);
  $$('[data-x]', root).forEach((b) => (b.onclick = close));
  return { body: $('.db', root), close };
}

/** Promise-based confirm built on the modal (window.confirm is blocked in some frames). */
export function confirmDialog(title, message, confirmLabel = 'Continue') {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal(title, `<p>${esc(message)}</p>`, {
      saveLabel: confirmLabel,
      onSave: () => {
        answered = true;
        resolve(true);
      },
    });
    const observer = new MutationObserver(() => {
      if (!m.root.children.length) {
        observer.disconnect();
        if (!answered) resolve(false); // closed without confirming
      }
    });
    observer.observe(m.root, { childList: true });
  });
}

/** Tags allowed in rich-text notes (E-01). Everything else becomes plain text. */
const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'P', 'BR', 'DIV', 'SPAN']);

/** Sanitises rich text: keeps basic formatting, strips attributes, scripts and links. */
export function sanitizeHtml(html) {
  const tpl = document.createElement('template'); // template content is inert: scripts never run
  tpl.innerHTML = html;
  for (const el of [...tpl.content.querySelectorAll('*')]) {
    if (!tpl.content.contains(el)) continue; // already removed with a replaced ancestor (template nodes are never isConnected)
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(document.createTextNode(el.textContent)); // unknown tags become text
      continue;
    }
    for (const a of [...el.attributes]) el.removeAttribute(a.name); // no onclick, style, href…
  }
  const div = document.createElement('div');
  div.appendChild(tpl.content);
  return div.innerHTML;
}
