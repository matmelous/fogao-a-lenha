# Operacao White-Label

## Fluxo para ativar um novo cliente

1. Defina um `tenantId` simples.
   Exemplo: `cliente-centro`
2. Adicione o tenant em [lib/tenancy.ts](/C:/Dev/minas/lib/tenancy.ts:1).
3. Cadastre o dominio na Vercel.
4. Configure as variaveis de ambiente especificas do tenant.
5. Publique um novo deploy.
6. Abra o site com o dominio final.
7. Entre no admin e personalize nome, logo, endereco, horario, cardapio e pagamentos.
8. Sincronize com a nuvem.
9. Faca um pedido real de teste.

## Padrao de tenant ID

- Use apenas letras minusculas, numeros e `-`
- Evite acentos e espacos
- Mantenha curto e estavel

Exemplos validos:

- `pizzaria-centro`
- `burger-do-ze`
- `fogao-a-lenha`

## Modelo para `lib/tenancy.ts`

```ts
{
  id: 'cliente-centro',
  name: 'Cliente Centro',
  domains: [
    'clientecentro.com.br',
    'www.clientecentro.com.br',
  ],
}
```

## Variaveis por tenant na Vercel

Para o tenant `cliente-centro`, cadastre:

```env
ADMIN_API_TOKEN__CLIENTE_CENTRO=...
NOTIFY_API_TOKEN__CLIENTE_CENTRO=...
WA360_API_KEY__CLIENTE_CENTRO=...
WA360_TO_NUMBER__CLIENTE_CENTRO=55DDDNUMERO
WA360_API_URL__CLIENTE_CENTRO=https://waba-v2.360dialog.io/messages
ALLOWED_ORIGIN__CLIENTE_CENTRO=https://www.clientecentro.com.br
```

## Como testar localmente

Rode:

```bash
npm run dev
```

Depois abra:

```text
http://localhost:5173/?tenant=cliente-centro
```

## Checklist tecnico antes de entregar

- `npm run lint`
- `npm run test:run`
- `npm run build`
- teste de acesso ao admin
- teste de sincronizacao
- teste de pedido
- teste de notificacao

## Modelo de entrega para o cliente

- Dominio publicado e ativo
- Cardapio configurado
- WhatsApp configurado
- Painel administrativo liberado
- Treinamento rapido do painel
- Backup inicial exportado
