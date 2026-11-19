/**
 * @file Dashboards (build brief slides 19 and 20; L-05, L-06, L-12 to L-14). Reports is now Dashboards:
 * default dashboards (pipeline, funnel, revenue, marketing return) plus custom ones, built from saved reports.
 * A report is built once (object, measure, grouping, filters, chart type), saved to the library and added to any
 * dashboard. Dashboards have filters, a per-person default, private or team sharing, and export.
 */
import { PIPELINES, SOURCES } from '../../config/constants.js';
import { canEdit, canSeeRestricted } from '../../core/permissions.js';
import {
  CHART_TYPES,
  DATE_RANGES,
  DEFAULT_DASHBOARDS,
  FUTURE_OBJECTS,
  REPORT_OBJECTS,
  REPORT_TEMPLATES,
  exportDashboardRows,
  groupValues,
  labelFor,
  runReport,
} from '../../core/reportEngine.js';
import { esc } from '../../utils/format.js';
import { clone } from '../../utils/object.js';
import { exportRows } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { renderChart } from '../components/reportCharts.js';

/** Dashboards this person can open: the defaults, their own, and team dashboards. */
function visibleDashboards() {
  const custom = state().dashboards.filter((d) => d.ownerId === ctx.user.id || d.visibility === 'team');
  return [...DEFAULT_DASHBOARDS.map((d) => ({ ...d, builtIn: true })), ...custom];
}

/** Reports shown on a dashboard: built-in definitions or saved reports by id. */
const reportsOf = (d) => (d.builtIn ? d.reports : (d.reportIds || []).map((id) => state().reports.find((r) => r.id === id)).filter(Boolean));

/** Records a report runs on: whatever the API lets this person see (role rules and restricted fields apply). */
const recordsFor = (object) => ctx.api.all(object);

const groupLabel = (object, key) => REPORT_OBJECTS[object].groups.find(([k]) => k === key)?.[1] || key;
const measureLabel = (object, key) => REPORT_OBJECTS[object].measures.find(([k]) => k === key)?.[1] || key;
const canManage = (d) => !d.builtIn && canEdit(ctx.user, 'dashboard', d);
const myDefault = () => state().prefs?.[ctx.user.id]?.dashboard || 'def_pipeline';

/** Report card on a dashboard. */
function card(rep, d, filters) {
  const res = runReport(state(), recordsFor(rep.object), rep, filters, ctx.now());
  const restricted = /totalValue/.test(rep.measure) && !canSeeRestricted(ctx.user.role);
  return `<div class="card ${rep.chart === 'kpi' ? 'kpic' : ''}"><div class="cardh"><h2>${esc(rep.name)}</h2>${d.tag ? `<span class="v2">${d.tag}</span>` : ''}<span class="menu">${canManage(d) ? `<button class="btn ghost sm" data-rm="${rep.id}" aria-label="Remove ${esc(rep.name)} from this dashboard">Remove</button>` : ''}</span></div>
    ${restricted ? '<p class="lock" style="margin:0 0 6px">Contract values are restricted for your role.</p>' : ''}${renderChart(res, rep, groupLabel(rep.object, rep.groupBy))}</div>`;
}

