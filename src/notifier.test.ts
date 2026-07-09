import { describe, it, expect } from 'vitest';
import { buildUpMessage, buildDownMessage, buildUptimeMessage } from './notifier.js';
import type { CheckResult } from './types.js';

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    siteId: 0,
    url: 'https://ufrb.edu.br',
    status: 'up',
    statusCode: 200,
    responseTimeMs: 150,
    error: null,
    checkedAt: '2026-07-08T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildUpMessage', () => {
  it('inclui indicador de sucesso e detalhes', () => {
    const msg = buildUpMessage([makeResult()]);
    expect(msg).toContain('🟢');
    expect(msg).toContain('voltou ao ar');
    expect(msg).toContain('200');
    expect(msg).toContain('150ms');
  });

  it('funciona com múltiplos resultados', () => {
    const results = [
      makeResult({ url: 'https://ufrb.edu.br', status: 'up', statusCode: 200 }),
      makeResult({
        url: 'https://www.ufrb.edu.br',
        status: 'down',
        statusCode: 503,
        responseTimeMs: null,
      }),
    ];
    const msg = buildUpMessage(results);
    expect(msg).toContain('https://ufrb.edu.br');
    expect(msg).toContain('https://www.ufrb.edu.br');
    expect(msg).toContain('✅');
    expect(msg).toContain('❌');
  });
});

describe('buildDownMessage', () => {
  it('inclui indicador de erro', () => {
    const result = makeResult({ status: 'down', statusCode: 503, error: 'HTTP 503' });
    const msg = buildDownMessage([result]);
    expect(msg).toContain('🔴');
    expect(msg).toContain('fora do ar');
    expect(msg).toContain('503');
  });

  it('inclui detalhes de erro e tempo de resposta', () => {
    const result = makeResult({
      status: 'down',
      statusCode: 503,
      error: 'timeout',
      responseTimeMs: 8000,
    });
    const msg = buildDownMessage([result]);
    expect(msg).toContain('timeout');
    expect(msg).toContain('8000ms');
  });
});

describe('buildUptimeMessage', () => {
  it('mostra porcentagem com barra de progresso', () => {
    const msg = buildUptimeMessage(99.5, 200, 'últimas 24h');
    expect(msg).toContain('99.50%');
    expect(msg).toContain('200ms');
    expect(msg).toContain('últimas 24h');
    expect(msg).toContain('█'); // progress bar
  });

  it('lida com null avgResponseTime', () => {
    const msg = buildUptimeMessage(0, null, 'últimas 24h');
    expect(msg).toContain('N/A');
  });
});
