// Interrupteurs, commandes de volets roulants, détecteurs de fumée, bouches VMC et luminaires du plan électrique (demande client du 20/10/2026 :
// « rajoute tous les interrupteurs, volets roulants etc. Il faut qu'on puisse voir tous les accessoires partout. Fais une proposition pour les points
// de lumière au plafond aussi qu'on puisse mieux se projeter. Respecte le plan électrique actuel »). Appelé juste après buildPrises.
//
// Sources : plans travaux v3 (22/09/2026) p. 12 (RDC électrique) et p. 13 (étage électrique), symboles relevés en vectoriel comme dans prises.ts
// (1/50 = 56,693 pt/m, origine à l'angle nord-est extérieur ; le centre d'un symbole mural est dessiné à 7 cm du nu, l'appareil est posé sur le nu
// de la maquette) ; filerie rouge suivie pour savoir quel interrupteur commande quel point ; p. 6 (façades PCMI 5) pour la hauteur des appliques
// extérieures. Pas de légende : petit cercle Ø 10 à trait = interrupteur (simple allumage ou va-et-vient d'après la filerie), même cercle vert
// « VR » = commande de volet roulant, cercle Ø 30 à croix et quartiers noirs = point lumineux au plafond (DCL), demi-cercle Ø 30 au nu d'un mur =
// applique, double cercle « Détecteur fumée » = DAAF, ⊗ bleu « VMC » = bouche d'extraction. Cercles qui se touchent = une plaque commune.
// Notice signée (15/12/2025) : Legrand Dooxie blanc dans l'habitable, Plexo dans les annexes ; volets : Dooxie with Netatmo (client, 15/10/2026).
// Hauteurs non cotées au plan : INFÉRÉES (1,10 m pour les commandes, NF C 15-100 / usage) ; voir electricite.md.
// Luminaires : PROPOSITION (modèles indicatifs) posée à chaque point lumineux du plan ; ventilateurs plafonniers avec lumière dans les 3 chambres
// (client, 15/10/2026). Les 2 spots de la salle d'eau (client, 11/10) et les 2 du dressing existent déjà (equip.ts), le spot sous l'auvent de
// l'entrée aussi (abords.ts) : ils ne sont pas redessinés ici.
//
// Géométrie légère fusionnée par calque et matériau, sans ombre portée, ignorée par les collisions. Commandes et appliques dans les calques des
// murs (rdc, r1), appareils de plafond dans ceux des plafonds (slab1 au RDC, ceil1 à l'étage). Diffuseurs allumés avec les lampes de leur niveau.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Ctx, Vec3 } from '../types';

const E1 = 2.87, T = 0.36, L = 12.90, D = 7.90, SK = 0.008; // repères de main.js ; SK : peau d'enduit en saillie du nu
const HC = 1.10; // axe des commandes au-dessus du sol fini (non coté au plan : INFÉRÉ, usage NF C 15-100, 0,90 à 1,30 m)

