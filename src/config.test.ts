import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, '..', 'config.json');
const TOKEN_PATH = join(__dirname, '..', 'token.json');
const ENV_PATH = join(__dirname, '..', '.env');

describe('loadConfig', () => {
  let origConfig: string | null = null;
  let origToken: string | null = null;

  function cleanup() {
    try {
      unlinkSync(CONFIG_PATH);
    } catch {}
    try {
      unlinkSync(TOKEN_PATH);
    } catch {}
    try {
      unlinkSync(ENV_PATH);
    } catch {}
  }

  beforeEach(() => {
    if (origConfig == null && existsSync(CONFIG_PATH)) {
      origConfig = readFileSync(CONFIG_PATH, 'utf-8');
    }
    if (origToken == null && existsSync(TOKEN_PATH)) {
      origToken = readFileSync(TOKEN_PATH, 'utf-8');
    }
    cleanup();
    process.env = { ...process.env };
    delete process.env.TELEGRAM_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.SITES;
    delete process.env.INTERVAL;
    delete process.env.TIMEOUT;
  });

  afterEach(() => {
    cleanup();
    if (origConfig) writeFileSync(CONFIG_PATH, origConfig);
    if (origToken) writeFileSync(TOKEN_PATH, origToken);
    process.env = { ...process.env };
    delete process.env.TELEGRAM_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.SITES;
    delete process.env.INTERVAL;
    delete process.env.TIMEOUT;
  });

  it('lê config.json corretamente', () => {
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify({
        telegram: { token: 'abc', chatId: '123' },
        sites: [{ url: 'https://example.com', name: 'Example' }],
        interval: 60000,
        timeout: 5000,
      }),
    );
    const config = loadConfig();
    expect(config.telegram.token).toBe('abc');
    expect(config.telegram.chatId).toBe('123');
    expect(config.sites).toHaveLength(1);
    expect(config.interval).toBe(60000);
    expect(config.timeout).toBe(5000);
  });

  it('migra de token.json quando config.json não existe', () => {
    writeFileSync(
      TOKEN_PATH,
      JSON.stringify({ token: 'migrated-token', chatId: 'migrated-chat' }),
    );
    const config = loadConfig();
    expect(config.telegram.token).toBe('migrated-token');
    expect(config.telegram.chatId).toBe('migrated-chat');
    expect(config.sites.length).toBeGreaterThan(0);
    expect(existsSync(CONFIG_PATH)).toBe(true);
  });

  it('lança erro quando interval é inválido', () => {
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify({
        telegram: { token: 'abc', chatId: '123' },
        sites: [{ url: 'https://example.com', name: 'Example' }],
        interval: 0,
        timeout: 5000,
      }),
    );

    expect(() => loadConfig()).toThrow('interval');
  });

  it('lança erro quando timeout é inválido', () => {
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify({
        telegram: { token: 'abc', chatId: '123' },
        sites: [{ url: 'https://example.com', name: 'Example' }],
        interval: 60000,
        timeout: -1,
      }),
    );

    expect(() => loadConfig()).toThrow('timeout');
  });

  it('lança erro quando URL de site é inválida', () => {
    writeFileSync(
      CONFIG_PATH,
      JSON.stringify({
        telegram: { token: 'abc', chatId: '123' },
        sites: [{ url: 'site-invalido', name: 'Example' }],
        interval: 60000,
        timeout: 5000,
      }),
    );

    expect(() => loadConfig()).toThrow('sites[0].url');
  });

  it('lê configuração a partir de variáveis de ambiente quando não há arquivos', () => {
    process.env.TELEGRAM_TOKEN = 'env-token';
    process.env.TELEGRAM_CHAT_ID = 'env-chat';
    process.env.SITES = JSON.stringify([{ url: 'https://env.example.com', name: 'Env' }]);
    process.env.INTERVAL = '90000';
    process.env.TIMEOUT = '4000';

    const config = loadConfig();

    expect(config.telegram.token).toBe('env-token');
    expect(config.telegram.chatId).toBe('env-chat');
    expect(config.sites).toHaveLength(1);
    expect(config.interval).toBe(90000);
    expect(config.timeout).toBe(4000);
  });

  it('lê configuração a partir de um arquivo .env', () => {
    writeFileSync(ENV_PATH, 'TELEGRAM_TOKEN=env-token\nTELEGRAM_CHAT_ID=env-chat\n');
    const config = loadConfig();

    expect(config.telegram.token).toBe('env-token');
    expect(config.telegram.chatId).toBe('env-chat');
  });

  it('lança erro quando nenhum arquivo existe', () => {
    expect(() => loadConfig()).toThrow();
  });
});
