/**
 * @file Deals (build brief slides 7 and 8): saved views as tabs (L-03), board and table (B-01, B-03),
 * search, filters, sort and pipeline (L-01, L-02, B-04), the summary bar (B-14), deal cards with
 * quick actions, column totals and weighted amounts (L-05, L-06), bulk edit and export (B-03, L-04).
 */
import { CLOSED_STAGES, PIPELINES, SOURCES, STAGE_DESCRIPTIONS, STAGES } from '../../config/constants.js';
import { canEdit } from '../../core/permissions.js';
import { dealExportRows, filterDeals, isOpen, lastActivity, nextStepOverdue, weighted } from '../../core/deals.js';
import { columnTotals, dealSummaryBar } from '../../core/reports.js';
import { companyName, userName } from '../../core/lookups.js';
import { addDays, dayDiff, today } from '../../utils/dates.js';
import { esc, fmtDate, kmoney, money } from '../../utils/format.js';
import { clone } from '../../utils/object.js';
import { dealForm, exportRows, initials, moveStage, taskForm } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, svg, toast } from '../dom.js';
import { openAskClaude } from '../components/askClaude.js';

/** Sort options for the "Sort by" menu and table headers. */
const SORTS = [
  ['expectedClose', 'Close date'],
  ['amount', 'Amount'],
  ['createdAt', 'Create date'],
  ['activity', 'Last activity'],
  ['name', 'Deal name'],
];

/** Active users as [id, name] pairs. */
const userOptions = () =>
  state()
    .users.filter((u) => u.status === 'active')
    .map((u) => [u.id, u.name]);

