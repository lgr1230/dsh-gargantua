// GARGANTUA — configuration: parameters, quality presets, cameras, persistence.
export const VERSION = '1.0.0';

// The 21 user-tunable parameters.
export const PARAMS = [
  { key: 'rIn',        group: 'Accretion Disk', label: 'Disk inner radius',  min: 2.2, max: 4.0,  step: 0.05, def: 3.0,   fmt: v => v.toFixed(2) + ' r\u209B' },
  { key: 'rOut',       group: 'Accretion Disk', label: 'Disk outer radius',  min: 6.0, max: 16.0, step: 0.5,  def: 10.0,  fmt: v => v.toFixed(1) + ' r\u209B' },
  { key: 'h0',         group: 'Accretion Disk', label: 'Disk thickness',     min: 0.04,max: 0.6,  step: 0.01, def: 0.28,  fmt: v => v.toFixed(2) + ' r\u209B' },
  { key: 'density',    group: 'Accretion Disk', label: 'Disk density',       min: 0.0, max: 3.0,  step: 0.05, def: 1.0,   fmt: v => v.toFixed(2) + '×' },
  { key: 'absorb',     group: 'Accretion Disk', label: 'Disk absorption',    min: 0.0, max: 2.0,  step: 0.05, def: 1.0,   fmt: v => v.toFixed(2) + '×' },
  { key: 'temp',       group: 'Accretion Disk', label: 'Temperature (inner)',min: 4000,max: 20000,step: 100,  def: 8000,  fmt: v => Math.round(v) + ' K' },
  { key: 'turbAmp',    group: 'Accretion Disk', label: 'Turbulence amount',  min: 0.0, max: 2.0,  step: 0.05, def: 1.0,   fmt: v => v.toFixed(2) + '×' },
  { key: 'turbSpeed',  group: 'Accretion Disk', label: 'Turbulence speed',   min: 0.0, max: 2.0,  step: 0.05, def: 0.5,   fmt: v => v.toFixed(2) + '×' },
  { key: 'steps',      group: 'Raytracer',      label: 'Raymarch steps',     min: 96,  max: 768, step: 8,    def: 400,   fmt: v => String(Math.round(v)) },
  { key: 'dispersion', group: 'Raytracer',      label: 'Chromatic dispersion',min: 0.0,max: 1.0,  step: 0.01, def: 0.08,  fmt: v => v.toFixed(2) },
  { key: 'exposure',   group: 'Optics',         label: 'Exposure',           min: 0.2, max: 6.0,  step: 0.05, def: 0.7,   fmt: v => v.toFixed(2) + ' EV' },
  { key: 'bloom',      group: 'Optics',         label: 'Bloom strength',     min: 0.0, max: 3.0,  step: 0.05, def: 0.8,   fmt: v => v.toFixed(2) },
  { key: 'bloomThr',   group: 'Optics',         label: 'Bloom threshold',    min: 0.0, max: 2.0,  step: 0.05, def: 1.05,  fmt: v => v.toFixed(2) },
  { key: 'grain',      group: 'Optics',         label: 'Film grain',         min: 0.0, max: 1.0,  step: 0.01, def: 0.16,  fmt: v => v.toFixed(2) },
  { key: 'vignette',   group: 'Optics',         label: 'Vignette',           min: 0.0, max: 1.0,  step: 0.01, def: 0.35,  fmt: v => v.toFixed(2) },
  { key: 'ca',         group: 'Optics',         label: 'Chromatic aberration',min: 0.0,max: 1.0,  step: 0.01, def: 0.12,  fmt: v => v.toFixed(2) },
  { key: 'stars',      group: 'Sky',            label: 'Star density',       min: 0.0, max: 2.0,  step: 0.05, def: 1.0,   fmt: v => v.toFixed(2) + '×' },
  { key: 'starBright', group: 'Sky',            label: 'Star brightness',    min: 0.0, max: 3.0,  step: 0.05, def: 1.7,   fmt: v => v.toFixed(2) + '×' },
  { key: 'galaxy',     group: 'Sky',            label: 'Galaxy brightness',  min: 0.0, max: 2.0,  step: 0.05, def: 0.85,  fmt: v => v.toFixed(2) + '×' },
  { key: 'nebula',     group: 'Sky',            label: 'Nebula brightness',  min: 0.0, max: 2.0,  step: 0.05, def: 0.7,   fmt: v => v.toFixed(2) + '×' },
  { key: 'fov',        group: 'Camera',         label: 'Field of view',      min: 35,  max: 100, step: 1,    def: 60,    fmt: v => Math.round(v) + '°' },
];

export const PARAM_DEFAULTS = Object.fromEntries(PARAMS.map(p => [p.key, p.def]));

export const QUALITIES = {
  standard:  { label: 'Standard',  steps: 240, dispFrac: 0.45, pixelRatio: 1.0, res: 1.0 },
  high:      { label: 'High',      steps: 400, dispFrac: 0.55, pixelRatio: 1.5, res: 1.0 },
  cinematic: { label: 'Cinematic', steps: 560, dispFrac: 0.7,  pixelRatio: 2.0, res: 1.0 },
};

// Camera presets (spherical around the black hole at the origin; el in degrees).
export const CAMERAS = [
  { name: 'Interstellar',   r: 8.5, az: 0,   el: -3.5 },
  { name: 'Tilted Flyby',   r: 9.5, az: 35,  el: 22 },
  { name: 'Overhead Pole',  r: 11.0,az: 0,   el: 66 },
  { name: 'Photon Sphere',  r: 4.2, az: 25,  el: 9 },
];

export const DEBUG_NAMES = [
  'Final render', 'Linear HDR (no ACES)', 'Raymarch iterations', 'Radial distance r',
  'Doppler / redshift g³', 'Disk path density', 'Sky only (lensing)', 'Disk only',
  'Photon-ring mask (b ≈ b_crit)', 'Ray directions',
];

export const DEFAULT_STATE = {
  v: 1,
  quality: 'high',
  params: { ...PARAM_DEFAULTS },
  cam: 0,
  debug: 0,
  hud: true,
  movie: true,
  music: false,
};

const LS_KEY = 'gargantua.state.v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const s = JSON.parse(raw);
    const out = structuredClone(DEFAULT_STATE);
    if (s && s.v === 1) {
      if (Object.prototype.hasOwnProperty.call(QUALITIES, s.quality)) out.quality = s.quality;
      if (s.params) for (const [k, v] of Object.entries(s.params)) {
        const p = PARAMS.find(q => q.key === k);
        if (p && typeof v === 'number') out.params[k] = Math.min(p.max, Math.max(p.min, v));
      }
      if (Number.isInteger(s.cam) && s.cam >= 0 && s.cam < CAMERAS.length) out.cam = s.cam;
      if (Number.isInteger(s.debug) && s.debug >= 0 && s.debug <= 9) out.debug = s.debug;
      if (typeof s.hud === 'boolean') out.hud = s.hud;
      if (typeof s.movie === 'boolean') out.movie = s.movie;
      if (typeof s.music === 'boolean') out.music = s.music;
    }
    return out;
  } catch { return structuredClone(DEFAULT_STATE); }
}

let saveTimer = null;
export function saveState(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }, 300);
}
