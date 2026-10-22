var MIND_GAP_X = 64;
var MIND_GAP_Y = 12;
var mindSizes = {};
var mindStates = {};
var mindDrag = null;
var mindSuppressClick = false;
var mindRevealedId = "";

function mindState() {
  var key = editorKind + ":" + currentChar.id;
  if (!mindStates[key]) mindStates[key] = { shift: {}, collapsed: {}, view: null };
  return mindStates[key];
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

function mindLabel(look, parent, primary) {
  var name = lookShortName(look);
  if (parent && parent !== primary) {
    var prefix = lookShortName(parent);
    if (name.indexOf(prefix) === 0 && name.length > prefix.length) return name.slice(prefix.length).replace(/^-/, "");
  }
  return name;
}

function mindSize(id) {
  return mindSizes[id] || { w: 112, h: 40 };
}

function mindLayout(looks, primary) {
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
  var name = node.parent ? mindLabel(look, node.parent.look, primary) : lookShortName(look);
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
  return '<div class="' + cls + '" data-look-index="' + index + '" data-mind-id="' + look.id + '" title="' + lookShortName(look) + '" style="left:' + node.x + "px;top:" + node.y + 'px">' +
    (picked ? '<span class="mind-check" aria-hidden="true"></span>' : "") +
    body + fold + add + del + "</div>";
}

function renderLookMindMap(library, looks, primary) {
  var st = mindState();
  var hadFocus = library.contains(document.activeElement);
  var all = mindLooks();
  var nodes = mindLayout(all, primary);
  library.classList.add("is-mind");
  library.innerHTML =
    '<div class="mind-map" id="mind-map" tabindex="0" aria-label="' + assetWord() + '思维导图">' +
      '<div class="mind-stage" id="mind-stage">' +
        '<svg class="mind-links" id="mind-links" aria-hidden="true"></svg>' +
        nodes.map(function (node) { return mindNodeHtml(node, all, primary); }).join("") +
      "</div>" +
      '<div class="mind-toolbar">' +
        '<button type="button" data-mind-zoom="-1" aria-label="缩小">−</button>' +
        '<span id="mind-zoom-label">100%</span>' +
        '<button type="button" data-mind-zoom="1" aria-label="放大">＋</button>' +
        '<i></i>' +
        '<button type="button" data-mind-fit>适应画布</button>' +
        '<button type="button" data-mind-reset>重置布局</button>' +
      "</div>" +
      '<p class="mind-hint">拖动空白处移动画布，拖动节点调整整条分支 · 选中后 Tab 新增、Delete 删除</p>' +
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

function drawMindLinks(nodes) {
  var svg = document.getElementById("mind-links");
  if (!svg) return;
  svg.innerHTML = nodes.filter(function (node) { return node.parent; }).map(function (node) {
    var from = node.parent;
    var fromBox = mindSize(from.look.id);
    var toBox = mindSize(node.look.id);
    var dir = node.x >= from.x ? 1 : -1;
    var x1 = from.x + dir * fromBox.w / 2;
    var y1 = from.y;
    var x2 = node.x - dir * toBox.w / 2;
    var y2 = node.y;
    var mid = (x1 + x2) / 2;
    return '<path class="' + (node.depth === 1 ? "is-main" : "") + '" data-link-to="' + node.look.id + '" d="M' + x1 + " " + y1 + " C" + mid + " " + y1 + " " + mid + " " + y2 + " " + x2 + " " + y2 + '"/>';
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

function refreshMindPositions() {
  var nodes = mindLayout(mindLooks(), mindPrimary());
  positionMindNodes(nodes);
  drawMindLinks(nodes);
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
  } else if (zoom) zoomMindView(Number(zoom.dataset.mindZoom) > 0 ? 1.2 : 1 / 1.2);
  else if (e.target.closest("[data-mind-fit]")) fitMindView(mindLayout(mindLooks(), mindPrimary()));
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
  var st = mindState();
  if (!st.view) return;
  mindDrag = {
    id: node ? node.dataset.mindId : "",
    startX: e.clientX,
    startY: e.clientY,
    base: node ? Object.assign({ x: 0, y: 0 }, st.shift[node.dataset.mindId]) : { x: st.view.x, y: st.view.y },
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
    map.classList.add(mindDrag.id ? "is-dragging-node" : "is-panning");
    var dragged = mindDrag.id && map.querySelector('[data-mind-id="' + mindDrag.id + '"]');
    if (dragged) dragged.classList.add("is-dragging");
  }
  var st = mindState();
  if (mindDrag.id) {
    st.shift[mindDrag.id] = { x: mindDrag.base.x + dx / st.view.k, y: mindDrag.base.y + dy / st.view.k };
    refreshMindPositions();
  } else {
    st.view.x = mindDrag.base.x + dx;
    st.view.y = mindDrag.base.y + dy;
    applyMindView();
  }
});

window.addEventListener("pointerup", function () {
  if (!mindDrag) return;
  if (mindDrag.moved) {
    mindSuppressClick = true;
    setTimeout(function () { mindSuppressClick = false; }, 0);
    var map = document.getElementById("mind-map");
    if (map) {
      map.classList.remove("is-dragging-node", "is-panning");
      map.querySelectorAll(".is-dragging").forEach(function (el) { el.classList.remove("is-dragging"); });
    }
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
