import { createServer, type Server } from 'node:http';
import { getRecentChecks, getUptimeStats, getRecentAlerts } from './storage.js';
import { loadState } from './state.js';
import { loadConfig, saveConfig } from './config.js';
import type { CheckResult } from './types.js';

const PORT = Number(process.env.DASHBOARD_PORT ?? 3001);
let dashboardServer: Server | null = null;
let dashboardStarting = false;

function maskToken(token: string): string {
  if (token.length <= 8) return token;
  return token.slice(0, 4) + '…' + token.slice(-4);
}

const HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>UFRB Monitor</title>
<style>
:root {
  --bg: #0a0a10;
  --surface: #12121c;
  --border: #1e1e32;
  --text: #e2e2f0;
  --text-muted: #7a7a9a;
  --text-faint: #4a4a66;
  --green: #22c55e;
  --green-bg: #052e16;
  --red: #ef4444;
  --red-bg: #2d0a0a;
  --amber: #f59e0b;
  --amber-bg: #2d1b00;
  --accent: #6366f1;
  --radius: 12px;
  --radius-sm: 6px;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg); color: var(--text);
  line-height: 1.6; -webkit-font-smoothing: antialiased;
}
main { max-width: 960px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; flex-wrap: wrap; gap: .75rem; }
header h1 { font-size: 1.35rem; font-weight: 700; letter-spacing: -.02em; display: flex; align-items: center; gap: .5rem; }
header h1::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 10px var(--green); animation: pulse-dot 2s infinite; }
@keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
.header-actions { display: flex; align-items: center; gap: .5rem; }
.settings-btn {
  background: var(--surface); border: 1px solid var(--border); color: var(--text-muted);
  width: 34px; height: 34px; border-radius: 8px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .2s; font-size: 1rem;
}
.settings-btn:hover { background: var(--border); color: var(--text); }
.badge {
  display: inline-flex; align-items: center; gap: .4rem;
  padding: .3rem .85rem; border-radius: 999px; font-size: .75rem;
  font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
}
.badge.up { background: var(--green-bg); color: var(--green); }
.badge.down { background: var(--red-bg); color: var(--red); }
.badge.degraded { background: var(--amber-bg); color: var(--amber); }
.badge.pending { background: var(--border); color: var(--text-muted); }
.dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; }
.dot.up { background: var(--green); box-shadow: 0 0 5px var(--green); }
.dot.down { background: var(--red); box-shadow: 0 0 5px var(--red); }
.dot.degraded { background: var(--amber); box-shadow: 0 0 5px var(--amber); }
.dot.pending { background: var(--text-faint); }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; margin-bottom: 1.5rem; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.15rem; transition: background .2s; }
.stat-card:hover { background: #18182a; }
.stat-label { font-size: .7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; font-weight: 500; }
.stat-val { font-size: 1.4rem; font-weight: 700; margin-top: .15rem; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.section-title { font-size: .85rem; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: .06em; margin-bottom: .6rem; margin-top: 1.5rem; }
.section-title:first-of-type { margin-top: 0; }
.site-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: .85rem 1rem;
  display: flex; align-items: center; justify-content: space-between; gap: .75rem;
  margin-bottom: .35rem; transition: background .15s;
}
.site-card:hover { background: #18182a; }
.site-left { display: flex; align-items: center; gap: .75rem; min-width: 0; }
.site-left .dot { flex-shrink: 0; }
.site-name { font-size: .88rem; font-weight: 600; }
.site-url { font-size: .73rem; color: var(--text-faint); font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px; }
.site-right { text-align: right; flex-shrink: 0; }
.site-status { font-size: .78rem; font-weight: 600; }
.site-status.up { color: var(--green); }
.site-status.down { color: var(--red); }
.site-status.degraded { color: var(--amber); }
.site-status.pending { color: var(--text-muted); }
.site-time { font-size: .68rem; color: var(--text-faint); margin-top: .05rem; font-family: ui-monospace, monospace; }
.tl-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.tl-row {
  display: flex; align-items: center; gap: .6rem;
  padding: .45rem 1rem; font-size: .8rem;
}
.tl-row + .tl-row { border-top: 1px solid var(--border); }
.tl-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.tl-dot.up { background: var(--green); }
.tl-dot.down { background: var(--red); }
.tl-dot.degraded { background: var(--amber); }
.tl-status { font-weight: 600; width: 3.2rem; font-size: .73rem; }
.tl-status.up { color: var(--green); }
.tl-status.down { color: var(--red); }
.tl-status.degraded { color: var(--amber); }
.tl-code { color: var(--text-faint); width: 2.8rem; font-family: ui-monospace, monospace; font-size: .73rem; }
.tl-url { flex: 1; color: var(--text-muted); font-size: .73rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-time { color: var(--text-faint); font-family: ui-monospace, monospace; font-size: .7rem; white-space: nowrap; }
.alert-row { display: flex; align-items: center; gap: .5rem; padding: .45rem 1rem; font-size: .8rem; }
.alert-row + .alert-row { border-top: 1px solid var(--border); }
.alert-icon { flex-shrink: 0; }
.alert-text { flex: 1; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alert-time { color: var(--text-faint); font-family: ui-monospace, monospace; font-size: .7rem; white-space: nowrap; }
.empty-state { text-align: center; padding: 1.5rem; color: var(--text-faint); font-size: .85rem; }
.shimmer { background: linear-gradient(90deg, var(--surface) 25%, #1a1a2e 50%, var(--surface) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 4px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.shimmer-line { height: .9rem; margin: .35rem 0; width: 60%; }
.shimmer-line.short { width: 30%; }

/* Settings modal */
.overlay { display: none; position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.65); backdrop-filter: blur(4px); align-items: center; justify-content: center; }
.overlay.open { display: flex; }
.modal { background: #1a1a2e; border: 1px solid var(--border); border-radius: var(--radius); width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; }
.modal h2 { font-size: 1rem; font-weight: 700; margin-bottom: 1.25rem; }
.form-group { margin-bottom: .9rem; }
.form-group label { display: block; font-size: .75rem; color: var(--text-muted); font-weight: 500; margin-bottom: .3rem; }
.form-group input { width: 100%; padding: .5rem .7rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: .85rem; outline: none; transition: border-color .2s; }
.form-group input:focus { border-color: var(--accent); }
.site-row { display: flex; gap: .4rem; margin-bottom: .35rem; align-items: center; }
.site-row input { flex: 1; padding: .4rem .55rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: .82rem; outline: none; }
.site-row input:first-child { flex: 0 0 100px; }
.site-row input:focus { border-color: var(--accent); }
.site-row button { background: none; border: none; color: var(--red); cursor: pointer; font-size: 1.1rem; padding: .2rem; line-height: 1; opacity: .5; transition: opacity .2s; }
.site-row button:hover { opacity: 1; }
.btn-primary { background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: .5rem 1.2rem; font-size: .82rem; font-weight: 600; cursor: pointer; transition: opacity .2s; }
.btn-primary:hover { opacity: .85; }
.btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--text-muted); border-radius: var(--radius-sm); padding: .45rem 1rem; font-size: .78rem; cursor: pointer; transition: all .2s; }
.btn-secondary:hover { background: var(--border); color: var(--text); }
.modal-footer { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1.25rem; }

.toast { position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%); padding: .5rem 1.2rem; border-radius: var(--radius-sm); font-size: .82rem; z-index: 200; opacity: 0; transition: opacity .3s; backdrop-filter: blur(8px); }
.toast.show { opacity: 1; }
.toast.success { background: var(--green-bg); color: var(--green); border: 1px solid rgba(34,197,94,.25); }
.toast.error { background: var(--red-bg); color: var(--red); border: 1px solid rgba(239,68,68,.25); }

.footer-note { margin-top: 1.5rem; text-align: center; color: var(--text-faint); font-size: .7rem; }

@media (max-width: 600px) {
  main { padding: 1rem .85rem 2rem; }
  header h1 { font-size: 1.1rem; }
  .stats { grid-template-columns: repeat(2, 1fr); gap: .5rem; }
  .stat-val { font-size: 1.15rem; }
}
</style>
</head>
<body>
<main>
  <header>
    <h1>UFRB Monitor</h1>
    <div class="header-actions">
      <button class="settings-btn" onclick="openSettings()">&#9881;</button>
      <div id="badge" class="badge pending"><span class="dot pending"></span>carregando</div>
    </div>
  </header>

  <div class="stats">
    <div class="stat-card"><div class="stat-label">Uptime 24h</div><div class="stat-val" id="uptimeVal"><div class="shimmer shimmer-line"></div></div></div>
    <div class="stat-card"><div class="stat-label">Verificações</div><div class="stat-val" id="checksVal"><div class="shimmer shimmer-line"></div></div></div>
    <div class="stat-card"><div class="stat-label">Tempo médio</div><div class="stat-val" id="latencyVal"><div class="shimmer shimmer-line"></div></div></div>
    <div class="stat-card"><div class="stat-label">Alertas 48h</div><div class="stat-val" id="alertsVal"><div class="shimmer shimmer-line"></div></div></div>
  </div>

  <div class="section-title">Sites</div>
  <div id="sitesList"><div class="shimmer shimmer-line"></div><div class="shimmer shimmer-line short"></div></div>

  <div class="section-title">Verificações</div>
  <div class="tl-card" id="timeline"><div class="empty-state">Carregando...</div></div>

  <div class="section-title" id="alertsSection" style="display:none">Incidentes</div>
  <div class="tl-card" id="alertsCard" style="display:none"></div>

  <div class="footer-note"><span id="lastRefresh">—</span></div>
</main>

<div class="overlay" id="settingsOverlay" onclick="if(event.target===this)closeSettings()">
  <div class="modal">
    <h2>Configurações</h2>
    <div class="form-group">
      <label>Token do Telegram</label>
      <input id="telegramToken" type="password" placeholder="0000000000:AAAAAAAAAA" />
    </div>
    <div class="form-group">
      <label>Chat ID</label>
      <input id="telegramChatId" type="text" placeholder="123456789" />
    </div>
    <div class="form-group">
      <label>Sites</label>
      <div id="settingsSites"></div>
      <button class="btn-secondary" onclick="addSiteRow()" style="margin-top:.3rem">+ Adicionar site</button>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeSettings()">Cancelar</button>
      <button class="btn-primary" onclick="saveSettings()">Salvar</button>
    </div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
function ago(iso) {
  if (!iso) return '—';
  var diff = Date.now() - new Date(iso).getTime();
  var s = Math.floor(diff / 1000);
  if (s < 10) return 'agora';
  if (s < 60) return s + 's';
  var m = Math.floor(s / 60);
  if (m < 60) return m + 'min';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}
function ts(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, isError) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (isError ? 'error' : 'success');
  setTimeout(function() { el.className = 'toast'; }, 2800);
}

function render(data) {
  var cls = data.status === 'up' ? 'up' : data.status === 'degraded' ? 'degraded' : data.status === 'pending' ? 'pending' : 'down';
  var label = cls === 'up' ? 'Operando' : cls === 'degraded' ? 'Degradado' : cls === 'pending' ? 'Aguardando' : 'Indisponível';
  var badge = document.getElementById('badge');
  badge.className = 'badge ' + cls;
  badge.innerHTML = '<span class="dot ' + cls + '"></span>' + label;

  var up = Number(data.uptimePercent);
  document.getElementById('uptimeVal').textContent = up.toFixed(1) + '%';
  document.getElementById('uptimeVal').style.color = up >= 99 ? 'var(--green)' : up >= 95 ? 'var(--amber)' : 'var(--red)';
  document.getElementById('checksVal').textContent = data.totalChecks.toLocaleString();
  document.getElementById('latencyVal').textContent = data.avgLatency != null ? data.avgLatency + 'ms' : '—';
  document.getElementById('alertsVal').textContent = data.alertCount;

  document.getElementById('sitesList').innerHTML = (data.sites || []).map(function(s) {
    var st = s.status;
    var lbl = st === 'up' ? 'Online' : st === 'degraded' ? 'Lento' : st === 'pending' ? 'Pendente' : 'Offline';
    return '<div class="site-card"><div class="site-left"><span class="dot ' + st + '"></span><div><div class="site-name">' + esc(s.name) + '</div><div class="site-url">' + esc(s.url) + '</div></div></div><div class="site-right"><div class="site-status ' + st + '">' + lbl + '</div><div class="site-time">' + (s.lastCheckedAt ? ago(s.lastCheckedAt) + (s.responseTimeMs != null ? ' · ' + s.responseTimeMs + 'ms' : '') : '') + '</div></div></div>';
  }).join('');

  var tl = document.getElementById('timeline');
  if (data.recentChecks && data.recentChecks.length) {
    tl.innerHTML = data.recentChecks.slice(0, 25).map(function(c) {
      return '<div class="tl-row"><span class="tl-dot ' + c.status + '"></span><span class="tl-status ' + c.status + '">' + c.status + '</span><span class="tl-code">' + (c.statusCode || '') + '</span><span class="tl-url">' + esc(c.url) + '</span><span class="tl-time">' + ago(c.checkedAt) + '</span></div>';
    }).join('');
  } else { tl.innerHTML = '<div class="empty-state">Nenhuma verificação registrada</div>'; }

  var alSection = document.getElementById('alertsSection');
  var alCard = document.getElementById('alertsCard');
  if (data.alerts && data.alerts.length) {
    alSection.style.display = 'block';
    alCard.style.display = 'block';
    alCard.innerHTML = data.alerts.map(function(a) {
      return '<div class="alert-row"><span class="alert-icon">' + (a.type === 'up' ? '🟢' : '🔴') + '</span><span class="alert-text">' + esc(a.message.replace(/[*_]/g,'').split('\\n')[0]) + '</span><span class="alert-time">' + ts(a.sentAt) + '</span></div>';
    }).join('');
  } else {
    alSection.style.display = 'none';
    alCard.style.display = 'none';
  }

  document.getElementById('lastRefresh').textContent = 'Atualizado às ' + ts(new Date().toISOString());
}

async function refresh() {
  try { render(await (await fetch('/api/status')).json()); } catch (_) {}
}
refresh();
setInterval(refresh, 15000);

/* Settings */
var settingsSites = [];
function renderSiteRows() {
  document.getElementById('settingsSites').innerHTML = settingsSites.map(function(s, i) {
    return '<div class="site-row">' +
      '<input id="sName_' + i + '" value="' + esc(s.name) + '" placeholder="Nome" />' +
      '<input id="sUrl_' + i + '" value="' + esc(s.url) + '" placeholder="https://" />' +
      '<button onclick="removeSite(' + i + ')" title="Remover">&times;</button></div>';
  }).join('');
}
function addSiteRow() { settingsSites.push({ name: '', url: '' }); renderSiteRows(); }
function removeSite(i) { settingsSites.splice(i, 1); renderSiteRows(); }

async function openSettings() {
  settingsSites = [];
  try {
    var r = await (await fetch('/api/config')).json();
    document.getElementById('telegramToken').value = r.telegramToken || '';
    document.getElementById('telegramChatId').value = r.telegramChatId || '';
    settingsSites = r.sites && r.sites.length ? r.sites.map(function(s){return{name:s.name,url:s.url}}) : [{name:'',url:''}];
  } catch(_) { settingsSites = [{name:'',url:''}]; }
  renderSiteRows();
  document.getElementById('settingsOverlay').classList.add('open');
}
function closeSettings() { document.getElementById('settingsOverlay').classList.remove('open'); }

async function saveSettings() {
  var sites = settingsSites.map(function(s,i){var e1=document.getElementById('sName_'+i),e2=document.getElementById('sUrl_'+i);return{name:(e1?e1.value:s.name).trim(),url:(e2?e2.value:s.url).trim()}}).filter(function(s){return s.name&&s.url;});
  if (!sites.length) { toast('Adicione ao menos um site.', true); return; }
  var token = document.getElementById('telegramToken').value.trim();
  var chatId = document.getElementById('telegramChatId').value.trim();
  if (!token||!chatId) { toast('Preencha token e chat ID.', true); return; }
  for (var i=0;i<sites.length;i++) { try{new URL(sites[i].url)}catch(_){toast('URL inválida: '+sites[i].url,true); return;} }
  try {
    var res = await fetch('/api/config', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({telegramToken:token,telegramChatId:chatId,sites:sites})
    });
    if (!res.ok) { toast('Erro: '+(await res.text()), true); return; }
    toast('Salvo!'); closeSettings();
  } catch(_) { toast('Erro de conexão.', true); }
}
</script>
</body>
</html>`;

function getApiPayload() {
  const state = loadState();
  const config = loadConfig();
  const recentChecks = getRecentChecks(24);
  const stats = getUptimeStats(24);
  const alerts = getRecentAlerts(48);
  const status = state.wasDown ? 'down' : 'up';

  const latestBySite = new Map<number, CheckResult>();
  for (const c of recentChecks) {
    const prev = latestBySite.get(c.siteId);
    if (!prev || c.checkedAt > prev.checkedAt) latestBySite.set(c.siteId, c);
  }

  const sites = config.sites.map((site, i) => {
    const last = latestBySite.get(i);
    return {
      id: i,
      name: site.name,
      url: site.url,
      status: last?.status ?? 'pending',
      lastCheckedAt: last?.checkedAt ?? null,
      responseTimeMs: last?.responseTimeMs ?? null,
    };
  });

  return {
    status,
    lastCheckedAt: state.lastCheckedAt,
    uptimePercent:
      stats.totalChecks > 0
        ? Number(((stats.upChecks / stats.totalChecks) * 100).toFixed(2))
        : 100,
    totalChecks: stats.totalChecks,
    upChecks: stats.upChecks,
    avgLatency:
      stats.avgResponseTimeMs != null ? Math.round(stats.avgResponseTimeMs) : null,
    alertCount: alerts.length,
    sites,
    recentChecks: recentChecks
      .slice(0, 30)
      .map((c) => ({
        status: c.status,
        statusCode: c.statusCode,
        url: c.url,
        responseTimeMs: c.responseTimeMs,
        error: c.error,
        checkedAt: c.checkedAt,
      })),
    alerts: alerts
      .slice(0, 10)
      .map((a) => ({ type: a.type, message: a.message, sentAt: a.sentAt })),
  };
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function handleApiConfig(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
): void {
  if (req.method === 'GET') {
    const config = loadConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        telegramToken: maskToken(config.telegram.token),
        telegramChatId: config.telegram.chatId,
        sites: config.sites.map((s) => ({ name: s.name, url: s.url })),
      }),
    );
    return;
  }
  if (req.method === 'PUT') {
    readBody(req).then((body) => {
      try {
        const d = JSON.parse(body);
        const config = loadConfig();
        if (d.telegramToken) config.telegram.token = d.telegramToken;
        if (d.telegramChatId) config.telegram.chatId = d.telegramChatId;
        if (Array.isArray(d.sites) && d.sites.length > 0) {
          config.sites = d.sites.map((s: { name: string; url: string }, i: number) => ({
            ...config.sites[i],
            name: s.name,
            url: s.url,
          }));
        }
        saveConfig(config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err instanceof Error ? err.message : String(err));
      }
    });
    return;
  }
  res.writeHead(405);
  res.end();
}

export function startDashboard(): void {
  if (dashboardServer || dashboardStarting) return;
  dashboardStarting = true;

  const server = createServer((req, res) => {
    if (req.url === '/api/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getApiPayload()));
      return;
    }
    if (req.url === '/api/config') {
      handleApiConfig(req, res);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
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
