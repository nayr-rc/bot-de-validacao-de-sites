import { createServer, type Server } from 'node:http';
import { getRecentChecks, getUptimeStats } from './storage.js';
import { loadState } from './state.js';

const PORT = Number(process.env.DASHBOARD_PORT ?? 3001);
let dashboardServer: Server | null = null;
let dashboardStarting = false;

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Status do Monitor</title>
    <style>
      :root { color-scheme: dark; }
      body { font-family: Arial, sans-serif; margin: 0; background: #0f172a; color: #f8fafc; }
      main { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
      .card { background: #111827; border: 1px solid #334155; padding: 1.2rem; border-radius: 14px; margin-bottom: 1rem; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
      .hero { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
      .badge { display: inline-block; padding: 0.4rem 0.8rem; border-radius: 999px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
      .up { background: #14532d; color: #dcfce7; }
      .down { background: #7f1d1d; color: #fee2e2; }
      .degraded { background: #78350f; color: #ffedd5; }
      table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
      th, td { text-align: left; padding: 0.7rem; border-bottom: 1px solid #334155; }
      code { background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 6px; }
      small { color: #94a3b8; }
    </style>
  </head>
  <body>
    <main>
      <div class="card hero">
        <div>
          <h1>Status do Monitor</h1>
          <p>Visão pública do estado atual dos sites monitorados.</p>
        </div>
        <div id="badge" class="badge up">carregando...</div>
      </div>
      <div class="card">
        <h2>Resumo</h2>
        <p><strong>Status geral:</strong> <span id="status">carregando...</span></p>
        <p><strong>Última verificação:</strong> <span id="last-check">carregando...</span></p>
        <p><strong>Uptime (24h):</strong> <span id="uptime">carregando...</span></p>
      </div>
      <div class="card">
        <h2>Últimos eventos</h2>
        <table>
          <thead>
            <tr><th>Site</th><th>Status</th><th>Tempo</th><th>Verificado em</th></tr>
          </thead>
          <tbody id="checks"></tbody>
        </table>
      </div>
      <div class="card">
        <h2>Incidentes recentes</h2>
        <div id="incidents">Nenhum incidente registrado.</div>
      </div>
    </main>
    <script>
      async function refresh() {
        const res = await fetch('/api/status');
        const data = await res.json();
        const badge = document.getElementById('badge');
        const status = document.getElementById('status');
        badge.textContent = data.status === 'up' ? 'Operando' : data.status === 'degraded' ? 'Degradado' : 'Indisponível';
        badge.className = 'badge ' + data.status;
        status.textContent = data.status === 'up' ? 'Operando normalmente' : data.status === 'degraded' ? 'Com degradação' : 'Indisponível';
        document.getElementById('last-check').textContent = data.lastCheckedAt || 'n/a';
        document.getElementById('uptime').textContent = data.uptimePercent + '%';
        const rows = data.recentChecks
          .map(function (item) {
            return '<tr><td>' + item.url + '</td><td>' + item.status + '</td><td>' + (item.responseTimeMs ?? '?') + 'ms</td><td>' + item.checkedAt + '</td></tr>';
          })
          .join('');
        document.getElementById('checks').innerHTML = rows;
        const incidents = data.recentChecks.filter(function (item) {
          return item.status !== 'up';
        });
        if (incidents.length) {
          document.getElementById('incidents').innerHTML = incidents
            .slice(0, 5)
            .map(function (item) {
              return '<p><strong>' + escapeHtml(item.url) + '</strong> — ' + escapeHtml(item.status) + ' (' + escapeHtml(item.error || 'sem detalhe') + ')</p>';
            })
            .join('');
        } else {
          document.getElementById('incidents').textContent = 'Nenhum incidente registrado.';
        }
      }
      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;');
      }
      refresh();
      setInterval(refresh, 15000);
    </script>
  </body>
</html>`;

export function startDashboard(): void {
  if (dashboardServer || dashboardStarting) return;

  dashboardStarting = true;

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
    dashboardServer = server;
    dashboardStarting = false;
    console.log(`[DASHBOARD] Servindo em http://localhost:${PORT}`);
  });

  server.once('error', (error) => {
    dashboardStarting = false;
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      console.warn(`[DASHBOARD] Porta ${PORT} já está em uso, pulando inicialização.`);
      return;
    }
    console.error('[DASHBOARD] Falha ao iniciar:', error);
  });

  if (process.env.VITEST) {
    server.unref();
  }
}
