export interface SiteConfig {
  url: string;
  urls?: string[];
  name: string;
  expectedContent?: string;
  interval?: number;
  timeout?: number;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  maintenance?: boolean;
  responseTimeThresholdMs?: number;
}

export interface TelegramConfig {
  token: string;
  chatId: string;
}

export interface NotificationConfig {
  type: 'telegram' | 'webhook' | 'discord';
  webhookUrl?: string;
  discordWebhookUrl?: string;
}

export interface AppConfig {
  telegram: TelegramConfig;
  notifications?: NotificationConfig[];
  sites: SiteConfig[];
  interval: number;
  timeout: number;
}

export interface CheckResult {
  siteId: number;
  url: string;
  status: 'up' | 'down' | 'degraded';
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
  checkedAt: string;
}

export interface UptimeStats {
  period: string;
  uptimePercent: number;
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  avgResponseTimeMs: number | null;
  totalDowntimeMs: number;
}

export interface AlertData {
  type: 'up' | 'down';
  message: string;
  sentAt: string;
}

export interface SiteState {
  wasDown: boolean;
  lastCheckedAt: string | null;
}
