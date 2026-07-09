import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig, SiteConfig } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ENV_PATH = join(__dirname, '..', '.env');

function parseEnvSites(raw: string): SiteConfig[] {
  const parsed = JSON.parse(raw) as Array<Partial<SiteConfig>>;
  return parsed.map((site) => ({
    url: site.url as string,
    urls: site.urls,
    name: site.name as string,
    expectedContent: site.expectedContent,
    interval: site.interval,
    timeout: site.timeout,
    method: site.method,
    headers: site.headers,
  }));
}

function parseEnvFile(): Partial<AppConfig> | null {
  if (!existsSync(ENV_PATH)) return null;

  const content = readFileSync(ENV_PATH, 'utf-8');
  const values = new Map<string, string>();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    values.set(key.trim(), rest.join('=').trim());
  }

  const token = values.get('TELEGRAM_TOKEN');
  const chatId = values.get('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return null;

  return {
    telegram: { token, chatId },
    sites: values.get('SITES')
      ? parseEnvSites(values.get('SITES') as string)
      : DEFAULTS.sites,
    interval: values.get('INTERVAL') ? Number(values.get('INTERVAL')) : DEFAULTS.interval,
    timeout: values.get('TIMEOUT') ? Number(values.get('TIMEOUT')) : DEFAULTS.timeout,
  };
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateConfig(config: Partial<AppConfig>): AppConfig {
  if (!config.telegram?.token || !config.telegram?.chatId) {
    throw new Error('config.json: telegram.token e telegram.chatId são obrigatórios');
  }
  if (!Array.isArray(config.sites) || config.sites.length === 0) {
    throw new Error('config.json: sites é obrigatório');
  }

  const interval = Number(config.interval);
  const timeout = Number(config.timeout);

  if (!Number.isInteger(interval) || interval <= 0) {
    throw new Error('config.json: interval deve ser um número inteiro positivo');
  }
  if (!Number.isInteger(timeout) || timeout <= 0) {
    throw new Error('config.json: timeout deve ser um número inteiro positivo');
  }

  config.sites.forEach((site, index) => {
    if (!site?.name || typeof site.name !== 'string') {
      throw new Error(`config.json: sites[${index}].name é obrigatório`);
    }
    if (!site?.url || typeof site.url !== 'string' || !isValidUrl(site.url)) {
      throw new Error(`config.json: sites[${index}].url deve ser uma URL válida`);
    }
  });

  return {
    telegram: {
      token: config.telegram.token,
      chatId: config.telegram.chatId,
    },
    sites: config.sites.map((site) => ({
      url: site.url,
      name: site.name,
      expectedContent: site.expectedContent,
    })),
    interval,
    timeout,
  };
}

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
    const config = JSON.parse(raw) as Partial<AppConfig>;

    return validateConfig({ ...DEFAULTS, ...config });
  }

  if (existsSync(OLD_TOKEN_PATH)) {
    return validateConfig(migrateFromTokenFile());
  }

  const envConfig = parseEnvFile();
  const envToken = process.env.TELEGRAM_TOKEN || envConfig?.telegram?.token;
  const envChatId = process.env.TELEGRAM_CHAT_ID || envConfig?.telegram?.chatId;
  const envSites =
    process.env.SITES || (envConfig?.sites ? JSON.stringify(envConfig.sites) : undefined);
  const envInterval =
    process.env.INTERVAL ||
    (envConfig?.interval ? String(envConfig.interval) : undefined);
  const envTimeout =
    process.env.TIMEOUT || (envConfig?.timeout ? String(envConfig.timeout) : undefined);

  if (envToken && envChatId) {
    return validateConfig({
      telegram: { token: envToken, chatId: envChatId },
      sites: envSites ? parseEnvSites(envSites) : DEFAULTS.sites,
      interval: envInterval ? Number(envInterval) : DEFAULTS.interval,
      timeout: envTimeout ? Number(envTimeout) : DEFAULTS.timeout,
    });
  }

  throw new Error(
    'Nenhum arquivo de configuração encontrado. Crie config.json, token.json ou use TELEGRAM_TOKEN/TELEGRAM_CHAT_ID.',
  );
}

export function saveConfig(config: AppConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
