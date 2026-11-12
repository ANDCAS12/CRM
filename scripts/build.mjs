/**
 * Builds dist/index.html: one self-contained file with CSS and JS inlined.
 * A single file is what the Claude artifact host and any static host need.
 *
 * Usage: node scripts/build.mjs [--watch] [--no-minify]
 */
import { build, context } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const minify = !process.argv.includes('--no-minify');

/** esbuild options: bundle every ES module into one browser IIFE. */
const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife', // classic script: no module loading needed in the output
  target: ['es2020', 'chrome100', 'firefox100', 'safari15'],
  minify,
  legalComments: 'none',
  write: false, // keep output in memory so it can be inlined
  logLevel: 'info',
};

/** Inlines the bundle and stylesheet into the HTML template. */
async function assemble(result) {
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'); // never close the inline <script> early
  const css = await readFile('src/styles/app.css', 'utf8');
  const html = (await readFile('index.html', 'utf8'))
    .replace(/<!-- build:css -->[\s\S]*?<!-- \/build:css -->/, () => `<style>\n${css}\n</style>`) // function form: "$" in CSS stays literal
    .replace(/<!-- build:js -->[\s\S]*?<!-- \/build:js -->/, () => `<script>\n${js}\n</script>`);
  await mkdir('dist', { recursive: true });
  await writeFile('dist/index.html', html);
  console.log(`dist/index.html written (${(html.length / 1024).toFixed(0)} KB)`);
}

if (watch) {
  const ctx = await context({ ...options, plugins: [{ name: 'assemble', setup: (b) => b.onEnd((r) => r.errors.length || assemble(r)) }] });
  await ctx.watch(); // rebuild on every source change
  console.log('Watching for changes…');
} else {
  await assemble(await build(options));
}
