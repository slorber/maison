// Planchers, cloisons, portes intérieures, placards et équipements fixes du RDC et de l'étage
import * as THREE from 'three';
import { H, L, D, T, SH, E1 } from './plan';
import { buildStair } from './escalier';
import { Acc, A, wall, mergeStatic } from '../noyau/geometrie';
import { M, std } from '../noyau/materiaux';
import { MAX_ANISO } from '../noyau/textures';
import { smooth } from '../noyau/outils';
import { groups, DOORS } from '../noyau/etat';
import type { Door } from '../types';

// ---------------------------------------------------------------- planchers, cloisons, escalier
export function buildInterior() {
  // RDC : carrelage (entrée, WC, cuisine, séjour, sous l'escalier), garage béton à -0,13
  A.box('rdc', T, 5.16, -0.25, 0, T, 3.30, { py: 'tileR', def: 'concrete' });
  A.box('rdc', T, L - T, -0.25, 0, 3.30, D - T, { py: 'tileR', def: 'concrete' });
  A.box('rdc', 5.31, L - SH, -0.38, -0.13, SH, 3.15, { py: 'garageFloor', def: 'concrete' });
  // dalle étage, trémie escalier x 0,36→3,91 / z 3,17→4,17
  const yS = H.r1Floor - 0.008;
  const sl = { py: 'ceiling', ny: 'ceiling', def: 'ceiling' };
  A.box('slab1', SH, L - SH, H.rdcCeil, yS, SH, 3.17, sl);
  A.box('slab1', SH, L - SH, H.rdcCeil, yS, 4.17, D - SH, sl);
  A.box('slab1', 3.91, L - SH, H.rdcCeil, yS, 3.17, 4.17, sl);
  // plafond du garage et du local technique à +2,40 (coupe AA : 2,53 sous plafond depuis le sol à −0,13, isolant 7/20 sous la dalle)
  A.box('slab1', 5.31, L - SH, H.garageCeil, H.rdcCeil, SH, 3.15, sl);
  // jour de 10 cm laissé vide entre la cloison de la salle de bains (z 3,17) et la joue de l'escalier (z 3,27)
  // parquet partout à l'étage, carrelage 60×60 dans les pièces d'eau (posé par-dessus)
  const pq = { py: 'parquet', def: 'ceiling' };
  A.box('slab1', T, L - T, yS, yS + 0.004, T, 3.17, pq);
  A.box('slab1', T, L - T, yS, yS + 0.004, 4.17, D - T, pq);
  A.box('slab1', 3.91, L - T, yS, yS + 0.004, 3.17, 4.17, pq);
  const tw = { py: 'tileW', def: 'ceiling' };
  A.box('slab1', T, 3.86, yS + 0.004, H.r1Floor, T, 3.10, tw); // bains
  A.box('slab1', 3.93, 4.83, yS + 0.004, H.r1Floor, T, 2.11, tw); // WC
  A.box('slab1', 4.90, 6.31, yS + 0.004, H.r1Floor, T, 3.10, tw); // douche (1,41 × 2,74 = 3,86 m²)
  // plafond étage + isolant
  A.box('ceil1', T, L - T, H.r1Ceil, H.r1Ceil + 0.12, T, D - T, { ny: 'ceiling', py: 'insul', def: 'ceiling' });

  const P = { neg: 'paint', pos: 'paint', end: 'paint', top: 'cut' };
  const d0 = 2.04;
  // cloisons RDC
  wall('rdc', 'x', 1.36, 1.43, T, 2.43, 0, H.rdcCeil, [{ a0: 1.33, a1: 2.16, y0: 0, y1: d0 }], P); // WC / entrée (PP 73 : baie x 1,33 → 2,16, plan p. 9)
  wall('rdc', 'z', 2.36, 2.43, T, 1.43, 0, H.rdcCeil, [], P); // WC / placard
  A.box('rdc', 2.43, 2.65, 0, H.rdcCeil, 0.99, 1.43, 'paint'); // gaine colonnes WC et bains
  wall('rdc', 'z', 5.16, 5.31, SH, 3.30, -0.13, H.rdcCeil, [{ a0: 1.36, a1: 2.29, y0: 0, y1: d0 }], { neg: 'paint', pos: 'garageWall', end: 'paint', top: 'cut' }); // entrée / garage (ISO 83 : baie z 1,36 → 2,29, plan p. 9)
  wall('rdc', 'x', 3.15, 3.30, 5.31, L - SH, -0.13, H.rdcCeil, [], { neg: 'garageWall', pos: 'paint', end: 'paint', top: 'cut' }); // garage / séjour
  // cloison 7 cm à 1,70 m de la porte entrée / garage, juste après le lave-linge : local technique (PAC, lave-linge, nourrice, tableau) / garage,
  // porte de service côté conducteur de la voiture, tableau ouest à 60 cm de la cloison du séjour (z 3,15) : passage 1,67 → 2,55 (client, 12/10)
  wall('rdc', 'z', 7.01, 7.08, SH, 3.15, -0.13, H.garageCeil, [{ a0: 1.67, a1: 2.55, y0: -0.13, y1: -0.13 + d0 }], { neg: 'garageWall', pos: 'garageWall', end: 'garageWall', top: 'cut' });
  // poteaux BA 25 × 25 du garage (plan travaux v3 p. 9), contre la cloison du séjour sous la poutre BA : à l'angle du local technique et
  // au droit du garage ; le troisième est noyé dans le jambage de la porte de garage (mur sud)
  for (const x0 of [5.31, 8.43]) A.box('rdc', x0, x0 + 0.25, -0.13, H.garageCeil, 2.90, 3.15, 'garageWall');
  wall('rdc', 'x', 4.17, 4.24, T, 3.86, 0, H.rdcCeil, [], P); // escalier / cuisine
  wall('rdc', 'z', 3.79, 3.86, 4.24, 4.89, 0, H.rdcCeil, [], P); // retour cuisine
  // cloisons étage
  const e = E1, c = H.r1Ceil, d1 = e + d0;
  wall('r1', 'x', 3.10, 3.17, T, 3.86, e, c, [], P); // bains / escalier
  wall('r1', 'z', 3.86, 3.93, T, 3.17, e, c, [{ a0: 2.22, a1: 3.05, y0: e, y1: d1 }], P); // bains / dégagement (PP 73 : baie z 2,22 → 3,05)
  wall('r1', 'z', 4.83, 4.90, T, 3.17, e, c, [], P); // WC / douche
  wall('r1', 'x', 2.11, 2.18, 3.93, 4.83, e, c, [{ a0: 3.97, a1: 4.80, y0: e, y1: d1 }], P); // WC (1,75 de profondeur) : PP 73, baie x 3,97 → 4,80
  wall('r1', 'z', 6.31, 6.38, T, 3.10, e, c, [{ a0: 1.62, a1: 2.42, y0: e, y1: d1 }], P); // douche / dressing (douche 1,41, dressing 2,00 ; passage, plan p. 10 : z 1,62 → 2,42)
  wall('r1', 'x', 3.10, 3.17, 4.90, 9.14, e, c, [], P);
  wall('r1', 'z', 8.38, 8.45, T, 3.10, e, c, [{ a0: 1.62, a1: 2.45, y0: e, y1: d1 }], P); // dressing / chambre 1 (PP 73 : baie z 1,62 → 2,45)
  wall('r1', 'z', 9.07, 9.14, 3.17, 4.17, e, c, [{ a0: 3.29, a1: 4.12, y0: e, y1: d1 }], P); // palier / chambre 1 (PP 73 : baie z 3,29 → 4,12)
  wall('r1', 'x', 4.17, 4.24, T, L - T, e, c, [{ a0: 4.14, a1: 4.97, y0: e, y1: d1 }, { a0: 7.19, a1: 8.02, y0: e, y1: d1 }, { a0: 8.19, a1: 9.02, y0: e, y1: d1 }], P); // PP 73 des chambres 3, 2 et du bureau
  wall('r1', 'z', 5.02, 5.09, 4.24, D - T, e, c, [], P); // chambre 3 / bureau
  wall('r1', 'z', 8.07, 8.14, 4.24, D - T, e, c, [], P); // bureau / chambre 2
  A.box('r1', 3.93, 4.15, e, c, T, 0.58, 'paint'); // coffre de décompression WC 22 × 22 (plan p. 10 ; WC 0,90 × 1,75 − 0,22² = 1,53 m²)
  A.box('r1', T, 0.58, e, c, T, 0.58, 'paint'); // coffre VMC du WC du RDC, angle nord-est des bains, 22 × 22 (bains 3,50 × 2,74 − 0,22² = 9,54 m²)
  A.box('r1', T, 0.63, e, c, 7.27, D - T, 'paint'); // coffre VMC de la cuisine, angle nord-ouest de la chambre 3, 27 × 27 (plan p. 10)
  // trappe d'accès aux combles 60 × 60 au plafond du bureau (plan p. 10 : x 5,19 → 5,79, z 4,34 → 4,94)
  A.box('ceil1', 5.19, 5.79, H.r1Ceil - 0.012, H.r1Ceil - 0.002, 4.34, 4.94, 'white'); A.box('ceil1', 5.23, 5.75, H.r1Ceil - 0.016, H.r1Ceil - 0.012, 4.38, 4.90, 'white');
  A.box('r1', 8.21, 8.38, e, c, 2.50, 3.10, 'paint'); // coffre vide garage → combles (plan p. 10 : x 8,21 → cloison, z 2,50 → 3,10), joue contre le placard du dressing côté palier

  // portes intérieures Righini Graphik (choix client) : [calque, axe du mur, milieu du mur, charnière, autre montant, sol, sens d'ouverture, épaisseur du mur]
  // baies brutes des plans p. 9 et 10 (0,83 pour les PP 73, 0,93 pour l'ISO 83), vantaux de 73 / 83 cm dans des huisseries d'environ 5 cm
  buildDoors([
    ['rdc', 'x', 1.395, 2.16, 1.33, 0, 1, 0.07, 0.73], ['rdc', 'z', 5.235, 1.36, 2.29, 0, -1, 0.15, 0.83], ['rdc', 'z', 7.045, 1.67, 2.55, -0.13, -1, 0.07, 0.83], // porte de service, ouvrant côté local technique
    ['r1', 'z', 3.895, 3.05, 2.22, e, -1, 0.07, 0.73], ['r1', 'x', 2.145, 4.80, 3.97, e, 1, 0.07, 0.73], ['r1', 'z', 8.415, 1.62, 2.45, e, 1, 0.07, 0.73],
    ['r1', 'z', 9.105, 4.12, 3.29, e, 1, 0.07, 0.73], ['r1', 'x', 4.205, 4.97, 4.14, e, 1, 0.07, 0.73], ['r1', 'x', 4.205, 8.02, 7.19, e, 1, 0.07, 0.73], ['r1', 'x', 4.205, 8.19, 9.02, e, 1, 0.07, 0.73],
  ]);
  buildClosets();

  buildStair();
}