/** Commande murale du plan (interrupteurs, commandes de volet) : même repérage que les prises (prises.ts) */
export interface Commande {
  id: string;
  piece: string;
  lv: string;
  /** normale du mur côté pièce, nu du mur dans la maquette */
  n: string;
  face: number;
  /** [type, abscisse le long du mur] : i interrupteur, vr commande de volet roulant ; la plaque est centrée sur la moyenne */
  postes: [string, number][];
  /** axe au-dessus du sol fini (étage : E1, garage : −0,13) */
  h: number;
  st: string;
  type: string;
  mur: string;
  /** ce que commande chaque poste, dans l'ordre des postes (filerie du plan) */
  circuit: string;
  src: string;
  floor?: number;
  plexo?: boolean;
  /** abscisses du plan quand la plaque a été recalée (chambranle, tableau de fenêtre) */
  planA?: number[];
}
const P12 = 'p. 12', P13 = 'p. 13';
export const COMMANDES: Commande[] = [
  // ---- RDC (p. 12)
  { id: 'I01', piece: 'Entrée', lv: 'rdc', n: '+x', face: T, postes: [['i', 2.820], ['i', 2.920], ['i', 3.019]], h: HC, st: 'inf', type: '3 interrupteurs (plaque 3 postes)', mur: 'façade nord (nu x 0,36), côté serrure de la porte d\'entrée',
    circuit: 'applique extérieure de l\'entrée, en va-et-vient avec le portillon (flèche « Va et vient vers portillon ») · 2 DCL de l\'entrée, en va-et-vient avec I04 · DCL de l\'escalier, en va-et-vient avec I23', src: P12 + ', 3 cercles accolés' },
  { id: 'I02', piece: 'WC', lv: 'rdc', n: '-z', face: 1.36, postes: [['i', 1.135]], planA: [1.260], h: HC, st: 'inf', type: 'interrupteur simple allumage', mur: 'cloison WC / entrée côté WC (nu z 1,36), côté serrure ; décalé de 10 cm vers le nord avec la porte de cette variante (baie 1,23 → 2,06)',
    circuit: 'DCL du WC', src: P12 },
  { id: 'I03', piece: 'Local technique', lv: 'rdc', n: '+x', face: 5.31, postes: [['i', 2.380]], planA: [2.349], h: HC, floor: -0.13, plexo: true, st: 'inf', type: 'interrupteur va-et-vient Plexo (saillie)', mur: 'cloison entrée / garage côté local technique (nu x 5,31), côté serrure de la porte ISO 83',
    circuit: '2 DCL du garage et du local technique, en va-et-vient avec I06', src: P12 },
  { id: 'I04', piece: 'Entrée', lv: 'rdc', n: '-x', face: 5.16, postes: [['i', 3.049]], h: HC, st: 'inf', type: 'interrupteur va-et-vient', mur: 'cloison entrée / garage côté entrée (nu x 5,16), à l\'arrivée du séjour',
    circuit: '2 DCL de l\'entrée, en va-et-vient avec I01', src: P12 },
  { id: 'I05', piece: 'Séjour', lv: 'rdc', n: '+z', face: 3.30, postes: [['i', 5.311], ['i', 5.411]], h: HC, st: 'inf', type: '2 interrupteurs va-et-vient (plaque 2 postes)', mur: 'mur garage / séjour (nu z 3,30), en entrant depuis l\'entrée',
    circuit: '2 DCL de la salle à manger, en va-et-vient avec I09 · DCL du salon, en va-et-vient avec I07', src: P12 + ', 2 cercles accolés' },
  { id: 'I06', piece: 'Garage', lv: 'rdc', n: '-z', face: 3.15, postes: [['i', 12.380], ['i', 12.481]], h: HC, floor: -0.13, plexo: true, st: 'inf', type: '2 interrupteurs Plexo (saillie, 2 boîtiers)', mur: 'mur garage / séjour côté garage (nu z 3,15), près de la porte de garage',
    circuit: '2 DCL du garage, en va-et-vient avec I03 · applique extérieure au-dessus de la porte de garage', src: P12 + ', 2 cercles accolés' },
  { id: 'I07', piece: 'Séjour', lv: 'rdc', n: '-x', face: L - T, postes: [['i', 6.139], ['vr', 6.239]], h: HC, st: 'inf', type: 'interrupteur va-et-vient + commande de volet (plaque 2 postes)', mur: 'façade sud (nu x 12,54), à l\'ouest de la porte-fenêtre',
    circuit: 'DCL du salon, en va-et-vient avec I05 · volet roulant de la porte-fenêtre sud', src: P12 + ', cercle noir + cercle vert « VR » accolés' },
  { id: 'I08', piece: 'Cuisine', lv: 'rdc', n: '-z', face: D - T, postes: [['vr', 1.861], ['i', 1.961]], h: HC, st: 'inf', type: 'commande de volet + interrupteur va-et-vient (plaque 2 postes)', mur: 'façade ouest (nu z 7,54), au nord de la fenêtre',
    circuit: 'volet roulant de la fenêtre ouest · DCL au-dessus de la péninsule, en va-et-vient avec I10', src: P12 + ', cercle vert « VR » + cercle noir accolés' },
  { id: 'I09', piece: 'Séjour', lv: 'rdc', n: '-z', face: D - T, postes: [['i', 7.441], ['i', 7.541], ['vr', 7.640]], h: HC, st: 'inf', type: '2 interrupteurs + commande de volet (plaque 3 postes)', mur: 'façade ouest (nu z 7,54), au sud de la porte-fenêtre',
    circuit: '2 appliques de la terrasse · 2 DCL de la salle à manger, en va-et-vient avec I05 · volet roulant de la porte-fenêtre ouest', src: P12 + ', 2 cercles noirs + cercle vert « VR » accolés (la prise S3 touche aussi le groupe)' },
  { id: 'I10', piece: 'Cuisine', lv: 'rdc', n: '-z', face: D - T, postes: [['i', 3.960]], h: HC, st: 'inf', type: 'interrupteur va-et-vient', mur: 'façade ouest (nu z 7,54), au bout de la péninsule',
    circuit: 'DCL au-dessus de la péninsule, en va-et-vient avec I08', src: P12 },
  { id: 'I11', piece: 'Cuisine', lv: 'rdc', n: '+x', face: 3.86, postes: [['i', 4.840]], h: HC, st: 'inf', type: 'interrupteur simple allumage', mur: 'retour de la cuisine côté salle à manger (nu x 3,86, z 4,24 → 4,89)',
    circuit: 'DCL du centre de la cuisine', src: P12 },
  { id: 'V12', piece: 'Cuisine', lv: 'rdc', n: '+x', face: T, postes: [['vr', 5.079]], h: HC, st: 'inf', type: 'commande de volet roulant', mur: 'façade nord (nu x 0,36), à l\'est de la fenêtre', circuit: 'volet roulant de la fenêtre nord', src: P12 + ', cercle vert « VR »' },
  { id: 'V13', piece: 'Séjour', lv: 'rdc', n: '-z', face: D - T, postes: [['vr', 9.340]], h: HC, st: 'inf', type: 'commande de volet roulant', mur: 'façade ouest (nu z 7,54), au nord de la fenêtre', circuit: 'volet roulant de la fenêtre ouest du séjour', src: P12 + ', cercle vert « VR »' },
  // ---- étage (p. 13)
  { id: 'I20', piece: 'Bains', lv: 'r1', n: '+x', face: T, postes: [['i', 2.748]], h: 1.20, st: 'inf', type: 'interrupteur simple allumage', mur: 'façade nord (nu x 0,36), à gauche de la prise double B1',
    circuit: 'applique au-dessus du miroir', src: P13 + ', cercle accolé à la prise double « H:1.20m » : aligné sur elle' },
  { id: 'I21', piece: 'Bains', lv: 'r1', n: '-x', face: 3.86, postes: [['vr', 2.050], ['i', 2.141]], planA: [2.058, 2.149], h: HC, st: 'inf', type: 'commande de volet + interrupteur (plaque 2 postes)', mur: 'cloison bains / dégagement côté bains (nu x 3,86), côté serrure',
    circuit: 'volet roulant de la fenêtre des bains (filerie verte) · DCL des bains', src: P13 + ', cercle vert « VR » + cercle noir accolés' },
  { id: 'I22', piece: 'WC étage', lv: 'r1', n: '+x', face: 3.93, postes: [['i', 2.010]], h: HC, st: 'inf', type: 'interrupteur simple allumage', mur: 'cloison bains / WC côté WC (nu x 3,93), côté serrure', circuit: 'DCL du WC', src: P13 },
  { id: 'I23', piece: 'Palier', lv: 'r1', n: '-z', face: 4.17, postes: [['i', 3.959], ['i', 4.060]], h: HC, st: 'inf', type: '2 interrupteurs (plaque 2 postes)', mur: 'cloison chambre 3 côté palier (nu z 4,17), en haut de l\'escalier',
    circuit: 'DCL de l\'escalier, en va-et-vient avec I01 · DCL du palier (4 points de commande avec I25, I28, I31)', src: P13 + ', 2 cercles accolés' },
  { id: 'I24', piece: 'Chambre 3', lv: 'r1', n: '+z', face: 4.24, postes: [['i', 4.050]], planA: [4.069], h: HC, st: 'inf', type: 'interrupteur simple allumage', mur: 'cloison palier côté chambre 3 (nu z 4,24), côté serrure', circuit: 'DCL de la chambre 3', src: P13 },
  { id: 'I25', piece: 'Palier (dégagement WC)', lv: 'r1', n: '-x', face: 4.83, postes: [['i', 3.049]], h: HC, st: 'inf', type: 'interrupteur (point de commande du palier)', mur: 'cloison WC / salle d\'eau côté dégagement (nu x 4,83), au-dessus de la prise P1',
    circuit: 'DCL du palier (4 points de commande)', src: P13 },
  { id: 'I26', piece: 'Salle d\'eau', lv: 'r1', n: '-x', face: 6.30, postes: [['i', 2.499], ['i', 2.599]], h: HC, st: 'inf', type: '2 interrupteurs (plaque 2 postes)', mur: 'cloison salle d\'eau / dressing, sur la faïence (nu x 6,30), au sud du passage',
    circuit: '2 spots (DCL et attente spot) · applique au-dessus du miroir', src: P13 + ', 2 cercles accolés' },
  { id: 'I27', piece: 'Dressing', lv: 'r1', n: '+z', face: 1.57, postes: [['i', 6.480]], h: HC, st: 'inf', type: 'interrupteur va-et-vient', mur: 'retour du placard côté salle d\'eau (nu z 1,57), au passage de la salle d\'eau',
    circuit: '2 spots du dressing, en va-et-vient avec I30', src: P13 },
  { id: 'I28', piece: 'Palier', lv: 'r1', n: '-z', face: 4.17, postes: [['i', 7.070]], h: HC, st: 'inf', type: 'interrupteur (point de commande du palier)', mur: 'cloison bureau côté palier (nu z 4,17), à côté de la porte du bureau',
    circuit: 'DCL du palier (4 points de commande)', src: P13 },
  { id: 'I29', piece: 'Bureau', lv: 'r1', n: '+z', face: 4.24, postes: [['i', 7.100]], planA: [7.119], h: HC, st: 'inf', type: 'interrupteur simple allumage', mur: 'cloison palier côté bureau (nu z 4,24), côté serrure', circuit: 'DCL du bureau', src: P13 },
  { id: 'I30', piece: 'Dressing', lv: 'r1', n: '-z', face: 2.50, postes: [['i', 8.279]], h: HC, st: 'inf', type: 'interrupteur va-et-vient', mur: 'joue du coffre garage → combles côté dressing (nu z 2,50), à la porte de la chambre 1',
    circuit: '2 spots du dressing, en va-et-vient avec I27', src: P13 },
  { id: 'I31', piece: 'Palier', lv: 'r1', n: '-x', face: 9.07, postes: [['i', 3.210]], planA: [3.218], h: HC, st: 'inf', type: 'interrupteur (point de commande du palier)', mur: 'cloison chambre 1 côté palier (nu x 9,07), entre l\'angle et le chambranle',
    circuit: 'DCL du palier (4 points de commande)', src: P13 },
  { id: 'I32', piece: 'Chambre 1', lv: 'r1', n: '+x', face: 9.14, postes: [['i', 3.170]], h: HC, st: 'inf', type: 'interrupteur simple allumage', mur: 'cloison palier côté chambre 1 (nu x 9,14), côté serrure', circuit: 'DCL de la chambre 1', src: P13 },
  { id: 'I33', piece: 'Chambre 2', lv: 'r1', n: '+z', face: 4.24, postes: [['i', 9.110]], planA: [9.070], h: HC, st: 'inf', type: 'interrupteur simple allumage', mur: 'cloison palier côté chambre 2 (nu z 4,24), côté serrure', circuit: 'DCL de la chambre 2', src: P13 },
  { id: 'V34', piece: 'Chambre 3', lv: 'r1', n: '-z', face: D - T, postes: [['vr', 2.160]], h: HC, st: 'inf', type: 'commande de volet roulant', mur: 'façade ouest (nu z 7,54), au nord de la fenêtre', circuit: 'volet roulant de la fenêtre ouest', src: P13 + ', cercle vert « VR »' },
  { id: 'V35', piece: 'Bureau', lv: 'r1', n: '-z', face: D - T, postes: [['vr', 5.840]], h: HC, st: 'inf', type: 'commande de volet roulant', mur: 'façade ouest (nu z 7,54), au nord de la fenêtre', circuit: 'volet roulant de la fenêtre', src: P13 + ', cercle vert « VR »' },
  { id: 'V36', piece: 'Chambre 2', lv: 'r1', n: '-z', face: D - T, postes: [['vr', 9.560]], h: HC, st: 'inf', type: 'commande de volet roulant', mur: 'façade ouest (nu z 7,54), au nord de la fenêtre', circuit: 'volet roulant de la fenêtre ouest', src: P13 + ', cercle vert « VR »' },
  { id: 'V37', piece: 'Chambre 2', lv: 'r1', n: '-x', face: L - T, postes: [['vr', 5.995]], planA: [5.989], h: HC, st: 'inf', type: 'commande de volet roulant', mur: 'façade sud (nu x 12,54), à l\'ouest de la fenêtre', circuit: 'volet roulant de la fenêtre sud', src: P13 + ', cercle vert « VR »' },
  { id: 'V38', piece: 'Chambre 1', lv: 'r1', n: '-x', face: L - T, postes: [['vr', 2.325]], planA: [2.319], h: HC, st: 'inf', type: 'commande de volet roulant', mur: 'façade sud (nu x 12,54), à l\'ouest de la fenêtre', circuit: 'volet roulant de la fenêtre sud', src: P13 + ', cercle vert « VR »' },
  { id: 'V39', piece: 'Chambre 3', lv: 'r1', n: '+x', face: T, postes: [['vr', 6.339]], h: HC, st: 'inf', type: 'commande de volet roulant', mur: 'façade nord (nu x 0,36), à l\'ouest de la fenêtre', circuit: 'volet roulant de la fenêtre nord', src: P13 + ', cercle vert « VR »' },
];

