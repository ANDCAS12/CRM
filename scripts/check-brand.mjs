/**
 * Fails the build if any source uses colours outside the IK brand tokens (§7),
 * including pure black or pure white. Comments are ignored.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ALLOWED = new Set(['#742208', '#6b7d2e', '#1c1208', '#3d3833', '#f3f3f3', '#e8e0d0', '#b8935a']); // the seven tokens
const BANNED_WORDS = /\b(white|black)\b(?![-\w])/i; // CSS named colours

/** Recursively lists .css and .js files. */
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (/\.(css|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

let failures = 0;
for (const file of await files('src')) {
  const text = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // strip comments
  for (const m of text.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
    const hex = m[0].toLowerCase();
    if (hex.length === 4 || !ALLOWED.has(hex)) {
      console.error(`${file}: colour ${m[0]} is not an IK brand token`);
      failures++;
    }
  }
  if (file.endsWith('.css')) {
    for (const line of text.split('\n'))
      if (/(color|background|fill|stroke|border)[^:;]*:[^;]*/.test(line) && BANNED_WORDS.test(line.split(':').slice(1).join(':'))) {
        console.error(`${file}: named colour in "${line.trim()}"`);
        failures++;
      }
  }
}
if (failures) process.exit(1);
console.log('Brand check passed: only IK tokens used.');
