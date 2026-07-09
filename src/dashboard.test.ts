import { describe, it, expect } from 'vitest';
import { startDashboard } from './dashboard.js';

describe('startDashboard', () => {
  it('inicializa o dashboard sem lançar erro', () => {
    expect(() => startDashboard()).not.toThrow();
  });
});
