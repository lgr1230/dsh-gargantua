// GARGANTUA — HDR pipeline: raytrace RT -> UnrealBloom -> ACES/grain/vignette/CA.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FINAL_FRAG, DEBUG_FRAG, FULLSCREEN_VERT } from './shaders.js';

export class PostFX {
  constructor(renderer, bhScene) {
    this.renderer = renderer;
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(bhScene.scene, bhScene.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.55, 1.05);

    this.finalUniforms = {
      tDiffuse: { value: null },
      uExposure: { value: 0.7 },
      uGrain: { value: 0.16 },
      uVignette: { value: 0.35 },
      uCA: { value: 0.12 },
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
    };
    this.finalPass = new ShaderPass({
      uniforms: this.finalUniforms,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FINAL_FRAG,
    });

    this.debugUniforms = {
      tDiffuse: { value: null },
      uExposure: { value: 1.2 },
      uDebug: { value: 0 },
    };
    this.debugPass = new ShaderPass({
      uniforms: this.debugUniforms,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: DEBUG_FRAG,
    });

    // ShaderPass clones the uniform objects it is given, so rebind our
    // handles to the live copies used by the materials.
    this.finalUniforms = this.finalPass.uniforms;
    this.debugUniforms = this.debugPass.uniforms;

    this.finalPass.enabled = true;
    this.debugPass.enabled = false;

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.finalPass);
    this.composer.addPass(this.debugPass);
  }

  setParams(p) {
    this.finalUniforms.uExposure.value = p.exposure;
    this.finalUniforms.uGrain.value = p.grain;
    this.finalUniforms.uVignette.value = p.vignette;
    this.finalUniforms.uCA.value = p.ca;
    this.bloom.strength = p.bloom;
    this.bloom.threshold = p.bloomThr;
    this.debugUniforms.uExposure.value = p.exposure;
  }

  setDebug(d) {
    const isFinal = d === 0;
    this.bloom.enabled = isFinal;
    this.finalPass.enabled = isFinal;
    this.debugPass.enabled = !isFinal;
    this.debugUniforms.uDebug.value = d;
  }

  setSize(w, h, pr) {
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);   // scales every pass, bloom included
    this.finalUniforms.uRes.value.set(w * pr, h * pr);
  }

  update(time) {
    this.finalUniforms.uTime.value = time;
  }

  render(dt) { this.composer.render(dt); }

  dispose() {
    this.composer.dispose();
    this.bloom.dispose();
    this.finalPass.dispose();
    this.debugPass.dispose();
  }
}
