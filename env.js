// Environnement (voisinage, rues, arbres) : appelé avant A.build(groups)
// D'après les 11 photos de chantier (sept.–oct. 2026) et la vue aérienne : maison de maître à l'est (terrain +0,85), mur de soutènement
// en limite est, maison R+C au nord, maisons en face (rue des Merlettes à l'ouest, rue des Fauvettes au sud), lampadaires. Volumes indicatifs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let C; // contexte de la maquette (main.js)
const RAD = Math.PI / 180;
const V3 = a => new THREE.Vector3(a[0], a[1], a[2]);
const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

// ---------------------------------------------------------------- faces inclinées (toitures, lucarnes) : UV en mètres, alignées sur la pente
const RF = new Map();
function rface(layer, mat, pts, hint) {
  const a = V3(pts[0]), b = V3(pts[1]), c = V3(pts[2]);
  const n = b.clone().sub(a).cross(c.clone().sub(a));
  if (hint && n.dot(V3(hint)) < 0) { pts = [...pts].reverse(); n.negate(); }
  n.normalize();
  const h = new THREE.Vector3(0, 1, 0).cross(n); if (h.lengthSq() < 1e-6) h.set(1, 0, 0); h.normalize();
  const s = n.clone().cross(h); // s : vers le haut de la pente
  const k = layer + '|' + mat; let bk = RF.get(k); if (!bk) { bk = { layer, mat, pos: [], nor: [], uv: [] }; RF.set(k, bk); }
  const P = pts.map(V3);
  for (let i = 1; i < P.length - 1; i++) for (const q of [P[0], P[i], P[i + 1]]) { bk.pos.push(q.x, q.y, q.z); bk.nor.push(n.x, n.y, n.z); bk.uv.push(q.dot(h), q.dot(s)); }
}
function flushFaces() {
  for (const b of RF.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    const m = new THREE.Mesh(g, C.M[b.mat]); m.castShadow = m.receiveShadow = true; C.groups[b.layer].add(m);
  }
  RF.clear();
}
// toiture 4 pans quelconque (faîtage selon le plus grand côté), égout ye au nu extérieur du débord ; sous-face plate optionnelle
function hip(layer, mat, x0, x1, z0, z1, ye, pitch, soffit) {
  const t = Math.tan(pitch * RAD), lx = x1 - x0, lz = z1 - z0; let r;
  if (lx >= lz) {
    const run = lz / 2, yr = ye + run * t, zr = (z0 + z1) / 2, r0 = x0 + run, r1 = x1 - run;
    rface(layer, mat, [[x0, ye, z0], [x1, ye, z0], [r1, yr, zr], [r0, yr, zr]], [0, 1, -1]);
    rface(layer, mat, [[x1, ye, z1], [x0, ye, z1], [r0, yr, zr], [r1, yr, zr]], [0, 1, 1]);
    rface(layer, mat, [[x0, ye, z1], [x0, ye, z0], [r0, yr, zr]], [-1, 1, 0]);
    rface(layer, mat, [[x1, ye, z0], [x1, ye, z1], [r1, yr, zr]], [1, 1, 0]);
    r = { yr, a: [r0, zr], b: [r1, zr] };
  } else {
    const run = lx / 2, yr = ye + run * t, xr = (x0 + x1) / 2, r0 = z0 + run, r1 = z1 - run;
    rface(layer, mat, [[x0, ye, z0], [x0, ye, z1], [xr, yr, r1], [xr, yr, r0]], [-1, 1, 0]);
    rface(layer, mat, [[x1, ye, z1], [x1, ye, z0], [xr, yr, r0], [xr, yr, r1]], [1, 1, 0]);
    rface(layer, mat, [[x0, ye, z0], [x1, ye, z0], [xr, yr, r0]], [0, 1, -1]);
    rface(layer, mat, [[x1, ye, z1], [x0, ye, z1], [xr, yr, r1]], [0, 1, 1]);
    r = { yr, a: [xr, r0], b: [xr, r1] };
  }
  if (soffit) C.A.quadN(layer, soffit, [[x0, ye, z0], [x1, ye, z0], [x1, ye, z1], [x0, ye, z1]], [0, -1, 0]);
  return r;
}
// toiture 2 pans (faîtage selon X si alongX), pignons dans le matériau des murs, sous-face des débords
function gable(layer, mat, wmat, x0, x1, z0, z1, yw, pitch, alongX, ov) {
  const t = Math.tan(pitch * RAD), ye = yw - ov * t, A = C.A;
  if (alongX) {
    const zr = (z0 + z1) / 2, yr = yw + (z1 - z0) / 2 * t;
    for (const [ze, sg] of [[z0 - ov, -1], [z1 + ov, 1]]) {
      const p = [[x0 - ov, ye, ze], [x1 + ov, ye, ze], [x1 + ov, yr, zr], [x0 - ov, yr, zr]];
      rface(layer, mat, p, [0, 1, sg]); rface(layer, 'envSoffit', p, [0, -1, -sg]);
    }
    A.polyN(layer, wmat, [[x0, yw, z0], [x0, yw, z1], [x0, yr, zr]], [-1, 0, 0]); A.polyN(layer, wmat, [[x1, yw, z0], [x1, yw, z1], [x1, yr, zr]], [1, 0, 0]);
    return { yr, a: [x0 - ov, zr], b: [x1 + ov, zr] };
  }
  const xr = (x0 + x1) / 2, yr = yw + (x1 - x0) / 2 * t;
  for (const [xe, sg] of [[x0 - ov, -1], [x1 + ov, 1]]) {
    const p = [[xe, ye, z0 - ov], [xe, ye, z1 + ov], [xr, yr, z1 + ov], [xr, yr, z0 - ov]];
    rface(layer, mat, p, [sg, 1, 0]); rface(layer, 'envSoffit', p, [-sg, -1, 0]);
  }
  A.polyN(layer, wmat, [[x0, yw, z0], [x1, yw, z0], [xr, yr, z0]], [0, 0, -1]); A.polyN(layer, wmat, [[x0, yw, z1], [x1, yw, z1], [xr, yr, z1]], [0, 0, 1]);
  return { yr, a: [xr, z0 - ov], b: [xr, z1 + ov] };
}
// faîtage en tuiles (prisme le long de la ligne de faîtage)
function ridge(mat, r, w = 0.2) { C.sbox('site', mat, r.a, r.b, -w / 2, w / 2, r.yr - 0.06, r.yr - 0.06, 0.13); }

// repère local d'un volume rectangulaire : face S (+X), N (−X), W (+Z), E (−Z) ; a le long de la face, d en saillie vers l'extérieur
function faces(x0, x1, z0, z1, layer = 'site') {
  const F = { S: { ax: 'x', w: x1, s: 1 }, N: { ax: 'x', w: x0, s: -1 }, W: { ax: 'z', w: z1, s: 1 }, E: { ax: 'z', w: z0, s: -1 } };
  const P = (f, a, y, d) => { const q = F[f], w = q.w + q.s * d; return q.ax === 'x' ? [w, y, a] : [a, y, w]; };
  const fb = (f, a0, a1, y0, y1, d0, d1, m) => { const q = F[f], w0 = q.w + q.s * d0, w1 = q.w + q.s * d1; if (q.ax === 'x') C.A.box(layer, w0, w1, y0, y1, a0, a1, m); else C.A.box(layer, a0, a1, y0, y1, w0, w1, m); };
  const nr = f => F[f].ax === 'x' ? [F[f].s, 0, 0] : [0, 0, F[f].s];
  const av = f => F[f].ax === 'x' ? [0, 0, 1] : [1, 0, 0];
  const ring = (f, m, ac, yc, d, r0, r1, n = 18) => { for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, b = (i + 1) / n * 2 * Math.PI; C.A.quadN(layer, m, [P(f, ac + r0 * Math.cos(a), yc + r0 * Math.sin(a), d), P(f, ac + r1 * Math.cos(a), yc + r1 * Math.sin(a), d), P(f, ac + r1 * Math.cos(b), yc + r1 * Math.sin(b), d), P(f, ac + r0 * Math.cos(b), yc + r0 * Math.sin(b), d)], nr(f)); } };
  const disc = (f, m, ac, yc, d, r, n = 18, a0 = 0, a1 = 2 * Math.PI) => { const pts = []; const full = a1 - a0 > 6.2; for (let i = 0; i < (full ? n : n + 1); i++) { const a = a0 + (a1 - a0) * i / n; pts.push(P(f, ac + r * Math.cos(a), yc + r * Math.sin(a), d)); } C.A.polyN(layer, m, pts, nr(f)); };
  return { F, P, fb, nr, av, ring, disc };
}
const groundMinMax = (x0, x1, z0, z1) => { const h = [[x0, z0], [x0, z1], [x1, z0], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]].map(p => C.hAt(p[0], p[1])); return [Math.min(...h), Math.max(...h)]; };

