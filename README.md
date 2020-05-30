# iitc-plugin-maxlayers
用于Ingress IITC双顶点最大层数规划

## 依赖
* [IITC: Ingress intel map total conversion](https://static.iitc.me/build/release/total-conversion-build.user.js)
* [IITC plugin: Bookmarks for maps and portals](https://static.iitc.me/build/release/plugins/bookmarks-by-zaso.user.js)
* [IITC plugin: draw tools](https://static.iitc.me/build/release/plugins/draw-tools.user.js)

## 用法
清空收藏夹。先收藏两个顶点，在收藏待筛选的其他点，然后点击右边面板的**Calc Max Layers**。

## 更新
v0.1 基本可用。按到双顶点连线距离排序，然后做dp。距离计算是用其中一个点取经度修正值修正所有经度距离，因此高纬度或者长距离可能有问题。时间复杂度O(n^2)。