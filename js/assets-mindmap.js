var MIND_GAP_X = 64;
var MIND_GAP_Y = 12;
var MIND_ROW_GAP_X = 18;
var MIND_ROW_GAP_Y = 76;
var ICON_FLOW_DOWN = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="6" y="1.4" width="4" height="4" rx="1" fill="currentColor"/><rect x="1.2" y="10.6" width="3.5" height="3.2" rx=".7" fill="currentColor"/><rect x="6.25" y="10.6" width="3.5" height="3.2" rx=".7" fill="currentColor"/><rect x="11.3" y="10.6" width="3.5" height="3.2" rx=".7" fill="currentColor"/></svg>';
var ICON_FLOW_SIDE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.4" y="6" width="4" height="4" rx="1" fill="currentColor"/><rect x="10.2" y="1.6" width="4.4" height="2.6" rx=".7" fill="currentColor"/><rect x="10.2" y="6.7" width="4.4" height="2.6" rx=".7" fill="currentColor"/><rect x="10.2" y="11.8" width="4.4" height="2.6" rx=".7" fill="currentColor"/></svg>';
var mindSizes = {};
var mindStates = {};
var mindDrag = null;
var mindSuppressClick = false;
var mindRevealedId = "";

function mindState() {
  var key = editorKind + ":" + currentChar.id;
  if (!mindStates[key]) mindStates[key] = { shift: {}, collapsed: {}, view: null, flow: "down" };
  return mindStates[key];
}

function mindFlow() {
  return mindState().flow === "side" ? "side" : "down";
}

function mindLooks() {
  return currentChar.looksList || [];
}

function mindPrimary() {
  var looks = currentChar.looksList || [];
  return looks[primaryLookIndex(looks)];
}

function mindChildren(looks, parent, primary) {
  return looks.filter(function (look) { return isChildOf(look, parent, primary); });
}

function mindSize(id) {
  return mindSizes[id] || { w: 112, h: 40 };
}

function mindLayout(looks, primary) {
  return mindFlow() === "side" ? mindLayoutSide(looks, primary) : mindLayoutDown(looks, primary);
}

function mindLayoutSide(looks, primary) {
  var st = mindState();
  var nodes = [];
  var colWidth = [];
  if (!primary) return nodes;
  function span(look) {
    var kids = st.collapsed[look.id] ? [] : mindChildren(looks, look, primary);
    if (!kids.length) return mindSize(look.id).h + MIND_GAP_Y;
    return kids.reduce(function (sum, kid) { return sum + span(kid); }, 0);
  }
  function place(look, parent, depth, top, sx, sy) {
    var own = st.shift[look.id] || { x: 0, y: 0 };
    sx += own.x;
    sy += own.y;
    var node = { look: look, parent: parent, depth: depth, sx: sx, x: 0, y: top + span(look) / 2 + sy };
    colWidth[depth] = Math.max(colWidth[depth] || 0, mindSize(look.id).w);
    nodes.push(node);
    if (st.collapsed[look.id]) return;
    var cursor = top;
    mindChildren(looks, look, primary).forEach(function (kid) {
      place(kid, node, depth + 1, cursor, sx, sy);
      cursor += span(kid);
    });
  }
  var rootShift = st.shift[primary.id] || { x: 0, y: 0 };
  var root = { look: primary, parent: null, depth: 0, x: rootShift.x, y: rootShift.y };
  nodes.push(root);
  if (st.collapsed[primary.id]) return nodes;
  var first = mindChildren(looks, primary, primary);
  var height = first.reduce(function (sum, kid) { return sum + span(kid); }, 0);
  var cursor = -height / 2;
  first.forEach(function (kid) {
    place(kid, root, 1, cursor, rootShift.x, rootShift.y);
    cursor += span(kid);
  });
  var left = [0, mindSize(primary.id).w / 2 + MIND_GAP_X];
  for (var d = 2; d < colWidth.length; d++) left[d] = left[d - 1] + colWidth[d - 1] + MIND_GAP_X;
  nodes.forEach(function (node) {
    if (node.parent) node.x = node.sx + left[node.depth] + mindSize(node.look.id).w / 2;
  });
  return nodes;
}

