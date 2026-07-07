const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');
const TOKEN_FILE = path.join(__dirname, 'token.json');
const POLL_INTERVAL = 5 * 60 * 1000;
const TIMEOUT = 10000;
const URLS = [
  'https://ufrb.edu.br',
  'https://www.ufrb.edu.br',
];

const { token, chatId } = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));

let firstRun = false;
let state = { down: true };
try {
  state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
} catch {
  firstRun = true;
}

let wasDown = state.down ?? true;

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
}

async function checkSite() {
  for (const url of URLS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

async function tick() {
  const isUp = await checkSite();
  const now = new Date();

  state.down = !isUp;
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));

  if (isUp && wasDown && !firstRun) {
    const time = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Bahia',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(now);

    await sendTelegram(
      `🟢 *UFRB voltou ao ar!*\n\nO site da UFRB está acessível novamente.\n⏱ ${time}`
    );

    const log = `[${time}] NOTIFICADO — site voltou\n`;
    console.log(log);
    fs.appendFileSync(path.join(__dirname, 'watch.log'), log);
  } else {
    const status = isUp ? 'UP' : 'DOWN';
    console.log(`[${now.toISOString()}] ${status} (wasDown=${wasDown})`);
  }

  wasDown = !isUp;
  firstRun = false;
}

process.on('SIGCONT', () => {
  console.log('[SIGCONT] Wake from sleep — checking now');
  tick();
});

tick();
setInterval(tick, POLL_INTERVAL);

console.log(`[INICIADO] Monitorando UFRB a cada ${POLL_INTERVAL / 60000} min`);
console.log(`State file: ${STATE_FILE}`);
