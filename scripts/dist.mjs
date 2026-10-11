// site statique publié par Netlify : la page autonome devient dist/index.html
import fs from 'fs';
fs.mkdirSync('dist', { recursive: true });
fs.copyFileSync('out/maison-merlettes-3d.html', 'dist/index.html');
console.log('dist/index.html prêt');