function mindLayoutDown(looks, primary) {
  var st = mindState();
  var nodes = [];
  var rowHeight = [];
  if (!primary) return nodes;
  function span(look) {
    var kids = st.collapsed[look.id] ? [] : mindChildren(looks, look, primary);
    var own = mindSize(look.id).w + MIND_ROW_GAP_X;
    if (!kids.length) return own;
    return Math.max(own, kids.reduce(function (sum, kid) { return sum + span(kid); }, 0));
  }
  function place(look, parent, depth, left, sy) {
    var own = st.shift[look.id] || { x: 0, y: 0 };
    var wide = span(look);
    var node = { look: look, parent: parent, depth: depth, sy: sy + own.y, x: left + wide / 2 + own.x, y: 0 };
    rowHeight[depth] = Math.max(rowHeight[depth] || 0, mindSize(look.id).h);
    nodes.push(node);
    if (st.collapsed[look.id]) return;
    var kids = mindChildren(looks, look, primary);
    var kidsWide = kids.reduce(function (sum, kid) { return sum + span(kid); }, 0);
    var cursor = left + own.x + (wide - kidsWide) / 2;
    kids.forEach(function (kid) {
      place(kid, node, depth + 1, cursor, sy + own.y);
      cursor += span(kid);
    });
  }
  var rootShift = st.shift[primary.id] || { x: 0, y: 0 };
  var root = { look: primary, parent: null, depth: 0, sy: rootShift.y, x: rootShift.x, y: rootShift.y };
  nodes.push(root);
  rowHeight[0] = mindSize(primary.id).h;
  if (!st.collapsed[primary.id]) {
    var first = mindChildren(looks, primary, primary);
    var width = first.reduce(function (sum, kid) { return sum + span(kid); }, 0);
    var cursor = rootShift.x - width / 2;
    first.forEach(function (kid) {
      place(kid, root, 1, cursor, rootShift.y);
      cursor += span(kid);
    });
  }
  var top = [rootShift.y];
  for (var d = 1; d < rowHeight.length; d++) {
    top[d] = top[d - 1] + rowHeight[d - 1] / 2 + MIND_ROW_GAP_Y + rowHeight[d] / 2;
  }
  nodes.forEach(function (node) {
    if (node.parent) node.y = top[node.depth] + node.sy - rootShift.y;
  });
  return nodes;
}

function measureMindNodes() {
  var changed = false;
  document.querySelectorAll("#mind-stage [data-mind-id]").forEach(function (el) {
    var w = el.offsetWidth;
    var h = el.offsetHeight;
    if (!w) return;
    var old = mindSizes[el.dataset.mindId];
    if (old && old.w === w && old.h === h) return;
    mindSizes[el.dataset.mindId] = { w: w, h: h };
    changed = true;
  });
  return changed;
}

function mindVoiceHtml() {
  if (editorKind !== "char" || !charVoiceReady(currentChar)) return "";
  var bind = currentChar.voiceBind;
  if (bind && !charVoiceOn(currentChar)) {
    return '<span class="mind-voice is-empty"><button type="button" class="mind-voice-open" data-mind-voice-open title="点击开启">♪ 音色已关闭</button></span>';
  }
  return bind
    ? '<span class="mind-voice"><button type="button" class="asset-voice-play" data-mind-voice-play aria-label="试听' + bind.name + '">▶</button>' +
      '<b>' + bind.name + '</b><button type="button" class="mind-voice-open" data-mind-voice-open title="更换音色">更换</button></span>'
    : '<span class="mind-voice is-empty"><button type="button" class="mind-voice-open" data-mind-voice-open>♪ 绑定音色</button></span>';
}

