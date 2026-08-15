// GARGANTUA — fullscreen raytrace scene (quad + ShaderMaterial + uniforms).
import * as THREE from 'three';
import { RAY_FRAG, FULLSCREEN_VERT } from './shaders.js';
import { QUALITIES } from './config.js';

const UNIFORM_MAP = {
  rIn: 'uRIn', rOut: 'uROut', h0: 'uH0', density: 'uDensity', absorb: 'uAbsorb',
  temp: 'uTemp0', turbAmp: 'uTurbAmp', turbSpeed: 'uTurbSpeed', steps: 'uSteps',
  dispersion: 'uDispersion', stars: 'uStarDens', starBright: 'uStarBright',
  galaxy: 'uGalBright', nebula: 'uNebBright',
};

export class BlackHoleScene {
  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uSteps: { value: 400 },
      uDispersion: { value: 0.08 },
      uDispFrac: { value: 0.45 },
      uDebug: { value: 0 },
      uCamPos: { value: new THREE.Vector3(8.5, 0, 0) },
      uCamMatrix: { value: new THREE.Matrix4() },
      uTanFov: { value: 0.577 },
      uAspect: { value: 1.0 },
      uRIn: { value: 3.0 }, uROut: { value: 10.0 }, uH0: { value: 0.28 },
      uDensity: { value: 1.0 }, uAbsorb: { value: 1.0 }, uTemp0: { value: 8000 },
      uTurbAmp: { value: 1.0 }, uTurbSpeed: { value: 0.5 },
      uStarDens: { value: 1.0 }, uStarBright: { value: 1.7 },
      uGalBright: { value: 0.85 }, uNebBright: { value: 0.7 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: RAY_FRAG,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  applyQuality(q) {
    const Q = QUALITIES[q];
    if (!Q) return;
    this.uniforms.uSteps.value = Q.steps;
    this.uniforms.uDispFrac.value = Q.dispFrac;
  }

  setParams(params) {
    for (const [key, val] of Object.entries(params)) this.setParam(key, val);
  }

  setParam(key, val) {
    const name = UNIFORM_MAP[key];
    if (!name || !this.uniforms[name]) return;
    if (key === 'steps') this.uniforms[name].value = Math.round(val);
    else this.uniforms[name].value = val;
  }

  setDebug(d) { this.uniforms.uDebug.value = d; }

  setAspect(a) { this.uniforms.uAspect.value = a; }

  update(camera, time) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uCamPos.value.copy(camera.position);
    u.uCamMatrix.value.copy(camera.matrixWorld);
    u.uTanFov.value = Math.tan((camera.fov * Math.PI / 180) * 0.5);
  }
}
