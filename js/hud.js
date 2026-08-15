// GARGANTUA — HUD: stats, 21-parameter panel, quality/camera/debug controls,
// help overlay and all keyboard shortcuts.
import { PARAMS, QUALITIES, CAMERAS, DEBUG_NAMES } from './config.js';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

export class Hud {
  constructor(root, cbs) {
    this.root = root;
    this.cbs = cbs;
    this.root.innerHTML = '';
    this.visible = true;
    this.build();
  }

  build() {
    // ---- brand / stats -----------------------------------------------------
    const brand = el('div', 'hud-brand');
    brand.appendChild(el('div', 'hud-title', 'GARGANTUA'));
    brand.appendChild(el('div', 'hud-subtitle', 'SCHWARZSCHILD NULL-GEODESIC RAYTRACER'));
    this.stats = el('div', 'hud-stats');
    brand.appendChild(this.stats);
    this.badges = el('div', 'hud-badges');
    brand.appendChild(this.badges);
    this.root.appendChild(brand);

    // ---- control panel -----------------------------------------------------
    const panel = el('div', 'hud-panel');
    panel.appendChild(el('div', 'hud-panel-title', 'CONTROLS'));

    const qualRow = el('div', 'hud-row hud-buttons');
    for (const [qk, q] of Object.entries(QUALITIES)) {
      const b = el('button', 'hud-btn', q.label);
      b.dataset.quality = qk;
      b.addEventListener('click', () => this.cbs.onQuality(qk));
      qualRow.appendChild(b);
    }
    panel.appendChild(qualRow);

    const camRow = el('div', 'hud-row hud-buttons');
    CAMERAS.forEach((c, i) => {
      const b = el('button', 'hud-btn', String(i + 1) + '·' + c.name);
      b.dataset.cam = i;
      b.addEventListener('click', () => this.cbs.onCam(i));
      camRow.appendChild(b);
    });
    panel.appendChild(camRow);

    const dbgRow = el('div', 'hud-row');
    const sel = el('select', 'hud-select');
    DEBUG_NAMES.forEach((name, i) => {
      const o = el('option', null, i + ' — ' + name);
      o.value = i;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => this.cbs.onDebug(parseInt(sel.value, 10)));
    dbgRow.appendChild(sel);
    panel.appendChild(dbgRow);
    this.debugSelect = sel;

    const groups = new Map();
    for (const p of PARAMS) {
      if (!groups.has(p.group)) groups.set(p.group, []);
      groups.get(p.group).push(p);
    }
    this.sliders = new Map();
    for (const [group, ps] of groups) {
      const det = el('details', 'hud-group');
      det.open = true;
      const sum = el('summary', null, group);
      det.appendChild(sum);
      for (const p of ps) {
        const row = el('div', 'hud-slider-row');
        const lab = el('label', 'hud-slider-label', p.label);
        const val = el('span', 'hud-slider-value', p.fmt(p.def));
        const input = el('input', 'hud-slider');
        input.type = 'range';
        input.min = p.min; input.max = p.max; input.step = p.step;
        input.value = p.def;
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          val.textContent = p.fmt(v);
          this.cbs.onParam(p.key, v);
        });
        row.appendChild(lab); row.appendChild(input); row.appendChild(val);
        det.appendChild(row);
        this.sliders.set(p.key, { input, val, fmt: p.fmt });
      }
      panel.appendChild(det);
    }

    const actRow = el('div', 'hud-row hud-buttons');
    const movieBtn = el('button', 'hud-btn', 'Movie: ON');
    movieBtn.addEventListener('click', () => this.cbs.onMovieToggle());
    this.movieBtn = movieBtn;
    const musicBtn = el('button', 'hud-btn', 'Music: OFF');
    musicBtn.addEventListener('click', () => this.cbs.onMusicToggle());
    this.musicBtn = musicBtn;
    const resetBtn = el('button', 'hud-btn', 'Reset (R)');
    resetBtn.addEventListener('click', () => this.cbs.onReset());
    actRow.appendChild(movieBtn); actRow.appendChild(musicBtn); actRow.appendChild(resetBtn);
    panel.appendChild(actRow);
    this.root.appendChild(panel);

