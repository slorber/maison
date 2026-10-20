// Mobilier détaillé (cuisine, séjour, chambres, entrée, garage ; bureau de chambre 1 et pièce « Bureau » : chambre1.js) : appelé avant A.build(groups)
// Boîtes plates via A.box (UV en mètres) ; le reste est fusionné en un mesh par couple calque × matériau (peu d'appels de dessin).
// Formes douces (coussins, matelas, couettes) : boîtes arrondies subdivisées, déformées (bombé, drapé) puis lissées.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Ctx, Vec3 } from '../types';

let C, M, A; const BK = new Map();
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpC = new THREE.Color();
const PAL = ['#7a3b2e', '#2f4858', '#d9c9a8', '#556b4f', '#a65f3e', '#1f2a36', '#c8b27a', '#8c8c86', '#e8e2d4', '#5b3a4a', '#3f5e6e', '#b9a07a', '#9b4a3c', '#dcd6c8'];

// ---------------------------------------------------------------- outils géométriques
function mtx(x, y, z, ry = 0, rx = 0, rz = 0) { return new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V3(1, 1, 1)); }
// UV en mètres par projection sur l'axe dominant de la normale de chaque sommet (comme A.box) : textures bois, tissu, pierre à l'échelle ;
// géométries gardées indexées (sommets partagés : 5 à 6 fois moins de sommets que des triangles séparés)
function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = n.getX(i), ay = n.getY(i), az = n.getZ(i), X = Math.abs(ax), Y = Math.abs(ay), Z = Math.abs(az), x = p.getX(i), y = p.getY(i), z = p.getZ(i), j = i * 2;
    if (X >= Y && X >= Z) { uv[j] = ax > 0 ? -z : z; uv[j + 1] = y; } else if (Y >= Z) { uv[j] = x; uv[j + 1] = -z; } else { uv[j] = az > 0 ? x : -x; uv[j + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
// dépôt d'une géométrie (transformée par m4) dans le seau calque|matériau ; o.c : couleur de sommet (matériaux vertexColors), o.keepUV
function put(layer, mat, geo, m4, o: any = {}) {
  const g = geo.clone();
  if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
  if (m4) g.applyMatrix4(m4);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  g.clearGroups(); g.morphAttributes = {};
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!o.keepUV || !g.attributes.uv) worldUV(g);
  if (M[mat].vertexColors) { tmpC.set(o.c || '#ffffff'); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = tmpC.r; a[i * 3 + 1] = tmpC.g; a[i * 3 + 2] = tmpC.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  const key = layer + '|' + mat; let b = BK.get(key); if (!b) BK.set(key, b = { layer, mat, list: [] }); b.list.push(g);
}
function flush() {
  for (const b of BK.values()) { const g = mergeGeometries(b.list, false); const m = new THREE.Mesh(g, M[b.mat]); m.castShadow = !M[b.mat].transparent; m.receiveShadow = true; C.groups[b.layer].add(m); }
  BK.clear();
}
// coordonnées intérieures d'un axe, resserrées dans les zones [a, b] (plis de la couette)
function gridAx(h, zones, fine = 0.012, coarse = 0.07) {
  const out = [-h]; let x = -h;
  while (x < h - 1e-6) { const st = zones.some(([a, b]) => x >= a - 1e-6 && x < b) ? fine : coarse; x = Math.min(h, x + st); if (h - x < 0.3 * st) x = h; out.push(x); }
  return out;
}
// boîte arrondie subdivisée (rayon r, nA segments par quart d'arrondi, nI segments intérieurs ou o.ax listes explicites), o.def(v, w, h, d) déforme, normales lissées
function softBox(w, h, d, r, o: any = {}) {
  const S = [w, h, d], H = S.map(s => s / 2), R = Math.min(r, ...H) * 0.999, nA = o.nA ?? 3, nI = o.nI || [1, 1, 1];
  const ax = S.map((s, i) => { const h2 = H[i], a = []; for (let k = nA; k >= 1; k--) a.push(-h2 + R - R * Math.tan(Math.PI / 4 * k / nA));
    const inn = o.ax && o.ax[i] ? o.ax[i] : Array.from({ length: nI[i] + 1 }, (_, k) => -h2 + R + (s - 2 * R) * k / nI[i]); a.push(...inn);
    for (let k = 1; k <= nA; k++) a.push(h2 - R + R * Math.tan(Math.PI / 4 * k / nA)); return a; });
  const pos = [], idx = [], p = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) {
    const j = (i + 1) % 3, k = (i + 2) % 3, PA = ax[j], PB = ax[k], base = pos.length / 3, na = PA.length;
    for (let b = 0; b < PB.length; b++) for (let a = 0; a < na; a++) {
      p[i] = sg * H[i]; p[j] = PA[a]; p[k] = PB[b]; let dl = 0;
      for (let t = 0; t < 3; t++) { c[t] = Math.max(-H[t] + R, Math.min(H[t] - R, p[t])); dl += (p[t] - c[t]) ** 2; }
      dl = Math.sqrt(dl) || 1; for (let t = 0; t < 3; t++) pos.push(c[t] + (p[t] - c[t]) / dl * R);
    }
    for (let b = 0; b < PB.length - 1; b++) for (let a = 0; a < na - 1; a++) { const q0 = base + b * na + a, q1 = q0 + 1, q2 = q0 + na, q3 = q2 + 1; if (sg > 0) idx.push(q0, q1, q3, q0, q3, q2); else idx.push(q0, q3, q1, q0, q2, q3); }
  }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g = mergeVertices(g, 1e-4);
  if (o.def) { const v = new THREE.Vector3(), a = g.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i); o.def(v, w, h, d); a.setXYZ(i, v.x, v.y, v.z); } }
  g.computeVertexNormals(); return g;
}
const OTH = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] };
const wgt = (v, S, ax) => { const [a, b] = OTH[ax], u = v[a] / (S[a] / 2), t = v[b] / (S[b] / 2); return Math.max(0, (1 - u * u) * (1 - t * t)); };
const puff = (k, ax = 'y') => (v, w, h, d) => { v[ax] *= 1 + k * wgt(v, { x: w, y: h, z: d }, ax); }; // bombé de coussin
const pillow = (taper, ax = 'y') => (v, w, h, d) => { v[ax] *= taper + (1 - taper) * Math.sqrt(wgt(v, { x: w, y: h, z: d }, ax)); }; // oreiller : bords amincis
// drapé d'une nappe d'épaisseur centrée en y = 0 sur un support de demi-largeur hw (bords ±x) et de bord aval zf (+z) : pli de rayon rb puis tombée verticale
const drape = (hw, zf, rb) => v => {
  const t = v.y, sx = Math.abs(v.x) - hw, sz = v.z - zf; if (sx <= 0 && sz <= 0) return;
  let s, dx = 0, dz = 0; if (sx > 0 && sz > 0) { s = Math.hypot(sx, sz); dx = sx / s; dz = sz / s; } else if (sx > 0) { s = sx; dx = 1; } else { s = sz; dz = 1; }
  const al = Math.PI / 2 * rb; let hh, yy; if (s < al) { const f = s / rb; hh = (rb + t) * Math.sin(f); yy = -rb + (rb + t) * Math.cos(f); } else { hh = rb + t; yy = -rb - (s - al); }
  if (sx > 0) v.x = Math.sign(v.x) * (hw + hh * dx); if (sz > 0) v.z = zf + hh * dz; v.y = yy;
};
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cylZ = (r, len, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
function rodG(a, b, r, seg = 12, r2?, open?) { // cylindre de a (rayon r) à b (rayon r2)
  const pa = V3(...(a as Vec3)), pb = V3(...(b as Vec3)), d = pb.clone().sub(pa), len = d.length();
  const g = new THREE.CylinderGeometry(r2 ?? r, r, len, seg, 1, !!open);
  return g.applyMatrix4(new THREE.Matrix4().compose(pa.add(pb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()), V3(1, 1, 1)));
}
function rrect(x0, z0, x1, z1, r, n = 6) { const p = []; for (const [cx, cz, q] of [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, 1], [x0 + r, z0 + r, 2], [x1 - r, z0 + r, 3]]) for (let i = 0; i <= n; i++) { const a = (q + i / n) * Math.PI / 2; p.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } return p; }
// plateau horizontal extrudé (contour [x, z], trous), arêtes adoucies par un chanfrein arrondi de b
function slab(pts, holes, y0, th, b = 0.002) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes || []) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: th - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + b, 0); return g;
}
// bande cintrée verticale (dossier de chaise) : arc de rayon R centré en z = cz, concave vers +z, épaisseur t, hauteur h
function bandG(R, t, h, hw, cz, y0) {
  const a = Math.asin(hw / R), n = 16, pts = [];
  for (let i = 0; i <= n; i++) { const th = -a + 2 * a * i / n; pts.push([R * Math.sin(th), cz - R * Math.cos(th)]); }
  for (let i = n; i >= 0; i--) { const th = -a + 2 * a * i / n; pts.push([(R + t) * Math.sin(th), cz - (R + t) * Math.cos(th)]); }
  return slab(pts, null, y0, h, 0.002);
}
function stadiumG(wd, th, h) { const r = th / 2, a = wd / 2 - r, s = new THREE.Shape(); s.absarc(a, 0, r, -Math.PI / 2, Math.PI / 2); s.absarc(-a, 0, r, Math.PI / 2, 1.5 * Math.PI); const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); return g; }
function pipeG(w, d, rr, tube) { // passepoil : tube le long d'un rectangle arrondi (plan XZ, centré)
  const x = w / 2, z = d / 2, sh = new THREE.Shape();
  sh.moveTo(-x + rr, -z); sh.lineTo(x - rr, -z); sh.absarc(x - rr, -z + rr, rr, -Math.PI / 2, 0); sh.lineTo(x, z - rr); sh.absarc(x - rr, z - rr, rr, 0, Math.PI / 2);
  sh.lineTo(-x + rr, z); sh.absarc(-x + rr, z - rr, rr, Math.PI / 2, Math.PI); sh.lineTo(-x, -z + rr); sh.absarc(-x + rr, -z + rr, rr, Math.PI, 1.5 * Math.PI);
  const pts = sh.getSpacedPoints(160).slice(0, -1).map(q => V3(q.x, 0, q.y));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, tube, 5, true);
}
// repère local : toutes les cotes passées sont dans le repère F (identité = monde)
class Kit {
  declare l: string; declare F: THREE.Matrix4;
  constructor(layer, F?) { this.l = layer; this.F = F || new THREE.Matrix4(); }
  m(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { return this.F.clone().multiply(mtx(x, y, z, ry, rx, rz)); }
  g(mat, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, o?) { put(this.l, mat, geo, this.m(x, y, z, ry, rx, rz), o); return this; }
  box(mat, x0, x1, y0, y1, z0, z1, o?) { return this.g(mat, boxG(x1 - x0, y1 - y0, z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, o); }
  soft(mat, x0, x1, y0, y1, z0, z1, r, o: any = {}) { return this.g(mat, softBox(x1 - x0, y1 - y0, z1 - z0, r, o), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o.ry || 0, o.rx || 0, o.rz || 0, o); }
  rod(mat, a, b, r, seg = 12, r2?, o: any = {}) { put(this.l, mat, rodG(a, b, r, seg, r2, o.open), this.F, o); return this; }
}

// ---------------------------------------------------------------- textures et matériaux
function materials() {
  const { makeTex, pixelNoise, rng, std } = C;
  // chêne clair massif : alaises de 10 cm, fil ondulé
  const oak = makeTex(512, 1.0, (g, s) => {
    pixelNoise(g, s, '#c9ab83', 0.025, 0.04, 3, 701); const r = rng(702), rows = 8, rh = s / rows;
    for (let j = 0; j < rows; j++) {
      const y0 = j * rh; g.fillStyle = r() < 0.5 ? `rgba(255,236,205,${0.05 + r() * 0.08})` : `rgba(120,85,50,${0.04 + r() * 0.08})`; g.fillRect(0, y0, s, rh);
      for (let i = 0; i < 22; i++) { const y = y0 + r() * rh, k = 1 + Math.floor(r() * 2), ph = r() * 6.28, a = rh * (0.05 + r() * 0.12);
        g.strokeStyle = `rgba(100,68,38,${0.05 + r() * 0.13})`; g.lineWidth = 0.5 + r() * 1.5; g.beginPath();
        for (let x = 0; x <= s; x += 8) { const yy = y + Math.sin(x / s * 6.2832 * k + ph) * a; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); }
      g.fillStyle = 'rgba(90,60,35,0.10)'; g.fillRect(0, y0, s, 1);
    }
  });
  const wt = makeTex(512, 0.6, (g, s) => pixelNoise(g, s, '#4b4845', 0.08, 0.025, 5, 711, (f, r) => r() < 0.015 ? f * (1.35 + r() * 0.5) : f)); // quartz anthracite moucheté
  const weave = makeTex(256, 0.08, (g, s) => pixelNoise(g, s, '#eeeeec', 0.025, 0.02, 4, 721, (f, r, u, v) => f * ((((u * 40) | 0) + ((v * 40) | 0)) & 1 ? 0.982 : 1.015))); // tissage neutre, teinté par couleur de sommet
  // plaque induction : 4 foyers sérigraphiés, commandes tactiles à l'avant
  const hob = makeTex(512, 1, (g, s, w, h) => {
    g.fillStyle = '#0c0d0e'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(150,150,150,0.35)'; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10);
    for (const [x, y, rr] of [[140, 125, 92], [375, 118, 72], [140, 300, 72], [375, 288, 86]]) { g.strokeStyle = 'rgba(175,175,175,0.5)'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(175,175,175,0.22)'; g.beginPath(); g.arc(x, y, rr * 0.55, 0, 7); g.stroke(); }
    g.fillStyle = 'rgba(215,215,215,0.75)'; g.fillRect(170, h - 46, 172, 3); for (let i = 0; i <= 9; i++) g.fillRect(170 + i * 19, h - 52, 2, 9);
    g.strokeStyle = 'rgba(215,215,215,0.75)'; g.lineWidth = 2; for (const x of [62, 105, 405, 450]) { g.beginPath(); g.arc(x, h - 44, 7, 0, 7); g.stroke(); }
  }, { w: 512, h: 444 }); hob.repeat.set(1, 1);
  // tapis de laine beige, bordure plus soutenue et filet intérieur (UV 0..1 sur tout le tapis)
  const rug = makeTex(1024, 1, (g, s) => {
    pixelNoise(g, s, '#cdc2ad', 0.06, 0.03, 8, 731); const b = s * 0.035, b2 = s * 0.065;
    g.fillStyle = 'rgba(95,80,60,0.22)'; g.fillRect(b, b, s - 2 * b, b2 - b); g.fillRect(b, s - b2, s - 2 * b, b2 - b); g.fillRect(b, b2, b2 - b, s - 2 * b2); g.fillRect(s - b2, b2, b2 - b, s - 2 * b2);
    g.strokeStyle = 'rgba(95,80,60,0.25)'; g.lineWidth = 3; g.strokeRect(s * 0.09, s * 0.09, s * 0.82, s * 0.82);
    const r = rng(732); for (let i = 0; i < 16000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,250,240,0.10)' : 'rgba(80,65,50,0.08)'; g.fillRect(r() * s, r() * s, 1 + r() * 2, 1); }
  }); rug.repeat.set(1, 1);
  const flute = makeTex(64, 0.033, (g, s, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#c4c6c6'); gr.addColorStop(0.18, '#f2f2f0'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(0.82, '#f0f0ee'); gr.addColorStop(1, '#c4c6c6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { w: 64, h: 4, metersV: 1 }); // façade profilée de radiateur à panneaux
  const perf = makeTex(32, 0.007, (g, s) => { g.fillStyle = '#eeeeec'; g.fillRect(0, 0, s, s); g.fillStyle = '#55585a'; g.fillRect(10, 10, s - 20, s - 20); }); // grille supérieure perforée
  const coir = makeTex(256, 0.25, (g, s) => { pixelNoise(g, s, '#6f5a42', 0.2, 0.05, 6, 741); const r = rng(742); g.lineWidth = 1; for (let i = 0; i < 2500; i++) { g.strokeStyle = r() < 0.5 ? 'rgba(60,40,20,0.35)' : 'rgba(190,150,100,0.3)'; const x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + (r() - 0.5) * 6); g.stroke(); } });
  M.mobOak = std({ map: oak, roughness: 0.55 });
  M.mobWorktop = std({ map: wt, roughness: 0.32 });
  M.mobGola = std({ color: '#35383b', roughness: 0.5, metalness: 0.3 }); // profils gola et fonds de joints
  M.mobGapW = std({ color: '#8f8d88', roughness: 0.9 }); // joints des façades blanches
  M.mobGlassBlack = std({ color: '#0b0c0d', roughness: 0.06 });
  M.mobGlassWin = std({ color: '#2c3034', roughness: 0.08, metalness: 0.2 });
  M.mobInox = std({ color: '#d2d5d7', roughness: 0.3, metalness: 0.5 });
  M.mobChrome = std({ color: '#e6e8ea', roughness: 0.12, metalness: 0.6 });
  M.mobDisplay = std({ color: '#000000', emissive: '#ffb45a', emissiveIntensity: 1.4 });
  M.mobLed = std({ color: '#ffffff', emissive: '#fff0d6', emissiveIntensity: 1.1 });
  M.mobLaptop = std({ color: '#0d1013', emissive: '#9fb6c9', emissiveIntensity: 0.22, roughness: 0.1 });
  M.mobHob = std({ map: hob, roughness: 0.07 });
  M.mobFab = std({ map: weave, bumpMap: weave, bumpScale: 0.25, vertexColors: true, roughness: 1 });
  M.mobPaint = std({ vertexColors: true, roughness: 0.6 });
  M.mobCeramic = std({ color: '#f3f1ec', roughness: 0.22 });
  M.mobShade = std({ color: '#f2ece1', emissive: '#ffd9a6', emissiveIntensity: 0.35, roughness: 1, side: THREE.DoubleSide });
  M.mobScreen = std({ color: '#060708', roughness: 0.05, metalness: 0.1 });
  M.mobRug = std({ map: rug, roughness: 1 });
  M.mobRadPanel = std({ map: flute, roughness: 0.35 });
  M.mobRadTop = std({ map: perf, roughness: 0.5 });
  M.mobDoormat = std({ map: coir, bumpMap: coir, bumpScale: 1.2, roughness: 1 });
  M.mobWMGlass = std({ color: '#2a3640', roughness: 0.04, transparent: true, opacity: 0.45, depthWrite: false });
  M.mobGrey = std({ color: '#b7babd', roughness: 0.35, metalness: 0.2 });
  M.mobRubber = std({ color: '#26272a', roughness: 0.8, side: THREE.DoubleSide });
}

// ---------------------------------------------------------------- cuisine (plan électrique RDC, implantation conservée)
// Façades mates sans poignée sur profils gola anthracite, joints de 3 mm, plan quartz 4 cm à chant adouci, crédence assortie,
// plaque induction, évier inox à poser avec égouttoir, colonnes réfrigérateur intégré + four et micro-ondes en verre noir.
function kitchen() {
  const k = 'furn0', T = C.T, D = C.D, zw = 4.24, K = new Kit(k), fr = 'front', gl = 'mobGola';
  const door = [[0.103, 0.795]], drw3 = [[0.103, 0.355], [0.39, 0.605], [0.64, 0.795]]; // façades : porte pleine, 3 tiroirs (gorges gola intermédiaires)
  // --- linéaire bas le long de l'escalier (façades z zw+0.561→zw+0.58), gorge gola de 6 cm sous le plan
  A.box(k, T, 2.59, 0, 0.10, zw, zw + 0.52, 'plinth');
  A.box(k, T, 2.59, 0.10, 0.80, zw, zw + 0.56, { def: fr, pz: gl, py: gl });
  A.box(k, T, 2.59, 0.80, 0.86, zw, zw + 0.53, { def: fr, pz: gl, ny: gl });
  for (const [a, b, st] of [[0.943, 0.977, door], [0.98, 1.277, door], [1.28, 1.877, drw3], [1.88, 2.232, door], [2.235, 2.587, door]] as [number, number, number[][]][]) for (const [y0, y1] of st) A.box(k, a, b, y0, y1, zw + 0.561, zw + 0.58, fr);
  // --- retour sous la fenêtre nord (façades x T+0.561→T+0.58) : tiroirs, évier 2 portes, lave-vaisselle intégré, tiroirs
  A.box(k, T, T + 0.52, 0, 0.10, zw + 0.52, D - T, 'plinth');
  A.box(k, T, T + 0.56, 0.10, 0.80, zw + 0.56, D - T, { def: fr, px: gl, py: gl });
  A.box(k, T, T + 0.53, 0.80, 0.86, zw + 0.53, D - T, { def: fr, px: gl, ny: gl });
  for (const [a, b, st] of [[4.823, 4.857, door], [4.86, 5.367, drw3], [5.37, 5.832, door], [5.835, 6.297, door], [6.30, 6.897, door], [6.90, 7.497, drw3], [7.50, D - T, door]] as [number, number, number[][]][]) for (const [y0, y1] of st) A.box(k, T + 0.561, T + 0.58, y0, y1, a, b, fr);
  // --- plan de travail en L d'un seul tenant, découpe de l'évier ; crédence assortie
  K.g('mobWorktop', slab([[T, zw], [2.59, zw], [2.59, zw + 0.62], [T + 0.62, zw + 0.62], [T + 0.62, D - T], [T, D - T]], [[[0.47, 5.43], [0.87, 5.43], [0.87, 6.31], [0.47, 6.31]]], 0.86, 0.04));
  A.box(k, T, 2.59, 0.90, 1.45, zw, zw + 0.006, 'mobWorktop'); A.box(k, 1.28, 1.88, 1.45, 1.52, zw, zw + 0.006, 'mobWorktop');
  // plaque induction 60 cm biseautée (centre x 1,58 : prise 32 A)
  K.g('mobHob', boxG(0.60, 0.006, 0.52), 1.58, 0.903, zw + 0.31, 0, 0, 0, { keepUV: true });
  // évier inox à poser : cuve 36 × 36 × 18, égouttoir rainuré, bonde, mitigeur bas (la fenêtre s'ouvre au-dessus)
  K.g('mobInox', slab(rrect(0.46, 5.42, 0.88, 6.32, 0.012), [rrect(0.49, 5.92, 0.85, 6.28, 0.025), rrect(0.49, 5.46, 0.85, 5.87, 0.012)], 0.90, 0.004, 0.0015));
  A.box(k, 0.485, 0.49, 0.72, 0.90, 5.915, 6.285, 'mobInox'); A.box(k, 0.85, 0.855, 0.72, 0.90, 5.915, 6.285, 'mobInox');
  A.box(k, 0.49, 0.85, 0.72, 0.90, 5.915, 5.92, 'mobInox'); A.box(k, 0.49, 0.85, 0.72, 0.90, 6.28, 6.285, 'mobInox'); A.box(k, 0.485, 0.855, 0.715, 0.72, 5.915, 6.285, 'mobInox');
  K.g('mobChrome', new THREE.CylinderGeometry(0.035, 0.035, 0.004, 24), 0.67, 0.722, 6.10);
  A.box(k, 0.47, 0.87, 0.892, 0.896, 5.43, 5.90, 'mobInox');
  for (let i = 0; i < 8; i++) { const x = 0.513 + i * 0.045; A.box(k, x - 0.002, x + 0.002, 0.896, 0.8995, 5.48, 5.85, 'mobInox'); }
  K.g('mobChrome', new THREE.CylinderGeometry(0.028, 0.03, 0.008, 24), 0.415, 0.904, 6.10);
  K.rod('mobChrome', [0.415, 0.905, 6.10], [0.415, 1.065, 6.10], 0.022, 20, 0.019);
  K.rod('mobChrome', [0.405, 1.045, 6.10], [0.625, 1.045, 6.10], 0.0105, 14);
  K.rod('mobChrome', [0.625, 1.056, 6.10], [0.625, 1.026, 6.10], 0.012, 14);
  K.rod('mobChrome', [0.415, 1.06, 6.10], [0.415, 1.078, 6.17], 0.0055, 10);
  // --- meubles hauts (prise de main en débord bas de 2 cm, ruban LED dessous) et hotte intégrée télescopique
  const wc = (x0, x1, yb, doors, led) => { A.box(k, x0, x1, yb, 2.20, zw, zw + 0.33, { def: fr, pz: gl }); for (const [a, b] of doors) A.box(k, a, b, yb - (led ? 0.02 : 0), 2.197, zw + 0.331, zw + 0.35, fr); if (led) K.box('mobLed', x0 + 0.03, x1 - 0.03, yb - 0.004, yb, zw + 0.27, zw + 0.29); };
  wc(T, 1.28, 1.45, [[T + 0.002, 0.818], [0.821, 1.277]], 1); wc(1.88, 2.59, 1.45, [[1.883, 2.234], [2.237, 2.588]], 1); wc(1.28, 1.88, 1.60, [[1.283, 1.877]], 0);
  K.box('mobInox', 1.30, 1.86, 1.525, 1.60, zw + 0.02, zw + 0.40); K.box(gl, 1.32, 1.84, 1.521, 1.525, zw + 0.04, zw + 0.30);
  for (const x of [1.42, 1.74]) K.g('mobLed', new THREE.CylinderGeometry(0.022, 0.022, 0.003, 20), x, 1.5235, zw + 0.35);
  // --- colonnes : réfrigérateur intégré (congélateur en bas, gorge gola verticale à droite), four + micro-ondes
  A.box(k, 2.59, 3.79, 0, 0.10, zw, zw + 0.52, 'plinth'); A.box(k, 2.66, 3.10, 0.025, 0.075, zw + 0.52, zw + 0.522, 'grille'); // grille de ventilation du réfrigérateur dans la plinthe
  A.box(k, 2.59, 3.79, 0.10, 2.20, zw, zw + 0.578, { def: fr, pz: gl });
  const fc = (x0, x1, y0, y1) => A.box(k, x0, x1, y0, y1, zw + 0.58, zw + 0.60, fr);
  fc(2.593, 3.165, 0.103, 0.80); fc(2.593, 3.165, 0.803, 1.80); fc(2.593, 3.165, 1.803, 2.197);
  fc(3.20, 3.787, 0.103, 0.455); fc(3.20, 3.787, 0.49, 0.835); fc(3.20, 3.787, 1.868, 2.197);
  const ox0 = 3.20, ox1 = 3.787, oc = (ox0 + ox1) / 2, zf = zw + 0.60;
  const appliance = (y0, y1, win, disp, knobs) => {
    A.box(k, ox0, ox1, y0, y1, zw + 0.56, zf + 0.002, 'mobGlassBlack');
    A.box(k, win[0], win[1], win[2], win[3], zf + 0.002, zf + 0.0028, 'mobGlassWin');
    A.box(k, disp[0], disp[1], disp[2], disp[3], zf + 0.002, zf + 0.0028, 'mobDisplay');
    for (const [x, y] of knobs) K.g('mobInox', cylZ(0.016, 0.018), x, y, zf + 0.011);
    const hy = y1 - 0.042; K.rod('mobInox', [ox0 + 0.045, hy, zf + 0.042], [ox1 - 0.045, hy, zf + 0.042], 0.009, 16);
    for (const x of [ox0 + 0.07, ox1 - 0.07]) K.rod('mobInox', [x, hy, zf + 0.002], [x, hy, zf + 0.042], 0.0055, 10);
  };
  appliance(0.885, 1.48, [ox0 + 0.06, ox1 - 0.06, 0.95, 1.31], [oc - 0.05, oc + 0.05, 1.445, 1.468], [[ox0 + 0.06, 1.457], [ox1 - 0.06, 1.457]]); // four : vitre, bandeau, afficheur, manettes
  A.box(k, ox0 + 0.005, ox1 - 0.005, 1.4255, 1.4285, zf + 0.002, zf + 0.0034, 'mobInox');
  appliance(1.485, 1.865, [ox0 + 0.035, ox1 - 0.13, 1.51, 1.785], [ox1 - 0.105, ox1 - 0.025, 1.765, 1.785], [[ox1 - 0.065, 1.64]]); // micro-ondes
  // --- péninsule (façades côté cuisine, x 2.86), joue « cascade » en quartz, dos plein côté tabourets, débord de 30 cm
  A.box(k, 2.92, 3.50, 0, 0.10, 6.06, D - T, 'plinth');
  A.box(k, 2.881, 3.54, 0.10, 0.80, 6.04, D - T, { def: fr, nx: gl, py: gl });
  A.box(k, 2.91, 3.54, 0.80, 0.86, 6.04, D - T, { def: fr, nx: gl, ny: gl });
  A.box(k, 3.54, 3.56, 0, 0.86, 6.04, D - T, fr);
  for (const [a, b, st] of [[6.043, 6.52, drw3], [6.523, 7.00, drw3], [7.003, 7.48, drw3], [7.483, D - T, door]] as [number, number, number[][]][]) for (const [y0, y1] of st) A.box(k, 2.86, 2.879, y0, y1, a, b, fr);
  K.g('mobWorktop', slab([[2.86, 6.00], [3.86, 6.00], [3.86, D - T], [2.86, D - T]], null, 0.86, 0.04));
  K.soft('mobWorktop', 2.86, 3.86, 0, 0.862, 6.00, 6.04, 0.003);
  // coupe de fruits
  K.g('mobCeramic', lathe([[0, 0], [0.06, 0], [0.07, 0.006], [0.12, 0.05], [0.13, 0.07], [0.124, 0.072], [0.114, 0.053], [0.06, 0.014], [0, 0.012]]), 3.30, 0.90, 6.80);
  for (const [dx, dy, dz, c] of [[-0.04, 0.045, -0.02, '#e08a2c'], [0.035, 0.045, 0.02, '#e3922f'], [0.0, 0.046, 0.05, '#9bbf4a'], [0.03, 0.05, -0.045, '#b8322a'], [-0.03, 0.085, 0.02, '#d9862a']] as [number, number, number, string][]) K.g('mobPaint', new THREE.SphereGeometry(0.036, 16, 12), 3.30 + dx, 0.90 + dy, 6.80 + dz, 0, 0, 0, { c });
  // --- 2 tabourets de bar : assise chêne galbée Ø 36, 4 pieds acier noir évasés, repose-pieds annulaire
  const seat = lathe([[0, 0.618], [0.168, 0.618], [0.178, 0.624], [0.181, 0.634], [0.178, 0.645], [0.168, 0.652], [0.11, 0.647], [0, 0.644]]);
  for (const z of [6.55, 7.05]) {
    const S = new Kit(k, mtx(4.18, 0, z, Math.PI / 4)); S.g('mobOak', seat); S.g('blackMatte', new THREE.CylinderGeometry(0.13, 0.13, 0.012, 24), 0, 0.611, 0);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); S.rod('blackMatte', [0.205 * c, 0, 0.205 * s], [0.125 * c, 0.612, 0.125 * s], 0.011, 10); }
    S.g('blackMatte', new THREE.TorusGeometry(0.173, 0.008, 8, 40).rotateX(Math.PI / 2), 0, 0.25, 0);
  }
}

// ---------------------------------------------------------------- séjour
// Table 1,80 × 1,00 en chêne massif sur piétement acier noir en cadre, 6 chaises (pieds chêne fuselés, assise tapissée, dossier cintré)
function chairParts() {
  const P = [], add = (mat, geo, c?) => P.push({ mat, geo, c });
  for (const sx of [-1, 1]) {
    add('mobOak', rodG([sx * 0.200, 0, 0.195], [sx * 0.188, 0.43, 0.175], 0.012, 12, 0.017));
    add('mobOak', rodG([sx * 0.200, 0, -0.215], [sx * 0.190, 0.85, -0.232], 0.012, 12, 0.0155));
    add('mobOak', boxG(0.018, 0.045, 0.37).translate(sx * 0.19, 0.405, -0.02));
  }
  add('mobOak', boxG(0.36, 0.045, 0.018).translate(0, 0.405, 0.172)); add('mobOak', boxG(0.36, 0.045, 0.018).translate(0, 0.405, -0.215));
  add('mobOak', boxG(0.44, 0.012, 0.43).translate(0, 0.434, -0.01));
  add('mobFab', softBox(0.45, 0.055, 0.44, 0.022, { nI: [4, 1, 4], def: puff(0.12) }).translate(0, 0.4675, -0.005), '#9a9184');
  add('mobOak', bandG(0.42, 0.014, 0.18, 0.225, 0.175, 0.66));
  return P;
}
function dining() {
  const f = 'furn0', K = new Kit(f), xt0 = 5.85, xt1 = 7.65, zt0 = 4.85, zt1 = 5.85, zc = (zt0 + zt1) / 2;
  K.soft('mobOak', xt0, xt1, 0.72, 0.76, zt0, zt1, 0.008, { nI: [2, 1, 2] });
  for (const x of [xt0 + 0.10, xt1 - 0.14]) {
    for (const z of [zt0 + 0.07, zt1 - 0.13]) K.box('blackMatte', x, x + 0.04, 0.025, 0.69, z, z + 0.06);
    K.box('blackMatte', x, x + 0.04, 0.69, 0.72, zt0 + 0.07, zt1 - 0.07); K.box('blackMatte', x - 0.005, x + 0.045, 0, 0.025, zt0 + 0.06, zt1 - 0.06);
  }
  K.box('blackMatte', xt0 + 0.14, xt1 - 0.14, 0.685, 0.72, zc - 0.02, zc + 0.02);
  const ch = chairParts();
  for (const x of [6.20, 6.75, 7.30]) for (const [z, ry] of [[zt0 - 0.20, 0], [zt1 + 0.20, Math.PI]]) for (const p of ch) put(f, p.mat, p.geo, mtx(x, 0, z, ry), { c: p.c });
}
// Canapé 3,10 m en tissu gris clair dos au mur ouest, méridienne côté nord : socle et dossier arrondis, coussins bombés à passepoil,
// coussins de dos inclinés, pieds fuselés noirs, coussins déco ; tapis, table basse ovale en chêne
function sofa() {
  const f = 'furn0', K = new Kit(f), sf = 'sofa', zb = 7.52, zF = 6.52, x0 = 8.90, x1 = 12.00, xm = 9.88, zm = 5.86;
  for (const [x, z] of [[x0 + 0.06, zb - 0.06], [x1 - 0.06, zb - 0.06], [x1 - 0.06, zF + 0.06], [10.85, zF + 0.06], [x0 + 0.06, zm + 0.06], [xm - 0.06, zm + 0.06]]) K.rod('blackMatte', [x, 0, z], [x, 0.065, z], 0.015, 14, 0.021);
  K.soft(sf, x0, x1, 0.06, 0.27, zF, zb, 0.03, { nI: [6, 1, 2] }); K.soft(sf, x0, xm, 0.06, 0.27, zm, zF + 0.08, 0.03, { nI: [2, 1, 2] });
  K.soft(sf, x0, x1, 0.25, 0.70, zb - 0.24, zb, 0.06, { nI: [6, 2, 1] });
  K.soft(sf, x1 - 0.22, x1, 0.25, 0.62, zF, zb - 0.10, 0.07, { nI: [1, 2, 3], def: puff(0.05, 'x') });
  const pip = (a0, a1, b0, b1, y, r) => { const i = 0.29 * r; K.g(sf, pipeG(a1 - a0 - 2 * i, b1 - b0 - 2 * i, 0.71 * r, 0.0045), (a0 + a1) / 2, y, (b0 + b1) / 2); };
  const cush = (a0, a1, b0, b1) => { const r = 0.06; K.soft(sf, a0, a1, 0.26, 0.45, b0, b1, r, { nI: [5, 1, 5], def: puff(0.10) }); pip(a0, a1, b0, b1, 0.45 - 0.29 * r, r); pip(a0, a1, b0, b1, 0.26 + 0.29 * r, r); };
  cush(xm + 0.005, 10.835, zF + 0.02, zb - 0.235); cush(10.845, x1 - 0.225, zF + 0.02, zb - 0.235); cush(x0 + 0.02, xm - 0.005, zm + 0.02, zb - 0.235);
  for (const [a0, a1] of [[x0 + 0.03, xm - 0.01], [xm + 0.01, 10.835], [10.845, x1 - 0.23]]) K.soft(sf, a0, a1, 0.43, 0.85, 7.07, 7.27, 0.08, { nI: [4, 4, 1], def: puff(0.18, 'z'), rx: 0.22 });
  const pil = softBox(0.46, 0.46, 0.15, 0.07, { nI: [4, 4, 1], def: pillow(0.35, 'z') });
  for (const [x, z, ry, c] of [[11.50, 6.95, -0.30, '#c49a5a'], [9.20, 6.95, 0.28, '#8e9a80'], [10.15, 6.98, 0.06, '#e6e0d4']] as [number, number, number, string][]) K.g('mobFab', pil, x, 0.68, z, ry, 0.25, 0, { c });
  // tapis 2,90 × 2,80 et table basse 1,10 × 0,60 (plateau et tablette en chêne à angles arrondis, pieds acier noir)
  K.g('mobRug', boxG(2.90, 0.01, 2.80), 10.60, 0.005, 5.55, 0, 0, 0, { keepUV: true });
  K.g('mobOak', slab(rrect(10.15, 5.50, 11.25, 6.10, 0.14, 8), null, 0.33, 0.03, 0.004)); K.g('mobOak', slab(rrect(10.22, 5.57, 11.18, 6.03, 0.11, 8), null, 0.10, 0.02, 0.003));
  for (const x of [10.27, 11.13]) for (const z of [5.60, 6.00]) K.rod('blackMatte', [x, 0.012, z], [x, 0.33, z], 0.013, 12);
  K.box('mobPaint', 10.36, 10.62, 0.36, 0.392, 5.70, 5.90, { c: '#2f4858' }); K.g('mobPaint', boxG(0.22, 0.026, 0.165), 10.49, 0.405, 5.80, 0.18, 0, 0, { c: '#d9c9a8' });
  K.g('mobCeramic', lathe([[0, 0], [0.04, 0], [0.095, 0.05], [0.10, 0.062], [0.093, 0.062], [0.036, 0.012], [0, 0.012]]), 10.95, 0.36, 5.80);
  K.g('mobPaint', lathe([[0, 0], [0.035, 0], [0.05, 0.05], [0.045, 0.12], [0.025, 0.17], [0.027, 0.19], [0, 0.19]], 24), 11.10, 0.36, 5.95, 0, 0, 0, { c: '#7c8a74' });
  K.box('mobPaint', 10.40, 10.70, 0.12, 0.135, 5.68, 5.90, { c: '#e8e2d4' }); K.box('mobPaint', 10.42, 10.68, 0.135, 0.145, 5.70, 5.88, { c: '#a65f3e' });
}
// rangée de livres debout (dos vers +z), hauteur de base h
function books(K, x0, x1, y0, zb, r, h = 0.22) { let x = x0; while (x < x1) { const w = 0.017 + r() * 0.028, hh = h * (0.8 + r() * 0.3), d = 0.15 + r() * 0.06; if (x + w > x1) break; K.box('mobPaint', x, x + w, y0, y0 + hh, zb + 0.01, zb + 0.01 + d, { c: PAL[(r() * PAL.length) | 0] }); x += w + 0.0015; } }
// Meuble TV blanc laqué : base à 4 portes, colonnes à niches (fond chêne, portes basses), bandeau haut à LED, TV 55" murale, barre de son
function tvUnit() {
  const f = 'furn0', K = new Kit(f), zg = 3.30, x0 = 9.30, x1 = 12.40, xc = 10.85, col = 0.65, yu = 2.20, W = 'white', r = C.rng(907);
  A.box(f, x0 + 0.04, x1 - 0.04, 0, 0.06, zg, zg + 0.39, 'plinth');
  A.box(f, x0, x1, 0.06, 0.50, zg, zg + 0.43, { def: W, pz: 'mobGapW' });
  const dw = (x1 - x0 - 0.009) / 4; for (let i = 0; i < 4; i++) { const a = x0 + i * (dw + 0.003); A.box(f, a, a + dw, 0.063, 0.497, zg + 0.431, zg + 0.45, W); }
  for (const [c0, c1] of [[x0, x0 + col], [x1 - col, x1]]) {
    A.box(f, c0, c0 + 0.025, 0.50, yu - 0.025, zg, zg + 0.36, W); A.box(f, c1 - 0.025, c1, 0.50, yu - 0.025, zg, zg + 0.36, W);
    A.box(f, c0 + 0.025, c1 - 0.025, 0.90, yu - 0.025, zg, zg + 0.012, 'mobOak');
    A.box(f, c0 + 0.025, c1 - 0.025, 0.50, 0.90, zg, zg + 0.338, { def: W, pz: 'mobGapW' }); A.box(f, c0 + 0.0255, c1 - 0.0255, 0.503, 0.897, zg + 0.34, zg + 0.36, W);
    for (const y of [0.90, 1.32, 1.74]) A.box(f, c0 + 0.025, c1 - 0.025, y, y + 0.025, zg + 0.012, zg + 0.36, W);
  }
  A.box(f, x0 + col, x1 - col, 1.90, yu - 0.025, zg, zg + 0.36, W); A.box(f, x0, x1, yu - 0.025, yu, zg, zg + 0.36, W);
  A.box(f, x0 + col, x1 - col, 0.50, 1.90, zg, zg + 0.012, 'mobOak');
  K.box('mobLed', x0 + col + 0.01, x1 - col - 0.01, 1.896, 1.90, zg + 0.30, zg + 0.32);
  K.soft('blackMatte', xc - 0.615, xc + 0.615, 0.82, 1.53, zg + 0.035, zg + 0.062, 0.006); K.box('mobScreen', xc - 0.607, xc + 0.607, 0.83, 1.522, zg + 0.062, zg + 0.0626);
  K.box('blackMatte', xc - 0.20, xc + 0.20, 1.0, 1.35, zg + 0.012, zg + 0.035);
  K.soft('mobFab', xc - 0.45, xc + 0.45, 0.50, 0.565, zg + 0.12, zg + 0.21, 0.025, { c: '#3d3f42' });
  // niches : livres, vase, coupe, cadre, plante
  const L0 = x0 + 0.025, R0 = x1 - col + 0.025, z = zg + 0.012;
  books(K, L0 + 0.01, L0 + 0.30, 0.925, z, r); K.g('mobPaint', lathe([[0, 0], [0.045, 0], [0.06, 0.05], [0.055, 0.14], [0.03, 0.20], [0.032, 0.23], [0, 0.23]], 24), L0 + 0.45, 0.925, zg + 0.17, 0, 0, 0, { c: '#d8cfc0' });
  for (let i = 0; i < 3; i++) K.box('mobPaint', L0 + 0.03 + i * 0.01, L0 + 0.27 - i * 0.012, 1.345 + i * 0.03, 1.374 + i * 0.03, z + 0.03, z + 0.20 - i * 0.012, { c: PAL[(i * 5 + 2) % PAL.length] });
  K.g('mobCeramic', lathe([[0, 0], [0.04, 0], [0.085, 0.05], [0.09, 0.06], [0.083, 0.06], [0.034, 0.012], [0, 0.012]]), L0 + 0.44, 1.345, zg + 0.17);
  books(K, L0 + 0.06, L0 + 0.59, 1.765, z, r, 0.26);
  { const F = new Kit(f, K.m(R0 + 0.12, 0.925, zg + 0.06, 0.15, -0.12)); F.box('blackMatte', -0.09, 0.09, 0, 0.24, -0.01, 0.01); F.box('mobPaint', -0.075, 0.075, 0.015, 0.225, 0.01, 0.0112, { c: '#f2efe8' }); F.box('mobPaint', -0.055, 0.055, 0.04, 0.20, 0.0112, 0.0118, { c: '#7d8f9c' }); }
  K.rod('mobPaint', [R0 + 0.44, 0.925, zg + 0.17], [R0 + 0.44, 1.05, zg + 0.17], 0.05, 20, 0.06, { c: '#b56a45' });
  for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 0.03 + (i % 3) * 0.018; K.g('leaf', new THREE.IcosahedronGeometry(0.04 + r() * 0.02, 1), R0 + 0.44 + Math.cos(a) * rr, 1.10 + (i % 4) * 0.035, zg + 0.17 + Math.sin(a) * rr); }
  books(K, R0 + 0.02, R0 + 0.58, 1.345, z, r);
  books(K, R0 + 0.02, R0 + 0.30, 1.765, z, r, 0.25); K.soft('mobPaint', R0 + 0.36, R0 + 0.56, 1.765, 1.865, zg + 0.08, zg + 0.24, 0.006, { c: '#c8b27a' });
}

// ---------------------------------------------------------------- radiateurs
// Acova Fassane Vertical double (RDC) : tubes plats verticaux 70 × 11 au pas de 74 mm soudés sur deux collecteurs ronds, robinet thermostatique.
// Repère local : x le long du mur, z vers la pièce depuis le nu du mur, y depuis le sol.
function fassane(F, w, right = false) { // right : robinet à l'extrémité x = w (sinon x = 0)
  const K = new Kit('furn0', F), n = Math.max(3, Math.round(w / 0.074)), p = w / n, y0 = 0.10, y1 = 2.10, tube = stadiumG(0.068, 0.011, y1 - y0);
  for (const z of [0.052, 0.082]) for (let i = 0; i < n; i++) K.g('radiator', tube, (i + 0.5) * p, y0, z);
  for (const y of [y0 + 0.04, y1 - 0.04]) K.rod('radiator', [0.002, y, 0.067], [w - 0.002, y, 0.067], 0.017, 16);
  for (const x of [0.12, w - 0.12]) for (const y of [y0 + 0.06, y1 - 0.06]) K.rod('radiator', [x, y, 0], [x, y, 0.05], 0.008, 8);
  for (const x of [0.035, w - 0.035]) K.rod('radiator', [x, 0, 0.067], [x, y0 + 0.03, 0.067], 0.008, 10);
  const xr = right ? w - 0.035 : 0.035, xe = right ? w + 0.05 : -0.05;
  K.rod('mobChrome', [xr, 0.045, 0.067], [xr, 0.10, 0.067], 0.013, 12); K.rod('radiator', [xr, 0.072, 0.067], [xe, 0.072, 0.067], 0.024, 20, 0.022);
}
// Radson Integra Ramo (étage) : panneaux type 21 à façade profilée, joues, grille perforée, tête thermostatique latérale
function panel(F, w) {
  const K = new Kit('furn1', F), y0 = 0.15, y1 = 0.75;
  K.box('mobRadPanel', 0.004, w - 0.004, y0, y1, 0.074, 0.098); K.box('radiator', 0.006, w - 0.006, y0 + 0.01, y1 - 0.01, 0.034, 0.058);
  for (const x of [0, w - 0.004]) K.box('radiator', x, x + 0.004, y0, y1, 0.032, 0.099);
  K.box('mobRadTop', 0.004, w - 0.004, y1 - 0.004, y1 + 0.001, 0.032, 0.098);
  K.rod('radiator', [w, y1 - 0.07, 0.066], [w + 0.075, y1 - 0.07, 0.066], 0.022, 20, 0.024);
  for (const x of [w - 0.035, w - 0.085]) K.rod('radiator', [x, 0, 0.05], [x, y0 + 0.01, 0.05], 0.008, 10);
}
function radiators() {
  const e = C.E1, D = C.D, L = C.L, T = C.T;
  // RDC, plan travaux v3 p. 9 (RBT vertical, 60 cm, robinet dessiné) : entrée x 0,56 → 1,16 contre le WC, robinet au sud ; séjour ouest x 4,36 → 4,96, robinet au sud ;
  // séjour sud z 3,80 → 4,40, robinet côté porte-fenêtre puis 15 cm (coté) jusqu'au tableau
  fassane(mtx(0.56, 0, 1.43, 0), 0.60, true); fassane(mtx(4.96, 0, D - T, Math.PI), 0.60); fassane(mtx(L - T, 0, 3.80, -Math.PI / 2), 0.60, true);
  // Radson Ramo de l'étage : 90 cm aux emplacements du plan étage (PT p. 10) : ch. 1 z 2,42 → 3,32, ch. 2 z 6,09 → 6,99, ch. 3 x 3,37 → 4,27, bureau x 7,12 → 8,02
  panel(mtx(L - T, e, 2.42, -Math.PI / 2), 0.90); panel(mtx(L - T, e, 6.09, -Math.PI / 2), 0.90); panel(mtx(4.27, e, D - T, Math.PI), 0.90); panel(mtx(8.02, e, D - T, Math.PI), 0.90);
}

// ---------------------------------------------------------------- garage, entrée
// Lave-linge frontal 60 cm, collé à 1 cm de la cloison du garage (x 6,40 → 7,00) : carrosserie arrondie, bandeau (bac à lessive, sélecteur, afficheur), hublot (anneau, verre bombé, soufflet, tambour)
function garage() {
  const K = new Kit('furn0', mtx(6.70, -0.13, 0.36)), W = 'white', zf = 0.585, dy = 0.38; // dos contre le doublage du mur est (z 0,36, plan p. 9)
  for (const x of [-0.25, 0.25]) for (const z of [0.06, 0.52]) K.g('mobGrey', new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12), x, 0.006, z);
  K.soft(W, -0.298, 0.298, 0.012, 0.83, 0.01, zf - 0.11, 0.014, { nI: [2, 3, 2] });
  { const sh = new THREE.Shape([[-0.298, 0.012], [0.298, 0.012], [0.298, 0.70], [-0.298, 0.70]].map(([x, y]) => new THREE.Vector2(x, y))); const h = new THREE.Path(); h.absarc(0, dy, 0.15, 0, Math.PI * 2, true); sh.holes.push(h);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.008, bevelOffset: -0.008, bevelSegments: 3, curveSegments: 40 }); g.translate(0, 0, zf - 0.12 + 0.005); K.g(W, g); }
  K.soft(W, -0.298, 0.298, 0.70, 0.83, zf - 0.13, zf + 0.006, 0.008); K.soft(W, -0.30, 0.30, 0.83, 0.85, 0.0, 0.60, 0.006);
  K.soft(W, -0.282, -0.10, 0.718, 0.812, zf + 0.004, zf + 0.012, 0.004); K.box('mobGrey', -0.25, -0.13, 0.726, 0.734, zf + 0.012, zf + 0.0126);
  K.g('mobGrey', cylZ(0.037, 0.008), 0.03, 0.765, zf + 0.009); K.g('mobChrome', cylZ(0.028, 0.022), 0.03, 0.765, zf + 0.02);
  K.box('mobScreen', 0.10, 0.215, 0.745, 0.79, zf + 0.006, zf + 0.0075); K.box('mobDisplay', 0.12, 0.165, 0.758, 0.775, zf + 0.0075, zf + 0.008);
  for (const x of [0.24, 0.268]) K.g('mobGrey', cylZ(0.008, 0.006), x, 0.765, zf + 0.008);
  K.g('mobRubber', new THREE.CylinderGeometry(0.149, 0.149, 0.10, 40, 1, true).rotateX(Math.PI / 2), 0, dy, zf - 0.065); K.g('mobInox', cylZ(0.15, 0.004, 40), 0, dy, zf - 0.112);
  K.g('mobGrey', new THREE.TorusGeometry(0.168, 0.024, 12, 56), 0, dy, zf + 0.024); K.g('mobRubber', new THREE.TorusGeometry(0.147, 0.009, 8, 48), 0, dy, zf + 0.034);
  { const th = Math.asin(0.15 / 0.25); K.g('mobWMGlass', new THREE.SphereGeometry(0.25, 32, 6, 0, Math.PI * 2, 0, th).rotateX(Math.PI / 2), 0, dy, zf + 0.034 - 0.25 * Math.cos(th)); }
  K.box('mobGrey', 0.175, 0.195, dy - 0.05, dy + 0.05, zf + 0.012, zf + 0.026);
  K.soft(W, -0.27, -0.13, 0.03, 0.10, zf, zf + 0.004, 0.002);
}
function entree() { new Kit('furn0').soft('mobDoormat', 0.40, 0.95, 0, 0.009, 1.92, 2.62, 0.003); } // tapis-brosse coco devant la porte

