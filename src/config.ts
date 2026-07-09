import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig, SiteConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, '..', 'config.json');
const OLD_TOKEN_PATH = join(__dirname, '..', 'token.json');

const DEFAULTS = {
  interval: 5 * 60 * 1000,
  timeout: 10000,
  sites: [
    { url: 'https://ufrb.edu.br', name: 'UFRB' },
    { url: 'https://www.ufrb.edu.br', name: 'UFRB WWW' },
  ] as SiteConfig[],
};

function migrateFromTokenFile(): AppConfig {
  const { token, chatId } = JSON.parse(readFileSync(OLD_TOKEN_PATH, 'utf-8'));
  const config: AppConfig = {
    telegram: { token, chatId },
    sites: DEFAULTS.sites,
    interval: DEFAULTS.interval,
    timeout: DEFAULTS.timeout,
  };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`[CONFIG] Migrado token.json → config.json`);
  return config;
}

export function loadConfig(): AppConfig {
  if (existsSync(CONFIG_PATH)) {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw) as AppConfig;

    if (!config.telegram?.token || !config.telegram?.chatId) {
      throw new Error('config.json: telegram.token e telegram.chatId são obrigatórios');
    }
    if (!config.sites?.length) {
      throw new Error('config.json: sites é obrigatório');
    }

    return {
      ...DEFAULTS,
      ...config,
    };
  }

  if (existsSync(OLD_TOKEN_PATH)) {
    return migrateFromTokenFile();
  }

  throw new Error(
    'Nenhum arquivo de configuração encontrado. Crie config.json ou token.json',
  );
}

export function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
