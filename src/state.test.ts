import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadState, saveState } from './state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATE_PATH = join(__dirname, '..', 'state.json');

describe('state', () => {
  beforeEach(() => {
    try {
      unlinkSync(STATE_PATH);
    } catch {}
  });

  afterEach(() => {
    try {
      unlinkSync(STATE_PATH);
    } catch {}
  });

  it('salva e carrega estado', () => {
    saveState({ wasDown: true, lastCheckedAt: '2026-07-08T12:00:00.000Z' });
    const state = loadState();
    expect(state.wasDown).toBe(true);
    expect(state.lastCheckedAt).toBe('2026-07-08T12:00:00.000Z');
  });

  it('usa defaults quando arquivo não existe', () => {
    const state = loadState();
    expect(state.wasDown).toBe(true);
    expect(state.lastCheckedAt).toBeNull();
  });

  it('lê formato antigo (down: true/false)', () => {
    writeFileSync(STATE_PATH, JSON.stringify({ down: false }));
    const state = loadState();
    expect(state.wasDown).toBe(false);
  });
});