// ---------------------------------------------------------------- chambres
// Lit 160 ou 180 × 200 : pieds chêne, sommier tapissier, tête de lit capitonnée à côtes, matelas, couette drapée (revers), oreillers, coussin, plaid ;
// chevets chêne (tiroir, niche) avec lampe à abat-jour, à 15 cm de chaque côté du lit (demande client du 12/10)
function nightstand(K, a, b, c, d, withBook) {
  for (const x of [a + 0.035, b - 0.035]) for (const z of [c + 0.035, d - 0.035]) K.rod('mobOak', [x, 0, z], [x, 0.20, z], 0.010, 10, 0.014);
  K.soft('mobOak', a, b, 0.475, 0.50, c, d, 0.006); K.box('mobOak', a, b, 0.20, 0.222, c, d - 0.004);
  K.box('mobOak', a, a + 0.018, 0.222, 0.475, c, d - 0.004); K.box('mobOak', b - 0.018, b, 0.222, 0.475, c, d - 0.004); K.box('mobOak', a + 0.018, b - 0.018, 0.222, 0.475, c, c + 0.012);
  K.box('mobOak', a + 0.018, b - 0.018, 0.33, 0.345, c + 0.012, d - 0.03); K.soft('mobOak', a + 0.02, b - 0.02, 0.348, 0.472, d - 0.025, d - 0.002, 0.003);
  const m = (a + b) / 2; K.rod('blackMatte', [m - 0.05, 0.41, d + 0.012], [m + 0.05, 0.41, d + 0.012], 0.0045, 8); for (const x of [m - 0.045, m + 0.045]) K.rod('blackMatte', [x, 0.41, d - 0.002], [x, 0.41, d + 0.012], 0.0035, 6);
  const lx = withBook ? m + 0.07 : m - 0.02, lz = c + 0.17;
  K.g('mobCeramic', lathe([[0, 0], [0.055, 0], [0.062, 0.012], [0.075, 0.07], [0.068, 0.13], [0.042, 0.175], [0.016, 0.195], [0.013, 0.24], [0, 0.24]]), lx, 0.50, lz);
  K.g('mobShade', new THREE.CylinderGeometry(0.105, 0.13, 0.18, 32, 1, true), lx, 0.80, lz); K.g('mobLed', new THREE.SphereGeometry(0.026, 12, 8), lx, 0.77, lz);
  if (withBook) { K.g('mobPaint', boxG(0.15, 0.025, 0.21), m - 0.10, 0.5125, d - 0.13, 0.25, 0, 0, { c: '#5b3a4a' }); K.g('mobPaint', boxG(0.13, 0.02, 0.19), m - 0.10, 0.535, d - 0.13, 0.05, 0, 0, { c: '#dcd6c8' }); }
}
function bed(x0, x1, z0, z1, pal) {
  const K = new Kit('furn1', mtx(0, C.E1, 0)), xc = (x0 + x1) / 2, W = x1 - x0;
  for (const x of [x0 + 0.10, x1 - 0.10]) for (const z of [z0 + 0.20, z1 - 0.10]) K.rod('mobOak', [x, 0, z], [x, 0.09, z], 0.018, 12, 0.022);
  K.soft('mobFab', x0, x1, 0.09, 0.34, z0 + 0.07, z1, 0.03, { nI: [3, 1, 4], c: pal.frame });
  K.soft('mobFab', x0 - 0.05, x1 + 0.05, 0.06, 1.10, z0, z0 + 0.03, 0.012, { c: pal.frame });
  const n = Math.round((W + 0.10) / 0.28), cw = (W + 0.10) / n; for (let i = 0; i < n; i++) { const a = x0 - 0.05 + i * cw; K.soft('mobFab', a + 0.002, a + cw - 0.002, 0.30, 1.10, z0 + 0.02, z0 + 0.09, 0.035, { nA: 2, nI: [1, 4, 1], def: puff(0.25, 'z'), c: pal.frame }); }
  const mx0 = x0 + 0.02, mx1 = x1 - 0.02, mz0 = z0 + 0.09, mz1 = z1 - 0.02, mt = 0.56;
  K.soft('mobFab', mx0, mx1, 0.34, mt, mz0, mz1, 0.05, { nI: [3, 1, 4], def: puff(0.04), c: '#f4f2ee' });
  // couette drapée sur les côtés et au pied, revers et plaid drapés par-dessus (même centre de pli)
  const th = 0.05, rb = 0.05, al = Math.PI / 2 * rb, hw = (mx1 - mx0) / 2 + 0.005, dz0 = z0 + 0.66, Ld = al + 0.15, zfo = mz1 + 0.005;
  const dW = 2 * hw + 2 * Ld, dD = zfo - dz0 + Ld, zfl = dD / 2 - Ld, R = th / 2 - 0.001;
  const zx = [[hw - 0.03, hw + al + 0.03], [-hw - al - 0.03, -hw + 0.03]];
  const duv = softBox(dW, th, dD, R, { ax: [gridAx(dW / 2 - R, zx), null, gridAx(dD / 2 - R, [[zfl - 0.03, zfl + al + 0.03]])], def: drape(hw, zfl, rb) });
  K.g('mobFab', duv, xc, mt + th / 2, dz0 + dD / 2, 0, 0, 0, { c: pal.duvet });
  const sheet = (zA, zB, t2, hang, c) => { const rb2 = rb + th / 2 + t2 / 2, W2 = 2 * hw + 2 * (Math.PI / 2 * rb2 + hang), R2 = t2 / 2 - 0.001;
    const g = softBox(W2, t2, zB - zA, R2, { ax: [gridAx(W2 / 2 - R2, [[hw - 0.03, hw + Math.PI / 2 * rb2 + 0.03], [-hw - Math.PI / 2 * rb2 - 0.03, -hw + 0.03]]), null, null], nI: [1, 1, 3], def: drape(hw, 1e3, rb2) });
    K.g('mobFab', g, xc, mt + th + t2 / 2, (zA + zB) / 2, 0, 0, 0, { c }); };
  sheet(dz0, dz0 + 0.30, 0.035, 0.10, pal.duvet); sheet(z1 - 0.62, z1 - 0.20, 0.022, 0.16, pal.throw);
  const pg = softBox(0.64, 0.15, 0.44, 0.07, { nI: [4, 1, 3], def: pillow(0.3) });
  for (const x of [x0 + W / 4 + 0.03, x1 - W / 4 - 0.03]) K.g('mobFab', pg, x, mt + 0.17, z0 + 0.30, x < xc ? 0.04 : -0.04, 0.75, 0, { c: '#f7f6f3' });
  K.g('mobFab', softBox(0.46, 0.12, 0.30, 0.06, { nI: [4, 1, 3], def: pillow(0.35) }), xc, mt + 0.14, z0 + 0.52, 0, 0.55, 0, { c: pal.cush });
  nightstand(K, x0 - 0.60, x0 - 0.15, z0, z0 + 0.40, 1); nightstand(K, x1 + 0.15, x1 + 0.60, z0, z0 + 0.40, 0);
}
function bedrooms() {
  const T = C.T;
  // chambre 1 (parentale) : king size 180, centré entre la façade des placards (x 9,10) et la façade sud (nu x 12,54) : 82 cm libres de chaque côté
  bed(9.92, 11.72, T, 2.36, { frame: '#b5a792', duvet: '#f1eee8', throw: '#b38f69', cush: '#8c9a88' });
  bed(9.90, 11.50, 4.24, 6.24, { frame: '#8e99a2', duvet: '#e8eaeb', throw: '#536375', cush: '#c9a46a' }); // chambre 2
  bed(1.20, 2.80, 4.24, 6.24, { frame: '#a6ad93', duvet: '#eee8dc', throw: '#c4876a', cush: '#e2cfae' }); // chambre 3
}
// Bureau de l'étage (bureau, fauteuil Aeron, canapé-lit) : voir chambre1.js

