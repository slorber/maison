// Aménagement sous l'escalier (demande des clients : « sous l'escalier, fais du rangement sur la 1re partie, puis une banquette
// pour pouvoir se chausser », photo de référence fournie). Menuiserie sur mesure façon shaker, peinte en blanc :
// - placard dans la partie basse (x 1,50 → 2,42, toute la profondeur de 0,90 m sous la volée) : cadre de façade affleurant la joue
//   de l'escalier (z 3,27), 2 portes à cadre mouluré et panneau en retrait dont le haut suit la volée, boutons ronds RAL 7016 ;
// - joue de séparation à x 2,42, panneau mouluré côté banquette ;
// - banquette en retrait (x 2,42 → 3,86, adossée à la cloison de la cuisine) là où la hauteur sous la paillasse permet de s'asseoir
//   (1,37 m au fond de l'assise au début de la banquette, 2,45 m au bout) : assise en chêne clair assorti aux marches (h 0,45,
//   profondeur 0,52, épaisseur 40 mm, angle avant arrondi R 20 cm côté passage), caisson à chaussures blanc à 2 tiroirs à cadre
//   (ouverture par poussée), socle en retrait ; dossier en lambris chêne à lames verticales de 12 cm rampant sous la volée,
//   3 patères gris anthracite RAL 7016.
// Toute la géométrie est versée dans les seaux calque × matériau de l'accumulateur A (un seul mesh par matériau à A.build) :
// blanc, joints et chêne des marches partagent des seaux existants ou n'en créent qu'un ; appelé après buildMobilier, avant A.build(groups).
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Ctx, Vec3 } from '../types';
import { RISE, GO, ZS, ZF, XM, soffitY } from '../maison/traceEscalier';

const LY = 'furn0';
let A;
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- outils géométriques
// UV en mètres par projection sur l'axe dominant de la normale (même convention que A.quad)
const uvBox = (x, y, z, nx, ny, nz) => { const X = Math.abs(nx), Y = Math.abs(ny), Z = Math.abs(nz);
  return X >= Y && X >= Z ? [nx > 0 ? -z : z, y] : Y >= Z ? [x, -z] : [nz > 0 ? x : -x, y]; };
// verse une géométrie (coordonnées monde) dans le seau calque × matériau de l'accumulateur
function put(mat, geo, uvf = uvBox) {
  const p = geo.attributes.position, n = geo.attributes.normal, b = A.bucket(LY, mat), i0 = b.pos.length / 3;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    b.pos.push(x, y, z); b.nor.push(nx, ny, nz); b.uv.push(...uvf(x, y, z, nx, ny, nz));
  }
  const ix = geo.index; for (let i = 0, c = ix ? ix.count : p.count; i < c; i++) b.idx.push(i0 + (ix ? ix.getX(i) : i));
  geo.dispose();
}
// contour et trous remis dans le sens trigonométrique : ExtrudeGeometry inverse alors le contour et garde les trous (sens opposés exigés)
const ccw = q => { const v = q.map(([a, b]) => V2(a, b)); return THREE.ShapeUtils.isClockWise(v) ? v.reverse() : v; };
const shape = (pts, holes) => { const s = new THREE.Shape(ccw(pts)); for (const h of holes || []) s.holes.push(new THREE.Path(ccw(h))); return s; };
// extrusion d'épaisseur totale depth, arêtes chanfreinées (ou adoucies si bs > 1) de b
const ext = (sh, depth, b = 0, cs = 1, bs = 1) => new THREE.ExtrudeGeometry(sh, { depth: depth - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: bs, curveSegments: cs });
// prisme de contour [x, y] (trous possibles) entre z0 et z1
const prismXY = (pts, holes, z0, z1, b = 0, bs = 1) => ext(shape(pts, holes), z1 - z0, b, 1, bs).translate(0, 0, z0 + b);
// prisme de contour [z, y] entre x0 et x1
const prismZY = (pts, holes, x0, x1, b = 0, bs = 1) => { const m = q => q.map(([z, y]) => [-z, y]);
  return ext(shape(m(pts), (holes || []).map(m)), x1 - x0, b, 1, bs).rotateY(Math.PI / 2).translate(x0 + b, 0, 0); };
