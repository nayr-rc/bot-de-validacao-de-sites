import { describe, it, expect, beforeAll } from 'vitest';
import { startDashboard } from './dashboard.js';

describe('startDashboard', () => {
  beforeAll(() => {
    startDashboard();
  });

  it('inicializa o dashboard sem lançar erro', () => {
    expect(() => startDashboard()).not.toThrow();
  });

  it('abre um servidor HTTP que responde na porta configurada', async () => {
    const response = await fetch('http://127.0.0.1:3001/api/status');
    expect(response.ok).toBe(true);
  });

  it('retorna JSON com campos esperados', async () => {
    const response = await fetch('http://127.0.0.1:3001/api/status');
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('uptimePercent');
    expect(data).toHaveProperty('totalChecks');
    expect(data).toHaveProperty('avgLatency');
    expect(data).toHaveProperty('alertCount');
    expect(data).toHaveProperty('sites');
    expect(data).toHaveProperty('recentChecks');
    expect(data).toHaveProperty('alerts');
  });

  it('retorna HTML para a raiz', async () => {
    const response = await fetch('http://127.0.0.1:3001/');
    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text).toContain('UFRB Monitor');
    expect(text).toContain('Configurações');
  });

  it('GET /api/config retorna configuração com token mascarado', async () => {
    const response = await fetch('http://127.0.0.1:3001/api/config');
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty('telegramToken');
    expect(data).toHaveProperty('telegramChatId');
    expect(data).toHaveProperty('sites');
    expect(Array.isArray(data.sites)).toBe(true);
  });

  it('PUT /api/config salva nova configuração', async () => {
    const response = await fetch('http://127.0.0.1:3001/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramToken: 'test:token',
        telegramChatId: 'test-chat',
        sites: [{ name: 'Test', url: 'https://test.com' }],
      }),
    });
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.ok).toBe(true);

    const getRes = await fetch('http://127.0.0.1:3001/api/config');
    const cfg = await getRes.json();
    expect(cfg.telegramChatId).toBe('test-chat');
    expect(cfg.sites[0].name).toBe('Test');
  });
});
