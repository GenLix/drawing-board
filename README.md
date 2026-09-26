# 描画 · Drawing Board

一个在浏览器里运行的单画面白板手绘动画工具。把图片、文字和自由笔画放到同一张画布上，自由安排位置、绘制顺序和停顿，让画面随着讲解逐步展开。

适合演示讲解、知识说明和短视频中的单个画面。使用原生 HTML、CSS、JavaScript 和 Canvas，无需安装前端依赖，也没有后端服务；导入的图片和项目在本机处理。

## 可以做什么

- **图文混排**：导入 PNG、JPG、WebP，添加文字，拖动元素并调整位置、尺寸。
- **涂刷显现**：从左上到右下、左下到右上，或上下左右等方向，逐步刷出图片和文字。
- **逐笔描线**：录制自由笔画，按路径回放；分笔之间抬笔移动。
- **沙粒显现**：以颗粒纹理逐步显现内容。
- **手持笔跟随**：用透明背景的手持笔图片跟随绘制轨迹，也可以关闭。
- **自由编排节奏**：调整元素顺序、绘制时长、画前延迟、画后停顿，或让元素同时开始。
- **预览与导出**：播放、暂停、调速、拖动进度；保存可编辑 JSON，或导出独立播放的 HTML。

## 本地运行

需要 Python 3 和支持 Canvas、JavaScript 模块的现代浏览器。

```sh
git clone https://github.com/GenLix/drawing-board.git
cd drawing-board
python3 -m http.server 8765 --bind 127.0.0.1
```

打开 **http://127.0.0.1:8765/** 即可使用。编辑器需要通过本地 HTTP 服务打开；导出的独立 HTML 可以直接双击播放。

## 使用方法

1. 点击「新建画面」，再添加图片、文字或用画笔画出路径。
2. 在画布中拖动元素，在右侧设置尺寸、绘制效果和推进方向。
3. 在左侧选择元素，用上下按钮调整绘制顺序。
4. 设置绘制时长、画前延迟和画后停顿，点击「播放预览」。
5. 用「保存项目」保留可编辑内容，用「导出 HTML」生成可分享的播放文件。

画后停顿支持 **0–600 秒**。下一项选择「接在上一项之后」时，会等待上一项绘制和停顿结束；选择「与上一项同时开始」时，按上一项的开始时间计算。最后一项的停顿也计入总时长，时间轴上的斜纹表示停顿区间。

## 导出格式

| 格式 | 用途 |
| --- | --- |
| JSON | 保存布局、素材、笔画和时间设置，之后通过「打开项目」继续编辑。 |
| HTML | 将场景、图片、手持笔素材和播放代码打包为单个文件，离线播放或交给外部渲染器。 |
| MP4 | 由 HyperFrames 等外部工具将导出的 HTML 渲染成视频。 |

### 使用 HyperFrames 生成视频

将导出的 HTML 放进单独的文件夹，命名为 `index.html`。安装 Node.js 后，在该文件夹运行：

```sh
npx hyperframes@0.8.65 render . -o drawing-board.mp4
```

导出的 HTML 包含画面尺寸和总时长，通过 `hf-seek` 接收指定时间，通过 `window.__hf.buildReady` 通知素材就绪。停顿也会保留在时间轴中。[HyperFrames](https://github.com/heygen-com/hyperframes) 负责视频渲染与编码，无需为使用本工具的编辑器安装它。

## 能力范围

- 每个项目是一张 **1280 × 720** 画面，最多 40 个元素；单张导入图片最多 8 MB，项目 JSON 最多 32 MB。
- 普通文字通过涂刷或沙粒显现，**不自动生成汉字笔顺**。逐笔绘制用于已有路径，例如示例标题和录制的自由笔画。
- 沙粒效果是纹理显现，不模拟真实沙子的堆积或推移，也不显示手持笔。
- 使用本机字体，不同操作系统上的文字外观可能不同。
- 当前不提供多场景拼接、配音、音轨或内置 MP4 编码。

## 核心文件

| 文件 | 职责 |
| --- | --- |
| `index.html` / `style.css` | 编辑器界面与样式。 |
| `app.mjs` | 编辑、导入、预览与保存交互。 |
| `core.mjs` | 项目校验、绘制时序、轨迹和示例数据。 |
| `renderer.mjs` | 按指定时间绘制 Canvas，并加载图片素材。 |
| `export.mjs` | 打包独立 HTML 播放文件。 |
| `assets/` | 手持笔图片及其来源、许可。 |

外部工具可以等待 `window.drawingBoard.ready`，再调用 `window.drawingBoard.renderAt(seconds)` 定位画面；通过 `canvas` 获取纯画面，通过 `getProject()` 获取项目数据，通过 `duration` 获取总时长。时间单位为秒。

## 许可证

Copyright 2026 GenLix。本项目采用 [Apache License 2.0](LICENSE)。

手持笔图片来自 [Inkplainer-OS](https://github.com/NadirWeb-App/Inkplainer-OS/blob/760af54d3c7e0cf3a846fdf3c7bbe278c9f6df3e/images/hand2-720p.png)，版权归原作者所有，按该仓库的 Apache 2.0 许可分发。原图未修改，完整来源和许可见 [assets/LICENSE-hand.txt](assets/LICENSE-hand.txt)；该声明也随 HTML 导出保留。