// prisme vertical (y0 → y1) sur le rectangle x a → b, z c → d dont l'angle (b, c) est arrondi de rayon r ; normales lissées sur l'arrondi
function rounded(a, b, c, d, r, y0, y1, bev = 0, bs = 1) {
  const s = new THREE.Shape(); s.moveTo(a, -d); s.lineTo(b, -d); s.lineTo(b, -c - r); s.absarc(b - r, -c - r, r, 0, Math.PI / 2, false); s.lineTo(a, -c); s.lineTo(a, -d);
  return toCreasedNormals(ext(s, y1 - y0, bev, 12, bs).rotateX(-Math.PI / 2).translate(0, y0 + bev, 0), Math.PI / 6);
}
// cylindre de a à b
function rodG(a, b, r, seg = 8) {
  const pa = V3(...(a as Vec3)), pb = V3(...(b as Vec3)), d = pb.clone().sub(pa), len = d.length();
  return new THREE.CylinderGeometry(r, r, len, seg).applyMatrix4(new THREE.Matrix4().compose(pa.add(pb).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()), V3(1, 1, 1)));
}
// cadre rapporté (montants et traverses de largeur w) sur un contour à 4 sommets [bas gauche, bas droit, haut droit, haut gauche],
// le haut pouvant être rampant (pente s) : la traverse haute garde la largeur w perpendiculairement à la pente
const inset = (q, w, s = 0) => { const k = Math.hypot(1, s); return [[q[0][0] + w, q[0][1] + w], [q[1][0] - w, q[1][1] + w], [q[2][0] - w, q[2][1] - w * s - w * k], [q[3][0] + w, q[3][1] + w * s - w * k]]; };

