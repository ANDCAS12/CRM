/**
 * @file App shell: sidebar navigation, hash router, global search (L-01), reminders bell (E-03, F-03)
 * and theme switch. Routes are plain #names so links work in the published artifact.
 */
import { USER_STATUS } from '../config/constants.js';
import { isAdmin } from '../core/permissions.js';
import { contractAlerts } from '../core/reports.js';
import { companyName, contactName, dealName } from '../core/lookups.js';
import { today } from '../utils/dates.js';
import { esc, stripHtml } from '../utils/format.js';
import { dealForm } from './actions.js';
import { ctx, state } from './context.js';
import { $, $$, svg } from './dom.js';
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
import { canEdit } from '../core/permissions.js';

/** Index pages and the roles that may open them (§3). */
const NAV = [
  ['dashboard', 'Dashboard', 'dash', ['admin', 'gtm', 'delivery', 'finance']],
  ['deals', 'Deals', 'deals', ['admin', 'gtm', 'delivery', 'finance']],
  ['companies', 'Companies', 'co', ['admin', 'gtm', 'delivery', 'finance']],
  ['contacts', 'Contacts', 'ct', ['admin', 'gtm', 'delivery']],
  ['tasks', 'Tasks', 'task', ['admin', 'gtm', 'delivery']],
  ['contracts', 'Contracts', 'k', ['admin', 'gtm', 'delivery', 'finance']],
  ['calls', 'Calls', 'call', ['admin', 'gtm']],
  ['reports', 'Reports', 'rep', ['admin', 'gtm', 'delivery', 'finance']],
];

/** Record page routes map to their index page for nav highlighting. */
const RECORD_ROUTES = { deal: 'deals', company: 'companies', contact: 'contacts', contract: 'contracts' };

/** Route table: hash prefix -> renderer(root, id). */
const ROUTES = {
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
  calls: renderCalls,
  reports: renderReports,
  admin: renderAdmin,
};

/** Nav items visible to the current role, with badge counts. */
function navItems() {
  const t = today(ctx.now());
  const counts = {
    tasks: state().tasks.filter((x) => !x.done && x.assigneeId === ctx.user.id && x.dueDate <= t).length,
    calls: state().calls.filter((c) => !c.matched).length,
  };
  return NAV.filter(([, , , roles]) => roles.includes(ctx.user.role)).map(([k, l, i]) => [k, l, i, counts[k] || 0]);
}

/** Parses "#deal-d_123" into { page: 'deal', id: 'd_123' }. */
export function parseRoute(hash) {
  const h = String(hash || '').replace(/^#/, '') || 'dashboard';
  const dash = h.indexOf('-');
  return dash === -1 ? { page: h, id: '' } : { page: h.slice(0, dash), id: h.slice(dash + 1) };
}

/** Whether the current user may open a page (record pages follow their index page). */
function allowed(page) {
  if (page === 'admin') return isAdmin(ctx.user);
  const index = RECORD_ROUTES[page] || page;
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
  $('#side').innerHTML = `<div class="brand"><div class="mark">IK</div><div><b>IK CRM</b><small>Pipeline and relationships</small></div></div>
    <nav aria-label="Main">${navItems()
      .map(
        ([k, l, i, n]) =>
          `<a class="nav ${current === k ? 'on' : ''}" href="#${k}" ${current === k ? 'aria-current="page"' : ''}>${svg(i)}<span>${l}</span>${n ? `<span class="ct">${n}</span>` : ''}</a>`,
      )
      .join('')}
    ${isAdmin(ctx.user) ? `<div class="navsep"></div><a class="nav ${current === 'admin' ? 'on' : ''}" href="#admin">${svg('admin')}<span>Admin</span></a>` : ''}</nav>
    <div class="who"><div class="n">${esc(ctx.user.name)}</div><div class="r">${esc({ admin: 'Admin', gtm: 'GTM', delivery: 'Delivery and talent', finance: 'Finance (read)' }[ctx.user.role])}</div><button id="outBtn">Sign out</button></div>`;
  $('#outBtn').onclick = () => ctx.signOut();
  $('#newBtn').hidden = !canEdit(ctx.user, 'deal', null);
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
  const target = ROUTES[page] && allowed(page) ? page : 'dashboard'; // unknown or forbidden routes fall back
  renderChrome(target);
  const view = $('#view');
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
  $('#newBtn').onclick = () => dealForm();
  $('#bellBtn').onclick = () => {
    const pop = $('#bellPop');
    const items = reminders();
    pop.innerHTML = items.length
      ? items
          .map((i) => `<div class="it" data-h="${i.href}" role="button" tabindex="0">${i.warn ? '<span class="warn">●</span> ' : ''}${esc(i.text)}</div>`)
          .join('')
      : '<div class="it">You’re all caught up.</div>';
    pop.hidden = !pop.hidden;
    $$('[data-h]', pop).forEach((x) => (x.onclick = () => ((location.hash = x.dataset.h.slice(1)), (pop.hidden = true))));
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search')) $('#sres').hidden = true;
    if (!e.target.closest('#bellBtn') && !e.target.closest('#bellPop')) $('#bellPop').hidden = true;
  });
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem('ikcrm.theme');
    if (saved) root.dataset.theme = saved;
  } catch {
    /* storage blocked: follow the system theme */
  }
  $('#themeBtn').onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try {
      localStorage.setItem('ikcrm.theme', root.dataset.theme);
    } catch {
      /* non-fatal */
    }
  };
  window.addEventListener('hashchange', () => {
    ctx.ui.timelineFilter = 'all'; // each record opens on all activity
    render();
  });
}
