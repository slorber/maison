// Build Vite : une seule page autonome (JS et CSS inline, textures dessinées au chargement), plus le fragment pour claude.ai
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// repère posé dans index.html : le fragment commence juste après
const MARK = /<!-- fragment Artifact\b[^>]*-->\n?/;

/**
 * Après l'inlining de vite-plugin-singlefile :
 * - remet le script de la maquette en fin de body, comme dans l'ancien gabarit (Vite l'injecte dans le head) ;
 * - écrit out/maquette.html, le fragment pour un Artifact claude.ai : la même page sans doctype, html, head, body
 *   ni l'en-tête de page (meta, style de base) ;
 * - écrit out/maison-merlettes-3d.html, copie de dist/index.html au chemin de l'ancien build (scripts de rendu).
 */
function fragmentArtifact(): Plugin {
  let root = process.cwd(), outDir = 'dist';
  return {
    name: 'maison:fragment-artifact',
    apply: 'build',
    enforce: 'post',
    configResolved(c) { root = c.root; outDir = path.resolve(c.root, c.build.outDir); },
    writeBundle() {
      const file = path.join(outDir, 'index.html');
      let html = fs.readFileSync(file, 'utf8');
      const open = '<script type="module" crossorigin>', i = html.indexOf(open), j = html.indexOf('</script>', i);
      if (i < 0 || j < 0 || html.indexOf(open, j) >= 0) throw new Error('fragment : script inline de la maquette introuvable ou en double');
      const script = html.slice(i, j + '</script>'.length);
      html = html.slice(0, i).replace(/\n[ \t]*$/, '') + html.slice(j + '</script>'.length);
      const b = html.lastIndexOf('</body>');
      html = html.slice(0, b) + script + '\n' + html.slice(b);
      fs.writeFileSync(file, html);

      const m = MARK.exec(html), h = html.indexOf('</head>'), b0 = html.indexOf('<body>'), b1 = html.lastIndexOf('</body>');
      if (!m || h < m.index || b0 < h || b1 < b0) throw new Error('fragment : repère, head ou body introuvable dans dist/index.html');
      const frag = html.slice(m.index + m[0].length, h) + html.slice(b0 + '<body>'.length, b1).replace(/^\n/, '');
      const out = path.join(root, 'out');
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, 'maquette.html'), frag.trimEnd() + '\n');
      fs.copyFileSync(file, path.join(out, 'maison-merlettes-3d.html'));
      console.log(`page : ${path.relative(root, file)} (${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko) · fragment : out/maquette.html (${(Buffer.byteLength(frag) / 1024).toFixed(0)} Ko)`);
    },
  };
}

export default defineConfig({
  plugins: [viteSingleFile(), fragmentArtifact()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    // une seule page sans import dynamique : ni polyfill de modulepreload, ni CSS retouché (gabarit tel quel)
    modulePreload: { polyfill: false },
    cssMinify: false,
    reportCompressedSize: false,
    // garde l'avis de licence de three.js (commentaire @license), comme l'ancien build esbuild
    rolldownOptions: { output: { comments: { legal: true, annotation: false, jsdoc: false } } },
  },
});
