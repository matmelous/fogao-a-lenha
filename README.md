# Minas

Aplicacao React + Vite para cardapio e administracao, com sincronizacao via API serverless na Vercel.
Agora preparada para operacao white-label com varios clientes, cada um com dominio e base de dados proprios.

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
- `MERCADO_PAGO_ACCESS_TOKEN`: access token usado pelo backend para processar pagamentos no cartao.
- `ALLOWED_ORIGIN`: origem permitida por CORS na API.

### Variaveis por tenant

Se quiser configurar credenciais ou WhatsApp diferentes por cliente, use o padrao:

- `ADMIN_API_TOKEN__TENANT_ID`
- `NOTIFY_API_TOKEN__TENANT_ID`
- `WA360_API_KEY__TENANT_ID`
- `WA360_TO_NUMBER__TENANT_ID`
- `WA360_API_URL__TENANT_ID`
- `MERCADO_PAGO_ACCESS_TOKEN__TENANT_ID`
- `ALLOWED_ORIGIN__TENANT_ID`

Exemplo para o tenant `fogao-a-lenha`:

- `ADMIN_API_TOKEN__FOGAO_A_LENHA`
- `ALLOWED_ORIGIN__FOGAO_A_LENHA`

### Producao na Vercel

- `VITE_ADMIN_API_TOKEN` e `ADMIN_API_TOKEN` precisam ter exatamente o mesmo valor.
- `VITE_NOTIFY_API_TOKEN` e `NOTIFY_API_TOKEN` precisam ter exatamente o mesmo valor.
- Para cartao funcionar, o tenant precisa ter `mercadoPagoPublicKey` salvo no admin e `MERCADO_PAGO_ACCESS_TOKEN` configurado na Vercel.
- Para PIX funcionar, a `pixKey` precisa estar salva no admin.
- `ALLOWED_ORIGIN` em producao deve apontar para o dominio publicado.
  Exemplo: `https://saborcaseiro.vercel.app`
- Evite colar valores com aspas, espacos extras ou quebra de linha no final.
- Sempre que alterar variaveis de ambiente na Vercel, faca um novo deploy para aplicar.

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

## White-label / multicliente

### Como funciona

- O frontend identifica o cliente pelo dominio atual ou pelo override `?tenant=...` em ambiente local.
- A API separa os dados por tenant em arquivos independentes.
- O `localStorage` tambem e separado por tenant, evitando mistura entre clientes no mesmo navegador.
- As notificacoes e tokens podem ser globais ou especificos por tenant.

### Onde cadastrar novos clientes

Edite [lib/tenancy.ts](/C:/Dev/minas/lib/tenancy.ts:1) e adicione uma nova entrada em `tenantConfigs`:

```ts
{
  id: 'cliente-centro',
  name: 'Cliente Centro',
  domains: ['www.clientecentro.com.br', 'clientecentro.com.br'],
}
```

Tenants-modelo ja incluidos:

- `cliente-centro`
- `pizzaria-modelo`
- `burger-do-bairro`

Veja tambem:

- [docs/OPERACAO_WHITE_LABEL.md](/C:/Dev/minas/docs/OPERACAO_WHITE_LABEL.md:1)
- [docs/CLIENTE_TEMPLATE.md](/C:/Dev/minas/docs/CLIENTE_TEMPLATE.md:1)
- [docs/PACOTE_COMERCIAL.md](/C:/Dev/minas/docs/PACOTE_COMERCIAL.md:1)
- [docs/PLANOS_E_ENTREGAVEIS.md](/C:/Dev/minas/docs/PLANOS_E_ENTREGAVEIS.md:1)
- [docs/ROTEIRO_IMPLANTACAO.md](/C:/Dev/minas/docs/ROTEIRO_IMPLANTACAO.md:1)
- [docs/PROPOSTA_COMERCIAL_MODELO.md](/C:/Dev/minas/docs/PROPOSTA_COMERCIAL_MODELO.md:1)
- [docs/CONTRATO_BASE.md](/C:/Dev/minas/docs/CONTRATO_BASE.md:1)

Landing page comercial pronta para ajustar e publicar:

- [public/revenda-white-label.html](/C:/Dev/minas/public/revenda-white-label.html:1)

### Publicacao com dominio proprio

Para cada cliente, voce pode apontar um dominio proprio para o mesmo projeto publicado na Vercel:

1. Adicione o dominio no projeto da Vercel.
2. Aponte o DNS do cliente para a Vercel.
3. Cadastre esse dominio em `tenantConfigs`.
4. Configure `ALLOWED_ORIGIN__TENANT_ID` com o dominio HTTPS do cliente.
5. Se quiser, configure tokens e WhatsApp especificos para esse tenant.

### Desenvolvimento local

- Tenant padrao: `fogao-a-lenha`
- Override local: `http://localhost:5173/?tenant=cliente-centro`
- Assim voce consegue testar varios clientes sem precisar de varios deploys.

## Checklist de sincronizacao

1. Abra o site publicado.
2. Entre no painel administrativo.
3. Faca uma alteracao pequena.
4. Clique em sincronizar.
5. Confira o endpoint `/api/data`.

Se a sincronizacao estiver correta, o retorno deve conter:

- `success: true`
- `lastUpdated` preenchido
- `categories`, `items` e `settings` com dados

## Diagnostico rapido

- `401 Unauthorized`
  Tokens do frontend e backend nao batem, ou ha espaco/quebra de linha no valor da variavel.
- `FUNCTION_INVOCATION_FAILED`
  A Function da Vercel falhou antes de responder. Verifique os logs da Function.
- `Unexpected token ... is not valid JSON`
  O frontend tentou ler JSON, mas a API devolveu HTML ou texto de erro.
- Cliente carregando dados do tenant errado
  Confira o dominio cadastrado em `tenantConfigs` e, em ambiente local, use `?tenant=...`.
