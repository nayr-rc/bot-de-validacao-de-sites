import { describe, it, expect, vi, afterEach } from 'vitest';
import { runHealthcheck } from './healthcheck.js';
import type { AppConfig } from './types.js';

const originalFetch = globalThis.fetch;

function mockFetch(status: number) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    text: () => Promise.resolve('ok'),
  });
}

describe('runHealthcheck', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('retorna um resumo detalhado do estado do monitoramento', async () => {
    mockFetch(200);
    const config: AppConfig = {
      telegram: { token: 'token', chatId: 'chat' },
      sites: [{ url: 'https://example.com', name: 'Example' }],
      interval: 60000,
      timeout: 5000,
    };

    const report = await runHealthcheck(config);

    expect(report.ok).toBe(true);
    expect(report.sitesChecked).toBe(1);
    expect(report.sitesUp).toBe(1);
    expect(report.sitesDown).toBe(0);
    expect(report.summary).toContain('Sites: 1/1 up');
  });
});
