// GARGANTUA — all GLSL sources. Written GLSL1-style; three.js auto-converts for WebGL2.

export const FULLSCREEN_VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Core raytracer: real-time integration of Schwarzschild null geodesics.
//
// Units: r_s = 1 (Schwarzschild radius), G = M = c = 1.
// Orbital-plane reduction: u = 1/r, u'' = -u + 1.5 u^2 (+ tiny plasma-style
// chromatic term), integrated with RK4. Every ray is a true null geodesic:
// event horizon, photon sphere, Einstein ring and multi-crossing disk images
// all emerge from the ODE itself — nothing is faked with spheres or rings.
// ---------------------------------------------------------------------------
export const RAY_FRAG = /* glsl */`
precision highp float;

const float RS       = 1.0;
const float B_CRIT   = 2.5980762;            // 1.5 * sqrt(3)  (photon-ring impact parameter)
const float U_CAP    = 0.9995;               // u at the horizon
const float R_ESC    = 30.0;                 // escape radius
const float R_ESC2   = 26.0;                 // radial-ray escape radius
const float PHI_MAX  = 16.0;                 // total azimuthal integration budget
const int   MAX_STEPS= 1024;
const float EMIS     = 0.22;                 // disk emission scale

uniform float uTime;
uniform int   uSteps;
uniform float uDispersion;
uniform float uDispFrac;
uniform int   uDebug;
uniform vec3  uCamPos;
uniform mat4  uCamMatrix;
uniform float uTanFov;
uniform float uAspect;
uniform float uRIn, uROut, uH0, uDensity, uAbsorb, uTemp0, uTurbAmp, uTurbSpeed;
uniform float uStarDens, uStarBright, uGalBright, uNebBright;

varying vec2 vUv;

// ---------------------------------------------------------------- noise ----
float hash13(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec3 hash3(vec3 p) {
  return vec3(hash13(p), hash13(p + vec3(11.7, 5.1, 3.9)), hash13(p + vec3(1.3, 7.7, 9.1)));
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1, 0, 0));
  float n010 = hash13(i + vec3(0, 1, 0));
  float n110 = hash13(i + vec3(1, 1, 0));
  float n001 = hash13(i + vec3(0, 0, 1));
  float n101 = hash13(i + vec3(1, 0, 1));
  float n011 = hash13(i + vec3(0, 1, 1));
  float n111 = hash13(i + vec3(1, 1, 1));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}
float fbm4(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise3(p);
    p = p * 2.03 + vec3(11.7, 5.3, 3.1) * float(i + 1);
    a *= 0.5;
  }
  return s / 0.9375;
}
float fbm3(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise3(p);
    p = p * 2.13 + vec3(3.7, 9.1, 6.3) * float(i + 1);
    a *= 0.5;
  }
  return s / 0.875;
}
vec3 palette(float x) {
  x = clamp(x, 0.0, 1.0);
  return 0.5 + 0.5 * cos(6.28318 * (x + vec3(0.0, 0.33, 0.67)));
}
vec3 heat(float x) {
  x = clamp(x, 0.0, 1.0);
  vec3 c = mix(vec3(0.02, 0.02, 0.25), vec3(0.95, 0.28, 0.05), smoothstep(0.0, 0.55, x));
  return mix(c, vec3(1.0), smoothstep(0.55, 1.0, x));
}

// ----------------------------------------------- blackbody color (Krystek) --
vec3 blackbody(float T) {
  float t = clamp(T, 1667.0, 25000.0);
  float xc, yc;
  if (t <= 4000.0) {
    xc = -0.2661239e9 / (t * t * t) - 0.2343580e6 / (t * t) + 0.8776956e3 / t + 0.179910;
  } else {
    xc = -3.0258469e9 / (t * t * t) + 2.1070379e6 / (t * t) + 0.2226347e3 / t + 0.240390;
  }
  if (t <= 2222.0) {
    yc = -1.1063814 * xc * xc * xc - 1.34811020 * xc * xc + 2.18555832 * xc - 0.20219683;
  } else if (t <= 4000.0) {
    yc = -0.9549476 * xc * xc * xc - 1.37418593 * xc * xc + 2.09137015 * xc - 0.16748867;
  } else {
    yc = 3.0817580 * xc * xc * xc - 5.87338670 * xc * xc + 3.75112997 * xc - 0.37001483;
  }
  vec3 XYZ = vec3(xc / yc, 1.0, (1.0 - xc - yc) / yc);
  // GLSL v*m dots v with matrix COLUMNS -> store rows of the D65 XYZ->sRGB
  // matrix as columns
  vec3 lin = XYZ * mat3(3.2406, -1.5372, -0.4986, -0.9689, 1.8758, 0.0415, 0.0557, -0.2040, 1.0570);
  float m = max(lin.r, max(lin.g, lin.b));
  return lin / max(m, 1e-4);
}

// ------------------------------------------- procedural sky (stars+galaxy) --
vec3 skySample(vec3 d) {
  vec3 col = vec3(0.002, 0.0035, 0.006);
  if (uStarDens > 0.001) {
    float gs = 26.0 + 30.0 * uStarDens;
    vec3 pc = d * gs;
    vec3 id = floor(pc);
    vec3 fp = fract(pc) - 0.5;
    vec3 rnd = hash3(id);
    float dist = length(fp - (rnd - 0.5));
    float st = hash13(id + 11.7);
    float size = 0.02 + 0.05 * st * st;
    float mag = pow(st, 6.0) * 18.0 + 0.25;
    float tw = 0.82 + 0.18 * sin(uTime * (0.6 + st * 2.2) + st * 91.3);
    float br = exp(-dist * dist / (size * size)) * mag * tw * uStarBright * 0.08;
    if (br > 0.003) {
      vec3 tint = mix(vec3(0.62, 0.72, 1.0), vec3(1.0, 0.78, 0.55), step(0.62, hash13(id + 3.3)));
      col += tint * br * (0.5 + 0.5 * hash13(id + 7.7));
    }
  }
  vec3 gN = normalize(vec3(0.32, 0.83, 0.45));
  float g = dot(d, gN);
  float band = exp(-g * g * 14.0);
  if (band > 0.004) {
    vec3 gd = d * 3.0;
    float n = fbm3(gd);
    float lanes = 0.72 + 0.28 * fbm3(gd * 1.7 + 5.0);
    float core = exp(-g * g * 90.0) * 1.6 + exp(-g * g * 28.0) * 0.5;
    col += vec3(1.0, 0.93, 0.85) * band * lanes * core * 0.16 * uGalBright;
    col += vec3(0.75, 0.8, 1.0) * band * n * 0.05 * uGalBright;
  }
  vec3 nd = d * 2.2 + vec3(3.7, 1.1, 5.9);
  float n1 = fbm3(nd);
  float n2 = fbm3(nd * 2.1 + 11.0);
  float n3 = fbm3(nd * 4.3 - 4.7);
  col += (vec3(0.22, 0.32, 0.55) * n1 * n1 + vec3(0.55, 0.22, 0.42) * n2 * n2 +
          vec3(0.08, 0.30, 0.45) * n3) * 0.35 * uNebBright;
  return col;
}

// ------------------------------------ volumetric accretion-disk sample ------
// The disk is a 3-D slab (|y| < H(r)) of radiating, absorbing, turbulent
// plasma orbiting at Keplerian speed v = sqrt(r_s / 2r). Density falls off
// vertically like a Gaussian cloud, radially as a power law, and is sculpted
// by animated FBM turbulence (differential rotation => cloud-like volume).
// vn is the photon-direction dot disk-azimuth at this point (in units of c).
void sampleDisk(vec3 p, float r, float u, float dl, float vn,
                inout vec3 diskC, inout float trans, inout float dens,
                inout float gAcc, inout float gW) {
  float H = uH0 * (0.7 + 0.5 * pow(uRIn / r, 1.5)) * pow(r / uRIn, 0.6);
  float y = p.y;
  float zz = y / max(H, 1e-3);
  float rhoZ = exp(-zz * zz * 0.85);
  if (rhoZ < 0.012) return;
  float rhoR = pow(uRIn / r, 1.0) * smoothstep(uRIn * 0.90, uRIn, r);
  if (r > uROut) rhoR *= exp(-pow((r - uROut) / 1.4, 2.0));

  float ca = cos(uTurbSpeed * uTime * 0.12), sa = sin(uTurbSpeed * uTime * 0.12);
  vec2 q = mat2(ca, -sa, sa, ca) * p.xz;
  float ca2 = cos(uTurbSpeed * uTime * 0.035), sa2 = sin(uTurbSpeed * uTime * 0.035);
  vec2 q2 = mat2(ca2, -sa2, sa2, ca2) * p.xz;
  float turb = fbm4(vec3(q * 0.9, y * 2.2)) * 0.65 + fbm3(vec3(q2 * 1.9 + 7.3, y * 4.5)) * 0.35;

  float densF = uDensity * rhoR * rhoZ * (0.55 + 0.95 * turb * uTurbAmp);
  if (densF < 1e-3) return;
  float T = uTemp0 * pow(uRIn / r, 0.72) * (0.72 + 0.45 * turb);

  // frequency ratio nu_obs / nu_em = sqrt(1-r_s/r) / (gamma (1 - v.n))
  // (gravitational redshift x transverse Doppler x kinematic Doppler)
  float vorb = sqrt(RS / (2.0 * r));
  float gamma = 1.0 / sqrt(max(1e-5, 1.0 - vorb * vorb));
  float g = sqrt(max(0.0, 1.0 - RS * u)) / (gamma * max(1e-4, 1.0 - vorb * vn));
  float g3 = g * g * g;                      // I_obs = g^3 I_em

  vec3 bb = blackbody(T);
  float bright = pow(T / uTemp0, 1.8);
  vec3 tint = mix(vec3(1.03, 0.97, 0.93), vec3(0.94, 0.975, 1.04), smoothstep(0.15, 1.6, g));
  diskC += trans * densF * bb * bright * g3 * dl * EMIS * tint;

  trans *= exp(-uAbsorb * densF * dl * 0.7);
  dens += densF * dl;
  gAcc += g3 * densF * dl;
  gW += densF * dl;
}

// ------------------------------------------------------------ geodesic -----
float accel(float u, float chi) {
  return -u + 1.5 * u * u * (1.0 + 0.003 * chi * u);
}

void trace(vec3 ro, vec3 rd, float chi, int cap,
           out vec3 oCol, out vec3 oSky, out vec3 oDisk,
           out float oSteps, out float oR, out float oB, out float oDens, out float oG) {
  float r0 = length(ro);
  vec3 er0 = ro / r0;
  float g0 = sqrt(max(0.0, 1.0 - RS / r0));
  vec3 Lv = cross(ro, rd);
  float LL = length(Lv);
  vec3 skyC = vec3(0.0);
  vec3 diskC = vec3(0.0);
  float trans = 1.0;
  float dens = 0.0, gAcc = 0.0, gW = 0.0;
  float bVal = 0.0, rF = r0, stepsUsed = 0.0;
  bool captured = false;
  bool escaped = false;
  vec3 escDir = rd;
  vec3 p = ro;
  float phi = 0.0;

  if (LL < 1e-4 * r0) {
    // ---- (nearly) radial geodesic: straight line through the origin ----
    float pr = dot(rd, er0);
    float sMax, nr;
    if (pr >= 0.0) { sMax = max(R_ESC2 - r0, 0.0); nr = 1.0; }
    else {
      float bq = dot(ro, rd);
      sMax = -bq - sqrt(max(0.0, bq * bq - (r0 * r0 - RS * RS)));
      nr = -1.0;
    }
    float ds = sMax / float(cap);
    for (int i = 0; i < MAX_STEPS; i++) {
      if (i >= cap) break;
      p += rd * ds;
      stepsUsed += 1.0;
      float r = length(p);
      rF = r;
      if (r <= RS * 1.0005) { captured = true; rF = 1.0; break; }
      if (pr >= 0.0 && r >= R_ESC2) { escaped = true; escDir = rd; break; }
      float u = 1.0 / r;
      if (r > 0.6 * uRIn && r < uROut + 4.0 && trans > 0.02) {
        sampleDisk(p, r, u, ds, 0.0, diskC, trans, dens, gAcc, gW);
      }
      if (trans < 0.015) break;
    }
    if (!captured && !escaped) { captured = (nr < 0.0); if (!captured) escaped = true; }
  } else {
    // ---- general geodesic: orbital-plane reduction, RK4 on u(phi) ----
    vec3 planeN = Lv / LL;
    vec3 ephi0 = normalize(cross(planeN, er0));
    float pphi = abs(dot(rd, ephi0));
    float pr = dot(rd, er0);
    float s = (dot(rd, ephi0) >= 0.0 ? 1.0 : -1.0);  // orbit handedness
    bVal = r0 * pphi / g0;                    // impact parameter b = L/E
    float u = 1.0 / r0;
    float w = -pr * g0 / (r0 * max(pphi, 1e-5));   // w = du/dphi
    float dphi = PHI_MAX / float(cap);
    for (int i = 0; i < MAX_STEPS; i++) {
      if (i >= cap) break;
      if (u >= U_CAP) { captured = true; rF = 1.0 / u; break; }
      // RK4
      float du1 = w;
      float dw1 = accel(u, chi);
      float u2 = u + 0.5 * dphi * du1;
      float w2 = w + 0.5 * dphi * dw1;
      float dw2 = accel(u2, chi);
      float u3 = u + 0.5 * dphi * w2;
      float w3 = w + 0.5 * dphi * dw2;
      float dw3 = accel(u3, chi);
      float u4 = u + dphi * w3;
      float w4 = w + dphi * dw3;
      float dw4 = accel(u4, chi);
      u += dphi * (du1 + 2.0 * w2 + 2.0 * w3 + w4) / 6.0;
      w += dphi * (dw1 + 2.0 * dw2 + 2.0 * dw3 + dw4) / 6.0;
      phi += dphi;
      stepsUsed += 1.0;
      float r = 1.0 / u;
      rF = r;
      vec2 cp = vec2(cos(phi), sin(phi));
      p = r * (cp.x * er0 + cp.y * ephi0);
      if (r > 0.6 * uRIn && r < uROut + 4.0 && trans > 0.02) {
        float dl = dphi / u * sqrt(1.0 + w * w / max(u * u * (1.0 - RS * u), 1e-6));
        float nphi = bVal * u * sqrt(max(0.0, 1.0 - RS * u));
        // project the photon's in-plane tangential direction onto the disk's
        // azimuthal direction: v.n = v_orb * nphi * F * s (radial part vanishes)
        vec3 phat = p / r;
        float rho = length(p.xz);
        vec3 vhat = rho > 1e-6 ? vec3(p.z, 0.0, -p.x) / rho : vec3(1.0, 0.0, 0.0);
        float F = dot(planeN, cross(phat, vhat));
        float vn = nphi * s * F;
        sampleDisk(p, r, u, dl, vn, diskC, trans, dens, gAcc, gW);
      }
      if (r > R_ESC && w < 0.0) {
        escaped = true;
        vec3 er = normalize(p);
        vec3 ephi = normalize(cross(planeN, er));
        float nr = sqrt(max(0.0, 1.0 - bVal * bVal * u * u * (1.0 - RS * u)));
        float nphi = bVal * u * sqrt(max(0.0, 1.0 - RS * u));
        escDir = nr * er + s * nphi * ephi;
        break;
      }
      if (trans < 0.015) break;
    }
    if (!captured && !escaped) {
      if (bVal > B_CRIT) {
        escaped = true;
        float r = 1.0 / u;
        vec2 cp = vec2(cos(phi), sin(phi));
        p = r * (cp.x * er0 + cp.y * ephi0);
        vec3 er = normalize(p);
        vec3 ephi = normalize(cross(planeN, er));
        float nr = (w < 0.0 ? 1.0 : -1.0) * sqrt(max(0.0, 1.0 - bVal * bVal * u * u * (1.0 - RS * u)));
        float nphi = bVal * u * sqrt(max(0.0, 1.0 - RS * u));
        escDir = nr * er + s * nphi * ephi;
      } else {
        captured = true;
        rF = 1.0 / max(u, U_CAP);
      }
    }
  }

  if (escaped) skyC = skySample(escDir);
  oCol = diskC + trans * skyC;
  oSky = skyC;
  oDisk = diskC;
  oSteps = stepsUsed;
  oR = rF;
  oB = bVal;
  oDens = dens;
  oG = gAcc / max(gW, 1e-6);
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 right = normalize(uCamMatrix[0].xyz);
  vec3 up    = normalize(uCamMatrix[1].xyz);
  vec3 fwd   = normalize(-uCamMatrix[2].xyz);
  vec3 rd = normalize(fwd + ndc.x * uAspect * uTanFov * right + ndc.y * uTanFov * up);

  vec3 col, sky, disk;
  float st, rF, bF, densF, gF;
  if (uDispersion < 0.002) {
    trace(uCamPos, rd, 0.0, uSteps, col, sky, disk, st, rF, bF, densF, gF);
  } else {
    // slight chromatic dispersion: R and B integrated with a tiny
    // wavelength-dependent perturbation at reduced step count
    float f = max(0.15, uDispFrac);
    int s2 = max(12, int(float(uSteps) * f));
    vec3 cR, skyR, diskR; float stR, rFR, bFR, dFR, gFR;
    vec3 cB, skyB, diskB; float stB, rFB, bFB, dB, gB;
    trace(uCamPos, rd, 1.0, s2, cR, skyR, diskR, stR, rFR, bFR, dFR, gFR);
    trace(uCamPos, rd, 0.0, uSteps, col, sky, disk, st, rF, bF, densF, gF);
    trace(uCamPos, rd, -1.0, s2, cB, skyB, diskB, stB, rFB, bFB, dB, gB);
    col = vec3(cR.r, col.g, cB.b);
    sky = vec3(skyR.r, sky.g, skyB.b);
    disk = vec3(diskR.r, disk.g, diskB.b);
  }

  if (uDebug == 0 || uDebug == 1) { gl_FragColor = vec4(col, 1.0); return; }
  if (uDebug == 2) { gl_FragColor = vec4(heat(st / float(uSteps)), 1.0); return; }
  if (uDebug == 3) { gl_FragColor = vec4(heat(clamp((rF - 1.0) / 25.0, 0.0, 1.0)), 1.0); return; }
  if (uDebug == 4) {
    float lg = clamp(log(max(gF, 1e-4)) / 2.3026, -2.0, 1.5);
    gl_FragColor = vec4(palette((lg + 2.0) / 3.5), 1.0); return;
  }
  if (uDebug == 5) { gl_FragColor = vec4(vec3(1.0 - exp(-densF)), 1.0); return; }
  if (uDebug == 6) { gl_FragColor = vec4(sky, 1.0); return; }
  if (uDebug == 7) { gl_FragColor = vec4(disk, 1.0); return; }
  if (uDebug == 8) {
    float m = 1.0 - smoothstep(0.04, 0.18, abs(bF - B_CRIT));
    gl_FragColor = vec4(vec3(m), 1.0); return;
  }
  gl_FragColor = vec4(rd * 0.5 + vec3(0.5), 1.0);   // 9: ray directions
}
`;

