// Panneau de commandes : vues, affichage, sols, soleil, clic sur les ouvrants, capture d'image ; accès d'essai window.__maquette
import * as THREE from 'three';
import { M, finish, setTile, setParquet } from '../noyau/materiaux';
import { TILE_OPTIONS, PARQUET_OPTIONS } from '../noyau/textures';
import { groups, DOORS, state } from '../noyau/etat';
import { renderer, scene, camera, controls, composer, gtao, PERF, fast, setFast, setDpr, hqDpr, requestRender } from '../noyau/rendu';
import { sun, updateSun, animateSun, SUN_DAY, setSunHold, setShowHour } from '../noyau/soleil';
import { setView, applyVisibility } from './vues';
import { hAt } from '../terrain/relief';

// ---------------------------------------------------------------- interface
export function bindUI() {
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  const tog = (id: string, key: string) => { const el = document.getElementById(id) as HTMLInputElement; el.checked = state[key]; el.addEventListener('change', () => { state[key] = el.checked; applyVisibility(); }); };
  tog('t-roof', 'roof'); tog('t-furn', 'furn'); tog('t-fence', 'fence'); tog('t-pergola', 'pergola'); tog('t-volets', 'volets'); tog('t-ao', 'ao');
  for (const [id, lvl] of [['tile-r', 'R'], ['tile-w', 'W']] as const) {
    const s = document.getElementById(id) as HTMLSelectElement;
    for (const [k, o] of Object.entries(TILE_OPTIONS)) { const op = document.createElement('option'); op.value = k; op.textContent = o.label; s.appendChild(op); }
    s.value = finish[lvl]; s.addEventListener('change', () => setTile(lvl, s.value));
  }
  { const s = document.getElementById('tile-p') as HTMLSelectElement;
    for (const [k, o] of Object.entries(PARQUET_OPTIONS)) { const op = document.createElement('option'); op.value = k; op.textContent = o.label; s.appendChild(op); }
    s.value = finish.P; s.addEventListener('change', () => setParquet(s.value)); }
  const mo = document.getElementById('month') as HTMLSelectElement, hr = document.getElementById('hour') as HTMLInputElement, hl = document.getElementById('hour-label');
  mo.value = String(state.month); hr.value = String(state.hour);
  const fmt = h => { const m = Math.floor(h * 60 + 1e-6); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; }; // minutes entières : l'animation donne des heures quelconques (plus de « 13 h 60 »)
  hl.textContent = fmt(state.hour);
  setShowHour(() => { const q = Math.round(state.hour * 4) / 4, t = fmt(state.hour); if (+hr.value !== q) hr.value = String(q); if (hl.textContent !== t) hl.textContent = t; });
  mo.addEventListener('change', () => { state.month = +mo.value; updateSun(true); });
  hr.addEventListener('input', () => { state.hour = +hr.value; hl.textContent = fmt(state.hour); updateSun(true); });
  hr.addEventListener('pointerdown', () => { setSunHold(true); });
  for (const t of ['pointerup', 'pointercancel']) window.addEventListener(t, () => { setSunHold(false); }); hr.addEventListener('change', () => { setSunHold(false); });
  // vitesse de l'animation du soleil : 0 = arrêtée, 1 = une journée en 10 s (durée d'une journée = 10 s / v)
  const sp = document.getElementById('sun-speed') as HTMLInputElement, sl = document.getElementById('sun-speed-label');
  const fmtSp = v => { if (!(v > 0)) return 'désactivée'; const s = SUN_DAY / v, r = Math.round(s); return '1 j = ' + (s < 59.95 ? String(+s.toFixed(1)).replace('.', ',') + ' s' : `${Math.floor(r / 60)} min ${String(r % 60).padStart(2, '0')} s`); };
  sp.value = String(state.sunSpeed); sl.textContent = fmtSp(state.sunSpeed);
  sp.addEventListener('input', () => { const was = state.sunSpeed > 0; state.sunSpeed = +sp.value; sl.textContent = fmtSp(state.sunSpeed); if (was && !(state.sunSpeed > 0)) updateSun(true); }); // à l'arrêt : ombres et ambiance exactes, image pleine qualité
  // clic sur une porte intérieure, le portail ou le portillon : ouverture / fermeture (les murs et clôtures visibles masquent les ouvrants situés derrière)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), cvs = renderer.domElement; let down = null, lastHover = 0;
  const doorAt = ev => { const r = cvs.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera);
    const objs: THREE.Object3D[] = ['rdc', 'r1', 'slab1', 'ceil1', 'skinU', 'skinR', 'furn0', 'furn1', 'roof', 'fence'].map(k => groups[k]).filter(g => g.visible);
    // [perf] d'abord les seuls ouvrants (quelques milliers de triangles) : au survol, presque toujours rien, et on s'arrête là ;
    // sinon lancer complet limité à la distance de l'ouvrant touché, pour vérifier qu'aucun mur ne le masque (même résultat qu'avant)
    const dm = []; for (const d of DOORS) for (const m of d.meshes) { let t = m; while (t.parent && t.parent !== scene) t = t.parent; if (objs.includes(t)) dm.push(m); }
    const dh = ray.intersectObjects(dm, false)[0]; if (!dh) return undefined;
    ray.far = dh.distance + 1e-6; const hit = ray.intersectObjects(objs, true)[0]; ray.far = Infinity; return hit && hit.object.userData.door; };
  cvs.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  cvs.addEventListener('pointerup', ev => { if (!down) return; const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y), quick = performance.now() - down.t < 500; down = null;
    if (moved < 6 && quick) { const d = doorAt(ev); if (d) d.target = d.target > 0.5 ? 0 : 1; } });
  cvs.addEventListener('pointermove', ev => { if (ev.buttons || performance.now() - lastHover < 90) return; lastHover = performance.now(); cvs.style.cursor = doorAt(ev) ? 'pointer' : ''; });
  // [perf] capture en pleine qualité, y compris si elle est demandée pendant un mouvement (écouteur de capture : passe avant celui de nav.ts)
  document.getElementById('snap').addEventListener('click', () => { setFast(false); setDpr(hqDpr()); requestRender(false); }, true);
  document.getElementById('snap').addEventListener('click', () => {
    if (state.ao && composer && (state.inside || state.mode !== 'ext')) composer.render(); else renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    const dlg = document.getElementById('shot'); (document.getElementById('shot-img') as HTMLImageElement).src = url; dlg.hidden = false;
    const a = document.getElementById('shot-dl') as HTMLAnchorElement; a.href = url;
  });
  try { if (window.self !== window.top) document.getElementById('shot-dl').hidden = true; } catch (e) { document.getElementById('shot-dl').hidden = true; }
  // dans la visionneuse claude.ai, le lien de téléchargement passe par la capacité « downloads »
  let saver = null;
  window.claude?.use?.('downloads').then(d => { saver = d; if (d) document.getElementById('shot-dl').hidden = false; }).catch(() => {});
  document.getElementById('shot-dl').addEventListener('click', ev => {
    if (!saver) return; ev.preventDefault();
    const bin = atob((document.getElementById('shot-img') as HTMLImageElement).src.split(',')[1] || ''), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length) saver.save({ filename: 'maison-merlettes.png', data: bytes }).catch(() => {});
  });
  document.getElementById('shot-close').addEventListener('click', () => { document.getElementById('shot').hidden = true; });
  const panel = document.getElementById('panel'); document.getElementById('collapse').addEventListener('click', () => { const c = panel.classList.toggle('collapsed'); document.getElementById('collapse').setAttribute('aria-expanded', c ? 'false' : 'true'); });
  if (matchMedia('(max-width: 700px)').matches) { panel.classList.add('collapsed'); document.getElementById('collapse').setAttribute('aria-expanded', 'false'); }
  window.__maquette = { M, groups, DOORS, setView, state, applyVisibility, updateSun, animateSun, setTile, setParquet, hAt, get composer() { return composer; }, get gtao() { return gtao; }, scene: () => scene, renderer: () => renderer, sun: () => sun, camera: () => camera, controls: () => controls,
    requestRender, perf: PERF, get fast() { return fast; } };
}
