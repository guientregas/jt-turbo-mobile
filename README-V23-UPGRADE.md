# J&T Turbo V23+

A V23 original foi preservada. A camada nova adiciona PWA, cache offline, IndexedDB, scanner contínuo e integração com o backend WhatsApp.

## WhatsApp real
O server.js já possui endpoints da WhatsApp Cloud API. Configure no servidor WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID, WA_VERIFY_TOKEN e opcionalmente WA_APP_SECRET e WA_GRAPH_VERSION. O webhook usa POST /webhook/whatsapp e a verificação usa GET /webhook/whatsapp.

GitHub Pages executa somente a parte estática. O server.js precisa estar publicado em um host Node para o envio real pelo WhatsApp. Nunca coloque tokens no frontend ou no GitHub Pages.
