# Laboratorio de Pagamentos

Este ambiente existe para testar novas experiencias de checkout sem afetar o site principal.

## Tenant de homologacao

- `id`: `saborcaseiro-lab`
- dominios sugeridos:
  - `saborcaseiro-lab.vercel.app`
  - `teste-saborcaseiro.vercel.app`
- override local:
  - `http://localhost:5173/?tenant=saborcaseiro-lab`

## Objetivo

Usar uma copia isolada do site para validar:

- Apple Pay na web
- Google Pay na web
- fluxo de aproximacao mediado por app proprio ou parceiro
- comportamento mobile do checkout
- impacto visual e operacional antes de publicar no tenant principal

## Como usar

1. Abra o tenant `saborcaseiro-lab`.
2. Ative no admin apenas os meios de pagamento em teste.
3. Mantenha o tenant principal com os meios oficiais.
4. Registre o que funcionou e o que precisa de app nativo.

## Status atual

O laboratorio ja mostra no checkout:

- `Apple Pay (Teste)`
- `Google Pay (Teste)`
- `Aproximação no Celular (Teste)`

## Integracao atual

- `Apple Pay (Teste)` e `Google Pay (Teste)` usam Stripe Checkout.
- `Aproximação no Celular (Teste)` continua como trilha de estudo para app proprio ou parceiro com suporte nativo.

## Configuracoes necessarias

No admin do tenant `saborcaseiro-lab`:

- preencher `Stripe Token` com a secret key de teste, se preferir guardar pelo painel
- ou configurar `STRIPE_SECRET_KEY__SABORCASEIRO_LAB` na Vercel

Observacoes:

- Apple Pay e Google Pay dependem de compatibilidade do aparelho, navegador e conta.
- O Stripe pode exibir carteira digital ou fallback para cartao, dependendo do dispositivo.
