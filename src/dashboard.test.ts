import { describe, it, expect } from 'vitest';
import { startDashboard } from './dashboard.js';

describe('startDashboard', () => {
  it('inicializa o dashboard sem lançar erro', () => {
    expect(() => startDashboard()).not.toThrow();
  });

  it('abre um servidor HTTP que responde na porta configurada', async () => {
    startDashboard();
    const response = await fetch('http://127.0.0.1:3001/api/status');
    expect(response.ok).toBe(true);
  });
});
