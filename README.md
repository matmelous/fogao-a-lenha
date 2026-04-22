# Minas

Aplicacao React + Vite para cardapio e administracao, com sincronizacao via API serverless na Vercel.

## Requisitos

- Node.js 20+
- npm

## Configuracao de ambiente

Copie `.env.example` para `.env` e preencha:

- `VITE_ADMIN_PASSWORD`: senha usada no login admin do frontend.
- `VITE_ADMIN_API_TOKEN`: token enviado no header `x-admin-token` para operacoes `POST` da API.
- `VITE_NOTIFY_API_TOKEN`: token enviado pelo frontend para autenticar notificacoes de pedidos.
- `ADMIN_API_TOKEN`: token validado no backend (deve ser igual ao token do frontend admin).
- `NOTIFY_API_TOKEN`: token validado no endpoint `/api/notify-order` (igual ao token do frontend de notificacao).
- `WA360_API_KEY`: chave da API 360dialog.
- `WA360_TO_NUMBER`: WhatsApp (com codigo do pais) que recebera alertas de novos pedidos.
- `WA360_API_URL`: URL da API da 360dialog (padrao `https://waba-v2.360dialog.io/messages`).
- `ALLOWED_ORIGIN`: origem permitida por CORS na API.

## Scripts

- `npm run dev`: desenvolvimento local.
- `npm run lint`: analise estativa.
- `npm run test:run`: execucao unica dos testes.
- `npm run build`: build de producao.
- `npm run preview`: preview da build.

## Pipeline CI

Existe workflow em `.github/workflows/ci.yml` com:

1. `npm ci`
2. `npm run lint`
3. `npm run test:run`
4. `npm run build`
