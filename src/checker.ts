import type { CheckResult, SiteConfig } from './types.js';

export async function checkSite(
  site: SiteConfig,
  siteId: number,
  timeout: number,
): Promise<CheckResult> {
  const start = performance.now();
  const checkedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(site.url, { signal: controller.signal });
    clearTimeout(timer);

    const responseTimeMs = Math.round(performance.now() - start);
    const statusCode = res.status;

    if (res.ok && site.expectedContent) {
      const text = await res.text();
      if (!text.includes(site.expectedContent)) {
        return {
          siteId,
          url: site.url,
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
        url: site.url,
        status: 'up',
        statusCode,
        responseTimeMs,
        error: null,
        checkedAt,
      };
    }

    return {
      siteId,
      url: site.url,
      status: 'down',
      statusCode,
      responseTimeMs,
      error: `HTTP ${res.status}`,
      checkedAt,
    };
  } catch (err) {
    const responseTimeMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    return {
      siteId,
      url: site.url,
      status: 'down',
      statusCode: null,
      responseTimeMs,
      error: message,
      checkedAt,
    };
  }
}

export async function checkAllSites(
  sites: SiteConfig[],
  timeout: number,
): Promise<CheckResult[]> {
  const results = await Promise.all(sites.map((site, i) => checkSite(site, i, timeout)));
  return results;
}
