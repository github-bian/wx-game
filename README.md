# 梦境邮局 H5

原创横屏视觉解谜小游戏。玩家依次完成梦件分拣、月相邮戳校准和云层航线投递。

## 本地运行

```bash
npm test
npm run build:h5
npm run serve:h5
```

然后访问 `http://127.0.0.1:4173`。

## 发布

`dist/h5/` 是完整的静态站点，可以部署到任意支持 HTTPS 的静态服务器、对象存储或 CDN：

- `index.html`
- `runtime.js`
- `game.bundle.js`
- `assets/dream-post-office-hall.webp`

## 微信小游戏迁移

核心游戏代码位于 `src/`，未依赖 DOM。H5 的鼠标、触摸、音频和存储适配集中在 `web/runtime.js`；迁移微信小游戏时保留 `src/`，改用微信环境提供的 `wx` API 即可。

## 美术资产

正式背景使用 `gpt-image-2` 生成，源提示词位于 `art/prompts/dream-post-office-h5.txt`。所有可交互物件、谜题图形和 UI 均由 Canvas 实时绘制。
