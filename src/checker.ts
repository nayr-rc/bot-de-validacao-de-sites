import type { CheckResult, SiteConfig } from './types.js';

async function requestSite(
  url: string,
  site: SiteConfig,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = site.headers ?? {};
  const method = site.method ?? 'GET';

  try {
    return await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSite(
  site: SiteConfig,
  siteId: number,
  timeout: number,
): Promise<CheckResult> {
  const start = performance.now();
  const checkedAt = new Date().toISOString();
  const urls = [site.url, ...(site.urls ?? [])];

  for (const url of urls) {
    try {
      const res = await requestSite(url, site, timeout);
      const responseTimeMs = Math.round(performance.now() - start);
      const statusCode = res.status;

      if (res.ok && site.expectedContent) {
        const text = await res.text();
        if (!text.includes(site.expectedContent)) {
          return {
            siteId,
            url,
            status: 'down',
            statusCode,
            responseTimeMs,
            error: `Conteúdo esperado não encontrado: "${site.expectedContent}"`,
            checkedAt,
          };
        }
      }

      if (res.ok) {
        return {
          siteId,
          url,
          status: 'up',
          statusCode,
          responseTimeMs,
          error: null,
          checkedAt,
        };
      }

      return {
        siteId,
        url,
        status: 'down',
        statusCode,
        responseTimeMs,
        error: `HTTP ${res.status}`,
        checkedAt,
      };
    } catch (err) {
      if (url === urls[urls.length - 1]) {
        const responseTimeMs = Math.round(performance.now() - start);
        const message = err instanceof Error ? err.message : String(err);
        return {
          siteId,
          url,
          status: 'down',
          statusCode: null,
          responseTimeMs,
          error: message,
          checkedAt,
        };
      }
    }
  }

  const responseTimeMs = Math.round(performance.now() - start);
  return {
    siteId,
    url: site.url,
    status: 'down',
    statusCode: null,
    responseTimeMs,
    error: 'Todas as URLs falharam',
    checkedAt,
  };
}

export async function checkAllSites(
  sites: SiteConfig[],
  timeout: number,
): Promise<CheckResult[]> {
  const results = await Promise.all(sites.map((site, i) => checkSite(site, i, timeout)));
  return results;
}
