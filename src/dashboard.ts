import { createServer } from 'node:http';
import { getRecentChecks, getUptimeStats } from './storage.js';
import { loadState } from './state.js';

const PORT = Number(process.env.DASHBOARD_PORT ?? 3001);

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>UFRB Watch Dashboard</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; background: #111827; color: #f9fafb; }
      .card { background: #1f2937; padding: 1rem 1.25rem; border-radius: 12px; margin-bottom: 1rem; }
      .status { font-weight: bold; }
      .up { color: #4ade80; }
      .down { color: #f87171; }
      code { background: #374151; padding: 0.2rem 0.4rem; border-radius: 6px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 0.6rem; border-bottom: 1px solid #374151; }
    </style>
  </head>
  <body>
    <h1>UFRB Watch Dashboard</h1>
    <div class="card">
      <h2>Resumo</h2>
      <p><strong>Status:</strong> <span id="status" class="status">carregando...</span></p>
      <p><strong>Última verificação:</strong> <span id="last-check">carregando...</span></p>
      <p><strong>Uptime (24h):</strong> <span id="uptime">carregando...</span></p>
    </div>
    <div class="card">
      <h2>Últimos checks</h2>
      <table>
        <thead>
          <tr><th>Site</th><th>Status</th><th>Tempo</th><th>Verificado em</th></tr>
        </thead>
        <tbody id="checks"></tbody>
      </table>
    </div>
    <script>
      async function refresh() {
        const res = await fetch('/api/status');
        const data = await res.json();
        document.getElementById('status').textContent = data.status;
        document.getElementById('status').className = 'status ' + (data.status === 'up' ? 'up' : 'down');
        document.getElementById('last-check').textContent = data.lastCheckedAt || 'n/a';
        document.getElementById('uptime').textContent = data.uptimePercent + '%';
        const rows = data.recentChecks
          .map(function (item) {
            return '<tr><td>' + item.url + '</td><td>' + item.status + '</td><td>' + (item.responseTimeMs ?? '?') + 'ms</td><td>' + item.checkedAt + '</td></tr>';
          })
          .join('');
        document.getElementById('checks').innerHTML = rows;
      }
      refresh();
      setInterval(refresh, 15000);
    </script>
  </body>
</html>`;

export function startDashboard(): void {
  const server = createServer(async (req, res) => {
    if (req.url === '/api/status') {
      const state = loadState();
      const recentChecks = getRecentChecks(24);
      const stats = getUptimeStats(24);
      const status = state.wasDown ? 'down' : 'up';
      const payload = {
        status,
        lastCheckedAt: state.lastCheckedAt,
        uptimePercent:
          stats.totalChecks > 0
            ? Number(((stats.upChecks / stats.totalChecks) * 100).toFixed(2))
            : 0,
        recentChecks,
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  server.listen(PORT, () => {
    console.log(`[DASHBOARD] Servindo em http://localhost:${PORT}`);
  });
  server.unref();
}