// ---------------------------------------------------------------- textures et matériaux
function buildMaterials() {
  const { makeTex, pixelNoise, rng, std, M, TEX } = C;
  const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
  // béton banché vieilli du mur de soutènement : coulures sous l'arase, taches de mousse, joint de reprise, trous de banche
  const wallC = makeTex(512, 2.4, (g, s) => {
    pixelNoise(g, s, '#a9a79f', 0.05, 0.10, 5, 301); const r = rng(302);
    for (let i = 0; i < 90; i++) { const x = r() * s, w = 2 + r() * 12, y0 = r() * s * 0.5, l = s * (0.2 + r() * 0.6); const grd = g.createLinearGradient(0, y0, 0, y0 + l); const k = 0.06 + r() * 0.10; grd.addColorStop(0, `rgba(58,60,52,${k})`); grd.addColorStop(1, 'rgba(58,60,52,0)'); g.fillStyle = grd; g.fillRect(x, y0, w, l); }
    for (let i = 0; i < 45; i++) { g.fillStyle = `rgba(${70 + r() * 30},${82 + r() * 30},50,${0.08 + r() * 0.1})`; g.beginPath(); g.ellipse(r() * s, s * (0.55 + r() * 0.45), 4 + r() * 22, 3 + r() * 10, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(55,55,50,0.35)'; g.fillRect(s * 0.5, 0, 2, s); g.fillRect(0, s * 0.42, s, 1);
    for (const yy of [0.2, 0.7]) for (const xx of [0.12, 0.62]) { g.fillStyle = 'rgba(45,45,40,0.55)'; g.beginPath(); g.arc(xx * s, yy * s, 3.5, 0, 7); g.fill(); }
  });
  // tuiles (plates ou mécaniques) : rangs ombrés, teinte variable
  const tiles = (base, rows, cols, seed, moss) => makeTex(512, 1.0, (g, s) => {
    const r = rng(seed), [R, G, B] = rgbOf(base); g.fillStyle = rgb(R * 0.4, G * 0.4, B * 0.4); g.fillRect(0, 0, s, s);
    const th = s / rows, tw = s / cols;
    for (let j = 0; j < rows; j++) { const off = (j % 2) * tw / 2; for (let i = -1; i <= cols; i++) {
      const x = i * tw + off, y = j * th, f = 0.78 + r() * 0.34, m = r() < moss ? 0.25 : 0;
      const c = k => rgb((R * (1 - m) + 95 * m) * f * k, (G * (1 - m) + 100 * m) * f * k, (B * (1 - m) + 70 * m) * f * k);
      const grd = g.createLinearGradient(0, y, 0, y + th); grd.addColorStop(0, c(0.72)); grd.addColorStop(0.25, c(0.95)); grd.addColorStop(0.9, c(1.05)); grd.addColorStop(1, c(0.55));
      g.fillStyle = grd; g.fillRect(x + 1.5, y + 1, tw - 3, th - 2);
    } }
    const img = g.getImageData(0, 0, s, s), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
  });
  // ardoises du brisis et du terrasson (10 rangs par 1,20 m)
  const slate = makeTex(512, 1.2, (g, s) => {
    const r = rng(311); g.fillStyle = '#202328'; g.fillRect(0, 0, s, s); const rows = 10, cols = 6, th = s / rows, tw = s / cols;
    for (let j = 0; j < rows; j++) { const off = (j % 2) * tw / 2; for (let i = -1; i <= cols; i++) {
      const l = 0.85 + r() * 0.3, x = i * tw + off, y = j * th; const grd = g.createLinearGradient(0, y, 0, y + th);
      grd.addColorStop(0, rgb(48 * l, 50 * l, 53 * l)); grd.addColorStop(0.85, rgb(64 * l, 66 * l, 70 * l)); grd.addColorStop(1, rgb(34 * l, 35 * l, 38 * l));
      g.fillStyle = grd; g.fillRect(x + 1, y + 0.5, tw - 2, th - 1.5);
    } }
  });
  const stone = makeTex(256, 1.0, (g, s) => pixelNoise(g, s, '#ddd3be', 0.05, 0.06, 5, 321, (f, r) => r() < 0.02 ? f * 0.94 : f));
  // persiennes blanches (lames de 5 cm)
  const louvre = makeTex(64, 0.2, (g, s) => { g.fillStyle = '#f3f2ee'; g.fillRect(0, 0, s, s); for (let i = 0; i < 4; i++) { const y = i * s / 4; g.fillStyle = 'rgba(105,105,100,0.6)'; g.fillRect(0, y, s, 3); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(0, y + 3, s, 2); } });
  // clôture en plaques de béton (plaques de 2,00 × 0,50 entre poteaux)
  const plate = makeTex(256, 2.0, (g, s) => {
    pixelNoise(g, s, '#a29f97', 0.06, 0.08, 5, 331); const r = rng(332);
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(55,55,50,0.5)'; g.fillRect(0, k * s / 4, s, 2); g.fillStyle = 'rgba(255,255,250,0.18)'; g.fillRect(0, k * s / 4 + 2, s, 2); }
    g.fillStyle = 'rgba(70,70,65,0.35)'; g.fillRect(0, 0, 13, s);
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(60,62,55,${0.05 + r() * 0.08})`; g.fillRect(r() * s, r() * s, 3 + r() * 8, 10 + r() * 40); }
  });
  // balustres en pierre (silhouette avec transparence, 1 balustre tous les 20 cm, 62 cm de haut)
  const bal = makeTex(64, 0.2, (g, s, W, Hh) => {
    g.clearRect(0, 0, W, Hh);
    for (let y = 0; y < Hh; y++) {
      const t = y / Hh; let w;
      if (t < 0.07) w = 0.46; else if (t < 0.12) w = 0.22; else if (t < 0.86) w = 0.13 + 0.25 * Math.exp(-(((t - 0.63) / 0.17) ** 2)) + 0.05 * Math.exp(-(((t - 0.2) / 0.05) ** 2)); else if (t < 0.92) w = 0.22; else w = 0.46;
      const x0 = W / 2 - w * W, x1 = W / 2 + w * W; const grd = g.createLinearGradient(x0, 0, x1, 0);
      grd.addColorStop(0, '#9f998c'); grd.addColorStop(0.35, '#f4f0e6'); grd.addColorStop(0.6, '#ece6da'); grd.addColorStop(1, '#a8a294');
      g.fillStyle = grd; g.fillRect(x0, y, x1 - x0, 1);
    }
  }, { w: 64, h: 256, metersV: 0.62 });
  bal.wrapT = THREE.ClampToEdgeWrapping;
  M.envWallC = std({ map: wallC, roughness: 0.95 });
  M.envSlate = std({ map: slate, roughness: 0.68 });
  M.envTileB = std({ map: tiles('#6f4233', 3, 5, 341, 0.12), roughness: 0.85 });
  M.envTileB2 = std({ map: tiles('#7b4e37', 3, 5, 343, 0.06), roughness: 0.85 });
  M.envTileR = std({ map: tiles('#ad553a', 3, 5, 342, 0.03), roughness: 0.8 });
  M.envManor = std({ map: TEX.lisse, color: '#f2f1ec', roughness: 0.9 });
  M.envStone = std({ map: stone, color: '#f1ece2', roughness: 0.85 });
  M.envQuoin = std({ map: stone, color: '#e4d1aa', roughness: 0.9 });
  M.envBase = std({ map: TEX.lisse, color: '#e6e2d8', roughness: 0.95 });
  M.envShutter = std({ map: louvre, roughness: 0.6 });
  M.envGlass = std({ color: '#262c32', roughness: 0.12, metalness: 0.4 });
  M.envLantern = std({ color: '#efe6cc', roughness: 0.3, emissive: '#fff0c8', emissiveIntensity: 0.15 });
  M.envCream = std({ map: TEX.lisse, color: '#efe3c9', roughness: 0.95 });
  M.envPeach = std({ map: TEX.lisse, color: '#f0d4bd', roughness: 0.95 });
  M.envSoffit = std({ color: '#d9d3c6', roughness: 0.9 });
  M.envPlate = std({ map: plate, roughness: 0.95 });
  M.envPlateL = std({ map: plate, color: '#f1efe9', roughness: 0.95 });
  M.envGazebo = std({ color: '#2e3135', roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide });
  M.envBal = std({ map: bal, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  M.envWood = std({ color: '#5c3b2a', roughness: 0.7 });
  M.envZinc = std({ color: '#8f9498', roughness: 0.45, metalness: 0.5 });
  M.envTerrace = std({ map: TEX.concrete, color: '#e6dfd0', roughness: 0.85 });
  M.envPole = std({ color: '#1a1b1d', roughness: 0.4, metalness: 0.55 });
  M.envLampDiff = std({ color: '#f4f1e8', roughness: 0.3, emissive: '#fff2d2', emissiveIntensity: 0.25 });
  M.envDish = std({ color: '#dcdcd8', roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide });
  return bal;
}

// ---------------------------------------------------------------- arbres (couronnes fusionnées, peu de triangles)
const TREES = { crowns: [], trunks: [] };
function blob(x, y, z, rad, sx, sy, col, r) {
  const geo = new THREE.IcosahedronGeometry(rad, 1), pp = geo.attributes.position;
  for (let k = 0; k < pp.count; k++) { const f = 0.85 + r() * 0.3; pp.setXYZ(k, pp.getX(k) * f * sx, pp.getY(k) * f * sy, pp.getZ(k) * f * sx); }
  geo.translate(x, y, z); geo.computeVertexNormals();
  const cols = []; for (let k = 0; k < pp.count; k++) cols.push(col.r, col.g, col.b);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); TREES.crowns.push(geo);
}
function trunk(x, y, z, r0, r1, h) { const g = new THREE.CylinderGeometry(r0, r1, h, 7); g.translate(x, y + h / 2, z); TREES.trunks.push(g); }
// feuillu : fût, houppier de n boules ; o : rayon, hauteur de fût, teinte, saturation, clarté
function leafy(x, z, s, o = {}) {
  const y = C.hAt(x, z), r = C.rng(Math.floor(x * 131 + z * 17 + 911));
  const th = (o.trunk ?? 1.7) * s, R = (o.r ?? 1.9) * s, H = o.h ?? 0.9, n = o.n ?? 36;
  trunk(x, y - 0.2, z, 0.08 * s, 0.18 * s, th + R * 0.9);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * 2 * Math.PI, rr = Math.cbrt(r()) * R, sq = Math.sqrt(1 - u * u);
    const col = new THREE.Color().setHSL((o.hue ?? 0.25) + r() * 0.04, o.sat ?? 0.42, (o.light ?? 0.26) + r() * 0.09);
    blob(x + Math.cos(a) * sq * rr, y + th + R * H + u * rr * H, z + Math.sin(a) * sq * rr, (0.55 + r() * 0.4) * s * (o.blob ?? 1), 1, 1, col, r);
  }
}
// cèdre : étages de branches horizontales, bleu-vert sombre
function cedar(x, z, s) {
  const y = C.hAt(x, z), r = C.rng(Math.floor(x * 31 + z * 7 + 5));
  trunk(x, y - 0.2, z, 0.18 * s, 0.42 * s, 13 * s);
  for (let k = 0; k < 7; k++) {
    const yk = y + (2.6 + k * 1.6) * s, rk = (4.8 - k * 0.62) * s, m = 13 - k;
    for (let i = 0; i < m; i++) {
      const a = r() * 2 * Math.PI, rr = (0.25 + 0.75 * Math.sqrt(r())) * rk, col = new THREE.Color().setHSL(0.38 + r() * 0.05, 0.2, 0.11 + r() * 0.05);
      blob(x + Math.cos(a) * rr * 0.75, yk + (r() - 0.5) * 0.6 * s, z + Math.sin(a) * rr * 0.75, (1.0 + r() * 0.7) * s, 1.55, 0.5, col, r);
    }
  }
  for (let i = 0; i < 3; i++) blob(x + (r() - 0.5) * s, y + 13.6 * s + i * 0.5 * s, z + (r() - 0.5) * s, 0.8 * s, 1, 0.8, new THREE.Color().setHSL(0.37, 0.22, 0.15), r);
}
function flushTrees() {
  const { M, groups } = C;
  if (TREES.crowns.length) { const m = new THREE.Mesh(mergeGeometries(TREES.crowns), M.foliage); m.castShadow = m.receiveShadow = true; groups.site.add(m); }
  if (TREES.trunks.length) { const m = new THREE.Mesh(mergeGeometries(TREES.trunks), M.trunk); m.castShadow = true; groups.site.add(m); }
  TREES.crowns.length = TREES.trunks.length = 0;
}

// ---------------------------------------------------------------- fosse de l'allée du garage en sous-sol du voisin est (photos 1, 11, 16, vue aérienne)
// tranchée de 2,60 m entre le mur de limite (nu −0,25) et un mur de soutènement (nu −2,85), fond à −1,40 devant la porte du garage
// (sous l'aile ouest de la terrasse, renfoncement rx0..rx1), rampe montant vers le nord jusqu'à la pelouse (+1,13) en x0 ; au sud, l'allée
// s'arrête au garage : mur de soutènement en travers en x1 (façade sud x −9,2), puis jardin en pente douce jusqu'au pilier C (client, 12/10)
// fonction pure (sans contexte) appelée par hAt0 dans main.js ; m > 0 : abaissement large du maillage grossier du sol
const PIT = { x0: -24.4, xr: -13.2, x1: -9.1, z0: -3.1, z1: -0.1, zW: -0.25, zE: -2.85, y: -1.4, yn: 1.13, rx0: -12.65, rx1: -9.15, rz0: -4.45 };
const pitFloor = x => PIT.y + (PIT.yn - PIT.y) * Math.max(0, Math.min(1, (PIT.xr - x) / (PIT.xr - PIT.x0)));
const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// jardin au sud du mur en travers : pelouse abaissée vers l'angle C (0,42 m sous le profil d'origine le long de la limite, nul au nord de x 8 et vers z −10),
// mur de limite à découvert côté voisin entre le pilier du milieu et C (photo du client) ; arase du mur et muret sud gardés sur le profil d'origine
const gDrop = (x, z) => 0.42 * sm(8, 19.2, x) * (1 - sm(-1, -10, z)) * (1 - sm(19.0, 19.3, x));
export function envGround(x, z, h, m = 0) {
  const P = PIT, inT = x > P.x0 - m && x < P.x1 + m && z > P.z0 - m && z < P.z1 + m, inR = x > P.rx0 - m && x < P.rx1 + m && z > P.rz0 - m && z < P.z1;
  if (inT || inR) return m ? Math.min(h, P.y) : pitFloor(x);
  if (m || x < P.x1 || z > -0.1) return h;
  // sommet de la rampe de rehausse de main.js (z −0,18 → −0,40) ramené dans l'épaisseur du mur de limite : pas de rigole le long du nu côté voisin
  return h - gDrop(x, z) + (z > -0.4 ? 0.85 * (1 - sm(-0.18, -0.4, z)) * (1 - sm(19.0, 19.3, x)) : 0);
}

// ---------------------------------------------------------------- limite est : mur de soutènement continu en béton, grillage vert, 3 piliers
// mur et grillage sans interruption de l'angle B jusqu'à l'angle C, y compris derrière la maison (photos 1, 2, 15) ; au nord de B le mur borde
// encore la fosse ; 3 piliers (client, 12/10) : au droit de l'angle nord-est de la maison (x 0, plus gros, chapeau arrondi), au milieu (x 10,5,
// chapeau plat mouluré), d'angle de 2 m en C (photos 2, 11) ; sur la rue au sud : muret, grillage vert jusqu'à l'angle de la rue en z −7,62 (photos 9, 11, photo du client)
function eastBoundary() {
  const { A, hAt, BND } = C, xC = BND.C[0], xB = -11.62, xS = 19.13, xT = PIT.x1 - 0.12, xP = [0, 10.5]; // nu nord du mur en travers, piliers
  const zf = 0, zb = PIT.zW, zp = -0.12; // nu côté jardin, nu côté voisin (fosse puis jardin), axe du grillage
  const lawn = x => { const a = Math.min(x, 18.9), z = x > -12.8 && x < -9 ? -4.6 : -3.4; return hAt(a, z) + gDrop(a, z); }; // pelouse du voisin hors fosse (profil d'origine)
  const top = x => lawn(x) + 0.08, bot = x => Math.min(hAt(x, 0.15), x < PIT.x1 ? pitFloor(x) : hAt(x, -0.5)) - 0.3;
  for (const [x0, x1, grill] of [[PIT.x0, xB, false], [xB, xT, true], [xT, xC, true]]) {
    const n = Math.ceil((x1 - x0) / 0.8), xs = Array.from({ length: n + 1 }, (_, i) => x0 + (x1 - x0) * i / n);
    for (let i = 0; i < n; i++) {
      const a = xs[i], b = xs[i + 1], ta = top(a), tb = top(b), ba = bot(a), bb = bot(b);
      A.quadN('fence', 'envWallC', [[a, ba, zf], [b, bb, zf], [b, tb, zf], [a, ta, zf]], [0, 0, 1]);
      A.quadN('fence', 'envWallC', [[a, ba, zb], [b, bb, zb], [b, tb, zb], [a, ta, zb]], [0, 0, -1]);
      A.quadN('fence', 'envWallC', [[a, ta, zb], [b, tb, zb], [b, tb, zf + 0.02], [a, ta, zf + 0.02]], [0, 1, 0]);
      A.quadN('fence', 'envWallC', [[a, ta - 0.06, zf + 0.02], [b, tb - 0.06, zf + 0.02], [b, tb, zf + 0.02], [a, ta, zf + 0.02]], [0, 0, 1]); // arase légèrement débordante
      if (grill) A.quadN('fence', 'mesh', [[a, ta + 0.04, zp], [b, tb + 0.04, zp], [b, tb + 1.0, zp], [a, ta + 1.0, zp]], [0, 0, 1]); // grillage vert foncé ≈ 1,00 m (photos 2 et 9 : tête un peu sous le pilier d'angle)
    }
    if (!grill) { const t = top(x0), b0 = bot(x0); A.quadN('fence', 'envWallC', [[x0, b0, zb], [x0, b0, zf + 0.02], [x0, t, zf + 0.02], [x0, t, zb]], [-1, 0, 0]); continue; }
    // poteaux fins tous les 2,5 m environ (sauf au droit des piliers), fil de tension en tête
    const np = Math.ceil((x1 - x0) / 2.5);
    for (let i = x0 > xB ? 1 : 0; i <= np; i++) { const x = x0 + (x1 - x0) * i / np; if (xP.some(p => Math.abs(x - p) < 0.45) || x > xC - 0.5) continue; const t = top(x); A.box('fence', x - 0.02, x + 0.02, t, t + 1.03, zp - 0.02, zp + 0.02, 'meshPost'); }
    for (let i = 0; i < n; i++) C.sbox('fence', 'meshPost', [xs[i], zp], [xs[i + 1], zp], -0.006, 0.006, top(xs[i]) + 0.98, top(xs[i + 1]) + 0.98, 0.012);
  }
  // piliers côté voisin, nu ouest sur la limite (façade de la maison en z 0) ; position : perspective de la photo du client (point de fuite de la limite
  // et pas régulier des poteaux noirs entre C et le pilier du milieu, distance de C par sa hauteur de 2 m), cohérente avec x ≈ 0 pour le pilier nord
  // milieu : béton 30 × 30, chapeau plat mouluré, tête à 1,24 m au-dessus de l'arase (photo du client : ≈ 1,25 m)
  { const x = xP[1], t = top(x), b0 = bot(x); A.box('fence', x - 0.15, x + 0.15, b0, t + 1.12, -0.32, -0.005, 'envWallC'); A.box('fence', x - 0.2, x + 0.2, t + 1.12, t + 1.18, -0.37, -0.003, 'envWallC'); A.box('fence', x - 0.12, x + 0.12, t + 1.18, t + 1.24, -0.29, -0.04, 'envWallC'); }
  // nord : plus gros (42 × 42), embase de chapeau moulurée et calotte en demi-ellipsoïde (« chapeau arrondi / ovale »)
  { const x = xP[0], t = top(x), b0 = bot(x), cz = -0.22, y0 = t + 1.24, rx = 0.25, rz = 0.22, ry = 0.15, N = 12, K = 3;
    A.box('fence', x - 0.21, x + 0.21, b0, t + 1.12, cz - 0.21, -0.005, 'envWallC'); A.box('fence', x - 0.25, x + 0.25, t + 1.12, t + 1.16, cz - 0.25, -0.004, 'envWallC');
    A.box('fence', x - 0.28, x + 0.28, t + 1.16, y0, cz - 0.27, -0.003, 'envWallC');
    const q = (i, k) => { const a = i / N * 2 * Math.PI, f = k / K * Math.PI / 2; return [x + rx * Math.cos(f) * Math.cos(a), y0 + ry * Math.sin(f), cz + rz * Math.cos(f) * Math.sin(a)]; };
    for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * 2 * Math.PI, f = (k + 0.5) / K * Math.PI / 2;
      const n = [Math.cos(f) * Math.cos(a) / rx, Math.sin(f) / ry, Math.cos(f) * Math.sin(a) / rz], l = Math.hypot(...n);
      A.quadN('fence', 'envWallC', [q(i, k), q(i + 1, k), q(i + 1, k + 1), q(i, k + 1)], n.map(v => v / l)); } }
  // pilier d'angle de 2 m au-dessus du trottoir, chapeau mouluré (photos 2, 9, 11)
  { const g = hAt(xC + 0.2, -0.2), z0 = -0.42, z1 = -0.02, xa = xC - 0.4; A.box('fence', xa, xC, PIT.y - 0.3, g + 1.86, z0, z1, 'envWallC');
    A.box('fence', xa - 0.05, xC + 0.05, g + 1.86, g + 1.94, z0 - 0.05, z1 + 0.05, 'envWallC'); A.box('fence', xa + 0.06, xC - 0.06, g + 1.94, g + 2.0, z0 + 0.06, z1 - 0.06, 'envWallC'); }
  // clôture sud du voisin sur la rue : muret béton, grillage vert 0,90 m (photo 9), poteaux fins en z −2,0, −3,8, −5,6 (retrouvés sur la photo du client,
  // où le grillage continue au-delà), poteau d'about à l'angle des plaques de la branche sud de la rue (z −7,66)
  const tS = top(18.9) + 0.02, zE = -7.62, zP = -0.42, xm = (xS + xC) / 2; // arase, about est, nu du pilier d'angle, axe
  A.box('fence', xS, xC, PIT.y - 0.3, tS, zE, zb, 'envWallC'); A.box('fence', xS - 0.02, xC + 0.02, tS - 0.05, tS, zE - 0.02, zb, 'envWallC');
  A.quadN('fence', 'mesh', [[xm, tS + 0.04, zP], [xm, tS + 0.04, zE], [xm, tS + 0.94, zE], [xm, tS + 0.94, zP]], [1, 0, 0]);
  for (const z of [-2.0, -3.8, -5.6, zE + 0.03]) A.box('fence', xm - 0.02, xm + 0.02, tS, tS + 0.97, z - 0.02, z + 0.02, 'meshPost');
  C.sbox('fence', 'meshPost', [xm, zP], [xm, zE], -0.006, 0.006, tS + 0.92, tS + 0.92, 0.012);
}

// ---------------------------------------------------------------- voisin est : maison de maître à rez-de-chaussée surélevé, toit à la Mansart
// emprise recalée sur la vue aérienne et la photo 1 (façade sud vers x −9,2, pignon ouest à 4,40 m de la limite) ; RDC à 5 marches au-dessus
// du pied de l'escalier de la terrasse (photos 1 et 16, contremarches ≈ 17 cm) ; garage en sous-sol au fond de la fosse de l'allée (PIT)
function manor(balTex) {
  const { A, hAt } = C;
  const X0 = -21.4, X1 = -9.2, Z0 = -19.4, Z1 = -4.4; // emprise
  const TX1 = -4.0, tz1 = PIT.zE, gs = hAt(TX1 + 1.5, -13); // terrasse : bord sud, bord ouest (sur la fosse), sol au pied de l'escalier
  const [gmin] = groundMinMax(X0, X1, Z0, Z1), yb = Math.min(gmin, PIT.y) - 0.4;
  const yF = gs + 5 * 0.17, yC = yF + 3.25, yB = yC + 0.36, hB = 3.0, yT = yB + hB; // RDC surélevé, corniche, brisis, terrasson
  const { P, fb, nr, av, ring, disc } = faces(X0, X1, Z0, Z1);
  // soubassement, murs enduits blancs, bandeau, entablement et corniche moulurée
  A.box('site', X0 - 0.05, X1 + 0.05, yb, yF, Z0 - 0.05, Z1 + 0.05, 'envBase');
  A.box('site', X0 - 0.07, X1 + 0.07, yF - 0.06, yF + 0.16, Z0 - 0.07, Z1 + 0.07, 'envStone');
  A.box('site', X0, X1, yF, yC, Z0, Z1, 'envManor');
  A.box('site', X0 - 0.1, X1 + 0.1, yC, yC + 0.16, Z0 - 0.1, Z1 + 0.1, 'envStone');
  A.box('site', X0 - 0.3, X1 + 0.3, yC + 0.16, yB, Z0 - 0.3, Z1 + 0.3, 'envStone');
  // brisis à 72° (ardoise) puis terrasson à 20°, ourlet en zinc à la jonction
  const o = 0.25, ins = hB / Math.tan(72 * RAD);
  const xo0 = X0 - o, xo1 = X1 + o, zo0 = Z0 - o, zo1 = Z1 + o, xi0 = xo0 + ins, xi1 = xo1 - ins, zi0 = zo0 + ins, zi1 = zo1 - ins;
  rface('site', 'envSlate', [[xo1, yB, zo0], [xo1, yB, zo1], [xi1, yT, zi1], [xi1, yT, zi0]], [1, 0.3, 0]);
  rface('site', 'envSlate', [[xo0, yB, zo0], [xo0, yB, zo1], [xi0, yT, zi1], [xi0, yT, zi0]], [-1, 0.3, 0]);
  rface('site', 'envSlate', [[xo0, yB, zo1], [xo1, yB, zo1], [xi1, yT, zi1], [xi0, yT, zi1]], [0, 0.3, 1]);
  rface('site', 'envSlate', [[xo0, yB, zo0], [xo1, yB, zo0], [xi1, yT, zi0], [xi0, yT, zi0]], [0, 0.3, -1]);
  const tr = hip('site', 'envSlate', xi0, xi1, zi0, zi1, yT, 20);
  for (const [a, b, c, d] of [[xi0, xi1, zi0, zi0], [xi0, xi1, zi1, zi1], [xi0, xi0, zi0, zi1], [xi1, xi1, zi0, zi1]]) A.box('site', a - 0.05, b + 0.05, yT - 0.05, yT + 0.05, c - 0.05, d + 0.05, 'envZinc');
  C.sbox('site', 'envZinc', tr.a, tr.b, -0.07, 0.07, tr.yr - 0.03, tr.yr - 0.03, 0.08);
  // chaînes d'angle harpées en pierre beige
  const hq = 0.37, nq = Math.floor((yC - yF - 0.16) / hq);
  for (const [f1, a1, s1, f2, a2, s2] of [['S', Z1, -1, 'W', X1, -1], ['S', Z0, 1, 'E', X1, -1], ['N', Z1, -1, 'W', X0, 1], ['N', Z0, 1, 'E', X0, 1]]) {
    for (let k = 0; k < nq; k++) {
      const y0 = yF + 0.16 + k * hq + 0.012, y1 = y0 + hq - 0.024, l1 = k % 2 ? 0.58 : 0.34, l2 = k % 2 ? 0.34 : 0.58;
      fb(f1, Math.min(a1, a1 + s1 * l1), Math.max(a1, a1 + s1 * l1), y0, y1, -0.001, 0.035, 'envQuoin');
      fb(f2, Math.min(a2, a2 + s2 * l2), Math.max(a2, a2 + s2 * l2), y0, y1, -0.001, 0.035, 'envQuoin');
    }
  }
  // portes-fenêtres à persiennes blanches fermées, chambranle et corniche de baie
  const baie = (f, a) => {
    const w = 1.2, y0 = yF + 0.1, y1 = yF + 2.6;
    fb(f, a - w / 2 - 0.13, a + w / 2 + 0.13, y0 - 0.04, y1 + 0.13, -0.001, 0.022, 'envStone');
    fb(f, a - w / 2, a + w / 2, y0, y1, 0.022, 0.06, 'envShutter');
    for (const s of [a - w / 2, a - 0.022, a + w / 2 - 0.045]) fb(f, s, s + 0.045, y0, y1, 0.06, 0.07, 'white');
    for (const y of [y0, y0 + 1.22, y1 - 0.06]) fb(f, a - w / 2, a + w / 2, y, y + 0.06, 0.06, 0.07, 'white');
    fb(f, a - w / 2 - 0.22, a + w / 2 + 0.22, y1 + 0.13, y1 + 0.25, -0.001, 0.11, 'envStone');
  };
  // lanterne murale noire sur potence
  const lantern = (f, a, y) => {
    fb(f, a - 0.025, a + 0.025, y - 0.05, y + 0.03, 0, 0.27, 'blackMatte'); fb(f, a - 0.06, a + 0.06, y - 0.12, y + 0.1, 0, 0.03, 'blackMatte');
    fb(f, a - 0.12, a + 0.12, y - 0.06, y - 0.01, 0.15, 0.39, 'blackMatte'); fb(f, a - 0.09, a + 0.09, y - 0.34, y - 0.06, 0.18, 0.36, 'envLantern');
    fb(f, a - 0.1, a + 0.1, y - 0.39, y - 0.34, 0.17, 0.37, 'blackMatte'); fb(f, a - 0.05, a + 0.05, y - 0.01, y + 0.06, 0.22, 0.32, 'blackMatte');
  };
  const bayS = [-7.15, -11.9, -16.65], bayW = [-18.8, -11.8];
  for (const a of bayS) { baie('S', a); baie('N', a); }
  for (const a of bayW) { baie('W', a); baie('E', a); }
  for (const a of [-9.5, -14.3]) { lantern('S', a, yF + 2.45); }
  for (const a of [-16.95, -13.65]) { lantern('W', a, yF + 2.45); }
  // oculus du RDC (façade ouest), entouré de pierre, clé
  { const ac = -15.3, yc = yF + 1.55; disc('W', 'envGlass', ac, yc, 0.012, 0.36); ring('W', 'envQuoin', ac, yc, 0.04, 0.33, 0.5); fb('W', ac - 0.09, ac + 0.09, yc + 0.42, yc + 0.64, -0.001, 0.06, 'envQuoin'); fb('W', ac - 0.02, ac + 0.02, yc - 0.33, yc + 0.33, 0.012, 0.03, 'white'); fb('W', ac - 0.33, ac + 0.33, yc - 0.02, yc + 0.02, 0.012, 0.03, 'white'); }
  // lucarnes à fronton triangulaire dans le brisis (3 au sud, 3 au nord), fenêtres cintrées
  const up = [0, 1, 0];
  const lucarne = (f, ac) => {
    const w = 0.68, d1 = 0.16, y0 = yB, yS = yB + 0.6, yW = yB + 1.45, yE = yB + 1.95, yR = yE + 0.5, hw = 0.84;
    fb(f, ac - w, ac + w, y0, yE, -1.3, d1, 'envStone');
    fb(f, ac - w - 0.06, ac + w + 0.06, yE - 0.1, yE, -1.3, d1 + 0.05, 'envStone'); // entablement
    fb(f, ac - w - 0.04, ac + w + 0.04, yS - 0.08, yS, -0.2, d1 + 0.06, 'envStone'); // appui
    fb(f, ac - 0.42, ac + 0.42, yS, yW, d1, d1 + 0.012, 'envGlass'); disc(f, 'envGlass', ac, yW, d1 + 0.012, 0.42, 12, 0, Math.PI);
    fb(f, ac - 0.025, ac + 0.025, yS, yW + 0.42, d1 + 0.012, d1 + 0.035, 'white'); fb(f, ac - 0.42, ac + 0.42, yW - 0.025, yW + 0.02, d1 + 0.012, d1 + 0.035, 'white');
    for (const s of [-1, 1]) fb(f, ac + s * 0.42 - (s > 0 ? 0 : 0.05), ac + s * 0.42 + (s > 0 ? 0.05 : 0), yS, yW, d1, d1 + 0.04, 'envStone');
    A.polyN('site', 'envStone', [P(f, ac - hw, yE, d1 + 0.05), P(f, ac + hw, yE, d1 + 0.05), P(f, ac, yR, d1 + 0.05)], nr(f)); // fronton
    const sa = av(f);
    for (const s of [-1, 1]) {
      rface('site', 'envSlate', [P(f, ac + s * (hw + 0.04), yE - 0.03, d1 + 0.09), P(f, ac, yR + 0.04, d1 + 0.09), P(f, ac, yR + 0.04, -1.6), P(f, ac + s * (hw + 0.04), yE - 0.03, -1.6)], [up[0] + s * sa[0], 1, up[2] + s * sa[2]]);
    }
  };
  for (const a of bayS) { lucarne('S', a); lucarne('N', a); }
  // œil-de-bœuf dans le brisis ouest (et est) : encadrement de pierre, chapeau d'ardoise
  const oeil = (f, ac) => {
    const yc = yB + 1.35, d1 = 0.12;
    fb(f, ac - 0.55, ac + 0.55, yB + 0.62, yB + 2.0, -1.3, d1, 'envStone');
    ring(f, 'envStone', ac, yc, d1 + 0.04, 0.32, 0.52); disc(f, 'envGlass', ac, yc, d1 + 0.01, 0.34);
    fb(f, ac - 0.02, ac + 0.02, yc - 0.32, yc + 0.32, d1 + 0.01, d1 + 0.03, 'white'); fb(f, ac - 0.32, ac + 0.32, yc - 0.02, yc + 0.02, d1 + 0.01, d1 + 0.03, 'white');
    fb(f, ac - 0.11, ac + 0.11, yc + 0.46, yc + 0.66, d1, d1 + 0.07, 'envStone');
    const sa = av(f);
    for (const s of [-1, 1]) rface('site', 'envSlate', [P(f, ac + s * 0.62, yB + 1.98, d1 + 0.08), P(f, ac, yB + 2.3, d1 + 0.08), P(f, ac, yB + 2.3, -1.5), P(f, ac + s * 0.62, yB + 1.98, -1.5)], [s * sa[0], 1, s * sa[2]]);
    A.polyN('site', 'envStone', [P(f, ac - 0.6, yB + 2.0, d1 + 0.06), P(f, ac + 0.6, yB + 2.0, d1 + 0.06), P(f, ac, yB + 2.28, d1 + 0.06)], nr(f));
  };
  oeil('W', -15.3); oeil('E', -15.3);
  // souches de cheminée enduites, couronnement, mitrons
  for (const [cx, cz] of [[-11.6, -7.05], [-19.2, -7.05], [-15.4, -16.95]]) {
    const yb = yT - 0.4, yt = tr.yr + 1.1;
    A.box('site', cx - 0.38, cx + 0.38, yb, yt, cz - 0.5, cz + 0.5, 'envManor'); A.box('site', cx - 0.46, cx + 0.46, yt, yt + 0.14, cz - 0.58, cz + 0.58, 'envStone');
    for (const dz of [-0.22, 0.22]) A.box('site', cx - 0.1, cx + 0.1, yt + 0.14, yt + 0.42, cz + dz - 0.1, cz + dz + 0.1, 'envQuoin');
  }
  // antenne râteau
  A.box('site', -11.62, -11.58, tr.yr + 1.2, tr.yr + 3.0, -7.07, -7.03, 'grille'); for (const k of [0, 1, 2]) A.box('site', -11.62, -11.58, tr.yr + 2.3 + k * 0.25, tr.yr + 2.32 + k * 0.25, -7.55, -6.55, 'grille');

  // terrasse surélevée en L (au sud et le long de la façade ouest) : massif enduit, dalle de pierre
  // sous l'aile ouest, renfoncement RX0..X1 au fond de la fosse : porte de garage en bois (sous-sol), colonne ronde blanche à l'angle (photos 1 et 16)
  const RX0 = PIT.rx0 + 0.05, yG = PIT.y;
  A.box('site', X1, TX1, yb, yF - 0.12, Z0, tz1, 'envBase');
  A.box('site', X0, RX0, yb, yF - 0.12, Z1, tz1, 'envBase'); A.box('site', RX0, X1, yF - 0.45, yF - 0.12, Z1, tz1, 'envBase');
  A.box('site', X1 - 0.001, TX1 + 0.04, yF - 0.12, yF, Z0 - 0.04, tz1 + 0.04, { py: 'envTerrace', def: 'envStone' });
  A.box('site', X0 - 0.04, X1, yF - 0.12, yF, Z1, tz1 + 0.04, { py: 'envTerrace', def: 'envStone' });
  { const zd = Z1 + 0.05, x0 = -12.2, x1 = -9.8; A.box('site', x0, x1, yG - 0.05, yG + 2.15, zd, zd + 0.03, 'envWood');
    for (let k = 1; k < 8; k++) A.box('site', x0 + k * 0.3 - 0.008, x0 + k * 0.3 + 0.008, yG, yG + 2.1, zd + 0.03, zd + 0.034, 'blackMatte');
    A.box('site', x0 - 0.15, x1 + 0.15, yG + 2.15, yG + 2.3, zd, zd + 0.05, 'envStone');
    const cx = X1 - 0.24, cz = tz1 - 0.24, r = 0.17, y0 = yG + 0.25, y1 = yF - 0.6; // colonne : base et chapiteau carrés
    for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * Math.PI, b = (i + 1) / 12 * 2 * Math.PI, m = (a + b) / 2;
      A.quadN('site', 'white', [[cx + r * Math.cos(a), y0, cz + r * Math.sin(a)], [cx + r * Math.cos(b), y0, cz + r * Math.sin(b)], [cx + r * Math.cos(b), y1, cz + r * Math.sin(b)], [cx + r * Math.cos(a), y1, cz + r * Math.sin(a)]], [Math.cos(m), 0, Math.sin(m)]); }
    A.box('site', cx - 0.24, cx + 0.24, yG - 0.02, y0, cz - 0.24, cz + 0.24, 'white'); A.box('site', cx - 0.25, cx + 0.25, y1, yF - 0.45, cz - 0.25, cz + 0.25, 'white'); }
  // fosse de l'allée : sol en béton jusqu'au garage, fermée au sud par un mur de soutènement en travers sous l'angle de la terrasse (client, 12/10) ;
  // mur de soutènement côté pelouse au nord du manoir, rampe au nord
  { const zW = PIT.zW, zE = PIT.zE, y = x => pitFloor(x) + 0.012, xp = PIT.x1 - 0.1;
    A.quadN('site', 'concrete', [[PIT.x0, y(PIT.x0), zW], [PIT.xr, y(PIT.xr), zW], [PIT.xr, y(PIT.xr), zE], [PIT.x0, y(PIT.x0), zE]], [0, 1, 0]);
    A.quadN('site', 'concrete', [[PIT.xr, y(xp), zW], [xp, y(xp), zW], [xp, y(xp), zE], [PIT.xr, y(xp), zE]], [0, 1, 0]);
    A.quadN('site', 'concrete', [[RX0, y(xp), zE], [X1, y(xp), zE], [X1, y(xp), Z1 + 0.05], [RX0, y(xp), Z1 + 0.05]], [0, 1, 0]);
    const lawn = x => hAt(Math.min(x, 18.9), -3.4), wallE = (xa, xb) => { const n = Math.ceil((xb - xa) / 2);
      for (let i = 0; i < n; i++) { const a = xa + (xb - xa) * i / n, b = xa + (xb - xa) * (i + 1) / n, ta = lawn(a) + 0.06, tb = lawn(b) + 0.06, H = Math.max(ta, tb) - yG + 0.3;
        C.sbox('site', 'envWallC', [a, zE - 0.1], [b, zE - 0.1], -0.1, 0.1, ta - H, tb - H, H); C.sbox('site', 'envWallC', [a, zE - 0.17], [b, zE - 0.17], -0.2, 0.2, ta, tb, 0.05); } };
    wallE(PIT.x0, X0);
    const xw = PIT.x1, tw = hAt(xw + 0.3, -1.5) + 0.06; // mur en travers : nu nord sur le dernier sommet de la fosse, arase au niveau du jardin
    A.box('site', xw - 0.12, xw + 0.12, yG - 0.3, tw, zE, zW, 'envWallC'); A.box('site', xw - 0.15, xw + 0.15, tw, tw + 0.05, zE, zW, 'envWallC'); }
  // balustrade : socle, balustres, main courante, dés de pierre ; escalier droit vers le jardin
  const yb0 = yF + 0.14; balTex.offset.y = -yb0 / 0.62;
  const balRun = (ax, c, a0, a1) => {
    const bx = (p0, p1, y0, y1, hw, m) => ax === 'x' ? A.box('site', p0, p1, y0, y1, c - hw, c + hw, m) : A.box('site', c - hw, c + hw, y0, y1, p0, p1, m);
    bx(a0, a1, yF, yb0, 0.15, 'envStone'); bx(a0, a1, yb0 + 0.62, yF + 0.9, 0.17, 'envStone');
    if (ax === 'x') A.quadN('site', 'envBal', [[a0, yb0, c], [a1, yb0, c], [a1, yb0 + 0.62, c], [a0, yb0 + 0.62, c]], [0, 0, 1]);
    else A.quadN('site', 'envBal', [[c, yb0, a0], [c, yb0, a1], [c, yb0 + 0.62, a1], [c, yb0 + 0.62, a0]], [1, 0, 0]);
  };
  const de = (x, z) => { A.box('site', x - 0.2, x + 0.2, yF, yF + 0.98, z - 0.2, z + 0.2, 'envStone'); A.box('site', x - 0.24, x + 0.24, yF + 0.98, yF + 1.05, z - 0.24, z + 0.24, 'envStone'); };
  const cw = tz1 - 0.2, cs = TX1 - 0.2, sg0 = -11.45, sg1 = -14.55; // axes des balustrades, trémie de l'escalier
  const dW = [X0 + 0.2, -18.5, -15.4, -12.3, X1, -6.7, cs];
  for (let i = 0; i < dW.length - 1; i++) balRun('x', cw, dW[i], dW[i + 1]);
  const dS = [cw, -5.9, -8.7, sg0, sg1, -16.9, Z0 + 0.2];
  for (let i = 0; i < dS.length - 1; i++) if (dS[i] !== sg0) balRun('z', cs, Math.min(dS[i], dS[i + 1]), Math.max(dS[i], dS[i + 1]));
  for (const x of dW) de(x, cw); for (const z of dS.slice(1)) de(cs, z);
  { const n = Math.max(3, Math.round((yF - gs) / 0.17)), rise = (yF - gs) / n, run = 0.32, z0 = sg1 - 0.14, z1 = sg0 + 0.14;
    for (let k = 1; k < n; k++) A.box('site', TX1 + (k - 1) * run, TX1 + k * run, gs - 0.3, yF - k * rise, z0, z1, { py: 'envTerrace', px: 'envStone', def: 'envBase' });
    const xe = TX1 + (n - 1) * run;
    for (const zc of [sg0, sg1]) { C.sbox('site', 'envBase', [TX1 + 0.2, zc], [xe, zc], -0.14, 0.14, yF - 0.3, gs - 0.3, 0.92); C.sbox('site', 'envStone', [TX1 + 0.2, zc], [xe, zc], -0.17, 0.17, yF + 0.62, gs + 0.62, 0.08); A.box('site', xe - 0.05, xe + 0.35, gs - 0.3, gs + 0.95, zc - 0.2, zc + 0.2, 'envStone'); } }
  // salon de jardin blanc sur la terrasse
  { const tx = -6.6, tz = -8.6; A.box('site', tx - 0.45, tx + 0.45, yF + 0.70, yF + 0.74, tz - 0.45, tz + 0.45, 'white'); A.box('site', tx - 0.04, tx + 0.04, yF, yF + 0.70, tz - 0.04, tz + 0.04, 'white');
    for (const dz of [-0.85, 0.85]) { const z = tz + dz; A.box('site', tx - 0.22, tx + 0.22, yF + 0.42, yF + 0.46, z - 0.22, z + 0.22, 'white'); A.box('site', tx - 0.22, tx + 0.22, yF + 0.46, yF + 0.92, z + Math.sign(dz) * 0.2, z + Math.sign(dz) * 0.24, 'white'); for (const [ex, ez] of [[-0.19, -0.19], [0.17, -0.19], [-0.19, 0.17], [0.17, 0.17]]) A.box('site', tx + ex, tx + ex + 0.03, yF, yF + 0.42, z + ez, z + ez + 0.03, 'white'); } }
  return { yF };
}

// ---------------------------------------------------------------- maisons simples (volumes enduits, fenêtres, toiture tuiles)
function house(o) {
  const { A } = C; const { x0, x1, z0, z1 } = o;
  const [gmin, gmax] = groundMinMax(x0, x1, z0, z1), g = gmax + (o.raise ?? 0.15), yw = g + o.h;
  A.box('site', x0, x1, gmin - 0.4, yw, z0, z1, o.wall);
  A.box('site', x0 - 0.03, x1 + 0.03, gmin - 0.4, g + 0.02, z0 - 0.03, z1 + 0.03, 'envBase');
  const ov = o.ov ?? 0.4, t = Math.tan(o.pitch * RAD);
  const r = o.roof === 'hip' ? hip('site', o.roofMat, x0 - ov, x1 + ov, z0 - ov, z1 + ov, yw - ov * t, o.pitch, 'envSoffit') : gable('site', o.roofMat, o.wall, x0, x1, z0, z1, yw, o.pitch, o.roof === 'gx', ov);
  ridge(o.roofMat, r);
  const { fb } = faces(x0, x1, z0, z1);
  const lv = o.h > 4.4 ? [0.95, 3.75] : [0.95];
  for (const f of ['S', 'N', 'W', 'E']) {
    const along = f === 'S' || f === 'N' ? [z0, z1] : [x0, x1], len = along[1] - along[0], n = Math.max(1, Math.floor((len - 0.8) / 2.7));
    for (let i = 0; i < n; i++) {
      const a = along[0] + (i + 0.5) * len / n;
      lv.forEach((ly, j) => {
        const door = o.door === f && i === Math.floor(n / 2) && j === 0, w = door ? 0.95 : (o.h > 4.4 ? 1.15 : 1.0), y0 = g + (door ? 0 : ly), y1 = g + (door ? 2.15 : ly + 1.25);
        fb(f, a - w / 2 - 0.07, a + w / 2 + 0.07, y0 - (door ? 0 : 0.07), y1 + 0.07, -0.001, 0.025, 'appui');
        fb(f, a - w / 2, a + w / 2, y0, y1, 0.025, 0.04, door ? 'envWood' : 'envGlass');
        if (!door && o.shutters) for (const s of [-1, 1]) fb(f, a + s * (w / 2 + 0.1) - (s > 0 ? 0 : w / 2), a + s * (w / 2 + 0.1) + (s > 0 ? w / 2 : 0), y0, y1, 0.02, 0.05, o.shutters);
      });
    }
  }
  if (o.chim) { const [cx, cz] = o.chim; A.box('site', cx - 0.3, cx + 0.3, yw, r.yr + 0.9, cz - 0.4, cz + 0.4, o.chimMat || o.wall); A.box('site', cx - 0.36, cx + 0.36, r.yr + 0.9, r.yr + 1.0, cz - 0.46, cz + 0.46, 'coping'); }
  return { g, yw, r };
}

// ---------------------------------------------------------------- matériaux des voisins nord, ouest (rue des Merlettes) et sud (créés au premier appel)
function matsOuest() {
  const { M, makeTex, pixelNoise, rng, std, TEX } = C; if (M.envTileN) return;
  const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
  // tuiles mécaniques à côtes brun clair nuancé, rangs de 0,33 m, 4 au mètre (voisin nord, photos 4, 5, 18)
  M.envTileN = std({ map: makeTex(512, 1.0, (g, s) => {
    const r = rng(351), th = s / 3, tw = s / 4; g.fillStyle = '#4a2f24'; g.fillRect(0, 0, s, s);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const f = 0.8 + r() * 0.32, x = i * tw, y = j * th, c = k => rgb(172 * f * k, 114 * f * k, 86 * f * k);
      for (const a of [0, 0.5]) { const grd = g.createLinearGradient(x + a * tw, 0, x + (a + 0.5) * tw, 0); grd.addColorStop(0, c(0.72)); grd.addColorStop(0.45, c(1.1)); grd.addColorStop(1, c(0.78)); g.fillStyle = grd; g.fillRect(x + a * tw, y + 2, tw / 2, th - 3); }
      const sh = g.createLinearGradient(0, y + th * 0.75, 0, y + th); sh.addColorStop(0, 'rgba(35,22,16,0)'); sh.addColorStop(1, 'rgba(35,22,16,0.5)'); g.fillStyle = sh; g.fillRect(x, y, tw, th);
    }
    const img = g.getImageData(0, 0, s, s), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(img, 0, 0);
  }), roughness: 0.82 });
  // crépi blanc projeté (piliers et murets du n° 4 en face) ; enduit blanc lisse (voisin nord, n° 4)
  const crepi = makeTex(256, 0.5, (g, s) => pixelNoise(g, s, '#f2f0ea', 0.13, 0.03, 12, 352, (f, r) => r() < 0.05 ? f * 0.84 : f));
  M.envRough = std({ map: crepi, bumpMap: crepi, bumpScale: 2.2, roughness: 1 });
  M.envWhiteN = std({ map: TEX.lisse, color: '#f7f5ef', roughness: 0.9 });
  M.envRose = std({ map: TEX.lisse, color: '#f4dbcf', roughness: 0.9 }); // enduit rose pâle de la maison au nord du n° 4 (photos 6, 13, 14)
  // volets battants en planches verticales de 12 cm, brun foncé (voisin nord)
  M.envWoodN = std({ map: makeTex(128, 0.48, (g, s) => { pixelNoise(g, s, '#4f3d30', 0.05, 0.06, 4, 353); g.fillStyle = 'rgba(18,12,8,0.75)'; for (let i = 0; i < 4; i++) g.fillRect(i * s / 4, 0, 2, s); }), roughness: 0.7 });
  // tomettes carrées de 30 cm en terre cuite nuancée, joints clairs (terrasse du voisin nord)
  M.envTerra = std({ map: makeTex(256, 0.6, (g, s) => { const r = rng(354); g.fillStyle = '#d2c2ae'; g.fillRect(0, 0, s, s); for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const f = 0.86 + r() * 0.22; g.fillStyle = rgb(194 * f, 134 * f, 106 * f); g.fillRect(i * s / 2 + 3, j * s / 2 + 3, s / 2 - 6, s / 2 - 6); } }), roughness: 0.8 });
  M.envScreen = std({ color: '#1e4537', roughness: 0.92, side: THREE.DoubleSide }); // brise-vue vert foncé tendu sur le grillage
  M.envGreen = std({ color: '#33604b', roughness: 0.55 }); // volets et porte du n° 4, boîte aux lettres, portail et portillon verts au nord du mur haut
  M.envBeacon = std({ color: '#f08a1c', roughness: 0.4, emissive: '#c25c00', emissiveIntensity: 0.35 }); // gyrophare du portail du n° 6
  // barreaudage noir à pointes de lance, 1 barreau tous les 12 cm, motif étiré sur la hauteur de la grille par les UV
  const rail = makeTex(64, 1, (g, s, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#18191b'; const bw = 8, x = (w - bw) / 2; g.fillRect(x, 26, bw, h - 26); g.beginPath(); g.moveTo(x - 4, 30); g.lineTo(w / 2, 2); g.lineTo(x + bw + 4, 30); g.fill(); g.fillRect(0, 34, w, 7); g.fillRect(0, h - 22, w, 7); }, { w: 64, h: 256 });
  rail.wrapT = THREE.ClampToEdgeWrapping;
  M.envRail = std({ map: rail, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 });
}
// quadrilatère à UV imposés (grilles en transparence), fusionné par matériau avec les faces inclinées
function quadUV(mat, P, U, n) { const k = 'site|' + mat; let bk = RF.get(k); if (!bk) { bk = { layer: 'site', mat, pos: [], nor: [], uv: [] }; RF.set(k, bk); } for (const i of [0, 1, 2, 0, 2, 3]) { bk.pos.push(...P[i]); bk.nor.push(...n); bk.uv.push(...U[i]); } }
// grille à barreaux de p0 à p1 (plan XZ), pied ya (en p0) → yb (en p1), hauteur h jusqu'aux pointes
function railing(p0, p1, ya, yb, h) { const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), u = Math.max(1, Math.round(l / 0.12)); quadUV('envRail', [[p0[0], ya, p0[1]], [p1[0], yb, p1[1]], [p1[0], yb + h, p1[1]], [p0[0], ya + h, p0[1]]], [[0, 0], [u, 0], [u, 1], [0, 1]], [(p1[1] - p0[1]) / l, 0, -(p1[0] - p0[0]) / l]); }
// toiture 4 pans à faîtage selon X (lx ≥ lz), croupes de pente propre pe ; égout ye au nu du débord, sous-face plate
function hip2(mat, x0, x1, z0, z1, ye, p, pe) {
  const yr = ye + (z1 - z0) / 2 * Math.tan(p * RAD), zr = (z0 + z1) / 2, re = (yr - ye) / Math.tan(pe * RAD), r0 = x0 + re, r1 = x1 - re;
  rface('site', mat, [[x0, ye, z0], [x1, ye, z0], [r1, yr, zr], [r0, yr, zr]], [0, 1, -1]); rface('site', mat, [[x1, ye, z1], [x0, ye, z1], [r0, yr, zr], [r1, yr, zr]], [0, 1, 1]);
  rface('site', mat, [[x0, ye, z1], [x0, ye, z0], [r0, yr, zr]], [-1, 1, 0]); rface('site', mat, [[x1, ye, z0], [x1, ye, z1], [r1, yr, zr]], [1, 1, 0]);
  C.A.quadN('site', 'envSoffit', [[x0, ye, z0], [x1, ye, z0], [x1, ye, z1], [x0, ye, z1]], [0, -1, 0]);
  return { yr, a: [r0, zr], b: [r1, zr] };
}
// lanterne murale noire sur potence (face f, abscisse a, hauteur de la potence y)
function lanterne(fb, f, a, y) {
  fb(f, a - 0.02, a + 0.02, y - 0.04, y + 0.02, 0, 0.22, 'blackMatte'); fb(f, a - 0.05, a + 0.05, y - 0.1, y + 0.08, 0, 0.03, 'blackMatte');
  fb(f, a - 0.11, a + 0.11, y - 0.08, y - 0.03, 0.12, 0.32, 'blackMatte'); fb(f, a - 0.09, a + 0.09, y - 0.36, y - 0.08, 0.13, 0.31, 'envLantern'); fb(f, a - 0.06, a + 0.06, y - 0.41, y - 0.36, 0.16, 0.28, 'blackMatte');
}

// ---------------------------------------------------------------- voisin nord (2 rue des Merlettes, photos 4, 5, 17, 18) : R+C enduit blanc, toit 2 pans à 45° en tuiles mécaniques
// brun clair, faîtage est–ouest, pignons est et ouest aveugles ; pan sud : Velux côté ouest, lucarne capucine côté est, souche enduite juste derrière
// (antenne, parabole) ; façade sud : 3 portes-fenêtres à volets battants en bois brun, lanterne, bandeau sous l'égout ; terrasse en tomettes, salon blanc
function northHouse() {
  matsOuest();
  const { A } = C;
  const x0 = -25.5, x1 = -17.7, z0 = 0.5, z1 = 9.1, p = 45, t = Math.tan(p * RAD), ov = 0.3;
  const [gmin, gmax] = groundMinMax(x0, x1 + 2.8, z0, z1), g = gmax + 0.12, yE = g + 2.9;
  A.box('site', x0, x1, gmin - 0.4, yE, z0, z1, 'envWhiteN');
  A.box('site', x0 - 0.03, x1 + 0.03, gmin - 0.4, g - 0.1, z0 - 0.03, z1 + 0.03, 'envBase');
  const r = gable('site', 'envTileN', 'envWhiteN', x0, x1, z0, z1, yE, p, false, ov); ridge('envTileN', r);
  const ye = yE - ov * t, yS = x => ye + (x1 + ov - x) * t; // hauteur du pan sud
  const { fb } = faces(x0, x1, z0, z1);
  // bandeau sous l'égout, gouttières en zinc, descente blanche à l'angle sud-ouest
  fb('S', z0, z1, yE - 0.34, yE - 0.12, 0, 0.05, 'envWhiteN');
  for (const xe of [x1 + ov - 0.06, x0 - ov + 0.06]) A.box('site', xe - 0.06, xe + 0.06, ye - 0.12, ye - 0.01, z0 - ov, z1 + ov, 'envZinc');
  A.box('site', x1 + 0.03, x1 + 0.11, g - 0.1, ye - 0.12, z1 - 0.13, z1 - 0.05, 'white'); A.box('site', x1 + 0.03, x1 + ov - 0.02, ye - 0.2, ye - 0.12, z1 - 0.13, z1 - 0.05, 'white');
  // portes-fenêtres 1,00 × 2,15 à 2 vantaux, volets battants ouverts de part et d'autre (3 traverses) ; lanterne entre les deux premières
  for (const a of [6.8, 4.45, 2.25]) {
    const y1 = g + 2.15;
    fb('S', a - 0.5, a + 0.5, g, y1, 0, 0.012, 'envGlass');
    for (const s of [a - 0.5, a - 0.03, a + 0.44]) fb('S', s, s + 0.06, g, y1, 0.012, 0.04, 'white');
    for (const y of [g, g + 1.05, y1 - 0.06]) fb('S', a - 0.5, a + 0.5, y, y + 0.06, 0.012, 0.04, 'white');
    for (const s of [-1, 1]) { const lo = Math.min(a + s * 0.53, a + s * 1.03), hi = Math.max(a + s * 0.53, a + s * 1.03); fb('S', lo, hi, g + 0.02, y1 + 0.05, 0.01, 0.045, 'envWoodN'); for (const y of [g + 0.25, g + 1.08, y1 - 0.2]) fb('S', lo + 0.03, hi - 0.03, y - 0.05, y + 0.05, 0.045, 0.065, 'envWoodN'); }
  }
  lanterne(fb, 'S', 5.62, g + 2.3);
  // Velux 78 × 98 à mi-pente, côté ouest
  { const zc = 7.1, xc = x1 + ov - 1.9, hw = 0.39, hl = 0.49 * Math.cos(p * RAD), q = (dx, dz, o) => [xc + dx, yS(xc + dx) + o, zc + dz];
    rface('site', 'grille', [q(hl + 0.05, -hw - 0.05, 0.04), q(hl + 0.05, hw + 0.05, 0.04), q(-hl - 0.05, hw + 0.05, 0.1), q(-hl - 0.05, -hw - 0.05, 0.1)], [1, 1, 0]);
    rface('site', 'envGlass', [q(hl - 0.03, -hw + 0.04, 0.09), q(hl - 0.03, hw - 0.04, 0.09), q(-hl + 0.05, hw - 0.04, 0.14), q(-hl + 0.05, -hw + 0.04, 0.14)], [1, 1, 0]); }
  // lucarne capucine côté est : jouées enduites, croupe en façade, chambranle en bois brun, fenêtre à 2 vantaux blancs, appui, garde-corps
  { const zc = 2.55, w = 0.66, xf = x1 - 0.35, yb = yS(xf), yd = yb + 1.5, W = w + 0.12, ydr = yd + W, xh = xf + 0.12, yd2 = yd - 0.04;
    const xbe = x1 + ov - (yd2 - ye) / t, xbr = x1 + ov - (ydr - ye) / t;
    A.box('site', xbe - 0.1, xf, yb - 0.05, yd, zc - w, zc + w, 'envWhiteN');
    for (const s of [-1, 1]) { const q = [[xh, yd2, zc + s * W], [xbe, yd2, zc + s * W], [xbr, ydr, zc], [xh - W, ydr, zc]]; rface('site', 'envTileN', q, [0, 1, s]); rface('site', 'envSoffit', q, [0, -1, -s]); }
    { const q = [[xh, yd2, zc - W], [xh, yd2, zc + W], [xh - W, ydr, zc]]; rface('site', 'envTileN', q, [1, 1, 0]); rface('site', 'envSoffit', q, [-1, -1, 0]); }
    const yw0 = yb + 0.3, yw1 = yd - 0.16;
    A.box('site', xf, xf + 0.05, yw0 - 0.12, yw1 + 0.1, zc - 0.58, zc + 0.58, 'envWoodN');
    A.box('site', xf + 0.05, xf + 0.06, yw0, yw1, zc - 0.42, zc + 0.42, 'envGlass');
    for (const z of [zc - 0.42, zc - 0.025, zc + 0.37]) A.box('site', xf + 0.05, xf + 0.08, yw0, yw1, z, z + 0.05, 'white');
    for (const y of [yw0, yw1 - 0.05]) A.box('site', xf + 0.05, xf + 0.08, y, y + 0.05, zc - 0.42, zc + 0.42, 'white');
    A.box('site', xf - 0.02, xf + 0.12, yb + 0.1, yb + 0.18, zc - 0.62, zc + 0.62, 'appui');
    railing([xf + 0.1, zc - 0.42], [xf + 0.1, zc + 0.42], yw0 + 0.04, yw0 + 0.04, 0.42); }
  // souche enduite grise sur le pan sud juste sous le faîtage, derrière la lucarne ; mât d'antenne râteau côté ouest, parabole au sud
  { const cx = r.a[0] + 0.55, cz = 1.75, yt = r.yr + 1.15;
    A.box('site', cx - 0.3, cx + 0.3, yS(cx + 0.3) - 0.2, yt, cz - 0.27, cz + 0.27, 'envWallC'); A.box('site', cx - 0.34, cx + 0.34, yt, yt + 0.06, cz - 0.31, cz + 0.31, 'coping');
    A.box('site', cx - 0.02, cx + 0.02, yt - 0.6, yt + 1.7, cz + 0.29, cz + 0.33, 'grille'); for (const k of [0, 1, 2]) A.box('site', cx - 0.015, cx + 0.015, yt + 1.1 + k * 0.2, yt + 1.12 + k * 0.2, cz - 0.14 + k * 0.06, cz + 0.76 - k * 0.06, 'grille');
    const c = new THREE.Vector3(cx + 0.42, yt - 0.55, cz - 0.05), n = new THREE.Vector3(0.79, 0.54, -0.29).normalize(), u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize(), v = new THREE.Vector3().crossVectors(u, n);
    const pts = []; for (let i = 0; i < 14; i++) { const a = i / 14 * 2 * Math.PI; const q = c.clone().addScaledVector(u, Math.cos(a) * 0.3).addScaledVector(v, Math.sin(a) * 0.3); pts.push([q.x, q.y, q.z]); }
    A.polyN('site', 'envDish', pts, [n.x, n.y, n.z]); A.polyN('site', 'envDish', pts, [-n.x, -n.y, -n.z]); A.box('site', cx + 0.3, cx + 0.42, yt - 0.6, yt - 0.55, cz - 0.08, cz - 0.02, 'grille'); }
  // terrasse en tomettes le long de la façade sud (2,80 m), table ronde et 4 chaises pliantes blanches
  { const xt = x1 + 2.8, gt = g - 0.14; A.box('site', x1, xt, gmin - 0.3, gt, z0 - 0.2, z1 + 0.3, { py: 'envTerra', def: 'envBase' });
    const tx = x1 + 1.45, tz = 3.4, disc = (y, s) => A.polyN('site', 'white', Array.from({ length: 12 }, (_, i) => [tx + 0.55 * Math.cos(i * Math.PI / 6), y, tz + 0.55 * Math.sin(i * Math.PI / 6)]), [0, s, 0]);
    disc(gt + 0.74, 1); disc(gt + 0.72, -1); A.box('site', tx - 0.04, tx + 0.04, gt, gt + 0.72, tz - 0.04, tz + 0.04, 'white');
    for (const [dx, dz] of [[0.85, 0], [-0.85, 0.2], [0.1, 0.85], [0.1, -0.85]]) {
      const cx = tx + dx, cz = tz + dz, bx = Math.abs(dx) > Math.abs(dz);
      A.box('site', cx - 0.2, cx + 0.2, gt + 0.43, gt + 0.46, cz - 0.2, cz + 0.2, 'white');
      if (bx) { const x = cx + Math.sign(dx) * 0.2; A.box('site', x - 0.015, x + 0.015, gt + 0.46, gt + 0.88, cz - 0.2, cz + 0.2, 'white'); for (const s of [-1, 1]) A.box('site', cx - 0.2, cx + 0.2, gt, gt + 0.43, cz + s * 0.18 - 0.015, cz + s * 0.18 + 0.015, 'white'); }
      else { const z = cz + Math.sign(dz) * 0.2; A.box('site', cx - 0.2, cx + 0.2, gt + 0.46, gt + 0.88, z - 0.015, z + 0.015, 'white'); for (const s of [-1, 1]) A.box('site', cx + s * 0.18 - 0.015, cx + s * 0.18 + 0.015, gt, gt + 0.43, cz - 0.2, cz + 0.2, 'white'); }
    } }
}

// ---------------------------------------------------------------- en face, rue des Merlettes (photos 6, 7, 12 à 14, aérienne) : n° 4, R+C enduit blanc cassé en retrait de 11 m,
// toit 4 pans en tuiles plates brunes à croupes raides, 2 lucarnes à 2 pans (volets roulants blancs) au droit des fenêtres, châssis de toit entre elles,
// souche en haut de la croupe sud ; volets fermés et porte verts. Au nord, maison enduite rose à pignon sud, tuiles rouges, souche en tête de pignon
function westHouses() {
  matsOuest();
  const { A } = C;
  { const x0 = 4.0, x1 = 13.8, z0 = 33.0, z1 = 40.5, [gmin, gmax] = groundMinMax(x0, x1, z0, z1), g = gmax + 0.3, yE = g + 3.0, ov = 0.35, t = 1;
    A.box('site', x0, x1, gmin - 0.4, yE, z0, z1, 'envWhiteN'); A.box('site', x0 - 0.03, x1 + 0.03, gmin - 0.4, g - 0.05, z0 - 0.03, z1 + 0.03, 'envBase');
    const ye = yE - ov * t, r = hip2('envTileB', x0 - ov, x1 + ov, z0 - ov, z1 + ov, ye, 45, 65); ridge('envTileB', r);
    const { fb } = faces(x0, x1, z0, z1), xm = (x0 + x1) / 2, yR = z => ye + (z - z0 + ov) * t, bays = [x1 - 2.4, x0 + 2.4];
    // façade est : porte verte au centre (encadrement clair, marche), fenêtres à volets verts fermés de part et d'autre
    fb('E', xm - 0.6, xm + 0.6, g - 0.05, g + 2.35, -0.001, 0.03, 'appui'); fb('E', xm - 0.47, xm + 0.47, g, g + 2.2, 0.03, 0.05, 'envGreen');
    A.box('site', xm - 0.8, xm + 0.8, gmin - 0.2, g - 0.02, z0 - 0.45, z0, 'envBase');
    for (const a of bays) { fb('E', a - 0.72, a + 0.72, g + 0.85, g + 2.22, -0.001, 0.025, 'appui'); fb('E', a - 0.62, a + 0.62, g + 0.92, g + 2.15, 0.025, 0.05, 'envGreen'); fb('E', a - 0.01, a + 0.01, g + 0.92, g + 2.15, 0.05, 0.056, 'blackMatte'); }
    // lucarnes à 2 pans sur le pan est (jouées en tuiles, fronton enduit, volet roulant blanc baissé)
    for (const a of bays) {
      const zf = z0 + 0.2, yb = yR(zf), yd = yb + 1.25, w = 0.55, W = w + 0.1, ydr = yd + W * Math.tan(50 * RAD), zbe = z0 - ov + (yd - 0.03 - ye) / t, zbr = z0 - ov + (ydr - ye) / t;
      A.box('site', a - w, a + w, yb - 0.05, yd, zf, zbe + 0.1, { nx: 'envTileB', px: 'envTileB', def: 'envWhiteN' });
      for (const s of [-1, 1]) { const q = [[a + s * W, yd - 0.03, zf - 0.1], [a + s * W, yd - 0.03, zbe], [a, ydr, zbr], [a, ydr, zf - 0.1]]; rface('site', 'envTileB', q, [s, 1, 0]); rface('site', 'envSoffit', q, [-s, -1, 0]); }
      A.polyN('site', 'envWhiteN', [[a - w, yd, zf], [a + w, yd, zf], [a, ydr - 0.05, zf]], [0, 0, -1]);
      A.box('site', a - 0.42, a + 0.42, yb + 0.12, yd - 0.1, zf - 0.04, zf, 'white'); A.box('site', a - 0.47, a + 0.47, yb + 0.06, yb + 0.12, zf - 0.08, zf, 'appui');
    }
    { const zc = z0 + 1.7, q = (dx, dz, o) => [xm + dx, yR(zc + dz) + o, zc + dz]; rface('site', 'grille', [q(-0.3, -0.35, 0.04), q(0.3, -0.35, 0.04), q(0.3, 0.35, 0.04), q(-0.3, 0.35, 0.04)], [0, 1, -1]); rface('site', 'envGlass', [q(-0.24, -0.3, 0.06), q(0.24, -0.3, 0.06), q(0.24, 0.3, 0.06), q(-0.24, 0.3, 0.06)], [0, 1, -1]); }
    { const cx = r.b[0] + 0.3, cz = r.b[1] - 0.25; A.box('site', cx - 0.3, cx + 0.3, r.yr - 1.0, r.yr + 0.85, cz - 0.25, cz + 0.25, 'envWhiteN'); A.box('site', cx - 0.35, cx + 0.35, r.yr + 0.85, r.yr + 0.92, cz - 0.3, cz + 0.3, 'coping'); }
  }
  // maison rose : pignon sud large (≈ 9,4 m) juste au nord du mur haut, recoupé sur les photos 6, 13 et 14 (faîtage vu au-dessus du portail du n° 4 en photo 6)
  { const x0 = -12.0, x1 = -2.2, z0 = 21.8, z1 = 31.2, [gmin, gmax] = groundMinMax(x0, x1, z0, z1), g = gmax + 0.2, yE = g + 3.4;
    A.box('site', x0, x1, gmin - 0.4, yE, z0, z1, 'envRose'); A.box('site', x0 - 0.03, x1 + 0.03, gmin - 0.4, g - 0.05, z0 - 0.03, z1 + 0.03, 'envBase');
    const r = gable('site', 'envTileR', 'envRose', x0, x1, z0, z1, yE, 45, true, 0.35); ridge('envTileR', r);
    const { fb } = faces(x0, x1, z0, z1), zr = (z0 + z1) / 2;
    fb('S', z0 + 1.7, z0 + 2.8, yE + 0.3, yE + 1.55, -0.001, 0.035, 'envWood'); fb('S', z0 + 1.8, z0 + 2.7, yE + 0.4, yE + 1.45, 0.035, 0.045, 'envGlass'); // fenêtre de l'étage, moitié est du pignon sud
    A.box('site', x1 - 0.6, x1 - 0.02, r.yr - 0.6, r.yr + 0.95, zr - 0.33, zr + 0.33, 'envRose'); A.box('site', x1 - 0.66, x1 + 0.04, r.yr + 0.95, r.yr + 1.02, zr - 0.39, zr + 0.39, 'coping');
  }
}

// ---------------------------------------------------------------- au sud du sentier de Derrière le Gué (n° 6, photos 8 à 10, 15, aérienne) : R+1 enduit crème, toit 4 pans en
// tuiles brunes à épis, corniche ; façade est (entrée, sur la partie nord–sud du sentier) : fronton central, oculus à l'étage, porte à auvent, lanterne,
// fenêtres à volets blancs ; façade ouest 3 travées à volets blancs, barres d'appui en fer forgé à l'étage ; petite fenêtre à barreaux au nord
function southHouse() {
  matsOuest();
  const { A } = C;
  const x0 = 31.0, x1 = 41.5, z0 = 4.4, z1 = 13.4, [gmin, gmax] = groundMinMax(x0, x1, z0, z1), g = gmax + 0.3, yE = g + 5.7, ov = 0.4, p = 33, t = Math.tan(p * RAD), ye = yE - ov * t;
  A.box('site', x0, x1, gmin - 0.4, yE, z0, z1, 'envCream'); A.box('site', x0 - 0.03, x1 + 0.03, gmin - 0.4, g - 0.05, z0 - 0.03, z1 + 0.03, 'envBase');
  const r = hip2('envTileB2', x0 - ov, x1 + ov, z0 - ov, z1 + ov, ye, p, 40); ridge('envTileB2', r);
  const { P, fb, disc, ring } = faces(x0, x1, z0, z1), xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
  for (const f of ['S', 'N', 'W', 'E']) { const [a0, a1] = f === 'S' || f === 'N' ? [z0 - 0.06, z1 + 0.06] : [x0 - 0.06, x1 + 0.06]; fb(f, a0, a1, yE - 0.3, yE, 0, 0.06, 'envCream'); } // corniche
  const win = (f, a, y0, h, w, guard) => {
    fb(f, a - w / 2 - 0.08, a + w / 2 + 0.08, y0 - 0.06, y0 + h + 0.06, -0.001, 0.02, 'appui'); fb(f, a - w / 2, a + w / 2, y0, y0 + h, 0.02, 0.03, 'envGlass');
    for (const s of [-1, 1]) fb(f, a + s * (w / 2 + 0.1) - (s > 0 ? 0 : w / 2), a + s * (w / 2 + 0.1) + (s > 0 ? w / 2 : 0), y0, y0 + h, 0.02, 0.05, 'white');
    if (guard) { const p0 = P(f, a - w / 2, 0, 0.06), p1 = P(f, a + w / 2, 0, 0.06); railing([p0[0], p0[2]], [p1[0], p1[2]], y0 + 0.02, y0 + 0.02, 0.38); }
  };
  // façade est : fenêtre au sud, porte à auvent au centre, porte-fenêtre au nord ; à l'étage 2 fenêtres et oculus sous le fronton
  win('E', xm + 3.0, g + 0.9, 1.35, 1.0); win('E', xm - 3.0, g + 0.05, 2.2, 1.0); win('E', xm + 3.0, g + 3.25, 1.3, 0.9); win('E', xm - 3.0, g + 3.25, 1.3, 0.9);
  fb('E', xm - 0.6, xm + 0.6, g - 0.05, g + 2.32, -0.001, 0.02, 'appui'); fb('E', xm - 0.48, xm + 0.48, g, g + 2.22, 0.02, 0.05, 'envQuoin'); fb('E', xm - 0.85, xm + 0.85, g + 2.42, g + 2.56, 0, 0.28, 'envCream');
  A.box('site', xm - 0.8, xm + 0.8, gmin - 0.2, g - 0.02, z0 - 0.5, z0, 'envBase'); lanterne(fb, 'E', xm + 1.0, g + 2.1);
  ring('E', 'appui', xm, g + 4.0, 0.02, 0.3, 0.42); disc('E', 'envGlass', xm, g + 4.0, 0.015, 0.31);
  { const hb = 1.25, ya = yE + 0.7, yp = ya + 0.12, zb = z0 - ov + (yp - ye) / t; A.polyN('site', 'envCream', [[xm - hb, yE, z0], [xm + hb, yE, z0], [xm, ya, z0]], [0, 0, -1]);
    for (const s of [-1, 1]) { const q = [[xm + s * (hb + 0.35), ye, z0 - ov], [xm, yp, z0 - ov], [xm, yp, zb]]; rface('site', 'envTileB2', q, [s, 1, -1]); rface('site', 'envSoffit', q, [-s, -1, 1]); } }
  // façade ouest : 3 travées ; façade nord : petite fenêtre à barreaux à l'étage ; descentes aux angles de l'entrée
  for (const a of [xm - 3.0, xm, xm + 3.0]) { win('W', a, g + 0.9, 1.35, 1.0); win('W', a, g + 3.25, 1.3, 0.9, true); }
  fb('N', zm - 0.32, zm + 0.32, g + 3.6, g + 4.3, -0.001, 0.02, 'appui'); fb('N', zm - 0.25, zm + 0.25, g + 3.67, g + 4.23, 0.02, 0.03, 'envGlass'); for (const a of [-0.12, 0, 0.12]) fb('N', zm + a - 0.01, zm + a + 0.01, g + 3.67, g + 4.23, 0.03, 0.045, 'blackMatte');
  for (const a of [x0 + 0.12, x1 - 0.12]) fb('E', a - 0.04, a + 0.04, g - 0.1, ye, 0.02, 0.1, 'appui');
  // souche enduite sur le faîtage côté nord, épis de faîtage
  { const cx = r.a[0] + 0.7, cz = r.a[1]; A.box('site', cx - 0.3, cx + 0.3, r.yr - 0.8, r.yr + 1.0, cz - 0.35, cz + 0.35, 'envCream'); A.box('site', cx - 0.36, cx + 0.36, r.yr + 1.0, r.yr + 1.08, cz - 0.41, cz + 0.41, 'coping'); }
  for (const e of [r.a, r.b]) A.box('site', e[0] - 0.03, e[0] + 0.03, r.yr, r.yr + 0.42, e[1] - 0.03, e[1] + 0.03, 'envZinc');
}

// ---------------------------------------------------------------- murs, portails et haies
function wallLine(layer, mat, cap, pts, t0, t1, h) { // mur enduit suivant le terrain le long d'une polyligne, chaperon
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const g0 = C.hAt(p0[0], p0[1]), g1 = C.hAt(p1[0], p1[1]);
    C.sbox(layer, mat, p0, p1, t0, t1, g0 - 0.3, g1 - 0.3, h + 0.3);
    if (cap) C.sbox(layer, cap, p0, p1, t0 - 0.03, t1 + 0.03, g0 + h, g1 + h, 0.05);
  }
}
const seg = (p0, p1, step) => { const n = Math.max(1, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / step)); return Array.from({ length: n + 1 }, (_, i) => C.lerp2(p0, p1, i / n)); };
function pier(x, z, h, mat, cap, s = 0.2) { const g = C.hAt(x, z); C.A.box('site', x - s, x + s, g - 0.3, g + h, z - s, z + s, mat); C.A.box('site', x - s - 0.04, x + s + 0.04, g + h, g + h + 0.06, z - s - 0.04, z + s + 0.04, cap); }
function hedgeRow(pts, w, h, seed, flat = false) { // haie taillée par tronçons de 2 m, hauteur légèrement variable ; flat : dessus horizontal (h au-dessus du point haut)
  const r = C.rng(seed), yT = flat ? Math.max(...pts.map(p => C.hAt(p[0], p[1]))) + h : 0;
  for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i], p1 = pts[i + 1], g0 = C.hAt(p0[0], p0[1]), g1 = C.hAt(p1[0], p1[1]), hh = h * (0.93 + r() * 0.14), dw = (r() - 0.5) * (flat ? 0.04 : 0.15);
    if (flat) { const yb = Math.min(g0, g1) - 0.15; C.sbox('site', 'hedge', p0, p1, -w / 2 - dw, w / 2 + dw, yb, yb, yT - yb); }
    else C.sbox('site', 'hedge', p0, p1, -w / 2 - dw, w / 2 + dw, g0 - 0.15, g1 - 0.15, hh + 0.15); }
}
function streetFronts() {
  matsOuest();
  const { zWest, xSouth, A, hAt, BND, RUE } = C;
  // muret à chaperon surmonté d'une grille à barreaux noirs, par tronçons horizontaux (redans) ; l'intérieur de la propriété est à droite du sens de parcours
  const murGrille = (pts, hw, hr, mat) => { for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1], g0 = hAt(p0[0], p0[1]), g1 = hAt(p1[0], p1[1]), gb = Math.min(g0, g1) - 0.3, top = Math.max(g0, g1) + hw, l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const q = p => [p[0] + (p1[1] - p0[1]) / l * 0.1, p[1] - (p1[0] - p0[0]) / l * 0.1], c = q(p0);
    C.sbox('site', mat, p0, p1, 0, 0.2, gb, gb, top - gb); C.sbox('site', 'coping', p0, p1, -0.03, 0.23, top, top, 0.05);
    railing(q(p0), q(p1), top + 0.05, top + 0.05, hr); A.box('site', c[0] - 0.02, c[0] + 0.02, top + 0.05, top + hr - 0.02, c[1] - 0.02, c[1] + 0.02, 'blackMatte');
  } };
  // vantail de portail ou portillon entre p0 et p1 : soubassement plein (mp) jusqu'à hp, barreaux à pointes jusqu'à ht, montants et traverses (mf)
  const vantail = (p0, p1, g, hp, ht, mp, mf = 'blackMatte') => {
    C.sbox('site', mp, p0, p1, -0.015, 0.015, g + 0.06, g + 0.06, hp - 0.06); if (ht - hp > 0.05) railing(p0, p1, g + hp, g + hp, ht - hp);
    for (const p of [p0, p1]) A.box('site', p[0] - 0.025, p[0] + 0.025, g + 0.04, g + Math.max(hp, ht - 0.12), p[1] - 0.025, p[1] + 0.025, mf);
    for (const y of [g + 0.04, g + hp - 0.03]) C.sbox('site', mf, p0, p1, -0.025, 0.025, y, y, 0.05);
  };

  // ---- en face, rue des Merlettes (côté ouest), du sud au nord, nu sur rue au dos du trottoir (nu relevé au plan de masse, RUE.oF ; ouvrages : photos 6, 7, 12 à 14, 5, 17)
  const zF = x => zWest(x) + RUE.oF(x), W = (x, o = 0) => [x, zF(x) + o], gW = x => RUE.SWo(x), pil = (x, mat, h = 1.95, s = 0.21, cap = 'coping') => pier(x, zF(x) + s, h, mat, cap, s);
  // n° 4 (angle de la rue des Fauvettes) : muret en crépi blanc à chaperon gris et grille à barreaux noirs, pan coupé à l'angle (plan de masse : (17,08 ; 19,18) → (19,34 ; 21,16)),
  // retour sur la rue des Fauvettes parallèle à la limite C–D, massif d'arbustes derrière
  const [pc0, pc1] = RUE.PC, s4 = [pc1[0] + (xSouth(34) - xSouth(pc1[1])), 34];
  murGrille(seg(s4, pc1, 2.4), 0.72, 0.95, 'envRough'); murGrille(seg(pc1, pc0, 2.4), 0.72, 0.95, 'envRough'); murGrille(seg(pc0, W(7.81), 2.4), 0.72, 0.95, 'envRough');
  hedgeRow(seg(W(16.2, 1.0), W(8.4, 1.0), 2), 1.1, 1.9, 81); hedgeRow(seg([s4[0] - 1.0, 33], [pc1[0] - 1.0, pc1[1] + 0.2], 2), 1.1, 1.9, 82);
  // piliers en crépi blanc à couvertine grise ; portillon (soubassement blanc, barreaux noirs, photo 14 d'oct. 2026), boîte aux lettres verte sur tablette dans
  // une niche (muret, compteur, barreaudage noir au-dessus), portail noir à 2 vantaux (soubassement plein, barreaux à pointes)
  for (const x of [7.6, 6.09, 4.89, 1.59]) pil(x, 'envRough');
  { const g = gW(6.84); vantail(W(7.39, 0.1), W(6.3, 0.1), g, 1.3, 1.72, 'white'); }
  { const g = Math.max(gW(5.88), gW(5.1)), yt = g + 0.85; C.sbox('site', 'envRough', W(5.88), W(5.1), 0, 0.3, g - 0.3, g - 0.3, 1.15); C.sbox('site', 'coping', W(5.88), W(5.1), -0.05, 0.32, yt, yt, 0.05);
    A.box('site', 5.62, 5.34, g + 0.12, g + 0.55, zF(5.48) - 0.005, zF(5.48) + 0.01, 'appui');
    vantail(W(5.88, 0.27), W(5.1, 0.27), yt, 0.5, 0.9, 'blackMatte'); A.box('site', 5.31, 5.67, yt + 0.05, yt + 0.33, zF(5.49) + 0.03, zF(5.49) + 0.24, 'envGreen'); }
  { const g = Math.max(gW(4.68), gW(1.8)); vantail(W(4.68, 0.1), W(3.24, 0.1), g, 1.3, 1.75, 'blackMatte'); vantail(W(3.24, 0.1), W(1.8, 0.1), g, 1.3, 1.75, 'blackMatte'); }
  // maison rose : mur haut enduit crème à chaperon, haie de lauriers derrière ; pilier, portillon vert, pilier, trumeau (compteur, boîte aux lettres), portail vert, pilier
  wallLine('site', 'envCream', 'coping', seg(W(1.38), W(-9.2), 1.6), 0, 0.2, 1.85);
  hedgeRow(seg(W(1.0, 0.95), W(-9.0, 0.95), 2), 1.2, 3.0, 83);
  for (const x of [-9.4, -10.8, -14.5]) pil(x, 'envCream', 1.95, 0.2);
  { const g = gW(-10.1); vantail(W(-9.6, 0.1), W(-10.6, 0.1), g, 1.6, 1.6, 'envGreen', 'envGreen'); }
  { const g = gW(-11.4); C.sbox('site', 'envCream', W(-11.0), W(-12.1), 0, 0.22, g - 0.3, g - 0.3, 1.85); C.sbox('site', 'coping', W(-11.0), W(-12.1), -0.03, 0.25, g + 1.55, g + 1.55, 0.05);
    A.box('site', -11.25, -11.65, g + 0.5, g + 1.0, zF(-11.45) - 0.01, zF(-11.45) + 0.01, 'appui'); A.box('site', -11.75, -12.0, g + 1.05, g + 1.35, zF(-11.9) - 0.03, zF(-11.9) + 0.01, 'envGreen'); }
  { const g = Math.max(gW(-12.1), gW(-14.3)); vantail(W(-12.1, 0.1), W(-13.2, 0.1), g, 1.6, 1.6, 'envGreen', 'envGreen'); vantail(W(-13.2, 0.1), W(-14.3, 0.1), g, 1.6, 1.6, 'envGreen', 'envGreen'); }
  // plus au nord : muret bas et grillage vert sur poteaux
  { const pts = seg(W(-14.7), W(-24), 2.4); wallLine('site', 'envCream', 'coping', pts, 0, 0.2, 0.3);
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], ga = hAt(a[0], a[1]) + 0.35, gb = hAt(b[0], b[1]) + 0.35; A.quadN('site', 'mesh', [[a[0], ga, a[1] + 0.1], [b[0], gb, b[1] + 0.1], [b[0], gb + 1.2, b[1] + 0.1], [a[0], ga + 1.2, a[1] + 0.1]], [0, 0, -1]); A.box('site', a[0] - 0.025, a[0] + 0.025, ga - 0.05, ga + 1.25, a[1] + 0.075, a[1] + 0.125, 'meshPost'); } }

  // ---- voisin nord, sur rue (photos 4, 5, 17 ; client, 12/10/2026) : muret enduit blanc à chaperon posé sur le trottoir (enrobé), grillage simple torsion vert ajouré
  // (on voit au travers : pas de brise-vue), poteaux verts
  const pn = seg([-30, zWest(-30)], BND.A, 2.5);
  wallLine('site', 'envWhiteN', 'coping', pn, 0, 0.2, 0.55);
  for (let i = 0; i < pn.length - 1; i++) { const a = pn[i], b = pn[i + 1], ga = hAt(a[0], a[1]) + 0.6, gb = hAt(b[0], b[1]) + 0.6, za = a[1] - 0.1, zb = b[1] - 0.1;
    A.quadN('site', 'mesh', [[a[0], ga, za + 0.01], [b[0], gb, zb + 0.01], [b[0], gb + 1.22, zb + 0.01], [a[0], ga + 1.22, za + 0.01]], [0, 0, 1]);
    A.box('site', a[0] - 0.025, a[0] + 0.025, ga - 0.05, ga + 1.25, za - 0.035, za + 0.015, 'meshPost'); }
  // haie haute du voisin nord derrière le muret de limite (photos 4, 16 à 18), droite et de niveau comme le muret (clients, 12/10/2026), et entre son jardin et la maison de maître (photo 4)
  hedgeRow(seg([-12.15, 0.1], [-12.15, 12.2], 2), 0.85, 2.35, 75, true);
  hedgeRow(seg([-17.4, 0.55], [-12.6, 0.55], 2), 0.8, 2.2, 76);

  // ---- au sud du sentier de Derrière le Gué, n° 6 (photos 8 à 10, 15) : muret crème à chaperon et grille noire à lances le long du sentier, haie derrière ;
  // façade est sur la partie nord–sud du sentier (bord à z = −1, à l'écart du virage) : pilier d'angle, portail noir à 2 vantaux, pilier à gyrophare orange,
  // muret et grille, pilier du n° 6, portillon noir, pilier
  const xl = z => RUE.xS6(z), zE = -1.0, xE = xl(zE), pS = (x, z) => pier(x, z, 1.85, 'envCream', 'coping', 0.2); // nu sur la rue : tireté du plan de masse (x 25,48 → 25,54)
  murGrille(seg([xl(zE + 0.4), zE + 0.4], [xl(30), 30], 2.4), 0.85, 0.85, 'envCream');
  hedgeRow(seg([xl(1.2) + 1.0, 1.2], [xl(29.5) + 1.0, 29.5], 2), 0.9, 1.9, 84);
  for (const x of [xE + 0.2, 29.7, 38.2, 40.0]) pS(x, zE + 0.2);
  { const g = Math.max(hAt(xE + 0.4, zE), hAt(29.5, zE)), zg = zE + 0.2, xm = (xE + 0.4 + 29.5) / 2; vantail([xE + 0.4, zg], [xm, zg], g, 0.9, 1.62, 'blackMatte'); vantail([xm, zg], [29.5, zg], g, 0.9, 1.62, 'blackMatte');
    const gp = hAt(29.7, zE); A.box('site', 29.62, 29.78, gp + 1.91, gp + 2.08, zE + 0.12, zE + 0.28, 'envBeacon'); }
  murGrille(seg([38.0, zE], [29.9, zE], 2.4), 0.85, 0.85, 'envCream');
  { const g = hAt(39.1, zE); vantail([38.4, zE + 0.2], [39.8, zE + 0.2], g, 0.9, 1.62, 'blackMatte'); }
}

// ---------------------------------------------------------------- jardin du voisin est : annexe, kiosque, clôtures en plaques de béton
function eastGarden() {
  const { A, hAt, sbox } = C;
  house({ x0: -9.5, x1: -4, z0: -27, z1: -19.5, h: 2.7, pitch: 30, roof: 'hip', wall: 'envCream', roofMat: 'envTileB2', ov: 0.35, door: 'W' });
  // kiosque à toit pyramidal sombre (lanternon), 3 × 3 m (position : photos 1 et 2)
  { const cx = 7.5, cz = -12, g = hAt(cx, cz), hp = 2.35, hw = 1.5;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A.box('site', cx + dx * hw - 0.05, cx + dx * hw + 0.05, g, g + hp, cz + dz * hw - 0.05, cz + dz * hw + 0.05, 'envGazebo');
    for (const [a, b, c, d] of [[-hw, hw, -hw, -hw], [-hw, hw, hw, hw], [-hw, -hw, -hw, hw], [hw, hw, -hw, hw]]) A.box('site', cx + a - 0.06, cx + b + 0.06, g + hp - 0.16, g + hp, cz + c - 0.06, cz + d + 0.06, 'envGazebo');
    const t = Math.tan(24 * RAD), R = hw + 0.3, Ri = 0.55, yr0 = g + hp + (R - Ri) * t;
    for (const [p, q] of [[[-R, -R], [R, -R]], [[R, -R], [R, R]], [[R, R], [-R, R]], [[-R, R], [-R, -R]]]) rface('site', 'envGazebo', [[cx + p[0], g + hp, cz + p[1]], [cx + q[0], g + hp, cz + q[1]], [cx + q[0] * Ri / R, yr0, cz + q[1] * Ri / R], [cx + p[0] * Ri / R, yr0, cz + p[1] * Ri / R]], [Math.sign(p[0] + q[0]), 1, Math.sign(p[1] + q[1])]);
    A.box('site', cx - Ri + 0.08, cx + Ri - 0.08, yr0, yr0 + 0.22, cz - Ri + 0.08, cz + Ri - 0.08, 'envGazebo');
    hip('site', 'envGazebo', cx - Ri - 0.1, cx + Ri + 0.1, cz - Ri - 0.1, cz + Ri + 0.1, yr0 + 0.22, 30); }
  // clôtures en plaques de béton : fond du jardin (z −22) ; limite sud après le muret (x 19,35, sur une longrine qui retient la pelouse) ;
  // côté est de la branche sud de la rue (z −7,66), plaque de rue « Rue des Merlettes » à l'angle (photos 2, 9, 11)
  const plates = (p0, p1, h, mat) => {
    const pts = seg(p0, p1, 2.0);
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; sbox('site', mat, a, b, -0.03, 0.03, hAt(a[0], a[1]) - 0.1, hAt(b[0], b[1]) - 0.1, h + 0.1); }
    for (const q of pts) { const g = hAt(q[0], q[1]); A.box('site', q[0] - 0.07, q[0] + 0.07, g - 0.1, g + h + 0.05, q[1] - 0.07, q[1] + 0.07, mat); }
  };
  plates([-4, -22], [19.35, -22], 1.95, 'envPlate');
  plates([19.35, -7.62], [19.35, -22], 1.6, 'envPlateL'); A.box('site', 19.13, 19.31, hAt(19.6, -12) - 0.3, hAt(18.9, -12) + 0.02, -22, -7.62, 'envWallC');
  plates([19.38, -7.66], [42, -7.66], 1.6, 'envPlateL');
  { const x = 19.75, z = -7.4, g = hAt(x, z); A.box('site', x - 0.025, x + 0.025, g - 0.2, g + 2.45, z - 0.025, z + 0.025, 'envZinc'); A.box('site', x + 0.025, x + 0.04, g + 2.05, g + 2.4, z - 0.3, z + 0.3, 'white'); }
}

// ---------------------------------------------------------------- point d'entrée
export function buildEnvironment(ctx) {
  C = ctx;
  const balTex = buildMaterials();
  eastBoundary();
  manor(balTex);
  eastGarden();
  northHouse();
  // en face : n° 4 et maison rose rue des Merlettes, n° 6 au sud du sentier de Derrière le Gué
  westHouses();
  southHouse();
  streetFronts();
  // arbres : cèdre au nord-est de la maison de maître, cerisier, grands arbres derrière les clôtures, massifs sombres au sud-est
  cedar(-29.5, -9.5, 1.0);
  leafy(15.5, -3.5, 1.0, { r: 1.8, n: 24, hue: 0.22, sat: 0.4, light: 0.32, trunk: 1.8 });
  for (const [x, z, s] of [[-14.5, -25.5, 1.7], [-21, -24, 1.5], [-2.5, -26.5, 1.6], [6.5, -25.8, 1.9], [12.5, -27, 1.6]]) leafy(x, z, s, { hue: 0.24, sat: 0.38, light: 0.24 });
  for (const [x, z, s] of [[16.0, -19.0, 1.9], [28.5, -10.8, 1.9], [29.5, -17.5, 2.2], [35, -10, 1.8], [27.8, -27, 2.0]]) leafy(x, z, s, { hue: 0.29, sat: 0.3, light: 0.13, r: 2.1, n: 40 });
  leafy(-1.5, 46, 1.6, { hue: 0.25, sat: 0.35, light: 0.24 }); leafy(13.5, 40, 1.4, { hue: 0.24, sat: 0.36, light: 0.26 }); leafy(-18, 27, 1.5, { hue: 0.26, sat: 0.36, light: 0.22 }); leafy(39.5, 24, 1.7, { hue: 0.25, sat: 0.36, light: 0.22 });
  flushTrees();
  flushFaces();
}
