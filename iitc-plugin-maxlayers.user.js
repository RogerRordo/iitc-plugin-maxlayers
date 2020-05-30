// ==UserScript==
// @author         RogerRordo
// @name           IITC plugin: Max Layers
// @category       Layer
// @version        0.1
// @description    Calculate Max Layers
// @run-at         document-end
// @id             iitc-plugin-maxlayers
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://github.com/RogerRordo/iitc-plugin-maxlayers/blob/master/iitc-plugin-maxlayers.meta.js
// @downloadURL    https://github.com/RogerRordo/iitc-plugin-maxlayers/blob/master/iitc-plugin-maxlayers.user.js
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @require
// @grant          none
// ==/UserScript==

// Wrapper function that will be stringified and injected
// into the document. Because of this, normal closure rules
// do not apply here.

function wrapper(plugin_info) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if (typeof window.plugin !== "function") window.plugin = function () {};

  //PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
  //(leaving them in place might break the 'About IITC' page or break update checks)
  plugin_info.buildName = "maxlayers";
  plugin_info.dateTimeVersion = "20200530140000";
  plugin_info.pluginId = "maxlayers";
  //END PLUGIN AUTHORS NOTE

  // PLUGIN START ////////////////////////////////////////////////////////
  /*
   * whatsnew
   * v0.1 基本可用。按到双顶点连线距离排序，然后做dp。距离计算是用其中一个点取经度修正值修正所有经度距离，因此高纬度或者长距离可能有问题。时间复杂度O(n^2)。
   */

  window.plugin.maxlayers = function () {};

  window.plugin.maxlayers.fixLng = 1; // 经度距离修正
  window.plugin.maxlayers.v1 = {}; // 两个顶点
  window.plugin.maxlayers.v2 = {};

  // 显示计划
  window.plugin.maxlayers.show = function (plans) {
    var v1 = window.plugin.maxlayers.v1;
    var v2 = window.plugin.maxlayers.v2;
    var text = plans.length.toString() + "层:\n" + v1.label + "\n" + v2.label;
    for (var i = 0; i < plans.length; i++) {
      text = text + "\n" + plans[i].label;
    }
    alert(text);
  };

  // 按计划画图
  window.plugin.maxlayers.draw = function (plans) {
    var v1 = window.plugin.maxlayers.v1;
    var v2 = window.plugin.maxlayers.v2;
    for (var i = 0; i < plans.length; i++) {
      map.fire("draw:created", {
        layer: L.geodesicPolygon(
          [v1, v2, plans[i]],
          window.plugin.drawTools.polygonOptions
        ),
        layerType: "polygon",
      });
    }
  };

  // 判断点在三角形内
  window.plugin.maxlayers.pointInTri = function (v0, v1, v2, v3) {
    var x0 = v0.lat;
    var y0 = v0.lng * window.plugin.maxlayers.fixLng;
    var x1 = v1.lat;
    var y1 = v1.lng * window.plugin.maxlayers.fixLng;
    var x2 = v2.lat;
    var y2 = v2.lng * window.plugin.maxlayers.fixLng;
    var x3 = v3.lat;
    var y3 = v3.lng * window.plugin.maxlayers.fixLng;

    var divisor = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    var a = ((y2 - y3) * (x0 - x3) + (x3 - x2) * (y0 - y3)) / divisor;
    var b = ((y3 - y1) * (x0 - x3) + (x1 - x3) * (y0 - y3)) / divisor;
    var c = 1 - a - b;
    return a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1;
  };

  // 按距离排序
  window.plugin.maxlayers.sortDist = function (arr) {
    if (arr.length <= 1) return arr;
    let l = [],
      r = [];
    let mid = Math.round(arr.length / 2);
    for (let i = 0; i < arr.length; i++) {
      if (i == mid) continue;
      else if (arr[mid].dist >= arr[i].dist) l.push(arr[i]);
      else if (arr[mid].dist < arr[i].dist) r.push(arr[i]);
    }
    return window.plugin.maxlayers
      .sortDist(l)
      .concat(arr[mid], window.plugin.maxlayers.sortDist(r));
  };

  // 计算点线距
  window.plugin.maxlayers.calcDist = function (portal, v1, v2) {
    var x = portal.lat;
    var y = portal.lng * window.plugin.maxlayers.fixLng;
    var x1 = v1.lat;
    var y1 = v1.lng * window.plugin.maxlayers.fixLng;
    var x2 = v2.lat;
    var y2 = v2.lng * window.plugin.maxlayers.fixLng;

    var cross = (x2 - x1) * (x - x1) + (y2 - y1) * (y - y1);
    if (cross <= 0) return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));

    var d2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (cross >= d2)
      return Math.sqrt((x - x2) * (x - x2) + (y - y2) * (y - y2));

    var r = cross / d2;
    var px = x1 + (x2 - x1) * r;
    var py = y1 + (y2 - y1) * r;
    return Math.sqrt((x - px) * (x - px) + (py - y) * (py - y));
  };

  // 计算最大层
  window.plugin.maxlayers.calc = function (portalsList) {
    // 预处理经纬度
    for (var x in portalsList) {
      portalsList[x].lat = parseFloat(portalsList[x].latlng.split(",")[0]);
      portalsList[x].lng = parseFloat(portalsList[x].latlng.split(",")[1]);
    }

    // 先计算点线距
    var counts = 0;
    var v1, v2;
    var portalsList2 = [];
    for (var x in portalsList) {
      var portal = portalsList[x];
      counts++;
      if (counts == 1) {
        v1 = portal;
        window.plugin.maxlayers.v1 = v1;
        window.plugin.maxlayers.fixLng = Math.cos(v1.lat / 180.0);
      } else if (counts == 2) {
        v2 = portal;
        window.plugin.maxlayers.v2 = v2;
      } else {
        portal.dist = window.plugin.maxlayers.calcDist(portal, v1, v2);
        portalsList2.push(portal);
      }
    }
    if (counts <= 2) return null;

    // 按距离排序列表
    var portalsList3 = window.plugin.maxlayers.sortDist(portalsList2);

    // 计算最大层数
    for (var i = 0; i < portalsList3.length; i++) {
      portalsList3[i].lastPoint = -1;
      portalsList3[i].layersCount = 1;
      for (var j = 0; j < i; j++) {
        var p1 = portalsList3[j];
        var p2 = portalsList3[i];
        if (!window.plugin.maxlayers.pointInTri(p1, v1, v2, p2)) continue;
        if (portalsList3[j].layersCount + 1 >= portalsList3[i].layersCount) {
          //等号为了尽可能取多mu
          portalsList3[i].layersCount = portalsList3[j].layersCount + 1;
          portalsList3[i].lastPoint = j;
        }
      }
    }

    // 返回计划
    var plans = [];
    var stack = [];
    for (
      var x = portalsList3.length - 1;
      x != -1;
      x = portalsList3[x].lastPoint
    )
      stack.push(x);
    while (stack.length > 0) plans.push(portalsList3[stack.pop()]);
    return plans;
  };

  // 获取bookmarks
  window.plugin.maxlayers.getPortalsList = function () {
    var bookmarksList = JSON.parse(localStorage["plugin-bookmarks"]);
    var res = bookmarksList["portals"]["idOthers"]["bkmrk"];
    return res;
  };

  // 点击按钮
  window.plugin.maxlayers.gen = function () {
    if (!window.plugin.bookmarks || !window.plugin.drawTools) {
      alert("先安装iitc、bookmarks插件和drawTools插件");
      return;
    }
    var portalsList = window.plugin.maxlayers.getPortalsList();
    var plans = window.plugin.maxlayers.calc(portalsList);
    if (plans == null) {
      alert("先收藏至少三个点");
      return;
    }
    window.plugin.maxlayers.draw(plans);
    window.plugin.maxlayers.show(plans);
  };

  // 初始化
  window.plugin.maxlayers.init = function () {
    // add controls to toolbox
    var link = $(
      '<a onclick="window.plugin.maxlayers.gen();" title="计算基于双顶点的最大多重层数">Calc Max Layers</a>'
    );
    $("#toolbox").append(link);
  };

  var setup = function () {
    window.addHook("iitcLoaded", window.plugin.maxlayers.init);
  };
  // PLUGIN END //////////////////////////////////////////////////////////

  setup.info = plugin_info; //add the script info data to the function as a property
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  // if IITC has already booted, immediately run the 'setup' function
  if (window.iitcLoaded && typeof setup === "function") setup();
} // wrapper end
// inject code into site context
var script = document.createElement("script");
var info = {};
if (typeof GM_info !== "undefined" && GM_info && GM_info.script)
  info.script = {
    version: GM_info.script.version,
    name: GM_info.script.name,
    description: GM_info.script.description,
  };
script.appendChild(
  document.createTextNode("(" + wrapper + ")(" + JSON.stringify(info) + ");")
);
(document.body || document.head || document.documentElement).appendChild(
  script
);