/** Relative label for a date: "Today", "in 3 days", "3 days ago". */
function relDay(day, now) {
  const n = dayDiff(today(now), day);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** Effective filters: saved-view shorthands resolved for the signed-in user. */
function effectiveFilters() {
  const f = { ...ctx.ui.dealFilters };
  if (f.mine === true) f.mine = ctx.user.id; // "My open deals" view stores mine:true
  return f;
}

/** Deals visible with the current pipeline, view and filters, sorted. */
function currentDeals() {
  const ui = ctx.ui;
  const list = filterDeals(state(), ctx.api.all('deal'), effectiveFilters(), ui.pipeline, ctx.now());
  const { k, dir } = ui.dealSort;
  const val = (d) =>
    k === 'amount'
      ? +d.amount || 0
      : k === 'activity'
        ? lastActivity(state(), d)
        : k === 'company'
          ? companyName(state(), d.companyId)
          : k === 'weighted'
            ? weighted(d)
            : k === 'owner'
              ? userName(state(), d.ownerId)
              : d[k] || '';
  return list.sort((a, b) => {
    const x = val(a);
    const y = val(b);
    return (x > y ? 1 : x < y ? -1 : 0) * dir;
  });
}

/** Advanced filter panel (L-02). */
function filterPanel() {
  const f = ctx.ui.dealFilters;
  const sel = (k, options, label) =>
    `<div><label class="l" for="flt_${k}">${label}</label><select class="f" id="flt_${k}" data-f="${k}">${[['', 'Any'], ...options].map(([v, l]) => `<option value="${esc(v)}"${String(f[k] || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  const inp = (k, type, label) =>
    `<div><label class="l" for="flt_${k}">${label}</label><input class="f" id="flt_${k}" type="${type}" data-f="${k}" value="${esc(f[k] || '')}"></div>`;
  const s = state().settings;
  return `<div class="filters">
    ${sel(
      'stage',
      STAGES.map((x) => [x, x]),
      'Stage',
    )}${inp('serviceLine', 'text', 'Service line contains')}${sel(
      'industry',
      s.industries.map((x) => [x, x]),
      'Industry',
    )}
    ${inp('minAmt', 'number', 'Min value')}${inp('maxAmt', 'number', 'Max value')}${inp('closeFrom', 'date', 'Close from')}${inp('closeTo', 'date', 'Close to')}
    ${sel(
      'source',
      SOURCES.map((x) => [x, x]),
      'Source',
    )}${sel(
      'partnerId',
      state()
        .companies.filter((c) => c.relationship === 'Partner')
        .map((c) => [c.id, c.name]),
      'Partner',
    )}${sel(
      'icpTier',
      [
        ['Tier 1', 'Tier 1'],
        ['Tier 2', 'Tier 2'],
        ['Tier 3', 'Tier 3'],
      ],
      'ICP tier',
    )}
    <div style="display:flex;align-items:flex-end"><label class="chk small"><input type="checkbox" data-f="openOnly" ${f.openOnly ? 'checked' : ''}> Open deals only</label></div>
  </div>`;
}

export function renderDeals(root) {
  const ui = ctx.ui;
  const now = ctx.now();
  const year = today(now).slice(0, 4);
  const deals = currentDeals();
  const views = state().savedViews.filter((v) => v.objectType === 'deal' && (v.shared || v.ownerId === ctx.user.id));
  const f = ui.dealFilters;
  const advanced = ['stage', 'serviceLine', 'industry', 'minAmt', 'maxAmt', 'closeFrom', 'closeTo', 'source', 'partnerId', 'icpTier', 'openOnly'].filter(
    (k) => f[k] !== undefined && f[k] !== '' && f[k] !== false,
  ).length;
  const sum = dealSummaryBar(deals, now);
  const createdSel = f.createdFrom === addDays(today(now), -30) ? '30' : f.createdFrom === addDays(today(now), -90) ? '90' : '';
  const canCreate = canEdit(ctx.user, 'deal', null);

  root.innerHTML = `<div class="pagehead"><h1>Deals</h1><div class="sp"></div>
    <div class="seg" role="group" aria-label="Layout"><button data-mode="board" class="${ui.dealMode === 'board' ? 'on' : ''}" aria-pressed="${ui.dealMode === 'board'}">Board</button><button data-mode="table" class="${ui.dealMode === 'table' ? 'on' : ''}" aria-pressed="${ui.dealMode === 'table'}">Table</button></div>
    ${canCreate ? '<button class="btn pri" id="newDeal">+ Create deal</button>' : ''}</div>
  <div class="viewtabs" role="tablist" aria-label="Saved views">
    <button class="v ${!ui.dealView ? 'on' : ''}" data-view="" role="tab">All deals</button>
    ${views.map((v) => `<button class="v ${ui.dealView === v.id ? 'on' : ''}" data-view="${v.id}" role="tab">${esc(v.name)}${v.ownerId === ctx.user.id ? `<span class="x" data-delview="${v.id}" role="button" aria-label="Delete view ${esc(v.name)}">✕</span>` : ''}</button>`).join('')}
    <button class="add" id="svSave" aria-label="Save current filters as a view" title="Save view">+</button>
  </div>
  <div class="tools">
    <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="dealQ" placeholder="Search deals" value="${esc(f.q || '')}" aria-label="Search deals" autocomplete="off"></div>
    <button class="btn ${advanced ? 'dark' : ''}" id="fBtn" aria-expanded="${ui.showFilters}">Filter${advanced ? ` (${advanced})` : ''}</button>
    <select class="fsel" id="sortSel" aria-label="Sort by">${SORTS.map(([k, l]) => `<option value="${k}"${ui.dealSort.k === k ? ' selected' : ''}>Sort by: ${l}</option>`).join('')}</select>
    <div class="sp"></div>
    <select class="fsel" id="pipeSel" aria-label="Pipeline" style="min-width:200px">${[...PIPELINES, 'All'].map((p) => `<option value="${p}"${ui.pipeline === p ? ' selected' : ''}>${p === 'All' ? 'All pipelines' : p}</option>`).join('')}</select>
  </div>
  <div class="fbar" aria-label="Quick filters">
    <select class="fsel ${f.closeYear ? 'on' : ''}" data-q="closeYear" aria-label="Close date"><option value="">Close date: any</option><option value="${year}"${f.closeYear === year ? ' selected' : ''}>Close date: this year</option><option value="${+year + 1}"${f.closeYear === String(+year + 1) ? ' selected' : ''}>Close date: ${+year + 1}</option></select>
    <select class="fsel ${f.ownerId ? 'on' : ''}" data-q="ownerId" aria-label="Deal owner"><option value="">Deal owner</option>${userOptions()
      .map(([v, l]) => `<option value="${v}"${f.ownerId === v ? ' selected' : ''}>${esc(l)}</option>`)
      .join('')}</select>
    <select class="fsel ${createdSel ? 'on' : ''}" data-q="created" aria-label="Create date"><option value="">Create date</option><option value="30"${createdSel === '30' ? ' selected' : ''}>Created: last 30 days</option><option value="90"${createdSel === '90' ? ' selected' : ''}>Created: last 90 days</option></select>
    <select class="fsel ${f.activity ? 'on' : ''}" data-q="activity" aria-label="Last activity date"><option value="">Last activity date</option><option value="7"${f.activity === '7' ? ' selected' : ''}>Active: last 7 days</option><option value="30"${f.activity === '30' ? ' selected' : ''}>Active: last 30 days</option><option value="stale"${f.activity === 'stale' ? ' selected' : ''}>No activity 30+ days</option></select>
    <button class="linkbtn" id="clrF">Clear all</button><button class="linkbtn muted" id="advF">Advanced filters</button>
  </div>
  ${ui.showFilters ? filterPanel() : ''}
  <div class="sumbar" aria-label="Summary for the deals shown">
    <div><div class="k">Total deal amount</div><div class="v">${kmoney(sum.total)}</div></div>
    <div><div class="k">Weighted open pipeline</div><div class="v">${kmoney(sum.weightedOpen)}</div></div>
    <div><div class="k">Open pipeline value</div><div class="v">${kmoney(sum.open)}</div></div>
    <div><div class="k">Closed won revenue</div><div class="v">${kmoney(sum.closedWon)}</div></div>
    <div><div class="k" title="Deals created in the last 30 days">New deal amount</div><div class="v">${kmoney(sum.newAmount)}</div></div>
    <div><div class="k" title="Average days from creation to close, for closed deals in view">Average deal age</div><div class="v">${sum.averageAge === null ? '—' : `${sum.averageAge} days`}</div></div>
  </div>
  <div id="dealBody"></div>`;

  /* ---- toolbar bindings ---- */
  $$('[data-mode]', root).forEach((b) => (b.onclick = () => ((ui.dealMode = b.dataset.mode), ctx.render())));
  $('#newDeal', root)?.addEventListener('click', () => dealForm());
  $('#pipeSel', root).onchange = (e) => ((ui.pipeline = e.target.value), ctx.render());
  $('#sortSel', root).onchange = (e) => ((ui.dealSort = { k: e.target.value, dir: 1 }), rerender());
  $('#fBtn', root).onclick = () => ((ui.showFilters = !ui.showFilters), ctx.render());
  $('#advF', root).onclick = () => ((ui.showFilters = true), ctx.render());
  $('#clrF', root).onclick = () => ((ui.dealFilters = {}), (ui.dealView = ''), ctx.render());
  let debounce;
  $('#dealQ', root).addEventListener('input', (e) => {
    ui.dealFilters.q = e.target.value; // record immediately so other re-renders use it
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const typing = document.activeElement?.id === 'dealQ'; // never pull focus back if the user moved on
      rerender();
      const q = $('#dealQ');
      if (typing && q) {
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }
    }, 180);
  });
  $$('[data-q]', root).forEach(
    (s) =>
      (s.onchange = () => {
        const k = s.dataset.q;
        if (k === 'created') ui.dealFilters.createdFrom = s.value ? addDays(today(now), -Number(s.value)) : '';
        else ui.dealFilters[k] = s.value;
        rerender();
      }),
  );
  $$('[data-f]', root).forEach(
    (el) =>
      (el.onchange = () => {
        ui.dealFilters[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
        rerender();
      }),
  );
  $$('[data-view]', root).forEach(
    (b) =>
      (b.onclick = (e) => {
        if (e.target.dataset.delview) return; // the ✕ has its own handler
        const v = views.find((x) => x.id === b.dataset.view);
        ui.dealView = v ? v.id : '';
        ui.dealFilters = v ? clone(v.filters || {}) : {}; // L-03 apply a saved view
        if (v?.mode) ui.dealMode = v.mode;
        if (v) ui.pipeline = v.pipeline || 'All';
        ctx.render();
      }),
  );
  $$('[data-delview]', root).forEach(
    (x) =>
      (x.onclick = () => {
        ctx.api.remove('savedView', x.dataset.delview);
        if (ui.dealView === x.dataset.delview) ui.dealView = '';
        toast('View deleted');
        ctx.render();
      }),
  );
  $('#svSave', root).onclick = () =>
    modal(
      'Save view',
      '<label class="l" for="svName">Name</label><input class="f" id="svName" placeholder="e.g. 2026 Pipeline"><label class="chk" style="margin-top:12px"><input type="checkbox" id="svShared" checked> Share with the team</label>',
      {
        saveLabel: 'Save view',
        onSave: (body) => {
          const name = $('#svName', body).value.trim();
          if (!name) throw new Error('Name the view.');
          const v = ctx.api.create('savedView', {
            objectType: 'deal',
            name,
            filters: clone(ui.dealFilters),
            mode: ui.dealMode,
            pipeline: ui.pipeline,
            ownerId: ctx.user.id,
            shared: $('#svShared', body).checked,
          });
          ui.dealView = v.id;
          toast('View saved');
          ctx.render();
        },
      },
    );

  if (ui.dealMode === 'board') renderBoard($('#dealBody', root), deals);
  else renderTable($('#dealBody', root), deals);
}

/** Kanban board (B-01): one column per stage with totals; cards with key fields and quick actions. */
function renderBoard(el, deals) {
  const ui = ctx.ui;
  const now = ctx.now();
  const s = state();
  el.innerHTML = `<div class="board">${STAGES.map((stage) => {
    const list = deals.filter((d) => d.stage === stage);
    const tot = columnTotals(list);
    const prob = list.length ? Math.round((tot.weighted / Math.max(1, tot.value)) * 100) : 0;
    if (ui.collapsed.has(stage))
      return `<div class="colm collapsed" data-stage="${esc(stage)}" data-expand="${esc(stage)}" title="Expand ${esc(stage)}"><div class="colh"><b>${esc(stage)}</b> <span class="n">${list.length}</span></div></div>`; // count stays visible
    return `<div class="colm" data-stage="${esc(stage)}"><div class="colh" title="${esc(STAGE_DESCRIPTIONS[stage])}"><b>${esc(stage)}</b><span class="n">${list.length}</span><button class="cx" data-collapse="${esc(stage)}" aria-label="Collapse ${esc(stage)}" title="Collapse">‹</button></div>
      <div class="colbody">${list.map((d) => card(d, s, now)).join('')}</div>
      <div class="colfoot"><div><b>${kmoney(tot.value)}</b> | Total amount</div><div class="muted">${kmoney(tot.weighted)} (${prob}%) | Weighted amount</div></div></div>`;
  }).join('')}</div>
  <p class="small faint">Drag a card, or use its stage picker, to move it. A brown edge means the next step is overdue or missing.</p>`;

  $$('[data-open]', el).forEach((n) => (n.onclick = () => (location.hash = `deal-${n.dataset.open}`)));
  $$('[data-collapse]', el).forEach((b) => (b.onclick = () => (ui.collapsed.add(b.dataset.collapse), rerender())));
  $$('[data-expand]', el).forEach((c) => c.addEventListener('click', () => (ui.collapsed.delete(c.dataset.expand), rerender())));
  $$('.dc', el).forEach((c) =>
    c.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', c.dataset.id); // carry the deal id
      e.dataTransfer.effectAllowed = 'move';
    }),
  );
  $$('.colm', el).forEach((col) => {
    col.addEventListener('dragover', (e) => (e.preventDefault(), col.classList.add('over')));
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('over');
      const deal = ctx.api.get('deal', e.dataTransfer.getData('text/plain'));
      if (deal) moveStage(deal, col.dataset.stage); // B-07 / B-09 rules live in moveStage
    });
  });
  $$('[data-move]', el).forEach((sel) => (sel.onchange = () => moveStage(ctx.api.get('deal', sel.dataset.move), STAGES[sel.selectedIndex])));
  $$('[data-qa]', el).forEach(
    (b) =>
      (b.onclick = () => {
        const deal = ctx.api.get('deal', b.dataset.id);
        const act = b.dataset.qa;
        if (act === 'open') location.hash = `deal-${deal.id}`;
        if (act === 'ask') openAskClaude();
        if (act === 'task') taskForm({ dealId: deal.id });
        if (act === 'email') {
          const email = s.contacts.find((p) => p.id === deal.primaryContactId)?.email;
          if (email) location.href = `mailto:${email}?subject=${encodeURIComponent(deal.name)}`;
          else toast('Add a primary contact with an email first');
        }
      }),
  );
  $$('[data-ns]', el).forEach((box) => (box.onclick = () => editNextStep(box)));
}

