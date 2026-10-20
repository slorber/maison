// Clôtures : limite voisine nord, clôture sur rue (muret, lames, piliers), portillon et portail coulissant ouvrables au clic
import * as THREE from 'three';
import { L } from '../maison/plan';
import { Acc, A, sbox } from '../noyau/geometrie';
import { M } from '../noyau/materiaux';
import { dist2, lerp2, clamp, smooth } from '../noyau/outils';
import { groups, DOORS } from '../noyau/etat';
import { BND, hAt, xSouth, NB_TOP, SEUIL, MUR, MARCHE, driveH, surfAllee, murY, marcheY } from './relief';
import { overlayQuad } from './revetements';
import type { Door } from '../types';

// ---------------------------------------------------------------- clôtures
export function buildFences() {
  const g = p => hAt(p[0], p[1]);
  // limite voisine nord : muret surmonté d'un grillage, appartenant au voisin (côté extérieur) ; limite est (mur de soutènement) : env.ts
  // muret et grillage droits et de niveau (clients, 12/10/2026) : dessus horizontal à NB_TOP, fondation sous le point bas de chaque tronçon
  const neighbour = (p0, p1) => {
    const len = dist2(p0, p1), n = Math.max(1, Math.ceil(len / 2.5)); const pts = [], gs = [];
    for (let i = 0; i <= n; i++) { const p = lerp2(p0, p1, i / n); pts.push(p); gs.push(Math.min(g(p), g([p[0] - 0.17, p[1]]))); }
    const yT = NB_TOP;
    for (let i = 0; i < n; i++) { const yb = Math.min(gs[i], gs[i + 1]) - 0.3; sbox('fence', 'oldWall', pts[i], pts[i + 1], -0.16, 0, yb, yb, yT - yb); sbox('fence', 'coping', pts[i], pts[i + 1], -0.18, 0.02, yT, yT, 0.03); }
    for (let i = 0; i <= n; i++) { const q = lerp2(p0, p1, clamp((i * len / n + 0.04) / len, 0, 1)); const pp = lerp2(p0, p1, clamp((i * len / n - 0.0) / len, 0, 1)); sbox('fence', 'meshPost', pp, q, -0.10, -0.06, yT, yT, 1.25); }
    // panneau de grillage, de niveau
    const pos = [], uv = [], idx = []; let acc = 0; const dx = p1[0] - p0[0], dz = p1[1] - p0[1], l = Math.hypot(dx, dz); const nx = dz / l, nz = -dx / l;
    for (let i = 0; i <= n; i++) { if (i) acc += dist2(pts[i - 1], pts[i]); const x = pts[i][0] - nx * 0.08, z = pts[i][1] - nz * 0.08; pos.push(x, yT + 0.05, z, x, yT + 1.23, z); uv.push(acc, 0, acc, 1.18); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    groups.fence.add(new THREE.Mesh(geo, M.mesh));
  };
  neighbour(BND.B, BND.A);

  // sur rue (PCMI 5) : muret enduit ton pierre réf. 15 de 0,80 m, lames horizontales pleines en alu 7016 sur 1,20 m,
  // piliers 40 × 40, portillon 1,00 m et portail coulissant 3,50 m en alu 7016 hauteur 2,00 m. Le tout suit la pente.
  const runW = [BND.A, BND.D], runS = [BND.D, BND.C];
  const at = (run, s) => lerp2(run[0], run[1], s / dist2(run[0], run[1]));
  const atIn = (run, s) => { const p = at(run, s), [a, b] = run, l = dist2(a, b); return [p[0] + (b[1] - a[1]) / l * 0.45, p[1] - (b[0] - a[0]) / l * 0.45]; }; // côté jardin, 45 cm derrière la limite
  const pillar = (run, s) => {
    const p0 = at(run, s - 0.20), p1 = at(run, s + 0.20), gc = g(at(run, s)), yb = Math.min(gc, g(atIn(run, s))) - 0.35; // fondé sous le plus bas du trottoir et du jardin
    sbox('fence', 'enduit', p0, p1, 0, 0.40, yb, yb, gc + 2.04 - yb);
    sbox('fence', 'coping', at(run, s - 0.24), at(run, s + 0.24), -0.04, 0.44, gc + 2.04, gc + 2.04, 0.04);
    sbox('fence', 'coping', at(run, s - 0.17), at(run, s + 0.17), 0.03, 0.37, gc + 2.08, gc + 2.08, 0.02);
    return gc;
  };
  const panel = (run, s0, s1, ga, gb) => { // entre faces de piliers ; ga, gb : niveaux du terrain aux deux bouts
    const p0 = at(run, s0), p1 = at(run, s1);
    sbox('fence', 'enduit', p0, p1, 0.0, 0.20, ga - 0.35, gb - 0.35, 1.15);
    { const yb = Math.min(g(atIn(run, s0)), g(atIn(run, s1)), ga, gb) - 0.25, yt = Math.max(ga, gb) - 0.30; // soubassement : le jardin est jusqu'à 54 cm sous le trottoir (muret de soutènement)
      if (yt > yb) sbox('fence', 'enduit', p0, p1, 0.005, 0.195, yb, yb, yt - yb); }
    sbox('fence', 'coping', p0, p1, -0.02, 0.22, ga + 0.80, gb + 0.80, 0.035);
    for (let k = 0; k < 6; k++) sbox('fence', 'fenceAlu', p0, p1, 0.08, 0.115, ga + 0.838 + k * 0.1936, gb + 0.838 + k * 0.1936, 0.1906);
    sbox('fence', 'fenceAlu', p0, p1, 0.075, 0.12, ga + 1.995, gb + 1.995, 0.012); // lisse haute
    const n = Math.ceil((s1 - s0) / 1.70);
    for (let i = 1; i < n; i++) { const t = i / n, s = s0 + (s1 - s0) * t, gg = ga + (gb - ga) * t; sbox('fence', 'fenceAlu', at(run, s - 0.025), at(run, s + 0.025), 0.065, 0.13, gg + 0.835, gg + 0.835, 1.17); }
  };
  // vantail rectangulaire de 2,00 m, lames horizontales pleines ; ly / acc : calque et accumulateur (vantail mobile : accumulateur propre) ; renvoie le niveau bas du vantail
  const gate = (run, s0, s1, slide, dt = 0, yb0 = null, ly = 'fence', acc = A) => {
    const gm = Math.max(g(at(run, s0)), g(at(run, s1))); const yb = yb0 ?? gm + 0.04, ht = 1.96;
    const p0 = at(run, s0 + 0.01), p1 = at(run, s1 - 0.01), t0 = 0.07 + dt, t1 = 0.13 + dt;
    const sb = (m, a, b, ta, tb, y, h) => sbox(ly, m, a, b, ta, tb, y, y, h, acc);
    sb('fenceAlu', p0, at(run, s0 + 0.06), t0, t1, yb, ht);
    sb('fenceAlu', at(run, s1 - 0.06), p1, t0, t1, yb, ht);
    sb('fenceAlu', p0, p1, t0, t1, yb, 0.06); sb('fenceAlu', p0, p1, t0, t1, yb + ht - 0.06, 0.06);
    const nb = 9; const sh = (ht - 0.12) / nb;
    for (let k = 0; k < nb; k++) sb('fenceAlu', p0, p1, t0 + 0.013, t1 - 0.013, yb + 0.06 + k * sh + 0.002, sh - 0.004);
    if (slide) sb('fenceAlu', at(run, (s0 + s1) / 2 - 0.03), at(run, (s0 + s1) / 2 + 0.03), t0, t1, yb, ht);
    else { const hp = at(run, s1 - 0.12); sb('blackMatte', hp, at(run, s1 - 0.06), t1, t1 + 0.03, yb + 1.0, 0.14); sb('blackMatte', hp, at(run, s1 - 0.06), t0 - 0.03, t0, yb + 1.0, 0.14); }
    return yb;
  };
  // point à la profondeur t de la limite (t > 0 vers l'intérieur de la parcelle, comme les épaisseurs de sbox)
  const atT = (run, s, t) => { const p = at(run, s), [a, b] = run, l = dist2(a, b); return [p[0] + (b[1] - a[1]) / l * t, p[1] - (b[0] - a[0]) / l * t]; };
  // vantail mobile : géométrie en coordonnées monde dans un groupe propre (hors fusion), pivot en (x, z) ; déclaré dans DOORS (clic : ouvrir / fermer).
  // kind renseigné : la balade ne l'ouvre pas d'elle-même (nav.ts), le vantail y reste un obstacle dynamique
  const leaf = (name, pivot, fill) => {
    const acc = new Acc(), g0 = new THREE.Group(), inner = new THREE.Group(); g0.name = name; g0.userData.noMerge = true;
    g0.position.set(pivot[0], 0, pivot[1]); inner.position.set(-pivot[0], 0, -pivot[1]); g0.add(inner); groups.fence.add(g0);
    fill(acc); acc.build({ leaf: inner });
    const meshes = []; inner.traverse(o => { if (o.isMesh) meshes.push(o); }); return { g: g0, meshes };
  };
  const door = (lf, kind, speed, apply) => { const d: Door = { g: lf.g, meshes: lf.meshes, open: 0, target: 0, speed, apply, kind }; for (const m of lf.meshes) m.userData.door = d; apply(0); DOORS.push(d); return d; };
  // côté ouest, du nord (A) au sud (D) : pilier, 8,73, pilier, portillon 1,00, pilier, 9,67, pilier, 9,67, pilier (31,07 m)
  const LW = dist2(BND.A, BND.D);
  const sp = [0.20, 9.33, 10.73, 20.80, LW - 0.20];
  const gp = sp.map(s => pillar(runW, s));
  const gAt = (s) => { for (let i = 0; i < sp.length - 1; i++) if (s <= sp[i + 1]) return gp[i] + (gp[i + 1] - gp[i]) * (s - sp[i]) / (sp[i + 1] - sp[i]); return gp[gp.length - 1]; };
  for (const [s0, s1] of [[0.40, 9.13], [10.93, 20.60], [21.00, LW - 0.40]]) panel(runW, s0, s1, gAt(s0), gAt(s1));
  { const c = [atIn(runW, 0.40), atIn(runW, LW - 0.40)].map(p => [p[0], p[1]]), k = 0.203 / 0.45, q = (p, s) => { const a = at(runW, s); return [a[0] + (p[0] - a[0]) * k, a[1] + (p[1] - a[1]) * k]; };
    // pelouse le long du muret ouest côté jardin (le maillage du terrain, au pas de 20 cm, y creuserait une rigole)
    overlayQuad('site', 'grass', [q(c[0], 0.40), q(c[1], LW - 0.40), c[1], c[0]], -0.006, Math.ceil(LW / 0.25), 2); }
  // portillon : vantail sur gonds côté pilier nord (s 9,53), ouverture de 90° vers l'intérieur de la parcelle ; serrure côté pilier sud (s 10,53)
  { const s0 = 9.53, s1 = 10.53; let yb = 0;
    const lf = leaf('portillon', atT(runW, s0 + 0.01, 0.13), acc => { yb = gate(runW, s0, s1, false, 0, null, 'leaf', acc); });
    door(lf, 'portillon', 0.7, v => { lf.g.rotation.y = Math.PI / 2 * smooth(0, 1, v); });
    for (const y of [yb + 0.22, yb + 1.62]) sbox('fence', 'fenceAlu', at(runW, s0 - 0.004), at(runW, s0 + 0.014), 0.125, 0.15, y, y, 0.12); // gonds
    // gâche électrique encastrée dans le pilier, face à la serrure (portillon commandé à distance, sans moteur)
    sbox('fence', 'inox', at(runW, s1 - 0.003), at(runW, s1 + 0.003), 0.08, 0.12, yb + 0.96, yb + 0.96, 0.20); }
  // côté sud, de D à C : (pilier d'angle commun), 9,00, pilier, portail coulissant 3,50, pilier (13,70 m)
  const LS = dist2(BND.D, BND.C);
  const ss = [0.20, 9.60, LS - 0.20]; void ss;
  const gs = [gp[gp.length - 1], pillar(runS, 9.60), pillar(runS, LS - 0.20)];
  panel(runS, 0.40, 9.40, gs[0] + (gs[1] - gs[0]) * 0.2 / 9.4, gs[0] + (gs[1] - gs[0]) * 9.2 / 9.4);

  // ---- portail coulissant 3,50 m entre piliers (vantail de 3,78 m, 14 cm de recouvrement derrière chaque pilier) : il roule sur un rail posé sur le seuil,
  // derrière les piliers de 40 cm et sous le débord de leurs chaperons (vantail t 0,45 → 0,51), et se range vers le jardin le long de la clôture :
  // course 3,66 m (ouvert : s 6,00 → 9,78, 2 cm derrière le nu du pilier), rail de s 5,92 à 13,45
  const S0G = 9.66, S1G = 13.44, TRAV = 3.66, DTG = 0.38, TR = 0.48; // DTG : décalage du vantail dans gate() ; TR : axe du rail
  const seuilY = (s, t) => surfAllee(atT(runS, s, t)[0]); // dessus du seuil : au nu du gravillon, il suit la pente de la descente dans sa profondeur
  const yR = Math.max(seuilY(5.92, TR), seuilY(13.45, TR)), ybG = yR + 0.025 + 0.01; // rail de niveau calé au point haut ; galets : vantail 1 cm au-dessus du rail
  // seuil en béton enduit ton pierre, comme le muret (sous l'ouverture et toute la zone de refoulement, du retour du muret à la limite est)
  const slab = (s0, s1, t0, t1) => {
    const q = [[s0, t0], [s1, t0], [s1, t1], [s0, t1]].map(([s, t]) => { const p = atT(runS, s, t); return [p[0], surfAllee(p[0]), p[1]]; });
    const u = q[1].map((v, k) => v - q[0][k]), w = q[3].map((v, k) => v - q[0][k]);
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nl = Math.hypot(...n) * Math.sign(n[1]); n = n.map(v => v / nl);
    A.quadN('fence', 'enduit', q, n);
    const cx = (q[0][0] + q[2][0]) / 2, cz = (q[0][2] + q[2][2]) / 2;
    for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; let ex = b[2] - a[2], ez = a[0] - b[0]; const el = Math.hypot(ex, ez) * (ex * ((a[0] + b[0]) / 2 - cx) + ez * ((a[2] + b[2]) / 2 - cz) < 0 ? -1 : 1);
      A.quadN('fence', 'enduit', [[a[0], -1.0, a[2]], [b[0], -1.0, b[2]], [b[0], b[1], b[2]], [a[0], a[1], a[2]]], [ex / el, 0, ez / el]); }
  };
  const sC = (BND.D[1] - MUR.z) / BND.D[1] * LS; // abscisse de l'angle des murets (nu côté allée du muret allée / jardin)
  slab(5.70, LS - 0.03, SEUIL.t0, SEUIL.t1); slab(9.80, 13.30, -0.05, SEUIL.t0); slab(9.43, sC, SEUIL.t1, SEUIL.tn); // bande principale, entre les piliers (glissé sous le bord du trottoir), fond de la niche
  // bordure du trottoir au droit de l'ouverture : le trottoir (terrain naturel de la rue) est 2 à 11 cm au-dessus du seuil, sa rive est fermée par la bordure
  for (let i = 0; i < 7; i++) { const sa = 9.80 + 0.5 * i, sb = sa + 0.5, ya = g(at(runS, sa)) + 0.052, yb = g(at(runS, sb)) + 0.052;
    sbox('fence', 'curb', at(runS, sa), at(runS, sb), -0.08, 0, ya - 0.30, yb - 0.30, 0.30); }
  sbox('fence', 'grille', at(runS, 5.92), at(runS, 13.45), TR - 0.015, TR + 0.015, yR - 0.012, yR - 0.012, 0.037); // rail
  // motorisation du portail (interprétation de la demande : le moteur au sol à côté du muret est celui du portail coulissant) : moteur à crémaillère
  // 30 × 20 × 30 cm gris anthracite sur socle enduit, dans la niche du muret derrière le pilier côté rangement ; pignon engrené sur la crémaillère du vantail
  // en s 9,72 (dans la crémaillère portail fermé comme ouvert)
  const ySoc = seuilY(9.72, 0.78) + 0.05, yMot = ySoc + 0.30;
  sbox('fence', 'enduit', at(runS, 9.53), at(runS, 9.91), 0.54, 0.78, ySoc - 0.12, ySoc - 0.12, 0.12); // socle
  sbox('fence', 'blackMatte', at(runS, 9.56), at(runS, 9.88), 0.542, 0.755, ySoc, ySoc, 0.015); // embase
  sbox('fence', 'fenceAlu', at(runS, 9.57), at(runS, 9.87), 0.547, 0.745, ySoc + 0.015, ySoc + 0.015, yMot - ySoc - 0.015); // capot
  sbox('fence', 'blackMatte', at(runS, 9.60), at(runS, 9.66), 0.744, 0.748, ySoc + 0.06, ySoc + 0.06, 0.05); // trappe de déverrouillage
  { const p = atT(runS, 9.72, 0.571), pg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.026, 18), M.closetRail); pg.position.set(p[0], yMot + 0.015, p[1]); pg.castShadow = pg.receiveShadow = true; groups.fence.add(pg); } // pignon
  // vantail coulissant et sa crémaillère (acier galvanisé, sur toute la longueur, face intérieure, à hauteur du pignon)
  const ux = (BND.D[0] - BND.C[0]) / LS, uz = (BND.D[1] - BND.C[1]) / LS; // sens d'ouverture : vers les s décroissants (vers le jardin)
  const lfG = leaf('portail coulissant', [0, 0], acc => {
    gate(runS, S0G, S1G, true, DTG, ybG, 'leaf', acc);
    sbox('leaf', 'closetRail', at(runS, S0G + 0.01), at(runS, S1G - 0.01), 0.13 + DTG, 0.155 + DTG, yMot + 0.002, yMot + 0.002, 0.03, acc);
  });
  const dG = door(lfG, 'portail', 1 / 3, v => { const k = TRAV * smooth(0, 1, v); lfG.g.position.set(ux * k, 0, uz * k); }); // ~3 s
  { const c = atT(runS, (S0G - TRAV + S1G) / 2, TR); dG._navC = { x: c[0], y: ybG + 1.0, z: c[1], r: (S1G - S0G + TRAV) / 2 + 0.1 }; } // emprise de toute la course (obstacle dynamique de la balade, nav.ts)

  // ---- murets : dessus et chaperons rectilignes (sans gradins ni courbe), pied enterré sous le terrain
  const murBot = x => driveH(x) - 0.12;
  const xEnd = xSouth(MUR.z + MUR.e / 2) - SEUIL.tm; // le muret allée / jardin bute contre la niche du moteur (nu côté jardin)
  const yC = murY(xEnd); // murets du seuil : dessus horizontal (le seuil est de niveau à 3 mm près), à la hauteur du bout du muret allée / jardin
  // muret de soutènement le long du seuil (s croissants : du bout de course vers l'angle) ; h = 0 : corps descendu à −1,05
  const soutRun = (sa, sb, ta, tb, mat, h, ext0 = 0, ext1 = 0) => {
    const hh = h || yC + 1.05;
    sbox('fence', mat, at(runS, sa - ext0), at(runS, sb + ext1), ta, tb, h ? yC : yC - hh, h ? yC : yC - hh, hh);
  };
  { const hh = yC + 1.05;
    sbox('fence', 'enduit', at(runS, 5.70), at(runS, 5.90), 0.15, SEUIL.tn, yC - hh, yC - hh, hh); // retour jusqu'à la clôture au bout de la course
    sbox('fence', 'coping', at(runS, 5.68), at(runS, 5.92), SEUIL.t0, SEUIL.tn + 0.02, yC, yC, 0.03);
    soutRun(5.90, 9.43, SEUIL.t1, SEUIL.tn, 'enduit', 0); soutRun(9.25, sC, SEUIL.tn, SEUIL.tm, 'enduit', 0); // le long du seuil, puis niche du moteur
    soutRun(5.92, 9.25, SEUIL.t1 - 0.02, SEUIL.tn + 0.02, 'coping', 0.03); soutRun(9.25, 9.45, SEUIL.t1 - 0.02, SEUIL.tn - 0.02, 'coping', 0.03);
    soutRun(9.25, sC, SEUIL.tn - 0.02, SEUIL.tm + 0.02, 'coping', 0.03, 0.02, 0.02); }
  // muret entre l'allée du garage et le jardin : un prisme par tronçon, dessus et chaperon sur la droite murY (pente constante de 6,5 %),
  // pied parallèle enterré d'au moins 12 cm sous l'allée ; interrompu au droit de la marche (chaperons retournés de 2 cm sur les joues)
  const murRun = (xa, xb, ca, cb) => {
    const ya = murY(xa), yb = murY(xb), hs = Math.max(ya - murBot(xa), yb - murBot(xb));
    sbox('fence', 'enduit', [xa, MUR.z], [xb, MUR.z], -MUR.e, 0, ya - hs, yb - hs, hs);
    sbox('fence', 'coping', [xa - ca, MUR.z], [xb + cb, MUR.z], -MUR.e - 0.02, 0.02, murY(xa - ca), murY(xb + cb), 0.03);
  };
  murRun(L + 0.008, MARCHE.x0, 0, 0.02); murRun(MARCHE.x1, xEnd, 0.02, -0.02); // depuis le nu de l'enduit de la façade sud
  // marche de l'allée au jardin dans le passage de 0,80 m : giron en pierre reconstituée (comme le chaperon) de 25 cm × 5 cm, nu avant au nu
  // côté allée du muret (sans nez ni débord), sur une contremarche enduite dans le plan du muret ; sol de la balade au clavier
  // (userData.navKind = 0 : marche franchissable, nav.ts)
  { const { x0, x1, zB } = MARCHE, acc = new Acc(), grp = new THREE.Group(); grp.name = 'marche allée / jardin'; groups.fence.add(grp);
    const y0 = marcheY(x0) - 0.05, y1 = marcheY(x1) - 0.05, hb = Math.max(y0 - murBot(x0), y1 - murBot(x1));
    sbox('st', 'enduit', [x0, MUR.z], [x1, MUR.z], -MUR.e, 0, y0 - hb, y1 - hb, hb, acc); // contremarche (corps du muret sous le giron)
    sbox('st', 'coping', [x0, MUR.z], [x1, MUR.z], -(zB - MUR.z), 0, y0, y1, 0.05, acc); // giron
    acc.build({ st: grp }); grp.traverse(o => { if (o.isMesh) o.userData.navKind = 0; }); }
  // pelouse le long des murets côté jardin (le maillage du terrain, au pas de 20 cm, y creuserait une rigole)
  const grassStrip = c => overlayQuad('site', 'grass', c, -0.006, Math.max(2, Math.ceil(dist2(c[0], c[1]) / 0.25)), 2);
  const gq = (s0, s1, t0, t1) => [atT(runS, s0, t0), atT(runS, s1, t0), atT(runS, s1, t1), atT(runS, s0, t1)];
  const zg = MUR.z + MUR.e + 0.003; // 3 mm du nu : le bord de la bande est évalué côté jardin
  const { x0: xm0, x1: xm1, zB: zmB } = MARCHE, xg0 = xm0 - 0.003, xg1 = xm1 + 0.003;
  grassStrip([[L + 0.008, zg], [xg0, zg], [xg0, zg + 0.25], [L + 0.008, zg + 0.25]]); grassStrip([[xg1, zg], [xEnd, zg], [xEnd, zg + 0.25], [xg1, zg + 0.25]]);
  grassStrip([[xg0, zmB + 0.003], [xg1, zmB + 0.003], [xg1, zg + 0.25], [xg0, zg + 0.25]]); // derrière le giron (bord arrière au niveau de la pelouse)
  grassStrip(gq(9.25, sC, SEUIL.tm + 0.003, SEUIL.tm + 0.25)); grassStrip(gq(5.70, 9.25, SEUIL.tn + 0.003, SEUIL.tn + 0.25)); grassStrip(gq(5.45, 5.697, SEUIL.t0, SEUIL.tn + 0.25));
}
