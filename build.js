/* Generates artifact.html from index.html.
 *
 * The two entry points load exactly the same scripts; the only difference is
 * that the Artifact build carries the stylesheet inline, because the Artifact
 * CSP admits external stylesheets only from Google Fonts, and it omits the
 * document shell, because the Artifact runtime supplies one.
 *
 *   node build.js
 */
const fs = require('fs');

const page = fs.readFileSync('index.html', 'utf8');
const css  = fs.readFileSync('od/style.css', 'utf8');

const fonts = page.match(/<link rel="preconnect"[\s\S]*?display=swap">/)[0];
const scripts = page.match(/<script src="[^"]+"><\/script>/g).join('\n');

const out = [
  '<title>Our Dimension</title>',
  fonts,
  '<style>',
  css.trim(),
  '</style>',
  scripts,
  ''
].join('\n');

fs.writeFileSync('artifact.html', out);

const n = (scripts.match(/<script/g) || []).length;
console.log('artifact.html written — ' + n + ' scripts, ' +
            (Buffer.byteLength(out)/1024).toFixed(1) + ' KB');
