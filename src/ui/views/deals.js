/**
 * @file Deals index (B-01..B-04, B-09, L-02..L-04): pipeline tabs, Kanban board with drag-and-drop,
 * board search and collapsible stage columns, table with sort, inline edit and bulk edit,
 * filters, saved views, CSV/Excel export.
 */
import { CLOSED_STAGES, PIPELINES, SOURCES, STAGES } from '../../config/constants.js';
import { canEdit } from '../../core/permissions.js';
import { dealExportRows, filterDeals, isOpen, lastActivity, nextStepOverdue, timeInStage, weighted } from '../../core/deals.js';
import { companyName, firstName, userName } from '../../core/lookups.js';
import { ago, esc, fmtDate, kmoney, money } from '../../utils/format.js';
import { clone } from '../../utils/object.js';
import { exportRows, moveStage, refLink } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';

/** Active users as [id, name] pairs. */
const userOptions = () =>
  state()
    .users.filter((u) => u.status === 'active')
    .map((u) => [u.id, u.name]);

/** Filter panel markup (L-02). */
function filterPanel() {
  const f = ctx.ui.dealFilters;
  const sel = (k, options, label) =>
    `<div><label class="l" for="flt_${k}">${label}</label><select class="f" id="flt_${k}" data-f="${k}">${[['', 'Any'], ...options].map(([v, l]) => `<option value="${esc(v)}"${(f[k] || '') === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  const inp = (k, type, label) =>
    `<div><label class="l" for="flt_${k}">${label}</label><input class="f" id="flt_${k}" type="${type}" data-f="${k}" value="${esc(f[k] || '')}"></div>`;
  const s = state().settings;
  return `<div class="filters">
    ${sel(
      'stage',
      STAGES.map((x) => [x, x]),
      'Stage',
    )}${sel('ownerId', userOptions(), 'Owner')}${sel(
      'serviceLine',
      s.serviceLines.map((x) => [x, x]),
      'Service line',
    )}${sel(
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
    )}
    ${sel(
      'activity',
      [
        ['7', 'Active in last 7 days'],
        ['30', 'Active in last 30 days'],
        ['stale', 'No activity 30+ days'],
      ],
      'Last activity',
    )}${sel(
      'icpTier',
      [
        ['Tier 1', 'Tier 1'],
        ['Tier 2', 'Tier 2'],
        ['Tier 3', 'Tier 3'],
      ],
      'ICP tier',
    )}
    <div style="display:flex;align-items:flex-end;gap:8px"><label class="chk small"><input type="checkbox" data-f="openOnly" ${f.openOnly ? 'checked' : ''}> Open only</label><button class="btn sm" id="clrF">Clear</button></div>
  </div>`;
}

export function renderDeals(root) {
  const ui = ctx.ui;
  const now = ctx.now();
  const visible = ctx.api.all('deal');
  const deals = filterDeals(state(), visible, ui.dealFilters, ui.pipeline, now);
  const open = deals.filter(isOpen);
  const activeFilters = Object.entries(ui.dealFilters).filter(([k, v]) => k !== 'q' && v !== '' && v !== undefined && v !== false).length;
  const views = state().savedViews.filter((v) => v.objectType === 'deal' && (v.shared || v.ownerId === ctx.user.id));

  root.innerHTML = `<div class="pagehead"><div><h1>Deals</h1><div class="sub">${deals.length} deals · ${kmoney(open.reduce((s, d) => s + (+d.amount || 0), 0))} open · ${kmoney(open.reduce((s, d) => s + weighted(d), 0))} weighted</div></div><div class="sp"></div>
    <div class="seg" role="group" aria-label="Layout"><button data-mode="board" class="${ui.dealMode === 'board' ? 'on' : ''}" aria-pressed="${ui.dealMode === 'board'}">Board</button><button data-mode="table" class="${ui.dealMode === 'table' ? 'on' : ''}" aria-pressed="${ui.dealMode === 'table'}">Table</button></div></div>
  <div class="tabs" role="tablist" aria-label="Pipelines">${[...PIPELINES, 'All'].map((p) => `<button role="tab" data-pipe="${p}" class="${ui.pipeline === p ? 'on' : ''}" aria-selected="${ui.pipeline === p}">${p === 'All' ? 'All pipelines' : p}</button>`).join('')}</div>
  <div class="tools">
    <div class="search" style="max-width:260px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="dealQ" placeholder="Search deals" value="${esc(ui.dealFilters.q || '')}" aria-label="Search deals" autocomplete="off"></div>
    <button class="btn" id="fBtn" aria-expanded="${ui.showFilters}">Filters${activeFilters ? ` (${activeFilters})` : ''}</button>
    <select class="f" id="svSel" style="width:auto" aria-label="Saved views"><option value="">Saved views</option>${views.map((v) => `<option value="${v.id}">${esc(v.name)}${v.shared ? ' (team)' : ''}</option>`).join('')}</select>
    <button class="btn" id="svSave">Save view</button><div class="sp"></div>
    <button class="btn" id="expCsv">Export CSV</button><button class="btn" id="expXls">Export Excel</button>
  </div>
  ${ui.showFilters ? filterPanel() : ''}<div id="dealBody"></div>`;

  /* toolbar bindings */
  $$('[data-mode]', root).forEach((b) => (b.onclick = () => ((ui.dealMode = b.dataset.mode), ctx.render())));
  $$('[data-pipe]', root).forEach((b) => (b.onclick = () => ((ui.pipeline = b.dataset.pipe), ctx.render())));
  $('#fBtn', root).onclick = () => ((ui.showFilters = !ui.showFilters), ctx.render());
  let debounce;
  $('#dealQ', root).addEventListener('input', (e) => {
    ui.dealFilters.q = e.target.value; // record the text immediately so any other re-render uses it
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const typing = document.activeElement?.id === 'dealQ'; // don't pull focus back if the user moved on
      rerender();
      const q = $('#dealQ');
      if (typing && q) {
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }
    }, 180);
  });
  $$('[data-f]', root).forEach(
    (el) =>
      (el.onchange = () => {
        ui.dealFilters[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
        rerender();
      }),
  );
  $('#clrF', root)?.addEventListener('click', () => ((ui.dealFilters = {}), ctx.render()));
  $('#svSel', root).onchange = (e) => {
    const v = views.find((x) => x.id === e.target.value);
    if (!v) return;
    ui.dealFilters = clone(v.filters || {}); // L-03 apply a saved view
    ui.dealMode = v.mode || ui.dealMode;
    ui.pipeline = v.pipeline || 'All';
    toast(`Showing “${v.name}”`);
    ctx.render();
  };
  $('#svSave', root).onclick = () =>
    modal(
      'Save view',
      '<label class="l" for="svName">Name</label><input class="f" id="svName" placeholder="e.g. My Q4 closes"><label class="chk" style="margin-top:12px"><input type="checkbox" id="svShared" checked> Share with the team</label>',
      {
        saveLabel: 'Save view',
        onSave: (body) => {
          const name = $('#svName', body).value.trim();
          if (!name) throw new Error('Name the view.');
          ctx.api.create('savedView', {
            objectType: 'deal',
            name,
            filters: clone(ui.dealFilters),
            mode: ui.dealMode,
            pipeline: ui.pipeline,
            ownerId: ctx.user.id,
            shared: $('#svShared', body).checked,
          });
          toast('View saved');
          ctx.render();
        },
      },
    );
  $('#expCsv', root).onclick = () => exportRows('ik-deals', dealExportRows(state(), deals, now), 'csv');
  $('#expXls', root).onclick = () => exportRows('ik-deals', dealExportRows(state(), deals, now), 'xlsx');

  if (ui.dealMode === 'board') renderBoard($('#dealBody', root), deals);
  else renderTable($('#dealBody', root), deals);
}