// ---------------------------------------------------------------- portes intérieures et placards
// Righini Graphik : vantail laqué blanc à 4 rainures horizontales (photo client), huisserie et chambranles blancs,
// béquilles et rosaces gris anthracite. Les vantaux sont des groupes pivotants : un clic ouvre ou ferme la porte.
function buildDoors(list) {
  const hd = 2.04, t = 0.04, jb = 0.02, gap = 0.003, grooves = [0.43, 0.86, 1.29, 1.71];
  const mesh = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, M[m]); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  for (const [ly, ax, cc, h, o, y, side, tw, lw] of list) {
    const sg = Math.sign(o - h), fl = ly; // portes rangées avec les murs de leur niveau (pas avec le mobilier)
    const js = lw ? (Math.abs(o - h) - lw) / 2 - gap : jb; // montants d'huisserie : la baie brute moins le vantail nominal (73 / 83) et les jeux
    const UB = (u0, u1, y0, y1, w0, w1, m) => { const [a0, a1] = [Math.min(u0, u1), Math.max(u0, u1)], [b0, b1] = [Math.min(w0, w1), Math.max(w0, w1)];
      if (ax === 'x') A.box(fl, a0, a1, y0, y1, b0, b1, m); else A.box(fl, b0, b1, y0, y1, a0, a1, m); };
    // huisserie dans l'épaisseur du mur, chambranles de 6 cm sur les deux faces
    UB(h, h + sg * js, y, y + hd, cc - tw / 2 - 0.002, cc + tw / 2 + 0.002, 'doorFrame');
    UB(o - sg * js, o, y, y + hd, cc - tw / 2 - 0.002, cc + tw / 2 + 0.002, 'doorFrame');
    UB(h, o, y + hd - jb, y + hd, cc - tw / 2 - 0.002, cc + tw / 2 + 0.002, 'doorFrame');
    for (const sf of [1, -1]) { const f = cc + sf * tw / 2, f1 = f + sf * 0.012;
      UB(h - sg * 0.045, h + sg * 0.015, y, y + hd + 0.045, f, f1, 'doorFrame'); UB(o - sg * 0.015, o + sg * 0.045, y, y + hd + 0.045, f, f1, 'doorFrame');
      UB(h + sg * 0.015, o - sg * 0.015, y + hd - 0.015, y + hd + 0.045, f, f1, 'doorFrame'); }
    // vantail : repère local x = largeur (de la charnière vers la serrure), z = vers le côté d'ouverture, pivot sur l'arête de la charnière
    const U = ax === 'x' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), Wv = ax === 'x' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const pu = h + sg * (js + gap), pw = cc + side * tw / 2;
    const outer = new THREE.Group(); const mtx = new THREE.Matrix4().makeBasis(U.clone().multiplyScalar(sg), new THREE.Vector3(0, 1, 0), Wv.clone().multiplyScalar(side));
    mtx.setPosition(ax === 'x' ? new THREE.Vector3(pu, y, pw) : new THREE.Vector3(pw, y, pu)); mtx.decompose(outer.position, outer.quaternion, outer.scale);
    const g = new THREE.Group(); outer.add(g); groups[fl].add(outer);
    const wd = Math.abs(o - h) - 2 * (js + gap), lh = hd - jb - 0.012, meshes = [];
    // rainures dessinées dans une texture mipmappée des deux faces du vantail : les filets en relief (5 mm de haut, métalliques, 0,8 mm devant la laque)
    // tombaient sous le pixel et scintillaient au moindre mouvement de la vue ; chants du vantail renvoyés sur une zone unie de la texture
    if (!M.doorLeaf.map) { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 2048; const cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, 4, 2048);
      for (const gy of grooves) { const py = Math.round((1 - (gy - 0.008) / lh) * 2048); cx.fillStyle = '#a3a6aa'; cx.fillRect(0, py - 2, 4, 1); cx.fillStyle = '#c4c7ca'; cx.fillRect(0, py - 1, 4, 3); cx.fillStyle = '#e9ebec'; cx.fillRect(0, py + 2, 4, 1); }
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = MAX_ANISO.v; M.doorLeaf.map = tx; M.doorLeaf.needsUpdate = true; }
    const lg = new THREE.BoxGeometry(wd, lh, t); for (let i = 0; i < 16; i++) lg.attributes.uv.setXY(i, 0.5, 0.01);
    meshes.push(mesh(g, lg, 'doorLeaf', wd / 2, 0.008 + lh / 2, -t / 2));
    for (const hy of [0.35, 1.08, 1.80]) mesh(g, new THREE.CylinderGeometry(0.0075, 0.0075, 0.10, 12), 'inox', 0, hy, 0.004);
    // béquilles sur rosaces rondes et rosaces de clé, gris anthracite, des deux côtés ; la béquille pointe vers la charnière
    const hx = wd - 0.065, hy = 1.02, rosG = new THREE.CylinderGeometry(0.026, 0.026, 0.009, 28), keyG = new THREE.CylinderGeometry(0.019, 0.019, 0.007, 24);
    const neckG = new THREE.CylinderGeometry(0.009, 0.009, 0.05, 16), levG = new THREE.CylinderGeometry(0.0095, 0.0095, 0.13, 16);
    for (const [zf, s] of [[0, 1], [-t, -1]]) {
      const r = mesh(g, rosG, 'handle', hx, hy, zf + s * 0.0045); r.rotation.x = Math.PI / 2;
      const k = mesh(g, keyG, 'handle', hx, hy - 0.075, zf + s * 0.0035); k.rotation.x = Math.PI / 2;
      mesh(g, new THREE.BoxGeometry(0.004, 0.012, 0.002), 'blackMatte', hx, hy - 0.075, zf + s * 0.0075);
      const n = mesh(g, neckG, 'handle', hx, hy, zf + s * 0.034); n.rotation.x = Math.PI / 2;
      const l = mesh(g, levG, 'handle', hx - 0.056, hy, zf + s * 0.052); l.rotation.z = Math.PI / 2;
      meshes.push(r, n, l);
    }
    // [perf] pièces du vantail fusionnées par matériau (22 maillages → 5) ; vantail, rainures et béquilles restent cliquables (charnières et entrées de clé non, comme avant)
    meshes.length = 0; for (const m of mergeStatic([...g.children], g)) if (m.material !== M.inox && m.material !== M.blackMatte) meshes.push(m);
    const d = { g, meshes, open: 0, target: 0 }; for (const m of meshes) m.userData.door = d;
    g.rotation.y = 0; DOORS.push(d); // fermées par défaut
  }
}
export function animateDoors(dt) { // [perf] renvoie true si un ouvrant a bougé
  let mv = false;
  for (const d of DOORS) if (d.open !== d.target) { mv = true; d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * (d.speed ?? 1.6)); if (d.apply) d.apply(d.open); else d.g.rotation.y = -Math.PI / 2 * d.open; }
  return mv;
}
// Emplacements de placards des plans travaux v3 (p. 9 et 10), portes coulissantes gris clair pour les repérer :
// [calque, axe de la façade, nu de la façade (nez des retours), début, fin, sol, plafond, sens vers la pièce, profondeur jusqu'au fond, aménagement, début de l'intérieur]
// Façade logée dans l'emplacement, derrière le nu des retours (rails et vantaux ne débordent plus devant les retours ni dans les murs, 3 mm de jeu) ;
// chaque vantail (panneau pris dans deux montants alu, sans face coplanaire) est un groupe qui coulisse au clic devant ou derrière son voisin pour dégager
// sa travée (DOORS, kind 'placard' : pas d'ouverture automatique en balade), un seul vantail ouvert par placard. Intérieur ouvert en mélaminé blanc
// (murs en fond et en joues) : E étagères, P penderie (tablette à 1,80 m, tringle chromée dessous), M colonne d'étagères dans la première travée et penderie à côté.
function buildClosets() {
  const e = E1, c = H.r1Ceil, P = { neg: 'paint', pos: 'paint', end: 'paint', top: 'cut' };
  // retours de 65 cm dessinés aux plans pour les placards des chambres 2 et 3
  wall('r1', 'x', 5.22, 5.29, 8.14, 8.79, e, c, [], P);
  wall('r1', 'x', 5.22, 5.29, 4.37, 5.02, e, c, [], P);
  // dressing et chambre 1 (plan p. 10) : deux placards de 62 cm face à face de part et d'autre d'une allée de 80 cm, placard de la chambre 1
  // dans l'angle nord-est, chacun fermé côté ouest par un retour de 7 cm (plan p. 10 : z 1,50 → 1,57)
  wall('r1', 'x', 1.50, 1.57, 6.38, 6.98, e, c, [], P); wall('r1', 'x', 1.50, 1.57, 7.78, 8.38, e, c, [], P); wall('r1', 'x', 1.50, 1.57, 8.45, 9.10, e, c, [], P);
  const list: [string, string, number, number, number, number, number, number, number, string, number?][] = [
    ['rdc', 'z', 1.09, 2.65, 5.16, 0, H.rdcCeil, 1, 0.73, 'E', 2.43], // entrée : 2,73 × 0,65 (z 0,36 → 1,01) derrière le coffrage des colonnes WC / bains, façade de 8 cm devant, entre le coffrage et la cloison du garage
    ['r1', 'x', 9.10, 0.36, 1.50, e, c, 1, 0.65, 'P'], // chambre 1, dans l'angle contre le dressing
    ['r1', 'x', 7.78, 0.36, 1.50, e, c, -1, 0.60, 'P'], // dressing, placard côté chambre 1 (nu à x 7,78, plan p. 10)
    ['r1', 'x', 6.98, 0.36, 1.50, e, c, 1, 0.60, 'P'], // dressing, placard côté salle d'eau (nu à x 6,98, plan p. 10)
    ['r1', 'z', 2.50, 6.38, 8.21, e, c, -1, 0.60, 'M'], // dressing, côté palier : 1,83 × 0,60 jusqu'au coffre du garage (plan : nu à z 2,50)
    ['r1', 'x', 8.79, 5.29, D - T, e, c, 1, 0.65, 'M'], // chambre 2
    ['r1', 'x', 4.37, 5.29, D - T, e, c, -1, 0.65, 'M'], // chambre 3
  ];
  const ov = 0.02, cl = 0.003, th = 0.019, dF = 0.102, sm = v => smooth(0, 1, v);
  M.closetChrome = std({ color: '#e1e4e7', metalness: 0.5, roughness: 0.2 }); // tringles chromées (métallicité modérée : peu d'environnement à refléter dans un placard)
  for (const [ly, ax, f, a0, a1, y0, y1, s, dp, kind, i0 = a0] of list) {
    const fl = ly === 'rdc' ? 'furn0' : 'furn1', U = ax === 'z' ? 'x' : 'z', yF = ly === 'rdc' ? y0 : y0 - 0.004; // dessus du parquet à l'étage
    // boîte en (u le long de la façade, y, d profondeur comptée depuis le nu vers le fond)
    const box = (acc, k, u0, u1, yy0, yy1, d0, d1, m) => ax === 'z' ? acc.box(k, u0, u1, yy0, yy1, f - s * d0, f - s * d1, m) : acc.box(k, f - s * d0, f - s * d1, yy0, yy1, u0, u1, m);
    const B = (...a: [number, number, number, number, number, number, string]) => box(A, fl, ...a);
    // rails haut et bas de 75 mm, de 3 à 78 mm derrière le nu, entre les retours
    B(a0 + cl, a1 - cl, y1 - 0.06, y1, 0.003, 0.078, 'closetRail');
    B(a0 + cl, a1 - cl, yF, y0 + 0.012, 0.003, 0.078, 'closetRail');
    // vantaux (≈ 0,90 m maxi) recouvrement 2 cm, course = travée − 2 recouvrements (jamais dans un retour ni dans le vantail voisin du même rail)
    const n = Math.max(2, Math.ceil((a1 - a0) / 0.92 - 1e-6)), A0 = a0 + cl, w = (a1 - a0 - 2 * cl) / n, tr = w - 2 * ov, yb = y0 + 0.016, yt = y1 - 0.064, sib = [];
    for (let i = 0; i < n; i++) {
      const u0 = A0 + i * w - (i > 0 ? ov : 0), u1 = A0 + (i + 1) * w + (i < n - 1 ? ov : 0), d0 = i % 2 ? 0.006 : 0.036; // vantaux impairs sur le rail avant
      const acc = new Acc(), g = new THREE.Group(); g.name = 'vantail de placard';
      box(acc, 'v', u0 + 0.010, u1 - 0.010, yb + 0.002, yt - 0.002, d0 + 0.004, d0 + 0.016, 'closetDoor'); // panneau 12 mm engagé dans les montants
      for (const uu of [u0, u1 - 0.016]) box(acc, 'v', uu, uu + 0.016, yb, yt, d0, d0 + 0.020, 'closetRail'); // montants alu 16 × 20
      acc.build({ v: g }); groups[fl].add(g);
      const dir = i < (n - 1) / 2 ? 1 : -1, meshes = g.children.slice();
      const d = { g, meshes, open: 0, speed: 1.1, kind: 'placard', apply: v => { g.position[U] = dir * tr * sm(v); } } as Door;
      let tg = 0; Object.defineProperty(d, 'target', { enumerable: true, get: () => tg, set: v => { tg = v; if (v > 0.5) for (const q of sib) if (q !== d) q.target = 0; } });
      for (const m of meshes) m.userData.door = d; sib.push(d); DOORS.push(d);
    }
    // intérieur : tablettes de 19 mm entre murs et séparations (1 mm de jeu), de 10 cm derrière le nu jusqu'à 2 mm du fond
    const I0 = i0 + 0.002, I1 = a1 - 0.002, dB = dp - 0.002, dm = (dF + dB) / 2, bk = k => A0 + k * w;
    const shelf = (u0, u1, h) => B(u0 + 0.001, u1 - 0.001, y0 + h - th, y0 + h, dF, dB, 'white');
    const sep = (u, h) => B(u - th / 2, u + th / 2, yF, y0 + h - th, dF, dB, 'white');
    const tube = (u0, u1, yc) => { const r = 0.0125; for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4, b = a + Math.PI / 4, am = a + Math.PI / 8; // tringle Ø 25 octogonale
      const Q = (u, an) => { const yy = yc + r * Math.sin(an), wv = f - s * (dm + r * Math.cos(an)); return ax === 'z' ? [u, yy, wv] : [wv, yy, u]; }, nw = -s * Math.cos(am), ny = Math.sin(am);
      A.quadN(fl, 'closetChrome', [Q(u0, a), Q(u1, a), Q(u1, b), Q(u0, b)], ax === 'z' ? [0, ny, nw] : [nw, ny, 0]); } };
    if (kind === 'E') { // entrée : une colonne d'étagères par vantail, tablette haute filante à 2,00 m
      for (let k = 1; k < n; k++) sep(bk(k), 2.00);
      for (let k = 0; k < n; k++) for (const h of [0.40, 0.80, 1.20, 1.60]) shelf(k ? bk(k) + th / 2 : I0, k < n - 1 ? bk(k + 1) - th / 2 : I1, h);
      shelf(I0, I1, 2.00);
    } else {
      shelf(I0, I1, 1.80); // tablette chapelière filante
      let r0 = I0;
      if (kind === 'M') { sep(bk(1), 1.80); for (const h of [0.36, 0.72, 1.08, 1.44]) shelf(I0, bk(1) - th / 2, h); r0 = bk(1) + th / 2; }
      tube(r0, I1, y0 + 1.80 - th - 0.055); // tringle 5,5 cm sous la tablette, au milieu de la profondeur utile
    }
  }
}

