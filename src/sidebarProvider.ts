import * as vscode from 'vscode';
import { parseUsage, UsageStats } from './usageParser';

type Mood = 'happy' | 'neutral' | 'stressed';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'claudeUsageTracker.sidebar';

  private _view?: vscode.WebviewView;
  private _lastStats: UsageStats | null = null;
  private _lastParsedAt = 0;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    this._update();

    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg.command === 'refresh') { this._forceUpdate(); }
    });

    const timer = setInterval(() => this._update(), 30_000);
    webviewView.onDidDispose(() => clearInterval(timer));
  }

  private _getStats(): UsageStats {
    if (this._lastStats && Date.now() - this._lastParsedAt < 75_000) {
      return this._lastStats;
    }
    this._lastStats = parseUsage();
    this._lastParsedAt = Date.now();
    return this._lastStats;
  }

  private _forceUpdate() {
    this._lastParsedAt = 0;
    this._update();
  }

  private _update() {
    if (!this._view) { return; }
    const budget = vscode.workspace
      .getConfiguration('claude-usage-tracker')
      .get<number>('dailyBudget', 100);
    this._view.webview.html = getHtml(this._getStats(), budget);
  }
}

function getMood(pct: number): Mood {
  if (pct < 33) { return 'happy'; }
  if (pct <= 66) { return 'neutral'; }
  return 'stressed';
}

