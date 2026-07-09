# Comandos para Testes e Build

## Testes

```bash
# Executar testes uma vez
npm test

# Executar testes em modo watch
npm run test:watch
```

## TypeScript

```bash
# Verificar tipos sem emitir arquivos
npm run typecheck

# Compilar TypeScript para JavaScript (saída em dist/)
npm run build
```

## Lint e Formatação

```bash
# Verificar lint
npm run lint

# Corrigir lint automaticamente
npm run lint:fix

# Verificar formatação
npm run format:check

# Formatar código
npm run format
```

## Desenvolvimento

```bash
# Rodar com hot-reload (usando tsx)
npm run dev

# Rodar versão compilada
npm run start
```

## Pipeline recomendado antes de commit

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```
