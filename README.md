# jieshuoju-prototype

麦芽原型 · 剧集现网 1:1 复刻（《离婚后》示例项目）

在线预览：https://zliangf.github.io/jieshuoju-prototype/

纯静态 HTML，无构建、无后端。现网链路：

```text
首页 → 剧本大纲 → 资产库 → 分集视频（全集）→ 单集工作台
```

```text
index.html               影视创作首页（空态上传 + 我的影视项目、风格选择）
outline.html             剧本大纲
assets.html              资产库
episodes.html            分集视频全集（一键成片 / 专业分镜 / 导演级分镜）
workspace.html           第1集单集工作台
console.html             旧入口，自动跳转到分集视频
css/product.css          全部页面样式
js/data.js               演示数据 + 公共 UI（ReplicaData / ReplicaUI）
js/workspace.js          单集工作台交互
media/                   角色 / 场景 / 道具 / 封面 / 分镜图 / 分镜视频
```

常改位置：

- 新功能提示气泡（`promo-bubble`）：首页在 `index.html`，导演级分镜在 `episodes.html`，样式在 `css/product.css`。
- 演示数据（项目、分集、角色等）：`js/data.js`。

本地预览：

```bash
python3 -m http.server 8765    # 然后打开 http://127.0.0.1:8765/
```

## 协作方式

完整流程和可直接复制给 AI 的提示词见 [协作指南.md](./协作指南.md)。简要步骤：

1. 修改前先拉取最新版本（GitHub Desktop 点 `Fetch origin` / `Pull origin`）
2. 修改页面
3. 填写修改说明后 `Commit`，再 `Push origin`
4. 约 1–2 分钟后在线预览自动更新

历史版本可在 `Commits` 中查看与回退；评审通过的版本在 `Releases` 中打标签（如 `v1.0`）。
