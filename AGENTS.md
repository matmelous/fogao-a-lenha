# AGENTS - Granatto / Fogão a Lenha

Este repositório é um projeto React + Vite para cardápio, carrinho, pedidos, pagamentos e operação simples de uma loja/restaurante.

Ele faz parte do workspace `/Users/matheus/development/granattos` e deve seguir também as regras da raiz:

- `/Users/matheus/development/granattos/AGENTS.md`
- `/Users/matheus/development/granattos/docs/regras-ia.md`

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- Vercel serverless functions em `api/`
- Capacitor Android em `android/`

## Escopo do Produto

Manter o produto focado em:

- cardápio;
- carrinho;
- pedido;
- pagamento;
- contato;
- operação simples.

Não adicionar CRM, automação avançada, painel administrativo complexo, área de cliente ou integrações privadas sem pedido explícito.

## Segurança

- Não commitar `.env` real, tokens, senhas, chaves, credenciais ou keystore.
- Não usar `VITE_*` para segredo. Qualquer valor `VITE_*` fica disponível no bundle público.
- Segredos de backend devem ficar apenas em ambiente de runtime ou plataforma de deploy.
- Nunca salvar dados reais de clientes em fixtures, mocks, screenshots versionadas, documentação ou placeholders.
- Exemplos persistidos devem usar dados neutros, como `Empresa Exemplo Alpha`, `example-alpha` e `empresa-alpha.example`.

## Texto de UI

- Usar português do Brasil com acentos em todo texto visível ao usuário.
- Corrigir qualquer mojibake antes do handoff, por exemplo `Ã£`, `Ã©`, `Ãº`.
- UI deve ter tom final, profissional e próprio para produção.
- Não mencionar implementação, debug, Figma, protótipo, workaround, ajuste técnico ou bastidores em texto de produto.
- Não usar piadas, ironias ou gírias internas em UI, e-mails, notificações, PDFs ou mensagens automatizadas.

## Preservação de Funcionalidade

- Preservar funcionalidade por padrão.
- Se a correção parecer remover capacidade do produto, diagnosticar antes e avisar.
- Remoções são permitidas quando o usuário pedir explicitamente, como remover banner, seção ou fluxo visual.

## Comandos

Instalação:

```bash
npm ci
```

Desenvolvimento:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

Build:

```bash
npm run build
```

Testes:

```bash
npm run test:run
```

Lint:

```bash
npm run lint
```

## Validação

- Para mudanças de UI/copy/local layout, rodar `npm run build`.
- Para mudanças em pedidos, carrinho, pagamento, API, armazenamento ou sincronização, rodar `npm run build` e `npm run test:run`.
- Para mudanças em Android/Capacitor, validar também o fluxo de build/sync relevante antes de handoff.
- Se algum comando for pulado, informar motivo e risco residual.

## Arquivos e Pastas

- `src/`: frontend React.
- `api/`: funções serverless.
- `lib/`: utilitários compartilhados.
- `public/`: assets públicos.
- `android/`: projeto Android gerado pelo Capacitor.
- `docs/`: documentação do projeto.
- `tests/`: testes automatizados.

## Handoff

Ao concluir alterações, informar:

- resumo do que mudou;
- arquivos principais;
- comandos executados;
- resultado da validação;
- riscos ou pendências.
