// Fenêtres, baies, porte d'entrée et porte de garage ouvrables au clic : buildOuvrants avant A.build(groups), initOuvrants après bindUI()
// menuiserie(), entryDoor() et garageDoor() rangent chaque vantail dans un calque propre (o.leaves, géométrie en coordonnées monde) ;
// ici chaque calque est accroché à un groupe mobile, puis déclaré dans DOORS (le clic de bindUI bascule d.target, animateDoors appelle d.apply).
import * as THREE from 'three';
import type { Ctx } from '../types';
import { ENTRY } from './plan';

const cl = t => t < 0 ? 0 : t > 1 ? 1 : t, ez = t => { t = cl(t); return t * t * (3 - 2 * t); };
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3(), _q = new THREE.Vector3();
// repère de façade direct : x = σ·a (σ = s au nord et au sud, −s à l'ouest), y = hauteur, z = d (profondeur depuis le nu extérieur, + vers l'intérieur)
const sig = f => f.axis === 'z' ? f.s : -f.s;
const faceMtx = f => f.axis === 'z' ? new THREE.Matrix4().set(0, 0, -f.s, f.F, 0, 1, 0, 0, f.s, 0, 0, 0, 0, 0, 0, 1)
  : new THREE.Matrix4().set(-f.s, 0, 0, 0, 0, 1, 0, 0, 0, 0, -f.s, f.F, 0, 0, 0, 1);
// chaîne repère de façade (F) → mouvement local (mov) → retour au monde (F⁻¹) → maillages en coordonnées monde : au repos, rien ne bouge
function rig(parent, F, Fi, lf) {
  const outer = new THREE.Group(), mov = new THREE.Group(); outer.name = lf.key;
  F.decompose(outer.position, outer.quaternion, outer.scale); Fi.decompose(lf.g.position, lf.g.quaternion, lf.g.scale);
  outer.add(mov); mov.add(lf.g); parent.add(outer); lf.mov = mov;
}
// rotation de mov d'un angle a autour de l'axe ax passant par p (repère de façade)
function turn(mov, ax, a, p) { mov.quaternion.setFromAxisAngle(ax, a); mov.position.copy(p).sub(_p.copy(p).applyQuaternion(mov.quaternion)); }

