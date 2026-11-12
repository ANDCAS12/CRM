/**
 * @file SharePoint documents card (J-01). Stores the folder link; file list is a stub until
 * Microsoft Graph credentials are provided (§10).
 */
import { stubFiles } from '../../ai/summary.js';
import { esc } from '../../utils/format.js';

/** Documents card for a deal or company. */
export function filesCardHtml(record) {
  if (!record.folderUrl)
    return '<div class="card"><div class="cardh"><h2>Documents</h2></div><div class="small muted">No SharePoint folder linked yet. Add one in the properties.</div></div>';
  const rows = stubFiles(record.name)
    .map(
      ([name, kind, days]) =>
        `<li><span class="pill">${kind}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span><span class="small faint">${days}d</span></li>`,
    )
    .join('');
  return `<div class="card"><div class="cardh"><h2>Documents</h2><div class="sp"></div><a href="${esc(record.folderUrl)}" target="_blank" rel="noopener">Open folder</a></div><ul class="mini">${rows}</ul><p class="small faint" style="margin:8px 0 0">Sample file list. Connect Microsoft Graph (read-only) to list the real SharePoint files.</p></div>`;
}
