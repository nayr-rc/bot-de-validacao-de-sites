import { createLogger } from './logger.js';
import type { CheckResult, AppConfig, AlertData } from './types.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const logger = createLogger('NOTIFIER');

function buildDetails(results: CheckResult[]): string {
  return results
    .map((r) => {
      const statusText = r.status === 'up' ? '✅' : '❌';
      const statusCode = r.statusCode != null ? `HTTP ${r.statusCode}` : 'erro';
      const response = r.responseTimeMs != null ? `${r.responseTimeMs}ms` : '?ms';
      const error = r.error ? ` — ${r.error}` : '';
      return `${statusText} ${r.url} — ${statusCode} (${response})${error}`;
    })
    .join('\n');
}

export function shouldSendAlert(
  previousState: { wasDown: boolean },
  results: CheckResult[],
): boolean {
  const anyUp = results.some((r) => r.status === 'up');
  const allDown = results.every((r) => r.status === 'down');

  if (previousState.wasDown && anyUp) return true;
  if (!previousState.wasDown && allDown) return true;
  return false;
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Bahia',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(iso));
}

export function buildUpMessage(results: CheckResult[]): string {
  const time = formatTime(results[0].checkedAt);
  const details = buildDetails(results);

  return `🟢 *UFRB voltou ao ar!*\n\nO site da UFRB está acessível novamente.\n⏱ ${time}\n\n${details}`;
}

export function buildDownMessage(results: CheckResult[]): string {
  const time = formatTime(results[0].checkedAt);
  const details = buildDetails(results);

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
        logger.error(`Falha após ${MAX_RETRIES} tentativas`, { error: message });
        return { type: 'down', message: text, sentAt: new Date().toISOString() };
      }
      logger.warn(`Tentativa ${attempt}/${MAX_RETRIES} falhou. Reenvando...`, {
        attempt,
        maxRetries: MAX_RETRIES,
      });
      await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
    }
  }

  throw new Error('Unreachable');
}
