// GARGANTUA — bootstrap, state wiring, loop, error recovery, WebGL context
// loss handling, URL automation and the window.GARGANTUA public API.
import * as THREE from 'three';
import { VERSION, loadState, saveState, QUALITIES, PARAMS, PARAM_DEFAULTS } from './config.js';
import { BlackHoleScene } from './blackhole.js';
import { PostFX } from './post.js';
import { CameraRig } from './camera.js';
import { Hud } from './hud.js';
import { Ambience } from './audio.js';
import { getQuery, applyQueryOverrides, setupShot } from './url.js';

let renderer = null, bh = null, post = null, rig = null, hud = null, ambience = null;
let state = null;
let simTime = 0;
let frames = 0, fps = 0, fpsAcc = 0, fpsT = 0, lastMs = 0;
let paused = false;
let shotCheck = null;
let started = false;
let autoLow = false;

const q = getQuery();

function isMobile() {
  return (('ontouchstart' in window) && window.innerWidth < 900) ||
    /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

function lowGpu(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch { return false; }
}

function overlay(el, show, html) {
  el.classList.toggle('hidden', !show);
  if (html !== undefined) el.innerHTML = html;
  return el;
}

function fail(title, detail) {
  console.error('[GARGANTUA] ' + title + '\n' + detail);
  const err = document.getElementById('overlay-error');
  overlay(err, true,
    '<div class="err-box"><h1>GARGANTUA — renderer failure</h1>' +
    '<p class="err-title">' + title + '</p>' +
    '<pre>' + String(detail).replace(/</g, '&lt;') + '</pre>' +
    '<button id="btn-retry">RETRY</button></div>');
  document.getElementById('btn-retry').addEventListener('click', () => location.reload());
}

function computePixelRatio(overrides) {
  const Q = QUALITIES[state.quality];
  let pr = Math.min(window.devicePixelRatio || 1, Q.pixelRatio);
  pr *= overrides.res;
  if (overrides.dpr) pr = overrides.dpr * overrides.res;
  if (autoLow) pr *= 0.75;
  if (isMobile()) pr = Math.min(pr, 1.25);
  return Math.max(0.4, pr);
}

function applyQuality(name, keepSteps) {
  state.quality = name;
  bh.applyQuality(name);
  if (keepSteps) {
    bh.setParam('steps', state.params.steps);
  } else {
    state.params.steps = QUALITIES[name].steps;
    bh.setParam('steps', state.params.steps);
    if (hud) hud.setParamValue('steps', state.params.steps);
  }
  resize();
  if (hud) hud.setBadges(getBadges());
  saveState(state);
}

function getBadges() {
  return { quality: state.quality, cam: state.cam, debug: state.debug, movie: rig.movie, paused, music: ambience.on };
}

function setDebug(d) {
  state.debug = d;
  bh.setDebug(d);
  post.setDebug(d);
  if (hud) hud.setBadges(getBadges());
  saveState(state);
}

function onParam(key, val) {
  state.params[key] = val;
  bh.setParam(key, val);
  post.setParams(state.params);
  if (key === 'fov') rig.setFov(val);
  saveState(state);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const pr = computePixelRatio(overridesCache);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h);
  post.setSize(w, h, pr);
  rig.camera.aspect = w / h;
  rig.camera.updateProjectionMatrix();
  bh.setAspect(w / h);
}

let overridesCache = { res: 1, dpr: 0 };
let lastFrameAt = 0;
let renderErrLogged = false;
let benchAcc = 0;

function loop() {
  requestAnimationFrame(loop);
  const now0 = performance.now();
  const dt = Math.min((now0 - lastFrameAt) / 1000, 0.1);
  lastFrameAt = now0;
  if (!paused) simTime += dt;
  rig.update(paused ? 0 : dt);
  bh.update(rig.camera, simTime);
  post.update(simTime);
  try {
    post.render(dt);
  } catch (err) {
    if (!renderErrLogged) {
      renderErrLogged = true;
      console.error('[GARGANTUA_FRAME_ERR] ' + (err && err.stack ? err.stack : err));
    }
    return;
  }

  frames++;
  fpsAcc++;
  const now = performance.now();
  if (now - fpsT > 500) {
    fps = Math.round(fpsAcc * 1000 / (now - fpsT));
    fpsAcc = 0; fpsT = now;
    if (hud) hud.setStats(fps, lastMs);
  }
  lastMs = Math.round(performance.now() - now);

  if (!started && frames >= 2) {
    started = true;
    const gl = renderer.getContext();
    const info = gl.getParameter(gl.VERSION) + ' / ' + (gl.getParameter(gl.RENDERER) || '');
    console.log('[GARGANTUA_FRAME] ok version=' + VERSION + ' gl=' + info);
    overlay(document.getElementById('overlay-loading'), false);
  }
  if (frames === 60) {
    console.log('[GARGANTUA_BENCH] avgFrameMs=' + (benchAcc / 60).toFixed(1) +
      ' steps=' + state.params.steps + ' quality=' + state.quality +
      ' res=' + computePixelRatio(overridesCache).toFixed(2));
  }
  if (frames < 60) benchAcc += (now0 - lastFrameAt);
  if (shotCheck) shotCheck(frames);
}

