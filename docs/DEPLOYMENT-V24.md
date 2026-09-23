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
