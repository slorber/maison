// ---------------------------------------------------------------- données du plan (plans travaux v3, relevés en vectoriel)
// coupe AA (p. 11) : plafond RDC 2,50, plafond du garage 2,40 (2,53 au-dessus du sol du garage à −0,13), plancher étage +2,87, plafond étage +5,37,
// arase des murs +5,51 ; égout +5,67 (façades p. 6 et coupe), +5,78 côté est (gouttière havraise en limite), faîtage +8,54
export const H = { rdcCeil: 2.50, garageCeil: 2.40, r1Floor: 2.87, r1Ceil: 5.37, wallTop: 5.51, eave: 5.67, eaveE: 5.78, ridge: 8.54 };
export const L = 12.90, D = 7.90, T = 0.36, SH = 0.22; // longueur, profondeur, murs 36 cm (brique 20 + enduit, doublage 14)
export const E1 = H.r1Floor;
// faces : axis, F (plan extérieur), s (sens sortant)
export const FACE = { W: { axis: 'x', F: D, s: 1 }, E: { axis: 'x', F: 0, s: -1 }, N: { axis: 'z', F: 0, s: -1 }, S: { axis: 'z', F: L, s: 1 } };
// a0/a1 : position le long de la façade (X pour l'ouest, Z pour nord et sud) ; vr : volet roulant BBI ; gc : garde-corps
export const OPEN = {
  W: [
    { a0: 2.04, a1: 3.44, y0: 1.10, y1: 2.15, t: 'win', n: 2, lvl: 0, vr: 1 }, // cuisine
    { a0: 5.55, a1: 7.35, y0: 0, y1: 2.15, t: 'baie', n: 2, lvl: 0, vr: 1 }, // porte-fenêtre 2 vantaux du séjour, serrure barillet
    { a0: 9.46, a1: 10.86, y0: 1.10, y1: 2.15, t: 'win', n: 2, lvl: 0, vr: 1 }, // séjour : 2,04 + 1,40 + 2,11 + 1,80 + 2,11 = 9,46 (plan p. 9, symétrique de la cuisine)
    { a0: 2.24, a1: 3.24, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
    { a0: 5.95, a1: 6.95, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
    { a0: 9.66, a1: 10.66, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
  ],
  N: [
    { a0: 0.66, a1: 1.06, y0: 1.20, y1: 2.15, t: 'win', n: 1, lvl: 0, opaque: 1 }, // WC, verre opaque retardateur 44.2
    { a0: 1.82, a1: 2.72, y0: 0, y1: 2.15, t: 'entry', lvl: 0 }, // porte Bel'M Eurielle
    { a0: 3.47, a1: 3.87, y0: 1.20, y1: 2.15, t: 'win', n: 1, lvl: 0 },
    { a0: 5.18, a1: 6.58, y0: 1.10, y1: 2.15, t: 'win', n: 2, lvl: 0, vr: 1 }, // cuisine
    { a0: 1.04, a1: 1.84, y0: 3.87, y1: 5.02, t: 'win', n: 1, lvl: 1, vr: 1, opaque: 1 }, // bains
    { a0: 3.37, a1: 3.97, y0: 3.87, y1: 5.02, t: 'win', n: 0, lvl: 1 }, // fixe escalier
    { a0: 5.48, a1: 6.28, y0: 3.87, y1: 5.02, t: 'win', n: 1, lvl: 1, vr: 1 },
  ],
  S: [
    { a0: 0.43, a1: 2.93, y0: -0.13, y1: 2.12, t: 'garage', lvl: 0 }, // Novoferm ISO 45 lisse 2,50 × 2,25
    { a0: 4.65, a1: 6.05, y0: 0, y1: 2.15, t: 'baie', n: 2, lvl: 0, vr: 1 }, // porte-fenêtre 2 vantaux du séjour (sud)
    { a0: 1.08, a1: 2.28, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
    { a0: 4.75, a1: 5.95, y0: 3.57, y1: 5.02, t: 'win', n: 2, lvl: 1, vr: 1, gc: 1 },
  ],
  E: [],
};

// Porte d'entrée Bel'M Eurielle, alu 80 mm, gris anthracite 7016 sablé extérieur / blanc intérieur (avenant 1, photo Bel'M fournie)
// Vitrage : largeur 18,3 cm, haut du vitrage à 1,76 m, bas à 0,40 m, arrondis de rayon égal à la largeur côté charnières.
export const EUR = { w: 0.183, h: 1.359, r: 0.183, o: 0.045, barB: 0.220, barT: 1.089, fromLock: 0.142, y0: 0.398 };