function mindNodeHtml(node, looks, primary) {
  var look = node.look;
  var list = currentChar.looksList || [];
  var index = list.indexOf(look);
  var state = lookVisualState(look, index);
  var st = mindState();
  var kids = mindChildren(looks, look, primary).length;
  var folded = !!st.collapsed[look.id];
  var multi = editorKind === "char" && lookMultiOn;
  var picked = multi && !!selectedLooks[look.id];
  var name = look.name;
  var meta = episodeLineHtml(look, index, "mind-meta", state === "ready" ? "" : " · " + lookStateText(state));
  var cls = "mind-node is-" + state + (node.parent ? "" : " is-root") +
    (kids ? " has-kids" : "") + (editingLook === look ? " on" : "") + (picked ? " is-look-picked" : "");
  var body = node.parent
    ? '<span class="mind-name">' + name + "</span>" + meta
    : '<span class="mind-root-image">' + (state === "ready"
      ? '<img src="' + look.image + '" alt="' + name + '" draggable="false">'
      : (editorKind === "char" ? EMPTY_PERSON_ICON : EMPTY_IMAGE_ICON)) +
      '<small class="mind-root-tag">主' + assetWord() + "</small>" + mindVoiceHtml() + "</span>" +
      '<span class="mind-name">' + name + "</span>" + meta;
  var add = multi ? "" : '<button type="button" class="mind-add" data-mind-add="' + look.id + '" title="新增子' + assetWord() + '（Tab）" aria-label="在「' + name + '」下新增子' + assetWord() + '">' + PLUS_ICON + "</button>";
  var del = multi || !node.parent ? "" : '<button type="button" class="mind-del" data-del-look="' + look.id + '" title="删除（Delete）" aria-label="删除' + name + '">×</button>';
  var fold = kids
    ? '<button type="button" class="mind-fold" data-mind-fold="' + look.id + '" title="' + (folded ? "展开" : "收起") + '" aria-label="' + (folded ? "展开" : "收起") + "「" + name + "」的子" + assetWord() + '">' + (folded ? kids : "−") + "</button>"
    : "";
  return '<div class="' + cls + '" data-look-index="' + index + '" data-mind-id="' + look.id + '" title="' + look.name + '" style="left:' + node.x + "px;top:" + node.y + 'px">' +
    (picked ? '<span class="mind-check" aria-hidden="true"></span>' : "") +
    body + fold + add + del + "</div>";
}

function renderLookMindMap(library, looks, primary) {
  var st = mindState();
  var hadFocus = library.contains(document.activeElement);
  var all = mindLooks();
  var flow = mindFlow();
  var nodes = mindLayout(all, primary);
  library.classList.add("is-mind");
  library.innerHTML =
    '<div class="mind-map' + (flow === "down" ? " is-flow-down" : " is-flow-side") + '" id="mind-map" tabindex="0" aria-label="' + assetWord() + '思维导图">' +
      '<div class="mind-stage" id="mind-stage">' +
        '<svg class="mind-links" id="mind-links" aria-hidden="true"></svg>' +
        nodes.map(function (node) { return mindNodeHtml(node, all, primary); }).join("") +
      "</div>" +
      '<div class="mind-toolbar">' +
        '<button type="button" class="mind-flow" data-mind-flow aria-label="' + (flow === "down" ? "改为左右排布" : "改为上下排布") + '" title="' + (flow === "down" ? "上下排布，子形象横向排列" : "左右排布，子形象纵向排列") + '">' + (flow === "down" ? ICON_FLOW_DOWN : ICON_FLOW_SIDE) + "</button>" +
        '<i></i>' +
        '<button type="button" data-mind-zoom="-1" aria-label="缩小">−</button>' +
        '<span id="mind-zoom-label">100%</span>' +
        '<button type="button" data-mind-zoom="1" aria-label="放大">＋</button>' +
        '<i></i>' +
        '<button type="button" data-mind-fit>适应画布</button>' +
        '<button type="button" data-mind-reset>重置布局</button>' +
      "</div>" +
      '<p class="mind-hint">拖动空白处移动整体 · 按钮或 Ctrl 滚轮缩放 · 选中后 Tab 新增、Delete 删除</p>' +
    "</div>";
  if (measureMindNodes()) {
    nodes = mindLayout(all, primary);
    positionMindNodes(nodes);
  }
  drawMindLinks(nodes);
  if (!st.view) fitMindView(nodes, 0.3);
  else applyMindView();
  if (editingLook && editingLook.id !== mindRevealedId) {
    mindRevealedId = editingLook.id;
    revealMindNode(editingLook.id);
  }
  if (hadFocus) document.getElementById("mind-map").focus({ preventScroll: true });
}