// Table de jardin 180 × 90 pour 6 sous la pergola (calque pergola, affichée avec elle) : plateau céramique gris clair sur cadre alu 7016,
// 6 fauteuils alu 7016 à accoudoirs, assise et dossier en toile textilène gris ; parallèle à la façade, passage libre devant la baie
function terrasse() {
  const f = 'pergola', K = new Kit(f), D = C.D, y0 = -0.04, xc = 6.45, zc = D + 1.75, xt0 = xc - 0.90, xt1 = xc + 0.90, zt0 = zc - 0.45, zt1 = zc + 0.45;
  K.soft('mobPaint', xt0, xt1, y0 + 0.728, y0 + 0.742, zt0, zt1, 0.004, { nI: [2, 1, 2], c: '#c9c6bf' }); // céramique 12 mm, chant adouci
  K.box('pergola', xt0 + 0.03, xt1 - 0.03, y0 + 0.67, y0 + 0.728, zt0 + 0.03, zt0 + 0.05); K.box('pergola', xt0 + 0.03, xt1 - 0.03, y0 + 0.67, y0 + 0.728, zt1 - 0.05, zt1 - 0.03);
  K.box('pergola', xt0 + 0.03, xt0 + 0.05, y0 + 0.67, y0 + 0.728, zt0 + 0.05, zt1 - 0.05); K.box('pergola', xt1 - 0.05, xt1 - 0.03, y0 + 0.67, y0 + 0.728, zt0 + 0.05, zt1 - 0.05);
  for (const x of [xt0 + 0.03, xt1 - 0.09]) for (const z of [zt0 + 0.03, zt1 - 0.09]) { K.box('pergola', x, x + 0.06, y0 + 0.008, y0 + 0.67, z, z + 0.06); K.box('mobRubber', x + 0.005, x + 0.055, y0, y0 + 0.008, z + 0.005, z + 0.055); }
  // fauteuil : repère local, assise face à +z (comme chairParts)
  const P = [], add = (mat, geo, c?) => P.push({ mat, geo, c }), tex = '#8d8f8f';
  for (const sx of [-1, 1]) {
    add('pergola', rodG([sx * 0.25, 0.006, 0.23], [sx * 0.25, 0.64, 0.21], 0.0135, 12)); // pied avant prolongé en support d'accoudoir
    add('pergola', rodG([sx * 0.25, 0.006, -0.22], [sx * 0.24, 0.90, -0.30], 0.0135, 12)); // pied arrière prolongé en montant de dossier
    add('pergola', boxG(0.045, 0.022, 0.50).translate(sx * 0.25, 0.65, -0.03)); // accoudoir plat
    add('pergola', boxG(0.022, 0.04, 0.44).translate(sx * 0.245, 0.43, -0.005)); // longeron d'assise
    add('mobRubber', new THREE.CylinderGeometry(0.016, 0.016, 0.012, 10).translate(sx * 0.25, 0.006, 0.23));
    add('mobRubber', new THREE.CylinderGeometry(0.016, 0.016, 0.012, 10).translate(sx * 0.25, 0.006, -0.22));
  }
  add('pergola', boxG(0.47, 0.04, 0.022).translate(0, 0.43, 0.205)); add('pergola', boxG(0.47, 0.04, 0.022).translate(0, 0.43, -0.215));
  add('pergola', boxG(0.47, 0.03, 0.022).translate(0, 0.875, -0.295)); // traverse haute du dossier
  add('mobFab', softBox(0.46, 0.012, 0.40, 0.005, { nI: [4, 1, 4], def: (v, w, h, d) => { v.y -= 0.018 * wgt(v, { x: w, y: 1e9, z: d }, 'y'); } }).translate(0, 0.44, -0.005), tex); // toile tendue, légère flèche
  add('mobFab', softBox(0.46, 0.40, 0.010, 0.004, { nI: [4, 4, 1] }).rotateX(-0.20).translate(0, 0.67, -0.255), tex);
  for (const x of [xc - 0.60, xc, xc + 0.60]) for (const [z, ry] of [[zt0 - 0.22, 0], [zt1 + 0.22, Math.PI]]) for (const p of P) put(f, p.mat, p.geo, mtx(x, y0, z, ry), { c: p.c });
}

export function buildMobilier(ctx: Ctx) {
  C = ctx; M = ctx.M; A = ctx.A; BK.clear();
  materials(); kitchen(); dining(); sofa(); tvUnit(); radiators(); garage(); entree(); bedrooms(); terrasse();
  flush();
}
