// GARGANTUA — camera rig: OrbitControls + cinematic movie loop + presets.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERAS } from './config.js';

const DEG = Math.PI / 180;

export class CameraRig {
  constructor(canvas) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 18;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.55;

    this.presetIndex = 0;
    this.sph = this.sphericalFromPreset(0);
    this.base = { ...this.sph, az: this.sph.az };
    this.movie = true;
    this.tween = null;
    this.time = 0;
    this.paused = false;

    canvas.addEventListener('pointerdown', () => this.setMovie(false), { passive: true });
    canvas.addEventListener('wheel', () => this.setMovie(false), { passive: true });
  }

  sphericalFromPreset(i) {
    const p = CAMERAS[i];
    return { r: p.r, az: p.az * DEG, el: p.el * DEG };
  }

  applyPreset(i, animate = true) {
    this.presetIndex = i;
    const target = this.sphericalFromPreset(i);
    if (!animate) {
      this.sph = { ...target };
      this.base = { ...target };
      this.applySpherical();
      return;
    }
    // smooth spherical tween over ~1.6 s
    const from = { ...this.sph };
    const start = performance.now();
    const dur = 1600;
    const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    this.tween = { from, target, start, dur, ease };
    if (!this.movie) this.syncSpherical();
  }

  applySpherical() {
    const { r, az, el } = this.sph;
    const ce = Math.cos(el);
    this.camera.position.set(r * ce * Math.cos(az), r * Math.sin(el), r * ce * Math.sin(az));
    this.camera.lookAt(0, 0, 0);
  }

  setMovie(m) {
    this.movie = m;
    this.controls.enabled = !m;
    if (!m) {
      // keep the current viewpoint as the manual starting point
      const s = this.sphFromCamera();
      this.sph = s;
      this.base = { ...s, az: s.az };
      this.camera.updateMatrixWorld();
    }
  }

  sphFromCamera() {
    const p = this.camera.position;
    const r = Math.max(p.length(), 3.5);
    return {
      r,
      az: Math.atan2(p.z, p.x),
      el: Math.asin(THREE.MathUtils.clamp(p.y / r, -1, 1)),
    };
  }

  setFov(f) {
    this.camera.fov = f;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (this.tween) {
      const t = (performance.now() - this.tween.start) / this.tween.dur;
      if (t >= 1) {
        this.sph = { ...this.tween.target };
        this.base = { ...this.tween.target };
        this.tween = null;
        this.applySpherical();
      } else {
        const e = this.tween.ease(t);
        this.sph = {
          r: this.tween.from.r + (this.tween.target.r - this.tween.from.r) * e,
          az: this.tween.from.az + (this.tween.target.az - this.tween.from.az) * e,
          el: this.tween.from.el + (this.tween.target.el - this.tween.from.el) * e,
        };
        this.base = { ...this.sph };
        this.applySpherical();
      }
    }
    if (this.movie) {
      this.time += dt;
      const s = this.base;
      this.sph.az = s.az + this.time * 0.02;
      this.sph.el = s.el + Math.sin(this.time * 0.071) * 2.2 * DEG;
      this.sph.r = s.r + Math.sin(this.time * 0.049 + 1.7) * 0.4;
      this.applySpherical();
    } else {
      this.controls.update();
      this.sph = this.sphFromCamera();
    }
    this.camera.updateMatrixWorld();
  }

  dispose() { this.controls.dispose(); }
}
