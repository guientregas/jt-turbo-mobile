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
