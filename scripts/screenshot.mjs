// GARGANTUA — headless screenshot + console-error test driver.
//
// Drives Chromium (Chrome or Edge) via the DevTools Protocol using Node's
// built-in WebSocket (Node >= 21). Verifies:
//   1. the page boots and renders frames (waits for the [GARGANTUA_FRAME]
//      console marker),
//   2. zero console errors / uncaught exceptions / failed network requests,
//   3. captures a PNG screenshot for visual acceptance.
//
// Tries GPU rendering first, falls back to SwiftShader (slower, longer timeout).
//
// Usage:
//   node scripts/screenshot.mjs --url "http://127.0.0.1:8123/?quality=standard&steps=120&res=0.5&movie=0&hud=0"
//     --out test/shot.png --w 960 --h 540 [--wait 2500] [--timeout 180000] [--browser edge|chrome]
//
// Exit code 0 = pass (rendered, no console errors), 1 = fail.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};

const url = opt('url', 'http://127.0.0.1:8123/');
const out = opt('out', 'test/shot.png');
const w = parseInt(opt('w', '960'), 10);
const h = parseInt(opt('h', '540'), 10);
const wait = parseInt(opt('wait', '2500'), 10);
const timeout = parseInt(opt('timeout', '180000'), 10);
const browserChoice = opt('browser', 'auto');

const BROWSERS = {
  edge: ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
  chrome: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
};
const browserExe = (BROWSERS[browserChoice] || [...BROWSERS.chrome, ...BROWSERS.edge])
  .find(p => existsSync(p));
if (!browserExe) {
  console.error('[shot] no Chromium browser found');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function launch(userDir, extraFlags) {
  return spawn(browserExe, [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + userDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--enable-unsafe-swiftshader',
    '--window-size=' + w + ',' + h,
    '--hide-scrollbars',
    ...extraFlags,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
}

async function getWsUrl(userDir) {
  for (let i = 0; i < 150; i++) {
    try {
      const portFile = join(userDir, 'DevToolsActivePort');
      if (existsSync(portFile)) {
        const [port] = readFileSync(portFile, 'utf8').split('\n');
        const res = await fetch('http://127.0.0.1:' + port + '/json/version');
        const info = await res.json();
        return info.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(200);
  }
  throw new Error('DevTools did not come up');
}

async function runAttempt(extraFlags, attemptTimeout) {
  const userDir = mkdtempSync(join(tmpdir(), 'gargantua-cdp-'));
  const child = launch(userDir, extraFlags);
  const errors = [];
  let markerFound = false;
  const logs = [];
  let ws = null;

  try {
    const wsUrl = await getWsUrl(userDir);
    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let id = 0;
    const pending = new Map();
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        if (msg.method === 'Runtime.consoleAPICalled') {
          const type = msg.params.type;
          const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
          if (type === 'error' || type === 'assert') errors.push('[console.' + type + '] ' + text);
          else if (text.includes('[GARGANTUA')) {
            logs.push(text.slice(0, 220));
            if (text.includes('[GARGANTUA_FRAME]')) markerFound = true;
          }
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const d = msg.params.exceptionDetails;
          errors.push('[exception] ' + (d.exception?.description || d.text));
        } else if (msg.method === 'Log.entryAdded') {
          const e = msg.params.entry;
          if (e.level === 'error') errors.push('[log.' + e.level + '] ' + (e.url ? e.url + ' — ' : '') + e.text);
        } else if (msg.method === 'Network.loadingFailed') {
          errors.push('[network] ' + (msg.params.errorText || 'failed') + ' ' + msg.params.blockedReason);
        } else if (msg.method === 'Network.responseReceived') {
          const r = msg.params.response;
          if (r.status >= 400) errors.push('[http ' + r.status + '] ' + r.url);
        }
      }
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });

    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    await send('Log.enable', {}, sessionId);
    await send('Network.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }, sessionId);

    console.log('[shot] navigating: ' + url);
    await send('Page.navigate', { url }, sessionId);

    const deadline = Date.now() + attemptTimeout;
    while (!markerFound && Date.now() < deadline) await sleep(250);

    let shotData = null;
    if (markerFound) {
      await sleep(wait);
      const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      shotData = shot.data;
    }
    const titleRes = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, sessionId);
    const apiRes = await send('Runtime.evaluate',
      { expression: 'typeof window.GARGANTUA', returnByValue: true }, sessionId);

    return { markerFound, errors, logs, shotData, title: titleRes.result.value, api: apiRes.result.value };
  } finally {
    try { ws?.close(); } catch {}
    child.kill();
    await sleep(400);
    try { rmSync(userDir, { recursive: true, force: true, maxRetries: 3 }); } catch {}
  }
}

async function main() {
  console.log('[shot] attempt 1: GPU');
  let r = await runAttempt(['--enable-gpu'], timeout);
  if (!r.markerFound) {
    console.log('[shot] attempt 2: SwiftShader (longer timeout)');
    r = await runAttempt(['--use-angle=swiftshader'], Math.max(timeout, 300000));
  }

  console.log('[shot] title: ' + r.title + ' · window.GARGANTUA: ' + r.api);
  for (const l of r.logs) console.log('  ' + l);

  if (r.markerFound && r.shotData) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(r.shotData, 'base64'));
    console.log('[shot] saved ' + out + ' (' + r.shotData.length + ' b64)');
  } else {
    console.error('[shot] FAIL: no render marker (page stuck at loading overlay)');
  }

  const realErrors = r.errors.filter(t => !/favicon/i.test(t));
  if (realErrors.length) {
    console.error('[shot] console/network errors (' + realErrors.length + '):');
    for (const e of realErrors) console.error('  ' + e);
  }

  const pass = r.markerFound && realErrors.length === 0 && r.shotData && r.shotData.length > 5000;
  console.log(pass ? '[shot] PASS' : '[shot] FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  console.error('[shot] driver error: ' + err.message);
  process.exit(1);
});
