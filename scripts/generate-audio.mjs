// GARGANTUA — procedural ambient-music generator (no dependencies).
// Writes audio/ambient.wav: a 66 s seamless-ish space drone
// (brown-noise sub, detuned sine chord, airy wind band, sparse bell).
// Usage: node scripts/generate-audio.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SR = 32000;
const DUR = 66;
const N = SR * DUR;
const out = new Float32Array(N);

const bell = (t, t0) => {
  const dt = t - t0;
  if (dt < 0 || dt > 7) return 0;
  const env = Math.exp(-dt * 0.9) * Math.min(1, dt * 8);
  return env * 0.16 * (
    Math.sin(2 * Math.PI * 220 * dt) * 0.7 +
    Math.sin(2 * Math.PI * 330.5 * dt) * 0.25 +
    Math.sin(2 * Math.PI * 440.8 * dt) * 0.1);
};

let brown = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  brown = (brown + 0.018 * (Math.random() * 2 - 1)) / 1.018;

  // deep chord with slow amplitude breathing + tiny drift
  const freqs = [55.0, 82.41, 110.0, 138.59];
  let pad = 0;
  for (let k = 0; k < freqs.length; k++) {
    const f = freqs[k] + 1.1 * Math.sin(2 * Math.PI * (0.05 + 0.021 * k) * t);
    const amp = 0.14 / (k + 1) * (0.72 + 0.28 * Math.sin(2 * Math.PI * (0.03 + 0.013 * k) * t + k * 1.7));
    pad += amp * Math.sin(2 * Math.PI * f * t);
  }

  // airy wind: band-ish filtered noise via simple resonator
  const wind = 0.05 * Math.sin(2 * Math.PI * (380 + 60 * Math.sin(2 * Math.PI * 0.05 * t)) * t)
    * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.071 * t)) * Math.sin(2 * Math.PI * 0.03 * t);

  let s = brown * 0.55 + pad + wind;
  for (const b of [11.3, 24.1, 37.5, 50.2, 63.0]) s += bell(t, b) * (0.7 + 0.3 * Math.sin(b));
  out[i] = s;
}

// normalize to 0.8 peak
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
const k = 0.8 / peak;
for (let i = 0; i < N; i++) out[i] *= k;

// fade in/out 2 s for looping
for (let i = 0; i < SR * 2; i++) {
  const f = i / (SR * 2);
  out[i] *= f;
  out[N - 1 - i] *= f;
}

// RIFF/WAVE, PCM16 mono
const data = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'audio', 'ambient.wav');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, Buffer.concat([header, data]));
console.log('[audio] wrote ' + file + ' (' + (44 + data.length) + ' bytes, ' + DUR + ' s)');
