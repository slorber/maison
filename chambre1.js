// Chambre 1 et bureau de l'étage : mobilier demandé par les clients, calque 'furn1'. Appelé juste après buildMobilier(ctx), avant A.build(groups).
// - Chambre 1 : petit bureau 120 × 60 dans l'angle sud-ouest, dos à la cloison de la chambre 2 ; TV murale façon Samsung The Frame 55"
//   en cadre noir, en hauteur sur la même cloison, face au lit (axe du lit x = 10,65) ; fauteuil Herman Miller Aeron.
// - Bureau : bureau 120 × 64 dos à la cloison de la chambre 2 (bout à 10 cm du radiateur) avec MacBook Pro 16", écran 32" et écran 24"
//   en portrait, même fauteuil Aeron, canapé-lit (matelas 140 × 190, 83 cm de profondeur fermé) le long de la cloison du palier, dépliable
//   au clic (ouvrant déclaré dans ctx.DOORS, comme les portes), étagère à casiers façon Kallax 2 × 4 en chêne clair dans l'angle libre.
// Le mobilier fixe est fusionné en un mesh par matériau (peu d'appels de dessin) ; seules les pièces mobiles du canapé restent séparées.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let C, M; const BK = new Map();
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpC = new THREE.Color();
const cl = t => t < 0 ? 0 : t > 1 ? 1 : t, ez = t => { t = cl(t); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- outils géométriques (repris de mobilier.js)
function mtx(x, y, z, ry = 0, rx = 0, rz = 0) { return new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V3(1, 1, 1)); }
// UV en mètres par projection sur l'axe dominant de la normale (textures à l'échelle)
function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = n.getX(i), ay = n.getY(i), az = n.getZ(i), X = Math.abs(ax), Y = Math.abs(ay), Z = Math.abs(az), x = p.getX(i), y = p.getY(i), z = p.getZ(i), j = i * 2;
    if (X >= Y && X >= Z) { uv[j] = ax > 0 ? -z : z; uv[j + 1] = y; } else if (Y >= Z) { uv[j] = x; uv[j + 1] = -z; } else { uv[j] = az > 0 ? x : -x; uv[j + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
// géométrie prête à fusionner (transformée par m4, attributs normalisés) ; o.c : couleur de sommet (matériaux vertexColors), o.keepUV
function prep(mat, geo, m4, o = {}) {
  const g = geo.clone();
  if (!g.index) g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
  if (m4) g.applyMatrix4(m4);
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  g.clearGroups(); g.morphAttributes = {};
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!o.keepUV || !g.attributes.uv) worldUV(g);
  if (M[mat].vertexColors) { tmpC.set(o.c || '#ffffff'); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = tmpC.r; a[i * 3 + 1] = tmpC.g; a[i * 3 + 2] = tmpC.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  return g;
}
// dépôt dans le seau calque|matériau (mobilier fixe)
function put(layer, mat, geo, m4, o) { const key = layer + '|' + mat; let b = BK.get(key); if (!b) BK.set(key, b = { layer, mat, list: [] }); b.list.push(prep(mat, geo, m4, o)); }
function flush() {
  for (const b of BK.values()) { const m = new THREE.Mesh(mergeGeometries(b.list, false), M[b.mat]); m.name = 'chambre1'; m.castShadow = !M[b.mat].transparent; m.receiveShadow = true; C.groups[b.layer].add(m); }
  BK.clear();
}
// pièce mobile : géométries rassemblées par matériau, puis un mesh par matériau accroché au groupe g
function sinkTo() { const map = new Map(), f = (mat, geo, m4, o) => { let l = map.get(mat); if (!l) map.set(mat, l = []); l.push(prep(mat, geo, m4, o)); }; f.map = map; return f; }
function meshesOf(sink, g, out) { for (const [mat, l] of sink.map) { const m = new THREE.Mesh(mergeGeometries(l, false), M[mat]); m.name = 'chambre1'; m.castShadow = true; m.receiveShadow = true; g.add(m); out.push(m); } }
// boîte arrondie subdivisée (rayon r, nA segments par quart d'arrondi, nI segments intérieurs), o.def(v, w, h, d) déforme, normales lissées
function softBox(w, h, d, r, o = {}) {
  const S = [w, h, d], H = S.map(s => s / 2), R = Math.min(r, ...H) * 0.999, nA = o.nA ?? 3, nI = o.nI || [1, 1, 1];
  const ax = S.map((s, i) => { const h2 = H[i], a = []; for (let k = nA; k >= 1; k--) a.push(-h2 + R - R * Math.tan(Math.PI / 4 * k / nA));
    for (let k = 0; k <= nI[i]; k++) a.push(-h2 + R + (s - 2 * R) * k / nI[i]);
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
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function rodG(a, b, r, seg = 12, r2) { // cylindre de a (rayon r) à b (rayon r2)
  const pa = V3(...a), pb = V3(...b), d = pb.clone().sub(pa), len = d.length();
  const g = new THREE.CylinderGeometry(r2 ?? r, r, len, seg, 1);
  return g.applyMatrix4(new THREE.Matrix4().compose(pa.add(pb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()), V3(1, 1, 1)));
}
// tube lisse passant par des points (cadres, accoudoirs, piètements cintrés)
const tubeG = (pts, r, seg, rad = 6, closed = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V3(...p)), closed, 'catmullrom', 0.5), seg, r, rad, closed);
// nappe paramétrée f(u, v) → [x, y, z] sur nu × nv quadrilatères (toiles tendues)
function sheetG(nu, nv, f) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...f(i / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// repère local : toutes les cotes passées sont dans le repère F (identité = monde) ; sink : collecteur d'une pièce mobile (sinon seaux fixes)
class Kit {
  constructor(layer, F, sink) { this.l = layer; this.F = F || new THREE.Matrix4(); this.s = sink; }
  m(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) { return this.F.clone().multiply(mtx(x, y, z, ry, rx, rz)); }
  p(mat, geo, m4, o) { if (this.s) this.s(mat, geo, m4, o); else put(this.l, mat, geo, m4, o); return this; }
  g(mat, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, o) { return this.p(mat, geo, this.m(x, y, z, ry, rx, rz), o); }
  box(mat, x0, x1, y0, y1, z0, z1, o) { return this.g(mat, boxG(x1 - x0, y1 - y0, z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, o); }
  soft(mat, x0, x1, y0, y1, z0, z1, r, o = {}) { return this.g(mat, softBox(x1 - x0, y1 - y0, z1 - z0, r, o), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o.ry || 0, o.rx || 0, o.rz || 0, o); }
  rod(mat, a, b, r, seg = 12, r2, o) { return this.p(mat, rodG(a, b, r, seg, r2), this.F, o); }
}

// ---------------------------------------------------------------- matériaux
function materials() {
  const { makeTex, std } = C;
  // toile Pellicle graphite : brins horizontaux marqués sur trame fine, légèrement ajourée (on devine le cadre à travers)
  const pel = makeTex(64, 0.016, (g, s) => {
    g.fillStyle = '#26282b'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) { g.fillStyle = 'rgba(128,132,138,0.38)'; g.fillRect(0, y, s, 1.6); }
    for (let x = 0; x < s; x += 8) { g.fillStyle = 'rgba(0,0,0,0.30)'; g.fillRect(x, 0, 1.2, s); }
  });
  M.c1Pellicle = std({ map: pel, roughness: 0.75, transparent: true, opacity: 0.94, side: THREE.DoubleSide });
  M.c1Graphite = std({ color: '#3b3e42', roughness: 0.36, metalness: 0.35 }); // polymère et aluminium graphite de l'Aeron
  M.c1Steel = std({ color: '#4d5459', roughness: 0.45, metalness: 0.2 }); // acier thermolaqué RAL 7016 (même teinte affichée que RAL7016 de main.js)
  const art = artTex(); art.repeat.set(1, 1);
  M.c1Art = std({ map: art, emissive: '#ffffff', emissiveMap: art, emissiveIntensity: 0.28, roughness: 0.6 }); // dalle mate en mode Art
  // poste du bureau : aluminium anodisé gris sidéral du MacBook Pro, pavé tactile en verre, clavier noir, dalles allumées sur un fond sombre discret
  M.c1SpaceGrey = std({ color: '#7b7d81', roughness: 0.4, metalness: 0.45 });
  M.c1Track = std({ color: '#5f6266', roughness: 0.22, metalness: 0.3 });
  M.c1Keys = std({ map: keysTex(), roughness: 0.65 });
  const scr = screenTex(); M.c1Screen = std({ map: scr, emissive: '#ffffff', emissiveMap: scr, emissiveIntensity: 0.3, roughness: 0.45 }); // traitement antireflet mat
}
// clavier du MacBook Pro (zone 28,2 × 10,8 cm) : rangée de fonctions en demi-hauteur, cinq rangées, flèches en T inversé ; touches noires sur fond noir
function keysTex() {
  return C.makeTex(512, 1, (g, s, w, h) => {
    g.fillStyle = '#0b0c0d'; g.fillRect(0, 0, w, h);
    const u = w / 14.5, gp = u * 0.13, rows = [[0.55, Array(14).fill(14.5 / 14)], [1, [...Array(13).fill(1), 1.5]], [1, [1.5, ...Array(13).fill(1)]],
      [1, [1.75, ...Array(11).fill(1), 1.75]], [1, [2.25, ...Array(10).fill(1), 2.25]], [1, [1, 1, 1, 1.25, 5, 1.25, 1, 1, 1, 1]]];
    const key = (x, y, kw, kh) => { g.fillStyle = '#1f2023'; g.fillRect(x * u + gp / 2, y * u + gp / 2, kw * u - gp, kh * u - gp); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x * u + gp / 2, y * u + gp / 2, kw * u - gp, 1); };
    let y = 0;
    rows.forEach(([rh, ks], r) => { let x = 0; ks.forEach((k, i) => {
      if (r === 5 && i >= 7) { if (i === 8) { key(x, y, k, 0.5); key(x, y + 0.5, k, 0.5); } else key(x, y + 0.5, k, 0.5); } else key(x, y, k, rh); // flèches
      x += k; }); y += rh; });
  }, { w: 512, h: 196 });
}
// fond d'écran sombre et discret (bleu nuit, halo doux plus clair en bas à gauche), commun aux trois dalles
function screenTex() {
  return C.makeTex(256, 1, (g, s, w, h) => {
    let gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#18222e'); gr.addColorStop(1, '#0a0f15'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    gr = g.createRadialGradient(w * 0.28, h * 1.05, 8, w * 0.28, h * 1.05, w * 0.75); gr.addColorStop(0, 'rgba(78,104,132,0.55)'); gr.addColorStop(1, 'rgba(78,104,132,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { w: 256, h: 160 });
}
// œuvre affichée en mode Art (dalle éteinte) : marine à la dune, passe-partout numérique blanc cassé à biseau
function artTex() {
  return C.makeTex(1024, 1, (g, s, w, h) => {
    const r = C.rng(1301), ax = 168, ay = 70, aw = w - 2 * ax, ah = h - 2 * ay, hz = ay + ah * 0.52;
    g.fillStyle = '#ebe7df'; g.fillRect(0, 0, w, h);
    g.save(); g.beginPath(); g.rect(ax, ay, aw, ah); g.clip();
    let gr = g.createLinearGradient(0, ay, 0, hz); gr.addColorStop(0, '#a7bac3'); gr.addColorStop(0.6, '#d6d7cc'); gr.addColorStop(1, '#f0dbb5'); g.fillStyle = gr; g.fillRect(ax, ay, aw, hz - ay);
    const sx = ax + aw * 0.66, sy = ay + ah * 0.34; gr = g.createRadialGradient(sx, sy, 3, sx, sy, 95);
    gr.addColorStop(0, 'rgba(255,246,220,0.95)'); gr.addColorStop(0.22, 'rgba(255,236,196,0.55)'); gr.addColorStop(1, 'rgba(255,236,196,0)'); g.fillStyle = gr; g.fillRect(ax, ay, aw, hz - ay);
    for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(255,255,255,${0.07 + r() * 0.12})`; g.beginPath(); g.ellipse(ax + r() * aw, ay + ah * (0.06 + r() * 0.32), 50 + r() * 120, 3 + r() * 7, 0, 0, 7); g.fill(); }
    // pointe rocheuse lointaine
    g.fillStyle = 'rgba(112,130,136,0.9)'; g.beginPath(); g.moveTo(ax, hz + 2);
    for (let x = 0; x <= aw * 0.42; x += 6) g.lineTo(ax + x, hz - 30 * Math.pow(1 - x / (aw * 0.42), 0.55) - 3 * Math.sin(x / 17));
    g.lineTo(ax + aw * 0.42, hz + 2); g.closePath(); g.fill();
    // mer, reflets sous le soleil
    const sb = ay + ah * 0.8; gr = g.createLinearGradient(0, hz, 0, sb); gr.addColorStop(0, '#83a0a8'); gr.addColorStop(1, '#4d6b76'); g.fillStyle = gr; g.fillRect(ax, hz, aw, sb - hz);
    for (let i = 0; i < 300; i++) { const y = hz + Math.pow(r(), 1.5) * (sb - hz), x = ax + r() * aw, near = Math.abs(x - sx) < 30 + (y - hz) * 0.7;
      g.strokeStyle = near ? `rgba(255,241,208,${0.25 + r() * 0.4})` : `rgba(222,233,236,${0.07 + r() * 0.14})`; g.lineWidth = 1 + r() * 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + r() * 36, y); g.stroke(); }
    // dune et oyats au premier plan
    const top = x => ay + ah * 0.76 + 16 * Math.sin(x / aw * 3.1 + 0.4) - 34 * Math.exp(-(((x / aw - 0.2) / 0.15) ** 2));
    gr = g.createLinearGradient(0, ay + ah * 0.7, 0, ay + ah); gr.addColorStop(0, '#d5bd94'); gr.addColorStop(1, '#b5966b'); g.fillStyle = gr;
    g.beginPath(); g.moveTo(ax, ay + ah); for (let x = 0; x <= aw; x += 8) g.lineTo(ax + x, top(x)); g.lineTo(ax + aw, ay + ah); g.closePath(); g.fill();
    for (let i = 0; i < 1100; i++) { const x = r() * aw, y0 = top(x) + 4 + r() * 26, l = 10 + r() * 34, a = -Math.PI / 2 + (r() - 0.45) * 0.7;
      g.strokeStyle = r() < 0.6 ? `rgba(104,112,74,${0.35 + r() * 0.4})` : `rgba(170,160,104,${0.35 + r() * 0.4})`; g.lineWidth = 0.8 + r() * 1.2;
      g.beginPath(); g.moveTo(ax + x, y0); g.quadraticCurveTo(ax + x + Math.cos(a) * l * 0.5, y0 + Math.sin(a) * l * 0.6, ax + x + Math.cos(a) * l, y0 + Math.sin(a) * l); g.stroke(); }
    // touches de pinceau sur l'ensemble
    for (let i = 0; i < 2800; i++) { const x = ax + r() * aw, y = ay + r() * ah, a = (r() - 0.5) * 0.5; g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(30,30,30,0.045)'; g.lineWidth = 1 + r() * 2.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); g.stroke(); }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3; g.strokeRect(ax - 2.5, ay - 2.5, aw + 5, ah + 5);
    g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1; g.strokeRect(ax - 4.5, ay - 4.5, aw + 9, ah + 9);
  }, { w: 1024, h: 576 });
}

// ---------------------------------------------------------------- bureau minimaliste (repère local : origine au sol au centre, dos du bureau côté +z, utilisateur côté −z)
// Plateau chêne clair 25 mm à chants adoucis, piètement acier RAL 7016 : pieds 40 × 40, ceinture 50 × 20 en retrait de 15 mm, patins
function desk(K, w, d, h) {
  const tp = 0.025, hw = w / 2, hd = d / 2, i = 0.035, s = 0.02, yb = h - tp - 0.05, pad = new THREE.CylinderGeometry(0.014, 0.014, 0.008, 10);
  K.soft('mobOak', -hw, hw, h - tp, h, -hd, hd, 0.004, { nA: 2, nI: [3, 1, 2] });
  for (const x of [-hw + i, hw - i]) for (const z of [-hd + i, hd - i]) { K.box('c1Steel', x - s, x + s, 0.008, h - tp, z - s, z + s); K.g('blackMatte', pad, x, 0.004, z); }
  for (const z of [-hd + i, hd - i]) K.box('c1Steel', -hw + i + s, hw - i - s, yb, h - tp, z - 0.01, z + 0.01);
  for (const x of [-hw + i, hw - i]) K.box('c1Steel', x - 0.01, x + 0.01, yb, h - tp, -hd + i + s, hd - i - s);
}

// ---------------------------------------------------------------- fauteuil Herman Miller Aeron taille B, graphite
// Cotes du fabricant (taille B) : hauteur hors tout 933–1045 mm, largeur 719 mm, profondeur 698–719 mm, hauteur d'assise 376–579 mm
// (réglée ici à 460 mm), profondeur d'assise 432 mm, accoudoirs fixes à 216 mm au-dessus de l'assise.
// Repère local : y vers le haut depuis le sol, z vers l'avant de l'assise, origine sur l'axe du vérin.
// Assise et dossier : toile Pellicle tendue dans un cadre (taille de guêpe), dossier cintré en plan, renfort lombaire PostureFit SL
// à deux coussinets derrière la toile, piétement 5 branches en aluminium graphite sur roulettes doubles.
let AERON = null;
function aeronParts() {
  if (AERON) return AERON;
  const P = [], add = (mat, geo) => { if (!geo.attributes.normal) geo.computeVertexNormals(); worldUV(geo); P.push({ mat, geo }); };
  const sq = (t, n) => Math.pow(1 - Math.pow(cl(t), n), 1 / n); // arrondi superelliptique des extrémités
  const cosS = s => 0.5 - 0.5 * Math.cos(Math.PI * s); // pas resserré aux extrémités
  // --- assise : plus large à l'avant, pincée vers l'arrière, bord avant tombant (« waterfall »), toile légèrement creusée
  const zr = -0.205, zf = 0.245, Ls = zf - zr;
  const hwS = z => (0.21 + 0.036 * (z - zr) / Ls - 0.014 * Math.exp(-(((z + 0.06) / 0.07) ** 2))) * sq((zr + 0.10 - z) / 0.10, 2.2) * sq((z - zf + 0.045) / 0.045, 3);
  const ySeat = (z, xn) => { const s = (z - zr) / Ls; return 0.438 + 0.022 * s - 0.03 * Math.max(0, (z - 0.17) / 0.075) ** 2 + 0.012 * xn * xn - 0.012 * (1 - xn * xn) * Math.sin(Math.PI * s); };
  const zS = s => zr + Ls * cosS(s);
  add('c1Pellicle', sheetG(14, 20, (u, v) => { const z = zS(0.01 + 0.98 * v), xn = 2 * u - 1; return [xn * hwS(z) * 0.985, ySeat(z, xn), z]; }));
  const ring = (n, f) => { const a = []; for (let k = 0; k <= n; k++) a.push(f(k / n, 1)); for (let k = n - 1; k >= 1; k--) a.push(f(k / n, -1)); return a; };
  add('c1Graphite', tubeG(ring(36, (s, sg) => { const z = zS(s); return [sg * hwS(z), ySeat(z, 1) + 0.003, z]; }), 0.012, 84, 6, true));
  // --- dossier : étroit en bas, taille marquée vers le tiers inférieur, large aux épaules, sommet arrondi ; incliné, galbe lombaire, cintré en plan
  const yb0 = 0.53, yb1 = 1.0, Hb = yb1 - yb0;
  const hwB = y => { const t = (y - yb0) / Hb; return (0.152 + 0.09 * t * t + 0.013 * Math.exp(-(((t - 0.08) / 0.08) ** 2))) * sq((0.10 - t) / 0.10, 2.5) * sq((t - 0.84) / 0.16, 2.6); };
  const zB = (y, x) => { const t = (y - yb0) / Hb; return -0.215 - 0.095 * Math.pow(Math.max(t, 0), 1.25) + 0.016 * Math.exp(-(((t - 0.22) / 0.12) ** 2)) + 0.5 * x * x; };
  const yS = s => yb0 + Hb * cosS(s);
  add('c1Pellicle', sheetG(14, 22, (u, v) => { const y = yS(0.01 + 0.98 * v), x = (2 * u - 1) * hwB(y) * 0.985; return [x, y, zB(y, x)]; }));
  add('c1Graphite', tubeG(ring(40, (s, sg) => { const y = yS(s), x = sg * hwB(y); return [x, y, zB(y, x) - 0.002]; }), 0.013, 96, 6, true));
  // --- arceau porteur en U sous l'arrière de l'assise (relié au mécanisme), montants du dossier, accoudoirs fixes en crosse, manchettes noires
  add('c1Graphite', tubeG([[-0.30, 0.435, -0.205], [-0.21, 0.40, -0.175], [0, 0.39, -0.15], [0.21, 0.40, -0.175], [0.30, 0.435, -0.205]], 0.019, 28, 8));
  add('c1Graphite', softBox(0.12, 0.03, 0.12, 0.012, { nA: 2 }).translate(0, 0.39, -0.10)); // liaison arceau / mécanisme
  for (const sx of [-1, 1]) {
    add('c1Graphite', tubeG([[sx * 0.118, 0.585, zB(0.585, 0.118) - 0.01], [sx * 0.13, 0.51, -0.236], [sx * 0.15, 0.43, -0.20], [sx * 0.16, 0.405, -0.175]], 0.017, 14, 6));
    add('c1Graphite', tubeG([[sx * 0.29, 0.43, -0.20], [sx * 0.312, 0.50, -0.222], [sx * 0.32, 0.59, -0.19], [sx * 0.32, 0.635, -0.11], [sx * 0.32, 0.645, 0.0], [sx * 0.32, 0.643, 0.08]], 0.015, 26, 6));
    add('blackMatte', softBox(0.075, 0.024, 0.26, 0.011, { nA: 2, nI: [1, 1, 3] }).translate(sx * 0.32, 0.664, 0.0));
    add('c1Graphite', rodG([sx * 0.12, 0.403, -0.17], [sx * 0.12, 0.418, 0.17], 0.011, 8)); // longerons porteurs de l'assise
    // PostureFit SL : coussinet en aile derrière la toile, côté sx
    const px = sx * 0.075, py = 0.612; add('blackMatte', softBox(0.12, 0.085, 0.02, 0.009, { nA: 2 }).rotateY(-sx * 0.075).translate(px, py, zB(py, px) - 0.017));
  }
  add('c1Graphite', tubeG([-0.17, -0.09, 0, 0.09, 0.17].map(x => [x, 0.60, zB(0.60, x) - 0.03]), 0.007, 12, 6));
  add('blackMatte', new THREE.CylinderGeometry(0.018, 0.018, 0.022, 16).rotateZ(Math.PI / 2).translate(0.18, 0.60, zB(0.60, 0.18) - 0.03)); // molette de réglage
  // --- mécanisme d'inclinaison, molette de tension, manette, vérin, étoile
  add('c1Graphite', softBox(0.20, 0.045, 0.23, 0.015, { nA: 2 }).translate(0, 0.38, -0.025));
  add('blackMatte', new THREE.CylinderGeometry(0.032, 0.032, 0.026, 20).rotateX(Math.PI / 2).translate(0, 0.37, 0.10));
  add('blackMatte', rodG([0.10, 0.385, 0.03], [0.17, 0.39, 0.075], 0.006, 8)); add('blackMatte', softBox(0.03, 0.012, 0.045, 0.005, { nA: 1 }).translate(0.18, 0.39, 0.085));
  add('blackMatte', rodG([0, 0.26, 0], [0, 0.365, 0], 0.02, 14)); add('c1Graphite', rodG([0, 0.15, 0], [0, 0.26, 0], 0.027, 16));
  add('c1Graphite', new THREE.CylinderGeometry(0.04, 0.05, 0.07, 18).translate(0, 0.125, 0));
  // branche effilée et légèrement descendante (6 tranches), douille et roulette double à chape
  const leg = new THREE.BoxGeometry(1, 1, 1, 1, 1, 6), lp = leg.attributes.position;
  for (let i = 0; i < lp.count; i++) { const t = lp.getZ(i) + 0.5, w = 0.054 - 0.022 * t, hh = 0.05 - 0.022 * t; lp.setXYZ(i, lp.getX(i) * w, 0.127 - 0.032 * t - 0.004 * t * t + lp.getY(i) * hh, 0.035 + 0.29 * t); }
  leg.computeVertexNormals();
  const wheel = new THREE.CylinderGeometry(0.031, 0.031, 0.016, 14).rotateZ(Math.PI / 2), hood = softBox(0.052, 0.034, 0.056, 0.012, { nA: 1 });
  for (let k = 0; k < 5; k++) {
    const a = k * Math.PI * 2 / 5, R = new THREE.Matrix4().makeRotationY(a), sw = 1.3 * k + 0.4; // chapes orientées au hasard
    add('c1Graphite', leg.clone().applyMatrix4(R));
    const tip = V3(0, 0, 0.315).applyMatrix4(R), Wm = new THREE.Matrix4().makeRotationY(a + sw).setPosition(tip.x, 0, tip.z);
    add('blackMatte', rodG([0, 0.064, 0], [0, 0.084, 0], 0.009, 8).applyMatrix4(Wm));
    add('blackMatte', hood.clone().translate(0, 0.055, -0.012).applyMatrix4(Wm));
    for (const wx of [-0.018, 0.018]) add('blackMatte', wheel.clone().translate(wx, 0.031, -0.022).applyMatrix4(Wm));
  }
  return AERON = P;
}
function aeron(x, z, ry) { const m = mtx(x, C.E1, z, ry); for (const p of aeronParts()) put('furn1', p.mat, p.geo, m, { keepUV: true }); }

// ---------------------------------------------------------------- chambre 1
// Bureau 120 × 60 dans l'angle sud-ouest : dos à la cloison de la chambre 2 (nu z 4,17), bout contre la façade sud (nu x 12,54) ;
// le radiateur (Ramo 90 du plan, z 2,42 → 3,40 robinet compris) reste dégagé de 17 cm. Portable 15" ouvert (gabarit MacBook 16" ramené à une dalle de 15,3")
// face à l'Aeron, écran 27" (dalle 16:9 59,8 × 33,6 cm) juste au-dessus (demande client du 12/10), carnet à droite, lampe LED au bout gauche (côté façade).
function chambre1() {
  const e = C.E1, h = 0.74, K = new Kit('furn1', mtx(11.94, e, 3.87));
  desk(K, 1.20, 0.60, h);
  const sx = -0.04, s15 = 15.3 / 16.2; // poste centré sur l'Aeron (x 11,90)
  macbook(new Kit('furn1', K.m(sx, h, -0.30 + 0.085 + 0.2481 * s15 / 2).multiply(new THREE.Matrix4().makeScale(s15, s15, s15)))); // base à 8,5 cm du chant avant
  monitor(new Kit('furn1', K.m(sx, h, 0.15)), 0.598, 0.336, 0.236, 0.006, 0.016, 0.24, 0.18); // 27" : bas du cadre 6 mm au-dessus du haut de l'écran du portable
  K.box('mobPaint', -0.44, -0.29, h, h + 0.012, -0.12, 0.09, { c: '#3f5e6e' }); K.box('mobPaint', -0.437, -0.293, h + 0.012, h + 0.014, -0.117, 0.087, { c: '#ebe5d8' }); // carnet
  // lampe de bureau LED noire : socle rond, fût, barre lumineuse orientée vers le plan
  // (barre tournée vers l'avant du plateau, à droite de l'écran 27")
  K.g('blackMatte', new THREE.CylinderGeometry(0.06, 0.066, 0.014, 24), 0.50, h + 0.007, 0.19); K.rod('blackMatte', [0.50, h + 0.014, 0.19], [0.50, h + 0.43, 0.19], 0.0065, 10);
  K.soft('blackMatte', 0.485, 0.515, h + 0.418, h + 0.436, -0.14, 0.205, 0.006, { nA: 2 }); K.box('mobLed', 0.49, 0.51, h + 0.416, h + 0.418, -0.12, 0.185);
  aeron(11.90, 3.46, 0); // rangé sous le bureau, droit : assise engagée de 13 cm, manchettes des accoudoirs juste devant la ceinture du plateau
  tvFrame();
}
// Valet de chambre chromé (photo du client, ~1,07 m) dans l'angle de la chambre parentale entre la porte du dressing et le retour du palier,
// tourné vers le lit : cintre en arc de 58 cm, barre à pantalon de 42 cm à 0,56 m, deux montants plats 22 × 12, entretoise, socle rond Ø 38
function valet() {
  const xc = 8.76, zc = 2.80, K = new Kit('furn1', mtx(xc, C.E1, zc, Math.atan2(10.82 - xc, 1.36 - zc))); // repère local : face vers +z
  K.g('mobChrome', new THREE.CylinderGeometry(0.19, 0.19, 0.018, 40), 0.04, 0.009, 0);
  K.g('mobChrome', new THREE.CylinderGeometry(0.165, 0.178, 0.012, 40), 0.04, 0.024, 0);
  K.box('mobChrome', -0.011, 0.011, 0.03, 1.055, -0.006, 0.006); // montant principal (cintre)
  K.box('mobChrome', 0.069, 0.091, 0.03, 0.566, -0.006, 0.006); // montant de la barre à pantalon
  K.box('mobChrome', -0.15, 0.27, 0.564, 0.584, -0.011, 0.011); // barre à pantalon
  K.rod('mobChrome', [0.011, 0.215, 0], [0.069, 0.16, 0], 0.005, 8); // entretoise
  const pts = [], n = 16, hw = 0.29, top = 1.07, sag = 0.088, yT = x => top - sag * (x / hw) ** 2;
  for (let i = 0; i <= n; i++) { const x = -hw + 2 * hw * i / n; pts.push(new THREE.Vector2(x, yT(x))); }
  for (let i = n; i >= 0; i--) { const x = -hw + 2 * hw * i / n; pts.push(new THREE.Vector2(x, yT(x) - 0.02)); }
  K.g('mobChrome', new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.012, bevelEnabled: false }), 0, 0, -0.006); // cintre en arc
}
// TV 55" façon Samsung The Frame (LS03 : 1238 × 709 × 24,9 mm, dalle 54,6" mate) en cadre noir, fixation murale extra-plate (4 mm du mur) ;
// centrée sur l'axe du lit king size (x 10,82, suit le lit), centre à 1,40 m du sol, face au lit (vers −z). Écran en mode Art (œuvre et passe-partout).
function tvFrame() {
  const K = new Kit('furn1'), zw = 4.17 - 0.004, xc = 10.82, yc = C.E1 + 1.40, W = 1.238, H = 0.709, D = 0.0249, sw = 1.209, sh = 0.680, zf = zw - D;
  K.box('blackMatte', xc - W / 2 + 0.01, xc + W / 2 - 0.01, yc - H / 2 + 0.01, yc + H / 2 - 0.01, zf + 0.004, zw); // boîtier
  // cadre rapporté noir : quatre baguettes de 14,5 mm à arêtes adoucies, 3 mm en saillie sur la dalle
  const fw = (W - sw) / 2, fh = (H - sh) / 2, z0 = zf - 0.003, z1 = zf + 0.008;
  K.soft('blackMatte', xc - W / 2, xc + W / 2, yc + H / 2 - fh, yc + H / 2, z0, z1, 0.003, { nA: 2 }); K.soft('blackMatte', xc - W / 2, xc + W / 2, yc - H / 2, yc - H / 2 + fh, z0, z1, 0.003, { nA: 2 });
  K.soft('blackMatte', xc - W / 2, xc - W / 2 + fw, yc - H / 2 + fh - 0.002, yc + H / 2 - fh + 0.002, z0, z1, 0.003, { nA: 2 }); K.soft('blackMatte', xc + W / 2 - fw, xc + W / 2, yc - H / 2 + fh - 0.002, yc + H / 2 - fh + 0.002, z0, z1, 0.003, { nA: 2 });
  K.g('c1Art', new THREE.PlaneGeometry(sw, sh).rotateY(Math.PI), xc, yc, zf, 0, 0, 0, { keepUV: true });
}

// ---------------------------------------------------------------- bureau de l'étage
// Bureau 120 × 64 dos à la cloison de la chambre 2 (nu x 8,07) : x 7,43 → 8,07, z 6,14 → 7,34 ; assis face à +x, son bout ouest à 10 cm
// de la façade du radiateur (mur ouest, Ramo 90 du plan x 7,12 → 8,02, saillie jusqu'à z 7,44). Poste centré sur le siège (z 6,65, décalé de 9 cm vers
// la gauche pour loger l'écran vertical) : MacBook Pro 16" ouvert, écran 32" juste au-dessus, écran 24" en portrait à droite (côté
// radiateur), tourné de 30° vers le siège, hauts des deux écrans alignés à 1,41 m du sol. Carnet et pot à crayons à gauche ;
// plus de caisson sous le plateau, ni de lampe d'architecte (sa place est prise par les écrans).
function bureau() {
  const e = C.E1, h = 0.74, zc = 6.74, zs = 6.65, K = new Kit('furn1', mtx(7.75, e, zc, Math.PI / 2)), sx = zc - zs; // x local = zc − z monde
  desk(K, 1.20, 0.64, h);
  macbook(new Kit('furn1', K.m(sx, h, -0.111))); // base à 8,5 cm du chant avant (z local −0,235 → 0,013)
  monitor(new Kit('furn1', K.m(sx, h, 0.17)), 0.708, 0.398, 0.25, 0.006, 0.016, 0.26, 0.20); // 32" : bas du cadre 6 mm au-dessus du haut de l'écran du MacBook
  monitor(new Kit('furn1', K.m(-0.425, h, 0.04, -Math.PI / 6)), 0.297, 0.527, 0.125, 0.007, 0.011, 0.20, 0.18); // 24" en portrait, z monde 7,03 → 7,30
  const px = 0.535, pz = 0.17; K.rod('mobPaint', [px, h, pz], [px, h + 0.10, pz], 0.035, 18, 0.035, { c: '#3f5e6e' });
  for (const [dx, dz, c] of [[-0.01, 0.0, '#d9a441'], [0.012, 0.008, '#1f2a36'], [0.0, -0.012, '#9b4a3c']]) K.rod('mobPaint', [px + dx, h + 0.05, pz + dz], [px + dx * 2.5, h + 0.18, pz + dz * 2.5], 0.004, 6, 0.004, { c });
  K.box('mobPaint', 0.31, 0.51, h, h + 0.012, -0.25, 0.03, { c: '#1f2a36' });
  aeron(7.32, zs, Math.PI / 2); // rangé sous le bureau face au MacBook, assise engagée de 13 cm, accoudoirs contre la ceinture du plateau
}
// MacBook Pro 16" gris sidéral (cotes Apple : 35,57 × 24,81 × 1,68 cm ; base 10,8 mm, écran 6 mm), ouvert à 110° ; dalle 34,5 × 22,3 cm à bordures
// fines et encoche, clavier noir, pavé tactile 16 × 9,9 cm. Repère : origine sur le plateau au centre de la base, écran tourné vers −z.
function macbook(K) {
  const w = 0.3557, d = 0.2481, tb = 0.0108, tl = 0.006, hw = w / 2, hd = d / 2;
  K.soft('c1SpaceGrey', -hw, hw, 0.0008, tb, -hd, hd, 0.004, { nA: 2 }); // base sur patins de 0,8 mm
  K.g('c1Keys', new THREE.PlaneGeometry(0.282, 0.108).rotateX(-Math.PI / 2).rotateY(Math.PI), 0, tb + 0.0002, hd - 0.015 - 0.054, 0, 0, 0, { keepUV: true });
  K.box('c1Track', -0.08, 0.08, tb, tb + 0.0003, -hd + 0.012, -hd + 0.111);
  const L = new Kit('furn1', K.m(0, tb - 0.002, hd - 0.003, 0, 0.35)); // écran incliné de 20° vers l'arrière, charnière au bord arrière de la base
  L.soft('c1SpaceGrey', -hw, hw, 0, d, 0, tl, 0.003, { nA: 2 });
  L.box('blackMatte', -hw + 0.002, hw - 0.002, 0.003, d - 0.002, -0.0004, 0.0001); // verre noir et bordures
  L.g('c1Screen', new THREE.PlaneGeometry(0.3446, 0.2234).rotateY(Math.PI), 0, 0.0185 + 0.1117, -0.0006, 0, 0, 0, { keepUV: true });
  L.box('blackMatte', -0.016, 0.016, d - 0.0105, d - 0.003, -0.0009, -0.0004); // encoche de la caméra
}
// Écran plat noir sur pied central. Repère : origine sur le plateau à l'aplomb de la face avant, dalle tournée vers −z.
// Dalle dw × dh à bords fins (s : côtés et haut, bb : bas), bas du cadre à yb du plateau ; coque arrière bombée, platine, colonne, embase bw × bd.
function monitor(K, dw, dh, yb, s, bb, bw, bd) {
  const W = dw + 2 * s, H = dh + s + bb, ym = yb + H / 2;
  K.soft('blackMatte', -W / 2, W / 2, yb, yb + H, 0, 0.012, 0.003, { nA: 1 }); // cadre et dos plat
  K.g('c1Screen', new THREE.PlaneGeometry(dw, dh).rotateY(Math.PI), 0, yb + bb + dh / 2, -0.0006, 0, 0, 0, { keepUV: true });
  K.soft('blackMatte', -W * 0.34, W * 0.34, ym - H * 0.33, ym + H * 0.33, 0.011, 0.04, 0.015, { nA: 2 }); // coque arrière
  K.box('blackMatte', -0.045, 0.045, ym - 0.05, ym + 0.04, 0.038, 0.054); // platine de fixation
  K.box('blackMatte', -0.03, 0.03, 0.012, ym + 0.04, 0.054, 0.076); // colonne
  K.soft('blackMatte', -bw / 2, bw / 2, 0, 0.012, 0.10 - bd, 0.10, 0.006, { nA: 1 }); // embase plate, débordant sous la dalle
}

// ---------------------------------------------------------------- canapé-lit (ouverture « rapido », matelas 140 × 190 en trois panneaux de 13 cm)
// Le long de la cloison du palier (nu z 4,24), x 5,11 → 6,95 (hors débattement de la porte, x 7,25 → 7,98), profondeur fermé 83 cm
// (z 4,24 → 5,07) : dossier mince de 6,5 cm, coussins de dos de 9 cm, assise d'un panneau (63 cm), traverse avant de 3,5 cm.
// Repère local : x le long du mur (centre du canapé), z depuis le mur vers la pièce, y depuis le sol. Fermé : P1 (tête) en bas, P2 retourné
// dessus (charnière avant), P3 au-dessus (charnière arrière) dont la face haute est l'assise. Au clic : le pliage remonte de 26 cm
// (P1 à hauteur d'assise), P2 bascule vers l'avant de 180° autour de la charnière avant en portant P3 qui reste à plat, puis les pieds se déplient.
// Ouvert : couchage 140 × 190 à 47 cm du sol, x 5,33 → 6,73, z 4,40 → 6,30 (le fauteuil du bureau reste à côté, x ≥ 6,97).
function canape() {
  const e = C.E1, xc = 6.03, zw = 4.24, fab = { c: '#c4c2bd' }, t = 0.13, Lp = 1.90 / 3, za = 0.16, zb = za + Lp, zf = 0.83, yb = 0.08, lift = 0.26, hl = yb + lift - 0.015;
  const root = new THREE.Group(); root.name = 'canapé-lit'; root.position.set(xc, e, zw); C.groups.furn1.add(root);
  const item = { g: root, meshes: [], open: 0, target: 0, speed: 0.35, kind: 'canape' };
  // structure fixe : accoudoirs, dossier et coussins de dos (en arrière du panneau P1 : z < za), traverse avant, fonds, pieds
  const s0 = sinkTo(), K = new Kit('furn1', null, s0);
  for (const sx of [-1, 1]) K.soft('mobFab', sx > 0 ? 0.72 : -0.92, sx > 0 ? 0.92 : -0.72, 0.05, 0.62, 0, zf, 0.05, { nA: 2, nI: [1, 3, 3], c: fab.c });
  K.soft('mobFab', -0.72, 0.72, 0.05, 0.70, 0, 0.065, 0.025, { nA: 2, nI: [4, 2, 1], c: fab.c });
  K.box('mobFab', -0.72, 0.72, 0.05, 0.46, 0.06, za - 0.005, fab); K.box('mobFab', -0.72, 0.72, 0.05, 0.07, za - 0.005, zb + 0.002, fab);
  for (const [a, b] of [[-0.715, -0.005], [0.005, 0.715]]) K.soft('mobFab', a, b, 0.47, 0.85, 0.055, 0.145, 0.04, { nA: 2, nI: [4, 3, 1], def: puff(0.12, 'z'), rx: -0.06, c: fab.c });
  K.soft('mobFab', -0.72, 0.72, 0.05, 0.335, zb + 0.002, zf, 0.012, { nA: 2, nI: [4, 1, 1], c: fab.c });
  for (const x of [-0.86, 0.86]) for (const z of [0.07, zf - 0.075]) K.rod('blackMatte', [x, 0, z], [x, 0.05, z], 0.016, 10, 0.02);
  meshesOf(s0, root, item.meshes);
  // pièces mobiles : G1 (relevage) ⊃ P1, G2 (charnière avant P1/P2) ⊃ P2, L2 (pieds), G3 (charnière arrière P2/P3) ⊃ P3, L3 (pieds)
  const G1 = new THREE.Group(), G2 = new THREE.Group(), G3 = new THREE.Group(), L2 = new THREE.Group(), L3 = new THREE.Group();
  root.add(G1); G1.add(G2); G2.add(G3); G2.add(L2); G3.add(L3);
  G2.position.set(0, yb + t, zb); G3.position.set(0, t, -Lp); L2.position.set(0, t + 0.015, -Lp + 0.05); L3.position.set(0, -0.015, Lp - 0.05);
  const pg = softBox(1.40, t, Lp - 0.004, 0.035, { nA: 2, nI: [6, 1, 4], def: puff(0.05) });
  const part = (g, fill) => { const s = sinkTo(); fill(new Kit('furn1', null, s)); meshesOf(s, g, item.meshes); };
  part(G1, k => k.g('mobFab', pg, 0, yb + t / 2, za + Lp / 2, 0, 0, 0, fab));
  part(G2, k => k.g('mobFab', pg, 0, t / 2, -Lp / 2, 0, 0, 0, fab));
  part(G3, k => k.g('mobFab', pg, 0, t / 2, Lp / 2, 0, 0, 0, fab));
  // pieds tubulaires noirs repliés à plat sous leur panneau (cachés dans le pliage quand le canapé est fermé)
  const legs = (k, dir) => { for (const x of [-0.6, 0.6]) { k.rod('blackMatte', [x, 0, 0], [x, dir * hl, 0], 0.011, 8); k.g('blackMatte', new THREE.CylinderGeometry(0.016, 0.016, 0.012, 10), x, dir * (hl - 0.006), 0); } k.rod('blackMatte', [-0.6, 0, 0], [0.6, 0, 0], 0.008, 8); };
  part(L2, k => legs(k, 1)); part(L3, k => legs(k, -1));
  item.apply = v => {
    const s1 = ez(v / 0.3), s2 = ez((v - 0.22) / 0.6), s3 = ez((v - 0.78) / 0.22);
    G1.position.y = lift * s1; G2.rotation.x = Math.PI * s2; G3.rotation.x = -Math.PI * s2; L2.rotation.x = L3.rotation.x = Math.PI / 2 * (1 - s3);
  };
  item.apply(0);
  for (const m of item.meshes) m.userData.door = item;
  C.DOORS.push(item);
}

// ---------------------------------------------------------------- rangement du bureau
// Étagère à casiers façon Ikea Kallax 2 × 4 debout (77 × 147,6, profondeur 39) en chêne clair, contre la façade ouest (nu z 7,54) dans l'angle
// libre avec la cloison de la chambre 3 (nu x 5,09) : x 5,10 → 5,87, z 7,14 → 7,53. Elle s'arrête à 8 cm du tableau de la fenêtre (x 5,95,
// vantail ouvert à 85° dégagé) et reste loin du canapé ouvert (z ≤ 6,30). Cadre de 40 mm, montant et tablettes de 16 mm, casiers de 33,7 cm,
// dos ouvert ; quatre boîtes en toile et quelques livres. Repère : origine au sol à l'angle avant gauche (x 5,10, z 7,14), z vers le mur.
function rangement() {
  const K = new Kit('furn1', mtx(5.10, C.E1, 7.14)), W = 0.77, D = 0.39, o = 0.04, t = 0.016, c = 0.337, H = 2 * o + 4 * c + 3 * t;
  // joues et montant central : fil du bois vertical (UV en mètres, u suivant la hauteur sur les faces verticales ; repère sans rotation)
  const vert = (x0, x1, y0, y1) => { const g = boxG(x1 - x0, y1 - y0, D).translate((x0 + x1) / 2, (y0 + y1) / 2, D / 2), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i), -p.getZ(i)); else uv.setXY(i, p.getY(i), Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i));
    K.p('mobOak', g, K.F, { keepUV: true }); };
  vert(0, o, 0, H); vert(W - o, W, 0, H); // joues
  K.box('mobOak', o, W - o, H - o, H, 0, D); K.box('mobOak', o, W - o, 0, o, 0, D); // dessus et socle
  vert(o + c, o + c + t, o, H - o); // montant central
  for (let i = 1; i < 4; i++) { const y = o + i * c + (i - 1) * t; K.box('mobOak', o, W - o, y, y + t, 0, D); } // tablettes
  const cell = (i, j) => [o + i * (c + t), o + j * (c + t)]; // coin bas gauche du casier (colonne i, rangée j depuis le bas)
  // boîte en toile 33 × 33 × 37 à poignée découpée, affleurant la face avant
  const boite = (i, j, col) => { const [x, y] = cell(i, j); K.soft('mobFab', x + 0.004, x + c - 0.004, y, y + c - 0.006, 0.006, D - 0.012, 0.008, { nA: 1, c: col });
    K.box('mobPaint', x + c / 2 - 0.045, x + c / 2 + 0.045, y + c - 0.08, y + c - 0.055, 0.003, 0.0065, { c: '#34332f' }); };
  // livres debout, dos vers la pièce : [épaisseur, hauteur, profondeur, couleur] ; lean : dernier livre penché contre les autres
  const livres = (i, j, L, lean) => { let [x, y] = cell(i, j); x += 0.012;
    L.forEach(([e, h, p, col], k) => { const a = lean && k === L.length - 1 ? 0.32 : 0, sa = Math.sin(a), ca = Math.cos(a); // penché : coin haut gauche contre le livre précédent
      K.g('mobPaint', boxG(e, h, p), x + h / 2 * sa + e / 2 * ca, y + h / 2 * ca + e / 2 * sa, 0.02 + p / 2, 0, 0, a, { c: col }); x += e + 0.001; }); };
  boite(0, 0, '#8e8b85'); boite(1, 0, '#8e8b85'); boite(1, 1, '#cfc5b2'); boite(0, 2, '#cfc5b2');
  livres(0, 1, [[0.032, 0.285, 0.21, '#2f3e46'], [0.024, 0.27, 0.20, '#c9b88f'], [0.04, 0.29, 0.22, '#e3ddd0'], [0.02, 0.24, 0.17, '#4f5d4a'], [0.028, 0.26, 0.19, '#a8573f'],
    [0.035, 0.25, 0.18, '#1f2a36'], [0.022, 0.235, 0.16, '#b9a27a'], [0.03, 0.28, 0.21, '#6b4f3a']]);
  { const [x, y] = cell(1, 2); let yy = y; for (const [w, h, p, col] of [[0.27, 0.035, 0.21, '#e3ddd0'], [0.25, 0.028, 0.19, '#2f3e46'], [0.235, 0.03, 0.17, '#a8573f']]) {
    K.box('mobPaint', x + 0.04, x + 0.04 + w, yy, yy + h, 0.03, 0.03 + p, { c: col }); yy += h; } } // pile couchée
  livres(0, 3, [[0.03, 0.25, 0.18, '#4f5d4a'], [0.026, 0.27, 0.20, '#e3ddd0'], [0.034, 0.24, 0.17, '#1f2a36'], [0.022, 0.26, 0.19, '#c9b88f'], [0.03, 0.235, 0.17, '#8a8f94']], true);
}

export function buildChambre1(ctx) {
  C = ctx; M = ctx.M; BK.clear();
  materials(); chambre1(); valet(); bureau(); canape(); rangement();
  flush();
}