/** One deal card (B-01): amount, close date, owner, create date, company, next activity, quick actions. */
function card(d, s, now) {
  const editable = canEdit(ctx.user, 'deal', d);
  const overdue = nextStepOverdue(d, now);
  const co = companyName(s, d.companyId);
  const act = !isOpen(d) ? fmtDate(d.stageHistory?.at(-1)?.at).replace(/, \d{4}$/, '') : d.nextStepDate ? relDay(d.nextStepDate, now) : 'No upcoming';
  return `<div class="dc ${overdue ? 'stale' : ''}" draggable="${editable}" data-id="${d.id}">
    <div class="top1"><span class="nm" data-open="${d.id}" role="link" tabindex="0">${esc(d.name)}</span><button class="ring" data-qa="open" data-id="${d.id}" aria-label="Open ${esc(d.name)}"></button></div>
    ${d.amount !== '' && d.amount !== undefined ? `<div class="ln"><span>Amount:</span> ${money(d.amount)}</div>` : ''}
    <div class="ln"><span>Close date:</span> ${fmtDate(d.expectedClose)}</div>
    <div class="ln"><span>Deal owner:</span> ${esc(userName(s, d.ownerId))}</div>
    <div class="ln"><span>Create date:</span> ${fmtDate(d.createdAt)}</div>
    <div class="co"><span class="av" aria-hidden="true">${esc(initials(co))}</span>${esc(co)}</div>
    <span class="act ${overdue ? 'alert' : ''}" ${isOpen(d) ? `data-ns="${d.id}" role="button" tabindex="0" title="Next step: ${esc(d.nextStep || 'none')}${editable ? ' (click to edit)' : ''}"` : ''}>${esc(act)}</span>
    <div class="qa"><button data-qa="open" data-id="${d.id}" aria-label="Preview" title="Preview">${svg('deals')}</button><button data-qa="ask" data-id="${d.id}" aria-label="Ask Claude" title="Ask Claude (V2)">${svg('note')}</button><button data-qa="email" data-id="${d.id}" aria-label="Email primary contact" title="Email">${svg('k')}</button><button data-qa="task" data-id="${d.id}" aria-label="Create task" title="Task">${svg('task')}</button>
    ${editable ? `<select data-move="${d.id}" aria-label="Move ${esc(d.name)} to stage">${STAGES.map((x) => `<option${x === d.stage ? ' selected' : ''}>${x === d.stage ? x : `→ ${x}`}</option>`).join('')}</select>` : ''}</div>
  </div>`;
}

