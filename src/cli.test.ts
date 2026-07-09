import { describe, it, expect } from 'vitest';
import { parseCliArgs } from './cli.js';

describe('parseCliArgs', () => {
  it('habilita healthcheck quando o argumento é informado', () => {
    const options = parseCliArgs(['--healthcheck']);

    expect(options.healthcheck).toBe(true);
    expect(options.once).toBe(false);
  });

  it('habilita execução única quando o argumento é informado', () => {
    const options = parseCliArgs(['--once']);

    expect(options.once).toBe(true);
    expect(options.healthcheck).toBe(false);
  });

  it('aceita os dois modos juntos', () => {
    const options = parseCliArgs(['--healthcheck', '--once']);

    expect(options.healthcheck).toBe(true);
    expect(options.once).toBe(true);
  });
});
