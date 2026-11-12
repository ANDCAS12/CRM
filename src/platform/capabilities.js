/**
 * @file Bridges to the Claude artifact runtime (Claude sampling and file downloads).
 * Outside the runtime (e.g. on GitHub Pages) downloads fall back to the browser and AI summaries to a local draft.
 */

/**
 * Requests the runtime capabilities without blocking first paint.
 * @param {Window} win
 * @returns {{sample: Promise<any>, downloads: Promise<any>}}
 */
export function initCapabilities(win = globalThis) {
  const use = win?.claude?.use; // runtime injects window.claude.use when framed in Claude
  if (typeof use !== 'function') return { sample: Promise.resolve(null), downloads: Promise.resolve(null) };
  const safe = (name) => win.claude.use(name).catch(() => null); // a failure means "unavailable"
  return { sample: safe('sample'), downloads: safe('downloads') };
}

/**
 * Standard browser download for hosted builds outside Claude.
 * @param {string} filename
 * @param {string|Blob} data
 * @param {(msg:string)=>void} notify
 */
export function browserDownload(filename, data, notify, doc = globalThis.document) {
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith('.csv') ? 'text/csv;charset=utf-8' : 'application/octet-stream' });
    const url = URL.createObjectURL(blob); // temporary in-memory link to the file
    const a = doc.createElement('a');
    a.href = url;
    a.download = filename; // tells the browser to save rather than open it
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // free the memory once the download has started
    notify(`Downloaded ${filename}`);
    return true;
  } catch (e) {
    notify(`Couldn’t download: ${e?.message || e}`);
    return false;
  }
}

/**
 * Offers a generated file to the viewer.
 * @param {Promise<any>} downloadsPromise
 * @param {string} filename
 * @param {string|Blob} data
 * @param {(msg:string)=>void} notify user-facing message sink
 */
export async function saveFile(downloadsPromise, filename, data, notify) {
  const downloads = await downloadsPromise;
  if (!downloads) return browserDownload(filename, data, notify); // regular website (e.g. GitHub Pages): use a normal download
  try {
    await downloads.save({ filename, data });
    notify(`Saved ${filename}`);
    return true;
  } catch (e) {
    if (e?.code !== 'declined') notify(`Couldn’t save: ${e?.message || e?.code}`); // declining is the viewer's choice, not an error
    return false;
  }
}
