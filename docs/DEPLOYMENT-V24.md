# J&T Turbo V24 — publicação

## Arquitetura

- Frontend/PWA: GitHub Pages em `/v23/`
- Backend: Node.js/Express em serviço web separado
- Dados locais: IndexedDB
- Sincronização: `/api/sync`
- Rotas: `/api/route` e `/api/route/matrix`
- WhatsApp: Meta Cloud API pelo backend

## Backend

O backend pode ser publicado em Railway, Render ou outro serviço Node/Docker. Nunca coloque tokens do WhatsApp no frontend.

### Variáveis

Use `.env.example` como referência. Em produção, configure os valores no painel do provedor.

### Após publicar

1. Teste `GET /health`.
2. Copie a URL HTTPS do backend.
3. Atualize `v23/config.js` para `API_BASE` com essa URL.
4. Faça novo deploy do GitHub Pages.
5. Configure no Meta Developers o webhook HTTPS em `/webhook/whatsapp`.
6. Use o mesmo `WA_VERIFY_TOKEN` configurado no backend.
7. Configure o evento de mensagens do WhatsApp.
8. Teste mensagem de texto e compartilhamento de localização.

### Segurança

Defina `CORS_ORIGIN` para a origem real do frontend e `JT_API_KEY` para proteger a API. Não commite `.env` nem tokens.

## Operação

A Central de Operação do V24 mostra diagnóstico, sincronização, alertas e cache de rota. O aplicativo continua operando localmente quando o backend não está configurado.


## V24.1 — produção

O backend agora suporta PostgreSQL por `DATABASE_URL` e mantém `db.json` apenas como fallback local. Em produção, configure `DATABASE_URL` no provedor de hospedagem e não versione credenciais.

### Variáveis obrigatórias
- `CORS_ORIGIN=https://guientregas.github.io`
- `DATABASE_URL=<PostgreSQL privado do provedor>`
- `JT_API_KEY=<chave aleatória longa>`
- Credenciais da Meta WhatsApp: `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET`.

### Validação
1. Abra `/health` e confirme `ok:true` e `database:"postgres"`.
2. Teste sincronização pelo app.
3. Teste `/api/route/matrix` com poucos pontos.
4. Configure o webhook Meta em `/webhook/whatsapp`.
5. Só depois preencha `v23/config.js` com a URL HTTPS definitiva da API.

O frontend continua no GitHub Pages; o backend é separado. Não coloque tokens ou URLs de segredo no repositório.
