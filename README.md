# 梦境邮局 H5

原创 3D 毛毡视觉解谜小游戏。第一章《给还记得的人》发生在一间连续变化的夜班邮局里，玩家需要观察环境，并通过翻面、旋转、拖动、重叠和组合物件完成一条相互关联的谜题链。

在线试玩：<http://47.116.213.118:8083/dream-post-office/>

## 第一章玩法

- 翻看夜班记录，发现月灯规则。
- 旋转三层月环，让隐藏的月光亮起。
- 将退信翻面并拖到月灯下显影。
- 校准日期邮戳，获得带孔星图。
- 旋转并覆盖星图，寻找暗格。
- 组合两半星形封蜡，打开投递窗并寄出退信。

完整设计说明见 [`docs/chapter-01-design.md`](docs/chapter-01-design.md)。

## 本地运行

```bash
npm test
npm run build:h5
npm run serve:h5
```

然后访问 `http://127.0.0.1:4173`。横屏与竖屏均可游玩，不需要强制旋转设备。

## 发布与微信小游戏迁移

`dist/h5/` 是完整静态站点。核心逻辑位于 `src/`，不依赖 DOM；H5 输入、全屏、存储和音频适配集中在 `web/runtime.js`，后续迁移微信小游戏时可继续使用同一套状态机和 Canvas 渲染层。

## 美术资产

横竖屏场景均由 `gpt-image-2` 生成并经过人工验收：

- `assets/felt-post-office-room.webp`
- `assets/felt-post-office-room-portrait.webp`

最终提示词保存在 `art/prompts/`。机关状态、物品栏、近景检查与反馈特效由 Canvas 分层绘制，避免将交互烘焙进单张背景。