/** Appareil au plafond : point lumineux du plan (DCL) et luminaire proposé, DAAF, bouche VMC, attente */
export interface Plafond { id: string; piece: string; lv: string; x: number; z: number; kind: string; type: string; src: string; prop?: string }
// kind : p25 / p30 / p40 plafonnier rond extra-plat (Ø en cm), p60 plafonnier Ø 60 cerclé de chêne, dome suspension dôme, rampe 3 suspensions,
// globe suspension globe opale, fan ventilateur plafonnier avec lumière, regX / regZ réglette LED 120 (orientée en x ou en z), daaf, vmc, vmcK (cuisine), att
export const PLAFONDS: Plafond[] = [
  // ---- RDC (p. 12)
  { id: 'L01', piece: 'WC', lv: 'rdc', x: 1.366, z: 0.854, kind: 'p25', type: 'DCL', src: P12, prop: 'plafonnier LED rond extra-plat Ø 25, blanc' },
  { id: 'L02', piece: 'Entrée', lv: 'rdc', x: 1.544, z: 2.169, kind: 'p30', type: 'DCL', src: P12, prop: 'plafonnier LED rond extra-plat Ø 30, blanc' },
  { id: 'L03', piece: 'Entrée', lv: 'rdc', x: 3.761, z: 2.182, kind: 'p30', type: 'DCL', src: P12, prop: 'plafonnier LED rond extra-plat Ø 30, blanc' },
  { id: 'L04', piece: 'Cuisine', lv: 'rdc', x: 1.955, z: 5.455, kind: 'p40', type: 'DCL', src: P12, prop: 'plafonnier LED rond extra-plat Ø 40, blanc' },
  { id: 'L05', piece: 'Cuisine', lv: 'rdc', x: 3.338, z: 6.741, kind: 'rampe', type: 'DCL', src: P12, prop: 'rampe de 3 suspensions globes opales Ø 17 au-dessus de la péninsule (pas 40 cm, bas à 1,62 m)' },
  { id: 'L06', piece: 'Salle à manger', lv: 'rdc', x: 5.555, z: 5.523, kind: 'p40', type: 'DCL', src: P12, prop: 'plafonnier LED rond extra-plat Ø 40, blanc (passage entre péninsule et table)' },
  { id: 'L07', piece: 'Salle à manger', lv: 'rdc', x: 7.349, z: 5.509, kind: 'dome', type: 'DCL', src: P12, prop: 'suspension dôme Ø 45 blanc mat et chêne au-dessus de la table (bas à 1,55 m)' },
  { id: 'L08', piece: 'Séjour', lv: 'rdc', x: 10.168, z: 5.536, kind: 'p60', type: 'DCL', src: P12, prop: 'plafonnier LED Ø 60 cerclé de chêne clair' },
  { id: 'L09', piece: 'Local technique', lv: 'rdc', x: 5.993, z: 1.690, kind: 'regZ', type: 'DCL', src: P12, prop: 'réglette LED étanche 120 cm' },
  { id: 'L10', piece: 'Garage', lv: 'rdc', x: 9.922, z: 1.675, kind: 'regX', type: 'DCL', src: P12, prop: 'réglette LED étanche 120 cm' },
  { id: 'F01', piece: 'Entrée', lv: 'rdc', x: 2.541, z: 1.730, kind: 'daaf', type: 'détecteur de fumée (DAAF)', src: P12 + ', « Détecteur fumée »' },
  { id: 'B01', piece: 'WC', lv: 'rdc', x: 0.561, z: 0.559, kind: 'vmc', type: 'bouche VMC hygro WC « BAW 5-30 »', src: P12 + ', ⊗ « VMC BAW 5-30 »' },
  { id: 'B02', piece: 'Cuisine', lv: 'rdc', x: 0.560, z: 7.340, kind: 'vmcK', type: 'bouche VMC hygro cuisine « BHC 10/45-135 »', src: P12 + ', ⊗ « VMC BHC 10/45-135 »' },
  { id: 'G01', piece: 'Garage', lv: 'rdc', x: 10.192, z: 1.465, kind: 'att', type: 'attente d\'alimentation du moteur de porte de garage (boîte Plexo au plafond)', src: P12 + ', flèche « Alim. élec pour porte de garage » (bout de la flèche ; pose au plafond INFÉRÉE)' },
  // ---- étage (p. 13) ; salle d'eau et dressing : spots déjà posés (equip.ts) au DCL et à l'« Att. spot » de chaque pièce
  { id: 'L20', piece: 'Bains', lv: 'r1', x: 2.155, z: 1.795, kind: 'p30', type: 'DCL', src: P13, prop: 'plafonnier LED rond extra-plat Ø 30, IP44' },
  { id: 'L21', piece: 'WC étage', lv: 'r1', x: 4.388, z: 1.349, kind: 'p25', type: 'DCL', src: P13, prop: 'plafonnier LED rond extra-plat Ø 25, blanc' },
  { id: 'L22', piece: 'Escalier', lv: 'r1', x: 2.324, z: 3.678, kind: 'globe', type: 'DCL', src: P13, prop: 'suspension globe opale Ø 30 au-dessus de la trémie (bas à 4,15 m, 2,54 m au-dessus de la marche à son aplomb)' },
  { id: 'L23', piece: 'Palier', lv: 'r1', x: 7.646, z: 3.678, kind: 'p30', type: 'DCL', src: P13, prop: 'plafonnier LED rond extra-plat Ø 30, blanc' },
  { id: 'L24', piece: 'Chambre 1', lv: 'r1', x: 10.809, z: 2.315, kind: 'fan', type: 'DCL', src: P13, prop: 'ventilateur plafonnier Ø 132, 3 pales chêne clair, lumière opale (pales à 2,33 m)' },
  { id: 'L25', piece: 'Chambre 2', lv: 'r1', x: 10.513, z: 5.909, kind: 'fan', type: 'DCL', src: P13, prop: 'ventilateur plafonnier Ø 132, 3 pales chêne clair, lumière opale (pales à 2,33 m)' },
  { id: 'L26', piece: 'Chambre 3', lv: 'r1', x: 2.462, z: 5.909, kind: 'fan', type: 'DCL', src: P13, prop: 'ventilateur plafonnier Ø 132, 3 pales chêne clair, lumière opale (pales à 2,33 m)' },
  { id: 'L27', piece: 'Bureau', lv: 'r1', x: 6.574, z: 5.909, kind: 'p40', type: 'DCL', src: P13, prop: 'plafonnier LED rond extra-plat Ø 40, blanc' },
  { id: 'F02', piece: 'Palier', lv: 'r1', x: 4.777, z: 3.412, kind: 'daaf', type: 'détecteur de fumée (DAAF)', src: P13 + ', « Détecteur fumée »' },
  { id: 'B03', piece: 'Bains', lv: 'r1', x: 3.425, z: 2.140, kind: 'vmc', type: 'bouche VMC hygro bains « BHB 10/40 »', src: P13 + ', ⊗ « VMC BHB 10/40 »' },
  { id: 'B04', piece: 'WC étage', lv: 'r1', x: 4.158, z: 1.839, kind: 'vmc', type: 'bouche VMC hygro WC « BAW 5-30 »', src: P13 + ', ⊗ « VMC BAW 5-30 »' },
  { id: 'B05', piece: 'Salle d\'eau', lv: 'r1', x: 5.099, z: 2.900, kind: 'vmc', type: 'bouche VMC hygro bains « BHB 10/40 »', src: P13 + ', ⊗ « VMC BHB 10/40 »' },
];

