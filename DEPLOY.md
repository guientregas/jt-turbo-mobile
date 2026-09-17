# J&T Turbo V11 — Câmera + Endereço inteligente + Fachada + Mapa municipal

## Fluxo correto
- **Celular principal:** J&T Turbo. Use para cadastrar/guardar pedidos, pedir localização pelo WhatsApp, receber localização, montar/otimizar rota, navegar e marcar entregas.
- **Câmera:** fica dentro do próprio J&T Turbo, no celular principal, e é opcional. Ela pode ler nome, telefone e pistas de endereço por OCR; também pode fotografar a fachada da entrega.

## Publicação no GitHub Pages
Para GitHub Pages configurado para publicar a raiz do repositório, os arquivos `index.html`, `style.css`, `app.js`, `manifest.webmanifest`, `sw.js` e a pasta `assets/` DEVEM ficar na RAIZ do repositório. Não deixe a única cópia dentro de `public/`.

## WhatsApp
O botão `💬 WhatsApp` abre uma conversa normal com a mensagem pronta para o cliente enviar a localização.

A automação oficial opcional usa `server.js` + WhatsApp Cloud API. O token nunca deve ser colocado no `app.js` ou no GitHub Pages.

### Variáveis do servidor
- `WA_ACCESS_TOKEN`
- `WA_PHONE_NUMBER_ID`
- `WA_VERIFY_TOKEN`
- `WA_GRAPH_VERSION`
- `WA_APP_SECRET`

O servidor expõe:
- `GET /health`
- `GET /webhook/whatsapp`
- `POST /webhook/whatsapp`
- `POST /api/whatsapp/send-flow`
- `GET /api/whatsapp/events`
- `POST /api/whatsapp/session`

Quando o webhook recebe uma localização, ela é vinculada ao pedido pelo telefone normalizado. O Turbo consulta os eventos e atualiza o pedido.

## Importante sobre o WhatsApp
Sem Cloud API configurada, o botão manual continua funcionando. A automação depende de um servidor HTTPS e da configuração do WhatsApp/Meta, incluindo regras de janela de atendimento e templates quando aplicáveis.

## Instalação no celular
Abra a página do GitHub Pages no navegador e use `Adicionar à Tela de Início`/`Instalar app` quando o navegador oferecer a opção.

## Câmera do J&T Turbo
A câmera é um recurso opcional do próprio aplicativo no celular principal. Ela usa OCR no navegador para tentar ler nome e telefone de uma imagem/documento/tela que você apontar para a câmera. Sempre confira os campos antes de salvar, porque OCR pode cometer erros.

A câmera não acessa nem controla o aplicativo oficial da J&T e não existe transferência de dados entre celulares.

## Endereço inteligente e fachada
- O Turbo tenta localizar o endereço por mais de uma consulta, priorizando cidade e número quando disponíveis.
- Há botão para abrir o resultado no Google Maps.
- Com coordenadas, o botão `🏠 Fachada / Street View` abre o modo panorâmico do Google Maps quando houver cobertura.
- O botão `📷 Foto fachada` permite registrar uma foto própria da frente da casa/loja no pedido.
- Se o cliente não tiver WhatsApp, o endereço ainda pode ser localizado manualmente pela câmera, Google Maps ou pelo mapa municipal.
- O mapa municipal de Valparaíso de Goiás fornecido para este projeto fica em `public/assets/mapa-valparaiso-goias.png` e também em PDF. Ele é uma referência visual para ruas, quadras e setores; não é tratado como uma coordenada GPS automática.
- Quando houver placa de vizinho, a câmera pode ler o texto como pista, mas a confirmação final da casa deve ser feita pelo endereço/GPS/fachada.


## V12 — correção de atualização no iPhone
- O Service Worker agora usa uma URL versionada (`sw.js?v=20260917-v12`) para escapar de um `sw.js` antigo preso no cache.
- O `sw.js` não guarda o próprio arquivo em cache.
- O `index.html` usa rede primeiro, para que novas publicações do GitHub Pages apareçam.
- Caches antigos `jt-turbo-*` são removidos na ativação.
