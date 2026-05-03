# Laboratorio de Pagamentos

Este ambiente existe para testar novas experiencias de checkout sem afetar o site principal.

## Tenant de homologacao

- `id`: `saborcaseiro-lab`
- dominios sugeridos:
  - `teste.saborcaseiro.vercel.app`
  - `lab.saborcaseiro.vercel.app`
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

Essas opcoes ainda sao de homologacao de experiencia. Elas ajudam a desenhar o fluxo final e a tomada de decisao tecnica.
