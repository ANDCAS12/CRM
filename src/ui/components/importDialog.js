/**
 * @file Import dialog (D-03, F-02, M-01), following the HubSpot import flow:
 * choose file → check mapping (with "don't overwrite") → choose create or create-and-update → name it → summary.
 */
import { canImport, getPreset, guessMapping, runImport, templateHeader } from '../../core/importer.js';
import { parseCSV } from '../../utils/csv.js';
import { today } from '../../utils/dates.js';
import { esc } from '../../utils/format.js';
import { saveFile } from '../../platform/capabilities.js';
import { ctx, state } from '../context.js';
import { $, $$, modal, toast } from '../dom.js';

/** Max rows read from one file in the browser; the server importer has no such cap. */
const MAX_ROWS = 50_000;

/** Reads a CSV or Excel file into rows (header first). */
async function readFile(file) {
  if (/\.xlsx?$/i.test(file.name)) {
    if (!window.XLSX) throw new Error('Excel support didn’t load. Save the sheet as CSV and try again.');
    const wb = window.XLSX.read(await file.arrayBuffer());
    return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }); // first sheet only
  }
  return parseCSV(await file.text());
}

/**
 * Opens the import dialog.
 * @param {string} presetKey e.g. 'contacts', 'contactsCompanies', 'hsDeals'
 * @param {(entry:object)=>void} [onViewRecords] called with the import entry when the user asks to see imported records
 */
export function openImportDialog(presetKey, onViewRecords) {
  if (!canImport(ctx.user, presetKey)) return toast('Your role can’t run this import.');
  const preset = getPreset(presetKey);
  let headers = [];
  let rows = [];
  let fileName = '';
  const modes = preset.modes || ['create'];

  const m = modal(
    `Import: ${preset.label}`,
    `<div class="steps"><span class="on" id="st1">1. File</span><span id="st2">2. Map columns</span><span id="st3">3. Finish</span></div>
    <p class="muted" style="margin-top:0">Each row is one record and each column one property. Keep first and last name in separate columns, or use a single full-name column.</p>
    <input type="file" id="impF" accept=".csv,.xlsx,.xls,text/csv" class="f" aria-label="Choose a CSV or Excel file">
    <div style="margin-top:8px"><button class="btn sm" id="tmpl">Download an example file</button></div>
    <div id="impMap" style="margin-top:14px"></div>`,
    {
      saveLabel: 'Finish import',
      wide: true,
      onSave: (body) => {
        if (!rows.length) throw new Error('Choose a file with at least one data row.');
        const mapping = {};
        const noOverwrite = [];
        for (const sel of $$('[data-map]', body)) if (sel.value !== '') mapping[sel.dataset.map] = Number(sel.value);
        for (const box of $$('[data-noow]:checked', body)) noOverwrite.push(box.dataset.noow); // "don't overwrite" per property
        if (!Object.keys(mapping).length) throw new Error('Map at least one column to a property.');
        const mode = $('input[name=impMode]:checked', body)?.value || 'create';
        const name = $('#impName', body).value.trim() || `${preset.label} ${today(ctx.now())}`;
        const report = runImport({
          api: ctx.api,
          store: ctx.store,
          user: ctx.user,
          presetKey,
          headers,
          rows,
          mapping,
          options: { mode, noOverwrite, name, fileName },
          now: ctx.now(),
        });
        setTimeout(() => showReport(report, onViewRecords), 30); // open the summary after this dialog closes
        ctx.render();
      },
    },
  );

  $('#tmpl', m.body).onclick = () => saveFile(ctx.caps.downloads, `ik-import-example-${presetKey}.csv`, `${templateHeader(preset).join(',')}\n`, toast);

  $('#impF', m.body).onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileName = file.name;
    let data;
    try {
      data = await readFile(file);
    } catch (err) {
      $('#impMap', m.body).innerHTML = `<div class="warn" role="alert">${esc(err.message)}</div>`;
      return;
    }
    headers = (data[0] || []).map((h) => String(h).trim());
    rows = data.slice(1).filter((r) => r.some((x) => String(x).trim() !== '')); // drop blank lines
    if (rows.length > MAX_ROWS) {
      $('#impMap', m.body).innerHTML =
        `<div class="warn" role="alert">This file has ${rows.length.toLocaleString()} rows. Split it into files of up to ${MAX_ROWS.toLocaleString()} rows.</div>`;
      rows = [];
      return;
    }
    const guess = guessMapping(preset, headers); // auto-align column names with properties
    const first = rows[0] || [];
    $('#st1', m.body).classList.remove('on');
    $('#st2', m.body).classList.add('on');
    $('#impMap', m.body).innerHTML =
      `<p class="small muted">${rows.length.toLocaleString()} rows and ${headers.length} columns found. Check each property’s column; unmapped columns are listed in the summary.</p>
      <div class="tablewrap"><table class="t"><thead><tr><th>Property</th><th>Column in your file</th><th>First value</th>${modes.includes('upsert') ? '<th>Don’t overwrite</th>' : ''}</tr></thead><tbody>
      ${preset.fields.map(([key, label]) => `<tr><td>${esc(label)}</td><td><select class="f" data-map="${key}" aria-label="Column for ${esc(label)}"><option value="">Don’t import</option>${headers.map((h, i) => `<option value="${i}"${guess[key] === i ? ' selected' : ''}>${esc(h)}</option>`).join('')}</select></td><td class="small muted" data-preview="${key}">${guess[key] !== undefined ? esc(first[guess[key]]) : ''}</td>${modes.includes('upsert') ? `<td><input type="checkbox" data-noow="${key}" aria-label="Don’t overwrite ${esc(label)}"></td>` : ''}</tr>`).join('')}
      </tbody></table></div>
      <div class="grid2" style="margin-top:14px">
        <div>${
          modes.includes('upsert')
            ? `<span class="l">If a record already exists</span>
          <label class="radio"><input type="radio" name="impMode" value="create" checked><span><b>Create new only</b><div class="small muted">Rows matching an existing email or domain are skipped.</div></span></label>
          <label class="radio"><input type="radio" name="impMode" value="upsert"><span><b>Create and update</b><div class="small muted">Contacts match by email, companies by domain or name. Ticked properties keep their current value.</div></span></label>`
            : '<p class="small muted">This import creates new records only.</p>'
        }</div>
        <div><label class="l" for="impName">Import name</label><input class="f" id="impName" value="${esc(`${preset.label} ${today(ctx.now())}`)}"><p class="small faint">Shown in the list of past imports.</p></div>
      </div>`;
    $('#st2', m.body).classList.remove('on');
    $('#st3', m.body).classList.add('on');
    for (const sel of $$('[data-map]', m.body)) {
      sel.onchange = () => ($(`[data-preview="${sel.dataset.map}"]`, m.body).textContent = sel.value === '' ? '' : (first[Number(sel.value)] ?? ''));
    }
  };
}

