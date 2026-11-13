/**
 * @file App shell: sidebar navigation, hash router, global search (L-01), reminders bell (E-03, F-03)
 * and theme switch. Routes are plain #names so links work in the published artifact.
 */
import { APP_NAME, ROLES, USER_STATUS } from '../config/constants.js';
import { contractAlerts } from '../core/reports.js';
import { companyName, contactName, dealName } from '../core/lookups.js';
import { today } from '../utils/dates.js';
import { esc, stripHtml } from '../utils/format.js';
import { companyForm, contactForm, dealForm, initials, taskForm } from './actions.js';
import { ctx, state } from './context.js';
import { $, $$, svg } from './dom.js';
import { parseRoute } from './routes.js';
import { toggleTheme } from './theme.js';
import { renderDashboard } from './views/dashboard.js';
import { renderDeals } from './views/deals.js';
import { renderDealRecord } from './views/dealRecord.js';
import { renderCompanies, renderCompanyRecord } from './views/companies.js';
import { renderContacts, renderContactRecord } from './views/contacts.js';
import { renderTasks } from './views/tasks.js';
import { renderContractRecord, renderContracts } from './views/contracts.js';
import { renderCalls } from './views/calls.js';
import { renderReports } from './views/reports.js';
import { renderAdmin } from './views/admin.js';
import { renderPlacements } from './views/placements.js';
import { openAskClaude } from './components/askClaude.js';
import { canEdit } from '../core/permissions.js';

/** Main menu, in the order of the build brief mockups, with the roles that may open each page (§3). */
const NAV = [
  ['home', 'Home', 'dash', ['admin', 'gtm', 'delivery', 'finance']],
  ['deals', 'Deals', 'deals', ['admin', 'gtm', 'delivery', 'finance']],
  ['companies', 'Companies', 'co', ['admin', 'gtm', 'delivery', 'finance']],
  ['contacts', 'Contacts', 'ct', ['admin', 'gtm', 'delivery']],
  ['contracts', 'Contracts', 'k', ['admin', 'gtm', 'delivery', 'finance']],
  ['placements', 'Placements', 'list', ['admin', 'gtm', 'delivery', 'finance'], 'V2'],
  ['calls', 'Calls', 'call', ['admin', 'gtm']],
  ['reports', 'Reports', 'rep', ['admin', 'gtm', 'delivery', 'finance']],
];

/** Pages reachable by link but not listed in the menu. */
const HIDDEN_PAGES = { tasks: ['admin', 'gtm', 'delivery'], admin: ['admin', 'gtm', 'delivery', 'finance'] };

/** Record page routes map to their index page for nav highlighting; "dashboard" is the old name for home. */
const RECORD_ROUTES = { deal: 'deals', company: 'companies', contact: 'contacts', contract: 'contracts', dashboard: 'home' };

/** Route table: hash prefix -> renderer(root, id). "admin" is labelled Settings ("settings" is reserved by claude.ai). */
const ROUTES = {
  home: renderDashboard,
  dashboard: renderDashboard,
  deals: renderDeals,
  deal: renderDealRecord,
  companies: renderCompanies,
  company: renderCompanyRecord,
  contacts: renderContacts,
  contact: renderContactRecord,
  tasks: renderTasks,
  contracts: renderContracts,
  contract: renderContractRecord,
  placements: renderPlacements,
  calls: renderCalls,
  reports: renderReports,
  admin: renderAdmin,
};

/** Pages that draw their own full-bleed layout (record pages with a left panel). */
const FLUSH = new Set(['deal', 'company', 'contact', 'contract']);

/** Nav items visible to the current role, with badge counts. */
function navItems() {
  const counts = { calls: state().calls.filter((c) => !c.matched).length }; // unmatched calls badge
  return NAV.filter(([, , , roles]) => roles.includes(ctx.user.role)).map(([k, l, i, , tag]) => [k, l, i, counts[k] || 0, tag]);
}

export { parseRoute };

/** Whether the current user may open a page (record pages follow their index page). */
function allowed(page) {
  const index = RECORD_ROUTES[page] || page;
  if (HIDDEN_PAGES[index]) return HIDDEN_PAGES[index].includes(ctx.user.role);
  return navItems().some(([k]) => k === index);
}

