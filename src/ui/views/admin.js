/**
 * @file Admin (Access, M-01, M-02): users and roles with a summary and pending invites,
 * audit log, imports with history, backups and full export, integration status.
 */
import { COLLECTIONS, LABELS, ROLES, USER_STATUS } from '../../config/constants.js';
import { PRESETS } from '../../core/importer.js';
import { randomToken } from '../../core/auth.js';
import { userName, firstName } from '../../core/lookups.js';
import { esc, fmtDateTime, truncate } from '../../utils/format.js';
import { saveFile } from '../../platform/capabilities.js';
import { exportRows, refLink } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, confirmDialog, modal, toast } from '../dom.js';
import { inputHtml } from '../forms.js';
import { openImportDialog, viewImportedRecords } from '../components/importDialog.js';

const TABS = [
  ['users', 'Users and teams'],
  ['audit', 'Audit log'],
  ['import', 'Imports'],
  ['data', 'Backups and export'],
  ['int', 'Integrations'],
];

export function renderAdmin(root) {
  const tab = ctx.ui.adminTab;
  root.innerHTML = `<div class="pagehead"><div><h1>Admin</h1><div class="sub">Users, audit log, imports, backups and integrations</div></div></div>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-at="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l}</button>`).join('')}</div><div id="adm"></div>`;
  $$('[data-at]', root).forEach((b) => (b.onclick = () => ((ctx.ui.adminTab = b.dataset.at), ctx.render())));
  ({ users, audit, import: imports, data, int: integrations })[tab]($('#adm', root));
}

/** Shows the one-time invite code for a pending user. */
function showInvite(user) {
  const m = modal(
    'Invite ready',
    `<p>Send <b>${esc(user.name)}</b> this invite code. They choose “Accept an invite” on the sign-in screen, enter their email and this code, and set a password.</p><div class="codebox"><span style="flex:1" id="invCode">${esc(user.inviteToken)}</span><button class="btn sm" id="copyInv">Copy</button></div><p class="small muted">In production the invite is emailed with a sign-up link.</p>`,
    { cancelLabel: 'Done' },
  );
  $('#copyInv', m.body).onclick = async () => {
    try {
      await navigator.clipboard.writeText(user.inviteToken);
      toast('Invite code copied');
    } catch {
      const range = document.createRange(); // clipboard API blocked: select the text instead
      range.selectNodeContents($('#invCode', m.body));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      toast('Press Ctrl+C or Cmd+C to copy');
    }
  };
}

function users(el) {
  const list = ctx.api.all('user'); // scrubbed: no password hashes ever reach the UI
  const count = (fn) => list.filter(fn).length;
  el.innerHTML = `<div class="stats" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat"><div class="k">Total users</div><div class="v">${list.length}</div></div>
      <div class="stat"><div class="k">Active</div><div class="v">${count((u) => u.status === USER_STATUS.ACTIVE)}</div></div>
      <div class="stat"><div class="k">Pending invites</div><div class="v ${count((u) => u.status === USER_STATUS.INVITED) ? 'key' : ''}">${count((u) => u.status === USER_STATUS.INVITED)}</div></div>
      <div class="stat"><div class="k">By role</div><div class="small" style="margin-top:6px">${Object.entries(ROLES)
        .map(([k, l]) => `${esc(l)}: ${count((u) => u.role === k && u.status !== USER_STATUS.DEACTIVATED)}`)
        .join('<br>')}</div></div></div>
    <div class="tools"><div class="sp"></div><button class="btn pri" id="inv">Invite user</button></div>
    <div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>
    ${list
      .map((u) => {
        const me = u.id === ctx.user.id;
        const actions = me
          ? ''
          : u.status === USER_STATUS.INVITED
            ? `<button class="btn sm" data-showinv="${u.id}">Invite code</button> <button class="btn sm" data-revoke="${u.id}">Revoke</button>`
            : `<button class="btn sm" data-toggle="${u.id}">${u.status === USER_STATUS.ACTIVE ? 'Deactivate' : 'Reactivate'}</button>`;
        return `<tr><td><b>${esc(u.name)}</b>${me ? ' <span class="pill">You</span>' : ''}</td><td>${esc(u.email)}</td><td><select class="cellin" style="width:auto" data-urole="${u.id}" ${me ? 'disabled' : ''} aria-label="Role for ${esc(u.name)}">${Object.entries(
          ROLES,
        )
          .map(([k, l]) => `<option value="${k}"${u.role === k ? ' selected' : ''}>${l}</option>`)
          .join(
            '',
          )}</select></td><td>${u.status === USER_STATUS.INVITED ? '<span class="pill">Pending invite</span>' : u.status === USER_STATUS.ACTIVE ? 'Active' : 'Deactivated'}</td><td style="white-space:nowrap">${actions}</td></tr>`;
      })
      .join('')}</tbody></table></div>
    <div class="card" style="margin-top:14px"><h2>What each role can do</h2><div class="tablewrap" style="margin-top:10px"><table class="t"><thead><tr><th>Role</th><th>Can see</th><th>Can edit</th></tr></thead><tbody>
      <tr><td>Admin</td><td>Everything, including the audit log</td><td>Everything, plus users</td></tr>
      <tr><td>GTM</td><td>All deals, companies, contacts, calls. Not contract values or rates</td><td>Own and shared deals, contacts, companies, tasks, notes</td></tr>
      <tr><td>Delivery and talent</td><td>Deals in contracting and won, contracts (no values), placements</td><td>Contract dates, placements, notes, tasks</td></tr>
      <tr><td>Finance (read)</td><td>Contracts with values, deals, forecasts</td><td>Nothing</td></tr></tbody></table></div></div>`;

  $$('[data-urole]', el).forEach((s) => (s.onchange = () => (ctx.api.update('user', s.dataset.urole, { role: s.value }), toast('Role updated'))));
  $$('[data-toggle]', el).forEach(
    (b) =>
      (b.onclick = () => {
        const u = ctx.api.raw('user', b.dataset.toggle);
        const next = u.status === USER_STATUS.ACTIVE ? USER_STATUS.DEACTIVATED : USER_STATUS.ACTIVE;
        ctx.api.update('user', u.id, { status: next });
        toast(next === USER_STATUS.ACTIVE ? 'User reactivated' : 'User deactivated');
        rerender();
      }),
  );
  $$('[data-showinv]', el).forEach((b) => (b.onclick = () => showInvite(ctx.api.get('user', b.dataset.showinv))));
  $$('[data-revoke]', el).forEach(
    (b) =>
      (b.onclick = async () => {
        if (!(await confirmDialog('Revoke invite', 'The invite code will stop working and the user is removed.', 'Revoke invite'))) return;
        ctx.api.remove('user', b.dataset.revoke);
        toast('Invite revoked');
        rerender();
      }),
  );
  $('#inv', el).onclick = () =>
    modal(
      'Invite user',
      `<div class="grid2"><div><label class="l" for="iN">Name</label><input class="f" id="iN" autocomplete="off"></div><div><label class="l" for="iE">Email</label><input class="f" id="iE" type="email" autocomplete="off"></div><div><label class="l" for="f_iR">Role</label>${inputHtml({ k: 'iR', t: 'select', o: Object.entries(ROLES) }, 'gtm')}</div></div><p class="small muted">Start teammates with the least access they need. You can change the role later.</p>`,
      {
        saveLabel: 'Send invite',
        onSave: (body) => {
          const name = $('#iN', body).value.trim();
          const email = $('#iE', body).value.trim().toLowerCase();
          if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Add a name and a valid email.');
          if (state().users.some((u) => u.email === email)) throw new Error('That email already has an account.');
          const user = ctx.api.create('user', { name, email, role: $('#f_iR', body).value, status: USER_STATUS.INVITED, inviteToken: randomToken(6) });
          rerender();
          setTimeout(() => showInvite(user), 30);
        },
      },
    );
}

function audit(el) {
  const filter = ctx.ui.auditFilter;
  const rows = state()
    .audit.filter((a) => !filter || a.entity === filter)
    .slice(0, 300); // latest 300 on screen; export has all
  el.innerHTML = `<div class="tools"><select class="f" id="auF" style="width:auto" aria-label="Record type"><option value="">All records</option>${Object.keys(
    COLLECTIONS,
  )
    .map((k) => `<option value="${k}"${filter === k ? ' selected' : ''}>${LABELS[k]}</option>`)
    .join(
      '',
    )}<option value="import"${filter === 'import' ? ' selected' : ''}>Import</option></select><span class="small muted">${state().audit.length.toLocaleString()} entries · showing latest ${rows.length}</span><div class="sp"></div><button class="btn" id="auX">Export CSV</button></div>
  <div class="tablewrap"><table class="t"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Field</th><th>Old value</th><th>New value</th></tr></thead><tbody>${rows
    .map((a) => {
      const linkable = ['deal', 'company', 'contact', 'contract'].includes(a.entity) && ctx.api.raw(a.entity, a.entityId);
      return `<tr><td class="small">${fmtDateTime(a.at)}</td><td>${esc(userName(state(), a.userId))}</td><td>${esc(a.action)}</td><td>${esc(LABELS[a.entity] || a.entity)}: ${linkable ? refLink(a.entity, a.entityId) : esc(a.entityId)}</td><td>${esc(a.field)}</td><td class="small">${esc(truncate(a.old, 60))}</td><td class="small">${esc(truncate(a.new, 60))}</td></tr>`;
    })
    .join('')}</tbody></table>${rows.length ? '' : '<div class="empty">No changes recorded yet. Every create, edit and delete shows up here.</div>'}</div>`;
  $('#auF', el).onchange = (e) => ((ctx.ui.auditFilter = e.target.value), ctx.render());
  $('#auX', el).onclick = () =>
    exportRows(
      'ik-audit-log',
      state().audit.map((a) => ({
        When: a.at,
        Who: userName(state(), a.userId),
        Action: a.action,
        Record: a.entity,
        'Record id': a.entityId,
        Field: a.field,
        'Old value': a.old,
        'New value': a.new,
      })),
      'csv',
    );
}

function imports(el) {
  const past = state().imports;
  el.innerHTML = `<div class="card"><h2>Start an import</h2><p class="muted">Upload a CSV or Excel export, check the column mapping, choose whether to update existing records, and get a summary of anything that couldn’t be mapped. HubSpot imports keep original created dates and owners.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${Object.entries(PRESETS)
      .map(([k, p]) => `<button class="btn" data-imp="${k}">${esc(p.label)}</button>`)
      .join('')}</div></div>
  <div class="card"><div class="cardh"><h2>Past imports</h2><span class="faint small">${past.length}</span></div>${
    past.length
      ? `<div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Type</th><th>Mode</th><th class="num">Created</th><th class="num">Updated</th><th class="num">Skipped</th><th>When</th><th></th></tr></thead><tbody>${past
          .slice(0, 50)
          .map(
            (i) =>
              `<tr><td><b>${esc(i.name)}</b><div class="small faint">${esc(i.file)}</div></td><td>${esc(i.label)}</td><td>${i.mode === 'upsert' ? 'Create and update' : 'Create'}</td><td class="num">${i.created}</td><td class="num">${i.updated}</td><td class="num">${i.skipped}</td><td class="small">${fmtDateTime(i.at)} · ${esc(firstName(state(), i.by))}</td><td>${i.recordIds?.contact?.length || i.recordIds?.company?.length ? `<button class="btn sm" data-viewimp="${i.id}">View records</button>` : ''}</td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : '<div class="small muted" style="margin-top:6px">None yet.</div>'
  }</div>`;
  $$('[data-imp]', el).forEach((b) => (b.onclick = () => openImportDialog(b.dataset.imp, viewImportedRecords)));
  $$('[data-viewimp]', el).forEach((b) => (b.onclick = () => viewImportedRecords(past.find((i) => i.id === b.dataset.viewimp))));
}

function data(el) {
  const s = state();
  const counts = Object.entries(COLLECTIONS)
    .map(([k, c]) => `${LABELS[k]}s: ${(s[c] || []).length}`)
    .join(' · ');
  el.innerHTML = `<div class="card"><h2>Full data export</h2><p class="muted">Every table, including the audit log. ${esc(counts)}</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="dxX">Export all as Excel</button><button class="btn" id="dxJ">Export all as JSON</button></div></div>
  <div class="card"><h2>Backups</h2><p class="muted">Production runs a nightly PostgreSQL backup (pg_dump, 30-day retention). This prototype keeps data in your browser, so take a snapshot before testing imports.</p><p class="small">Last snapshot: ${s.settings.lastBackup ? fmtDateTime(s.settings.lastBackup) : 'never'}</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="bkS">Take snapshot now</button><button class="btn" id="bkR" ${ctx.store.hasSnapshot() ? '' : 'disabled'}>Restore last snapshot</button><button class="btn" id="rst">Reset to demo data</button></div></div>`;
  const exportable = () => {
    const copy = JSON.parse(JSON.stringify(s));
    for (const u of copy.users) {
      delete u.passwordHash; // exports never include credentials
      delete u.salt;
    }
    return copy;
  };
  $('#dxJ', el).onclick = () =>
    saveFile(ctx.caps.downloads, `ik-crm-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportable(), null, 2), toast);
  $('#dxX', el).onclick = () => {
    if (!window.XLSX) return toast('Excel library didn’t load. Use JSON.');
    const copy = exportable();
    const wb = window.XLSX.utils.book_new();
    for (const c of [...Object.values(COLLECTIONS), 'audit', 'imports']) {
      if (!copy[c]?.length) continue;
      const rows = copy[c].map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && typeof v === 'object' ? JSON.stringify(v) : v]))); // flatten nested values
      window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rows), c.slice(0, 31)); // sheet names max 31 chars
    }
    saveFile(
      ctx.caps.downloads,
      `ik-crm-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      new Blob([window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' })]),
      toast,
    );
  };
  $('#bkS', el).onclick = () => {
    try {
      s.settings.lastBackup = ctx.now().toISOString();
      ctx.store.snapshot();
      ctx.store.save();
      toast('Snapshot saved');
    } catch {
      toast('Snapshot failed: browser storage is full');
    }
    rerender();
  };
  $('#bkR', el).onclick = async () => {
    if (!(await confirmDialog('Restore snapshot', 'Replace all current data with the last snapshot?', 'Restore'))) return;
    ctx.store.restoreSnapshot();
    toast('Snapshot restored');
    ctx.render();
  };
  $('#rst', el).onclick = async () => {
    if (!(await confirmDialog('Reset demo data', 'Erase all data and reload the demo data?', 'Reset'))) return;
    ctx.store.reset();
    ctx.user = state().users.find((u) => u.id === ctx.user.id) || state().users[0];
    toast('Demo data reloaded');
    ctx.render();
  };
}

function integrations(el) {
  const row = (name, status, detail) =>
    `<li><span style="flex:1"><b>${name}</b><div class="small muted">${detail}</div></span><span class="pill">${status}</span></li>`;
  el.innerHTML = `<div class="card"><h2>Integrations</h2><ul class="mini" style="margin-top:8px">
    ${row('Fireflies', 'Demo mode', 'Sync replays sample calls. Production uses the Fireflies GraphQL API with a webhook, polling every 15 minutes as a fallback. Needs: Fireflies API key.')}
    ${row('Claude', 'Connected', 'Deal summaries run on the viewer’s Claude account (claude-sonnet-5-5). Production calls the Anthropic API server-side.')}
    ${row('SharePoint (Microsoft Graph)', 'Links only', 'Folder links are stored; file lists are sample data. Needs: Entra app ID, tenant ID and secret with Sites.Read.All.')}
    ${row('Email reminders', 'Queued', 'Task reminders show in the bell. Production sends them through Microsoft 365 or a transactional email service.')}
    ${row('HubSpot', 'Import only', 'Use Imports to load HubSpot CSV exports before cancelling.')}</ul></div>`;
}