/** Kanban board (B-01) with collapsible stage columns. */
function renderBoard(el, deals) {
  const ui = ctx.ui;
  const now = ctx.now();
  el.innerHTML = `<div class="board">${STAGES.map((stage) => {
    const list = deals.filter((d) => d.stage === stage).sort((a, b) => (a.expectedClose || '').localeCompare(b.expectedClose || ''));
    const total = kmoney(list.reduce((s, d) => s + (+d.amount || 0), 0));
    const collapsed = ui.collapsed.has(stage);
    if (collapsed)
      return `<div class="colm collapsed" data-stage="${esc(stage)}" data-expand="${esc(stage)}" title="Expand ${esc(stage)}"><div class="colh"><button class="cx" aria-label="Expand ${esc(stage)}">▸</button><b>${esc(stage)} · ${list.length}</b></div></div>`; // count stays visible when collapsed
    return `<div class="colm" data-stage="${esc(stage)}"><div class="colh"><div><b>${esc(stage)}</b><span>${list.length} · ${total}</span></div><button class="cx" data-collapse="${esc(stage)}" aria-label="Collapse ${esc(stage)}" title="Collapse">‹</button></div>
      ${list
        .map((d) => {
          const overdue = nextStepOverdue(d, now);
          const editable = canEdit(ctx.user, 'deal', d);
          return `<div class="dc ${overdue ? 'stale' : ''}" draggable="${editable}" data-id="${d.id}"><div class="nm" data-open="${d.id}" role="link" tabindex="0">${esc(d.name)}</div><div class="co">${esc(companyName(state(), d.companyId))}</div>
          <div class="row"><b>${money(d.amount)}</b><span class="muted">${d.expectedClose ? fmtDate(d.expectedClose) : 'No close date'}</span></div>
          <div class="row"><span class="badge">${esc(d.serviceLine || 'No service line')}</span><span class="small muted">${esc(firstName(state(), d.ownerId))} · ${timeInStage(d, now)}d</span></div>
          ${editable ? `<select class="mv" data-move="${d.id}" aria-label="Move ${esc(d.name)} to stage">${STAGES.map((x) => `<option${x === stage ? ' selected' : ''}>${x === stage ? `Stage: ${x}` : `Move to ${x}`}</option>`).join('')}</select>` : ''}
          ${isOpen(d) ? `<div class="ns" data-ns="${d.id}" title="${editable ? 'Click to edit next step' : ''}">${overdue ? '<span class="warn">Next step overdue · </span>' : ''}${esc(d.nextStep || 'Add a next step')}${d.nextStepDate ? ` · ${fmtDate(d.nextStepDate)}` : ''}</div>` : ''}</div>`;
        })
        .join('')}</div>`;
  }).join(
    '',
  )}</div><p class="small faint">Drag a card, or use its stage picker, to move it. A brown edge means the next step is missing or overdue. Collapse columns you don’t need with ‹.</p>`;

  $$('[data-open]', el).forEach((n) => {
    n.onclick = () => (location.hash = `deal-${n.dataset.open}`);
    n.onkeydown = (e) => e.key === 'Enter' && n.onclick();
  });
  $$('[data-collapse]', el).forEach((b) => (b.onclick = () => (ui.collapsed.add(b.dataset.collapse), rerender())));
  $$('[data-expand]', el).forEach((c) => c.addEventListener('click', () => (ui.collapsed.delete(c.dataset.expand), rerender())));
  $$('.dc', el).forEach((card) =>
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id); // carry the deal id
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
      if (deal) moveStage(deal, col.dataset.stage); // rules (B-07, B-09) live in moveStage
    });
  });
  for (const sel of $$('[data-move]', el)) {
    sel.onchange = () => {
      const stage = STAGES[sel.selectedIndex]; // option text is decorated, so read the stage by position
      moveStage(ctx.api.get('deal', sel.dataset.move), stage); // same B-07/B-09 rules as drag-and-drop
    };
  }
  $$('[data-ns]', el).forEach(
    (box) =>
      (box.onclick = () => {
        const deal = ctx.api.get('deal', box.dataset.ns);
        if (!canEdit(ctx.user, 'deal', deal)) return;
        box.onclick = null;
        box.innerHTML = `<input value="${esc(deal.nextStep)}" aria-label="Next step"><input type="date" value="${esc(deal.nextStepDate)}" style="margin-top:4px" aria-label="Next step date">`;
        const [step, date] = box.querySelectorAll('input');
        step.focus();
        const commit = () => {
          if (!step.value.trim() || !date.value) return (toast('Next step and date are both required'), rerender()); // B-09
          ctx.api.update('deal', deal.id, { nextStep: step.value.trim(), nextStepDate: date.value });
          rerender();
        };
        [step, date].forEach((i) => i.addEventListener('keydown', (e) => (e.key === 'Enter' ? commit() : e.key === 'Escape' && rerender())));
        date.addEventListener('change', commit);
      }),
  );
}