async function init() {
  try {
    console.log('[GARGANTUA_BOOT] init start');
    state = loadState();
    overridesCache = applyQueryOverrides(state, q);
    console.log('[GARGANTUA_BOOT] state loaded quality=' + state.quality +
      ' steps=' + state.params.steps + ' cam=' + state.cam + ' debug=' + state.debug);

    const canvas = document.getElementById('gl');
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !!(q.get('shot') || q.get('title')),
    });
    console.log('[GARGANTUA_BOOT] renderer created');
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    autoLow = lowGpu(renderer);
    if (autoLow && !q.get('quality')) state.quality = 'standard';

    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      console.warn('[GARGANTUA] WebGL context lost — attempting recovery');
      overlay(document.getElementById('overlay-loading'), true,
        '<div class="loading-text">GPU CONTEXT LOST — RECOVERING…</div>');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      console.warn('[GARGANTUA] WebGL context restored — reinitializing');
      rebuildAfterRestore();
    });

    bh = new BlackHoleScene();
    post = new PostFX(renderer, bh);
    rig = new CameraRig(canvas);
    ambience = new Ambience();

    hud = new Hud(document.getElementById('hud'), {
      onParam,
      onQuality: name => applyQuality(name),
      onCam: i => { state.cam = i; rig.applyPreset(i); if (hud) hud.setBadges(getBadges()); saveState(state); },
      onDebug: setDebug,
      onMovieToggle: () => {
        rig.setMovie(!rig.movie);
        state.movie = rig.movie;
        if (hud) hud.setBadges(getBadges());
        saveState(state);
      },
      onMusicToggle: () => {
        if (ambience.on) { ambience.stop(); state.music = false; }
        else { ambience.start().catch(() => {}); state.music = true; }
        if (hud) hud.setBadges(getBadges());
        saveState(state);
      },
      onReset: () => {
        state.params = { ...PARAM_DEFAULTS };
        bh.setParams(state.params);
        post.setParams(state.params);
        rig.setFov(state.params.fov);
        for (const p of PARAMS) hud.setParamValue(p.key, p.def);
        applyQuality(state.quality, true);
        saveState(state);
      },
      onHudToggle: () => {
        state.hud = !hud.visible;
        hud.setVisible(state.hud);
        saveState(state);
      },
      onFullscreen: () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
      },
      onPause: () => {
        paused = !paused;
        if (hud) hud.setBadges(getBadges());
      },
      onHelpToggle: () => hud.setHelp(hud.help.classList.contains('hidden')),
      onHelpClose: () => hud.setHelp(false),
    });

    // apply persisted state
    bh.setParams(state.params);
    post.setParams(state.params);
    bh.applyQuality(state.quality);
    bh.setParam('steps', state.params.steps);   // keep URL/persisted step count
    rig.setFov(state.params.fov);
    rig.applyPreset(state.cam, false);
    setDebug(state.debug);
    rig.setMovie(state.movie);
    hud.setVisible(state.hud);
    hud.setBadges(getBadges());
    hud.setParamValue('steps', state.params.steps);

    window.addEventListener('resize', resize);
    window.addEventListener('keydown', e => { if (hud.handleKey(e)) e.preventDefault(); });
    resize();

    if (state.music) { ambience.start().catch(() => { state.music = false; }); }

    shotCheck = setupShot(q, () => renderer.domElement.toDataURL('image/png'));
    installApi();
    console.log('[GARGANTUA_BOOT] ready, entering render loop');
    loop();
  } catch (err) {
    fail('Initialization failed', err && err.stack ? err.stack : String(err));
    throw err;
  }
}

function rebuildAfterRestore() {
  try {
    if (post) { post.dispose(); post = null; }
    if (renderer) { renderer.dispose(); renderer = null; }
    const canvas = document.getElementById('gl');
    renderer = new THREE.WebGLRenderer({
      canvas,
      context: canvas.getContext('webgl2'),
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    bh = new BlackHoleScene();
    post = new PostFX(renderer, bh);
    bh.setParams(state.params);
    post.setParams(state.params);
    bh.applyQuality(state.quality);
    setDebug(state.debug);
    resize();
    overlay(document.getElementById('overlay-loading'), false);
    console.log('[GARGANTUA] renderer rebuilt after context restore');
  } catch (err) {
    console.error('[GARGANTUA] rebuild failed, reloading', err);
    location.reload();
  }
}

function installApi() {
  window.GARGANTUA = {
    version: VERSION,
    setParam: (k, v) => { onParam(k, v); if (hud) hud.setParamValue(k, v); },
    getParams: () => ({ ...state.params }),
    setQuality: applyQuality,
    setCamera: i => { state.cam = i; rig.applyPreset(i); if (hud) hud.setBadges(getBadges()); },
    setDebug,
    setMovie: m => { rig.setMovie(m); state.movie = m; },
    capture: () => renderer.domElement.toDataURL('image/png'),
    getState: () => ({ ...state, params: { ...state.params } }),
    quality: () => state.quality,
    debug: () => state.debug,
  };
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(() => {});
});