function mindLinkPath(node) {
  var from = node.parent;
  var fromBox = mindSize(from.look.id);
  var toBox = mindSize(node.look.id);
  if (mindFlow() === "down") {
    var x1 = from.x;
    var y1 = from.y + fromBox.h / 2;
    var x2 = node.x;
    var y2 = node.y - toBox.h / 2;
    var mid = (y1 + y2) / 2;
    return "M" + x1 + " " + y1 + " C" + x1 + " " + mid + " " + x2 + " " + mid + " " + x2 + " " + y2;
  }
  var dir = node.x >= from.x ? 1 : -1;
  var sx = from.x + dir * fromBox.w / 2;
  var sy = from.y;
  var tx = node.x - dir * toBox.w / 2;
  var ty = node.y;
  var mx = (sx + tx) / 2;
  return "M" + sx + " " + sy + " C" + mx + " " + sy + " " + mx + " " + ty + " " + tx + " " + ty;
}

function drawMindLinks(nodes) {
  var svg = document.getElementById("mind-links");
  if (!svg) return;
  svg.innerHTML = nodes.filter(function (node) { return node.parent; }).map(function (node) {
    return '<path class="' + (node.depth === 1 ? "is-main" : "") + '" data-link-to="' + node.look.id + '" d="' + mindLinkPath(node) + '"/>';
  }).join("");
}

function applyMindView() {
  var st = mindState();
  var stage = document.getElementById("mind-stage");
  if (!stage || !st.view) return;
  stage.style.transform = "translate(" + st.view.x + "px," + st.view.y + "px) scale(" + st.view.k + ")";
  var label = document.getElementById("mind-zoom-label");
  if (label) label.textContent = Math.round(st.view.k * 100) + "%";
}

function fitMindView(nodes, minScale) {
  var map = document.getElementById("mind-map");
  if (!map) return;
  var st = mindState();
  var box = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
  nodes.forEach(function (node) {
    var size = mindSize(node.look.id);
    box.l = Math.min(box.l, node.x - size.w / 2);
    box.r = Math.max(box.r, node.x + size.w / 2);
    box.t = Math.min(box.t, node.y - size.h / 2);
    box.b = Math.max(box.b, node.y + size.h / 2);
  });
  var width = map.clientWidth || 400;
  var height = map.clientHeight || 400;
  var pad = 28;
  var topPad = 48;
  var k = Math.min(1, (width - pad * 2) / Math.max(1, box.r - box.l), (height - topPad - pad) / Math.max(1, box.b - box.t));
  var fits = k >= (minScale || 0.3);
  k = Math.max(minScale || 0.3, Math.round(k * 100) / 100);
  var root = nodes[0];
  var cx = fits || !root ? (box.l + box.r) / 2 : root.x;
  var cy = fits || !root ? (box.t + box.b) / 2 : root.y;
  st.view = { k: k, x: width / 2 - cx * k, y: topPad + (height - topPad - pad) / 2 - cy * k };
  applyMindView();
}

function revealMindNode(id) {
  var map = document.getElementById("mind-map");
  var el = map && map.querySelector('[data-mind-id="' + id + '"]');
  var st = mindState();
  if (!el || !st.view) return;
  var m = map.getBoundingClientRect();
  var r = el.getBoundingClientRect();
  var pad = 40;
  var dx = r.left < m.left + pad ? m.left + pad - r.left : r.right > m.right - pad ? m.right - pad - r.right : 0;
  var dy = r.top < m.top + 50 ? m.top + 50 - r.top : r.bottom > m.bottom - pad ? m.bottom - pad - r.bottom : 0;
  if (!dx && !dy) return;
  st.view.x += dx;
  st.view.y += dy;
  applyMindView();
}

function zoomMindView(factor, cx, cy) {
  var st = mindState();
  var map = document.getElementById("mind-map");
  if (!st.view || !map) return;
  var k = Math.min(1.6, Math.max(0.3, st.view.k * factor));
  if (cx == null) {
    cx = map.clientWidth / 2;
    cy = map.clientHeight / 2;
  }
  st.view.x = cx - (cx - st.view.x) * (k / st.view.k);
  st.view.y = cy - (cy - st.view.y) * (k / st.view.k);
  st.view.k = k;
  applyMindView();
}

function positionMindNodes(nodes) {
  nodes.forEach(function (node) {
    var el = document.querySelector('#mind-stage [data-mind-id="' + node.look.id + '"]');
    if (!el) return;
    el.style.left = node.x + "px";
    el.style.top = node.y + "px";
  });
}

