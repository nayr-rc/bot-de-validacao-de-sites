import { describe, it, expect, vi, afterAll } from 'vitest';
import { checkSite, checkAllSites } from './checker.js';
import type { SiteConfig } from './types.js';

const originalFetch = globalThis.fetch;

function mockFetch(response: Partial<Response>, error?: string) {
  if (error) {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error(error));
  } else {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('UFRB - Universidade Federal do Recôncavo da Bahia'),
      ...response,
    });
  }
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

describe('checkSite', () => {
  const site: SiteConfig = { url: 'https://ufrb.edu.br', name: 'UFRB' };
  const siteId = 0;

  it('retorna up quando o site responde 200', async () => {
    mockFetch({ ok: true, status: 200 });
    const result = await checkSite(site, siteId, 5000);
    expect(result.status).toBe('up');
    expect(result.statusCode).toBe(200);
    expect(result.error).toBeNull();
    expect(result.url).toBe('https://ufrb.edu.br');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('retorna down quando o site responde 500', async () => {
    mockFetch({ ok: false, status: 500 });
    const result = await checkSite(site, siteId, 5000);
    expect(result.status).toBe('down');
    expect(result.statusCode).toBe(500);
    expect(result.error).toContain('HTTP 500');
  });

  it('retorna down quando a requisição falha', async () => {
    mockFetch({}, 'network error');
    const result = await checkSite(site, siteId, 5000);
    expect(result.status).toBe('down');
    expect(result.error).toContain('network error');
    expect(result.statusCode).toBeNull();
  });

  it('retorna down quando conteúdo esperado não é encontrado', async () => {
    const siteWithContent: SiteConfig = {
      url: 'https://ufrb.edu.br',
      name: 'UFRB',
      expectedContent: 'PalavraInexistenteXYZ',
    };
    mockFetch({ ok: true, status: 200 });
    const result = await checkSite(siteWithContent, siteId, 5000);
    expect(result.status).toBe('down');
    expect(result.error).toContain('PalavraInexistenteXYZ');
  });

  it('retorna up quando conteúdo esperado é encontrado', async () => {
    const siteWithContent: SiteConfig = {
      url: 'https://ufrb.edu.br',
      name: 'UFRB',
      expectedContent: 'UFRB',
    };
    mockFetch({ ok: true, status: 200 });
    const result = await checkSite(siteWithContent, siteId, 5000);
    expect(result.status).toBe('up');
  });

  it('marca como degradado quando o tempo de resposta ultrapassa o limite', async () => {
    const siteWithThreshold: SiteConfig = {
      url: 'https://ufrb.edu.br',
      name: 'UFRB',
      responseTimeThresholdMs: 100,
    };
    mockFetch({ ok: true, status: 200 });
    const perfSpy = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(150);

    const result = await checkSite(siteWithThreshold, siteId, 5000);

    expect(result.status).toBe('degraded');
    expect(result.error).toContain('Tempo de resposta');
    perfSpy.mockRestore();
  });

  it('ignora a checagem quando o site está em manutenção', async () => {
    const maintenanceSite: SiteConfig = {
      url: 'https://ufrb.edu.br',
      name: 'UFRB',
      maintenance: true,
    };

    const result = await checkSite(maintenanceSite, siteId, 5000);

    expect(result.status).toBe('up');
    expect(result.error).toContain('manutenção');
  });

  it('usa a segunda URL quando a primeira falha', async () => {
    const siteWithFallback: SiteConfig = {
      url: 'https://primary.example.com',
      urls: ['https://fallback.example.com'],
      name: 'Fallback',
    };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary down'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('ok'),
      });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await checkSite(siteWithFallback, siteId, 5000);

    expect(result.status).toBe('up');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  afterAll(() => {
    restoreFetch();
  });
});

describe('checkAllSites', () => {
  it('checa múltiplos sites em paralelo', async () => {
    mockFetch({ ok: true, status: 200 });
    const sites: SiteConfig[] = [
      { url: 'https://site1.com', name: 'Site 1' },
      { url: 'https://site2.com', name: 'Site 2' },
    ];
    const results = await checkAllSites(sites, 5000);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('up');
    expect(results[1].status).toBe('up');
  });

  afterAll(() => {
    restoreFetch();
  });
});
