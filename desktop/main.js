// Oficina A.R — versão para Windows (abre o mesmo app do site numa janela própria)
const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');

// endereço publicado do app: o programa abre sempre a versão mais nova
let SITE = '';
try { SITE = JSON.parse(fs.readFileSync(path.join(__dirname, 'site.json'), 'utf8')).site || ''; } catch (_) {}
const LOCAL = 'app://oficina/index.html';   // cópia interna, se nunca abriu com internet

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

if (!app.requestSingleInstanceLock()) app.quit();

let janela = null;
function abrir() {
  janela = new BrowserWindow({
    width: 1600, height: 950, minWidth: 900, minHeight: 600, show: false,
    backgroundColor: '#F6F3F3', title: 'Oficina A.R', icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true }
  });
  janela.once('ready-to-show', () => { janela.maximize(); janela.show(); });
  let usouLocal = !SITE;
  janela.webContents.on('did-fail-load', (_e, codigo, _desc, url, principal) => {
    if (!principal || codigo === -3 || usouLocal) return;   // -3: navegação cancelada
    usouLocal = true; janela.loadURL(LOCAL);
  });
  janela.loadURL(SITE || LOCAL);
  // links externos (páginas de download, etc.) abrem no navegador
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  janela.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://') && !(SITE && url.startsWith(SITE))) { e.preventDefault(); shell.openExternal(url); } });
}

app.on('second-instance', () => { if (janela) { if (janela.isMinimized()) janela.restore(); janela.focus(); } });

app.whenReady().then(() => {
  const base = path.join(__dirname, 'www');
  protocol.handle('app', req => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (!p || p === '/') p = '/index.html';
    const arq = path.normalize(path.join(base, p));
    if (!arq.startsWith(base)) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(arq).toString());
  });
  Menu.setApplicationMenu(null);
  abrir();
});

app.on('window-all-closed', () => app.quit());
