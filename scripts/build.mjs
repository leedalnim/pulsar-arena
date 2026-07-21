/**
 * build.mjs
 * ---------------------------------------------------------------------------
 * Bundles the ES-module source into a single self-contained HTML file that
 * runs by simply opening it (no local server needed). The modular source under
 * js/ stays the source of truth; this only produces dist/index.html.
 *
 *   npm run build   ->   dist/index.html
 * ---------------------------------------------------------------------------
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });

// 1) Bundle every module into one IIFE. charset:'utf8' keeps Korean readable.
const result = await build({
  entryPoints: ['js/main.js'],
  bundle: true,
  format: 'iife',
  charset: 'utf8',
  legalComments: 'none',
  write: false,
});
const js = result.outputFiles[0].text;
const css = readFileSync('css/styles.css', 'utf8');

// 2) Inline CSS + bundle into a standalone document.
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#060912" />
<title>PULSAR — Energy Core Arena</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Michroma&family=Chakra+Petch:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
${css}
</style>
</head>
<body>
<div id="app">
  <canvas id="game"></canvas>
  <div id="overlay" class="overlay"></div>
</div>
<script>
${js}
</script>
</body>
</html>
`;

writeFileSync('dist/index.html', html);
console.log(`built dist/index.html (${(html.length / 1024).toFixed(1)} kB)`);
