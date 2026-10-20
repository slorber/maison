// Toiture 4 pans à 35° (pans coupés en limite), débords et gouttières
import * as THREE from 'three';
import { H, L, D } from './plan';
import { A } from '../noyau/geometrie';
import { M } from '../noyau/materiaux';
import { groups } from '../noyau/etat';

// ---------------------------------------------------------------- toiture 4 pans 35°
// zMin : pans coupés au plan z = zMin (pan est arrêté au nu du mur en limite)
export function hipRoof(layer, x0, x1, z0, z1, ye, pitch, mat, zMin = -Infinity) {
  const t = Math.tan(pitch * Math.PI / 180);
  const run = Math.min(x1 - x0, z1 - z0) / 2; const yr = ye + run * t;
  const zr = (z0 + z1) / 2, rx0 = x0 + run, rx1 = x1 - run;
  const faces = [
    [[x0, ye, z0], [x1, ye, z0], [rx1, yr, zr], [rx0, yr, zr]],
    [[x1, ye, z1], [x0, ye, z1], [rx0, yr, zr], [rx1, yr, zr]],
    [[x0, ye, z1], [x0, ye, z0], [rx0, yr, zr]],
    [[x1, ye, z0], [x1, ye, z1], [rx1, yr, zr]],
  ];
  const pos = [], uv = [];
  const V = a => new THREE.Vector3(...a);
  const clip = f => { const out = []; for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], ia = a[2] >= zMin - 1e-9, ib = b[2] >= zMin - 1e-9;
    if (ia) out.push(a); if (ia !== ib) { const u = (zMin - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, zMin]); } } return out; };
  for (const f0 of faces) {
    const p0 = V(f0[0]), p1 = V(f0[1]); const e = p1.clone().sub(p0).normalize();
    const c = f0.length === 4 ? V(f0[3]) : V(f0[2]); const up = c.clone().sub(p0); up.sub(e.clone().multiplyScalar(up.dot(e))).normalize();
    const f = clip(f0); if (f.length < 3) continue;
    for (let i = 1; i < f.length - 1; i++) for (const k of [0, i + 1, i]) { const p = V(f[k]); pos.push(p.x, p.y, p.z); const r = p.clone().sub(p0); uv.push(r.dot(e), r.dot(up)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, M[mat]); m.castShadow = m.receiveShadow = true; groups[layer].add(m);
  return { yr, zr, rx0, rx1 };
}
export function buildRoof() {
  // débords de 15 cm au nord, au sud et à l'ouest (coupe AA : planche de rive à 15 cm du nu de l'enduit, égout +5,67) ; à l'est, pan arrêté au nu
  // du mur en limite (gouttière havraise, égout +5,78 des façades, plans travaux v3 p. 6) : pans à 35° tracés comme pour un débord de 15 cm puis coupés à z = 0
  // (5,67 + 0,15 × tan 35° = 5,775) ; faîtage +8,54 long de 5,00 m (façade ouest), de x 3,95 à 8,95, à z 3,95 (pignon nord : 3,96 du nu est)
  const ov = 0.15, x0 = -ov, x1 = L + ov, z0 = -ov, z1 = D + ov, ye = H.eave;
  const { yr, zr, rx0, rx1 } = hipRoof('roof', x0, x1, z0, z1, ye, 35, 'roof', 0);
  const V = a => new THREE.Vector3(...a);
  const cut = (a, b) => { if (b[2] >= 0) return b; const u = -a[2] / (b[2] - a[2]); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 0]; };
  // faîtage et arêtiers en tuiles demi-rondes
  const lines = [[[rx0, yr, zr], [rx1, yr, zr]], [[rx0, yr, zr], cut([rx0, yr, zr], [x0, ye, z0])], [[rx0, yr, zr], [x0, ye, z1]], [[rx1, yr, zr], cut([rx1, yr, zr], [x1, ye, z0])], [[rx1, yr, zr], [x1, ye, z1]]];
  for (const [a, b] of lines) {
    const va = V(a), vb = V(b); const len = va.distanceTo(vb);
    const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, len, 10), M.ridge);
    cm.position.copy(va).add(vb).multiplyScalar(0.5); cm.position.y += 0.03;
    cm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()); cm.castShadow = true; groups.roof.add(cm);
  }
  // sous-faces (5,47 → 5,49, coupe AA), cache-moineaux PVC anthracite ; rien au-delà de la limite est (z < 0)
  A.box('roof', x0, 0, 5.47, 5.49, 0, z1, 'soffit');
  A.box('roof', L, x1, 5.47, 5.49, 0, z1, 'soffit');
  A.box('roof', 0, L, 5.47, 5.49, D, z1, 'soffit');
  A.box('roof', x0, x0 + 0.025, 5.47, ye + 0.02, 0, z1, 'soffit');
  A.box('roof', x1 - 0.025, x1, 5.47, ye + 0.02, 0, z1, 'soffit');
  A.box('roof', x0, x1, 5.47, ye + 0.02, z1 - 0.025, z1, 'soffit');
  // gouttières moulurées alu 7016 accrochées à la planche de rive (coupe AA : 17 cm de saillie, de +5,50 à +5,62)
  const gut = (bx0, bx1, bz0, bz1) => { A.box('roof', bx0, bx1, ye - 0.17, ye - 0.05, bz0, bz1, 'alu'); };
  gut(x0 - 0.17, x0, 0, z1 + 0.17); gut(x1, x1 + 0.17, 0, z1 + 0.17); gut(x0, x1, z1, z1 + 0.17);
  A.box('roof', 0, L, H.eaveE - 0.02, H.eaveE + 0.04, -0.015, 0.20, 'alu'); // gouttière havraise en limite (égout +5,78), au droit du mur est
  // descentes rectangulaires alu 7016 : NO et SO (façade ouest), NE (pignon nord), SE (pignon sud)
  const dp = (x, z, yTop) => A.box('rdc', x - 0.04, x + 0.04, -0.6, yTop, z - 0.03, z + 0.03, 'alu');
  // axes relevés sur les symboles EP du plan RDC (plans travaux v3 p. 9) : (0,36 ; 7,99), (12,54 ; 7,99), (12,99 ; 0,22) ; pignon nord : z 0,10 → 0,21 (façade nord)
  dp(0.361, D + 0.089, ye - 0.15); A.box('roof', 0.321, 0.401, ye - 0.25, ye - 0.10, D + 0.059, z1 + 0.07, 'alu');
  dp(L - 0.359, D + 0.089, ye - 0.15); A.box('roof', L - 0.399, L - 0.319, ye - 0.25, ye - 0.10, D + 0.059, z1 + 0.07, 'alu');
  A.box('rdc', -0.08, -0.02, -0.6, ye - 0.15, 0.115, 0.195, 'alu'); A.box('roof', x0 - 0.10, -0.02, ye - 0.25, ye - 0.10, 0.115, 0.195, 'alu');
  A.box('rdc', L + 0.062, L + 0.122, -0.6, ye - 0.15, 0.179, 0.259, 'alu'); A.box('roof', L + 0.062, x1 + 0.10, ye - 0.25, ye - 0.10, 0.179, 0.259, 'alu');
}
