# 镇夜司：五行锁 H5

国风道家文化密室逃脱H5垂直切片。玩家需要探索房间、加工线索、理解阴阳五行和八卦规则，在守门尸破门前取得通往下一关的钥匙。

在线试玩：<http://47.116.213.118:8083/five-phase-locks/>

当前第一版包含：

- 序章「阴阳义庄」：日灯、月镜、黑白玉片与光影机关。
- 第一关「青木风廊」：震雷、巽风、水生木与金克木机关。
- 物品栏拖拽和设备加工。
- 僵尸接近、撞门、破门、死亡与房间检查点。
- 横屏和竖屏布局。
- 刷新与横竖屏切换后的房间进度恢复。
- 文化图鉴和分层提示入口。

## 产品文档

- [产品需求与七段关卡设计](docs/product/taoist-zombie-escape-prd.md)
- [H5第一版落地方案](docs/product/h5-mvp-implementation-plan.md)
- [视觉概念交付说明](docs/product/taoist-zombie-visual-concepts.md)
- [游戏介绍与完整通关说明](docs/game-introduction.md)

## 本地运行

```bash
npm test
npm run build:h5
npm run serve:h5
```

访问 `http://127.0.0.1:4173`。

## 技术结构

- `src/game-state.js`：纯状态机、谜题依赖、威胁和检查点。
- `src/main.js`：Canvas场景、设备近景、UI和交互。
- `web/runtime.js`：H5输入、音频、存储和全屏适配。
- `tools/build-h5.js`：静态H5构建。

第一版使用轻量Canvas H5快速验证体验。通过玩家测试后，可将状态机和数据结构迁移到Cocos Creator，再发布微信小游戏。

## 美术资产

概念场景由 `gpt-image-2` 生成，提示词位于 `art/prompts/taoist-escape/`。正式制作时，中文、卦象、方位和互动图形必须使用代码或准确矢量资产绘制，不能依赖AI图中的细节。
