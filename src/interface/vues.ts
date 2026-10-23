// Vues prédéfinies du panneau (extérieur, maison ouverte, intérieur) et visibilité des calques selon la vue
import * as THREE from 'three';
import { clamp } from '../noyau/outils';
import { camera, controls, requestRender } from '../noyau/rendu';
import { state, groups, labels } from '../noyau/etat';
import { applyLighting, updateSun } from '../noyau/soleil';
import type { View } from '../types';

// ---------------------------------------------------------------- vues
export const VIEWS: Record<string, View> = {
  sw: { p: [27.5, 1.75, 21.5], t: [8.5, 3.0, 4.6], mode: 'ext' },
  plonge: { p: [30, 8.5, 26], t: [6.5, 1.5, 5.5], mode: 'ext' },
  ouest: { p: [6.45, 2.4, 25], t: [6.45, 2.9, 4], mode: 'ext' },
  entree: { p: [-4.6, 1.65, 6.6], t: [0, 1.25, 2.3], mode: 'ext' },
  cloture: { p: [-9.5, 1.6, 18.5], t: [1.5, 1.0, 12.9], mode: 'ext' },
  jardin: { p: [-10.8, 1.7, 1.2], t: [0, 2.2, 4.3], mode: 'ext' },
  sud: { p: [25.5, 4.6, 9.8], t: [12.6, 1.6, 2.6], mode: 'ext' },
  pluie: { p: [24.5, 7.5, 15.5], t: [15.5, -0.3, 7.5], mode: 'ext' },
  aerien: { p: [-16, 27, 32], t: [5, 0, 5], mode: 'ext' },
  rdc: { p: [6.45, 19.5, 13.5], t: [6.45, 0, 4.4], mode: 'rdc' },
  r1: { p: [6.45, 22.5, 13.5], t: [6.45, 2.9, 4.4], mode: 'r1' },
  i_sejour: { p: [12.25, 1.65, 3.85], t: [3.0, 1.15, 6.9], mode: 'ext', inside: 1 },
  i_cuisine: { p: [5.4, 1.7, 6.5], t: [1.2, 1.0, 5.4], mode: 'ext', inside: 1 },
  i_entree: { p: [4.9, 1.6, 2.95], t: [0.4, 1.2, 2.0], mode: 'ext', inside: 1 },
  i_ch1: { p: [9.45, 4.42, 3.85], t: [12.2, 3.6, 0.9], mode: 'ext', inside: 1 },
  i_bains: { p: [0.72, 4.47, 0.95], t: [3.6, 3.85, 2.15], mode: 'ext', inside: 1 },
  i_palier: { p: [8.85, 4.42, 3.68], t: [1.5, 3.3, 3.68], mode: 'ext', inside: 1 },
};
let anim = null;
export function setView(key: string, instant?: boolean) {
  const v = VIEWS[key]; state.mode = v.mode; applyVisibility();
  const to = new THREE.Vector3(...v.p); let tt = new THREE.Vector3(...v.t);
  if (v.inside) { tt = to.clone().add(tt.sub(to).normalize().multiplyScalar(0.6)); }
  controls.minDistance = v.inside ? 0.1 : 1.0; controls.maxPolarAngle = v.inside ? Math.PI * 0.85 : Math.PI * 0.495;
  controls.zoomSpeed = v.inside ? 0.4 : 1; controls.panSpeed = v.inside ? 0.3 : 1;
  if (instant) { camera.position.copy(to); controls.target.copy(tt); controls.update(); anim = null; }
  else anim = { t0: performance.now(), p0: camera.position.clone(), q0: controls.target.clone(), p1: to, q1: tt };
  state.lastView = key; state.inside = !!v.inside; camera.fov = v.inside ? 64 : 45; camera.near = v.inside ? 0.05 : 0.2; camera.updateProjectionMatrix(); applyLighting(); updateSun(true);
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === key ? 'true' : 'false'));
}
export function applyVisibility() {
  const m = state.mode; const upper = m !== 'rdc'; const roof = state.roof && m === 'ext';
  groups.r1.visible = upper; groups.skinU.visible = upper; groups.skinR.visible = !upper; groups.slab1.visible = upper; groups.volets1.visible = upper && state.volets;
  groups.furn1.visible = upper && state.furn; groups.furn0.visible = state.furn;
  groups.volets0.visible = state.volets; groups.roof.visible = roof; groups.ceil1.visible = roof;
  groups.fence.visible = state.fence; groups.pergola.visible = state.pergola;
  labels.rdc.forEach(o => o.visible = m === 'rdc'); labels.r1.forEach(o => o.visible = m === 'r1');
  const tr = document.getElementById('t-roof') as HTMLInputElement; if (tr) tr.disabled = m !== 'ext';
  requestRender();
}
// animation de la caméra vers la vue choisie (1,2 s) ; renvoie true tant qu'elle est en cours
export function animateView(now: number) {
  if (!anim) return false;
  const k = clamp((now - anim.t0) / 1200, 0, 1); const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  camera.position.lerpVectors(anim.p0, anim.p1, e); controls.target.lerpVectors(anim.q0, anim.q1, e);
  if (k >= 1) anim = null; return true;
}
