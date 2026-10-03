# Oficina A.R

App de registros de serviço da Oficina Mecânica A.R.

- **Site instalável:** publicado pelo GitHub Pages a cada atualização (página `baixar.html` tem os links e instruções).
- **Windows (.exe)** e **Android (.apk):** gerados automaticamente pelo GitHub Actions e anexados à versão mais recente em *Releases*.
- **Sincronização:** Firebase (Firestore + login por e-mail). Configuração em `config/firebase.json`; regras em `config/firestore.rules`.

## Estrutura

| Pasta | O que tem |
|---|---|
| `app/` | O app (mesmo arquivo do Claude), o adaptador para Firebase/arquivos, service worker, ícones, página de downloads |
| `scripts/build.mjs` | Gera `www/` com tudo local (bibliotecas e fontes) |
| `desktop/` | Janela do Windows (Electron) |
| `mobile/` | App Android (Capacitor) |
| `.github/workflows/build.yml` | Compila e publica tudo a cada push |