// ---------------------------------------------------------------- équipements et mobilier (indicatif hors plans)
export function buildFurniture() {
  const f0 = 'furn0', f1 = 'furn1', e = E1;
  const B = (l, x0, x1, y0, y1, z0, z1, m) => A.box(l, x0, x1, y0, y1, z0, z1, m);

  // cuisine, séjour, chambres, bureau, radiateurs et lave-linge : mobilier.ts ; PAC : equip.ts ; salles de bains et WC : bains.ts
  // --- Local technique et garage : tableau, accès VS
  B(f0, 5.31, 5.46, 0.95, 1.85, 2.50, 2.90, 'white'); // tableau électrique 40 × 15 du plan RDC (z 2,50 → 2,90), entre la porte ISO 83 et le poteau BA (nourrice : equip.ts)
  B(f0, 10.70, 11.18, -0.13, -0.122, 1.33, 2.08, 'inox'); // trappe d'accès au vide sanitaire 48 × 75 (plan RDC)

  // placards : intérieurs (tablettes, séparations, tringles) et façades coulissantes dans buildClosets (les blocs blancs pleins d'avant débordaient de 17 cm devant les retours des chambres 2 et 3)

  // --- Salle de bains commune (« Bains ») : douche 160×90 Geberit Olona dans l'angle ; sèche-serviettes Atlantic Adélis des deux salles d'eau : bains.ts
  // faïence 12,25 m² (notice) : murs des deux douches sur 2,10 m
  B(f1, 2.26, 3.86, e, e + 2.10, T, T + 0.008, 'faience'); B(f1, 3.852, 3.86, e, e + 2.10, T, 1.26, 'faience');
}
