import { appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { checkAllSites } from './checker.js';
import { parseCliArgs } from './cli.js';
import { runHealthcheck } from './healthcheck.js';
import { createLogger } from './logger.js';
import { startDashboard } from './dashboard.js';
import {
  sendTelegram,
  buildUpMessage,
  buildDownMessage,
  buildUptimeMessage,
  shouldSendAlert,
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
const cliOptions = parseCliArgs();
const logger = createLogger('MONITOR');
let firstRun = true;

let lastStatsSentDay: number | null = null;

const LOG_PATH = join(__dirname, '..', 'watch.log');

function logToFile(text: string): void {
  const line = `[${new Date().toISOString()}] ${text}\n`;
  logger.info(text);
  appendFileSync(LOG_PATH, line);
}

async function handleResults(results: CheckResult[]): Promise<void> {
  const anyUp = results.some((r) => r.status === 'up');
  const allDown = results.every((r) => r.status === 'down');
  const anyOperational = results.some(
    (r) => r.status === 'up' || r.status === 'degraded',
  );

  results.forEach((r) => insertCheck(r));

  if (!firstRun && shouldSendAlert(state, results, config.sites)) {
    if (anyUp && state.wasDown) {
      const msg = buildUpMessage(results);
      const alert = await sendTelegram(config, msg);
      insertAlert(alert);
      logToFile(`NOTIFICADO — site voltou ao ar`);
    } else if (allDown && !state.wasDown) {
      const msg = buildDownMessage(results);
      const alert = await sendTelegram(config, msg);
      insertAlert(alert);
      logToFile(`NOTIFICADO — site ficou fora do ar`);
    }
  }

  state.wasDown = !anyOperational;
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
    logger.error('Erro inesperado no tick', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function printStartupSummary(): void {
  logger.info('Configuração carregada', {
    sites: config.sites.length,
    intervalMinutes: config.interval / 60000,
    timeoutMs: config.timeout,
  });
}

function gracefulShutdown(signal: string): void {
  logger.warn(`Sinal recebido: ${signal}`);
  try {
    closeDb();
  } catch (error) {
    logger.error('Falha ao fechar o banco', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
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
  startDashboard();
  printStartupSummary();
  logToFile(`MONITOR INICIADO — ${config.sites.map((s) => s.name).join(', ')}`);
  logToFile(`Intervalo: ${config.interval / 60000}min | Timeout: ${config.timeout}ms`);

  if (cliOptions.healthcheck) {
    const report = await runHealthcheck(config);
    logger.info('Healthcheck', {
      summary: report.summary,
      sitesDown: report.sitesDown,
      sitesUp: report.sitesUp,
    });
    report.results.forEach((result) => {
      logger.info('Healthcheck site', {
        status: result.status,
        url: result.url,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
      });
    });
    closeDb();
    process.exit(0);
  }

  await tick();
  if (cliOptions.once) {
    logger.info('Execução única concluída');
    closeDb();
    process.exit(0);
  }

  setInterval(tick, config.interval);
}

main().catch((err) => {
  logger.error('Falha fatal na inicialização', {
    error: err instanceof Error ? err.message : String(err),
  });
  closeDb();
  process.exit(1);
});