export function buildOuvrants(ctx: Ctx) {
  const { OPEN, FACE, groups, state, LB, H, M } = ctx;
  for (const face of Object.keys(OPEN)) for (const o of OPEN[face]) {
    if (!o.leaves || !o.leaves.length) continue;
    const f = FACE[face], s = sig(f), F = faceMtx(f), Fi = F.clone().invert(), layer = o.lvl ? 'r1' : 'rdc';
    const og = new THREE.Group(); og.name = `ouvrant ${face}${OPEN[face].indexOf(o)} ${o.t}`; groups[layer].add(og);
    for (const lf of o.leaves) rig(og, F, Fi, lf);
    let apply, speed;
    if (o.t === 'garage') {
      // sectionnelle : galets aux joints, guidés par un rail vertical (z = dc), un cintre de rayon R au-dessus du linteau puis un rail horizontal sous le plafond
      // cintre R 0,24 : rail horizontal (axe +2,36, dessus +2,385) sous le plafond du garage à +2,40 (coupe AA : 2,53 sous plafond depuis −0,13), linteau +2,12
      const { y0, y1, a0, a1 } = o, h = (y1 - y0) / 4, dc = 0.255, R = 0.24, Lv = y1 - y0, La = Math.PI * R / 2, uMax = Lv + 0.12;
      const P = (u, out) => { if (u <= Lv) return out.set(0, y0 + u, dc); if (u <= Lv + La) { const al = Math.PI - (u - Lv) / R; return out.set(0, y1 + R * Math.sin(al), dc + R + R * Math.cos(al)); } return out.set(0, y1 + R, dc + R + u - Lv - La); };
      const J = [0, 1, 2, 3, 4].map(() => new THREE.Vector3()), piv = o.leaves.map(lf => new THREE.Vector3(0, lf.y0, dc));
      apply = v => {
        let u = uMax * ez(v); P(u, J[0]);
        // joint suivant : point du rail à une corde h du précédent (dichotomie, distance croissante le long du rail)
        for (let k = 1; k <= 4; k++) { let lo = u, hi = u + 1.6 * h; for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; if (P(m, _q).distanceTo(J[k - 1]) < h) lo = m; else hi = m; } u = (lo + hi) / 2; P(u, J[k]); }
        o.leaves.forEach((lf, k) => { const t = _q.subVectors(J[k + 1], J[k]); lf.mov.quaternion.setFromAxisAngle(AX, Math.atan2(t.z, t.y)); lf.mov.position.copy(J[k]).sub(_p.copy(piv[k]).applyQuaternion(lf.mov.quaternion)); });
      };
      speed = 0.3;
      // rails galvanisés fixés au mur et suspentes au plafond, de part et d'autre du tablier (profil extrudé le long de la façade)
      const dEnd = dc + R + 2.75, w = 0.025, sh = new THREE.Shape();
      sh.moveTo(dc - w, y0); sh.lineTo(dc - w, y1); sh.absarc(dc + R, y1, R + w, Math.PI, Math.PI / 2, true); sh.lineTo(dEnd, y1 + R + w); sh.lineTo(dEnd, y1 + R - w); sh.lineTo(dc + R, y1 + R - w);
      sh.absarc(dc + R, y1, R - w, Math.PI / 2, Math.PI, false); sh.lineTo(dc + w, y0); sh.closePath();
      const B = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), AY, new THREE.Vector3(-1, 0, 0)); // profil (X = d, Y = y), extrusion selon −x
      for (const [ra, rb] of [[a0 - 0.045, a0 - 0.008], [a1 + 0.008, a1 + 0.045]]) {
        const geo = new THREE.ExtrudeGeometry(sh, { depth: rb - ra, bevelEnabled: false, curveSegments: 10 });
        geo.applyMatrix4(B.clone().setPosition(Math.max(s * ra, s * rb), 0, 0)).applyMatrix4(F);
        const m = new THREE.Mesh(geo, M.closetRail); m.castShadow = m.receiveShadow = true; groups.rdc.add(m);
        for (const dd of [1.55, dEnd - 0.12]) LB(face, 'rdc', ra, rb, y1 + R + w, H.garageCeil, dd, dd + 0.03, 'closetRail');
      }
    } else {
      // battants (fenêtres, portes-fenêtres du RDC, porte d'entrée) : pivot vertical sur l'arête intérieure du montant côté paumelles, ouverture vers l'intérieur ;
      // vantail 0 (poignée) côté a0, vantail 1 côté a1 ; à deux vantaux, celui de la poignée part en premier et se referme en dernier.
      // Portes-fenêtres ouest et sud : sens des plans travaux p. 9 (vantail principal côté a0 ouvert à 90°, semi-fixe dessiné entrouvert à 60°)
      const legs = o.leaves.map(lf => { const ha = o.t === 'entry' || o.n === 1 || lf.i === 0 ? lf.s0 : lf.s1, fa = ha === lf.s0 ? lf.s1 : lf.s0;
        return { mov: lf.mov, p: new THREE.Vector3(s * ha, 0, lf.d1), sg: -Math.sign(s * (fa - ha)) }; });
      // porte d'entrée : ouverture limitée par la butée au sol posée avant le radiateur de l'entrée (ENTRY, plan.ts : 112°, béquille à 2,5 cm du radiateur)
      const amax = o.t === 'entry' ? ENTRY.amax : o.t === 'baie' ? Math.PI / 2 : 0.47 * Math.PI, a2 = o.t === 'baie' ? Math.PI / 3 : amax;
      apply = v => legs.forEach((l, j) => turn(l.mov, AY, l.sg * (j ? a2 : amax) * (legs.length > 1 ? ez(j ? (v - 0.2) / 0.8 : v / 0.8) : ez(v)), l.p));
      speed = o.t === 'entry' || o.t === 'baie' ? 0.9 : 1.2;
    }
    const d = { g: og, meshes: [], open: 0, speed, apply, kind: o.t, face, o };
    // volet roulant fermé devant l'ouverture : elle reste inerte (le tablier n'est pas dans le lancer de rayon, le clic le traverse)
    let tg = 0; Object.defineProperty(d, 'target', { enumerable: true, get: () => tg, set: v => { if (!(o.vr && state.volets)) tg = v; } });
    o.ouv = d;
  }
}

export function initOuvrants(ctx: Ctx) {
  const { OPEN, groups, DOORS } = ctx;
  for (const face of Object.keys(OPEN)) for (const o of OPEN[face]) {
    const d = o.ouv; if (!d) continue;
    for (const lf of o.leaves) { lf.g.traverse(m => { if (m.isMesh) { m.userData.door = d; d.meshes.push(m); } }); delete groups[lf.key]; } // calques provisoires retirés une fois remplis par A.build
    DOORS.push(d);
  }
}
