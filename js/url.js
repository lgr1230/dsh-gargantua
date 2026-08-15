// GARGANTUA — URL parameter interface, automation hooks and screenshot API.
import { PARAMS } from './config.js';

export function getQuery() {
  return new URLSearchParams(location.search);
}

// Merge URL overrides into the loaded state. Returns non-state overrides.
export function applyQueryOverrides(state, q) {
  const overrides = { res: 1, dpr: 0 };
  const quality = q.get('quality');
  if (quality && ['standard', 'high', 'cinematic'].includes(quality)) state.quality = quality;
  const cam = parseInt(q.get('cam'), 10);
  if (cam >= 1 && cam <= 4) state.cam = cam - 1;
  const debug = parseInt(q.get('debug'), 10);
  if (debug >= 0 && debug <= 9) state.debug = debug;
  if (q.get('movie') === '1') state.movie = true;
  if (q.get('movie') === '0') state.movie = false;
  if (q.get('music') === '1') state.music = true;
  if (q.get('music') === '0') state.music = false;
  if (q.get('hud') === '0') state.hud = false;
  if (q.get('hud') === '1') state.hud = true;
  const steps = parseInt(q.get('steps'), 10);
  if (steps >= 96 && steps <= 768) state.params.steps = steps;
  const res = parseFloat(q.get('res'));
  if (res >= 0.25 && res <= 2) overrides.res = res;
  const dpr = parseFloat(q.get('dpr'));
  if (dpr >= 0.5 && dpr <= 2) overrides.dpr = dpr;
  const params = q.get('params');
  if (params) {
    try {
      const obj = JSON.parse(atob(params));
      for (const p of PARAMS) {
        if (typeof obj[p.key] === 'number') {
          state.params[p.key] = Math.min(p.max, Math.max(p.min, obj[p.key]));
        }
      }
    } catch { /* ignore malformed params */ }
  }
  return overrides;
}

// URL screenshot automation: ?shot=1 (download PNG) or ?shot=json (expose
// base64 data URL on window.__GARGANTUA_SHOT__ + console + document.title).
// Returns a frame callback; call it with the frame counter each frame.
export function setupShot(q, getImage) {
  const shot = q.get('shot');
  if (!shot) return null;
  const ms = Math.max(0, parseInt(q.get('shotms'), 10) || 3000);
  const start = performance.now();
  const check = n => {
    if (performance.now() - start < ms || n < 3) return false;
    const url = getImage();
    if (shot === 'json') {
      window.__GARGANTUA_SHOT__ = url;
      console.log('[SHOT] dataURL length=' + url.length);
      document.title = 'SHOT_OK:' + url.length;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gargantua-' + new Date().toISOString().replace(/[:.]/g, '-') + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      console.log('[SHOT] downloaded gargantua.png');
      document.title = 'SHOT_OK:' + url.length;
    }
    return true;
  };
  return check;
}
