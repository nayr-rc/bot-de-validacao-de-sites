import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAllSites } from './checker.js';
import type { AppConfig, CheckResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data.db');
const CONFIG_PATH = join(__dirname, '..', 'config.json');

export interface HealthcheckReport {
  ok: boolean;
  configFileExists: boolean;
  dbFileExists: boolean;
  sitesChecked: number;
  sitesUp: number;
  sitesDown: number;
  results: CheckResult[];
  summary: string;
}

export async function runHealthcheck(config: AppConfig): Promise<HealthcheckReport> {
  const results = await checkAllSites(config.sites, config.timeout);
  const sitesUp = results.filter((result) => result.status === 'up').length;
  const sitesDown = results.filter((result) => result.status === 'down').length;
  const ok = sitesDown === 0;

  const summary = [
    `Config: ${existsSync(CONFIG_PATH) ? 'ok' : 'missing'}`,
    `DB: ${existsSync(DB_PATH) ? 'ok' : 'missing'}`,
    `Sites: ${sitesUp}/${results.length} up`,
  ].join(' | ');

  return {
    ok,
    configFileExists: existsSync(CONFIG_PATH),
    dbFileExists: existsSync(DB_PATH),
    sitesChecked: results.length,
    sitesUp,
    sitesDown,
    results,
    summary,
  };
}
