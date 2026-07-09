import { describe, it, expect } from 'vitest';
import { createLogger, formatLog } from './logger.js';

describe('logger', () => {
  it('formata entradas com nível e contexto', () => {
    const entry = formatLog({
      level: 'info',
      message: 'teste',
      timestamp: '2026-07-08T00:00:00.000Z',
      context: { site: 'UFRB' },
    });

    expect(entry).toContain('[INFO]');
    expect(entry).toContain('teste');
    expect(entry).toContain('UFRB');
  });

  it('cria um logger com prefixo', () => {
    const logger = createLogger('MONITOR');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});
