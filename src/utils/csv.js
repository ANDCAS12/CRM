/**
 * @file RFC 4180 CSV parsing and serialisation without dependencies.
 */

/**
 * Parses CSV text into rows of cells. Handles quoted cells, escaped quotes, CRLF and a UTF-8 BOM.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text).replace(/^\uFEFF/, ''); // Excel adds a BOM to UTF-8 CSVs
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'; // "" inside quotes is a literal quote
          i++;
        } else inQuotes = false; // closing quote
      } else field += c; // commas and newlines are literal inside quotes
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field); // end of cell
      field = '';
    } else if (c === '\n') {
      row.push(field); // end of row
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c; // ignore CR from CRLF line endings
  }
  if (field !== '' || row.length) {
    row.push(field); // flush last row when the file has no trailing newline
    rows.push(row);
  }
  return rows;
}

/** Quotes a cell only when it contains a comma, quote or newline. */
const quote = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Serialises an array of plain objects to CSV, using the first row's keys as the header.
 * @param {Record<string, unknown>[]} rows
 */
export function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return [keys.map(quote).join(','), ...rows.map((r) => keys.map((k) => quote(r[k])).join(','))].join('\n');
}
