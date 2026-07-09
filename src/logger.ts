export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export function formatLog(entry: LogEntry): string {
  const payload = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${payload}`;
}

export function createLogger(prefix = 'APP') {
  const write = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
    const entry: LogEntry = {
      level,
      message: `${prefix} ${message}`,
      timestamp: new Date().toISOString(),
      context,
    };
    console.log(formatLog(entry));
  };

  return {
    info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
  };
}
