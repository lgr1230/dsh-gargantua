// GARGANTUA — optional ambient music: prefers audio/ambient.wav, falls back
// to a fully procedural WebAudio drone (no asset required).
export class Ambience {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.nodes = [];
    this.on = false;
    this.audioEl = null;
  }

  async start() {
    if (this.on) return;
    try {
      const res = await fetch('audio/ambient.wav');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        a.loop = true;
        a.volume = 0.55;
        await a.play();
        this.audioEl = a;
        this.on = true;
        return;
      }
    } catch { /* fall back to synth */ }
    this.startSynth();
  }

  startSynth() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx || new AC();
      this.ctx = ctx;
      if (ctx.state === 'suspended') ctx.resume();

      const master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);
      master.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 3.0);
      this.master = master;

      // deep drone chord (A1/E2/A2/C#3) with slow detune drift
      const freqs = [55.0, 82.41, 110.0, 138.59];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.55 / (i + 1);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.03 + i * 0.013;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 0.18;
        lfo.connect(lfoG);
        lfoG.connect(g.gain);
        const det = ctx.createOscillator();
        det.frequency.value = 0.05 + i * 0.021;
        const detG = ctx.createGain();
        detG.gain.value = 1.1;
        det.connect(detG);
        detG.connect(osc.detune);
        osc.connect(g);
        g.connect(master);
        osc.start();
        lfo.start();
        det.start();
        this.nodes.push(osc, g, lfo, lfoG, det, detG);
      });

      // brown-noise sub wash through a lowpass
      const len = ctx.sampleRate * 4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      lp.Q.value = 0.4;
      const ng = ctx.createGain();
      ng.gain.value = 0.10;
      noise.connect(lp); lp.connect(ng); ng.connect(master);
      noise.start();
      this.nodes.push(noise, lp, ng);

      // airy wind band
      const noise2 = ctx.createBufferSource();
      noise2.buffer = buf;
      noise2.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 420;
      bp.Q.value = 0.6;
      const ng2 = ctx.createGain();
      ng2.gain.value = 0.035;
      const lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 0.05;
      const lfoG2 = ctx.createGain();
      lfoG2.gain.value = 0.02;
      lfo2.connect(lfoG2); lfoG2.connect(ng2.gain);
      noise2.connect(bp); bp.connect(ng2); ng2.connect(master);
      noise2.start();
      lfo2.start();
      this.nodes.push(noise2, bp, ng2, lfo2, lfoG2);

      this.on = true;
    } catch { this.on = false; }
  }

  stop() {
    this.on = false;
    try {
      if (this.audioEl) { this.audioEl.pause(); this.audioEl = null; }
      if (this.master && this.ctx) {
        this.master.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.4);
      }
      const ctx = this.ctx;
      setTimeout(() => {
        try {
          for (const n of this.nodes) { try { n.stop?.(); n.disconnect?.(); } catch {} }
          if (this.master) this.master.disconnect();
          this.nodes = [];
          this.master = null;
          if (ctx && ctx.state === 'running') ctx.close();
          this.ctx = null;
        } catch {}
      }, 600);
    } catch {}
  }

  toggle() { if (this.on) this.stop(); else this.start(); }
}
