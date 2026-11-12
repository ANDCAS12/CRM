/**
 * @file Generic list page for contacts and companies (HubSpot-style index page):
 * saved view tabs, free-text search, property filters, sortable columns, frozen first column,
 * inline cell editing, paging and CSV export (C, D, L-01..L-04).
 */
import { fieldDefs } from '../../config/fields.js';
import { canEdit, isAdmin } from '../../core/permissions.js';
import { OPERATORS, runQuery } from '../../core/query.js';
import { esc } from '../../utils/format.js';
import { clone } from '../../utils/object.js';
import { exportRows, saveField } from '../actions.js';
import { ctx, rerender, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';
import { displayValue, inputHtml } from '../forms.js';

/** Rows rendered per page; more load on demand so 10k-row lists stay responsive. */
const PAGE_SIZE = 200;

/** Operators offered per field type. */
const OPS_BY_TYPE = {
  text: ['contains', 'is', 'isNot', 'known', 'unknown'],
  email: ['contains', 'is', 'known', 'unknown'],
  url: ['contains', 'known', 'unknown'],
  number: ['is', 'gte', 'lte', 'known', 'unknown'],
  date: ['lastDays', 'gte', 'lte', 'known', 'unknown'],
  datetime: ['lastDays', 'gte', 'lte'],
  select: ['is', 'isNot', 'known', 'unknown'],
  check: ['known', 'unknown'],
};

/** Per-type list state, created on first visit. */
function listState(type, defaultSort) {
  ctx.ui.lists[type] = ctx.ui.lists[type] || { viewId: 'all', search: '', filters: [], sort: defaultSort, ids: null, idsLabel: '', limit: PAGE_SIZE };
  return ctx.ui.lists[type];
}

/** Human description of a filter for its chip. */
function describeFilter(f, defs) {
  const def = defs.find((d) => d.k === f.field);
  const op = OPERATORS[f.op];
  const shown = op.noValue ? '' : ` ${def?.t === 'select' ? (def.o.find(([v]) => v === f.value)?.[1] ?? f.value) : f.value}`;
  return `${def?.l || f.field} ${op.label}${shown}`;
}

/**
 * Renders a list page into `root`.
 * @param {HTMLElement} root
 * @param {{type:string, title:string, singular:string, rows:object[], columns:{k:string,l:string,render?:(r:object)=>string,edit?:boolean,num?:boolean}[],
 *   accessors?:Record<string,(r:object)=>any>, searchFields:string[], defaultSort:{field:string,dir:1|-1}, headerActions?:string,
 *   toExport:(rows:object[])=>object[], onBind?:(root:HTMLElement)=>void}} cfg
 */
export function renderListView(root, cfg) {
  const ls = listState(cfg.type, cfg.defaultSort);
  const defs = fieldDefs(cfg.type, state()); // filterable properties come from the field registry
  const views = state().savedViews.filter((v) => v.objectType === cfg.type && (v.shared || v.ownerId === ctx.user.id));
  const rows = runQuery(cfg.rows, ls, cfg.accessors, cfg.searchFields, ctx.now());
  const page = rows.slice(0, ls.limit);
  const canWriteAny = canEdit(ctx.user, cfg.type, null) || ctx.user.role === 'admin';

  root.innerHTML = `<div class="pagehead"><div><h1>${esc(cfg.title)}</h1><div class="sub">${rows.length.toLocaleString()} of ${cfg.rows.length.toLocaleString()} ${esc(cfg.title.toLowerCase())}</div></div><div class="sp"></div>${cfg.headerActions || ''}</div>
  <div class="viewtabs" role="tablist" aria-label="Saved views">
    <button class="v ${ls.viewId === 'all' ? 'on' : ''}" data-view="all" role="tab">All ${esc(cfg.title.toLowerCase())}</button>
    ${views.map((v) => `<button class="v ${ls.viewId === v.id ? 'on' : ''}" data-view="${v.id}" role="tab">${esc(v.name)}${v.shared ? ' <span class="faint small">team</span>' : ''}${v.ownerId === ctx.user.id || isAdmin(ctx.user) ? `<span class="x" data-delview="${v.id}" role="button" aria-label="Delete view ${esc(v.name)}">✕</span>` : ''}</button>`).join('')}
    <div class="sp"></div><button class="btn sm" id="lvSave">Save view</button>
  </div>
  <div class="tools">
    <div class="search" style="max-width:300px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="lvQ" placeholder="Search ${esc(cfg.title.toLowerCase())}" value="${esc(ls.search)}" aria-label="Search ${esc(cfg.title.toLowerCase())}" autocomplete="off"></div>
    <div class="chips">
      ${ls.ids ? `<span class="chip on">${esc(ls.idsLabel)}<button data-clearids aria-label="Remove">✕</button></span>` : ''}
      ${ls.filters.map((f, i) => `<span class="chip">${esc(describeFilter(f, defs))}<button data-rmf="${i}" aria-label="Remove filter">✕</button></span>`).join('')}
      <button class="chipbtn" id="lvAdd">+ Add filter</button>
      ${ls.filters.length || ls.ids || ls.search ? '<button class="chipbtn" id="lvClear">Clear all</button>' : ''}
    </div>
    <div class="sp"></div><button class="btn" id="lvExp">Export CSV</button>
  </div>
  <div class="tablewrap"><table class="t frozen"><thead><tr>${cfg.columns.map((c) => `<th class="${c.num ? 'num' : ''}" data-sort="${c.k}" aria-sort="${ls.sort.field === c.k ? (ls.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${esc(c.l)}${ls.sort.field === c.k ? (ls.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead><tbody>
  ${page
    .map((r) => {
      const editable = canWriteAny && canEdit(ctx.user, cfg.type, ctx.api.raw(cfg.type, r.id)); // per-row check
      return `<tr>${cfg.columns
        .map((c) => {
          const def = defs.find((d) => d.k === c.k);
          if (c.edit && editable && def)
            return `<td class="${c.num ? 'num' : ''}" data-cell="${r.id}:${c.k}">${inputHtml(def, r[c.k])
              .replace('class="f"', 'class="cellin"')
              .replace(`id="f_${c.k}"`, `aria-label="${esc(c.l)}"`)}</td>`; // inline edit (B-02 style)
          return `<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : def ? displayValue(def, r[c.k]) : esc(r[c.k])}</td>`;
        })
        .join('')}</tr>`;
    })
    .join('')}
  </tbody></table>${rows.length ? '' : `<div class="empty">No ${esc(cfg.title.toLowerCase())} match. Clear a filter or add a new one.</div>`}</div>
  ${rows.length > page.length ? `<div style="text-align:center;margin-top:12px"><button class="btn" id="lvMore">Show ${Math.min(PAGE_SIZE, rows.length - page.length)} more</button></div>` : ''}`;

  /* ---- bindings ---- */
  let debounce;
  $('#lvQ', root).addEventListener('input', (e) => {
    ls.search = e.target.value; // record the text immediately so any other re-render uses it
    ls.limit = PAGE_SIZE;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      // only the redraw is debounced, so large lists don't re-render on every key
      const typing = document.activeElement?.id === 'lvQ'; // has the user moved on (e.g. into a dialog)?
      rerender();
      const q = $('#lvQ');
      if (typing && q) {
        q.focus(); // keep the cursor in the box, but never pull focus back from elsewhere
        q.setSelectionRange(q.value.length, q.value.length);
      }
    }, 180);
  });
  $$('[data-view]', root).forEach(
    (b) =>
      (b.onclick = (e) => {
        if (e.target.dataset.delview) return; // the ✕ inside the tab has its own handler
        const v = views.find((x) => x.id === b.dataset.view);
        Object.assign(
          ls,
          v
            ? { viewId: v.id, ...clone({ search: '', filters: [], sort: cfg.defaultSort, ...v.query }) }
            : { viewId: 'all', search: '', filters: [], sort: cfg.defaultSort },
        );
        ls.ids = null;
        ls.limit = PAGE_SIZE;
        rerender();
      }),
  );
  $$('[data-delview]', root).forEach(
    (x) =>
      (x.onclick = () => {
        ctx.api.remove('savedView', x.dataset.delview);
        if (ls.viewId === x.dataset.delview) ls.viewId = 'all';
        toast('View deleted');
        rerender();
      }),
  );
  $('#lvSave', root).onclick = () =>
    modal(
      'Save view',
      `<label class="l" for="svName">Name</label><input class="f" id="svName" placeholder="e.g. Data leaders in Chicago"><label class="chk" style="margin-top:12px"><input type="checkbox" id="svShared" checked> Share with the team</label>`,
      {
        saveLabel: 'Save view',
        onSave: (body) => {
          const name = $('#svName', body).value.trim();
          if (!name) throw new Error('Name the view.');
          const view = ctx.api.create('savedView', {
            objectType: cfg.type,
            name,
            query: clone({ search: ls.search, filters: ls.filters, sort: ls.sort }),
            ownerId: ctx.user.id,
            shared: $('#svShared', body).checked,
          });
          ls.viewId = view.id;
          toast('View saved');
          rerender();
        },
      },
    );
  $$('[data-rmf]', root).forEach(
    (b) =>
      (b.onclick = () => {
        ls.filters.splice(Number(b.dataset.rmf), 1);
        rerender();
      }),
  );
  $('[data-clearids]', root)?.addEventListener('click', () => {
    ls.ids = null;
    rerender();
  });
  $('#lvClear', root)?.addEventListener('click', () => {
    Object.assign(ls, { filters: [], search: '', ids: null });
    rerender();
  });
  $('#lvAdd', root).onclick = () =>
    filterDialog(
      defs.filter((d) => OPS_BY_TYPE[d.t]),
      ls,
    );
  $$('[data-sort]', root).forEach(
    (th) =>
      (th.onclick = () => {
        ls.sort = { field: th.dataset.sort, dir: ls.sort.field === th.dataset.sort ? -ls.sort.dir : 1 }; // click again to reverse
        rerender();
      }),
  );
  $$('[data-cell]', root).forEach((td) => {
    const [id, key] = td.dataset.cell.split(':');
    const input = td.querySelector('input,select');
    input.addEventListener('change', () => {
      const def = defs.find((d) => d.k === key);
      const value = def.t === 'number' ? (input.value === '' ? '' : Number(input.value)) : def.t === 'check' ? input.checked : input.value.trim();
      if (saveField(cfg.type, id, key, value)) toast('Saved');
      rerender();
    });
  });
  $('#lvMore', root)?.addEventListener('click', () => {
    ls.limit += PAGE_SIZE;
    rerender();
  });
  $('#lvExp', root).onclick = () => exportRows(`ik-${cfg.type}s`, cfg.toExport(rows), 'csv');
  cfg.onBind?.(root);
}

/** Dialog to add one property filter. */
function filterDialog(defs, ls) {
  const m = modal(
    'Add filter',
    `<div class="filterrow" style="grid-template-columns:1fr 1fr 1fr"><div><label class="l" for="ffField">Property</label><select class="f" id="ffField">${defs.map((d) => `<option value="${d.k}">${esc(d.l)}</option>`).join('')}</select></div><div><label class="l" for="ffOp">Condition</label><select class="f" id="ffOp"></select></div><div id="ffValWrap"></div></div>`,
    {
      saveLabel: 'Apply filter',
      onSave: (body) => {
        const field = $('#ffField', body).value;
        const op = $('#ffOp', body).value;
        const valueEl = $('#ffVal', body);
        const value = valueEl ? valueEl.value : undefined;
        if (!OPERATORS[op].noValue && (value === '' || value === undefined)) throw new Error('Enter a value.');
        ls.filters.push({ field, op, value });
        ls.limit = PAGE_SIZE;
        rerender();
      },
    },
  );
  const sync = () => {
    const def = defs.find((d) => d.k === $('#ffField', m.body).value);
    const ops = OPS_BY_TYPE[def.t] || ['is'];
    const opSel = $('#ffOp', m.body);
    const current = opSel.value;
    opSel.innerHTML = ops.map((o) => `<option value="${o}"${o === current ? ' selected' : ''}>${OPERATORS[o].label}</option>`).join('');
    const op = OPERATORS[opSel.value];
    const valueType = opSel.value === 'lastDays' ? 'number' : def.t === 'datetime' ? 'date' : def.t;
    const valueDef = {
      ...def,
      k: 'ffVal',
      t: valueType === 'select' ? 'select' : ['number', 'date'].includes(valueType) ? valueType : 'text',
      o: (def.o || []).filter(([v]) => v !== ''),
    };
    $('#ffValWrap', m.body).innerHTML = op.noValue
      ? ''
      : `<label class="l" for="f_ffVal">Value</label>${inputHtml(valueDef, '').replace('id="f_ffVal"', 'id="ffVal"')}`;
  };
  $('#ffField', m.body).onchange = sync;
  $('#ffOp', m.body).onchange = sync;
  sync();
}
