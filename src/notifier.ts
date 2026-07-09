import { createLogger } from './logger.js';
import type { CheckResult, AppConfig, AlertData, NotificationConfig } from './types.js';

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
  sites: Array<{ maintenance?: boolean }> = [],
): boolean {
  const relevantResults = results.filter((_, index) => !sites[index]?.maintenance);
  if (relevantResults.length === 0) return false;

  const anyUp = relevantResults.some((r) => r.status === 'up');
  const allDown = relevantResults.every((r) => r.status === 'down');

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

async function sendWithRetry(
  url: string,
  payload: unknown,
  headers: Record<string, string>,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status} — ${body}`);
      }
      return;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY * attempt));
    }
  }
}

async function sendTelegramNotification(config: AppConfig, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${config.telegram.token}/sendMessage`;
  await sendWithRetry(
    url,
    {
      chat_id: config.telegram.chatId,
      text,
      parse_mode: 'Markdown',
    },
    { 'Content-Type': 'application/json' },
  );
}

async function sendWebhookNotification(
  notification: NotificationConfig,
  text: string,
): Promise<void> {
  if (!notification.webhookUrl) return;
  await sendWithRetry(
    notification.webhookUrl,
    { text },
    { 'Content-Type': 'application/json' },
  );
}

async function sendDiscordNotification(
  notification: NotificationConfig,
  text: string,
): Promise<void> {
  if (!notification.discordWebhookUrl) return;
  await sendWithRetry(
    notification.discordWebhookUrl,
    { content: text },
    { 'Content-Type': 'application/json' },
  );
}

export async function sendNotifications(
  config: AppConfig,
  text: string,
): Promise<AlertData[]> {
  const results: AlertData[] = [];
  const notifications = config.notifications ?? [{ type: 'telegram' }];

  for (const notification of notifications) {
    try {
      if (notification.type === 'telegram') {
        await sendTelegramNotification(config, text);
      } else if (notification.type === 'webhook') {
        await sendWebhookNotification(notification, text);
      } else if (notification.type === 'discord') {
        await sendDiscordNotification(notification, text);
      }

      results.push({
        type: text.includes('fora do ar') ? 'down' : 'up',
        message: text,
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Falha ao enviar notificação', {
        notificationType: notification.type,
        error: message,
      });
    }
  }

  return results;
}

export async function sendTelegram(config: AppConfig, text: string): Promise<AlertData> {
  const result = await sendNotifications(config, text);
  return (
    result[0] ?? {
      type: text.includes('fora do ar') ? 'down' : 'up',
      message: text,
      sentAt: new Date().toISOString(),
    }
  );
}