    // ---- hint bar -----------------------------------------------------------
    this.hints = el('div', 'hud-hints',
      '1-4 cameras · 0-9 debug views · Q/W/E quality · SPACE movie · M music · ' +
      'H HUD · F fullscreen · P pause · R reset · ? help · drag to orbit · wheel to zoom');
    this.root.appendChild(this.hints);

    // ---- help overlay -------------------------------------------------------
    const help = el('div', 'hud-help hidden');
    const rows = [
      ['1–4', 'camera presets (Interstellar / Tilted / Pole / Photon sphere)'],
      ['0–9', 'debug views (0 final, 1 linear HDR, 2 iterations, 3 radius, 4 redshift, 5 density, 6 sky, 7 disk, 8 ring mask, 9 ray dirs)'],
      ['Q / W / E', 'quality: Standard / High / Cinematic'],
      ['SPACE', 'toggle cinematic camera loop (exits on drag/zoom)'],
      ['M', 'ambient music on/off'],
      ['H', 'toggle HUD'],
      ['F', 'fullscreen'],
      ['P', 'pause time'],
      ['R', 'reset all 21 parameters'],
      ['?', 'this help'],
      ['drag / wheel / pinch', 'orbit & zoom (OrbitControls)'],
    ];
    const table = el('div', 'hud-help-table');
    for (const [k, v] of rows) {
      const row = el('div', 'hud-help-row');
      row.appendChild(el('kbd', null, k));
      row.appendChild(el('span', null, v));
      table.appendChild(row);
    }
    help.appendChild(el('div', 'hud-help-title', 'KEYBOARD & CONTROLS'));
    help.appendChild(table);
    help.appendChild(el('div', 'hud-help-close', 'press ? or click to close'));
    help.addEventListener('click', () => this.cbs.onHelpToggle());
    this.help = help;
    this.root.appendChild(help);
  }

  handleKey(e) {
    const k = e.key;
    if (k >= '0' && k <= '9') {
      this.cbs.onDebug(parseInt(k, 10));
      return true;
    }
    if (k >= '1' && k <= '4') {
      this.cbs.onCam(parseInt(k, 10) - 1);
      return true;
    }
    switch (k.toLowerCase()) {
      case 'q': this.cbs.onQuality('standard'); return true;
      case 'w': this.cbs.onQuality('high'); return true;
      case 'e': this.cbs.onQuality('cinematic'); return true;
      case 'm': this.cbs.onMusicToggle(); return true;
      case 'h': this.cbs.onHudToggle(); return true;
      case 'f': this.cbs.onFullscreen(); return true;
      case 'p': this.cbs.onPause(); return true;
      case 'r': this.cbs.onReset(); return true;
      case '?':
      case '/': this.cbs.onHelpToggle(); return true;
      case ' ': this.cbs.onMovieToggle(); return true;
      case 'escape': this.cbs.onHelpClose(); return true;
      default: return false;
    }
  }

  setBadges(s) {
    const bits = [
      ['QUALITY', QUALITIES[s.quality].label],
      ['CAM', CAMERAS[s.cam].name],
      ['VIEW', DEBUG_NAMES[s.debug]],
      ['MOVIE', s.movie ? 'ON' : 'OFF'],
      ['PAUSED', s.paused ? 'YES' : 'NO'],
    ];
    this.badges.innerHTML = '';
    for (const [k, v] of bits) {
      const b = el('span', 'hud-badge');
      b.appendChild(el('b', null, k + ' '));
      b.appendChild(document.createTextNode(v));
      this.badges.appendChild(b);
    }
    this.movieBtn.textContent = 'Movie: ' + (s.movie ? 'ON' : 'OFF');
    this.musicBtn.textContent = 'Music: ' + (s.music ? 'ON' : 'OFF');
    this.debugSelect.value = String(s.debug);
  }

  setStats(fps, ms) {
    this.stats.textContent = fps + ' fps · ' + ms + ' ms';
  }

  setParamValue(key, val) {
    const s = this.sliders.get(key);
    if (!s) return;
    s.input.value = val;
    s.val.textContent = s.fmt(val);
  }

  setVisible(v) {
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
  }

  setHelp(v) { this.help.classList.toggle('hidden', !v); }
}