/** Reminder items for the bell: my due tasks, contract alerts, unmatched calls. */
export function reminders() {
  const t = today(ctx.now());
  const items = [];
  for (const task of state().tasks) {
    if (task.done || task.assigneeId !== ctx.user.id) continue;
    if (task.dueDate <= t || (task.reminderDate && task.reminderDate <= t))
      items.push({
        text: `${task.dueDate < t ? 'Overdue' : 'Due'}: ${task.title}`,
        href: task.refType ? `#${task.refType}-${task.refId}` : '#tasks',
        warn: task.dueDate < t,
      });
  }
  const role = ctx.user.role;
  for (const a of contractAlerts(ctx.api.all('contract'), ctx.now())) {
    if (role === 'gtm' && a.contract.renewalOwnerId !== ctx.user.id) continue; // GTM only hears about contracts they own
    items.push({ text: `${a.contract.name} ends in ${a.days} days (${a.band}-day alert)`, href: `#contract-${a.contract.id}`, warn: a.band === 30 });
  }
  const inbox = state().calls.filter((c) => !c.matched).length;
  if (inbox && ['admin', 'gtm'].includes(role)) items.push({ text: `${inbox} unmatched call${inbox > 1 ? 's' : ''} in the inbox`, href: '#calls' });
  return items;
}

/** Paints the sidebar and top bar state. */
function renderChrome(page) {
  const current = RECORD_ROUTES[page] || page;
  $('#side').innerHTML = `<div class="brand"><span class="dot" aria-hidden="true"></span>${esc(APP_NAME)}</div>
    <nav aria-label="Main">${navItems()
      .map(
        ([k, l, i, n, tag]) =>
          `<a class="nav ${current === k ? 'on' : ''}" href="#${k}" ${current === k ? 'aria-current="page"' : ''}>${svg(i)}<span>${l}</span>${n ? `<span class="ct">${n}</span>` : tag ? `<span class="v2">${tag}</span>` : ''}</a>`,
      )
      .join('')}
    <div class="navsep"></div>
    <button class="nav" id="navAsk"><span class="dot" aria-hidden="true"></span><span>Ask Claude</span><span class="v2">V2</span></button>
    <a class="nav ${current === 'admin' ? 'on' : ''}" href="#admin"><span class="dot grey" aria-hidden="true"></span><span>Settings</span></a></nav>
    <div class="who"><div class="n">${esc(ctx.user.name)}</div><div class="r">${esc(ROLES[ctx.user.role])}</div><button id="outBtn">Sign out</button></div>`;
  $('#outBtn').onclick = () => ctx.signOut();
  $('#navAsk').onclick = () => openAskClaude();
  $('#meBtn').textContent = initials(ctx.user.name);
  $('#createBtn').hidden = !canEdit(ctx.user, 'deal', null) && !canEdit(ctx.user, 'task', null); // Finance creates nothing
  const n = reminders().length;
  $('#bellDot').hidden = !n;
  $('#bellDot').textContent = n;
}

/** Renders the current route into #view. */
export function render() {
  if (!ctx.user) return;
  const fresh = state().users.find((u) => u.id === ctx.user.id);
  if (!fresh || fresh.status !== USER_STATUS.ACTIVE) return ctx.signOut(); // deactivated mid-session
  ctx.user = fresh; // pick up role changes immediately
  const { page, id } = parseRoute(location.hash);
  const target = ROUTES[page] && allowed(page) ? page : 'home'; // unknown or forbidden routes fall back
  renderChrome(target);
  const view = $('#view');
  view.classList.toggle('flush', FLUSH.has(target)); // record pages draw their own panels edge to edge
  view.innerHTML = '';
  ROUTES[target](view, id);
  $('#side').classList.remove('open');
}

/** Wires global search with keyboard navigation (L-01). */
function bindSearch() {
  const q = $('#q');
  const box = $('#sres');
  let sel = -1;
  const run = () => {
    const v = q.value.trim().toLowerCase();
    if (v.length < 2) return void (box.hidden = true);
    const hit = (...xs) =>
      xs.some((x) =>
        String(x || '')
          .toLowerCase()
          .includes(v),
      );
    const s = state();
    const groups = [
      [
        'Deals',
        ctx.api
          .all('deal', { includeArchived: true })
          .filter((d) => hit(d.name, companyName(s, d.companyId), d.nextStep))
          .slice(0, 6)
          .map((d) => [`#deal-${d.id}`, d.name, companyName(s, d.companyId)]),
      ],
      [
        'Companies',
        ctx.api
          .all('company')
          .filter((c) => hit(c.name, c.domain, c.industry))
          .slice(0, 6)
          .map((c) => [`#company-${c.id}`, c.name, c.domain]),
      ],
      [
        'Contacts',
        ctx.api
          .all('contact')
          .filter((p) => hit(p.name, p.email, p.title))
          .slice(0, 6)
          .map((p) => [`#contact-${p.id}`, p.name, `${p.title} · ${companyName(s, p.companyId)}`]),
      ],
      [
        'Notes',
        s.notes
          .filter((n) => hit(stripHtml(n.body)) && (n.refType !== 'deal' || ctx.api.get('deal', n.refId)))
          .slice(0, 6)
          .map((n) => {
            const text = stripHtml(n.body);
            const i = text.toLowerCase().indexOf(v);
            const parent = n.refType === 'deal' ? dealName(s, n.refId) : n.refType === 'company' ? companyName(s, n.refId) : contactName(s, n.refId);
            return [`#${n.refType}-${n.refId}`, `…${text.slice(Math.max(0, i - 30), i + 50)}…`, parent]; // snippet around the match
          }),
      ],
    ].filter(([, list]) => list.length);
    box.innerHTML = groups.length
      ? groups
          .map(
            ([g, list]) =>
              `<div class="g">${g}</div>${list.map(([href, a, b]) => `<a href="${href}" role="option">${esc(a)}<small>${esc(b)}</small></a>`).join('')}`,
          )
          .join('')
      : `<div class="g">No matches for “${esc(q.value)}”</div>`;
    box.hidden = false;
    sel = -1;
  };
  q.addEventListener('input', run);
  q.addEventListener('focus', run);
  q.addEventListener('keydown', (e) => {
    const links = $$('a', box);
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && links.length) {
      e.preventDefault();
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length; // wrap around
      links.forEach((a, i) => a.classList.toggle('sel', i === sel));
    }
    if (e.key === 'Enter' && links.length) {
      location.hash = links[Math.max(0, sel)].getAttribute('href');
      box.hidden = true;
      q.blur();
    }
    if (e.key === 'Escape') {
      box.hidden = true;
      q.blur();
    }
  });
  box.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      box.hidden = true;
      q.value = '';
    }
  });
}

