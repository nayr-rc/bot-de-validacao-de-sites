import type { CheckResult, AppConfig, AlertData } from './types.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Bahia',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(iso));
}

export function buildUpMessage(results: CheckResult[]): string {
  const time = formatTime(results[0].checkedAt);
  const details = results
    .map(
      (r) =>
        `${r.status === 'up' ? '✅' : '❌'} ${r.url} — ${r.statusCode ?? 'erro'} (${r.responseTimeMs ?? '?'}ms)`,
    )
    .join('\n');

  return `🟢 *UFRB voltou ao ar!*\n\nO site da UFRB está acessível novamente.\n⏱ ${time}\n\n${details}`;
}

export function buildDownMessage(results: CheckResult[]): string {
  const time = formatTime(results[0].checkedAt);
  const details = results
    .map(
      (r) =>
        `${r.status === 'up' ? '✅' : '❌'} ${r.url} — ${r.statusCode ? `HTTP ${r.statusCode}` : r.error} (${r.responseTimeMs ?? '?'}ms)`,
    )
    .join('\n');

  return `🔴 *UFRB fora do ar!*\n\nO site da UFRB não está acessível.\n⏱ ${time}\n\n${details}`;
}

export function buildUptimeMessage(
  uptimePercent: number,
  avgResponseTime: number | null,
  period: string,
): string {
  const bar = makeProgressBar(uptimePercent);
  return (
    `📊 *Status UFRB — ${period}*\n\n` +
    `${bar} ${uptimePercent.toFixed(2)}%\n\n` +
    `⏱ Tempo médio de resposta: ${avgResponseTime != null ? `${avgResponseTime}ms` : 'N/A'}`
  );
}

function makeProgressBar(percent: number, size = 10): string {
  const filled = Math.round((percent / 100) * size);
  const empty = size - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export async function sendTelegram(config: AppConfig, text: string): Promise<AlertData> {
  const url = `https://api.telegram.org/bot${config.telegram.token}/sendMessage`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegram.chatId,
          text,
          parse_mode: 'Markdown',
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Telegram API: HTTP ${res.status} — ${body}`);
      }

      const sentAt = new Date().toISOString();
      return { type: text.includes('fora do ar') ? 'down' : 'up', message: text, sentAt };
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[NOTIFIER] Falha após ${MAX_RETRIES} tentativas: ${message}`);
        return { type: 'down', message: text, sentAt: new Date().toISOString() };
      }
      console.warn(`[NOTIFIER] Tentativa ${attempt}/${MAX_RETRIES} falhou. Reenvando...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
    }
  }

  throw new Error('Unreachable');
}
