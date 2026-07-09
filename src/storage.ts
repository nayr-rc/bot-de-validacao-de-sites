import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import type { CheckResult, AlertData } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', 'data.db');

let db: SqlJsDatabase | undefined;
let storageReady = false;

export async function initStorage(): Promise<void> {
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('up', 'down')),
      status_code INTEGER,
      response_time_ms INTEGER,
      error TEXT,
      checked_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('up', 'down')),
      message TEXT NOT NULL,
      sent_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_alerts_sent_at ON alerts(sent_at)
  `);

  storageReady = true;
  save();
}

export function save(): void {
  if (!db) return;
  writeFileSync(DB_PATH, Buffer.from(db.export()));
}

export function insertCheck(result: CheckResult): void {
  if (!db) return;
  db.run(
    `INSERT INTO checks (site_id, url, status, status_code, response_time_ms, error, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      result.siteId,
      result.url,
      result.status,
      result.statusCode,
      result.responseTimeMs,
      result.error,
      result.checkedAt,
    ],
  );
  save();
}

export function insertAlert(alert: AlertData): void {
  if (!db) return;
  db.run(`INSERT INTO alerts (type, message, sent_at) VALUES (?, ?, ?)`, [
    alert.type,
    alert.message,
    alert.sentAt,
  ]);
  save();
}

export function getRecentChecks(hours = 24): CheckResult[] {
  if (!db || !storageReady) return [];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const stmt = db.exec(
    `SELECT site_id, url, status, status_code, response_time_ms, error, checked_at
     FROM checks WHERE checked_at >= ? ORDER BY checked_at DESC`,
    [since],
  );

  if (!stmt.length) return [];
  return parseRows(stmt[0]);
}

function parseRows(result: { columns: string[]; values: unknown[][] }): CheckResult[] {
  return result.values.map((row) => {
    const obj: Record<string, unknown> = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as unknown as CheckResult;
  });
}

export function getUptimeStats(hours = 24): {
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  avgResponseTimeMs: number | null;
} {
  if (!db || !storageReady) {
    return { totalChecks: 0, upChecks: 0, downChecks: 0, avgResponseTimeMs: null };
  }
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const stmt = db.exec(
    `SELECT
       COUNT(*) as totalChecks,
       SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) as upChecks,
       SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as downChecks,
       AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms ELSE NULL END) as avgResponseTimeMs
     FROM checks WHERE checked_at >= ?`,
    [since],
  );

  if (!stmt.length || !stmt[0].values.length) {
    return { totalChecks: 0, upChecks: 0, downChecks: 0, avgResponseTimeMs: null };
  }

  const row = stmt[0].values[0];
  const cols = stmt[0].columns;

  const get = (name: string) => row[cols.indexOf(name)];

  return {
    totalChecks: Number(get('totalChecks')),
    upChecks: Number(get('upChecks')),
    downChecks: Number(get('downChecks')),
    avgResponseTimeMs:
      get('avgResponseTimeMs') != null ? Number(get('avgResponseTimeMs')) : null,
  };
}

export function closeDb(): void {
  if (db) {
    save();
    db.close();
  }
  db = undefined;
  storageReady = false;
}
