# GARGANTUA — 测试报告

[English](./TEST_REPORT.md)

由 `scripts/screenshot.mjs`（DevTools 协议驱动，零外部依赖）针对 `scripts/serve.mjs` 于 `http://127.0.0.1:8123` 生成。

## 环境

| 项目 | 值 |
| --- | --- |
| 操作系统 | Windows（会话主机） |
| Node | v24.14.0 |
| 浏览器 | Microsoft Edge（Chromium），`--headless=new` |
| WebGL | WebGL 2.0（OpenGL ES 3.0 Chromium），GPU 加速 |
| 服务器 | `node scripts/serve.mjs 8123` |
| 测试驱动 | `node scripts/screenshot.mjs …`（GPU 优先，SwiftShader 回退） |

驱动等待页面的 `[GARGANTUA_FRAME]` 标记（第二帧渲染后记录），收集所有 `console.error`、`console.assert`、未捕获异常、失败的网络请求与 HTTP ≥400，随后捕获 PNG。退出码 0 = 已渲染且零错误。

## 结果

### 1. 资产完整性

页面请求的全部 22 个资产均返回 HTTP 200：

```
/ /js/*.js (9 个模块) /css/style.css /vendor/three.module.js
/vendor/three.core.js /vendor/addons/controls/OrbitControls.js
/vendor/addons/postprocessing/{EffectComposer,Pass,RenderPass,ShaderPass,
MaskPass,UnrealBloomPass}.js /vendor/addons/shaders/{CopyShader,
LuminosityHighPassShader}.js /audio/ambient.wav
```

### 2. 模块语法

对全部 9 个应用模块 + 3 个脚本执行 `node --input-type=module --check`：**全部通过**。

### 3. 功能/视觉矩阵 —— 全部 PASS，0 控制台错误

| # | 用例 | URL（相对） | 输出 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | 冒烟测试，低成本 | `?quality=standard&steps=96&res=0.4&movie=0&hud=0&cam=1&params=…dispersion:0` | test/shot-cam1-smoke.png | PASS |
| 2 | Cam 1 星际穿越 | `?steps=320&res=1.0&movie=0&hud=0&cam=1` | test/shot-cam1.png | PASS |
| 3 | Cam 2 倾斜飞掠 | `?steps=300&res=1.0&movie=0&hud=0&cam=2` | test/shot-cam2.png | PASS |
| 4 | Cam 3 极点俯视 | `?steps=300&res=1.0&movie=0&hud=0&cam=3` | test/shot-cam3.png | PASS |
| 5 | Cam 4 光子球 | `?steps=300&res=1.0&movie=0&hud=0&cam=4` | test/shot-cam4.png | PASS |
| 6 | HUD 可见 | `?steps=300&res=1.0&movie=0&hud=1&cam=1` | test/shot-hud.png | PASS |
| 7 | 电影画质 | `?quality=cinematic&res=1.0&movie=0&hud=0&cam=1` | test/shot-cinematic.png | PASS |
| 8 | 调试 2（迭代次数） | `?debug=2` | test/shot-debug2-steps.png | PASS |
| 9 | 调试 4（红移 g³） | `?debug=4` | test/shot-debug4-g.png | PASS |
| 10 | 调试 8（环掩码） | `?debug=8` | test/shot-debug8-ring.png | PASS |
| 11 | 天空调试（透镜） | `?debug=6` | test/shot-sky.png | PASS |
| 12 | 截图 API | `?shot=json&shotms=1500` | 标题 → `SHOT_OK:772014`，`window.__GARGANTUA_SHOT__` 已设置 | PASS |
| 13 | 移动窗口 | 390×844，`?steps=160&res=0.6` | test/shot-mobile.png | PASS |

### 4. 视觉验收（捕获帧的 VLM 评审）

* **事件视界** —— 纯黑圆形阴影，边缘锐利，无漏光。✔
* **光子环** —— 位于 `b ≈ 3√3/2 r_s` 的细密闭合亮环；调试 8 显示干净的白色环掩码。✔
* **吸积盘** —— 带可见湍流纹理的体积板，内缘蓝白 → 外缘橙红黑体渐变；**多普勒聚束**已验证（接近侧亮、远离侧暗；调试 4 显示蓝/红不对称）。✔
* **次级像** —— 阴影上方/下方的上下拱形盘远侧像（多重穿越透镜像）清晰可见。✔
* **背景引力透镜** —— 恒星绕阴影压缩/拉伸成弧；极点视角下同心弯曲。✔
* **天空** —— 星场、倾斜银河带与星云可见。✔
* **后期管线** —— HDR bloom、ACES 滚降、胶片颗粒、暗角、轻微色差与色散：无死白裁切、无条带。✔
* 最终参考帧获评审视觉模型评分 **8.5/10**。

### 5. 控制台错误审计

上述每次运行均**零控制台错误、零未捕获异常、零失败请求**（唯一曾观察到的 404 是缺失的 `three.core.js` vendor 依赖，已在矩阵运行前修复）。

## 已知限制（已记录，非失败）

* 无头 rAF 受 60 Hz vsync 限制，因此无头运行的 `[GARGANTUA_BENCH]` 数据不代表真实 GPU 帧时间。
* SwiftShader 回退路径渲染正确但缓慢（软件光栅化）；真实设备走 GPU 路径。应用自动检测 SwiftShader 并切换至 Standard 预设。
* 仅史瓦西时空（无 Kerr 自旋）——按规格要求。