// ---------------------------------------------------------------------------
// Final composite: HDR bloom input -> ACES -> chromatic aberration ->
// film grain -> vignette -> sRGB encode.
// ---------------------------------------------------------------------------
export const FINAL_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform float uExposure, uGrain, uVignette, uCA, uTime;
uniform vec2 uRes;
varying vec2 vUv;

float h21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  float ca = uCA * 0.004 * (1.0 + 10.0 * dot(c, c));
  vec3 hdr;
  hdr.r = texture2D(tDiffuse, uv + c * ca).r;
  hdr.g = texture2D(tDiffuse, uv).g;
  hdr.b = texture2D(tDiffuse, uv - c * ca).b;
  hdr *= uExposure;
  vec3 col = aces(hdr);
  float n = h21(uv * uRes * 0.5 + vec2(uTime * 19.7));
  col += (n - 0.5) * uGrain * 0.07;
  col *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(c) * 1.5);
  col = pow(max(col, 0.0), vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Debug viewer: raw raytracer output without bloom/ACES.
// ---------------------------------------------------------------------------
export const DEBUG_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform float uExposure;
uniform int uDebug;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  if (uDebug == 1) c *= uExposure;   // linear HDR preview (clips intentionally)
  c = pow(max(c, 0.0), vec3(0.4545));
  gl_FragColor = vec4(c, 1.0);
}
`;