function openMindChildDialog(parentId) {
  if (!(currentChar.looksList || []).some(function (look) { return look.id === parentId; })) return;
  newLookParentId = parentId;
  delete mindState().collapsed[parentId];
  openCreateDialog("child");
}

var lookLibraryEl = document.getElementById("look-library");

lookLibraryEl.addEventListener("click", function (e) {
  if (mindSuppressClick) {
    mindSuppressClick = false;
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
  }
  if (!e.target.closest("#mind-map")) return;
  var fold = e.target.closest("[data-mind-fold]");
  var zoom = e.target.closest("[data-mind-zoom]");
  var add = e.target.closest("[data-mind-add]");
  var voicePlay = e.target.closest("[data-mind-voice-play]");
  var handled = true;
  if (add) openMindChildDialog(add.dataset.mindAdd);
  else if (voicePlay) playVoiceSample(currentChar.voiceBind, voicePlay);
  else if (e.target.closest("[data-mind-voice-open]")) openVoiceDialog(currentChar);
  else if (fold) {
    var st = mindState();
    st.collapsed[fold.dataset.mindFold] = !st.collapsed[fold.dataset.mindFold];
    renderLookLibrary();
  }   else if (zoom) zoomMindView(Number(zoom.dataset.mindZoom) > 0 ? 1.2 : 1 / 1.2);
  else if (e.target.closest("[data-mind-flow]")) {
    var flowState = mindState();
    flowState.flow = mindFlow() === "down" ? "side" : "down";
    flowState.view = null;
    renderLookLibrary();
  } else if (e.target.closest("[data-mind-fit]")) fitMindView(mindLayout(mindLooks(), mindPrimary()));
  else if (e.target.closest("[data-mind-reset]")) {
    var state = mindState();
    state.shift = {};
    state.collapsed = {};
    state.view = null;
    renderLookLibrary();
    ReplicaUI.toast("已恢复默认布局");
  } else handled = false;
  if (handled) e.stopImmediatePropagation();
}, true);

lookLibraryEl.addEventListener("keydown", function (e) {
  if (e.target.id !== "mind-map" || !editingLook || (editorKind === "char" && lookMultiOn)) return;
  if (e.key === "Tab") {
    e.preventDefault();
    openMindChildDialog(editingLook.id);
  } else if ((e.key === "Delete" || e.key === "Backspace") && editingLook !== mindPrimary()) {
    e.preventDefault();
    confirmDeleteLooks([editingLook]);
  }
});

lookLibraryEl.addEventListener("pointerdown", function (e) {
  if (e.button !== 0 || !e.target.closest("#mind-map")) return;
  if (e.target.closest("button, .mind-toolbar")) return;
  var node = e.target.closest("[data-mind-id]");
  if (node && !node.classList.contains("is-root")) return;
  var st = mindState();
  if (!st.view) return;
  mindDrag = {
    startX: e.clientX,
    startY: e.clientY,
    baseX: st.view.x,
    baseY: st.view.y,
    moved: false
  };
  mindSuppressClick = false;
});

window.addEventListener("pointermove", function (e) {
  if (!mindDrag) return;
  var dx = e.clientX - mindDrag.startX;
  var dy = e.clientY - mindDrag.startY;
  if (!mindDrag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
  var map = document.getElementById("mind-map");
  if (!map) {
    mindDrag = null;
    return;
  }
  if (!mindDrag.moved) {
    mindDrag.moved = true;
    map.classList.add("is-panning");
  }
  var st = mindState();
  st.view.x = mindDrag.baseX + dx;
  st.view.y = mindDrag.baseY + dy;
  applyMindView();
});

window.addEventListener("pointerup", function () {
  if (!mindDrag) return;
  if (mindDrag.moved) {
    mindSuppressClick = true;
    setTimeout(function () { mindSuppressClick = false; }, 0);
    var map = document.getElementById("mind-map");
    if (map) map.classList.remove("is-panning");
  }
  mindDrag = null;
});

lookLibraryEl.addEventListener("wheel", function (e) {
  var map = e.target.closest("#mind-map");
  if (!map) return;
  var st = mindState();
  if (!st.view) return;
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    var rect = map.getBoundingClientRect();
    zoomMindView(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
    return;
  }
  st.view.x -= e.deltaX;
  st.view.y -= e.deltaY;
  applyMindView();
}, { passive: false });
