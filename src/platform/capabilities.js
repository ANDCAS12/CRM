/**
 * @file Bridges to the Claude artifact runtime (Claude sampling and file downloads).
 * Outside the runtime both resolve to null and features degrade gracefully.
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
 * Offers a generated file to the viewer.
 * @param {Promise<any>} downloadsPromise
 * @param {string} filename
 * @param {string|Blob} data
 * @param {(msg:string)=>void} notify user-facing message sink
 */
export async function saveFile(downloadsPromise, filename, data, notify) {
  const downloads = await downloadsPromise;
  if (!downloads) {
    notify('Downloads aren’t available in this view. Open the app in Claude to export.');
    return false;
  }
  try {
    await downloads.save({ filename, data });
    notify(`Saved ${filename}`);
    return true;
  } catch (e) {
    if (e?.code !== 'declined') notify(`Couldn’t save: ${e?.message || e?.code}`); // declining is the viewer's choice, not an error
    return false;
  }
}
