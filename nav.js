// Navigation : vues de toutes les pièces, balade au clavier, optiques (œil humain, grand angle, panoramique), vue ouverte, silhouettes
// Appelé après bindUI() : initNav(ctx). Le panneau est complété par le DOM (aucune modification du gabarit nécessaire).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const DEG = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0);
const EYE = 1.60, R_BODY = 0.22, CUT = 1.25, SHIFT_MAX = 30 * DEG, CS = 0.5;
const LS_KEY = 'merlettes-optique', LS_EYE = 'merlettes-oeil';
// visite à hauteur d'homme : yeux à 1,75 m par défaut, réglables de 1,00 à 2,00 m (demande client du 12/10)
const EYE_MIN = 1.0, EYE_MAX = 2.0, EYE_DEF = 1.75;
// optiques : h = champ horizontal (°) mesuré sur la partie de l'écran non couverte par le panneau ; « classique » = 64° vertical, regard non redressé
const OPTICS = {
  oeil: { label: 'Œil humain (75°)', h: 75 },
  grand: { label: 'Grand angle (95°)', h: 95 },
  pano: { label: 'Panoramique (120°)', h: 120 },
  classique: { label: 'Classique (64° vertical)' },
};
// pièces : b = [x0, x1, z0, z1] (X vers le sud, Z vers l'ouest), lv = niveau, f = sol si différent du niveau ;
// p → t : œil (x, z) et point visé (x, z), a = inclinaison du regard (°, rendue par décentrement : verticales droites) ;
// vue ouverte : oa = azimut du côté caméra (° de +X vers +Z), oe = élévation (°), cut = hauteur de coupe des murs au-dessus du sol
const ROOMS = [
  { k: 'entree', n: 'Entrée', s: '12,82 m²', lv: 0, b: [0.36, 5.16, 1.43, 3.30], p: [5.00, 3.10], t: [0.40, 1.95], a: -9, oa: 75, oe: 50 },
  { k: 'wc', n: 'WC', s: '2,00 m²', lv: 0, b: [0.36, 2.36, 0.36, 1.36], p: [2.22, 1.25], t: [0.40, 0.55], a: -22, oa: 5, oe: 62, cut: 1.0 },
  { k: 'cuisine', n: 'Cuisine', s: '11,50 m²', lv: 0, b: [0.36, 3.86, 4.24, 7.54], p: [3.97, 5.00], t: [0.45, 7.20], a: -11, oa: 0, oe: 45 },
  { k: 'sam', n: 'Salle à manger', lv: 0, b: [3.86, 8.0, 3.30, 7.54], p: [4.05, 3.50], t: [7.90, 7.40], a: -10, oa: 20, oe: 45 },
  { k: 'sejour', n: 'Séjour', s: '36,24 m² avec la salle à manger', lv: 0, b: [8.0, 12.54, 3.30, 7.54], p: [12.28, 3.85], t: [8.0, 7.35], a: -9, oa: 165, oe: 45 },
  { k: 'garage', n: 'Garage', s: '16,41 m² (21,36 m² au plan, local technique compris)', lv: 0, f: -0.13, b: [7.08, 12.68, 0.22, 3.15], p: [12.45, 2.98], t: [7.20, 0.55], a: -9, oa: 0, oe: 45 },
  { k: 'technique', n: 'Local technique', s: '4,74 m²', lv: 0, f: -0.13, b: [5.31, 7.01, 0.36, 3.15], p: [6.85, 2.95], t: [5.40, 0.45], a: -12, oa: 0, oe: 45 },
  { k: 'palier', n: 'Palier', s: '6,05 m²', lv: 1, b: [3.91, 9.07, 3.17, 4.17], p: [8.92, 3.67], t: [3.0, 3.67], a: -7, oa: 0, oe: 50 },
  { k: 'bains', n: 'Bains', s: '9,54 m²', lv: 1, b: [0.36, 3.86, 0.36, 3.10], p: [0.60, 0.62], t: [3.80, 3.00], a: -12, oa: 180, oe: 52 },
  { k: 'wc1', n: 'WC', s: '1,53 m²', lv: 1, b: [3.93, 4.83, 0.36, 2.11], p: [4.36, 2.80], t: [4.40, 0.36], a: -18, oa: 90, oe: 65, cut: 1.0 },
  { k: 'douche', n: "Salle d'eau", s: '3,86 m², suite parentale', lv: 1, b: [4.90, 6.31, 0.36, 3.10], p: [5.05, 0.58], t: [6.10, 3.05], a: -12, oa: -90, oe: 62, cut: 1.0 },
  { k: 'dressing', n: 'Dressing', s: '5,29 m²', lv: 1, b: [6.38, 8.38, 0.36, 3.10], p: [8.28, 2.05], t: [6.30, 1.70], a: -9, oa: -90, oe: 55 },
  { k: 'ch1', n: 'Chambre 1', s: '14,80 m²', lv: 1, b: [8.45, 12.54, 0.36, 4.17], p: [9.40, 3.85], t: [12.40, 0.60], a: -10, oa: 60, oe: 45 },
  { k: 'ch2', n: 'Chambre 2', s: '14,47 m²', lv: 1, b: [8.14, 12.54, 4.24, 7.54], p: [8.62, 4.45], t: [12.45, 7.45], a: -9, oa: 40, oe: 45 },
  { k: 'ch3', n: 'Chambre 3', s: '15,26 m²', lv: 1, b: [0.36, 5.02, 4.24, 7.54], p: [4.45, 4.45], t: [0.40, 7.45], a: -9, oa: 100, oe: 45 },
  { k: 'bureau', n: 'Bureau', s: '9,83 m²', lv: 1, b: [5.09, 8.07, 4.24, 7.54], p: [7.75, 4.45], t: [5.12, 7.45], a: -9, oa: -110, oe: 47 },
];
const RM = Object.fromEntries(ROOMS.map(r => [r.k, r]));
// silhouettes 1,75 m : [x, z, niveau, direction du regard (° de +X vers +Z)]
const FIGURES = [[9.55, 4.75, 0, 120], [1.30, 6.10, 0, 180], [11.95, 2.90, 1, 200], [1.40, 2.25, 1, 90], [7.35, 6.35, 1, 90]];
// calques des collisions : 0 gros œuvre (obstacle au-dessus de 0,40 m : marches franchissables), 1 mobilier et clôtures (au-dessus de 0,15 m), 2 plancher seul
const LAYER_KIND = { rdc: 0, r1: 0, skinU: 0, skinR: 0, slab1: 2, furn0: 1, furn1: 1, fence: 1 };
const CLIP_LAYERS = ['rdc', 'r1', 'skinU', 'skinR', 'volets0', 'volets1'];