/** Applique murale du plan (demi-cercle au nu) : point du plan, luminaire proposé */
export interface Applique { id: string; piece: string; lv: string; n: string; face: number; a: number; h: number; floor?: number; kind: string; mur: string; hsrc: string; src: string; prop: string }
export const APPLIQUES: Applique[] = [
  { id: 'A01', piece: 'Bains', lv: 'r1', n: '-z', face: 3.10, a: 1.36, h: 1.95, kind: 'barre', mur: 'cloison escalier (nu z 3,10), au-dessus du meuble double vasque', hsrc: 'inférée : au-dessus du miroir (haut du miroir à 1,86 m)', src: P13, prop: 'réglette LED de miroir 60 cm, chromée' },
  { id: 'A02', piece: 'Salle d\'eau', lv: 'r1', n: '-z', face: 3.09, a: 5.70, h: 1.95, kind: 'barre', mur: 'cloison palier, sur la faïence (nu z 3,09), au-dessus de la vasque', hsrc: 'inférée : au-dessus du miroir (haut du miroir à 1,86 m)', src: P13, prop: 'réglette LED de miroir 60 cm, chromée' },
  { id: 'A03', piece: 'Extérieur ouest (terrasse)', lv: 'rdc', n: '+z', face: D + SK, a: 4.56, h: 2.20, kind: 'ext', mur: 'façade ouest, entre la fenêtre de la cuisine et la porte-fenêtre', hsrc: 'p. 6 (façade ouest, ⊗ à +2,17 / +2,23)', src: P12, prop: 'applique LED up & down cylindrique, alu RAL 7016' },
  { id: 'A04', piece: 'Extérieur ouest (terrasse)', lv: 'rdc', n: '+z', face: D + SK, a: 8.49, h: 2.20, kind: 'ext', mur: 'façade ouest, entre la porte-fenêtre et la fenêtre du séjour', hsrc: 'p. 6 (façade ouest, ⊗ à +2,17 / +2,23)', src: P12, prop: 'applique LED up & down cylindrique, alu RAL 7016' },
  { id: 'A05', piece: 'Extérieur sud', lv: 'rdc', n: '+x', face: L + SK, a: 1.719, h: 2.44, kind: 'ext', mur: 'façade sud, au-dessus du milieu de la porte de garage', hsrc: 'p. 6 (pignon sud, ⊗ à +2,44)', src: P12, prop: 'applique LED up & down cylindrique, alu RAL 7016' },
];

