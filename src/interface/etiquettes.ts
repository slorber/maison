// Étiquettes des pièces (vues « maison ouverte ») : nom et surface, en CSS par-dessus le canevas
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { H } from '../maison/plan';
import { labels } from '../noyau/etat';

export let labelRenderer: CSS2DRenderer, labelScene: THREE.Scene;

export function initEtiquettes() {
  // étiquettes des pièces (surfaces des plans travaux v3)
  labelRenderer = new CSS2DRenderer(); labelRenderer.domElement.className = 'labels'; document.getElementById('stage').appendChild(labelRenderer.domElement);
  labelScene = new THREE.Scene(); // [perf] étiquettes dans une scène à part : le rendu CSS2D ne parcourt plus les ~1 800 objets de la maquette
  const e1 = H.r1Floor + 0.05;
  const rooms: ['rdc' | 'r1', string, string, number, number, number][] = [
    ['rdc', 'Entrée', '12,82 m²', 3.0, 0.05, 2.2], ['rdc', 'WC', '2,00 m²', 1.3, 0.05, 0.85], ['rdc', 'Cuisine', '11,50 m²', 2.0, 0.95, 5.6], ['rdc', 'Séjour', '36,24 m²', 8.2, 0.9, 4.6], ['rdc', 'Garage', '16,41 m²', 9.9, 0.0, 1.8], ['rdc', 'Local technique', '4,74 m²', 6.2, 0.0, 1.9], // 1,70 × 2,79 (doublage du mur est) ; garage + cloison + local = 21,36 m² du plan
    ['r1', 'Bains', '9,54 m²', 1.5, e1, 1.9], ['r1', 'WC', '1,53 m²', 4.38, e1, 1.4], ['r1', 'Douche', '3,86 m²', 5.6, e1, 2.0], ['r1', 'Dressing', '5,29 m²', 7.4, e1, 1.8], ['r1', 'Chambre 1', '14,80 m²', 10.6, e1 + 0.6, 3.1],
    ['r1', 'Palier', '6,05 m²', 6.6, e1, 3.67], ['r1', 'Chambre 3', '15,26 m²', 2.4, e1 + 0.6, 6.8], ['r1', 'Bureau', '9,83 m²', 6.4, e1, 5.4], ['r1', 'Chambre 2', '14,47 m²', 10.6, e1 + 0.6, 6.8],
  ];
  for (const [lv, name, s, x, y, z] of rooms) {
    const el = document.createElement('div'); el.className = 'room'; el.innerHTML = `<b>${name}</b><span>${s}</span>`;
    const o = new CSS2DObject(el); o.position.set(x, y + 0.02, z); o.visible = false; labelScene.add(o); labels[lv].push(o);
  }
}
