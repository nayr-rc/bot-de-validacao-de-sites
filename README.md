# Bot de Monitoramento de Sites

Bot em Node.js/TypeScript que monitora a disponibilidade de sites e envia notificações no Telegram quando um site fica offline ou volta ao ar.

Criado originalmente para monitorar o site da [UFRB](https://ufrb.edu.br), mas pode ser adaptado para qualquer site.

## Funcionalidades

- Verifica a cada **N minutos** se um site está acessível (configurável)
- Tenta múltiplos URLs (fallback caso um falhe)
- Timeout configurável por requisição
- Mede **tempo de resposta** de cada checagem
- Valida **conteúdo da página** (opcional)
- Notifica no Telegram **tanto na queda quanto na subida**
- **Retry automático** ao enviar notificações
- Persiste histórico em **SQLite** (`data.db`)
- Estatísticas diárias de **uptime** enviadas automaticamente
- Detecta quando o computador volta da suspensão (SIGCONT) e verifica imediatamente
- Graceful shutdown (SIGINT/SIGTERM)
- Roda como serviço do macOS (LaunchAgent)

## Estrutura

```
ufrb-watch/
├── src/
│   ├── index.ts        # Entry point
│   ├── config.ts       # Config loading (JSON)
│   ├── checker.ts      # Site checking logic
│   ├── notifier.ts     # Telegram notifications
│   ├── storage.ts      # SQLite storage
│   ├── state.ts        # Runtime state (wasDown)
│   └── types.ts        # TypeScript types
├── config.example.json # Exemplo de configuração
├── package.json
├── tsconfig.json
└── README.md
```

Arquivos gerados em runtime (gitignored):
- `config.json` — configuração real (token, chatId, sites)
- `state.json` — estado atual (down/up)
- `data.db` — histórico de checagens (SQLite)
- `watch.log` — log de notificações

## Como configurar

### 1. Token do Telegram

Crie um bot no [@BotFather](https://t.me/BotFather) do Telegram e obtenha o token.

### 2. Arquivo de configuração

Copie o exemplo e preencha:

```bash
cp config.example.json config.json
```

Edite `config.json`:

```json
{
  "telegram": {
    "token": "SEU_TOKEN_AQUI",
    "chatId": "SEU_CHAT_ID"
  },
  "sites": [
    { "url": "https://ufrb.edu.br", "name": "UFRB" },
    { "url": "https://www.ufrb.edu.br", "name": "UFRB WWW", "expectedContent": "UFRB" }
  ],
  "interval": 300000,
  "timeout": 10000
}
```

> **Compatibilidade:** Se você já tinha um `token.json` (formato antigo), o bot migra automaticamente para `config.json` na primeira execução.

Para descobrir seu `chatId`, envie uma mensagem para o bot e acesse:

```
https://api.telegram.org/botSEU_TOKEN/getUpdates
```

### 3. Rodar em desenvolvimento

```bash
npm run dev
```

### 4. Compilar e rodar em produção

```bash
npm run build
npm start
```

### 5. Rodar como serviço (LaunchAgent no macOS)

Já existe um plist em `~/Library/LaunchAgents/br.edu.ufrb.watch.plist`. Para ativar:

```bash
launchctl load ~/Library/LaunchAgents/br.edu.ufrb.watch.plist
```

## Parâmetros de configuração

| Campo | Descrição | Default |
|---|---|---|
| `telegram.token` | Token do bot Telegram | — |
| `telegram.chatId` | Chat ID para receber notificações | — |
| `sites[].url` | URL do site a monitorar | — |
| `sites[].name` | Nome amigável do site | — |
| `sites[].expectedContent` | (opcional) Texto que deve existir no HTML | — |
| `interval` | Intervalo entre checagens (ms) | 300000 (5 min) |
| `timeout` | Timeout por requisição (ms) | 10000 (10s) |

## Como adaptar para outros sites

Edite o array `sites` no `config.json`. O bot checa todos em paralelo a cada intervalo.

## Logs

- `watch.log` — registra notificações enviadas
- `data.db` — banco SQLite com todo o histórico de checagens
- `~/Library/Logs/ufrb-watch.log` — log completo do serviço (stdout/stderr)

## Requisitos

- Node.js 18+ (fetch nativo, sql.js compatível)
- macOS (para o serviço LaunchAgent)

## Pipeline de qualidade

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```