export function initNav(ctx) {
  const { camera, controls, renderer, scene, state, VIEWS, setView, updateSun, groups, hooks, DOORS, hAt, E1 } = ctx;
  const floorOf = r => r.f ?? (r.lv ? E1 : 0);
  const inFootprint = (x, z) => x > 0 && x < ctx.L && z > 0 && z < ctx.D;
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
  let optic = 'oeil', openMode = false, snapping = false;
  try { const o = localStorage.getItem(LS_KEY); if (o && OPTICS[o]) optic = o; } catch (e) { /* stockage indisponible */ }
  let eyeH = EYE_DEF;
  try { const v = parseFloat(localStorage.getItem(LS_EYE)); if (v >= EYE_MIN && v <= EYE_MAX) eyeH = v; } catch (e) { /* stockage indisponible */ }

  // ------------------------------------------------------------ vues des pièces (œil à 1,60 m) ; vues ouvertes calculées au clic
  for (const r of ROOMS) {
    const f = floorOf(r), ey = f + EYE, dist = Math.hypot(r.t[0] - r.p[0], r.t[1] - r.p[1]);
    VIEWS['p_' + r.k] = { p: [r.p[0], ey, r.p[1]], t: [r.t[0], ey + Math.tan((r.a ?? -9) * DEG) * dist, r.t[1]], mode: 'ext', inside: 1 };
    VIEWS['o_' + r.k] = openView(r);
  }
  // largeur couverte par le panneau à gauche (le cadrage est centré sur la partie libre de l'écran)
  function frameInfo() {
    const c = renderer.domElement, W = c.clientWidth || innerWidth, H = c.clientHeight || innerHeight; let pr = 0;
    const p = document.getElementById('panel');
    if (!snapping && p && !p.classList.contains('collapsed')) { const b = p.getBoundingClientRect(); if (b.width > 0 && b.right < W * 0.5) pr = b.right + 6; }
    return { W, H, pr };
  }
  // vue ouverte : caméra au-dessus et en dehors de la pièce, ~45°, distance ajustée pour que la pièce entière tienne dans le cadre libre
  function openView(r) {
    const [x0, x1, z0, z1] = r.b, f = floorOf(r);
    const c = new THREE.Vector3((x0 + x1) / 2, f + 0.5, (z0 + z1) / 2), az = (r.oa ?? 45) * DEG, el = (r.oe ?? 45) * DEG;
    const back = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)), fwd = back.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    const fi = frameInfo(), tv = Math.tan(22.5 * DEG) * 0.8, th = tv * (fi.W - fi.pr) / fi.H; let d = 2;
    for (const x of [x0, x1]) for (const y of [f, f + 2.0]) for (const z of [z0, z1]) {
      const q = _v.set(x, y, z).sub(c), zf = q.dot(fwd);
      d = Math.max(d, Math.abs(q.dot(right)) / th - zf, Math.abs(q.dot(up)) / tv - zf);
    }
    return { p: c.clone().addScaledVector(back, d).toArray(), t: c.toArray(), mode: r.lv ? 'r1' : 'rdc' };
  }
  const isOpenView = () => typeof state.lastView === 'string' && state.lastView.startsWith('o_') && state.mode !== 'ext';
  const eyeLevel = () => W.on || (state.inside && state.mode === 'ext');

  // ------------------------------------------------------------ vue ouverte : murs coupés à hauteur d'allège (géométrie recoupée sur le CPU, mêmes matériaux,
  // faces arrière en gris foncé = poché de coupe ; aucun nouveau shader à compiler hormis le poché)
  const POCHE = new THREE.MeshBasicMaterial({ color: '#4f4b47', side: THREE.BackSide });
  let clipped = null, clipH = null; const clipCache = new WeakMap(), _m = new THREE.Matrix4();
  function clipGeometry(geo, plane) { // garde la partie où plane.distanceToPoint >= 0
    const src = geo.index ? geo.toNonIndexed() : geo, pos = src.attributes.position, nor = src.attributes.normal, uv = src.attributes.uv, P = [], N = [], UV = [];
    const V = i => { _v.fromBufferAttribute(pos, i); return { p: [_v.x, _v.y, _v.z], n: nor ? [nor.getX(i), nor.getY(i), nor.getZ(i)] : null, u: uv ? [uv.getX(i), uv.getY(i)] : null, d: plane.distanceToPoint(_v) }; };
    const L = (a, b, t) => ({ p: a.p.map((v, k) => v + (b.p[k] - v) * t), n: a.n && a.n.map((v, k) => v + (b.n[k] - v) * t), u: a.u && a.u.map((v, k) => v + (b.u[k] - v) * t) });
    const push = q => { P.push(...q.p); if (q.n) N.push(...q.n); if (q.u) UV.push(...q.u); };
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const v = [V(i), V(i + 1), V(i + 2)]; if (v[0].d >= 0 && v[1].d >= 0 && v[2].d >= 0) { v.forEach(push); continue; }
      const out = []; for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3]; if (a.d >= 0) out.push(a); if ((a.d >= 0) !== (b.d >= 0)) out.push(L(a, b, a.d / (a.d - b.d))); }
      for (let k = 1; k + 1 < out.length; k++) { push(out[0]); push(out[k]); push(out[k + 1]); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.addGroup(0, P.length / 3, 0); return g;
  }
  function clipTargets() {
    const out = [], take = o => { if (o.isMesh && !o.userData.navPoche) out.push(o); };
    for (const l of CLIP_LAYERS) groups[l] && groups[l].traverse(take);
    for (const l of ['furn0', 'furn1']) groups[l] && groups[l].traverse(o => { if (o.isMesh && (o.userData.door || o.material === ctx.M.door)) take(o); }); // vantaux de portes
    return out;
  }
  function unclip() { if (!clipped) return; for (const o of clipped) { o.geometry = o.userData.navGeo; delete o.userData.navGeo; if (o.userData.navPocheMesh) o.remove(o.userData.navPocheMesh); } clipped = null; clipH = null; }
  function updateClip() {
    const r = isOpenView() ? RM[state.lastView.slice(2)] : null, h = r ? floorOf(r) + (r.cut ?? CUT) : null;
    if (h === clipH) return; unclip(); if (h === null) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), h); clipped = clipTargets(); clipH = h; scene.updateMatrixWorld();
    for (const o of clipped) {
      let c = clipCache.get(o); if (!c) clipCache.set(o, c = new Map());
      let g = c.get(h); if (!g) { g = clipGeometry(o.geometry, plane.clone().applyMatrix4(_m.copy(o.matrixWorld).invert())); c.set(h, g); }
      o.userData.navGeo = o.geometry; o.geometry = g;
      const transp = Array.isArray(o.material) ? o.material[0].transparent : o.material.transparent;
      if (!transp) { let pm = o.userData.navPocheMesh; if (!pm) { pm = o.userData.navPocheMesh = new THREE.Mesh(g, POCHE); pm.userData.navPoche = true; } pm.geometry = g; o.add(pm); }
    }
  }

  // ------------------------------------------------------------ silhouettes 1,75 m (gris neutre, peu de facettes)
  const silh = new THREE.Group(); silh.name = 'silhouettes'; silh.visible = false; scene.add(silh);
  {
    const parts = [], P = (g, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) => { g.scale(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z); parts.push(g); };
    for (const s of [-1, 1]) {
      P(new THREE.BoxGeometry(0.10, 0.07, 0.26), s * 0.10, 0.035, 0.03); // chaussure
      P(new THREE.CylinderGeometry(0.068, 0.05, 0.80, 8), s * 0.10, 0.47, 0); // jambe
      P(new THREE.CylinderGeometry(0.05, 0.043, 0.32, 8), s * 0.235, 1.33, 0, 1, 1, 1, s * 0.06); // bras
      P(new THREE.CylinderGeometry(0.042, 0.035, 0.28, 8), s * 0.25, 1.03, 0.02); // avant-bras
      P(new THREE.SphereGeometry(0.045, 8, 6), s * 0.255, 0.845, 0.02, 0.7, 1.2, 1); // main
    }
    P(new THREE.CylinderGeometry(0.165, 0.15, 0.20, 10), 0, 0.95, 0, 1, 1, 0.62); // bassin
    P(new THREE.CylinderGeometry(0.20, 0.155, 0.46, 10), 0, 1.28, 0, 1, 1, 0.58); // buste
    P(new THREE.SphereGeometry(0.2, 10, 6), 0, 1.50, 0, 1, 0.32, 0.58); // épaules
    P(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 8), 0, 1.565, 0); // cou
    P(new THREE.SphereGeometry(0.1, 12, 9), 0, 1.633, 0, 0.88, 1.17, 1); // tête : sommet à 1,75 m
    const geo = mergeGeometries(parts), mat = new THREE.MeshStandardMaterial({ color: '#d3d3ce', roughness: 0.9 });
    for (const [x, z, lv, yaw] of FIGURES) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, lv ? E1 : 0, z); m.rotation.y = Math.atan2(Math.cos(yaw * DEG), Math.sin(yaw * DEG));
      m.castShadow = m.receiveShadow = true; m.userData.lv = lv; silh.add(m);
    }
  }
  const updateSilh = () => { if (silh.visible) for (const m of silh.children) m.visible = !(m.userData.lv && state.mode === 'rdc'); };

  // ------------------------------------------------------------ porte d'entrée : s'ouvre vers l'intérieur à l'approche du promeneur
  const DOOR = setupEntryDoor();
  function setupEntryDoor() {
    const g = groups.rdc; if (!g) return null; const parts = [], bb = new THREE.Box3();
    g.updateWorldMatrix(true, true);
    for (const o of g.children) {
      if (!o.isMesh) continue; const ty = o.geometry.type; if (ty !== 'ExtrudeGeometry' && ty !== 'PlaneGeometry' && ty !== 'CylinderGeometry') continue;
      bb.setFromObject(o); if (bb.min.x > 0.1 && bb.max.x < 0.4 && bb.min.z > 1.84 && bb.max.z < 2.70 && bb.min.y > -0.05 && bb.max.y < 2.2) parts.push(o);
    }
    if (!parts.some(o => o.geometry.type === 'ExtrudeGeometry')) return null;
    const hinge = new THREE.Vector3(0.28, 0, 1.885), pivot = new THREE.Group(); pivot.position.copy(hinge); g.add(pivot); pivot.updateWorldMatrix(true, false);
    for (const o of parts) { pivot.attach(o); o.userData.navSkip = true; }
    // béquille, entrée de clé et bouton sont fusionnés dans les tampons du calque : leurs sommets suivent le vantail
    const verts = [];
    for (const o of g.children) {
      if (!o.isMesh || o.geometry.type !== 'BufferGeometry') continue; const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal, ids = [];
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); if (x > 0.12 && x < 0.36 && y > 0.90 && y < 1.08 && z > 2.45 && z < 2.65) ids.push(i); }
      if (ids.length) { o.userData.navSkipVerts = new Set(ids); verts.push({ o, ids, p0: ids.map(i => [pos.getX(i), pos.getY(i), pos.getZ(i)]), n0: ids.map(i => [nor.getX(i), nor.getY(i), nor.getZ(i)]) }); }
    }
    return { pivot, hinge, verts, a: 0, t: 0 };
  }
  // centre et rayon (plan) d'un ouvrant, calculés une fois
  function navC(d, ms) {
    if (d._navC) return d._navC; if (!ms) { ms = d.meshes && d.meshes.length ? d.meshes : []; if (!ms.length && d.g) d.g.traverse(o => { if (o.isMesh) ms.push(o); }); }
    const bb = new THREE.Box3(); for (const o of ms) { o.updateWorldMatrix(true, false); bb.expandByObject(o); }
    return (d._navC = bb.isEmpty() ? { x: 0, y: 0, z: 0, r: 1e9 } : { x: (bb.min.x + bb.max.x) / 2, y: (bb.min.y + bb.max.y) / 2, z: (bb.min.z + bb.max.z) / 2, r: Math.hypot(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 });
  }
  function updateDoor(now) {
    // portes intérieures (fermées par défaut) : le promeneur ouvre celle qu'il approche, une seule fois à l'entrée dans la zone (1,25 m, sortie à 1,60 m),
    // sans jamais la refermer ; refermée au clic tout près, elle ne se rouvre plus d'elle-même (avant : rouverte à l'image suivante, le vantail tressautait)
    // tant que le promeneur n'est pas ressorti de la zone. Placards et ouvrants (kind) : au clic seulement. Visite libre : on traverse sans rien ouvrir.
    if (pied()) for (const d of DOORS || []) {
      if (d.kind) continue; const c = navC(d), r = Math.hypot(c.x - W.x, c.z - W.z), lv = Math.abs(c.y - (W.feet + 1.0)) < 1.0;
      if (d._navIn) { if (r > 1.6 || !lv) d._navIn = false; } else if (r < 1.25 && lv) { d._navIn = true; d.target = 1; }
    }
    if (!DOOR) { // porte d'entrée ouvrable au clic (ouvrants.js) : on l'ouvre une fois à l'approche du promeneur
      const near = pied() && Math.hypot(W.x - 0.25, W.z - 2.27) < 2.4;
      if (near && !W.entryOpened) { const d = (DOORS || []).find(e => e.kind === 'entry'); if (d) d.target = 1; }
      W.entryOpened = near; return;
    } const dt = Math.min(0.1, (now - (DOOR.t || now)) / 1000); DOOR.t = now;
    const goal = pied() && Math.hypot(W.x - 0.25, W.z - 2.27) < 2.4 ? 88 * DEG : 0; if (Math.abs(goal - DOOR.a) < 1e-4) return;
    DOOR.a += THREE.MathUtils.clamp(goal - DOOR.a, -120 * DEG * dt, 120 * DEG * dt); const a = DOOR.a, c = Math.cos(a), s = Math.sin(a);
    DOOR.pivot.rotation.y = a; ctx.requestRender?.(); // [perf] rendu à la demande : le vantail bouge sans que la caméra bouge
    for (const v of DOOR.verts) {
      const pos = v.o.geometry.attributes.position, nor = v.o.geometry.attributes.normal;
      v.ids.forEach((i, k) => { const [x, y, z] = v.p0[k], dx = x - DOOR.hinge.x, dz = z - DOOR.hinge.z, [nx, ny, nz] = v.n0[k];
        pos.setXYZ(i, DOOR.hinge.x + dx * c + dz * s, y, DOOR.hinge.z - dx * s + dz * c); nor.setXYZ(i, nx * c + nz * s, ny, -nx * s + nz * c); });
      pos.needsUpdate = true; nor.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------ collisions : triangles des calques rangés dans une grille 2D (cellules de 0,5 m)
  let C = null;
  function buildColliders() {
    const tris = [], kinds = [], grps = [], names = Object.keys(LAYER_KIND).filter(k => groups[k]);
    names.forEach((name, gi) => {
      const g = groups[name]; g.updateWorldMatrix(true, true);
      g.traverse(o => {
        if (!o.isMesh || o.userData.door || o.userData.navSkip || o.userData.navPoche) return; const geo0 = o.userData.navGeo || o.geometry; if (!geo0.attributes.position) return;
        const pos = geo0.attributes.position, idx = geo0.index, n = idx ? idx.count : pos.count, skip = o.userData.navSkipVerts, m = o.matrixWorld;
        for (let i = 0; i + 2 < n; i += 3) {
          const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
          if (skip && skip.has(a) && skip.has(b) && skip.has(c)) continue;
          for (const j of [a, b, c]) { _v.fromBufferAttribute(pos, j).applyMatrix4(m); tris.push(_v.x, _v.y, _v.z); }
          kinds.push(o.userData.navKind ?? LAYER_KIND[name]); grps.push(gi); // userData.navKind : nature imposée à un maillage (ex. marche du jardin dans le calque des clôtures)
        }
      });
    });
    const n = kinds.length, T = new Float32Array(n * 15); let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
    for (let t = 0; t < n; t++) {
      const o = t * 15, s = t * 9; for (let k = 0; k < 9; k++) T[o + k] = tris[s + k];
      T[o + 9] = Math.min(T[o], T[o + 3], T[o + 6]); T[o + 10] = Math.max(T[o], T[o + 3], T[o + 6]);
      T[o + 11] = Math.min(T[o + 1], T[o + 4], T[o + 7]); T[o + 12] = Math.max(T[o + 1], T[o + 4], T[o + 7]);
      T[o + 13] = Math.min(T[o + 2], T[o + 5], T[o + 8]); T[o + 14] = Math.max(T[o + 2], T[o + 5], T[o + 8]);
      X0 = Math.min(X0, T[o + 9]); X1 = Math.max(X1, T[o + 10]); Z0 = Math.min(Z0, T[o + 13]); Z1 = Math.max(Z1, T[o + 14]);
    }
    X0 = Math.max(X0, -60) - 1; X1 = Math.min(X1, 80) + 1; Z0 = Math.max(Z0, -60) - 1; Z1 = Math.min(Z1, 80) + 1;
    const nx = Math.ceil((X1 - X0) / CS), nz = Math.ceil((Z1 - Z0) / CS), cnt = new Int32Array(nx * nz + 1);
    const span = (t, f) => { const o = t * 15, i0 = Math.max(0, Math.floor((T[o + 9] - X0) / CS)), i1 = Math.min(nx - 1, Math.floor((T[o + 10] - X0) / CS)), j0 = Math.max(0, Math.floor((T[o + 13] - Z0) / CS)), j1 = Math.min(nz - 1, Math.floor((T[o + 14] - Z0) / CS)); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f(j * nx + i); };
    for (let t = 0; t < n; t++) span(t, c => cnt[c + 1]++);
    for (let c = 0; c < nx * nz; c++) cnt[c + 1] += cnt[c];
    const fill = cnt.slice(), list = new Int32Array(cnt[nx * nz]);
    for (let t = 0; t < n; t++) span(t, c => { list[fill[c]++] = t; });
    C = { T, kind: Uint8Array.from(kinds), grp: Uint8Array.from(grps), gv: names.map(k => groups[k]), start: cnt, list, x0: X0, z0: Z0, nx, nz, st: new Uint32Array(n), sid: 0, dyn: [] };
  }
  // portes intérieures ouvrantes (ctx.DOORS) : triangles monde recalculés à chaque image
  const visibleDeep = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  function updateDynamic() {
    const out = []; if (!C) return;
    for (const d of DOORS || []) {
      const ms = d.meshes && d.meshes.length ? d.meshes : []; if (!ms.length && d.g) d.g.traverse(o => { if (o.isMesh) ms.push(o); });
      navC(d, ms);
      if (Math.hypot(d._navC.x - W.x, d._navC.z - W.z) > d._navC.r + 2.5) continue; // seuls les ouvrants proches du promeneur comptent
      for (const o of ms) {
        if (!o.isMesh || !visibleDeep(o)) continue; o.updateWorldMatrix(true, false);
        const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count;
        for (let i = 0; i + 2 < n; i += 3) { const tri = []; for (let k = 0; k < 3; k++) { _v.fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld); tri.push(_v.x, _v.y, _v.z); } out.push(tri); }
      }
    }
    if (DOOR && DOOR.a > 60 * DEG) { // vantail de la porte d'entrée grand ouvert : emprise au sol (8 × 77 cm) en obstacle
      const c = Math.cos(DOOR.a), sn = Math.sin(DOOR.a), h = DOOR.hinge, P = (dx, dz) => [h.x + dx * c + dz * sn, 1.0, h.z - dx * sn + dz * c];
      const a = P(-0.08, 0), b = P(0, 0), e = P(0, 0.77), d = P(-0.08, 0.77); out.push([...a, ...b, ...e], [...a, ...e, ...d]);
    }
    C.dyn = out;
  }
  const segD2 = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 > 1e-12 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = ax + t * dx - px, ez = az + t * dz - pz; return ex * ex + ez * ez; };
  function triD(px, pz, ax, az, bx, bz, cx, cz) { // distance horizontale du point à la projection du triangle
    const e0 = (bx - ax) * (pz - az) - (bz - az) * (px - ax), e1 = (cx - bx) * (pz - bz) - (cz - bz) * (px - bx), e2 = (ax - cx) * (pz - cz) - (az - cz) * (px - cx);
    if (((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) && Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)) > 1e-9) return 0;
    return Math.sqrt(Math.min(segD2(px, pz, ax, az, bx, bz), segD2(px, pz, bx, bz, cx, cz), segD2(px, pz, cx, cz, ax, az)));
  }
  // dégagement : distance au plus proche obstacle dans la tranche du corps (au-dessus des pieds), plafonnée à 0,5 m
  function clearance(x, z, feet) {
    let best = 0.5; const T = C.T, lo0 = feet + 0.40, lo1 = feet + 0.15, hi = feet + 1.85;
    const i0 = Math.max(0, Math.floor((x - 0.5 - C.x0) / CS)), i1 = Math.min(C.nx - 1, Math.floor((x + 0.5 - C.x0) / CS));
    const j0 = Math.max(0, Math.floor((z - 0.5 - C.z0) / CS)), j1 = Math.min(C.nz - 1, Math.floor((z + 0.5 - C.z0) / CS)); const sid = ++C.sid;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cell = j * C.nx + i;
      for (let q = C.start[cell]; q < C.start[cell + 1]; q++) {
        const t = C.list[q]; if (C.st[t] === sid) continue; C.st[t] = sid;
        const k = C.kind[t]; if (k === 2 || !C.gv[C.grp[t]].visible) continue; const o = t * 15;
        if (T[o + 12] < (k === 1 ? lo1 : lo0) || T[o + 11] > hi) continue;
        if (T[o + 9] > x + best || T[o + 10] < x - best || T[o + 13] > z + best || T[o + 14] < z - best) continue;
        const d = triD(x, z, T[o], T[o + 2], T[o + 3], T[o + 5], T[o + 6], T[o + 8]); if (d < best) best = d;
      }
    }
    for (const tr of C.dyn) {
      if (Math.max(tr[1], tr[4], tr[7]) < lo1 || Math.min(tr[1], tr[4], tr[7]) > hi) continue;
      const d = triD(x, z, tr[0], tr[2], tr[3], tr[5], tr[6], tr[8]); if (d < best) best = d;
    }
    return best;
  }
  // sol : rayon vertical descendant depuis « top » sur le gros œuvre et les planchers (rdc, slab1, r1), faces tournées vers le haut
  function floorAt(x, z, top) {
    const i = Math.floor((x - C.x0) / CS), j = Math.floor((z - C.z0) / CS); if (i < 0 || j < 0 || i >= C.nx || j >= C.nz) return -Infinity;
    const cell = j * C.nx + i, T = C.T; let best = -Infinity;
    for (let q = C.start[cell]; q < C.start[cell + 1]; q++) {
      const t = C.list[q]; if (C.kind[t] === 1 || !C.gv[C.grp[t]].visible) continue; const o = t * 15;
      if (x < T[o + 9] || x > T[o + 10] || z < T[o + 13] || z > T[o + 14] || T[o + 11] > top) continue;
      const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
      if ((bz - az) * (cx - ax) - (bx - ax) * (cz - az) <= 1e-10) continue; // face verticale ou tournée vers le bas
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const y = l1 * ay + l2 * by + l3 * cy; if (y <= top + 1e-3 && y > best) best = y;
    }
    return best;
  }
  const groundAt = (x, z, feet) => { let f = floorAt(x, z, feet + 0.45); if (!inFootprint(x, z)) f = Math.max(f, hAt(x, z)); return isFinite(f) ? f : feet; }; // seuils dans l'épaisseur des murs : pas de plancher, on garde le niveau

  // ------------------------------------------------------------ balade au clavier
  // deux modes (demande client du 12/10) : « pied » = visite à hauteur d'homme (sol, murs, portes ouvertes à l'approche) ;
  // « libre » = vol dans la direction du regard, montée et descente, sans collision ni ouverture de porte (y : hauteur de l'œil)
  const W = { on: false, mode: 'pied', x: 0, y: 0, z: 0, feet: 0, feetS: 0, dir: new THREE.Vector3(1, 0, 0), v: 0, vt: 0, vy: 0, last: 0, c0: 0, blend: null };
  const keys = { up: false, down: false, left: false, right: false, shift: false, rise: false, fall: false };
  const pied = () => W.on && W.mode !== 'libre';
  const eyeY = () => W.mode === 'libre' ? W.y : W.feetS + eyeH;
  const FLY = { x0: -60, x1: 80, z0: -60, z1: 70, y0: -3, y1: 40 }; // boîte de la visite libre
  function flyMove(dx, dy, dz) { W.x = THREE.MathUtils.clamp(W.x + dx, FLY.x0, FLY.x1); W.y = THREE.MathUtils.clamp(W.y + dy, FLY.y0, FLY.y1); W.z = THREE.MathUtils.clamp(W.z + dz, FLY.z0, FLY.z1); }
  const insideNow = () => inFootprint(W.x, W.z) && (W.mode !== 'libre' || (W.y > -0.5 && W.y < E1 + 3.2));
  function tryMove(dx, dz) {
    const x = W.x + dx, z = W.z + dz; if (x < -11.3 || x > 19.3 || z < -0.5 || z > 13.5) return false;
    const f = groundAt(x, z, W.feet); if (!isFinite(f) || f < W.feet - 0.5) return false; // pas de chute de plus de 50 cm (garde-corps implicite)
    const c = clearance(x, z, f); if (c < R_BODY && c < W.c0 - 1e-4) return false;
    W.x = x; W.z = z; W.feet = f; W.c0 = c; return true;
  }
  function moveStep(s) {
    const hl = Math.hypot(W.dir.x, W.dir.z); if (hl < 1e-6) return false;
    const sg = Math.sign(s), fx = W.dir.x / hl * sg, fz = W.dir.z / hl * sg, len = Math.abs(s), rx = -fz, rz = fx;
    if (tryMove(fx * len, fz * len)) return true;
    // entonnoir des portes : si le passage est libre un peu plus loin à côté, on s'y décale
    for (const off of [0.07, 0.14, 0.21, 0.28]) for (const sd of [1, -1]) {
      const ax = W.x + fx * 0.3 + rx * sd * off, az = W.z + fz * 0.3 + rz * sd * off, fa = groundAt(ax, az, W.feet);
      if (!isFinite(fa) || fa < W.feet - 0.5 || clearance(ax, az, fa) < R_BODY) continue;
      const k = len / Math.hypot(0.3, off); if (tryMove((fx * 0.3 + rx * sd * off) * k, (fz * 0.3 + rz * sd * off) * k) || tryMove(rx * sd * len, rz * sd * len)) return true;
    }
    // glissement le long des murs
    for (const a of [25, 45, 65, 85]) for (const sd of [1, -1]) {
      const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG) * sd, k = len * ca;
      if (tryMove((fx * ca + rx * sa) * k, (fz * ca + rz * sa) * k)) return true;
    }
    return false;
  }
  function physics(dt) {
    const turnIn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0), moveIn = (keys.up ? 1 : 0) - (keys.down ? 1 : 0), k = 1 - Math.exp(-dt * 9);
    W.vt += (turnIn * (keys.shift ? 2.4 : 1.6) - W.vt) * k; W.v += (moveIn * (keys.shift ? 4.5 : 2.4) - W.v) * k; // marche 2,4 m/s (Maj : 4,5), demande client
    if (Math.abs(W.vt) > 1e-4) W.dir.applyAxisAngle(UP, W.vt * dt);
    if (W.mode === 'libre') { // vol : avance selon le regard (pente comprise), montée et descente, aucun obstacle
      const riseIn = (keys.rise ? 1 : 0) - (keys.fall ? 1 : 0); W.vy += (riseIn * (keys.shift ? 3.5 : 1.6) - W.vy) * k;
      flyMove(W.dir.x * W.v * dt, W.dir.y * W.v * dt + W.vy * dt, W.dir.z * W.v * dt); return;
    }
    const s = W.v * dt; if (Math.abs(s) > 1e-5) { const n = Math.ceil(Math.abs(s) / 0.04); for (let i = 0; i < n; i++) if (!moveStep(s / n)) { W.v *= 0.5; break; } }
    W.feetS += (W.feet - W.feetS) * (1 - Math.exp(-dt * 12));
  }
  function unstick() { // départ trop près d'un mur ou d'un meuble : on cherche la place libre la plus proche
    W.c0 = clearance(W.x, W.z, W.feet); if (W.c0 >= R_BODY) return;
    for (let r = 0.05; r <= 0.6; r += 0.05) for (let a = 0; a < 16; a++) {
      const x = W.x + Math.cos(a * Math.PI / 8) * r, z = W.z + Math.sin(a * Math.PI / 8) * r, f = groundAt(x, z, W.feet);
      if (isFinite(f) && Math.abs(f - W.feet) < 0.3 && clearance(x, z, f) >= R_BODY) { W.x = x; W.z = z; W.feet = W.feetS = f; W.c0 = R_BODY; return; }
    }
  }
  function startWalk(from, mode = W.mode) {
    const p0 = camera.position.clone(), d0 = camera.getWorldDirection(new THREE.Vector3());
    if (mode === 'libre') { // visite libre : on part de la caméra telle qu'elle est (position et regard)
      W.mode = 'libre'; W.x = p0.x; W.y = p0.y; W.z = p0.z; flyMove(0, 0, 0);
      W.dir.copy(controls.target).sub(p0); if (W.dir.lengthSq() < 1e-8) W.dir.copy(d0); W.dir.normalize();
      W.v = W.vt = W.vy = 0; W.blend = null;
      VIEWS.__walk = { p: p0.toArray(), t: p0.clone().addScaledVector(W.dir, 0.6).toArray(), mode: 'ext' };
      setView('__walk', true); W.on = true; W.last = performance.now();
      camera.near = 0.05; camera.updateProjectionMatrix();
      controls.minDistance = 0.1; controls.maxPolarAngle = Math.PI; controls.enableZoom = false; controls.enablePan = false;
      state.inside = insideNow(); updateSun(true); syncUI(); return;
    }
    W.mode = 'pied';
    if (!C) buildColliders(); updateDynamic();
    if (from === 'camera') {
      W.x = p0.x; W.z = p0.z; W.dir.copy(controls.target).sub(p0); if (W.dir.lengthSq() < 1e-8) W.dir.copy(d0); W.dir.normalize();
      const e0 = state.lastView === '__walk' ? eyeH : EYE; // vue de pièce : œil à 1,60 ; reprise d'une visite : hauteur réglée
      let f = groundAt(p0.x, p0.z, p0.y - e0); if (!isFinite(f)) f = p0.y - e0; W.feet = f;
    } else if (from === 'fly') { // visite libre → hauteur d'homme : on se pose à la verticale de l'endroit où l'on est (demande client du 12/10)
      const fp = inFootprint(W.x, W.z); W.x = THREE.MathUtils.clamp(W.x, -11.2, 19.2); W.z = THREE.MathUtils.clamp(W.z, -0.4, 13.4);
      W.dir.y = 0; if (W.dir.lengthSq() < 1e-6) W.dir.set(1, 0, 0); W.dir.normalize();
      W.feet = groundAt(W.x, W.z, fp ? (W.y >= E1 + 0.3 ? E1 : 0) : hAt(W.x, W.z)); // dans la maison : étage d'après la hauteur de vol (au-dessus du toit : étage) ; dehors : terrain
    } else if (RM[from]) { const r = RM[from]; W.x = r.p[0]; W.z = r.p[1]; W.dir.set(r.t[0] - r.p[0], 0, r.t[1] - r.p[1]).normalize(); W.feet = floorOf(r); }
    else { W.x = -2.5; W.z = 2.27; W.dir.set(1, -0.06, 0).normalize(); W.feet = hAt(W.x, W.z); }
    W.feetS = W.feet; W.v = W.vt = W.vy = 0; unstick();
    const eye = new THREE.Vector3(W.x, W.feetS + eyeH, W.z);
    VIEWS.__walk = { p: eye.toArray(), t: eye.clone().addScaledVector(W.dir, 0.6).toArray(), mode: 'ext' };
    setView('__walk', true); W.on = true; W.last = performance.now();
    camera.near = 0.05; camera.fov = 64; camera.updateProjectionMatrix();
    controls.minDistance = 0.1; controls.maxPolarAngle = Math.PI * 0.85; controls.enableZoom = false; controls.enablePan = false;
    state.inside = inFootprint(W.x, W.z); updateSun(true);
    W.blend = from !== 'camera' && p0.distanceTo(eye) > 0.3 ? { t0: performance.now(), p0, d0 } : null;
    syncUI();
  }
  function stopWalk() { W.on = false; W.blend = null; controls.enableZoom = true; controls.enablePan = true; for (const k in keys) keys[k] = false; syncUI(); }
  function walkPre(now) {
    const dt = THREE.MathUtils.clamp((now - W.last) / 1000, 0, 0.1); W.last = now; // pas plafonné à 0,1 s (machines lentes), découpé en sous-pas de 4 cm
    updateDynamic(); physics(dt);
    const ins = insideNow(); if (ins !== state.inside) { state.inside = ins; updateSun(true); }
    _v.set(W.x, eyeY(), W.z); camera.position.copy(_v); controls.target.copy(_v).addScaledVector(W.dir, 0.6);
  }
  function walkPost(now) {
    // regard à la souris : OrbitControls a fait tourner la caméra autour de la cible (0,6 m devant) ; on garde la nouvelle direction, l'œil reste en place
    if (!W.blend) { _t.copy(controls.target).sub(camera.position); if (_t.lengthSq() > 1e-8) W.dir.copy(_t.normalize()); }
    const eye = _v.set(W.x, eyeY(), W.z); let dir = W.dir;
    if (W.blend) {
      const k = THREE.MathUtils.clamp((now - W.blend.t0) / 1100, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      eye.lerpVectors(W.blend.p0, eye, e); dir = _t.copy(W.blend.d0).lerp(W.dir, e).normalize(); if (k >= 1) W.blend = null;
    }
    camera.position.copy(eye); controls.target.copy(eye).addScaledVector(dir, 0.6); camera.lookAt(controls.target);
  }
  // simulation sans rendu (essais) : pas fixes de 1/30 s
  function simulate(sec, k = {}) { const keep = { ...keys }; Object.assign(keys, { up: false, down: false, left: false, right: false, shift: false, rise: false, fall: false }, k); for (let t = 0; t < sec; t += 1 / 30) physics(1 / 30); W.feetS = W.feet; Object.assign(keys, keep); return { x: +W.x.toFixed(3), y: +eyeY().toFixed(3), z: +W.z.toFixed(3), feet: +W.feet.toFixed(3) }; }

  // ------------------------------------------------------------ optiques : regard redressé (verticales droites) + décentrement, panoramique Panini par post-traitement
  function levelCamera() { // supprime l'inclinaison (jusqu'à 30°) et la rend par décentrement vertical de l'objectif
    const d = camera.getWorldDirection(_t), ph = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), h = Math.hypot(d.x, d.z); if (h < 1e-4) return 0;
    const sh = THREE.MathUtils.clamp(ph, -SHIFT_MAX, SHIFT_MAX), rot = ph - sh;
    camera.lookAt(_t.set(d.x / h * Math.cos(rot), Math.sin(rot), d.z / h * Math.cos(rot)).add(camera.position)); return sh;
  }
  function applyRect(hfov, sh, fi) {
    const av = (fi.W - fi.pr) / fi.H, tv = Math.min(Math.tan(hfov * DEG / 2) / av, Math.tan(50 * DEG));
    camera.fov = 2 * Math.atan(tv) / DEG; camera.setViewOffset(fi.W, fi.H, -fi.pr / 2, -Math.tan(sh) / (2 * tv) * fi.H, fi.W, fi.H);
  }
  const PANO = { src: [64, 64], sharedResized: false };
  const quad = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uFrame: { value: new THREE.Vector4() }, uSrc: { value: new THREE.Vector4() }, uPix: { value: new THREE.Vector2() }, uThMax: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tSrc; uniform vec4 uFrame; uniform vec4 uSrc; uniform vec2 uPix; uniform float uThMax; varying vec2 vUv;
      // Panini (d = 1) : x = 2 tan(θ/2), y = 2 tan(φ) / (1 + cos θ) ; on retrouve la direction puis sa position dans le rendu rectiligne source
      vec3 tap(vec2 p) { float th = clamp(2.0 * atan(0.5 * p.x), -uThMax, uThMax); float c = cos(th);
        vec2 t = vec2(tan(th), p.y * (1.0 + c) / (2.0 * c)); vec2 uv = (t - uSrc.xz) / (uSrc.yw - uSrc.xz);
        return texture2D(tSrc, clamp(uv, vec2(0.0), vec2(1.0))).rgb; }
      void main() { vec2 p = vec2(mix(uFrame.x, uFrame.y, vUv.x), mix(uFrame.z, uFrame.w, vUv.y)); vec2 e = 0.25 * uPix;
        gl_FragColor = vec4(0.25 * (tap(p - e) + tap(p + e) + tap(p + vec2(e.x, -e.y)) + tap(p + vec2(-e.x, e.y))), 1.0); }`,
    depthTest: false, depthWrite: false, toneMapped: false,
  }));
  const U = quad.material.uniforms;
  let pc = null; // chaîne privée (sans occlusion ambiante) : rendu → sortie (tons + sRGB) dans une cible, puis remappage Panini à l'écran
  function applyPano(sh, fi) {
    const Wv = fi.W - fi.pr, av = Wv / fi.H, X = Math.min(2 * Math.tan(30 * DEG), 0.95 * av), thx = 2 * Math.atan(X / 2), Y = X / av, c = Math.tan(sh);
    const fm = (1 + Math.cos(thx)) / (2 * Math.cos(thx)), tl = Math.tan(thx) * 1.01;
    const top = (c + Y > 0 ? (c + Y) * fm : c + Y) + 0.01, bot = (c - Y < 0 ? (c - Y) * fm : c - Y) - 0.01, n = camera.near;
    camera.projectionMatrix.makePerspective(-tl * n, tl * n, top * n, bot * n, n, camera.far); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const pxr = renderer.getPixelRatio(); let ws = Wv * tl / X, hs = ws * (top - bot) / (2 * tl); const q = Math.min(1, Math.sqrt(4.5e6 / (ws * hs * pxr * pxr)));
    PANO.src = [Math.max(64, Math.round(ws * q)), Math.max(64, Math.round(hs * q))];
    const s = 2 * X / Wv, cx = fi.pr + Wv / 2;
    U.uFrame.value.set(-cx * s, (fi.W - cx) * s, c - fi.H * s / 2, c + fi.H * s / 2); U.uSrc.value.set(-tl, tl, bot, top); U.uPix.value.set(s, s); U.uThMax.value = thx * 1.005;
  }
  function restoreShared() { const cp = ctx.composer; if (PANO.sharedResized && cp) { const st = document.getElementById('stage'); cp.setSize(st.clientWidth, st.clientHeight); } PANO.sharedResized = false; }
  function panoRender() {
    const cp = ctx.composer, useAO = !ctx.fast && state.ao && cp && (state.inside || state.mode !== 'ext'); // [perf] images allégées en mouvement : sans occlusion
    if (!useAO && !pc) { pc = new EffectComposer(renderer, new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType, samples: 4 })); pc.setPixelRatio(renderer.getPixelRatio()); pc.addPass(new RenderPass(scene, camera)); pc.addPass(new OutputPass()); }
    const comp = useAO ? cp : pc, [w, h] = PANO.src;
    if (!useAO) { if (!ctx.fast) restoreShared(); } else PANO.sharedResized = true; // [perf] pas de redimensionnement du composeur partagé à chaque image allégée
    if (comp._width !== w || comp._height !== h) comp.setSize(w, h);
    comp.renderToScreen = false; comp.render(); comp.renderToScreen = true;
    U.tSrc.value = comp.readBuffer.texture; renderer.setRenderTarget(null); quad.render(renderer);
  }
  let lensMode = null, prevRender = null, lastSh = 0;
  function lens(reuse) { // reuse : caméra déjà redressée dans cette image (capture), on garde le décentrement calculé
    const eye = eyeLevel(), fi = frameInfo(); let mode = null;
    if (eye && optic !== 'classique') mode = optic === 'pano' ? 'pano' : 'rect'; else if (!eye && isOpenView()) mode = 'open';
    if (mode === 'rect' || mode === 'pano') { const sh = reuse ? lastSh : (lastSh = levelCamera()); if (mode === 'rect') applyRect(OPTICS[optic].h, sh, fi); else applyPano(sh, fi); }
    else if (mode === 'open') camera.setViewOffset(fi.W, fi.H, -fi.pr / 2, 0, fi.W, fi.H);
    else if (lensMode) camera.clearViewOffset();
    if (eye && optic === 'classique' && camera.fov !== 64) { camera.fov = 64; camera.updateProjectionMatrix(); }
    if (mode === 'pano') { if (hooks.render !== panoRender) { prevRender = hooks.render; hooks.render = panoRender; } }
    else if (hooks.render === panoRender) { hooks.render = prevRender; restoreShared(); }
    lensMode = mode;
  }
  const defaultRender = () => { const cp = ctx.composer; if (state.ao && cp && (state.inside || state.mode !== 'ext')) cp.render(); else renderer.render(scene, camera); };

  // ------------------------------------------------------------ boucle
  hooks.pre.push(now => {
    if (W.on && state.lastView !== '__walk') stopWalk(); // une autre vue a été choisie
    updateClip(); updateDoor(now); updateSilh();
    if (W.on) walkPre(now);
  });
  hooks.post.push(now => { if (W.on) walkPost(now); lens(); });

  // ------------------------------------------------------------ interface (panneau)
  const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const chips = lv => ROOMS.filter(r => r.lv === lv).map(r => `<button type="button" data-view="p_${r.k}" data-room="${r.k}" title="${r.n}${r.s ? ' · ' + r.s : ''}">${r.n}</button>`).join('');
  const secV = el(`<section><h2>Visite intérieure</h2>
    <div class="chips"><button type="button" data-walk="pied" aria-pressed="false" title="Se promener à hauteur d'homme avec les flèches du clavier : depuis la visite libre, on se pose là où l'on est ; sinon départ devant la porte d'entrée">Visite à hauteur d'homme</button><button type="button" data-walk="libre" aria-pressed="false" title="Voler dans la direction du regard depuis la vue actuelle, monter et descendre, traverser murs et portes">Visite libre</button></div>
    <div class="row" style="margin-top:10px;grid-template-columns:72px 1fr auto" title="Hauteur des yeux pendant la visite à hauteur d'homme (1,00 à 2,00 m)"><label for="nav-eye">Yeux</label><input id="nav-eye" type="range" min="${EYE_MIN}" max="${EYE_MAX}" step="0.05"><output id="nav-eye-v" for="nav-eye" style="min-width:44px;text-align:right;font-variant-numeric:tabular-nums"></output></div>
    <div class="row" style="margin-top:10px"><label for="nav-optic">Optique</label><select id="nav-optic" title="Champ de vision des vues à hauteur d'œil">${Object.entries(OPTICS).map(([k, o]) => `<option value="${k}">${o.label}</option>`).join('')}</select></div>
    <div class="toggles"><label title="Pièce vue d'en haut, murs coupés à hauteur d'allège"><input id="nav-open" type="checkbox"><span>Vue ouverte</span></label><label title="Personnages de 1,75 m pour l'échelle"><input id="nav-silh" type="checkbox"><span>Silhouettes 1,75 m</span></label></div></section>`);
  const sec0 = el(`<section><h2>Pièces du rez-de-chaussée</h2><div class="chips">${chips(0)}</div></section>`);
  const sec1 = el(`<section><h2>Pièces de l'étage</h2><div class="chips">${chips(1)}</div></section>`);
  const old = document.querySelector('#panel [data-view="i_sejour"]')?.closest('section');
  if (old) old.replaceWith(secV, sec0, sec1); else { const body = document.querySelector('#panel .body'); body && body.prepend(secV, sec0, sec1); }
  const walkBtns = [...secV.querySelectorAll('[data-walk]')], eyeEl = secV.querySelector('#nav-eye'), eyeOut = secV.querySelector('#nav-eye-v'), opticSel = secV.querySelector('#nav-optic'), openEl = secV.querySelector('#nav-open'), silhEl = secV.querySelector('#nav-silh');
  opticSel.value = optic;
  opticSel.addEventListener('change', () => { optic = opticSel.value; try { localStorage.setItem(LS_KEY, optic); } catch (e) { /* stockage indisponible */ } });
  silhEl.addEventListener('change', () => { silh.visible = silhEl.checked; updateSilh(); });
  for (const b of walkBtns) b.addEventListener('click', () => b.dataset.walk === 'libre' ? startWalk('camera', 'libre') : startWalk(W.on && W.mode === 'libre' ? 'fly' : 'door', 'pied'));
  const showEye = () => { eyeOut.textContent = eyeH.toFixed(2).replace('.', ',') + ' m'; };
  eyeEl.value = eyeH; showEye();
  eyeEl.addEventListener('input', () => {
    eyeH = THREE.MathUtils.clamp(parseFloat(eyeEl.value) || EYE_DEF, EYE_MIN, EYE_MAX); showEye(); ctx.requestRender?.();
    try { localStorage.setItem(LS_EYE, String(eyeH)); } catch (e) { /* stockage indisponible */ }
  });
  for (const b of [...sec0.querySelectorAll('[data-room]'), ...sec1.querySelectorAll('[data-room]')]) b.addEventListener('click', () => goRoom(b.dataset.room));
  function goRoom(k, instant) {
    if (W.on) stopWalk();
    if (openMode) { VIEWS['o_' + k] = openView(RM[k]); setView('o_' + k, instant); } else setView('p_' + k, instant);
    syncUI();
  }
  function roomAt(x, z, feet) { const lv = feet > 1.5 ? 1 : 0; return ROOMS.filter(r => r.lv === lv && x >= r.b[0] && x <= r.b[1] && z >= r.b[2] && z <= r.b[3]).sort((a, b) => (a.b[1] - a.b[0]) * (a.b[3] - a.b[2]) - (b.b[1] - b.b[0]) * (b.b[3] - b.b[2]))[0]; }
  openEl.addEventListener('change', () => {
    openMode = openEl.checked; const lv = state.lastView || '';
    const k = /^[po]_/.test(lv) ? lv.slice(2) : (W.on ? roomAt(W.x, W.z, W.feet)?.k : null); if (k && RM[k]) goRoom(k);
  });
  const hint = document.getElementById('hint'), hint0 = hint ? hint.textContent : '';
  function syncUI() {
    for (const b of walkBtns) b.setAttribute('aria-pressed', W.on && W.mode === b.dataset.walk ? 'true' : 'false');
    const lv = state.lastView || ''; const k = lv.startsWith('o_') ? lv.slice(2) : null;
    if (k) document.querySelectorAll('#panel [data-room]').forEach(b => b.setAttribute('aria-pressed', b.dataset.room === k ? 'true' : 'false'));
    if (hint) hint.textContent = !W.on ? hint0 + ' · Flèches : se promener'
      : W.mode === 'libre' ? '↑ ↓ : avancer, reculer dans la direction du regard · ← → : tourner · E ou Pg↑ : monter · A ou Pg↓ : descendre · 2 doigts ← → : de côté · Maj : plus vite · Glisser : regarder autour · Échap : arrêter'
      : '↑ ↓ : avancer, reculer · ← → : tourner · 2 doigts ← → : pas de côté · Maj : plus vite · Glisser : regarder autour · Clic : ouvrir une porte · Échap : arrêter';
  }
  syncUI();
  // la capture d'image doit passer par la même chaîne de rendu (panoramique) et ne pas tenir compte du panneau
  document.getElementById('snap')?.addEventListener('click', e => {
    if (!lensMode) return; e.stopImmediatePropagation();
    snapping = true; lens(true); (hooks.render || defaultRender)(performance.now());
    const url = renderer.domElement.toDataURL('image/png'); snapping = false; lens(true);
    document.getElementById('shot-img').src = url; document.getElementById('shot-dl').href = url; document.getElementById('shot').hidden = false;
  }, true);

  // ------------------------------------------------------------ clavier : flèches = marche (démarre depuis la vue d'intérieur en cours, sinon devant la porte)
  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const FLYMAP = { PageUp: 'rise', PageDown: 'fall', e: 'rise', E: 'rise', a: 'fall', A: 'fall' }; // visite libre seulement (A et E : clavier AZERTY, à gauche et à droite du Z)
  const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  window.addEventListener('keydown', e => {
    if (typing(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    keys.shift = e.shiftKey;
    if (e.key === 'Escape' && W.on) { stopWalk(); return; }
    if (W.on && W.mode === 'libre' && FLYMAP[e.key]) { e.preventDefault(); keys[FLYMAP[e.key]] = true; return; }
    const k = KEYMAP[e.key]; if (!k) return;
    e.preventDefault(); keys[k] = true;
    const lv = state.lastView || '';
    if (!W.on) startWalk(lv === '__walk' || (state.inside && state.mode === 'ext') ? 'camera' : (lv.startsWith('o_') && RM[lv.slice(2)] ? lv.slice(2) : 'door'));
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.key] || FLYMAP[e.key]; if (k) keys[k] = false; keys.shift = e.shiftKey; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // ------------------------------------------------------------ trackpad : glisser à deux doigts vers la gauche ou la droite = travelling latéral, orientation conservée
  // (en balade : pas de côté, collisions comprises). Le glissement vertical garde le zoom d'OrbitControls, le pincement (ctrl + molette) aussi.
  const _r = new THREE.Vector3();
  window.addEventListener('wheel', e => {
    if (e.target !== renderer.domElement || e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault(); e.stopPropagation(); // avant OrbitControls (phase de capture) : pas de zoom parasite
    const dx = e.deltaX * (e.deltaMode === 1 ? 16 : 1);
    if (W.on && W.mode === 'libre') { const hl = Math.hypot(W.dir.x, W.dir.z), s = dx * 0.006; if (hl > 1e-6) flyMove(-W.dir.z / hl * s, 0, W.dir.x / hl * s); }
    else if (W.on) {
      const hl = Math.hypot(W.dir.x, W.dir.z), s = dx * 0.006, n = Math.ceil(Math.abs(s) / 0.04);
      if (hl > 1e-6) for (let i = 0; i < n; i++) if (!tryMove(-W.dir.z / hl * s / n, W.dir.x / hl * s / n)) break;
    } else {
      camera.getWorldDirection(_t); _r.crossVectors(_t, UP).normalize();
      const d = Math.max(camera.position.distanceTo(controls.target), 3) * 0.001 * dx;
      camera.position.addScaledVector(_r, d); controls.target.addScaledVector(_r, d);
    }
    ctx.requestRender?.();
  }, { capture: true, passive: false });

  // accès pour les essais (scripts de rendu)
  window.__nav = { W, keys, ROOMS, startWalk, eye: v => { if (v !== undefined) { eyeH = v; eyeEl.value = v; showEye(); } return eyeH; }, stopWalk, goRoom, simulate, clearance: (x, z, f) => clearance(x, z, f), floorAt: (x, z, t) => floorAt(x, z, t), setOptic: o => { optic = o; opticSel.value = o; }, setOpen: v => { openEl.checked = openMode = v; }, silh, place: (x, z, dx, dz, f = 0) => { if (!C) buildColliders(); W.x = x; W.z = z; W.dir.set(dx, 0, dz).normalize(); W.feet = W.feetS = groundAt(x, z, f); W.c0 = clearance(x, z, W.feet); },
    nearest: (x, z, f) => { let b = null; for (let t = 0; t < C.kind.length; t++) { const o = t * 15, T = C.T, k = C.kind[t]; if (k === 2 || T[o + 12] < f + (k === 1 ? 0.15 : 0.40) || T[o + 11] > f + 1.85) continue; const d = triD(x, z, T[o], T[o + 2], T[o + 3], T[o + 5], T[o + 6], T[o + 8]); if (!b || d < b.d) b = { d, g: C.gv[C.grp[t]].name, tri: Array.from(T.slice(o, o + 9)).map(v => +v.toFixed(3)) }; } return b; } };
}