const ENT = 0.071, PW = 0.080, PT = 0.008, PX = 0.074; // Dooxie : entraxe des postes, plaque 80 × 80, saillie ; Plexo : pas des boîtiers juxtaposés
const NRM: Record<string, Vec3> = { '+x': [1, 0, 0], '-x': [-1, 0, 0], '+z': [0, 0, 1], '-z': [0, 0, -1] };
const ceilY = (lv, x, z) => lv === 'r1' ? 5.37 : (x > 5.31 && z < 3.15 ? 2.40 : 2.50); // plafonds : étage, garage et local technique, RDC
/** centre de la plaque (monde) et abscisse moyenne ; utilisé aussi pour electricite.md */
export function placeCmd(c: Commande) {
  const a = c.postes.reduce((s, q) => s + q[1], 0) / c.postes.length, nx = NRM[c.n][0], g = c.floor ?? (c.lv === 'r1' ? E1 : 0);
  return { x: nx ? c.face : a, z: nx ? a : c.face, y: g + c.h, a };
}

export function buildElectricite(ctx: Ctx) {
  const { M, std, groups, hooks, roomLights } = ctx;
  M.lumBlanc = std({ color: '#f3f3f0', roughness: 0.45 }); // corps laqués blancs
  M.lumDome = std({ color: '#f1f0ec', roughness: 0.55, side: THREE.DoubleSide });
  M.lumChene = std({ color: '#c9a77c', roughness: 0.6 }); // chêne clair (cercle, chapeau, pales)
  M.lumNoir = std({ color: '#1e1f21', roughness: 0.6 }); // câbles textiles noirs
  M.lumChrome = std({ color: '#eef0f2', roughness: 0.18, metalness: 0.9 });
  M.lumVerre = std({ color: '#d9dcdc', roughness: 0.3 }); // verres dépolis des appliques extérieures (non allumées)
  for (const k of ['0', '1']) M['lumDiff' + k] = std({ color: '#fbf8f2', emissive: '#fff0d8', emissiveIntensity: 0, roughness: 0.35 }); // diffuseurs opales du RDC, de l'étage
  M.daafLed = std({ color: '#7a1612', emissive: '#ff2a1a', emissiveIntensity: 0.6 });
  const BK = new Map();
  const put = (layer, mat, geo, m4) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.deleteAttribute('uv'); g.applyMatrix4(m4);
    const k = layer + '|' + mat; let b = BK.get(k); if (!b) BK.set(k, b = { layer, mat, list: [] }); b.list.push(g);
  };
  // repère mural : x à droite face au mur, y vers le haut, z sortant du mur ; origine sur le nu
  const frame = (n, x, y, z) => { const zL = new THREE.Vector3(...NRM[n]), yL = new THREE.Vector3(0, 1, 0), xL = new THREE.Vector3().crossVectors(yL, zL); return new THREE.Matrix4().makeBasis(xL, yL, zL).setPosition(x, y, z); };
  const at = (x, y, z, ry = 0) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); // repère de plafond : y = 0 au plafond, l'appareil pend en y < 0
  const cylY = (r, y0, y1, seg, x = 0, z = 0, r2 = r) => new THREE.CylinderGeometry(r2, r, y1 - y0, seg).translate(x, (y0 + y1) / 2, z);
  const discD = (r, seg, y, x = 0, z = 0) => new THREE.CircleGeometry(r, seg).rotateX(Math.PI / 2).translate(x, y, z); // disque tourné vers le bas
  const discU = (r, seg, y, x = 0, z = 0) => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2).translate(x, y, z); // vers le haut
  const boxL = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const plate = (w, h, t, r) => {
    const s = new THREE.Shape(), a = w / 2, b = h / 2;
    s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.absarc(a - r, -b + r, r, -Math.PI / 2, 0); s.lineTo(a, b - r); s.absarc(a - r, b - r, r, 0, Math.PI / 2);
    s.lineTo(-a + r, b); s.absarc(-a + r, b - r, r, Math.PI / 2, Math.PI); s.lineTo(-a, -b + r); s.absarc(-a + r, -b + r, r, Math.PI, Math.PI * 1.5);
    return new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 3 });
  };
  const tri = (w, h, up) => { const s = new THREE.Shape(); if (up) { s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(0, h / 2); } else { s.moveTo(-w / 2, h / 2); s.lineTo(0, -h / 2); s.lineTo(w / 2, h / 2); } s.closePath(); return new THREE.ShapeGeometry(s); };

  // ---------------------------------------------------------------- commandes
  // poste Dooxie : grande touche carrée affleurante dans un joint d'ombre ; volet (Dooxie with Netatmo) : touche montée / descente en deux moitiés
  // fléchées (appui court sur la moitié en cours de course = stop)
  function dooxie(layer, m4, type, ox) {
    const zf = PT + 0.0004, r = 0.0295;
    put(layer, 'prOmbre', new THREE.PlaneGeometry(2 * r + 0.0012, 2 * r + 0.0012).translate(ox, 0, zf), m4);
    if (type !== 'vr') { put(layer, 'prBlanc', boxL(ox - r, ox + r, -r, r, PT, PT + 0.0035), m4); return; }
    for (const s of [1, -1]) {
      put(layer, 'prBlanc', boxL(ox - r, ox + r, s > 0 ? 0.0007 : -r, s > 0 ? r : -0.0007, PT, PT + 0.0035), m4);
      put(layer, 'prOmbre', tri(0.011, 0.007, s > 0).translate(ox, s * 0.0145, PT + 0.0039), m4);
    }
  }
  // Plexo saillie : boîtier gris, touche claire en façade
  function plexo(layer, m4, ox) {
    put(layer, 'prPlexo', boxL(ox - 0.036, ox + 0.036, -0.036, 0.036, 0, 0.040), m4);
    put(layer, 'prClapet', boxL(ox - 0.027, ox + 0.027, -0.027, 0.027, 0.040, 0.046), m4);
  }
  for (const c of COMMANDES) {
    const n = c.postes.length, { x, y, z } = placeCmd(c), m4 = frame(c.n, x, y, z);
    const sorted = [...c.postes].sort((q, r) => q[1] - r[1]), sx = new THREE.Vector3(...NRM[c.n]).cross(new THREE.Vector3(0, -1, 0));
    const dir = (NRM[c.n][0] ? sx.z : sx.x) >= 0 ? 1 : -1; // +1 si l'abscisse croît vers la droite (même règle que prises.ts)
    if (c.plexo) { sorted.forEach((_, i) => plexo(c.lv, m4, dir * (i - (n - 1) / 2) * PX)); continue; }
    put(c.lv, 'prBlanc', plate(PW + (n - 1) * ENT, PW, PT, 0.008), m4);
    sorted.forEach(([t], i) => dooxie(c.lv, m4, t, dir * (i - (n - 1) / 2) * ENT));
  }

  // ---------------------------------------------------------------- luminaires et appareils de plafond (proposition)
  const ceilLayer = lv => lv === 'r1' ? 'ceil1' : 'slab1';
  const lit = lv => lv === 'r1' ? 'lumDiff1' : 'lumDiff0';
  function suspente(ly, m4, yb) { // rosace au plafond et câble jusqu'à yb
    put(ly, 'lumBlanc', cylY(0.055, -0.022, 0, 32), m4); put(ly, 'lumNoir', cylY(0.0022, yb, -0.022, 6), m4);
  }
  for (const p of PLAFONDS) {
    const yc = ceilY(p.lv, p.x, p.z), ly = ceilLayer(p.lv), dl = lit(p.lv), m4 = at(p.x, yc, p.z), f = p.lv === 'r1' ? E1 : 0;
    const k = p.kind;
    if (k[0] === 'p') { // plafonnier rond extra-plat (corps blanc ou cercle de chêne), diffuseur opale en sous-face
      const r = +k.slice(1) / 200, oak = k === 'p60', h = oak ? 0.05 : 0.042;
      put(ly, oak ? 'lumChene' : 'lumBlanc', cylY(r, -h, 0, 48), m4);
      put(ly, dl, discD(r - (oak ? 0.028 : 0.012), 48, -h - 0.0006), m4);
    } else if (k === 'dome') { // suspension dôme Ø 45 : chapeau chêne, abat-jour blanc mat, diffuseur au fond ; bas à 1,55 m (0,79 m au-dessus de la table)
      const yb = f + 1.55 - yc, hd = 0.20, R = 0.225, pts = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(Math.max(0.028, R * Math.sin(t * Math.PI / 2)), yb + hd * Math.cos(t * Math.PI / 2))); }
      suspente(ly, m4, yb + hd + 0.03);
      put(ly, 'lumChene', cylY(0.045, yb + hd - 0.005, yb + hd + 0.03, 24, 0, 0, 0.032), m4);
      put(ly, 'lumDome', new THREE.LatheGeometry(pts, 40), m4);
      put(ly, dl, discD(0.20, 40, yb + 0.03), m4);
    } else if (k === 'rampe') { // rampe 85 cm le long de la péninsule (z), 3 globes opales Ø 17, bas à 1,62 m
      const yg = f + 1.62 + 0.085 - yc, mz = at(p.x, yc, p.z, -Math.PI / 2);
      put(ly, 'lumBlanc', boxL(-0.425, 0.425, -0.025, 0, -0.035, 0.035), mz);
      for (const u of [-0.40, 0, 0.40]) {
        put(ly, 'lumNoir', cylY(0.0022, yg + 0.10, -0.025, 6, u), mz);
        put(ly, 'lumBlanc', cylY(0.024, yg + 0.075, yg + 0.10, 20, u, 0, 0.018), mz);
        put(ly, dl, new THREE.SphereGeometry(0.085, 24, 16).translate(u, yg, 0), mz);
      }
    } else if (k === 'globe') { // globe opale Ø 30 au-dessus de la trémie, bas à 4,15 m
      const yg = 4.15 + 0.15 - yc;
      suspente(ly, m4, yg + 0.17);
      put(ly, 'lumBlanc', cylY(0.035, yg + 0.135, yg + 0.17, 24, 0, 0, 0.028), m4);
      put(ly, dl, new THREE.SphereGeometry(0.15, 32, 20).translate(0, yg, 0), m4);
    } else if (k === 'fan') { // ventilateur plafonnier Ø 132 : rosace, tige courte, moteur blanc, 3 pales chêne inclinées de 12°, coupe opale (lumière)
      put(ly, 'lumBlanc', cylY(0.075, -0.045, 0, 32), m4); put(ly, 'lumBlanc', cylY(0.013, -0.125, -0.045, 12), m4);
      put(ly, 'lumBlanc', cylY(0.12, -0.215, -0.125, 40, 0, 0, 0.105), m4);
      put(ly, dl, new THREE.SphereGeometry(0.105, 32, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, -0.215, 0), m4);
      for (let i = 0; i < 3; i++) {
        const a = i * 2 * Math.PI / 3 + 0.4, mb = at(p.x, yc, p.z, a);
        put(ly, 'lumBlanc', boxL(0.10, 0.17, -0.185, -0.175, -0.018, 0.018), mb); // bras
        const bl = new THREE.Shape(); bl.moveTo(0.15, -0.055); bl.lineTo(0.66, -0.075); bl.quadraticCurveTo(0.68, 0, 0.66, 0.075); bl.lineTo(0.15, 0.055); bl.closePath();
        put(ly, 'lumChene', new THREE.ExtrudeGeometry(bl, { depth: 0.007, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -0.0035).rotateX(Math.PI / 2 + 0.21).translate(0, -0.172, 0), mb);
      }
    } else if (k === 'regX' || k === 'regZ') { // réglette LED étanche 120 cm (Plexo du garage), corps gris clair, diffuseur opale
      const mr = at(p.x, yc, p.z, k === 'regZ' ? Math.PI / 2 : 0);
      put(ly, 'lumBlanc', boxL(-0.60, 0.60, -0.034, 0, -0.035, 0.035), mr);
      put(ly, dl, boxL(-0.585, 0.585, -0.040, -0.034, -0.026, 0.026), mr);
    } else if (k === 'daaf') { // détecteur de fumée Ø 10, grille centrale, témoin rouge
      put(ly, 'lumBlanc', cylY(0.052, -0.034, 0, 32, 0, 0, 0.05), m4);
      put(ly, 'prPuits', discD(0.022, 24, -0.0346), m4); put(ly, 'daafLed', discD(0.003, 8, -0.0346, 0.034), m4);
    } else if (k === 'vmc' || k === 'vmcK') { // bouche d'extraction hygroréglable : collerette, fente d'aspiration, module central
      const r = k === 'vmcK' ? 0.09 : 0.075;
      put(ly, 'lumBlanc', cylY(r, -0.010, 0, 32), m4); put(ly, 'prOmbre', discD(r - 0.012, 32, -0.0104), m4);
      put(ly, 'lumBlanc', cylY(r - 0.022, -0.030, -0.010, 32, 0, 0, r - 0.026), m4);
    } else if (k === 'att') { // attente moteur : boîte Plexo grise au plafond, presse-étoupe
      put(ly, 'prPlexo', boxL(-0.04, 0.04, -0.045, 0, -0.04, 0.04), m4); put(ly, 'prPlexo', cylY(0.007, -0.03, -0.015, 10, 0.047), m4);
    }
  }
  // appliques murales
  for (const a of APPLIQUES) {
    const nx = NRM[a.n][0], g = a.floor ?? (a.lv === 'r1' ? E1 : 0), m4 = frame(a.n, nx ? a.face : a.a, g + a.h, nx ? a.a : a.face), dl = lit(a.lv);
    if (a.kind === 'barre') { // réglette de miroir 60 cm chromée sur bras court, diffuseur en sous-face
      put(a.lv, 'lumChrome', boxL(-0.04, 0.04, -0.022, 0.022, 0, 0.010), m4); put(a.lv, 'lumChrome', boxL(-0.012, 0.012, -0.008, 0.008, 0.010, 0.085), m4);
      put(a.lv, 'lumChrome', boxL(-0.30, 0.30, -0.013, 0.013, 0.075, 0.125), m4); put(a.lv, dl, boxL(-0.29, 0.29, -0.0142, -0.0128, 0.079, 0.121), m4);
    } else { // applique extérieure up & down : patte, cylindre alu RAL 7016 Ø 8 × 20, verres en haut et en bas
      put(a.lv, 'ral7016', boxL(-0.022, 0.022, -0.045, 0.045, 0, 0.040), m4);
      put(a.lv, 'ral7016', new THREE.CylinderGeometry(0.04, 0.04, 0.20, 28).translate(0, 0, 0.08), m4);
      for (const s of [1, -1]) put(a.lv, 'lumVerre', (s > 0 ? discU : discD)(0.031, 24, s * 0.1004, 0, 0.08), m4);
    }
  }
  for (const b of BK.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(b.list, false), M[b.mat]);
    mesh.name = 'électricité'; mesh.castShadow = false; mesh.receiveShadow = !b.mat.startsWith('lumDiff'); mesh.userData.navSkip = true;
    groups[b.layer].add(mesh);
  }
  // diffuseurs allumés quand une lampe de leur niveau est allumée (applyLighting, soleil.ts)
  hooks.pre.push(() => {
    for (const lv of [0, 1]) { const on = roomLights.some(l => l.userData.lv === lv && l.intensity > 0), m = M['lumDiff' + lv]; const e = on ? 1.5 : 0; if (m.emissiveIntensity !== e) m.emissiveIntensity = e; }
  });
}
