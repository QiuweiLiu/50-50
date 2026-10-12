# 50 / 50 — 一刀平分，恰好平衡

简体中文的极简几何挑战游戏。用鼠标或手指划一条直线，将图形分成面积尽可能相等的两半。

项目说明、代码注释和测试提示统一使用简体中文。

- 真实面积判定、猫兔鸭鲸曲边剪影与多边形交替、三条生命、连击计分与更紧迫的无尽挑战。
- 米白、黑与赭红的极简界面，放大的操作主体、居中「完美平分」反馈与有拖尾、余辉的克制烟花。
- 桌面与手机触摸操作、退出返回首页、本机历史成绩与前十排行榜。
- 单个 `index.html`，所有 HTML/CSS/JavaScript 内联；无 CDN、外部字体、图片、API 或后端。

## 试玩

下载并在现代浏览器中打开 [index.html](index.html)，点击「开始挑战」。无需安装、构建或联网。

在线体验：[50 / 50 网页版](https://qiuweiliu.github.io/50-50/)。

音效使用浏览器合成，点击顶部「音效开」即可静音。点击「退出」保存本局并返回首页；「本机排行榜」保存此浏览器的历次已结束或退出挑战，展示前十名，不与其他玩家联网。

## 验证与说明

`node tests/challenge.cjs` 复核五种固定切法；旧版与新版的固定种子结果保存在 [挑战性验证数据](data/validation/challenge-metrics.json)。

`node tests/geometry.cjs` 可直接运行几何、生成器、计分与语法测试，不需要第三方依赖。

浏览器测试使用 Playwright 与已有 Chromium，运行 `node tests/browser.cjs`。默认寻找本机 Codex 的已安装运行时；在其他环境中通过 `PLAYWRIGHT_NODE_MODULES` 指定包含 `playwright` 的 node_modules 目录，通过 `CHROMIUM_EXECUTABLE_PATH` 指定 Chromium 可执行文件。游戏本身不依赖这些测试工具。

已验证离线 Chromium 桌面与手机模拟环境，包括触摸、键盘、存储降级和 320–844px 布局。尚未完成实体 iOS、Safari 和 Firefox 测试。

完整玩法、算法、计分和部署步骤见 [使用与实现说明](docs/README.md)。
