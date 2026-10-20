// Matériaux partagés (M) et choix des finitions de sol
import * as THREE from 'three';
import { RAL7016, TEX, TILE_OPTIONS, tileTexture, parquetTexture } from './textures';
import { renderer, requestRender } from './rendu';
import type { Materials } from '../types';

// ---------------------------------------------------------------- materials
export const M: Materials = {};
export function std(o?: THREE.MeshStandardMaterialParameters) { return new THREE.MeshStandardMaterial(o); }
export function buildMaterials() {
  M.enduit = std({ map: TEX.enduit, bumpMap: TEX.enduit, bumpScale: 0.9, roughness: 0.95 });
  M.lisse = std({ map: TEX.lisse, roughness: 0.8 });
  M.paint = std({ map: TEX.paint, roughness: 0.92 });
  M.stairPaint = std({ color: '#f4f3ef', roughness: 0.8 });
  M.garageWall = std({ color: '#d9d6cf', roughness: 0.95 });
  M.ceiling = std({ color: '#f6f5f1', roughness: 0.95 });
  M.cut = std({ color: '#5b5651', roughness: 0.9 });
  M.insul = std({ color: '#e9dfc4', roughness: 1 });
  M.alu = std({ color: RAL7016, roughness: 0.5 }); // RAL 7016 thermolaqué satiné (peinture : non métallique)
  M.sable = std({ map: TEX.sable, roughness: 0.78 });
  M.garage = std({ color: RAL7016, roughness: 0.5 });
  M.bbi = std({ color: '#dcd3c2', roughness: 0.55 }); // alu laqué ton pierre : caches (sous-faces) des coffres de volets roulants encastrés (choix client du 11/10)
  M.appui = std({ color: '#efede6', roughness: 0.6 });
  M.galet = std({ color: '#9a948b', roughness: 0.8 });
  M.terrace = std({ map: TEX.terrace, roughness: 0.75 }); M.terraceEdge = std({ color: '#bdb9b1', roughness: 0.85 });
  M.pergola = std({ color: RAL7016, roughness: 0.5 });
  M.curbStone = std({ color: '#b3b0aa', roughness: 0.9 });
  M.spotLed = std({ color: '#ffffff', emissive: '#fff4e0', emissiveIntensity: 1.2, roughness: 0.4 });
  M.glass = std({ color: '#9fb4bd', roughness: 0.03, metalness: 0.25, transparent: true, opacity: 0.26, envMapIntensity: 1.6, depthWrite: false });
  M.glassOpaque = std({ color: '#eef2f2', roughness: 0.55, transparent: true, opacity: 0.9 });
  M.glassShower = std({ color: '#dfe9ea', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  M.eurielle = std({ map: TEX.eurielle, roughness: 0.45, side: THREE.DoubleSide, emissive: '#ffffff', emissiveMap: TEX.eurielle, emissiveIntensity: 0.22 }); // verre sablé : diffuse la lumière
  M.slats = std({ map: TEX.slats, roughness: 0.5 });
  M.roof = std({ map: TEX.roof, bumpMap: TEX.roof, bumpScale: 2, roughness: 0.78 });
  M.ridge = std({ color: '#3b3d41', roughness: 0.7 });
  M.soffit = std({ color: RAL7016, roughness: 0.6 });
  M.grass = std({ map: TEX.grass, roughness: 1 });
  M.gravel = std({ map: TEX.gravel, bumpMap: TEX.gravel, bumpScale: 2, roughness: 1 });
  M.asphalt = std({ map: TEX.asphalt, roughness: 0.95 });
  M.curb = std({ map: TEX.curb, roughness: 0.95 });
  M.concrete = std({ map: TEX.concrete, roughness: 0.9 });
  M.stair = std({ map: TEX.concrete, color: '#e2ded6', roughness: 0.85 });
  M.stairTile = std({ map: TEX.stairTile, roughness: 0.5 }); // marches en chêne clair verni mat
  M.garageFloor = std({ map: TEX.concrete, color: '#f2efe9', roughness: 0.7 });
  M.mulch = std({ map: TEX.mulch, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  M.faience = std({ map: TEX.faience, roughness: 0.15 });
  M.mesh = std({ map: TEX.mesh, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  M.meshPost = std({ color: '#2f4a32', roughness: 0.6 });
  M.oldWall = std({ map: TEX.enduit, color: '#d8d3c8', roughness: 0.95 });
  M.coping = std({ color: '#e8e2d4', roughness: 0.75 });
  M.fenceAlu = std({ color: RAL7016, roughness: 0.5 });
  M.hedge = std({ map: TEX.hedge, roughness: 1 });
  M.tileR = std({ roughness: 0.4 }); M.tileW = std({ roughness: 0.4 }); M.parquet = std({ roughness: 0.55 });
  // mobilier, équipements
  M.wood = std({ color: '#b48a5c', roughness: 0.6 });
  M.woodDark = std({ color: '#6e5038', roughness: 0.6 });
  M.oak = std({ color: '#cdb594', roughness: 0.6 });
  M.fabric = std({ color: '#8e9195', roughness: 1 });
  M.sofa = std({ map: TEX.sofa, bumpMap: TEX.sofa, bumpScale: 0.6, roughness: 1 });
  M.fabricWarm = std({ color: '#b9a48a', roughness: 1 });
  M.linen = std({ color: '#ece7dd', roughness: 1 });
  M.white = std({ color: '#f3f2ee', roughness: 0.55 });
  M.front = std({ color: '#e9e6df', roughness: 0.45 });
  M.plinth = std({ color: '#55534f', roughness: 0.6 });
  M.worktop = std({ color: '#4a4744', roughness: 0.35 });
  M.black = std({ color: '#141414', roughness: 0.15 });
  M.blackMatte = std({ color: '#1c1d1f', roughness: 0.55, metalness: 0.2 });
  M.inox = std({ color: '#c8cbce', roughness: 0.3, metalness: 0.9 });
  M.ceramic = std({ color: '#ffffff', roughness: 0.12 });
  M.mirror = std({ color: '#dfe7ea', roughness: 0.08, metalness: 0.15, envMapIntensity: 2 });
  M.rug = std({ color: '#c2b8a6', roughness: 1 });
  M.leaf = std({ color: '#4f7a35', roughness: 0.9 });
  M.leaf2 = std({ color: '#6c8f3e', roughness: 0.9 });
  M.flower = std({ color: '#7d5fa6', roughness: 0.8 });
  // plantes hautes du jardin de pluie : joncs, calamagrostis (feuillage, épis paille), massettes (épis bruns), salicaires (épis pourpres), iris des marais (fleurs jaunes)
  M.reed = std({ color: '#4d6e3a', roughness: 0.85, side: THREE.DoubleSide }); M.reed2 = std({ color: '#71894a', roughness: 0.85, side: THREE.DoubleSide });
  M.plume = std({ color: '#cdb98e', roughness: 0.95 }); M.typha = std({ color: '#5a3b22', roughness: 0.9 }); M.lythrum = std({ color: '#b44c94', roughness: 0.8 }); M.iris = std({ color: '#e6c534', roughness: 0.7 });
  M.foliage = std({ vertexColors: true, roughness: 0.85 });
  M.trunk = std({ color: '#6a5641', roughness: 1 });
  M.door = std({ color: '#f5f4f0', roughness: 0.5 });
  M.doorLeaf = std({ color: '#f7f7f4', roughness: 0.28 }); // laqué blanc
  M.doorFrame = std({ color: '#f4f4f1', roughness: 0.35 });
  M.doorGroove = std({ color: '#b9bcbf', roughness: 0.35, metalness: 0.6 });
  M.handle = std({ color: RAL7016, roughness: 0.38, metalness: 0.15 }); // gris anthracite RAL 7016
  M.closetDoor = std({ color: '#bcbfc1', roughness: 0.4 }); // gris clair, pour repérer les placards
  M.closetRail = std({ color: '#a7aaad', roughness: 0.35, metalness: 0.6 });
  M.radiator = std({ color: '#f4f4f1', roughness: 0.35, metalness: 0.1 });
  M.pac = std({ color: '#e4e5e3', roughness: 0.45, metalness: 0.1 });
  M.grille = std({ color: RAL7016, roughness: 0.55 });
  M.lamp = std({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0.0, roughness: 0.3 });
  M.neighbour = std({ map: TEX.lisse, color: '#ebe7df', roughness: 0.95 });
  M.roofN = std({ color: '#4d4a48', roughness: 0.85 });
  setTile('R', 'beige'); setTile('W', 'beige'); setParquet('clair');
}
export const finish = { R: 'beige', W: 'beige', P: 'clair' };
export function setTile(level: 'R' | 'W', key: string) {
  finish[level] = key;
  const m = level === 'R' ? M.tileR : M.tileW; const o = TILE_OPTIONS[key];
  if (m.map) m.map.dispose();
  m.map = tileTexture(key); m.roughness = o.rough; m.needsUpdate = true; if (renderer) requestRender(false);
  if (level === 'W' && finish.P === 'carrelage') setParquet('carrelage');
}
export function setParquet(key: string) {
  finish.P = key; const m = M.parquet;
  if (m.map) m.map.dispose();
  if (key === 'carrelage') { m.map = tileTexture(finish.W); m.roughness = TILE_OPTIONS[finish.W].rough; }
  else { m.map = parquetTexture(key); m.roughness = 0.5; }
  m.needsUpdate = true; if (renderer) requestRender(false);
}
