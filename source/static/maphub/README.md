# 省份真实地图游戏

一个使用 Leaflet 和本地 GeoJSON 数据制作的中国省级行政区点击探索小游戏。

## 功能

- 点击真实省级边界，显示省级行政区名称、类型、区域和行政中心
- 记录已发现进度和完成度
- 支持随机挑战模式
- 支持拖拽、缩放和移动端触控
- 使用 `localStorage` 保存进度
- Leaflet 和地图数据均已本地化，可直接离线打开 `index.html`

## 运行

直接用浏览器打开 `index.html`。

## 数据与依赖

- 地图数据：DataV.GeoAtlas 全国省级边界 `100000_full.json`
- 地图库：Leaflet 1.9.4，本地文件位于 `vendor/leaflet`

## 产品文档

- [文档中心](docs/index.html)
- [基础设计文档](docs/design.html)
- [趣味化与增长迭代文档](docs/fun-growth-iteration.html)