function getHtml(stats: UsageStats, budget: number): string {
  const todayTotal = stats.today.messages + stats.today.toolCalls;
  const pct = Math.min(100, Math.round((todayTotal / budget) * 100));
  const mood = getMood(pct);

  const barColor = mood === 'happy' ? '#4ec9b0' : mood === 'neutral' ? '#dcdcaa' : '#f44747';
  const sweatDrop = mood === 'stressed' ? '<div class="sweat">💧</div>' : '';

  const maxVal = Math.max(...stats.last7Days.map(d => d.messages + d.toolCalls), 1);
  const chartBars = stats.last7Days.map(d => {
    const val = d.messages + d.toolCalls;
    const h = Math.round((val / maxVal) * 56);
    const label = d.date.slice(5);
    return `<div class="bar-col">
      <div class="bar-tip">${val > 0 ? val : ''}</div>
      <div class="bar-fill" style="height:${Math.max(h, 2)}px"></div>
      <div class="bar-label">${label}</div>
    </div>`;
  }).join('');

return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 14px 12px;
    font-size: 12px;
  }
  .icon-wrap {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    height: 62px;
    margin-bottom: 12px;
    position: relative;
  }
  .sweat {
    position: absolute;
    top: 4px;
    left: calc(50% + 16px);
    font-size: 14px;
    animation: drip 0.9s ease-in-out infinite;
  }
  @keyframes drip {
    0%, 100% { transform: translateY(0); opacity: 1; }
    50% { transform: translateY(5px); opacity: 0.5; }
  }
  .happy  { animation: bounce 0.55s ease-in-out infinite alternate; transform-origin: bottom center; }
  .neutral { animation: sway 1.5s ease-in-out infinite alternate; transform-origin: bottom center; }
  .stressed { animation: shake 0.1s linear infinite; }
  @keyframes bounce {
    from { transform: translateY(0) scale(1); }
    to   { transform: translateY(-8px) scale(1.04); }
  }
  @keyframes sway {
    from { transform: rotate(-6deg); }
    to   { transform: rotate(6deg); }
  }
  @keyframes shake {
    0%   { transform: translateX(0); }
    25%  { transform: translateX(-3px); }
    75%  { transform: translateX(3px); }
    100% { transform: translateX(0); }
  }
  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.5;
    margin-bottom: 5px;
  }
  .progress-row {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 14px;
  }
  .progress-track {
    flex: 1;
    height: 7px;
    border-radius: 4px;
    background: var(--vscode-editor-background);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.5s ease, background 0.5s ease;
  }
  .progress-pct {
    font-size: 11px;
    min-width: 32px;
    text-align: right;
    opacity: 0.75;
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 16px;
  }
  .stat-box {
    background: var(--vscode-editor-background);
    border-radius: 6px;
    padding: 7px 4px 5px;
    text-align: center;
  }
  .stat-val {
    font-size: 17px;
    font-weight: 600;
    line-height: 1.1;
  }
  .stat-name {
    font-size: 9px;
    opacity: 0.5;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 3px;
  }
  .chart-wrap { margin-bottom: 16px; }
  .bar-row {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 72px;
  }
  .bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    flex: 1;
    height: 100%;
  }
  .bar-tip {
    font-size: 8px;
    opacity: 0.45;
    margin-bottom: 2px;
    min-height: 10px;
  }
  .bar-fill {
    width: 100%;
    background: var(--vscode-charts-blue, #569cd6);
    border-radius: 3px 3px 0 0;
    min-height: 2px;
  }
  .bar-label {
    font-size: 8px;
    opacity: 0.45;
    margin-top: 3px;
    white-space: nowrap;
  }
  .alltime {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    opacity: 0.6;
  }
  .alltime strong { opacity: 1; font-weight: 600; }
  .refresh-btn {
    display: block;
    width: 100%;
    margin-top: 14px;
    padding: 5px 0;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    opacity: 0.75;
  }
  .refresh-btn:hover { opacity: 1; }
</style>
</head>
<body>

<div class="icon-wrap">
  ${sweatDrop}
  <svg class="${mood}" width="64" height="64" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
    <!-- ears -->
    <rect x="3" y="3" width="4" height="4" fill="#d97757"/>
    <rect x="17" y="3" width="4" height="4" fill="#d97757"/>
    <!-- body -->
    <rect x="3" y="7" width="18" height="11" fill="#d97757"/>
    <!-- eyes: open when happy/neutral, X-shaped when stressed -->
    ${mood !== 'stressed' ? `
    <rect x="7"  y="10" width="3" height="3" fill="#1e1e1e"/>
    <rect x="14" y="10" width="3" height="3" fill="#1e1e1e"/>
    ` : `
    <rect x="7"  y="10" width="1" height="3" fill="#1e1e1e"/>
    <rect x="9"  y="10" width="1" height="3" fill="#1e1e1e"/>
    <rect x="8"  y="11" width="1" height="1" fill="#fff"/>
    <rect x="14" y="10" width="1" height="3" fill="#1e1e1e"/>
    <rect x="16" y="10" width="1" height="3" fill="#1e1e1e"/>
    <rect x="15" y="11" width="1" height="1" fill="#fff"/>
    `}
    <!-- legs -->
    <rect x="5"  y="18" width="4" height="4" fill="#d97757"/>
    <rect x="15" y="18" width="4" height="4" fill="#d97757"/>
  </svg>
</div>

<div class="section-label">Last 24h · ${todayTotal} / ${budget}</div>
<div class="progress-row">
  <div class="progress-track">
    <div class="progress-fill" style="width:${pct}%; background:${barColor}"></div>
  </div>
  <div class="progress-pct">${pct}%</div>
</div>

<div class="stats-grid">
  <div class="stat-box">
    <div class="stat-val">${stats.today.messages}</div>
    <div class="stat-name">msgs</div>
  </div>
  <div class="stat-box">
    <div class="stat-val">${stats.today.toolCalls}</div>
    <div class="stat-name">tools</div>
  </div>
  <div class="stat-box">
    <div class="stat-val">${stats.today.sessions}</div>
    <div class="stat-name">sessions</div>
  </div>
</div>

<div class="section-label">Last 7 days</div>
<div class="chart-wrap">
  <div class="bar-row">${chartBars}</div>
</div>

<div class="section-label">All time</div>
<div class="alltime">
  <div><strong>${stats.allTime.messages}</strong> msgs</div>
  <div><strong>${stats.allTime.toolCalls}</strong> tools</div>
  <div><strong>${stats.allTime.sessions}</strong> sessions</div>
</div>


<button class="refresh-btn" onclick="refresh()">↻ Refresh</button>

<script>
  const vscodeApi = acquireVsCodeApi();
  function refresh() { vscodeApi.postMessage({ command: 'refresh' }); }
</script>
</body>
</html>`;
}