export function renderDashboards(root) {
  const ui = ctx.ui;
  ui.dash = ui.dash || { id: '', filters: {}, builder: null };
  if (ui.dash.builder) return renderBuilder(root);
  const list = visibleDashboards();
  const d = list.find((x) => x.id === (ui.dash.id || myDefault())) || list[0];
  ui.dash.id = d.id;
  const f = ui.dash.filters;
  const reps = reportsOf(d);
  const canCreate = canEdit(ctx.user, 'dashboard', null);
  const fsel = (k, opts, label) =>
    `<select class="fsel ${f[k] && f[k] !== 'all' ? 'on' : ''}" data-df="${k}" aria-label="${label}">${opts.map(([v, l]) => `<option value="${esc(v)}"${(f[k] || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const custom = list.filter((x) => !x.builtIn);

  root.innerHTML = `<div class="pagehead"><h1>Dashboards</h1>
      <select class="fsel" id="dashPick" aria-label="Dashboard"><optgroup label="Default dashboards">${list
        .filter((x) => x.builtIn)
        .map((x) => `<option value="${x.id}"${x.id === d.id ? ' selected' : ''}>${esc(x.name)}${x.tag ? ` (${x.tag})` : ''}</option>`)
        .join(
          '',
        )}</optgroup>${custom.length ? `<optgroup label="Custom dashboards">${custom.map((x) => `<option value="${x.id}"${x.id === d.id ? ' selected' : ''}>${esc(x.name)}${x.visibility === 'team' ? '' : ' (private)'}</option>`).join('')}</optgroup>` : ''}</select>
      ${d.id === myDefault() ? '<span class="small faint">Default</span>' : '<button class="linkbtn" id="setDef">Set as default</button>'}
      <div class="sp"></div>
      ${canManage(d) ? '<button class="btn" id="dShare">Share</button>' : ''}<button class="btn" id="dExport">Export</button>
      ${canManage(d) ? '<button class="btn" id="dAdd">+ Add report</button>' : ''}${canCreate ? '<button class="btn pri" id="dNew">Create dashboard</button>' : ''}</div>
    <div class="fbar" aria-label="Dashboard filters"><span class="small faint">Dashboard filters</span>
      ${fsel('range', DATE_RANGES, 'Date range')}
      ${fsel(
        'ownerId',
        [
          ['', 'Owner: All'],
          ...state()
            .users.filter((u) => u.status === 'active')
            .map((u) => [u.id, `Owner: ${u.name}`]),
        ],
        'Owner',
      )}
      ${fsel('pipeline', [['', 'Pipeline: All'], ...PIPELINES.map((p) => [p, `Pipeline: ${p}`])], 'Pipeline')}
      ${fsel('source', [['', 'Source: All'], ...SOURCES.map((s) => [s, `Source: ${s}`])], 'Source')}
    </div>
    ${d.builtIn ? `<p class="small muted" style="margin:-4px 0 12px">Default dashboard, read-only. To change it, use <b>Create dashboard</b> and start from this template.</p>` : ''}
    ${
      d.id === 'def_marketing'
        ? '<div class="card placeholder" style="max-width:760px"><div class="cardh"><h2>Marketing return</h2><span class="v3 v2">V3</span></div><p style="margin:0" class="small muted">Spend by channel and month compared with pipeline, revenue and time to close by source, once marketing spend is logged (L-11). Pipeline coverage (L-10) also lands in V3.</p></div>'
        : reps.length
          ? `<div class="dgrid">${reps.map((r) => card(r, d, f)).join('')}</div>`
          : `<div class="empty">No reports on this dashboard yet.${canManage(d) ? ' Click <b>+ Add report</b> to build one.' : ''}</div>`
    }`;

  $('#dashPick', root).onchange = (e) => ((ui.dash.id = e.target.value), ctx.render());
  $$('[data-df]', root).forEach((s) => (s.onchange = () => ((f[s.dataset.df] = s.value), rerender())));
  $('#setDef', root)?.addEventListener('click', () => {
    const prefs = state().prefs || (state().prefs = {});
    prefs[ctx.user.id] = { ...prefs[ctx.user.id], dashboard: d.id }; // per person (L-14)
    ctx.store.save();
    toast(`${d.name} is now your default dashboard`);
    rerender();
  });
  $('#dExport', root).onclick = () =>
    exportRows(`dashboard-${d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, exportDashboardRows(state(), recordsFor, reps, f, ctx.now()), 'csv');
  $('#dNew', root)?.addEventListener('click', createDashboard);
  $('#dShare', root)?.addEventListener('click', () => shareDashboard(d));
  $('#dAdd', root)?.addEventListener('click', () => openBuilder(d.id));
  $$('[data-rm]', root).forEach(
    (b) =>
      (b.onclick = () => {
        ctx.api.update('dashboard', d.id, { reportIds: d.reportIds.filter((id) => id !== b.dataset.rm) });
        toast('Report removed from the dashboard; it stays in the library');
        rerender();
      }),
  );
}

/** "Create dashboard": from scratch or a default dashboard as template (L-12). */
function createDashboard() {
  modal(
    'Create dashboard',
    `<div class="grid2"><div class="full"><label class="l" for="dnName">Name *</label><input class="f" id="dnName" placeholder="e.g. Funnel and sources"></div>
     <div><label class="l" for="dnFrom">Start from</label><select class="f" id="dnFrom"><option value="">Blank dashboard</option>${DEFAULT_DASHBOARDS.filter(
       (x) => x.reports.length,
     )
       .map((x) => `<option value="${x.id}">Template: ${esc(x.name)}</option>`)
       .join('')}</select></div>
     <div><label class="l" for="dnVis">Visibility</label><select class="f" id="dnVis"><option value="team">Team</option><option value="private">Private</option></select></div></div>`,
    {
      saveLabel: 'Create dashboard',
      onSave: (body) => {
        const name = $('#dnName', body).value.trim();
        if (!name) throw new Error('Name the dashboard.');
        const visibility = $('#dnVis', body).value;
        const tpl = DEFAULT_DASHBOARDS.find((x) => x.id === $('#dnFrom', body).value);
        const reportIds = (tpl?.reports || []).map((r) => {
          const copy = clone(r);
          delete copy.id;
          return ctx.api.create('report', { ...copy, ownerId: ctx.user.id, visibility, inLibrary: false }, { persist: false }).id;
        });
        const dash = ctx.api.create('dashboard', { name, ownerId: ctx.user.id, visibility, reportIds });
        ctx.ui.dash.id = dash.id;
        toast('Dashboard created');
        ctx.render();
      },
    },
  );
}

/** Private or team sharing (L-14). */
function shareDashboard(d) {
  modal(
    'Share dashboard',
    `<label class="radio"><input type="radio" name="vis" value="private"${d.visibility === 'private' ? ' checked' : ''}><span><b>Private</b><br><span class="small muted">Only you see it.</span></span></label>
     <label class="radio"><input type="radio" name="vis" value="team"${d.visibility === 'team' ? ' checked' : ''}><span><b>Team</b><br><span class="small muted">Everyone at IK can open it; only you can change it. Each person still sees only the data their role allows.</span></span></label>`,
    {
      saveLabel: 'Save',
      onSave: (body) => {
        ctx.api.update('dashboard', d.id, { visibility: body.querySelector('input[name=vis]:checked').value });
        toast('Sharing updated');
        rerender();
      },
    },
  );
}

/* ---------------- report builder (slide 20) ---------------- */

const blankReport = (object = 'deal') => {
  const meta = REPORT_OBJECTS[object];
  return {
    name: '',
    object,
    measure: meta.measures[0][0],
    groupBy: meta.groups[0][0],
    thenBy: '',
    filters: [
      { field: '', value: '' },
      { field: '', value: '' },
    ],
    chart: 'bar',
    visibility: 'team',
    inLibrary: true,
  };
};

function openBuilder(dashboardId) {
  ctx.ui.dash.builder = { draft: blankReport(), target: dashboardId, tpl: 'scratch' };
  ctx.render();
}

/** Distinct values of a grouping across the visible records, for filter value pickers. */
function valuesFor(object, key) {
  const seen = new Map();
  for (const r of recordsFor(object)) for (const v of groupValues(state(), object, r, key, ctx.now())) seen.set(v, labelFor(state(), key, v));
  return [...seen].sort((a, b) => a[1].localeCompare(b[1]));
}

function renderBuilder(root) {
  const b = ctx.ui.dash.builder;
  const r = b.draft;
  const meta = REPORT_OBJECTS[r.object];
  const target = state().dashboards.find((x) => x.id === b.target);
  const mine = state().dashboards.filter((x) => canEdit(ctx.user, 'dashboard', x));
  const library = state().reports.filter((x) => x.inLibrary && (x.ownerId === ctx.user.id || x.visibility === 'team'));
  const autoName = `${measureLabel(r.object, r.measure)} by ${groupLabel(r.object, r.groupBy).toLowerCase()}${r.thenBy ? ` and ${groupLabel(r.object, r.thenBy).toLowerCase()}` : ''}`;
  const res = runReport(state(), recordsFor(r.object), r, ctx.ui.dash.filters, ctx.now());
  const opt = (list, val) => list.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const filterRow = (fl, i) =>
    `<div class="grid2" style="gap:6px;margin-top:6px"><select class="f" data-bf="${i}" aria-label="Filter ${i + 1} field">${opt([['', 'No filter'], ...meta.groups], fl.field)}</select>${fl.field ? `<select class="f" data-bv="${i}" aria-label="Filter ${i + 1} value">${opt([['', 'Any value'], ...valuesFor(r.object, fl.field)], fl.value)}</select>` : '<span></span>'}</div>`;

  root.innerHTML = `<div class="pagehead"><div><h1>Dashboards</h1><div class="sub">${esc(target?.name || 'Reports library')} › Add report</div></div><div class="sp"></div><button class="btn" id="bCancel">Cancel</button><button class="btn pri" id="bSave">Save report</button></div>
  <div class="card" style="margin-bottom:14px"><div class="cardh"><h2>Start from a template or from scratch</h2></div>
    <div class="tpls"><button class="${b.tpl === 'scratch' ? 'on' : ''}" data-tpl="scratch">From scratch</button>${REPORT_TEMPLATES.map((t) => `<button class="${b.tpl === t.id ? 'on' : ''}" data-tpl="${t.id}">${esc(t.name)}</button>`).join('')}<button disabled title="Invoices arrive in V2">Invoices by status <span class="v2">V2</span></button></div>
    ${library.length && target ? `<div style="display:flex;gap:8px;align-items:center;margin-top:12px"><span class="small muted">Or add a saved report:</span><select class="fsel" id="libPick" aria-label="Saved report">${opt([['', 'Reports library'], ...library.map((x) => [x.id, x.name])], '')}</select><button class="btn sm" id="libAdd">Add to dashboard</button></div>` : ''}</div>
  <div class="builder">
    <div class="card"><div class="cardh"><h2>Build the report</h2></div>
      <label class="l" for="bObj">1. Object</label><select class="f" id="bObj">${opt(
        Object.entries(REPORT_OBJECTS).map(([k, m]) => [k, m.label]),
        r.object,
      )}${FUTURE_OBJECTS.map(([k, l]) => `<option value="${k}" disabled>${l}</option>`).join('')}</select>
      <label class="l" for="bMeasure">2. Measure</label><select class="f" id="bMeasure">${opt(meta.measures, r.measure)}</select>
      <label class="l" for="bGroup">3. Group by</label><select class="f" id="bGroup">${opt(meta.groups, r.groupBy)}</select>
      <label class="l" for="bThen">4. Then by</label><select class="f" id="bThen">${opt([['', 'None'], ...meta.groups.filter(([k]) => k !== r.groupBy)], r.thenBy)}</select>
      <span class="l" style="margin-top:10px">5. Filters</span>${r.filters.map(filterRow).join('')}
      <label class="l" for="bChart">6. Chart type</label><select class="f" id="bChart">${opt(CHART_TYPES, r.chart)}</select>
      <p class="small faint" style="margin:12px 0 0">Objects: deals, companies, contacts, tasks, calls, contracts. Placements and invoices arrive in V2. The preview uses the dashboard filters and only the data your role can see.</p></div>
    <div style="display:grid;gap:14px">
      <div class="card"><div class="cardh"><h2>Preview</h2><span class="menu">${CHART_TYPES.map(([k, l]) => `<button class="chipbtn ${r.chart === k ? 'on' : ''}" data-ct="${k}">${l}</button>`).join('')}</span></div>
        <label class="l" for="bName">Report name</label><input class="f" id="bName" value="${esc(r.name)}" placeholder="${esc(autoName)}" style="margin-bottom:12px">
        ${renderChart(res, r, groupLabel(r.object, r.groupBy))}</div>
      <div class="card"><div class="cardh"><h2>Save</h2></div><div class="grid2">
        <div><label class="l" for="bTarget">Add to</label><select class="f" id="bTarget">${opt([['', 'No dashboard (library only)'], ...mine.map((x) => [x.id, x.name])], b.target || '')}</select></div>
        <div><label class="l" for="bVis">Visibility</label><select class="f" id="bVis">${opt(
          [
            ['team', 'Team'],
            ['private', 'Private'],
          ],
          r.visibility,
        )}</select></div>
        <label class="chk full"><input type="checkbox" id="bLib" ${r.inLibrary ? 'checked' : ''}> Also save to the reports library</label></div></div>
    </div>
  </div>`;

  const set = (patch) => {
    Object.assign(r, patch);
    rerender();
  };
  $('#bCancel', root).onclick = () => ((ctx.ui.dash.builder = null), ctx.render());
  $$('[data-tpl]', root).forEach(
    (btn) =>
      (btn.onclick = () => {
        const t = REPORT_TEMPLATES.find((x) => x.id === btn.dataset.tpl);
        b.tpl = btn.dataset.tpl;
        b.draft = t
          ? { ...blankReport(t.object), ...clone(t), filters: [...clone(t.filters), { field: '', value: '' }].slice(0, 2), name: t.name }
          : blankReport();
        delete b.draft.id;
        rerender();
      }),
  );
  $('#bObj', root).onchange = (e) => ((b.draft = { ...blankReport(e.target.value), name: r.name }), rerender()); // a new object resets fields
  $('#bMeasure', root).onchange = (e) => set({ measure: e.target.value });
  $('#bGroup', root).onchange = (e) => set({ groupBy: e.target.value, thenBy: r.thenBy === e.target.value ? '' : r.thenBy });
  $('#bThen', root).onchange = (e) => set({ thenBy: e.target.value });
  $('#bChart', root).onchange = (e) => set({ chart: e.target.value });
  $$('[data-ct]', root).forEach((c) => (c.onclick = () => set({ chart: c.dataset.ct })));
  $$('[data-bf]', root).forEach((s) => (s.onchange = () => ((r.filters[Number(s.dataset.bf)] = { field: s.value, value: '' }), rerender())));
  $$('[data-bv]', root).forEach((s) => (s.onchange = () => ((r.filters[Number(s.dataset.bv)].value = s.value), rerender())));
  $('#bName', root).oninput = (e) => (r.name = e.target.value); // no re-render while typing
  $('#bTarget', root).onchange = (e) => (b.target = e.target.value);
  $('#bVis', root).onchange = (e) => (r.visibility = e.target.value);
  $('#bLib', root).onchange = (e) => (r.inLibrary = e.target.checked);
  $('#libAdd', root)?.addEventListener('click', () => {
    const id = $('#libPick', root).value;
    if (!id) return toast('Pick a saved report');
    if (!target.reportIds.includes(id)) ctx.api.update('dashboard', target.id, { reportIds: [...target.reportIds, id] });
    ctx.ui.dash = { ...ctx.ui.dash, id: target.id, builder: null };
    toast('Report added');
    ctx.render();
  });
  $('#bSave', root).onclick = () => {
    if (!b.target && !r.inLibrary) return toast('Add it to a dashboard or save it to the library');
    const rep = ctx.api.create('report', {
      name: r.name.trim() || autoName,
      object: r.object,
      measure: r.measure,
      groupBy: r.groupBy,
      thenBy: r.thenBy,
      filters: r.filters.filter((x) => x.field && x.value),
      chart: r.chart,
      visibility: r.visibility,
      inLibrary: r.inLibrary,
      ownerId: ctx.user.id,
    });
    const dash = state().dashboards.find((x) => x.id === b.target);
    if (dash) ctx.api.update('dashboard', dash.id, { reportIds: [...(dash.reportIds || []), rep.id] });
    ctx.ui.dash = { ...ctx.ui.dash, id: dash ? dash.id : ctx.ui.dash.id, builder: null };
    toast(dash ? `Report added to ${dash.name}` : 'Report saved to the library');
    ctx.render();
  };
}