// ---------------------------------------------------------------- matériaux
function materials(ctx) {
  const { M, std, makeTex, rng } = ctx;
  // lambris chêne clair (teinte et fil des marches), lames verticales de 12 cm à joints en V : motif de 8 lames (0,96 m)
  const lam = makeTex(512, 0.96, (g, s) => {
    const r = rng(1207), n = 8, bw = s / n;
    g.fillStyle = '#d9c4a0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      const x0 = i * bw, t = (r() - 0.5) * 0.14;
      g.fillStyle = `rgba(${t > 0 ? '255,244,222' : '150,112,70'},${Math.abs(t) * 2.2})`; g.fillRect(x0, 0, bw, s);
      for (let k = 0; k < 16; k++) { // fil vertical légèrement ondulé, périodique sur la hauteur du motif
        const xc = x0 + 3 + r() * (bw - 6), a = 0.5 + r() * 2.2, f = 1 + Math.floor(r() * 3), ph = r() * 6.28;
        g.strokeStyle = `rgba(140,100,60,${0.06 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.2; g.beginPath();
        for (let y = 0; y <= s; y += 8) { const x = Math.min(x0 + bw - 3, Math.max(x0 + 3, xc + a * Math.sin(y / s * 6.2832 * f + ph))); if (y) g.lineTo(x, y); else g.moveTo(x, y); }
        g.stroke();
      }
      // joint en V : ombre franche d'un côté, reflet sur la rive de la lame voisine
      g.fillStyle = 'rgba(80,55,30,0.65)'; g.fillRect(x0, 0, 2, s);
      g.fillStyle = 'rgba(120,88,52,0.30)'; g.fillRect(x0 + 2, 0, 2, s);
      g.fillStyle = 'rgba(255,246,228,0.30)'; g.fillRect(x0 + bw - 2, 0, 2, s);
    }
  });
  M.escLambris = std({ map: lam, roughness: 0.55 });
  if (!M.mobGapW) M.mobGapW = std({ color: '#8f8d88', roughness: 0.9 }); // joints des façades blanches (créé par mobilier.js)
}

// ---------------------------------------------------------------- placard et banquette
export function buildSousEscalier(ctx: Ctx) {
  A = ctx.A; materials(ctx);
  const W = 'white', G = 'mobGapW', H = 'handle'; // laqué blanc satiné, joints, quincaillerie gris anthracite RAL 7016
  // volée droite de buildStair (traceEscalier.ts) : 16 hauteurs, giron constant de la dernière balancée à l'arrivée (x 3,91), sous-face de la paillasse sof(x)
  const rise = RISE, sl = rise / GO, k = Math.hypot(1, sl);
  const sof = soffitY;
  const zj = ZS, zw = ZF; // joue de l'escalier au jour (façade), cloison escalier / cuisine (fond)
  const x0 = XM; // fin du massif des marches balancées
  const xp = 2.42; // joue de séparation, côté banquette : sof(xp) = 1,37 m
  const xb = 3.86; // about de la cloison : bout de la banquette

  // ---- placard : cadre de façade de 20 mm affleurant la joue (montants 4 cm, traverse basse 8 cm, traverse rampante 4 cm sous la paillasse)
  const fz = zj + 0.02, st = 0.04, rb = 0.08, oa = x0 + st, ob = xp - st;
  const top = x => sof(x) - 0.04 * k; // haut de la baie des portes
  put(W, prismXY([[x0, 0], [xp, 0], [xp, sof(xp)], [x0, sof(x0)]], [[[oa, rb], [ob, rb], [ob, top(ob)], [oa, top(oa)]]], zj, fz));
  A.quadN(LY, G, [[oa, rb, fz + 0.0005], [ob, rb, fz + 0.0005], [ob, top(ob), fz + 0.0005], [oa, top(oa), fz + 0.0005]], [0, 0, -1]); // fond des jeux
  // 2 portes battantes : panneau en retrait de 10 mm, cadre de 6,5 cm à arêtes arrondies (moulure), jeux de 3 mm
  const gp = 0.003, xm = (oa + ob) / 2, sw = 0.065;
  for (const [a, b] of [[oa + gp, xm - gp / 2], [xm + gp / 2, ob - gp]]) {
    const q = [[a, rb + gp], [b, rb + gp], [b, top(b) - gp], [a, top(a) - gp]];
    put(W, prismXY(q, null, zj + 0.010, fz));
    put(W, prismXY(q, [inset(q, sw, sl)], zj, zj + 0.014, 0.004, 2));
  }
  // boutons ronds Ø 34 mm, gris anthracite, sur les montants de battement
  const knob = new THREE.LatheGeometry([[0, 0], [0.010, 0], [0.007, 0.010], [0.0075, 0.016], [0.016, 0.022], [0.017, 0.028], [0.013, 0.034], [0, 0.035]].map(([r, y]) => V2(r, y)), 12).rotateX(-Math.PI / 2);
  for (const x of [xm - gp / 2 - sw / 2, xm + gp / 2 + sw / 2]) put(H, knob.clone().translate(x, 0.80, zj));
  knob.dispose();

  // ---- joue de séparation (22 mm), haut rampant sous la paillasse ; panneau mouluré rapporté côté banquette, devant l'assise
  const zs = 3.65; // nez de l'assise
  put(W, prismXY([[xp - 0.022, 0], [xp, 0], [xp, sof(xp)], [xp - 0.022, sof(xp - 0.022)]], null, fz, zw));
  { const q = [[fz + 0.025, 0.10], [zs - 0.03, 0.10], [zs - 0.03, sof(xp) - 0.07], [fz + 0.025, sof(xp) - 0.07]];
    put(W, prismZY(q, [inset(q, 0.045)], xp - 0.003, xp + 0.008, 0.003, 2)); }

  // ---- banquette : caisson à chaussures (socle en retrait de 25 mm), 2 tiroirs à cadre, assise en chêne à angle avant arrondi
  const ys = 0.45, es = 0.04, rS = 0.20; // dessus de l'assise, épaisseur, rayon de l'angle
  const zc = zs + 0.03, xc = xb - 0.03, rC = rS - 0.03, yk = 0.06, yt = ys - es; // façade et bout du caisson (débord de l'assise 3 cm), socle
  put(W, rounded(xp, xc - 0.025, zc + 0.025, zw, rC - 0.025, 0, yk));
  put(W, rounded(xp, xc, zc, zw, rC, yk, yt, 0.002));
  const xd = [xp, (xp + xc - rC) / 2, xc - rC]; // tiroirs : de la joue au milieu, du milieu au départ de l'arrondi
  for (let i = 0; i < 2; i++) {
    const a = xd[i] + 0.014, b = xd[i + 1] - 0.012, q = [[a, yk + 0.015], [b, yk + 0.015], [b, yt - 0.015], [a, yt - 0.015]];
    put(W, prismXY(q, [inset(q, 0.05)], zc - 0.008, zc + 0.002, 0.003, 2));
  }
  for (const x of xd.slice(1)) A.quadN(LY, G, [[x - 0.0015, yk, zc - 0.0005], [x + 0.0015, yk, zc - 0.0005], [x + 0.0015, yt, zc - 0.0005], [x - 0.0015, yt, zc - 0.0005]], [0, 0, -1]);
  // assise : chêne clair lamellé-collé des marches, lamelles dans la longueur, arêtes adoucies
  const uvSeat = (x, y, z, nx, ny) => Math.abs(ny) > 0.5 ? [z, x] : [y, x - z];
  put('stairTile', rounded(xp, xb, zs, zw, rS, yt, ys, 0.004, 2), uvSeat);

  // ---- dossier : lambris chêne de 15 mm, lames verticales de 12 cm calées sur la joue, de l'assise à la sous-face de la paillasse
  const uvLam = (x, y, z, nx, ny) => Math.abs(nx) > 0.5 ? [z, y] : Math.abs(ny) > 0.5 ? [x - xp, z] : [x - xp, y];
  put('escLambris', prismXY([[xp, ys], [xb, ys], [xb, sof(xb) - 0.003], [xp, sof(xp) - 0.003]], null, zw - 0.015, zw), uvLam);
  // 3 patères simples (rosace Ø 28 mm, crochet relevé à bout boule) à 1,60 m, sous la paillasse (≥ 1,90 m au droit de la première)
  for (const x of [3.12, 3.42, 3.72]) {
    const y = 1.60, z = zw - 0.015;
    put(H, new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12).rotateX(Math.PI / 2).translate(x, y, z - 0.004));
    put(H, rodG([x, y, z - 0.006], [x, y - 0.012, z - 0.062], 0.0055));
    put(H, rodG([x, y - 0.012, z - 0.062], [x, y + 0.018, z - 0.070], 0.005));
    put(H, new THREE.SphereGeometry(0.0075, 8, 5).translate(x, y + 0.02, z - 0.070));
  }
}