/** Inline editor for a card's next step and date (B-09). */
function editNextStep(box) {
  const deal = ctx.api.get('deal', box.dataset.ns);
  if (!canEdit(ctx.user, 'deal', deal)) return;
  box.onclick = null;
  box.outerHTML = `<div class="ns" id="nsEdit"><input value="${esc(deal.nextStep)}" aria-label="Next step"><input type="date" value="${esc(deal.nextStepDate)}" style="margin-top:4px" aria-label="Next step date"></div>`;
  const wrap = $('#nsEdit');
  const [step, date] = wrap.querySelectorAll('input');
  step.focus();
  const commit = () => {
    if (!step.value.trim() || !date.value) return (toast('Next step and date are both required'), rerender()); // B-09
    ctx.api.update('deal', deal.id, { nextStep: step.value.trim(), nextStepDate: date.value });
    rerender();
  };
  [step, date].forEach((i) => i.addEventListener('keydown', (e) => (e.key === 'Enter' ? commit() : e.key === 'Escape' && rerender())));
  date.addEventListener('change', commit);
}

/** Table view (B-03): sortable columns, click-to-edit cells, bulk edit and export. */
function renderTable(el, deals) {
  const ui = ctx.ui;
  const s = state();
  const sort = ui.dealSort;
  ui.selected = new Set([...ui.selected].filter((id) => deals.some((d) => d.id === id))); // drop selections filtered out
  const canBulk = canEdit(ctx.user, 'deal', null);
  const cols = [
    ['name', 'Deal name'],
    ['company', 'Company'],
    ['stage', 'Stage'],
    ['amount', 'Amount', true],
    ['weighted', 'Weighted', true],
    ['expectedClose', 'Close date'],
    ['owner', 'Owner'],
    ['activity', 'Next step'],
  ];
  const sortLabel = SORTS.find(([k]) => k === sort.k)?.[1] || cols.find(([k]) => k === sort.k)?.[1] || 'close date';
  el.innerHTML = `${
    ui.selected.size
      ? `<div class="bulk" role="region" aria-label="Bulk edit"><b>${ui.selected.size} selected</b>
      <button data-bulk="stage">Edit stage</button><button data-bulk="owner">Change owner</button><button data-bulk="close">Edit close date</button><button data-bulk="archive">Archive</button>
      <div class="sp"></div><button data-bulk="export">Export</button><button data-bulk="clear">Clear</button></div>`
      : ''
  }
    <div class="tablewrap"><table class="t frozen"><thead><tr>${canBulk ? '<th class="cb"><input type="checkbox" id="selAll" aria-label="Select all"></th>' : '<th class="cb"></th>'}${cols.map(([k, l, num]) => `<th class="${num ? 'num' : ''}" data-sort="${k}" aria-sort="${sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${l}${sort.k === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead><tbody>
    ${deals
      .map((d) => {
        const ed = canEdit(ctx.user, 'deal', d);
        const won = d.stage === 'Closed won';
        return `<tr class="${ui.selected.has(d.id) ? 'picked' : ''}">
        <td class="cb">${canBulk ? `<input type="checkbox" data-sel="${d.id}" ${ui.selected.has(d.id) ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="Select ${esc(d.name)}">` : ''}</td>
        <td><a class="lnk" href="#deal-${d.id}">${esc(d.name)}</a>${ui.pipeline === 'All' ? `<div class="small faint">${esc(d.pipeline)}</div>` : ''}</td>
        <td>${esc(companyName(s, d.companyId))}</td>
        <td>${ed ? `<button class="cellbtn" data-edit="stage" data-id="${d.id}" aria-label="Edit stage">` : ''}<span class="badge ${won ? '' : 'dark'}">${esc(d.stage)}</span>${ed ? '</button>' : ''}</td>
        <td class="num">${ed ? `<button class="cellbtn" data-edit="amount" data-id="${d.id}" aria-label="Edit amount">${money(d.amount)}</button>` : money(d.amount)}</td>
        <td class="num">${money(weighted(d))}</td>
        <td>${ed ? `<button class="cellbtn" data-edit="expectedClose" data-id="${d.id}" aria-label="Edit close date">${fmtDate(d.expectedClose)}</button>` : fmtDate(d.expectedClose)}</td>
        <td><span class="av sm" title="${esc(userName(s, d.ownerId))}">${esc(initials(userName(s, d.ownerId)))}</span></td>
        <td class="small muted">${isOpen(d) && d.nextStepDate ? relDay(d.nextStepDate, ctx.now()) : relDay(lastActivity(s, d).slice(0, 10), ctx.now())}</td></tr>`;
      })
      .join('')}
    </tbody></table>${deals.length ? '' : '<div class="empty">No deals match these filters.</div>'}</div>
    <div class="tfoot">${deals.length} of ${ctx.api.all('deal').length} deals | Sorted by ${esc(sortLabel.toLowerCase())}</div>`;

  $$('[data-sort]', el).forEach(
    (th) => (th.onclick = () => ((ui.dealSort = { k: th.dataset.sort, dir: sort.k === th.dataset.sort ? -sort.dir : 1 }), rerender())),
  );
  $$('[data-sel]', el).forEach(
    (box) => (box.onchange = () => (box.checked ? ui.selected.add(box.dataset.sel) : ui.selected.delete(box.dataset.sel), rerender())),
  );
  $('#selAll', el)?.addEventListener('change', (e) => {
    for (const d of deals) if (canEdit(ctx.user, 'deal', d)) e.target.checked ? ui.selected.add(d.id) : ui.selected.delete(d.id);
    rerender();
  });
  $$('[data-edit]', el).forEach((b) => (b.onclick = () => cellEditor(b)));
  $$('[data-bulk]', el).forEach((b) => (b.onclick = () => bulkAction(b.dataset.bulk, deals)));
}

/** Click-to-edit cell (B-02 inline editing in the list). */
function cellEditor(btn) {
  const deal = ctx.api.get('deal', btn.dataset.id);
  const key = btn.dataset.edit;
  const td = btn.parentElement;
  td.innerHTML =
    key === 'stage'
      ? `<select class="cellin" aria-label="Stage">${STAGES.map((x) => `<option${x === deal.stage ? ' selected' : ''}>${x}</option>`).join('')}</select>`
      : `<input class="cellin" type="${key === 'amount' ? 'number' : 'date'}" value="${esc(deal[key])}" aria-label="${key === 'amount' ? 'Amount' : 'Close date'}">`;
  const input = td.firstElementChild;
  input.focus();
  input.addEventListener('keydown', (e) => e.key === 'Escape' && rerender());
  input.addEventListener('change', () => {
    if (key === 'stage') return moveStage(deal, input.value);
    ctx.api.update('deal', deal.id, { [key]: key === 'amount' ? (input.value === '' ? '' : Number(input.value)) : input.value });
    toast('Saved');
    rerender();
  });
  input.addEventListener('blur', () => setTimeout(() => document.activeElement !== input && td.querySelector('.cellin') && rerender(), 150));
}

/** Bulk actions from the selection bar (B-03, L-04). */
function bulkAction(kind, deals) {
  const ui = ctx.ui;
  const ids = [...ui.selected];
  if (kind === 'clear') return (ui.selected.clear(), rerender());
  if (kind === 'export')
    return exportRows(
      'ik-deals',
      dealExportRows(
        state(),
        deals.filter((d) => ui.selected.has(d.id)),
        ctx.now(),
      ),
      'csv',
    );
  if (kind === 'archive') {
    for (const id of ids) ctx.api.update('deal', id, { archived: true }, { persist: false });
    ctx.store.save();
    toast(`Archived ${ids.length} deals`);
    ui.selected.clear();
    return rerender();
  }
  const field = {
    stage: [
      'stage',
      'Stage',
      `<select class="f" id="bv">${STAGES.filter((x) => !CLOSED_STAGES.includes(x))
        .map((x) => `<option>${x}</option>`)
        .join('')}</select>`,
    ],
    owner: [
      'ownerId',
      'Owner',
      `<select class="f" id="bv">${userOptions()
        .map(([v, l]) => `<option value="${v}">${esc(l)}</option>`)
        .join('')}</select>`,
    ],
    close: ['expectedClose', 'Close date', '<input class="f" type="date" id="bv">'],
  }[kind];
  modal(
    `${field[1]} for ${ids.length} deals`,
    `<label class="l" for="bv">${field[1]}</label>${field[2]}${kind === 'stage' ? '<p class="small muted">Close deals one at a time so each gets a reason.</p>' : ''}`,
    {
      saveLabel: 'Apply',
      onSave: (body) => {
        const value = $('#bv', body).value;
        if (!value) throw new Error(`Choose a ${field[1].toLowerCase()}.`);
        let done = 0;
        let skipped = 0;
        for (const id of ids) {
          const deal = ctx.api.raw('deal', id);
          if (kind === 'stage' && (!deal.nextStep || !deal.nextStepDate)) {
            skipped++; // B-09 still applies in bulk
            continue;
          }
          ctx.api.update('deal', id, { [field[0]]: value }, { persist: false });
          done++;
        }
        ctx.store.save(); // one write for the whole batch
        toast(`Updated ${done} deals${skipped ? `, ${skipped} skipped (no next step)` : ''}`);
        ui.selected.clear();
        rerender();
      },
    },
  );
}
