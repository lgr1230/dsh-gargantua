# GARGANTUA — 史瓦西黑洞光线追踪器

[English](./README.md)

**在线预览：** <https://lgr1230.github.io/dsh-gargantua/> —— 浏览器中直接运行（需要 WebGL2）。

实时全屏引力光线追踪器。每个像素都在片元着色器中积分真实的**史瓦西零测地线**——事件视界、光子环、爱因斯坦透镜盘像与多重穿越吸积盘全部*由测地线方程自然涌现*；没有任何黑球、光环、贴图或视频的伪饰。

无需构建步骤。原生 ES 模块 + 本地化 three.js。任意静态文件服务器即可运行。

## 运行

```bash
# 启动内置零依赖服务器（默认端口 8123）
node scripts/serve.mjs                 # -> http://localhost:8123
node scripts/serve.mjs 8080            # 或任意空闲端口
PORT=9000 node scripts/serve.mjs       # 或通过 PORT 环境变量指定

# 或任意静态文件服务，例如
#   npx serve .
#   python -m http.server <port>
```

打开 <http://localhost:8123/>（或你指定的端口）。需要 WebGL2（任意现代浏览器）。建议佩戴耳机（按 **M** 键开启环境低鸣）。

## 物理原理

* 单位制：史瓦西半径 `r_s = 1`，`G = M = c = 1`。
* 零测地线位于其轨道平面内。以 `u = 1/r` 表示，轨道方程为 `u'' = -u + 1.5 u²`，逐像素 **RK4** 积分（至多 768 步，自适应 `φ` 预算 16 rad）。
* 碰撞参数 `b = L/E = r₀ p_φ / √(1 - r_s/r₀)` 决定捕获（`b < b_crit = 3√3/2 r_s` 落入视界）还是逃逸。**光子环**位于 `b ≈ b_crit`——它就是缠绕的临界测地线本身。
* **吸积盘是三维体素板**（`|y| < H(r)`，外展、内缘增厚）中的开普勒速度 `v = √(r_s/2r)` 湍流等离子体。沿每条测地线步进，着色器累加 `I ∝ g³ · ρ · B(T) · dl` 并做 Beer–Lambert 吸收——因此获得真正的**体积感**（云状 FBM 湍流、较差自转、柔和密度尾迹）、**多重盘穿越**（正像、背像与环像各自独立穿越板层）、**多普勒聚束**（`g = √(1-r_s/r) / (γ(1 - v·n̂))`，接近侧 ×g³ 增亮）以及**引力红移**。
* 逃逸光线采样完全**程序化天空**：3-D 哈希星场、带尘埃带的倾斜银河带与 FBM 星云——全部经光线真实偏折产生透镜效应。
* 轻微**色散**：R/B 通道以微小的波长相关扰动积分轨道方程（等离子体式有效折射），在环上产生彩色镶边。

## 后期管线

光线追踪（HalfFloat HDR）→ Unreal Bloom → **ACES** 色调映射 → 色差 → 动态胶片颗粒 → 暗角 → sRGB。黑洞本体保持纯黑；盘内缘经 bloom 过曝为白色。

## 操作

| 按键 | 功能 |
| --- | --- |
| `1`–`4` | 相机预设：星际穿越 / 倾斜飞掠 / 极点俯视 / 光子球 |
| `0`–`9` | 调试视图：0 最终 · 1 线性 HDR · 2 迭代次数 · 3 半径 · 4 红移 g³ · 5 密度 · 6 天空 · 7 盘 · 8 光子环掩码 · 9 光线方向 |
| `Q`/`W`/`E` | 画质：Standard / High / Cinematic |
| `SPACE` | 电影相机循环开/关（拖动/缩放即退出循环） |
| `M` | 环境音乐开/关 |
| `H` | HUD 开/关 · `F` 全屏 · `P` 暂停 · `R` 重置 · `?` 帮助 |
| 拖拽 / 滚轮 / 双指 | 轨道与缩放（OrbitControls） |

右侧面板暴露全部 **21 个参数**（盘几何与物理、湍流、步进、色散、曝光、bloom、颗粒、暗角、色差、天空、FOV），并持久化到 `localStorage`。

## 画质与设备

* **Standard / High / Cinematic** —— 步进数（240/400/560）、色散通道比例与像素比上限（1/1.5/2）。
* **Retina**：按画质限制 DPR 渲染。
* **移动端**：触摸轨道、自动检测画质、降低像素比。
* **自动检测**：SwiftShader/软件 GL → Standard 画质。
* **恢复**：渲染器失败显示错误面板；`webglcontextlost` / `restored` 无需刷新即可重建完整管线。

## URL 接口与自动化

```
?quality=standard|high|cinematic
?cam=1..4 &debug=0..9 &steps=96..768 &res=0.25..2 &dpr=0.5..2
?movie=0|1 &music=0|1 &hud=0|1
?params=<21 个键的 base64 JSON>
?shot=1        -> 在 ?shotms（默认 3000）后自动下载 gargantua-<ts>.png
?shot=json     -> window.__GARGANTUA_SHOT__ = dataURL，控制台标记，标题 SHOT_OK:<len>
```

同时暴露：`window.GARGANTUA` —— `setParam(k,v)`、`getParams()`、`setQuality`、`setCamera(i)`、`setDebug(d)`、`setMovie(b)`、`capture()`（PNG dataURL）、`getState()`。

无头验收测试（Chrome/Edge、CDP、无外部依赖）：

```bash
node scripts/screenshot.mjs \
  --url "http://localhost:<port>/?quality=standard&steps=200&res=0.5&movie=0&hud=0&cam=1" \
  --out test/shot-cam1.png --w 960 --h 540
# <port> = 你的服务器运行端口（默认 8123）
# 退出码 0 = 已渲染且零控制台错误；截图见 test/
```

重新生成音乐资产：`node scripts/generate-audio.mjs`（写入 `audio/ambient.wav`；缺失时应用回退到 WebAudio 合成器）。

## 目录结构

```
index.html            import map + canvas + overlays
css/style.css         HUD / panel / responsive
js/shaders.js         全部 GLSL（测地线光线追踪、后期、调试）
js/blackhole.js       光线追踪四边形 + uniforms
js/post.js            bloom + ACES/颗粒/暗角/CA 合成器
js/camera.js          OrbitControls + 电影循环 + 预设
js/hud.js             HUD、面板、快捷键
js/audio.js           环境音乐（wav -> WebAudio 回退）
js/url.js             URL 参数 + 截图自动化
js/main.js            引导、状态、主循环、错误恢复
vendor/               three.js r180 + addons（本地，无 CDN）
audio/ambient.wav     生成的氛围音（66 秒循环）
scripts/              serve / screenshot / 音频生成
test/                 验收截图
```

## 测试结果

完整验收记录见 [`test/TEST_REPORT.md`](test/TEST_REPORT.md)（[中文版](test/TEST_REPORT.zh-CN.md)）：**13/13 用例 PASS，零控制台错误、零失败请求**——涵盖全部 4 个相机预设、HUD、3 档画质、调试视图 2/4/6/8、`?shot=json` 自动化接口（标题 `SHOT_OK:772014`）与 390×844 移动窗口。捕获帧见 `test/`：深黑阴影、光子环、多普勒增亮的体积吸积盘、上下透镜盘像与透镜星场（VLM 评审，参考帧 8.5/10）。
