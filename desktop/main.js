// Oficina A.R — versão para Windows (abre o mesmo app do site numa janela própria)
const { app, BrowserWindow, Menu, protocol, net, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

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
  janela.loadURL('app://oficina/index.html');
  // links externos (páginas de download, etc.) abrem no navegador
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  janela.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url); } });
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