/** Wires static chrome once at boot. */
export function initShell() {
  bindSearch();
  $('#menuBtn').onclick = () => $('#side').classList.toggle('open');
  // "+ Create" menu: deal, company, contact or task from any page (B-02, E-02).
  const togglePop = (btn, pop, html, bind) => {
    const open = pop.hidden;
    for (const p of $$('.pop')) p.hidden = true; // one menu at a time
    if (!open) return;
    pop.innerHTML = html();
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    bind?.(pop);
  };
  $('#createBtn').onclick = () =>
    togglePop(
      $('#createBtn'),
      $('#createPop'),
      () =>
        [
          ['deal', 'Deal'],
          ['company', 'Company'],
          ['contact', 'Contact'],
          ['task', 'Task'],
        ]
          .filter(([t]) => canEdit(ctx.user, t, null))
          .map(([t, l]) => `<div class="it" role="menuitem" tabindex="0" data-new="${t}">${l}</div>`)
          .join(''),
      (pop) => {
        $$('[data-new]', pop).forEach(
          (it) =>
            (it.onclick = () => {
              pop.hidden = true;
              ({ deal: () => dealForm(), company: () => companyForm(), contact: () => contactForm(), task: () => taskForm() })[it.dataset.new]();
            }),
        );
      },
    );
  $('#askBtn').onclick = () => openAskClaude();
  $('#meBtn').onclick = () =>
    togglePop(
      $('#meBtn'),
      $('#mePop'),
      () =>
        `<div class="it" style="cursor:default"><span><b>${esc(ctx.user.name)}</b><br><span class="small muted">${esc(ROLES[ctx.user.role])}</span></span></div><div class="it" role="menuitem" data-me="settings">Settings</div><div class="it" role="menuitem" data-me="theme">Switch light or dark</div><div class="it" role="menuitem" data-me="out">Sign out</div>`,
      (pop) => {
        $$('[data-me]', pop).forEach(
          (it) =>
            (it.onclick = () => {
              pop.hidden = true;
              if (it.dataset.me === 'settings') location.hash = 'admin';
              if (it.dataset.me === 'theme') toggleTheme();
              if (it.dataset.me === 'out') ctx.signOut();
            }),
        );
      },
    );
  $('#bellBtn').onclick = () => {
    const pop = $('#bellPop');
    const items = reminders();
    pop.innerHTML = items.length
      ? items
          .map((i) => `<div class="it" data-h="${i.href}" role="button" tabindex="0">${i.warn ? '<span class="warn">●</span> ' : ''}${esc(i.text)}</div>`)
          .join('')
      : '<div class="it">You’re all caught up.</div>';
    const wasHidden = pop.hidden;
    for (const p of $$('.pop')) p.hidden = true;
    pop.hidden = !wasHidden;
    $$('[data-h]', pop).forEach((x) => (x.onclick = () => ((location.hash = x.dataset.h.slice(1)), (pop.hidden = true))));
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search')) $('#sres').hidden = true;
    if (!e.target.closest('.menuwrap')) for (const p of $$('.pop')) p.hidden = true; // click outside closes menus
  });
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('ikcrm.theme');
    if (saved) root.dataset.theme = saved;
  } catch {
    /* storage blocked: follow the system theme */
  }
  window.addEventListener('hashchange', () => {
    ctx.ui.timelineFilter = 'all'; // each record opens on all activity
    render();
  });
}
