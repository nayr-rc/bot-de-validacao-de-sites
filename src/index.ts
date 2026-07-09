import { appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { checkAllSites } from './checker.js';
import {
  sendTelegram,
  buildUpMessage,
  buildDownMessage,
  buildUptimeMessage,
} from './notifier.js';
import {
  initStorage,
  insertCheck,
  insertAlert,
  getUptimeStats,
  closeDb,
} from './storage.js';
import { loadState, saveState } from './state.js';
import type { CheckResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = loadConfig();
const state = loadState();
let firstRun = true;

let lastStatsSentDay: number | null = null;

const LOG_PATH = join(__dirname, '..', 'watch.log');

function logToFile(text: string): void {
  const line = `[${new Date().toISOString()}] ${text}\n`;
  console.log(line.trim());
  appendFileSync(LOG_PATH, line);
}

async function handleResults(results: CheckResult[]): Promise<void> {
  const anyUp = results.some((r) => r.status === 'up');
  const allDown = results.every((r) => r.status === 'down');

  results.forEach((r) => insertCheck(r));

  if (anyUp && state.wasDown && !firstRun) {
    const msg = buildUpMessage(results);
    const alert = await sendTelegram(config, msg);
    insertAlert(alert);
    logToFile(`NOTIFICADO — site voltou ao ar`);
  } else if (allDown && !state.wasDown && !firstRun) {
    const msg = buildDownMessage(results);
    const alert = await sendTelegram(config, msg);
    insertAlert(alert);
    logToFile(`NOTIFICADO — site ficou fora do ar`);
  }

  state.wasDown = !anyUp;
  state.lastCheckedAt = new Date().toISOString();
  saveState(state);
  firstRun = false;
}

async function sendDailyStats(): Promise<void> {
  const today = new Date().getDate();
  if (lastStatsSentDay === today) return;

  const stats = getUptimeStats(24);
  if (stats.totalChecks === 0) return;

  const msg = buildUptimeMessage(
    stats.totalChecks > 0 ? (stats.upChecks / stats.totalChecks) * 100 : 0,
    stats.avgResponseTimeMs,
    'últimas 24h',
  );
  const alert = await sendTelegram(config, msg);
  insertAlert(alert);
  lastStatsSentDay = today;
  logToFile(`ESTATÍSTICAS DIÁRIAS — ${stats.upChecks}/${stats.totalChecks} UP`);
}

async function tick(): Promise<void> {
  try {
    const results = await checkAllSites(config.sites, config.timeout);
    await handleResults(results);
    await sendDailyStats();
  } catch (err) {
    console.error('[TICK] Erro inesperado:', err);
  }
}

function gracefulShutdown(signal: string): void {
  console.log(`\n[SINAL] ${signal} — encerrando...`);
  closeDb();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('SIGCONT', () => {
  logToFile('SIGCONT — acordou da suspensão, verificando agora');
  tick();
});

async function main(): Promise<void> {
  await initStorage();
  logToFile(`MONITOR INICIADO — ${config.sites.map((s) => s.name).join(', ')}`);
  logToFile(`Intervalo: ${config.interval / 60000}min | Timeout: ${config.timeout}ms`);

  await tick();
  setInterval(tick, config.interval);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  closeDb();
  process.exit(1);
});
