# Bot de Validação de Sites

Bot em Node.js que monitora a disponibilidade de sites e envia notificações no Telegram quando um site volta ao ar após ficar offline.

Criado originalmente para monitorar o site da [UFRB](https://ufrb.edu.br), mas pode ser adaptado para qualquer site.

## Funcionalidades

- Verifica a cada **5 minutos** se um site está acessível
- Tenta múltiplos URLs (fallback caso um falhe)
- Timeout de 10s por requisição
- Notifica no Telegram quando o site **volta ao ar**
- Persiste o estado em disco (`state.json`) — não envia notificação repetida se o site continuar offline
- Detecta quando o computador volta da suspensão (SIGCONT) e verifica imediatamente
- Roda como serviço do macOS (LaunchAgent)

## Estrutura

```
ufrb-watch/
├── index.js        # Script principal
├── token.json      # Token do bot Telegram e chat ID (IGNORADO pelo git)
├── state.json      # Estado atual: down/up (IGNORADO pelo git)
├── watch.log       # Log de notificações (IGNORADO pelo git)
├── .gitignore
└── README.md
```

## Como configurar

### 1. Token do Telegram

Crie um bot no [@BotFather](https://t.me/BotFather) do Telegram e obtenha o token. Depois crie o arquivo `token.json`:

```json
{
  "token": "SEU_TOKEN_AQUI",
  "chatId": "SEU_CHAT_ID"
}
```

Para descobrir seu `chatId`, envie uma mensagem para o bot e acesse:

```
https://api.telegram.org/botSEU_TOKEN/getUpdates
```

### 2. Rodar manualmente

```bash
node index.js
```

O bot vai verificar os sites imediatamente e a cada 5 minutos.

### 3. Rodar como serviço (LaunchAgent no macOS)

Já existe um plist em `~/Library/LaunchAgents/br.edu.ufrb.watch.plist` que faz o bot iniciar automaticamente no login e ficar rodando em background.

Para ativar:

```bash
launchctl load ~/Library/LaunchAgents/br.edu.ufrb.watch.plist
```

Para desativar:

```bash
launchctl unload ~/Library/LaunchAgents/br.edu.ufrb.watch.plist
```

## Como adaptar para outros sites

Edite o array `URLS` no `index.js`:

```js
const URLS = [
  'https://meusite.com.br',
  'https://www.meusite.com.br',
];
```

O intervalo de verificação também pode ser ajustado alterando `POLL_INTERVAL` (em milissegundos).

## Logs

- `watch.log` — registra notificações enviadas com data/hora
- `~/Library/Logs/ufrb-watch.log` — log completo do serviço (stdout/stderr)

## Requisitos

- Node.js 18+ (fetch nativo)
- macOS (para o serviço LaunchAgent)