/** Deal table (B-03): sortable, inline editable, bulk edit. */
function renderTable(el, deals) {
  const ui = ctx.ui;
  const sort = ui.dealSort;
  const value = (d, k) =>
    ({
      company: () => companyName(state(), d.companyId),
      owner: () => userName(state(), d.ownerId),
      weighted: () => weighted(d),
      activity: () => lastActivity(state(), d),
      amount: () => +d.amount || 0,
    })[k]?.() ??
    (d[k] || '');
  deals.sort((a, b) => {
    const x = value(a, sort.k);
    const y = value(b, sort.k);
    return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
  });
  ui.selected = new Set([...ui.selected].filter((id) => deals.some((d) => d.id === id))); // drop selections filtered out
  const cols = [
    ['name', 'Deal'],
    ['company', 'Company'],
    ['stage', 'Stage'],
    ['amount', 'Amount', true],
    ['weighted', 'Weighted', true],
    ['expectedClose', 'Close date'],
    ['owner', 'Owner'],
    ['nextStep', 'Next step'],
    ['nextStepDate', 'Next step date'],
    ['activity', 'Last activity'],
  ];
  const canBulk = canEdit(ctx.user, 'deal', null);
  const users = userOptions();
  el.innerHTML = `${
    ui.selected.size
      ? `<div class="bulk" role="region" aria-label="Bulk edit"><b>${ui.selected.size} selected</b>
      <label>Set stage <select id="bStage"><option value=""></option>${STAGES.filter((x) => !CLOSED_STAGES.includes(x))
        .map((x) => `<option>${x}</option>`)
        .join('')}</select></label>
      <label>Set owner <select id="bOwner"><option value=""></option>${users.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
      <label>Service line <select id="bSvc"><option value=""></option>${state()
        .settings.serviceLines.map((x) => `<option>${esc(x)}</option>`)
        .join('')}</select></label>
      <button class="btn sm" id="bApply">Apply</button><button class="btn sm" id="bArch">Archive</button><span class="small" style="opacity:.6">Close deals one at a time so each gets a reason.</span></div>`
      : ''
  }
    <div class="tablewrap"><table class="t frozen"><thead><tr>${cols.map(([k, l, num], i) => `<th class="${num ? 'num' : ''}" data-sort="${k}" aria-sort="${sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${i === 0 && canBulk ? '<input type="checkbox" id="selAll" aria-label="Select all"> ' : ''}${l}${sort.k === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead><tbody>
    ${deals
      .map((d) => {
        const ed = canEdit(ctx.user, 'deal', d);
        return `<tr>
        <td style="min-width:240px">${canBulk ? `<input type="checkbox" data-sel="${d.id}" ${ui.selected.has(d.id) ? 'checked' : ''} ${ed ? '' : 'disabled'} aria-label="Select ${esc(d.name)}"> ` : ''}<a class="lnk" href="#deal-${d.id}">${esc(d.name)}</a>${ui.pipeline === 'All' ? `<div class="small faint">${esc(d.pipeline)}</div>` : ''}</td>
        <td style="min-width:150px">${refLink('company', d.companyId)}</td>
        <td>${ed ? `<select class="cellin" style="min-width:170px" data-ie="stage" data-id="${d.id}" aria-label="Stage">${STAGES.map((x) => `<option${x === d.stage ? ' selected' : ''}>${x}</option>`).join('')}</select>` : `<span class="pill">${esc(d.stage)}</span>`}</td>
        <td class="num">${ed ? `<input class="cellin" style="text-align:right;width:110px" type="number" data-ie="amount" data-id="${d.id}" value="${esc(d.amount)}" aria-label="Amount">` : money(d.amount)}</td>
        <td class="num">${money(weighted(d))}</td>
        <td>${ed ? `<input class="cellin" type="date" data-ie="expectedClose" data-id="${d.id}" value="${esc(d.expectedClose)}" aria-label="Close date">` : fmtDate(d.expectedClose)}</td>
        <td style="white-space:nowrap">${esc(userName(state(), d.ownerId))}</td>
        <td>${ed ? `<input class="cellin" style="min-width:200px" data-ie="nextStep" data-id="${d.id}" value="${esc(d.nextStep)}" aria-label="Next step">` : esc(d.nextStep)}</td>
        <td>${ed ? `<input class="cellin" type="date" data-ie="nextStepDate" data-id="${d.id}" value="${esc(d.nextStepDate)}" aria-label="Next step date">` : fmtDate(d.nextStepDate)}</td>
        <td class="small muted">${ago(lastActivity(state(), d), ctx.now())}</td></tr>`;
      })
      .join('')}
    </tbody></table>${deals.length ? '' : '<div class="empty">No deals match these filters.</div>'}</div>`;

  $$('[data-sort]', el).forEach((th) =>
    th.addEventListener('click', (e) => {
      if (e.target.id === 'selAll') return; // the select-all box lives in the first header
      ui.dealSort = { k: th.dataset.sort, dir: sort.k === th.dataset.sort ? -sort.dir : 1 };
      rerender();
    }),
  );
  $$('[data-ie]', el).forEach(
    (input) =>
      (input.onchange = () => {
        const deal = ctx.api.get('deal', input.dataset.id);
        const key = input.dataset.ie;
        if (key === 'stage') return moveStage(deal, input.value);
        if ((key === 'nextStep' || key === 'nextStepDate') && !input.value.trim() && isOpen(deal))
          return (toast('Open deals need a next step and a date'), rerender()); // B-09
        try {
          ctx.api.update('deal', deal.id, { [key]: key === 'amount' ? (input.value === '' ? '' : Number(input.value)) : input.value.trim() });
          toast('Saved');
        } catch (e) {
          toast(e.message);
        }
        rerender();
      }),
  );
  $$('[data-sel]', el).forEach(
    (box) =>
      (box.onchange = () => {
        if (box.checked) ui.selected.add(box.dataset.sel);
        else ui.selected.delete(box.dataset.sel);
        rerender();
      }),
  );
  $('#selAll', el)?.addEventListener('change', (e) => {
    for (const d of deals) if (canEdit(ctx.user, 'deal', d)) e.target.checked ? ui.selected.add(d.id) : ui.selected.delete(d.id);
    rerender();
  });
  $('#bApply', el)?.addEventListener('click', () => {
    const stage = $('#bStage', el).value;
    const ownerId = $('#bOwner', el).value;
    const serviceLine = $('#bSvc', el).value;
    let done = 0;
    let skipped = 0;
    for (const id of ui.selected) {
      const deal = ctx.api.raw('deal', id);
      const patch = {};
      if (stage && deal.nextStep && deal.nextStepDate)
        patch.stage = stage; // B-09 still applies in bulk
      else if (stage) skipped++;
      if (ownerId) patch.ownerId = ownerId;
      if (serviceLine) patch.serviceLine = serviceLine;
      try {
        ctx.api.update('deal', id, patch, { persist: false });
        done++;
      } catch {
        skipped++;
      }
    }
    ctx.store.save(); // one write for the whole batch
    toast(`Updated ${done} deals${skipped ? `, ${skipped} skipped` : ''}`);
    ui.selected.clear();
    rerender();
  });
  $('#bArch', el)?.addEventListener('click', () => {
    const n = ui.selected.size;
    for (const id of ui.selected) ctx.api.update('deal', id, { archived: true }, { persist: false });
    ctx.store.save();
    toast(`Archived ${n} deals`);
    ui.selected.clear();
    rerender();
  });
}