/** Import summary: created, updated, skipped, unmapped columns and fallbacks. */
export function showReport(report, onViewRecords) {
  const canView = onViewRecords && Object.keys(report.recordIds).some((k) => ['contact', 'company'].includes(k));
  const m = modal(
    'Import summary',
    `<p><b>${report.created}</b> created, <b>${report.updated}</b> updated, <b>${report.skipped.length}</b> skipped.</p>
    ${Object.entries(report.recordIds)
      .map(([type, ids]) => `<div class="small muted">${esc(type)}: ${ids.length} record${ids.length === 1 ? '' : 's'}</div>`)
      .join('')}
    ${report.unmappedColumns.length ? `<h3 style="margin-top:14px">Columns not imported</h3><p class="small">${report.unmappedColumns.map(esc).join(', ')}</p>` : ''}
    ${
      report.notes.length
        ? `<h3 style="margin-top:14px">Values that needed a fallback</h3><ul class="small">${report.notes
            .slice(0, 40)
            .map((n) => `<li>${esc(n)}</li>`)
            .join('')}</ul>`
        : ''
    }
    ${
      report.skipped.length
        ? `<h3 style="margin-top:14px">Skipped rows</h3><ul class="small">${report.skipped
            .slice(0, 40)
            .map((n) => `<li>${esc(n)}</li>`)
            .join('')}</ul>${report.skipped.length > 40 ? `<p class="small faint">…and ${report.skipped.length - 40} more.</p>` : ''}`
        : ''
    }
    ${canView ? '<div style="margin-top:14px"><button class="btn pri" id="viewImported">View imported records</button></div>' : ''}`,
    { cancelLabel: 'Close' },
  );
  $('#viewImported', m.body)?.addEventListener('click', () => {
    m.close();
    onViewRecords(state().imports.find((i) => i.id === report.id) || report);
  });
}

/** Opens a list page pinned to the records an import touched ("view imported records"). */
export function viewImportedRecords(entry) {
  const type = entry.recordIds.contact?.length ? 'contact' : 'company';
  const ids = entry.recordIds[type] || [];
  ctx.ui.lists[type] = { viewId: 'all', search: '', filters: [], sort: { field: 'name', dir: 1 }, ids, idsLabel: `From import: ${entry.name}`, limit: 200 };
  location.hash = type === 'contact' ? 'contacts' : 'companies';
  ctx.render();
}
