/* Oficina A.R — adaptador da versão instalável (site, Windows e Android).
   O app foi escrito para rodar dentro do Claude, que oferece "db" (registros sincronizados)
   e "downloads" (salvar arquivos). Aqui os dois são trocados por Firebase e pelos recursos
   de cada plataforma, sem mexer no código do app. */
(function(){
  'use strict';
  const cap = window.Capacitor;
  const plat = cap && cap.isNativePlatform && cap.isNativePlatform() ? 'android'
             : /Electron/i.test(navigator.userAgent) ? 'pc' : 'web';
  const REPO = window.AR_REPO || '';
  const VERSAO = Number(window.AR_VERSAO || 0);
  const html = document.documentElement;
  html.classList.add('app-final', 'plat-' + plat);

  // primeira abertura: começa sem os registros de exemplo
  try {
    if (localStorage.getItem('ar-orcamentos') === null) localStorage.setItem('ar-orcamentos', '[]');
    localStorage.setItem('ar-ex3', '1');
    localStorage.removeItem('ar-modo');
  } catch (_) {}

  const css = document.createElement('style');
  css.textContent = `
    /* o botão PC/Cel era só para testes */
    html.app-final .view-toggle{display:none!important}
    html.app-final header.top{top:0;padding-top:env(safe-area-inset-top,0px)}
    html.app-final #sync{cursor:pointer}
    .ar-login{position:fixed;inset:0;z-index:1000;background:#F6F3F3;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Barlow,system-ui,sans-serif;color:#1D1B1C}
    .ar-login form{width:100%;max-width:360px;background:#fff;border:1px solid #ECE4E6;border-radius:16px;padding:26px 22px;display:flex;flex-direction:column;gap:14px;box-shadow:0 10px 30px rgba(29,27,28,.08)}
    .ar-login .marca{display:flex;align-items:baseline;gap:8px;justify-content:center;color:#C8102E;margin-bottom:4px}
    .ar-login .marca b{font:800 40px/1 'Barlow Condensed',sans-serif}
    .ar-login .marca span{font:600 14px 'Barlow Condensed',sans-serif;letter-spacing:.07em;text-transform:uppercase}
    .ar-login p{margin:0;text-align:center;color:#6E6669;font-size:14px}
    .ar-login label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6E6669}
    .ar-login input{border:1.5px solid #ECE4E6;border-radius:10px;padding:12px;font:500 16px Barlow,system-ui,sans-serif;color:#1D1B1C;outline:none}
    .ar-login input:focus{border-color:#C8102E}
    .ar-login button{border:0;border-radius:10px;min-height:48px;background:#C8102E;color:#fff;font:600 16px Barlow,system-ui,sans-serif;cursor:pointer}
    .ar-login button[disabled]{opacity:.6}
    .ar-login .erro{color:#C8102E;font-weight:600;min-height:1.2em}
  `;
  document.head.appendChild(css);

  const aviso = (m, ms, acao) => { if (typeof window.toast === 'function') window.toast(m, ms, acao); };
  const abrirFora = url => { window.open(url, '_blank'); };

  // ---------- login ----------
  function telaLogin(auth){
    return new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'ar-login';
      box.innerHTML = `<form autocomplete="on" novalidate>
        <div class="marca"><b>A.R.</b><span>Oficina Mecânica</span></div>
        <p>Entre uma vez neste aparelho para ver e guardar os registros em todos os aparelhos.</p>
        <label>E-mail<input type="email" name="email" autocomplete="username" inputmode="email" required></label>
        <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
        <div class="erro" role="alert"></div>
        <button type="submit">Entrar</button>
      </form>`;
      document.body.appendChild(box);
      const f = box.querySelector('form'), erro = box.querySelector('.erro'), bt = box.querySelector('button');
      setTimeout(() => f.email.focus(), 50);
      f.onsubmit = async e => {
        e.preventDefault();
        erro.textContent = ''; bt.disabled = true; bt.textContent = 'Entrando…';
        try {
          await auth.signInWithEmailAndPassword(f.email.value.trim(), f.senha.value);
          box.remove(); resolve();
        } catch (err) {
          const c = (err && err.code) || '';
          erro.textContent = c.includes('network') ? 'Sem internet. Conecte e tente de novo.'
            : c.includes('too-many') ? 'Muitas tentativas. Espere um pouco.'
            : 'E-mail ou senha incorretos.';
          bt.disabled = false; bt.textContent = 'Entrar';
        }
      };
    });
  }

  // ---------- banco de dados (Firebase) ----------
  let dbPromessa = null;
  function iniciarDb(){
    const cfg = window.AR_FIREBASE;
    if (!cfg || !cfg.apiKey || !window.firebase) return Promise.resolve(null);
    const app = firebase.initializeApp(cfg);
    const fs = app.firestore();
    try { fs.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (_) {}
    const auth = app.auth();
    const logado = new Promise(resolve => {
      const parar = auth.onAuthStateChanged(u => {
        parar();
        if (u) resolve(u); else telaLogin(auth).then(() => resolve(auth.currentUser));
      });
    });
    // tocar no indicador de sincronização mostra a conta e permite sair
    const chip = document.getElementById('sync');
    if (chip) chip.addEventListener('click', () => {
      const u = auth.currentUser; if (!u) return;
      aviso('Conectado como ' + u.email + '.', 6000, { rotulo: 'Sair', fn: () => auth.signOut().then(() => location.reload()) });
    });
    const semPermissao = e => {
      if (e && e.code === 'permission-denied')
        setTimeout(() => aviso('O banco recusou o acesso desta conta. Confira as regras do Firestore.', 8000), 60);
      throw e;
    };
    return logado.then(() => ({
      collection(nome){
        const c = fs.collection(nome);
        return {
          doc(id){
            const d = c.doc(id);
            return { set: v => d.set(v).catch(semPermissao), delete: () => d.delete().catch(semPermissao) };
          },
          onSnapshot(cb, err){ return c.onSnapshot({ includeMetadataChanges: true }, cb, e => { try { semPermissao(e); } catch (_) {} if (err) err(e); }); }
        };
      }
    }));
  }

  // ---------- salvar / compartilhar arquivos ----------
  const paraBase64 = blob => new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => falha(r.error);
    r.readAsDataURL(blob);
  });
  function baixar(nome, blob){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
  }
  async function salvarArquivo({ filename, data }){
    if (plat === 'android') {
      const { Filesystem, Share } = cap.Plugins;
      const r = await Filesystem.writeFile({ path: filename, data: await paraBase64(data), directory: 'CACHE' });
      try { await Share.share({ title: filename, dialogTitle: 'Enviar ' + filename, files: [r.uri] }); }
      catch (e) { if (/cancel/i.test((e && e.message) || '')) throw { code: 'declined' }; throw e; }
      return;
    }
    if (plat === 'web' && navigator.canShare && matchMedia('(pointer:coarse)').matches) {
      const arq = new File([data], filename, { type: data.type });
      if (navigator.canShare({ files: [arq] })) {
        const compartilhar = () => navigator.share({ files: [arq], title: filename });
        try { await compartilhar(); return; }
        catch (e) {
          if (e && e.name === 'AbortError') throw { code: 'declined' };
          if (e && e.name === 'NotAllowedError') {
            // o arquivo demorou para ficar pronto e o navegador pede um novo toque
            await new Promise(ok => {
              let feito = false;
              aviso(filename + ' pronto.', 15000, { rotulo: 'Compartilhar', fn: () => { feito = true; compartilhar().catch(() => baixar(filename, data)).finally(ok); } });
              setTimeout(() => { if (!feito) { baixar(filename, data); ok(); } }, 15500);
            });
            return;
          }
        }
      }
    }
    baixar(filename, data);
  }

  const dicas = {
    android: '',
    pc: '',
    web: matchMedia('(pointer:coarse)').matches ? '' : ' O arquivo foi para a pasta de downloads.'
  };
  window.AR_APP = { plat, dica: dicas[plat] || '' };

  window.claude = {
    use(nome){
      if (nome === 'db') return dbPromessa || (dbPromessa = iniciarDb());
      if (nome === 'downloads') return Promise.resolve({ save: salvarArquivo });
      return Promise.resolve(null);
    }
  };

  // ---------- Android: botão voltar ----------
  if (plat === 'android' && cap.Plugins.App) {
    cap.Plugins.App.addListener('backButton', () => {
      const aberto = ['#picker', '#sheet'].some(s => { const el = document.querySelector(s); return el && !el.hidden; });
      if (aberto) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return; }
      const tab = document.getElementById('tab-novo');
      if (tab && tab.getAttribute('aria-selected') !== 'true') { tab.click(); return; }
      cap.Plugins.App.minimizeApp();
    });
  }

  // ---------- atualizações ----------
  window.addEventListener('load', () => {
    if (plat === 'web') {
      if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
      return;
    }
    if (!REPO || !VERSAO) return;
    setTimeout(() => {
      fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(v => {
        const nova = v && Number(String(v.tag_name || '').replace(/\D/g, ''));
        if (!(nova > VERSAO)) return;
        const arq = plat === 'pc' ? 'OficinaAR-Instalador.exe' : 'OficinaAR.apk';
        aviso('Tem uma versão nova do app.', 12000, { rotulo: 'Baixar', fn: () => abrirFora(`https://github.com/${REPO}/releases/latest/download/${arq}`) });
      }).catch(() => {});
    }, 4000);
  });
})();
