# J&T Turbo V24 — organização

## Camadas

`v23/index.html` — interface e fluxo legado mantidos por compatibilidade.

`v23/ops-v24.js` — camada operacional V24: central, alertas, GPS contínuo, comprovante, sincronização e otimização de rota.

`v23/offline.js` — persistência local IndexedDB e sincronização.

`v23/sw.js` — cache/PWA/offline.

`server.js` — API, sincronização, roteamento e WhatsApp.

`Dockerfile` / `render.yaml` — publicação do backend.

## Regra de evolução

Novos recursos devem entrar em módulos separados sempre que possível. O `index.html` permanece estável para evitar regressões no fluxo do V23.
