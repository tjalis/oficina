// Aponta o .exe e o .apk para o endereço publicado do app (GitHub Pages),
// para que recebam as versões novas sem reinstalar.
import fs from 'node:fs';
const repo = process.env.GITHUB_REPOSITORY || process.env.AR_REPO;
if (!repo) throw new Error('Defina GITHUB_REPOSITORY (dono/repositorio)');
const [dono, nome] = repo.split('/');
const site = `https://${dono.toLowerCase()}.github.io/${nome}/`;
fs.writeFileSync('desktop/site.json', JSON.stringify({ site }) + '\n');
const cfg = JSON.parse(fs.readFileSync('mobile/capacitor.config.json', 'utf8'));
cfg.server = { ...(cfg.server || {}), url: site, errorPath: 'index.html' };
fs.writeFileSync('mobile/capacitor.config.json', JSON.stringify(cfg, null, 2) + '\n');
console.log('app aponta para ' + site);
