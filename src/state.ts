import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SiteState } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATE_PATH = join(__dirname, '..', 'state.json');

export function loadState(): SiteState {
  try {
    if (existsSync(STATE_PATH)) {
      const raw = readFileSync(STATE_PATH, 'utf-8');
      const state = JSON.parse(raw);
      return {
        wasDown: state.down ?? true,
        lastCheckedAt: state.lastCheckedAt ?? null,
      };
    }
  } catch {
    console.warn('[STATE] Falha ao ler state.json, usando defaults');
  }
  return { wasDown: true, lastCheckedAt: null };
}

export function saveState(state: SiteState): void {
  writeFileSync(
    STATE_PATH,
    JSON.stringify({ down: state.wasDown, lastCheckedAt: state.lastCheckedAt }),
  );
}
