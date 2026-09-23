# J&T Turbo V23+

A V23 original foi preservada. A camada nova adiciona PWA, cache offline, IndexedDB, scanner contínuo e integração com o backend WhatsApp.

## WhatsApp real
O server.js já possui endpoints da WhatsApp Cloud API. Configure no servidor WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID, WA_VERIFY_TOKEN e opcionalmente WA_APP_SECRET e WA_GRAPH_VERSION. O webhook usa POST /webhook/whatsapp e a verificação usa GET /webhook/whatsapp.

GitHub Pages executa somente a parte estática. O server.js precisa estar publicado em um host Node para o envio real pelo WhatsApp. Nunca coloque tokens no frontend ou no GitHub Pages.


## V23+ melhorias adicionais
- Modo Rua em tela cheia para operação com poucos toques.
- Painel com km estimados, tempo aproximado, restantes e concluídas.
- Rota otimizada por proximidade + melhoria 2-opt.
- GPS contínuo com registro local dos pontos.
- IndexedDB reforçado para pedidos, fila, GPS e scans.
- Sincronização preparada em /api/sync.
- CORS preparado no backend para PWA hospedada separadamente.
- Registro de horário/GPS na entrega e motivo de não entrega.
- Configuração de API em v23/config.js.
- Cache do service worker atualizado.

### Backend e WhatsApp
O frontend do GitHub Pages continua sendo estático. Para WhatsApp Cloud API e sincronização remota funcionarem de verdade, o server.js precisa estar publicado em um servidor Node e v23/config.js deve receber a URL desse backend em API_BASE. As credenciais Meta permanecem somente no servidor.


## V24 — camada operacional

A V24 adiciona uma camada operacional sem remover o fluxo V23:

- central de operação com diagnóstico e alertas;
- sincronização automática com IndexedDB + backend quando configurado;
- cache de rota para operação offline;
- GPS contínuo e trilha local;
- otimização por matriz de tempo de deslocamento quando o backend/OSRM está disponível, com fallback offline;
- comprovante de entrega com recebedor, documento opcional, foto opcional e assinatura;
- webhook WhatsApp vinculado ao pedido por telefone e captura de localização recebida;
- sincronização no servidor com merge por ID e timestamp;
- endpoint de matriz de rota em `/api/route/matrix`;
- endpoint de sessão em `/api/session/:id`;
- proteção opcional por `JT_API_KEY` e CORS configurável por `CORS_ORIGIN`;
- Dockerfile e `render.yaml` para publicação do backend.

### Publicação do backend

O GitHub Pages continua hospedando o frontend estático. O `server.js` deve ser publicado separadamente. Depois de publicar o backend, defina `v23/config.js` com a URL pública do backend em `API_BASE`.

Segredos do WhatsApp ficam somente no backend: `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_VERIFY_TOKEN`, `WA_GRAPH_VERSION` e opcionalmente `WA_APP_SECRET`. Para produção, também é possível definir `JT_API_KEY` e `CORS_ORIGIN`.
