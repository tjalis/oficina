// Gera a pasta www/ (site instalável) a partir do app do Claude em app/oficina-ar.html.
// A mesma pasta é usada pelo .exe (Electron) e pelo .apk (Capacitor).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(raiz, 'package.json'));
const saida = path.join(raiz, 'www');
const REPO = process.env.GITHUB_REPOSITORY || process.env.AR_REPO || '';
const VERSAO = Number(process.env.GITHUB_RUN_NUMBER || process.env.AR_VERSAO || 0);

const ler = p => fs.readFileSync(p, 'utf8');
const escrever = (p, t) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
const copiar = (de, para) => { fs.mkdirSync(path.dirname(para), { recursive: true }); fs.copyFileSync(de, para); };
const pacote = nome => path.dirname(require.resolve(nome + '/package.json'));

fs.rmSync(saida, { recursive: true, force: true });
fs.mkdirSync(saida, { recursive: true });

// ---------- bibliotecas locais (funciona sem internet) ----------
copiar(path.join(pacote('html2canvas'), 'dist/html2canvas.min.js'), path.join(saida, 'vendor/html2canvas.min.js'));
copiar(path.join(pacote('jspdf'), 'dist/jspdf.umd.min.js'), path.join(saida, 'vendor/jspdf.umd.min.js'));

const fb = pacote('firebase');
const fbVersao = JSON.parse(ler(path.join(fb, 'package.json'))).version;
const fbScripts = ['app', 'auth', 'firestore'].map(m => {
  const nome = `firebase-${m}-compat.js`;
  const local = path.join(fb, nome);
  if (fs.existsSync(local)) { copiar(local, path.join(saida, 'vendor', nome)); return 'vendor/' + nome; }
  console.warn('aviso: ' + nome + ' não veio no pacote; usando o endereço do Google');
  return `https://www.gstatic.com/firebasejs/${fbVersao}/${nome}`;
});

// fontes do app (Barlow, Barlow Condensed, JetBrains Mono)
const FONTES = [
  ['Barlow', '@fontsource/barlow', 'barlow', [400, 500, 600, 700]],
  ['Barlow Condensed', '@fontsource/barlow-condensed', 'barlow-condensed', [600, 700, 800]],
  ['JetBrains Mono', '@fontsource/jetbrains-mono', 'jetbrains-mono', [500, 700]]
];
let fontesCss = '';
for (const [familia, pkg, slug, pesos] of FONTES) {
  const dir = path.join(pacote(pkg), 'files');
  for (const p of pesos) {
    const arq = `${slug}-latin-${p}-normal.woff2`;
    copiar(path.join(dir, arq), path.join(saida, 'vendor/fonts', arq));
    fontesCss += `@font-face{font-family:'${familia}';font-style:normal;font-weight:${p};font-display:swap;src:url(fonts/${arq}) format('woff2')}\n`;
  }
}
escrever(path.join(saida, 'vendor/fonts.css'), fontesCss);

// ---------- página do app ----------
let src = ler(path.join(raiz, 'app/oficina-ar.html'));
function trocar(de, para) {
  const achou = de instanceof RegExp ? de.test(src) : src.includes(de);
  if (!achou) throw new Error('Trecho não encontrado no app: ' + de);
  src = src.replace(de, para);
}
trocar(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/, '');
trocar(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '<link rel="stylesheet" href="vendor/fonts.css">');
trocar(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2canvas\/[^"]*"><\/script>/,
  fbScripts.map(s => `<script src="${s}"></script>`).join('\n') +
  '\n<script src="config.js"></script>\n<script src="adaptador.js"></script>\n<script src="vendor/html2canvas.min.js"></script>');
trocar(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/[^"]*"><\/script>/, '<script src="vendor/jspdf.umd.min.js"></script>');
// mensagem depois de exportar: cada plataforma tem a sua
trocar(/\+' Para mandar pelo WhatsApp:[^']*'/, "+(window.AR_APP?AR_APP.dica:'')");
// abre com um registro em branco em vez do exemplo
trocar('atual=JSON.parse(JSON.stringify(lista[0]||EXEMPLOS[0])); oferecerRascunho(); carregar(); renderLista();',
  'novo(); oferecerRascunho(); renderLista();');
trocar(/<title>[^<]*<\/title>/, '<title>Oficina A.R</title>');

const head = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#C8102E">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Oficina A.R">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>:root{color-scheme:light}body{margin:0;padding:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
`;
escrever(path.join(saida, 'index.html'), head + src + '\n</body>\n</html>\n');

// ---------- configuração ----------
const cfgArq = path.join(raiz, 'config/firebase.json');
const cfg = fs.existsSync(cfgArq) ? JSON.parse(ler(cfgArq)) : null;
escrever(path.join(saida, 'config.js'),
  `window.AR_FIREBASE=${JSON.stringify(cfg && cfg.apiKey ? cfg : null)};\nwindow.AR_REPO=${JSON.stringify(REPO)};\nwindow.AR_VERSAO=${VERSAO};\n`);
if (!cfg || !cfg.apiKey) console.warn('aviso: config/firebase.json sem apiKey; o app vai funcionar só no aparelho');

// ---------- arquivos do site ----------
copiar(path.join(raiz, 'app/adaptador.js'), path.join(saida, 'adaptador.js'));
for (const f of fs.readdirSync(path.join(raiz, 'app/icons'))) copiar(path.join(raiz, 'app/icons', f), path.join(saida, 'icons', f));
escrever(path.join(saida, 'baixar.html'), ler(path.join(raiz, 'app/baixar.html')).replaceAll('{{REPO}}', REPO).replaceAll('{{VERSAO}}', String(VERSAO)));
escrever(path.join(saida, 'version.json'), JSON.stringify({ versao: VERSAO }) + '\n');
escrever(path.join(saida, 'manifest.webmanifest'), JSON.stringify({
  name: 'Oficina A.R', short_name: 'Oficina A.R', lang: 'pt-BR',
  description: 'Registros de serviço da Oficina Mecânica A.R',
  start_url: './', scope: './', display: 'standalone',
  background_color: '#F6F3F3', theme_color: '#C8102E',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2));

// service worker: lista do que guardar para abrir sem internet
const lista = [];
(function andar(d, rel) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), r = rel ? rel + '/' + f : f;
    if (fs.statSync(p).isDirectory()) andar(p, r); else if (!['baixar.html', 'version.json'].includes(r)) lista.push(r);
  }
})(saida, '');
lista.unshift('./');
escrever(path.join(saida, 'sw.js'), ler(path.join(raiz, 'app/sw.js')).replace('__VERSAO__', String(VERSAO)).replace('__ARQUIVOS__', JSON.stringify(lista)));
escrever(path.join(saida, '.nojekyll'), '');

console.log(`www/ pronta · versão ${VERSAO} · ${lista.length} arquivos · repositório ${REPO || '(local)'}`);
