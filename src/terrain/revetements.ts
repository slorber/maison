// Revêtements drapés sur le terrain (enrobé, gravillon, paillage, bandes de pelouse) : maillages qui suivent hAt
import * as THREE from 'three';
import { hAt, polyInfo } from './relief';
import { M } from '../noyau/materiaux';
import { groups } from '../noyau/etat';

export function overlayQuad(layer, mat, c, lift, nu, nv) { // c : [[x,z]x4] p00 p10 p11 p01
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    const x = (c[0][0] * (1 - u) + c[1][0] * u) * (1 - v) + (c[3][0] * (1 - u) + c[2][0] * u) * v;
    const z = (c[0][1] * (1 - u) + c[1][1] * u) * (1 - v) + (c[3][1] * (1 - u) + c[2][1] * u) * v;
    pos.push(x, hAt(x, z) + lift, z); uv.push(x, -z);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, cc = a + nu + 2, d = a + nu + 1; idx.push(a, d, cc, a, cc, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  // orientation : les normales doivent pointer vers le haut
  const n = g.attributes.normal; if (n.count && n.getY(0) < 0) { g.setIndex(idx.map((v, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); g.computeVertexNormals(); }
  const m = new THREE.Mesh(g, M[mat]); m.receiveShadow = true; groups[layer].add(m); return m;
}
export function overlayPoly(layer, mat, poly, lift, res, snap = false) { // polygone quelconque, découpé sur une grille fine ; snap : sommets extérieurs ramenés sur le contour (bord lisse, sans dents de scie)
  const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const nx = Math.ceil((x1 - x0) / res), nz = Math.ceil((z1 - z0) / res);
  const pos = [], uv = [], idx = []; const id = new Map();
  const near = (x, z) => { let b = null, bd = 1e9; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))), px = ax + t * dx, pz = az + t * dz, d = (px - x) ** 2 + (pz - z) ** 2; if (d < bd) { bd = d; b = [px, pz]; } } return b; };
  const vtx = (i, j) => { const k = i + ',' + j; if (id.has(k)) return id.get(k); let x = x0 + i * res, z = z0 + j * res; if (snap && !polyInfo(poly, x, z).inside) [x, z] = near(x, z); pos.push(x, hAt(x, z) + lift, z); uv.push(x, -z); id.set(k, pos.length / 3 - 1); return id.get(k); };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const cx = x0 + (i + 0.5) * res, cz = z0 + (j + 0.5) * res;
    if (!polyInfo(poly, cx, cz).inside) continue;
    const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i + 1, j + 1), d = vtx(i, j + 1); idx.push(a, d, c, a, c, b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, M[mat]); m.receiveShadow = true; groups[layer].add(m); return m;
}
