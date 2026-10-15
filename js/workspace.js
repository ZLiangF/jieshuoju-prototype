(function () {
  var D = ReplicaData;
  var EPISODE = 1;
  var RANGE = 0.09;
  var MARK_COLORS = { xiaoming: "#f5b83d", hezhi: "#ff6f91", shen: "#4fc3f7" };
  var FALLBACK_COLORS = ["#8bd17c", "#c792ea", "#ff9f5a", "#5ad1c8"];
  var DIR_NAMES = ["面向镜头", "朝右前", "朝右", "朝右后", "背对镜头", "朝左后", "朝左", "朝左前"];

  var state = {
    shotId: D.shots[0].id,
    tab: "clip",
    query: "",
    selectedModel: "seedance-2.0",
    resolution: "720P",
    modelOpen: false,
    resolutionOpen: false,
    generating: null,
    upgrading: null,
    videos: {},
    view: "prompt",
    promptShot: null,
    activeScene: {},
    selected: null,
    peopleOpen: false,
    peopleQuery: "",
    pendingScene: null
  };
  var finalResolution = "1080P";
  var finalCost = 240;
  var stages = {};
  var markSeq = 0;
  var drag = null;
  var dragAsset = null;
  var wheelTimer = null;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function shot() { return D.shots.find(function (x) { return x.id === state.shotId; }); }
  function model() { return D.models.find(function (x) { return x.id === state.selectedModel; }); }
  function charById(id) { return D.characters.find(function (a) { return a.id === id; }); }
  function sceneById(id) { return D.scenes.find(function (a) { return a.id === id; }); }
  function propById(id) { return D.props.find(function (a) { return a.id === id; }); }
  function inEpisode(a) { return (a.eps || []).indexOf(EPISODE) > -1; }
  function lookInEpisode(look) {
    return String(look && look.eps || "").split(",").some(function (part) {
      var range = part.trim().split("-").map(Number);
      if (!range[0]) return false;
      return range.length > 1 ? EPISODE >= range[0] && EPISODE <= range[1] : EPISODE === range[0];
    });
  }
  function activeLook(c) {
    var looks = c && c.looksList || [];
    return looks.find(lookInEpisode) || looks[0] || null;
  }
  function charLabel(c) {
    var look = activeLook(c);
    return look ? look.name : c.name + (c.look ? "-" + c.look : "");
  }
  function outfitImage(c) {
    var look = activeLook(c);
    return look && look.image ? look.image : c.image;
  }
  function mmss(sec) { return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0"); }

  document.getElementById("credits").textContent = ReplicaUI.credits();

  /* ---------- 资产 ---------- */

  function sceneCards(scene) {
    var looks = scene.looksList && scene.looksList.length ? scene.looksList : [{ id: "main", name: scene.name, image: scene.image }];
    return looks.map(function (look, i) {
      return { key: i === 0 ? scene.id : scene.id + "/" + look.id, name: look.name, image: look.image };
    });
  }

  function refKind(ref) {
    if (charById(ref)) return "char";
    if (D.stageScenes[ref] || sceneById(ref)) return "scene";
    if (propById(ref)) return "prop";
    return "";
  }

  function sceneRef(key) {
    var info = D.stageScenes[key];
    if (info) return { key: key, name: info.name, image: info.image };
    var sc = sceneById(key);
    return sc ? { key: key, name: sc.name, image: sc.image } : null;
  }

  function charCard(c) {
    var placed = state.view === "stage" && boardOf(shot()).marks.some(function (m) { return m.asset === c.id; });
    return '<button class="acard ws-acard is-char' + (placed ? " is-placed" : "") + '" draggable="true" data-asset="' + c.id + '" data-kind="char">' +
      '<span class="thumb"><img loading="lazy" decoding="async" src="' + (c.sheet || c.image) + '" alt=""></span>' +
      '<span class="name">' + charLabel(c) + "</span>" +
      (placed ? '<span class="ws-placed">已站位</span>' : "") + "</button>";
  }

  function sceneCard(s) {
    var inShot = (shot().scenes || []).indexOf(s.key) > -1;
    var hot = "";
    if (inShot) {
      var st = stageOf(shot());
      var n = (st.boards[s.key] && st.boards[s.key].marks.length) || 0;
      hot = '<span class="ws-stage-hot ' + (st.apply ? "is-on" : "is-off") + '" data-stage-open="' + s.key + '" role="button" tabindex="0" aria-label="站位图，当前' + (st.apply ? "已启用" : "已关闭") + '" data-tip="站位图">' +
        stageStatusIcon(st.apply) + (n ? "<em>" + n + "</em>" : "") + "</span>";
    }
    return '<button class="acard ws-acard is-scene" data-asset="' + s.key + '" data-kind="scene">' +
      '<span class="thumb"><img loading="lazy" decoding="async" src="' + s.image + '" alt=""></span>' + hot +
      '<span class="name">' + s.name + "</span></button>";
  }

  function propCard(p) {
    return '<button class="acard ws-acard is-prop" data-asset="' + p.id + '" data-kind="prop">' +
      '<span class="thumb"><img loading="lazy" decoding="async" src="' + p.image + '" alt=""></span><span class="name">' + p.name + "</span></button>";
  }

  function group(icon, title, items, render, empty) {
    return '<div class="cat"><div class="cat-h"><span>' + icon + title + " (" + items.length + ")</span></div>" +
      (items.length ? '<div class="grid-2">' + items.map(render).join("") + "</div>" : '<p class="ws-cat-empty">' + empty + "</p>") + "</div>";
  }

  var ICON_CHAR = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="4.6" r="2.3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.8 12c.5-2.4 2.1-3.6 4.2-3.6s3.7 1.2 4.2 3.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  var ICON_EXPAND = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9.2 6.8M6.5 13.5h-4v-4M2.5 13.5l4.3-4.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_COLLAPSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 2.5 9.5 6.5M9.5 3v3.5H13M2.5 13.5l4-4M3 9.5h3.5V13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_ZOOM_OUT = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 7h4M10.4 10.4 13.5 13.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var ICON_ZOOM_IN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 7h4M7 5v4M10.4 10.4 13.5 13.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var ICON_SCENE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2 12.5 5 7 8 1.5 5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="m1.5 8 5.5 3 5.5-3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  var ICON_PROP = '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="4" width="10" height="8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 4V2.8h4V4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

  function assetGroups() {
    var s = shot();
    var q = state.query;
    var hit = function (name) { return !q || name.indexOf(q) > -1; };
    if (state.tab === "clip") {
      var refs = s.refs || [];
      return {
        chars: refs.map(charById).filter(Boolean),
        scenes: refs.filter(function (r) { return refKind(r) === "scene"; }).map(sceneRef).filter(Boolean),
        props: refs.map(propById).filter(Boolean)
      };
    }
    var scenes = [];
    D.scenes.filter(inEpisode).forEach(function (sc) { scenes = scenes.concat(sceneCards(sc)); });
    return {
      chars: D.characters.filter(inEpisode).filter(function (c) { return hit(charLabel(c)); }),
      scenes: scenes.filter(function (sc) { return hit(sc.name); }),
      props: D.props.filter(inEpisode).filter(function (p) { return hit(p.name); })
    };
  }

  function renderAssets() {
    var html;
    if (state.tab === "material") html = '<p class="ws-cat-empty is-center">当前片段暂无素材</p>';
    else {
      var g = assetGroups();
      html = group(ICON_CHAR, "角色", g.chars, charCard, "当前片段暂无角色") +
        group(ICON_SCENE, "场景", g.scenes, sceneCard, "当前片段暂无场景") +
        group(ICON_PROP, "道具", g.props, propCard, "当前片段暂无道具");
      if (state.view === "stage" && state.tab === "clip") html = '<p class="ws-drag-tip">把角色拖进站位图，或点一下放到最近的空位</p>' + html;
    }
    $("#asset-scroll").innerHTML = html;
    $("#asset-scroll").dataset.tab = state.tab;
    var all = D.characters.filter(inEpisode).length + D.props.filter(inEpisode).length;
    D.scenes.filter(inEpisode).forEach(function (sc) { all += sceneCards(sc).length; });
    $("#tab-all").textContent = "资产 (" + all + ")";
    $("#tab-clip").textContent = "当前片段 (" + (shot().refs || []).length + ")";
  }

  /* ---------- 提示词 ---------- */

  var CHIP_ICONS = { c: ICON_CHAR, s: ICON_SCENE, p: ICON_PROP };
  var ICON_STAGE = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M3 6V3h3M12 3h3v3M15 12v3h-3M6 15H3v-3" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/><circle cx="9" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.35"/><path d="M5.8 13c.5-2.1 1.6-3.2 3.2-3.2s2.7 1.1 3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/></svg>';
  var STATION_RULE = "是站位图参考，严禁生成任何标记服装块到正式视频生成中。";

  function stageStatusIcon(on) {
    var status = on
      ? '<path class="ws-stage-status-path" d="m11.6 13.5 1.5 1.5 2.8-3.1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<path class="ws-stage-status-path" d="M4 4l10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
    return ICON_STAGE.replace("</svg>", status + "</svg>");
  }

  function markPlace(key, m) {
    var name = pointName(key, m.point);
    if (name !== "自由位置") return name;
    var side = m.x < 0.34 ? "图面左侧" : m.x > 0.66 ? "图面右侧" : "图面中央";
    return side + (m.y > 0.82 ? "近处" : m.y < 0.6 ? "远处" : "");
  }

  function markFacing(m) {
    var name = dirName(m.dir);
    return name.indexOf("朝") === 0 ? "身体" + name + "方" : name;
  }

  function stationPrompt(s) {
    if (!stationSnapshot(s)) return "";
    var st = stageOf(s);
    var keys = (s.scenes || []).filter(function (key) { return st.boards[key] && st.boards[key].marks.length; });
    return keys.map(function (key) {
      var lines = st.boards[key].marks.map(function (m) {
        return "{c:" + m.asset + "}站在" + markPlace(key, m) + "，" + markFacing(m) + "。";
      });
      return "{m:" + (keys.length > 1 ? key : "") + "}" + STATION_RULE + lines.join("");
    }).join("");
  }

  function promptText(s) {
    var station = stationPrompt(s);
    if (!station) return s.prompt;
    return s.prompt.replace(/(图中空间：[^\n]*)/, function (line) { return line + station; });
  }

  function promptHtml(s) {
    var text = D.globalPrompt + "\n" + promptText(s);
    var esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.replace(/\{([csptm]):([^}]*)\}/g, function (all, kind, val) {
      if (kind === "t") return '<span class="pchip pc-time" contenteditable="false">◷ ' + val + " s</span>";
      if (kind === "m") {
        var title = val && sceneInfo(val) ? "@站位图·" + sceneInfo(val).name : "@站位图";
        return '<span class="pchip pc-stage" contenteditable="false" title="开启「应用站位」后自动带入，关闭后移除">' + ICON_STAGE + title + "</span>";
      }
      var label = kind === "c" ? (charById(val) ? charLabel(charById(val)) : val)
        : kind === "s" ? (sceneRef(val) || { name: val }).name
        : (propById(val) || { name: val }).name;
      var cls = kind === "c" ? "pc-char" : kind === "s" ? "pc-scene" : "pc-prop";
      return '<span class="pchip ' + cls + '" contenteditable="false">' + CHIP_ICONS[kind] + label + "</span>";
    }).replace(/\n/g, "<br>");
  }

  /* ---------- 站位数据 ---------- */

  function sceneInfo(key) { return D.stageScenes[key]; }
  function colorOf(asset) {
    if (MARK_COLORS[asset]) return MARK_COLORS[asset];
    var i = D.characters.findIndex(function (c) { return c.id === asset; });
    return FALLBACK_COLORS[Math.max(0, i) % FALLBACK_COLORS.length];
  }

  function newMark(asset, pt, dir) {
    markSeq += 1;
    return { id: "m" + markSeq, asset: asset, x: pt.x, y: pt.y, ax: pt.x, ay: pt.y, point: pt.id, dir: dir || 0, locked: false, h: null };
  }

  function stageOf(s) {
    if (!stages[s.id]) {
      var boards = {};
      (s.scenes || []).forEach(function (key) { boards[key] = { marks: [], calib: [] }; });
      (s.anchors || []).forEach(function (a) {
        var info = sceneInfo(a.scene);
        var pt = info && info.points.find(function (p) { return p.id === a.point; });
        if (pt && boards[a.scene]) boards[a.scene].marks.push(newMark(a.asset, pt, a.dir));
      });
      stages[s.id] = { apply: false, boards: boards, past: [], future: [] };
    }
    return stages[s.id];
  }

  function activeKey(s) {
    if (!state.activeScene[s.id]) state.activeScene[s.id] = (s.scenes || [])[0];
    return state.activeScene[s.id];
  }
  function boardOf(s) { return stageOf(s).boards[activeKey(s)] || { marks: [], calib: [] }; }
  function markCount(s) {
    var n = 0;
    var b = stageOf(s).boards;
    Object.keys(b).forEach(function (k) { n += b[k].marks.length; });
    return n;
  }
  function selectedMark() {
    return boardOf(shot()).marks.find(function (m) { return m.id === state.selected; }) || null;
  }

  function perspective(key, board) {
    var info = sceneInfo(key);
    var y0 = info.horizon;
    var c = board.calib;
    if (c.length >= 2) {
      var a = c[c.length - 2], b = c[c.length - 1];
      if (Math.abs(a.y - b.y) > 0.06) {
        var k2 = (a.h - b.h) / (a.y - b.y);
        if (k2 > 0.05) {
          var y02 = a.y - a.h / k2;
          if (y02 < Math.min(a.y, b.y) - 0.02) return { k: k2, y0: y02, level: 2 };
        }
      }
    }
    if (c.length) {
      var last = c[c.length - 1];
      if (last.y - y0 > 0.02) return { k: last.h / (last.y - y0), y0: y0, level: 1 };
    }
    return { k: info.k, y0: y0, level: 0 };
  }

  function markHeight(m, p) {
    if (m.locked) return m.h;
    return clamp(p.k * (m.y - p.y0), 0.06, 0.95);
  }

  function snapshot(st) { return JSON.stringify(st.boards); }
  function remember() {
    var st = stageOf(shot());
    st.past.push(snapshot(st));
    if (st.past.length > 60) st.past.shift();
    st.future = [];
  }
  function restore(dir) {
    var st = stageOf(shot());
    var from = dir === "undo" ? st.past : st.future;
    var to = dir === "undo" ? st.future : st.past;
    if (!from.length) return false;
    to.push(snapshot(st));
    st.boards = JSON.parse(from.pop());
    if (!selectedMark()) state.selected = null;
    return true;
  }

  function dirName(deg) { return DIR_NAMES[Math.round(((deg % 360) + 360) % 360 / 45) % 8]; }
  function pointName(key, id) {
    var p = sceneInfo(key).points.find(function (x) { return x.id === id; });
    return p ? p.name : "自由位置";
  }

  function snapTarget(key, board, origin) {
    var used = {};
    board.marks.forEach(function (m) { used[m.point] = true; });
    var byDistance = sceneInfo(key).points.slice().sort(function (a, b) {
      return Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y);
    });
    return { used: used, nearest: byDistance[0], free: byDistance.filter(function (p) { return !used[p.id]; }) };
  }

  function placeAsset(assetId, at, addedToShot) {
    var s = shot();
    var key = activeKey(s);
    var board = boardOf(s);
    var c = charById(assetId);
    if (!c) return;
    var existing = board.marks.find(function (m) { return m.asset === assetId; });
    if (existing) {
      state.selected = existing.id;
      renderStage();
      ReplicaUI.toast(c.name + " 已在这张图上，可以直接拖动调整");
      return;
    }
    var origin = at || { x: 0.5, y: 0.8 };
    var snap = snapTarget(key, board, origin);
    var free = snap.free, nearest = snap.nearest, used = snap.used;
    var pt = free[0] || { id: "free-" + (markSeq + 1), x: origin.x, y: origin.y };
    remember();
    var mark = newMark(assetId, pt, 0);
    board.marks.push(mark);
    state.selected = mark.id;
    renderAll();
    if (!free.length) ReplicaUI.toast("预设点位都有人了，已放在松手的位置");
    else if (at && nearest && used[nearest.id]) ReplicaUI.toast("「" + nearest.name + "」已有人，已吸附到旁边的「" + pt.name + "」");
    else ReplicaUI.toast((addedToShot ? c.name + " 已加入当前片段，并放到「" : c.name + " 已放到「") + pt.name + "」");
  }

  function overlapping(marks, p, canvasW, canvasH) {
    var boxes = marks.map(function (m) {
      var h = markHeight(m, p) * canvasH;
      var w = h * 0.3;
      var x = m.x * canvasW, y = m.y * canvasH;
      return { id: m.id, l: x - w / 2, r: x + w / 2, t: y - h, b: y };
    });
    var hit = {};
    boxes.forEach(function (a, i) {
      boxes.forEach(function (b, j) {
        if (j <= i) return;
        var ix = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        var iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ix > 0 && iy > 0 && ix * iy > 0.22 * Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t))) {
          hit[a.id] = true; hit[b.id] = true;
        }
      });
    });
    return hit;
  }

  /* ---------- 站位渲染 ---------- */

  function fitCanvas() {
    var wrap = $("#sv-wrap");
    var canvas = $("#sv-canvas");
    if (!wrap || !canvas || !$("#stage-modal").classList.contains("open")) return;
    var w = wrap.clientWidth, h = wrap.clientHeight;
    var cw = Math.min(w, h * 16 / 9);
    canvas.style.width = Math.floor(cw) + "px";
    canvas.style.height = Math.floor(cw * 9 / 16) + "px";
  }

  function renderStage() {
    var s = shot();
    var st = stageOf(s);
    var key = activeKey(s);
    var info = sceneInfo(key);
    var board = boardOf(s);
    var scenes = s.scenes || [];

    $("#sv-scenes").innerHTML = scenes.length > 1 ? scenes.map(function (k) {
      var n = (st.boards[k] || { marks: [] }).marks.length;
      return '<button type="button" class="sv-scene' + (k === key ? " on" : "") + '" data-scene="' + k + '">' +
        '<img src="' + sceneInfo(k).image + '" alt=""><span><b>' + sceneInfo(k).name + "</b><small>" + (n ? n + " 人" : "未摆放") + "</small></span></button>";
    }).join("") : '<span class="sv-scene-one">' + ICON_SCENE + info.name + "</span>";

    $("#sv-undo").disabled = !st.past.length;
    $("#sv-redo").disabled = !st.future.length;
    $("#sv-clear").disabled = !board.marks.length;

    var img = $("#sv-image");
    if (img.getAttribute("src") !== info.image) img.setAttribute("src", info.image);
    fitCanvas();
    var p = renderLayer();

    var off = !st.apply && markCount(s) > 0;
    var empty = $("#sv-empty");
    empty.hidden = off || board.marks.length > 0;
    if (!empty.hidden) {
      var parsed = (s.anchors || []).length > 0;
      empty.innerHTML = parsed
        ? "<b>这张图还没有站位</b><span>把下方的角色拖进来，会吸附到最近的空位</span>"
        : "<b>分镜里没有描述人物站位</b><span>没有自动摆放。把下方的角色拖进来，会吸附到最近的预设点位</span>";
    }
    $("#sv-off").hidden = !off;

    renderTray();
    renderHint(p);
  }

  function renderLayer() {
    var s = shot();
    var st = stageOf(s);
    var key = activeKey(s);
    var info = sceneInfo(key);
    var board = boardOf(s);
    var canvas = $("#sv-canvas");
    var cw = canvas.clientWidth || 600, ch = canvas.clientHeight || 338;
    var p = perspective(key, board);
    var hits = overlapping(board.marks, p, cw, ch);
    var sel = selectedMark();
    var used = {};
    board.marks.forEach(function (m) { used[m.point] = true; });

    var html = "";
    if (st.apply || !markCount(s)) {
      html += info.points.map(function (pt) {
        return '<span class="sv-point' + (used[pt.id] ? " is-used" : "") + '" data-point="' + pt.id + '" style="left:' + pt.x * 100 + "%;top:" + pt.y * 100 + '%"><i></i><em>' + pt.name + "</em></span>";
      }).join("");
      if (sel) {
        var rx = RANGE * cw;
        html += '<span class="sv-range" id="sv-range" style="left:' + sel.ax * 100 + "%;top:" + sel.ay * 100 + "%;width:" + rx * 2 + "px;height:" + rx + 'px"></span>';
      }
      html += board.marks.map(function (m) {
        var c = charById(m.asset);
        var hpx = markHeight(m, p) * ch;
        var outfit = c ? outfitImage(c) : "";
        return '<div class="mk' + (m.id === state.selected ? " on" : "") + (hits[m.id] ? " is-overlap" : "") + (m.locked ? " is-locked" : "") + '" data-mark="' + m.id + '" style="left:' + m.x * 100 + "%;top:" + m.y * 100 + "%;--h:" + hpx.toFixed(1) + "px;--c:" + colorOf(m.asset) + '">' +
          '<span class="mk-name">' + (c ? c.name : m.asset) + (m.locked ? " · 锁" : "") + "</span>" +
          '<span class="mk-head"><span class="mk-dir" style="transform:rotate(' + (-m.dir) + 'deg)"><i data-rotate="' + m.id + '" title="拖动调整朝向"></i></span></span>' +
          '<span class="mk-body">' + (outfit ? '<img class="mk-wear" src="' + outfit + '" alt="" draggable="false">' : "") + '</span><span class="mk-foot"></span></div>';
      }).join("");
    }
    $("#sv-layer").innerHTML = html;
    renderPop(st.apply ? sel : null, p, cw, ch);
    return p;
  }

  function renderPop(m, p, cw, ch) {
    var pop = $("#sv-pop");
    if (!m || (drag && (drag.type === "move" || drag.type === "rotate"))) { pop.hidden = true; return; }
    var h = markHeight(m, p);
    var pct = Math.round(h * 100);
    pop.innerHTML =
      '<button type="button" data-sv="rot" data-step="45" title="向左转 45°">↺</button><em class="sv-pop-dir">' + dirName(m.dir) + '</em><button type="button" data-sv="rot" data-step="-45" title="向右转 45°">↻</button>' +
      '<i class="sv-pop-sep"></i>' +
      '<button type="button" class="sv-pop-icon" data-sv="size" data-step="-0.03" title="缩小（也可以滚动鼠标滚轮）" aria-label="缩小">' + ICON_ZOOM_OUT + '</button><em class="sv-pop-size">' + pct + '%</em><button type="button" class="sv-pop-icon" data-sv="size" data-step="0.03" title="放大（也可以滚动鼠标滚轮）" aria-label="放大">' + ICON_ZOOM_IN + "</button>" +
      '<i class="sv-pop-sep"></i>' +
      '<button type="button" class="sv-pop-text' + (m.locked ? " on" : "") + '" data-sv="lock" title="楼梯、高台等不在地面的位置，锁定后不参与近大远小">' + (m.locked ? "已锁定" : "锁定大小") + "</button>" +
      '<button type="button" class="sv-pop-text is-danger" data-sv="remove" title="移出场景（Delete）">移出</button>';
    pop.hidden = false;
    var canvas = $("#sv-canvas");
    var wrap = $("#sv-wrap");
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = canvas.offsetLeft + m.x * cw;
    var headTop = canvas.offsetTop + m.y * ch - h * ch - 30;
    var y = headTop - ph - 4;
    if (y < 0) y = canvas.offsetTop + m.y * ch + 12;
    if (y + ph > wrap.clientHeight) y = Math.max(0, canvas.offsetTop + 6);
    pop.style.left = clamp(x - pw / 2, 4, Math.max(4, wrap.clientWidth - pw - 4)) + "px";
    pop.style.top = y + "px";
  }

  function renderHint(p) {
    var s = shot();
    var m = stageOf(s).apply ? selectedMark() : null;
    var level = p.level === 2 ? "已按 2 个远近不同的人校准" : p.level === 1 ? "已按 1 个人校准，再调一个远近不同的人会更准" : "按落脚点自动计算，离画面底部越远越小";
    var small = $("#sv-canvas").clientHeight < 280 && !state.full;
    var text;
    if (m) {
      var c = charById(m.asset);
      text = "<b>" + (c ? charLabel(c) : m.asset) + "</b> · " + pointName(activeKey(s), m.point) + " · " + (m.locked ? "大小已锁定，不参与近大远小" : "近大远小：" + level);
    }
    else if (boardOf(s).marks.length) text = "点人物选中 · 拖动调位置 · 拖头顶三角改朝向 · 滚轮调大小";
    else text = "";
    $("#sv-hint").innerHTML = text + (small ? (text ? " · " : "") + '<button type="button" data-act="full">画面太小？全屏编辑</button>' : "");
  }

  function setHeight(m, h) {
    var board = boardOf(shot());
    h = clamp(h, 0.06, 0.95);
    if (m.locked) { m.h = h; return; }
    board.calib = board.calib.filter(function (c) { return c.mark !== m.id; });
    board.calib.push({ mark: m.id, y: m.y, h: h });
  }

  function renderTray() {
    var s = shot();
    var key = activeKey(s);
    var board = boardOf(s);
    var chars = (s.refs || []).map(charById).filter(Boolean);
    var off = {};
    (s.offscreen || []).forEach(function (o) { off[o.asset] = o.note; });
    $("#sv-tray").innerHTML = '<span class="sv-tray-h">本片段角色</span>' + chars.map(function (c) {
      var m = board.marks.find(function (x) { return x.asset === c.id; });
      var note = m ? "已站位" : off[c.id] ? off[c.id] : "未摆放";
      return '<button type="button" class="sv-chip' + (m ? " is-placed" : "") + (off[c.id] && !m ? " is-off" : "") + '" draggable="' + (m ? "false" : "true") + '" data-asset="' + c.id + '" data-kind="char"' + (m ? ' data-select="' + m.id + '"' : "") + ' style="--c:' + colorOf(c.id) + '">' +
        "<i></i><b>" + c.name + "</b><small>" + note + "</small></button>";
    }).join("") + (chars.length ? "" : '<small class="sv-tray-none">这个片段没有引用角色</small>');
    if (!sceneInfo(key)) $("#sv-tray").innerHTML = "";
    renderPeoplePicker();
  }

  function renderPeoplePicker() {
    var picker = $("#sv-person-picker");
    var toggle = $(".sv-add-person");
    picker.hidden = !state.peopleOpen;
    toggle.classList.toggle("on", state.peopleOpen);
    toggle.setAttribute("aria-expanded", state.peopleOpen ? "true" : "false");
    if (!state.peopleOpen) return;

    var input = $("#sv-person-search");
    if (input.value !== state.peopleQuery) input.value = state.peopleQuery;
    var s = shot();
    var refs = s.refs || [];
    var board = boardOf(s);
    var q = state.peopleQuery.trim().toLowerCase();
    var chars = D.characters.filter(inEpisode).filter(function (c) {
      return !q || (c.name + " " + charLabel(c) + " " + (c.role || "")).toLowerCase().indexOf(q) > -1;
    });
    $("#sv-person-list").innerHTML = chars.length ? chars.map(function (c) {
      var placed = board.marks.some(function (m) { return m.asset === c.id; });
      var referenced = refs.indexOf(c.id) > -1;
      return '<button type="button" class="sv-person-row' + (placed ? " is-placed" : "") + '" data-stage-person="' + c.id + '"' + (placed ? " disabled" : "") + ">" +
        '<img src="' + outfitImage(c) + '" alt="" loading="lazy" decoding="async">' +
        '<span><b>' + c.name + "</b><small>" + (c.role || "角色") + (referenced ? " · 本片段" : " · 角色库") + "</small></span>" +
        '<em>' + (placed ? "已在图中" : referenced ? "添加" : "加入并添加") + "</em></button>";
    }).join("") : '<div class="sv-person-empty">没有找到角色</div>';
  }

  function addStagePerson(assetId) {
    var s = shot();
    var c = charById(assetId);
    if (!c) return;
    if (!s.refs) s.refs = [];
    var added = (s.refs || []).indexOf(assetId) < 0;
    if (added) s.refs.push(assetId);
    s.offscreen = (s.offscreen || []).filter(function (item) { return item.asset !== assetId; });
    state.peopleOpen = false;
    state.peopleQuery = "";
    placeAsset(assetId, null, added);
  }

  /* ---------- 编辑区 / 播放器 / 时间线 ---------- */

  function renderToolbar() {
    var s = shot();
    var m = model();
    var st = stageOf(s);
    $("#model-menu").innerHTML = D.models.map(function (x) {
      var tag = x.tag ? '<span class="model-tag' + (x.draft ? "" : " normal") + '">' + x.tag + "</span>" : "";
      var sub = x.draft ? "480P 低成本预览 · 可升级正片" : "正式视频生成";
      return '<button class="model-option' + (x.id === state.selectedModel ? " on" : "") + '" type="button" data-model="' + x.id + '">' +
        '<span><span class="model-title">' + x.name + tag + "</span><small>" + sub + "</small></span>" +
        '<span class="cost">' + x.cost + " 积分</span></button>";
    }).join("");
    $("#model-menu").classList.toggle("open", state.modelOpen);
    $("#resolution-menu").classList.toggle("open", state.resolutionOpen);
    $("#model-name").innerHTML = m.name + (m.draft ? ' <span class="draft-tag">样片</span>' : "");
    $("#resolution-name").textContent = state.resolution;
    $$("#resolution-menu button").forEach(function (b) {
      b.disabled = !!m.draft && b.dataset.resolution !== "480P";
      b.classList.toggle("on", b.dataset.resolution === state.resolution);
    });
    $("#resolution-btn").title = m.draft ? "样片模式固定生成 480P" : "选择生成分辨率";
    $("#draft-hint").classList.toggle("show", !!m.draft);
    $("#gen-btn").innerHTML = state.generating === s.id
      ? "生成中…"
      : (m.draft ? '生成样片 <span id="gen-cost">' + m.cost + "</span>" : '生成视频 <span id="gen-cost">' + m.cost + "</span>");
    $("#gen-btn").disabled = !!state.generating || !!state.upgrading;

    var sw = $("#stage-switch");
    sw.classList.toggle("on", st.apply);
    sw.setAttribute("aria-checked", st.apply ? "true" : "false");
    sw.disabled = state.generating === s.id || state.upgrading === s.id;
    sw.title = sw.disabled ? "生成中，暂不可切换" : st.apply ? "生成视频时使用站位信息" : "生成视频时不使用站位信息，已有站位会保留";

  }

  function renderEditor() {
    var s = shot();
    $("#shot-title").textContent = "片段 " + s.no;
    var promptKey = s.id + "|" + stationPrompt(s);
    if (state.promptShot !== promptKey) {
      $("#prompt").innerHTML = promptHtml(s);
      if (state.promptShot === null || state.promptShot.split("|")[0] !== s.id) $("#dur").value = s.duration;
      state.promptShot = promptKey;
    }
    $("#stage-modal").classList.toggle("open", state.view === "stage");
    renderToolbar();
    renderPlayer();
    if (state.view === "stage") renderStage();
  }

  function renderPlayer() {
    var s = shot();
    var m = model();
    var video = state.videos[s.id];
    $("#time-label").textContent = "00:00 / " + mmss(s.duration);
    if (state.generating === s.id) {
      $("#stage").innerHTML = '<div class="stage-loading"><div class="spin"></div><div style="margin-top:8px">' + (m.draft ? "480P 样片生成中" : "片段生成中") + "</div></div>";
    } else if (state.upgrading === s.id) {
      $("#stage").innerHTML = '<div class="stage-loading"><div class="spin"></div><div style="margin-top:8px">正在基于样片生成 ' + finalResolution + " 正片</div></div>";
    } else if (video) {
      var frame = sceneInfo((s.scenes || [])[0]) ? sceneInfo(s.scenes[0]).image : "media/scenes/cemetery.png";
      var badges = '<span class="stage-badges">' +
        (video.kind === "draft" ? "" : '<span class="player-status"><i></i>' + (D.models.find(function (x) { return x.id === video.model; }) || m).name + " 正片 · " + video.resolution + "</span>") +
        '<span class="station-badge' + (video.station ? " on" : "") + '">' + (video.station ? "已应用站位" : "未应用站位") + "</span></span>";
      $("#stage").innerHTML = '<img class="video-frame" src="' + frame + '" alt="片段视频">' +
        (video.kind === "draft"
          ? '<button class="upgrade-trigger" data-act="upgrade">✦ 生成 1080P 正片</button><span class="draft-watermark">Seedance 2.5 · 样片 480P</span>'
          : "") + badges;
    } else {
      $("#stage").textContent = "暂无视频";
    }
  }

  function renderTimeline() {
    var total = 0;
    D.shots.forEach(function (s) { total += s.duration; });
    $("#tl-total").textContent = "00:00/" + mmss(total);
    $("#tl-track").innerHTML = '<button type="button" class="ws-tl-add" data-act="add-shot" title="在开头添加分镜">+</button>' + D.shots.map(function (s) {
      var v = state.videos[s.id];
      var label = v ? (v.kind === "draft" ? "样片" : v.resolution) : "未生成";
      var frame = v && sceneInfo((s.scenes || [])[0]) ? '<img src="' + sceneInfo(s.scenes[0]).image + '" alt="">' : '<span class="ws-tl-empty">◷</span>';
      return '<button class="tcard' + (s.id === state.shotId ? " on" : "") + '" data-shot="' + s.id + '"><span class="ws-tl-frame">' + frame + '</span><span class="num">' + s.no + '</span><span class="state' + (v && v.kind === "draft" ? " draft" : "") + '">' + label + '</span><span class="dur">' + mmss(s.duration) + "</span></button>" +
        '<button type="button" class="ws-tl-add" data-act="add-shot" title="添加分镜">+</button>';
    }).join("");
    $("#shot-list").innerHTML = D.shots.map(function (s) {
      var v = state.videos[s.id];
      var label = v ? (v.kind === "draft" ? "样片 · 480P" : "正片 · " + v.resolution) : "未生成";
      return '<button type="button" class="shot-row' + (s.id === state.shotId ? " on" : "") + '" data-shot="' + s.id + '">' +
        '<span class="shot-no">' + s.no + '</span><span><b>' + s.title + "</b><small>" + s.scene + " · " + s.duration + "s</small></span>" +
        '<span class="shot-state' + (v && v.kind === "draft" ? " draft" : "") + '">' + label + "</span></button>";
    }).join("");
  }

  function renderAll() { renderAssets(); renderEditor(); renderTimeline(); }

  function openStage(key, turnOn) {
    var s = shot();
    if ((s.scenes || []).indexOf(key) < 0) {
      ReplicaUI.toast("这张场景图不在当前片段里");
      return;
    }
    state.activeScene[s.id] = key;
    var st = stageOf(s);
    var turned = !!(turnOn && !st.apply);
    if (turned) st.apply = true;
    state.view = "stage";
    state.selected = null;
    state.peopleOpen = false;
    state.peopleQuery = "";
    renderAll();
    if (turned) ReplicaUI.toast("已开启应用站位");
  }

  function closeStage() {
    if (state.view !== "stage") return;
    state.view = "prompt";
    state.selected = null;
    state.peopleOpen = false;
    state.peopleQuery = "";
    renderAll();
  }

  function stationSnapshot(s) {
    var st = stageOf(s);
    return st.apply && markCount(s) > 0;
  }

  /* ---------- 事件 ---------- */

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act],[data-shot],[data-tab],[data-asset],[data-model],[data-resolution],[data-sv],[data-scene],[data-select],[data-stage-open],[data-stage-person]");
    if (state.peopleOpen && !e.target.closest("#sv-person-picker") && !e.target.closest(".sv-add-person")) {
      state.peopleOpen = false;
      state.peopleQuery = "";
      renderPeoplePicker();
    }
    if (!e.target.closest(".model-wrap") && (state.modelOpen || state.resolutionOpen)) {
      state.modelOpen = false;
      state.resolutionOpen = false;
      renderToolbar();
    }
    if (!t) return;
    if (t.dataset.stageOpen) { openStage(t.dataset.stageOpen, false); return; }
    if (t.dataset.stagePerson) { addStagePerson(t.dataset.stagePerson); return; }
    if (t.dataset.scene) {
      state.activeScene[state.shotId] = t.dataset.scene;
      state.selected = null;
      renderAll();
      return;
    }
    if (t.dataset.select) { state.selected = t.dataset.select; renderStage(); return; }
    if (t.dataset.sv) { stageAction(t.dataset.sv, t); return; }
    if (t.dataset.shot) {
      state.shotId = t.dataset.shot;
      state.selected = null;
      $("#list-drawer").classList.remove("open");
      renderAll();
      return;
    }
    if (t.dataset.tab) {
      state.tab = t.dataset.tab;
      $$(".asset-tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === state.tab); });
      renderAssets();
      return;
    }
    if (t.dataset.asset) {
      var kind = t.dataset.kind;
      if (state.view === "stage" && kind === "char") { placeAsset(t.dataset.asset, null); return; }
      if (state.view === "stage" && kind === "prop") { ReplicaUI.toast("站位图暂时只摆角色，道具按提示词描述生成"); return; }
      if (state.view === "stage" && kind === "scene") {
        var s0 = shot();
        if ((s0.scenes || []).indexOf(t.dataset.asset) > -1) { state.activeScene[s0.id] = t.dataset.asset; state.selected = null; renderAll(); return; }
        ReplicaUI.toast("这张场景图不在当前片段里");
        return;
      }
      ReplicaUI.toast("已选中 " + (t.querySelector(".name") || t).textContent);
      return;
    }
    if (t.dataset.model) {
      state.selectedModel = t.dataset.model;
      state.resolution = model().draft ? "480P" : "720P";
      state.modelOpen = false;
      renderToolbar();
      return;
    }
    if (t.dataset.resolution) {
      if (!t.disabled) state.resolution = t.dataset.resolution;
      state.resolutionOpen = false;
      renderToolbar();
      return;
    }
    var act = t.getAttribute("data-act");
    if (act === "list") $("#list-drawer").classList.add("open");
    if (act === "close-list") $("#list-drawer").classList.remove("open");
    if (act === "export") $("#export-modal").classList.add("open");
    if (act === "close-export") $("#export-modal").classList.remove("open");
    if (act === "add") ReplicaUI.toast("演示：新增素材");
    if (act === "add-shot") ReplicaUI.toast("演示：添加分镜");
    if (act === "multi") ReplicaUI.toast("演示：多选片段");
    if (act === "play") ReplicaUI.toast("演示：播放全集预览");
    if (act === "history") ReplicaUI.toast("演示：查看生成历史");
    if (act === "player-tool") ReplicaUI.toast("演示：" + t.title);
    if (act === "match") {
      var on = !t.classList.contains("on");
      t.classList.toggle("on", on);
      t.setAttribute("aria-checked", on ? "true" : "false");
    }
    if (act === "close-stage") { closeStage(); return; }
    if (act === "toggle-stage-people") {
      state.peopleOpen = !state.peopleOpen;
      state.peopleQuery = "";
      renderPeoplePicker();
      if (state.peopleOpen) setTimeout(function () { $("#sv-person-search").focus(); }, 0);
      return;
    }
    if (act === "close-stage-people") {
      state.peopleOpen = false;
      state.peopleQuery = "";
      renderPeoplePicker();
      return;
    }
    if (act === "stage-switch") {
      if (t.disabled) return;
      var st = stageOf(shot());
      st.apply = !st.apply;
      state.selected = null;
      renderAll();
      ReplicaUI.toast(st.apply ? "已开启应用站位" : "已关闭应用站位，站位已保留");
    }
    if (act === "toggle-model") {
      state.modelOpen = !state.modelOpen;
      state.resolutionOpen = false;
      renderToolbar();
    }
    if (act === "toggle-resolution") {
      state.resolutionOpen = !state.resolutionOpen;
      state.modelOpen = false;
      renderToolbar();
    }
    if (act === "rewrite") ReplicaUI.toast("演示：AI 改写提示词");
    if (act === "timer") ReplicaUI.toast("演示：定时生成");
    if (act === "full") setFull(!state.full);
    if (act === "upgrade") {
      var upgradingShot = state.shotId;
      var keepStation = (state.videos[upgradingShot] || {}).station;
      state.upgrading = upgradingShot;
      D.credits -= finalCost;
      $("#credits").textContent = ReplicaUI.credits();
      renderAll();
      ReplicaUI.toast("Step 2 已提交 · " + finalResolution + " 正片独立计费");
      setTimeout(function () {
        state.videos[upgradingShot] = { kind: "final", resolution: finalResolution, model: "seedance-2.5", station: keepStation };
        state.upgrading = null;
        renderAll();
        ReplicaUI.toast("正片生成完成 · " + finalResolution);
      }, 1800);
    }
    if (act === "generate") {
      var generatingShot = state.shotId;
      var generatingModel = model();
      var generatingResolution = state.resolution;
      var st2 = stageOf(shot());
      var useStation = stationSnapshot(shot());
      if (st2.apply && !useStation) ReplicaUI.toast("暂无站位，将按普通方式生成");
      state.generating = generatingShot;
      D.credits -= generatingModel.cost;
      $("#credits").textContent = ReplicaUI.credits();
      renderAll();
      if (!(st2.apply && !useStation)) ReplicaUI.toast(generatingModel.draft ? "Step 1 已提交 · 480P 样片独立计费" : "已提交生成 · " + generatingModel.cost + " 积分");
      setTimeout(function () {
        state.videos[generatingShot] = {
          kind: generatingModel.draft ? "draft" : "final",
          resolution: generatingResolution,
          model: generatingModel.id,
          station: useStation
        };
        state.generating = null;
        renderAll();
        ReplicaUI.toast(generatingModel.draft ? "480P 样片生成完成，可继续生成正片" : "片段生成完成");
      }, 1800);
    }
  });

  function stageAction(action, el) {
    var s = shot();
    var st = stageOf(s);
    var board = boardOf(s);
    var m = selectedMark();
    if (action === "undo" || action === "redo") {
      if (restore(action)) renderAll();
      return;
    }
    if (action === "clear") {
      if (!board.marks.length) return;
      remember();
      board.marks = [];
      board.calib = [];
      state.selected = null;
      renderAll();
      ReplicaUI.toast("已清空「" + sceneInfo(activeKey(s)).name + "」的站位，可撤销");
      return;
    }
    if (action === "turn-on") { st.apply = true; renderAll(); return; }
    if (action === "scene-changed") {
      state.pendingScene = activeKey(s);
      $("#scene-changed-desc").textContent = "「" + sceneInfo(state.pendingScene).name + "」重新生成后，画面里的地面和物体位置可能变了。保留会沿用现在的站位，建议检查一遍；清空后可以重新拖入。";
      $("#scene-changed-modal").classList.add("open");
      return;
    }
    if (action === "scene-keep" || action === "scene-clear") {
      $("#scene-changed-modal").classList.remove("open");
      var target = st.boards[state.pendingScene];
      if (action === "scene-clear" && target && target.marks.length) {
        remember();
        target.marks = [];
        target.calib = [];
        state.selected = null;
        renderAll();
        ReplicaUI.toast("已清空站位，可撤销");
      } else {
        ReplicaUI.toast("已保留站位，请检查人物位置是否还对");
      }
      return;
    }
    if (!m) return;
    if (action === "rot") {
      remember();
      m.dir = ((m.dir + Number(el.dataset.step)) % 360 + 360) % 360;
      renderStage();
      return;
    }
    if (action === "size") {
      remember();
      setHeight(m, markHeight(m, perspective(activeKey(s), board)) + Number(el.dataset.step));
      renderStage();
      return;
    }
    if (action === "lock") {
      remember();
      var p = perspective(activeKey(s), board);
      if (!m.locked) { m.h = markHeight(m, p); m.locked = true; board.calib = board.calib.filter(function (c) { return c.mark !== m.id; }); }
      else { m.locked = false; m.h = null; }
      renderStage();
      ReplicaUI.toast(m.locked ? "已锁定大小，不再参与近大远小" : "已解除锁定，按近大远小自动缩放");
      return;
    }
    if (action === "remove") {
      remember();
      board.marks = board.marks.filter(function (x) { return x.id !== m.id; });
      board.calib = board.calib.filter(function (c) { return c.mark !== m.id; });
      state.selected = null;
      renderAll();
    }
  }

  /* 拖入：资产卡 / 本片段角色 → 站位图 */
  document.addEventListener("dragstart", function (e) {
    var src = e.target.closest && e.target.closest("[data-asset]");
    if (!src) return;
    e.dataTransfer.setData("text/plain", src.dataset.kind + ":" + src.dataset.asset);
    e.dataTransfer.effectAllowed = "copy";
    dragAsset = { kind: src.dataset.kind, id: src.dataset.asset };
  });
  document.addEventListener("dragend", function () { dragAsset = null; clearDropTarget(); });
  var canvasEl = $("#sv-canvas");
  function clearDropTarget() {
    canvasEl.classList.remove("is-drop");
    $$(".sv-point.is-target").forEach(function (el) { el.classList.remove("is-target"); });
  }
  canvasEl.addEventListener("dragover", function (e) {
    if (!stageOf(shot()).apply && markCount(shot()) > 0) return;
    e.preventDefault();
    canvasEl.classList.add("is-drop");
    var board = boardOf(shot());
    var target = null;
    if (dragAsset && dragAsset.kind === "char" && !board.marks.some(function (m) { return m.asset === dragAsset.id; })) {
      var r = canvasEl.getBoundingClientRect();
      var snap = snapTarget(activeKey(shot()), board, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      target = snap.free[0] ? snap.free[0].id : null;
    }
    $$(".sv-point").forEach(function (el) { el.classList.toggle("is-target", el.dataset.point === target); });
  });
  canvasEl.addEventListener("dragleave", function (e) {
    if (!canvasEl.contains(e.relatedTarget)) clearDropTarget();
  });
  canvasEl.addEventListener("drop", function (e) {
    e.preventDefault();
    clearDropTarget();
    dragAsset = null;
    var raw = e.dataTransfer.getData("text/plain").split(":");
    if (raw[0] === "prop") { ReplicaUI.toast("站位图暂时只摆角色，道具按提示词描述生成"); return; }
    if (raw[0] !== "char") { ReplicaUI.toast("请拖入角色"); return; }
    var r = canvasEl.getBoundingClientRect();
    placeAsset(raw[1], { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) });
  });

  /* 拖动标记 / 旋转朝向 */
  function inRange(m, x, y, cw, ch) {
    var rx = RANGE * cw, ry = rx / 2;
    var dx = (x - m.ax) * cw, dy = (y - m.ay) * ch;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  }
  function toRange(m, x, y, cw, ch) {
    var rx = RANGE * cw, ry = rx / 2;
    var dx = (x - m.ax) * cw, dy = (y - m.ay) * ch;
    var f = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    if (f <= 1) return { x: x, y: y };
    return { x: m.ax + dx / f / cw, y: m.ay + dy / f / ch };
  }

  $("#sv-layer").addEventListener("pointerdown", function (e) {
    var rot = e.target.closest("[data-rotate]");
    var el = e.target.closest("[data-mark]");
    if (!el) return;
    e.preventDefault();
    var id = el.dataset.mark;
    var m = boardOf(shot()).marks.find(function (x) { return x.id === id; });
    if (!m) return;
    var wasSelected = state.selected === id;
    state.selected = id;
    var r = canvasEl.getBoundingClientRect();
    drag = { type: rot && wasSelected ? "rotate" : "move", id: id, r: r, sx: e.clientX, sy: e.clientY, ox: m.x, oy: m.y, before: snapshot(stageOf(shot())), moved: false };
    canvasEl.setPointerCapture(e.pointerId);
    renderStage();
  });
  canvasEl.addEventListener("pointermove", function (e) {
    if (!drag || (drag.type !== "move" && drag.type !== "rotate")) return;
    var m = boardOf(shot()).marks.find(function (x) { return x.id === drag.id; });
    if (!m) return;
    var r = drag.r;
    if (drag.type === "rotate") {
      var p = perspective(activeKey(shot()), boardOf(shot()));
      var headY = m.y * r.height - markHeight(m, p) * r.height * 0.89;
      var vx = e.clientX - (r.left + m.x * r.width), vy = e.clientY - (r.top + headY);
      var deg = Math.atan2(vx, vy) * 180 / Math.PI;
      m.dir = ((Math.round(deg / 15) * 15) % 360 + 360) % 360;
      drag.moved = true;
      var dirEl = $('[data-mark="' + m.id + '"] .mk-dir');
      if (dirEl) dirEl.style.transform = "rotate(" + (-m.dir) + "deg)";
      return;
    }
    var nx = clamp(drag.ox + (e.clientX - drag.sx) / r.width, 0, 1);
    var ny = clamp(drag.oy + (e.clientY - drag.sy) / r.height, 0.05, 1);
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 2) drag.moved = true;
    m.x = nx; m.y = ny;
    var mk = $('[data-mark="' + m.id + '"]');
    if (mk) {
      var p2 = perspective(activeKey(shot()), boardOf(shot()));
      mk.style.left = nx * 100 + "%";
      mk.style.top = ny * 100 + "%";
      mk.style.setProperty("--h", (markHeight(m, p2) * r.height).toFixed(1) + "px");
    }
    var range = $("#sv-range");
    if (range) range.classList.toggle("is-out", !inRange(m, nx, ny, r.width, r.height));
  });
  function endPointer() {
    if (!drag || (drag.type !== "move" && drag.type !== "rotate")) return;
    var st = stageOf(shot());
    var m = boardOf(shot()).marks.find(function (x) { return x.id === drag.id; });
    var r = drag.r;
    var bounced = false;
    if (m && drag.type === "move" && !inRange(m, m.x, m.y, r.width, r.height)) {
      var back = toRange(m, m.x, m.y, r.width, r.height);
      m.x = back.x; m.y = back.y;
      bounced = true;
    }
    if (drag.moved) {
      st.past.push(drag.before);
      st.future = [];
    }
    drag = null;
    renderToolbar();
    var mk = bounced && $('[data-mark="' + m.id + '"]');
    if (!mk) { renderStage(); return; }
    var p = perspective(activeKey(shot()), boardOf(shot()));
    mk.classList.add("is-bounce");
    void mk.offsetWidth;
    mk.style.left = m.x * 100 + "%";
    mk.style.top = m.y * 100 + "%";
    mk.style.setProperty("--h", (markHeight(m, p) * r.height).toFixed(1) + "px");
    var range = $("#sv-range");
    if (range) range.classList.remove("is-out");
    ReplicaUI.toast("超出可移动范围，已回弹到圈内");
    setTimeout(renderStage, 300);
  }
  canvasEl.addEventListener("pointerup", endPointer);
  canvasEl.addEventListener("pointercancel", endPointer);
  canvasEl.addEventListener("pointerdown", function (e) {
    if (!e.target.closest("[data-mark]") && state.selected) { state.selected = null; renderStage(); }
  });
  canvasEl.addEventListener("wheel", function (e) {
    var el = e.target.closest("[data-mark]");
    if (!el || !stageOf(shot()).apply) return;
    var board = boardOf(shot());
    var m = board.marks.find(function (x) { return x.id === el.dataset.mark; });
    if (!m) return;
    e.preventDefault();
    if (!wheelTimer) remember();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () { wheelTimer = null; }, 400);
    state.selected = m.id;
    setHeight(m, markHeight(m, perspective(activeKey(shot()), board)) + (e.deltaY < 0 ? 0.01 : -0.01));
    renderStage();
  }, { passive: false });

  function setFull(on) {
    state.full = on;
    document.body.classList.toggle("ws-full", on);
    var btn = $('.ws-icon[data-act="full"]');
    btn.innerHTML = on ? ICON_COLLAPSE : ICON_EXPAND;
    btn.title = on ? "退出全屏（Esc）" : "全屏编辑";
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    renderEditor();
  }

  document.addEventListener("keydown", function (e) {
    var hotKey = e.target.closest && e.target.closest("[data-stage-open]");
    if (hotKey && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openStage(hotKey.dataset.stageOpen, false);
      return;
    }
    if (e.key === "Escape" && state.full && !selectedMark() && !document.querySelector(".modal-mask.open")) { setFull(false); return; }
    if (state.view !== "stage") return;
    if (e.key === "Escape" && state.peopleOpen) {
      state.peopleOpen = false;
      state.peopleQuery = "";
      renderPeoplePicker();
      return;
    }
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
    var meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (restore(e.shiftKey ? "redo" : "undo")) renderAll();
      return;
    }
    if (e.key === "Escape") {
      if ($("#scene-changed-modal").classList.contains("open")) return;
      if (selectedMark()) { state.selected = null; renderStage(); return; }
      closeStage();
      return;
    }
    var m = selectedMark();
    if (!m) return;
    var step = e.shiftKey ? 0.02 : 0.005;
    var moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      var c = $("#sv-canvas");
      remember();
      var next = toRange(m, m.x + moves[e.key][0], m.y + moves[e.key][1], c.clientWidth, c.clientHeight);
      m.x = next.x; m.y = next.y;
      renderStage();
      renderToolbar();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      stageAction("remove");
    }
  });

  $("#stage-modal").addEventListener("click", function (e) { if (e.target === this) closeStage(); });

  window.addEventListener("resize", function () { if (state.view === "stage") renderStage(); });
  $("#sv-image").addEventListener("load", function () { if (state.view === "stage") renderStage(); });

  $("#asset-search").oninput = function () { state.query = this.value; renderAssets(); };
  $("#sv-person-search").oninput = function () {
    state.peopleQuery = this.value;
    renderPeoplePicker();
    $("#sv-person-search").focus();
  };
  renderAll();
})();
