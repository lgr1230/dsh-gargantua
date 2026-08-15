# GARGANTUA — Schwarzschild Black Hole Raytracer

[中文说明](./README.zh-CN.md)

A real-time, full-screen gravitational raytracer. Every pixel integrates true
**Schwarzschild null geodesics** in a fragment shader — the event horizon, the
photon ring, the Einstein-lensed disk images and the multi-crossing accretion
disk all *emerge from the geodesic equation*; nothing is painted on with black
spheres, rings, textures or video.

No build step. Native ES modules + vendored three.js. Any static file server works.

## Run

```bash
# start the included zero-dependency server (default port 8123)
node scripts/serve.mjs                 # -> http://localhost:8123
node scripts/serve.mjs 8080            # or any free port you choose
PORT=9000 node scripts/serve.mjs       # or via the PORT environment variable

# or anything else that serves static files, e.g.
#   npx serve .
#   python -m http.server <port>
```

Open <http://localhost:8123/> (or your chosen port). Needs WebGL2 (any modern
browser). Headphones recommended (press **M** for the ambient drone).

## Physics

* Units: Schwarzschild radius `r_s = 1`, `G = M = c = 1`.
* A null geodesic lies in its orbital plane. With `u = 1/r` the orbit equation is
  `u'' = -u + 1.5 u²`, integrated with **RK4** per pixel (up to 768 steps,
  adaptive `φ` budget of 16 rad).
* Impact parameter `b = L/E = r₀ p_φ / √(1 - r_s/r₀)` decides capture
  (`b < b_crit = 3√3/2 r_s` falls into the horizon) vs. escape. The **photon
  ring** lives at `b ≈ b_crit` — it is the winding critical geodesic itself.
* The **accretion disk is a 3-D volumetric slab** (`|y| < H(r)`, flared,
  inner-edge puff) of turbulent plasma orbiting at the Keplerian speed
  `v = √(r_s/2r)`. Along every geodesic step the shader accumulates
  `I ∝ g³ · ρ · B(T) · dl` with Beer–Lambert absorption — so you get true
  **volume** (cloud-like FBM turbulence, differential rotation, soft density
  tails), **multiple disk crossings** (front image, back image and the ring
  image are all separate crossings of the slab), **Doppler beaming**
  (`g = √(1-r_s/r) / (γ(1 - v·n̂))`, approaching side brightened ×g³), and
  **gravitational redshift**.
* Escaped rays sample a fully **procedural sky**: 3-D hashed star field,
  tilted galactic band with dust lanes and an FBM nebula — all lensed by the
  actual deflection of the ray.
* Slight **chromatic dispersion**: the R/B channels are integrated with a tiny
  wavelength-dependent perturbation to the orbital equation (plasma-style
  effective refraction), producing color fringing on the ring.

## Post pipeline

Raytrace (HalfFloat HDR) → Unreal Bloom → **ACES** tone map → chromatic
aberration → animated film grain → vignette → sRGB. The hole itself stays
perfectly black; the inner disk blows out to white through bloom.

## Controls

| Key | Action |
| --- | --- |
| `1`–`4` | camera presets: Interstellar / Tilted Flyby / Overhead Pole / Photon Sphere |
| `0`–`9` | debug views: 0 final · 1 linear HDR · 2 iterations · 3 radius · 4 redshift g³ · 5 density · 6 sky · 7 disk · 8 photon-ring mask · 9 ray dirs |
| `Q`/`W`/`E` | quality: Standard / High / Cinematic |
| `SPACE` | cinematic camera loop on/off (any drag/zoom exits the loop) |
| `M` | ambient music on/off |
| `H` | HUD on/off · `F` fullscreen · `P` pause · `R` reset · `?` help |
| drag / wheel / pinch | orbit & zoom (OrbitControls) |

The right-hand panel exposes all **21 parameters** (disk geometry & physics,
turbulence, raymarch steps, dispersion, exposure, bloom, grain, vignette,
chromatic aberration, sky, FOV) and persists everything to `localStorage`.

## Quality & devices

* **Standard / High / Cinematic** — raymarch steps (240/400/560), dispersion
  pass fraction and pixel-ratio caps (1/1.5/2).
* **Retina**: DPR-capped rendering per quality.
* **Mobile**: touch orbit, auto-detected quality, reduced pixel ratio.
* **Auto-detect**: SwiftShader/software GL → Standard.
* **Recovery**: renderer failures show an error panel; `webglcontextlost` /
  `restored` rebuilds the full pipeline without a reload.

## URL interface & automation

```
?quality=standard|high|cinematic
?cam=1..4 &debug=0..9 &steps=96..768 &res=0.25..2 &dpr=0.5..2
?movie=0|1 &music=0|1 &hud=0|1
?params=<base64 JSON of the 21 keys>
?shot=1        -> auto-downloads gargantua-<ts>.png after ?shotms (default 3000)
?shot=json     -> window.__GARGANTUA_SHOT__ = dataURL, console marker, title SHOT_OK:<len>
```

Also exposed: `window.GARGANTUA` — `setParam(k,v)`, `getParams()`,
`setQuality`, `setCamera(i)`, `setDebug(d)`, `setMovie(b)`,
`capture()` (PNG dataURL), `getState()`.

Headless acceptance test (Chrome/Edge, CDP, no external deps):

```bash
node scripts/screenshot.mjs \
  --url "http://localhost:<port>/?quality=standard&steps=200&res=0.5&movie=0&hud=0&cam=1" \
  --out test/shot-cam1.png --w 960 --h 540
# <port> = the port your server runs on (default 8123)
# exit 0 = rendered + zero console errors; see test/ for captured images
```

Regenerate the music asset: `node scripts/generate-audio.mjs` (writes
`audio/ambient.wav`; the app falls back to a WebAudio synth if missing).

## Layout

```
index.html            import map + canvas + overlays
css/style.css         HUD / panel / responsive
js/shaders.js         ALL GLSL (geodesic raytracer, post, debug)
js/blackhole.js       raytrace quad + uniforms
js/post.js            bloom + ACES/grain/vignette/CA composer
js/camera.js          OrbitControls + cinematic loop + presets
js/hud.js             HUD, panel, shortcuts
js/audio.js           ambient music (wav -> WebAudio fallback)
js/url.js             URL params + screenshot automation
js/main.js            bootstrap, state, loop, error recovery
vendor/               three.js r180 + addons (local, no CDN)
audio/ambient.wav     generated drone (66 s loop)
scripts/              serve / screenshot / audio generator
test/                 acceptance screenshots
```

## Test results

Full acceptance run recorded in [`test/TEST_REPORT.md`](test/TEST_REPORT.md):
13/13 cases PASS with **zero console errors, zero failed requests** —
all 4 camera presets, HUD, 3 quality tiers, debug views 2/4/6/8, the
`?shot=json` automation interface (title `SHOT_OK:772014`) and a 390×844
mobile window. Captured frames in `test/` show the deep-black shadow, the
photon ring, the Doppler-brightened volumetric disk, the upper/lower
lensed disk images and the lensed starfield (VLM-reviewed, 8.5/10 on the
reference frame).
