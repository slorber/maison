// Essai de fumée : ouvre la page construite (dist/index.html par défaut) dans Chromium sans écran et attend que la maquette
// soit prête (body.ready). Échoue sur toute erreur de page (exception non rattrapée), sur un fichier annexe demandé à côté
// de la page (elle doit être autonome) ou au bout du délai.
//   npm run smoke [-- chemin/page.html]
// Chromium : variable CHROMIUM_PATH (ou CHROME_PATH), sinon /opt/pw-browsers/chromium. playwright-core ne télécharge aucun navigateur.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const page = path.resolve(process.argv[2] || 'dist/index.html');
const executablePath = process.env.CHROMIUM_PATH || process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const timeout = +(process.env.SMOKE_TIMEOUT || 300000); // rendu logiciel (SwiftShader) : la construction peut prendre une minute
if (!fs.existsSync(page)) { console.error(`smoke : ${page} introuvable (lancer npm run build d'abord)`); process.exit(1); }
if (!fs.existsSync(executablePath)) { console.error(`smoke : Chromium introuvable (${executablePath}) ; indiquer son chemin dans CHROMIUM_PATH`); process.exit(1); }

const url = pathToFileURL(page).href, errors = [];
const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => errors.push(`erreur de page : ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') console.warn(`console : ${m.text().slice(0, 300)}`); });
  p.on('request', (r) => { if (r.url().startsWith('file:') && r.url() !== url) errors.push(`fichier annexe demandé : ${r.url()}`); });
  const t0 = Date.now();
  await p.goto(url, { timeout });
  await p.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout, polling: 500 });
  const info = await p.evaluate(() => {
    const m = window.__maquette, r = m.renderer().info;
    return { ouvrants: m.DOORS.length, triangles: r.render.triangles, programmes: r.programs?.length ?? 0 };
  });
  const kb = (fs.statSync(page).size / 1024).toFixed(0);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`smoke ok : ${path.relative(process.cwd(), page)} (${kb} Ko) prête en ${((Date.now() - t0) / 1000).toFixed(1)} s · ` +
    `${info.ouvrants} ouvrants · ${info.triangles} triangles · ${info.programmes} programmes`);
} catch (e) {
  console.error(`smoke : échec\n${errors.length ? errors.join('\n') : e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
