# Minas

Aplicacao React + Vite para cardapio e administracao, com sincronizacao via API serverless na Vercel.

## Requisitos

- Node.js 20+
- npm

## Configuracao de ambiente

Copie `.env.example` para `.env` e preencha:

- `VITE_ADMIN_PASSWORD`: senha usada no login admin do frontend.
- `VITE_ADMIN_API_TOKEN`: token enviado no header `x-admin-token` para operacoes `POST` da API.
- `ADMIN_API_TOKEN`: token validado no backend (deve ser igual ao token do frontend admin).
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
