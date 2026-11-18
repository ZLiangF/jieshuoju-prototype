(function () {
  var D = ReplicaData;
  var EPISODE = 1;
  var RANGE = 0.09;
  var MARK_COLORS = { xiaoming: "#f5b83d", hezhi: "#ff6f91", shen: "#4fc3f7" };
  var FALLBACK_COLORS = ["#8bd17c", "#c792ea", "#ff9f5a", "#5ad1c8"];
  var DIR_NAMES = ["面向镜头", "朝右前", "朝右", "朝右后", "背对镜头", "朝左后", "朝左", "朝左前"];

  var state = {
    shotId: D.shots[0].id,
    tab: "all",
    query: "",
    assetView: "grid",
    searchOpen: false,
    scopeOpen: false,
    libEpOpen: false,
    collapsedGroups: { char: false, scene: false, prop: false, material: true },
    selectedModel: "seedance-2.0",
    resolution: "720P",
    modelOpen: false,
    resolutionOpen: false,
    ratioOpen: false,
    assetsCollapsed: false,
    generating: null,
    upgrading: null,
    videos: {},
    view: "prompt",
    promptShot: null,
    activeScene: {},
    selected: null,
    peopleOpen: false,
    peopleQuery: "",
    pendingScene: null,
    seqPlay: true,
    muted: false,
    versions: {},
    versionId: null,
    playerExpanded: false,
    replaceTarget: null,
    replaceQuery: ""
  };
  var finalResolution = "1080P";
  var finalCost = 240;
  var stages = {};
  var markSeq = 0;
  var drag = null;
  var dragAsset = null;
  var wheelTimer = null;
  var pendingDeleteAsset = null;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function shot() { return D.shots.find(function (x) { return x.id === state.shotId; }); }
  function segCode(s) { return "1-" + s.no; }
  function versionsOf(shotId) {
    if (!state.versions[shotId]) state.versions[shotId] = [];
    return state.versions[shotId];
  }
  function activeVersion(s) {
    var list = versionsOf(s.id);
    if (!list.length) return null;
    if (state.versionId) {
      var hit = list.find(function (item) { return item.id === state.versionId; });
      if (hit) return hit;
    }
    return list[0];
  }
  function pushVersion(shotId, video) {
    var s = D.shots.find(function (item) { return item.id === shotId; });
    var list = versionsOf(shotId);
    list.forEach(function (item) { item.isNew = false; });
    var frame = s && sceneInfo((s.scenes || [])[0]) ? sceneInfo(s.scenes[0]).image : "media/scenes/cemetery.png";
    var entry = {
      id: "v-" + shotId + "-" + Date.now(),
      label: "S" + (list.length + 1 < 10 ? "0" : "") + (list.length + 1),
      kind: video.kind,
      resolution: video.resolution,
      model: video.model,
      station: video.station,
      image: frame,
      duration: s ? s.duration : 10,
      isNew: true,
      createdAt: Date.now()
    };
    list.unshift(entry);
    state.videos[shotId] = video;
    state.versionId = entry.id;
    return entry;
  }
  function seedDemoVersions() {
    D.shots.slice(0, 3).forEach(function (s, index) {
      if (versionsOf(s.id).length) return;
      var frame = sceneInfo((s.scenes || [])[0]) ? sceneInfo(s.scenes[0]).image : "media/scenes/cemetery.png";
      var count = index === 0 ? 3 : 2;
      for (var i = count; i >= 1; i--) {
        versionsOf(s.id).push({
          id: "v-" + s.id + "-demo-" + i,
          label: "S" + (i < 10 ? "0" : "") + i,
          kind: i === 1 ? "final" : "draft",
          resolution: i === 1 ? "720P" : "480P",
          model: i === 1 ? "seedance-2.0" : "seedance-2.5-draft",
          station: false,
          image: frame,
          duration: s.duration,
          isNew: index === 0 && i === count,
          createdAt: Date.now() - i * 60000
        });
      }
      state.videos[s.id] = {
        kind: versionsOf(s.id)[0].kind,
        resolution: versionsOf(s.id)[0].resolution,
        model: versionsOf(s.id)[0].model,
        station: false
      };
    });
    if (!state.versionId && versionsOf(state.shotId).length) state.versionId = versionsOf(state.shotId)[0].id;
  }
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
    }).filter(function (item) { return !ReplicaUI.deletedAssetName("s", item.key); });
  }

  function refKind(ref) {
    if (charById(ref)) return "char";
    if (D.stageScenes[ref] || sceneById(ref)) return "scene";
    if (propById(ref)) return "prop";
    return "";
  }

  function sceneRef(key) {
    if (ReplicaUI.deletedAssetName("s", key)) return null;
    var info = D.stageScenes[key];
    if (info) {
      var parts = key.split("/");
      var owner = sceneById(parts[0]);
      var look = owner && parts[1] ? (owner.looksList || []).find(function (entry) { return entry.id === parts[1]; }) : null;
      return { key: key, name: look ? look.name : owner ? owner.name : info.name, image: info.image };
    }
    var sc = sceneById(key);
    return sc ? { key: key, name: sc.name, image: sc.image } : null;
  }

  function charCard(c) {
    var placed = state.view === "stage" && boardOf(shot()).marks.some(function (m) { return m.asset === c.id; });
    return '<div class="acard ws-acard is-char' + (placed ? " is-placed" : "") + '" role="button" tabindex="0" draggable="true" data-asset="' + c.id + '" data-kind="char">' +
      '<span class="thumb"><img loading="lazy" decoding="async" src="' + (c.sheet || c.image) + '" alt="">' + assetDeleteButton(c.id, "char", charLabel(c)) +
      (placed ? '<span class="ws-placed">已站位</span>' : "") + "</span>" +
      '<span class="name">' + charLabel(c) + "</span></div>";
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
    return '<div class="acard ws-acard is-scene" role="button" tabindex="0" data-asset="' + s.key + '" data-kind="scene">' +
      '<span class="thumb"><img loading="lazy" decoding="async" src="' + s.image + '" alt="">' + assetDeleteButton(s.key, "scene", s.name) + hot + "</span>" +
      '<span class="name">' + s.name + "</span></div>";
  }

  function propCard(p) {
    return '<div class="acard ws-acard is-prop" role="button" tabindex="0" data-asset="' + p.id + '" data-kind="prop">' +
      '<span class="thumb"><img loading="lazy" decoding="async" src="' + p.image + '" alt="">' + assetDeleteButton(p.id, "prop", p.name) + '</span><span class="name">' + p.name + "</span></div>";
  }

  var ICON_CHAR = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="4.6" r="2.3" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.8 12c.5-2.4 2.1-3.6 4.2-3.6s3.7 1.2 4.2 3.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  var ICON_EXPAND = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9.2 6.8M6.5 13.5h-4v-4M2.5 13.5l4.3-4.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_COLLAPSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 2.5 9.5 6.5M9.5 3v3.5H13M2.5 13.5l4-4M3 9.5h3.5V13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_ZOOM_OUT = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 7h4M10.4 10.4 13.5 13.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var ICON_ZOOM_IN = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 7h4M7 5v4M10.4 10.4 13.5 13.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var ICON_SCENE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2 12.5 5 7 8 1.5 5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="m1.5 8 5.5 3 5.5-3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  var ICON_PROP = '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="4" width="10" height="8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 4V2.8h4V4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  var ICON_FOLDER = '<svg class="ws-folder-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.2c0-.7.5-1.2 1.2-1.2h3.1l1.1 1.2h4.4c.7 0 1.2.5 1.2 1.2v6.2c0 .7-.5 1.2-1.2 1.2H3.7c-.7 0-1.2-.5-1.2-1.2z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>';
  var ICON_DELETE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 4.5V3h4v1.5m1.5 0-.5 9H5l-.5-9M6.8 7v4M9.2 7v4" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function assetDeleteButton(id, kind, name) {
    return '<button class="ws-asset-delete" type="button" data-act="delete-asset" data-asset-id="' + id + '" data-asset-kind="' + kind + '" data-asset-name="' + name + '" aria-label="删除' + name + '" data-tip="删除资产">' + ICON_DELETE + "</button>";
  }

  function assetGroups() {
    var s = shot();
    var q = (state.query || "").trim();
    var hit = function (name) { return !q || String(name).indexOf(q) > -1; };
    if (state.tab === "clip") {
      var refs = s.refs || [];
      return {
        chars: refs.map(charById).filter(Boolean).filter(function (c) { return hit(charLabel(c)); }),
        scenes: refs.filter(function (r) { return refKind(r) === "scene"; }).map(sceneRef).filter(Boolean).filter(function (sc) { return hit(sc.name); }),
        props: refs.map(propById).filter(Boolean).filter(function (p) { return hit(p.name); }),
        materials: []
      };
    }
    var scenes = [];
    D.scenes.filter(inEpisode).forEach(function (sc) { scenes = scenes.concat(sceneCards(sc)); });
    return {
      chars: D.characters.filter(inEpisode).filter(function (c) { return hit(charLabel(c)); }),
      scenes: scenes.filter(function (sc) { return hit(sc.name); }),
      props: D.props.filter(inEpisode).filter(function (p) { return hit(p.name); }),
      materials: []
    };
  }

  function folderGroup(key, title, items, render, empty) {
    var collapsed = !!state.collapsedGroups[key];
    var body = "";
    if (!collapsed) {
      body = items.length
        ? '<div class="ws-lib-body">' + items.map(render).join("") + "</div>"
        : '<p class="ws-cat-empty">' + empty + "</p>";
    }
    return '<section class="ws-folder' + (collapsed ? " is-collapsed" : "") + '" data-folder="' + key + '">' +
      '<button type="button" class="ws-folder-head" data-act="toggle-folder" data-folder="' + key + '" aria-expanded="' + (collapsed ? "false" : "true") + '">' +
      '<span class="ws-folder-arrow" aria-hidden="true">' + (collapsed ? "›" : "⌄") + "</span>" +
      ICON_FOLDER +
      '<span class="ws-folder-name">' + title + '</span><span class="ws-folder-count">(' + items.length + ")</span>" +
      "</button>" + body + "</section>";
  }

  function syncLibChrome() {
    var scopeLabel = state.tab === "clip" ? "当前片段" : "全部";
    var scopeBtn = $("#ws-scope-label");
    if (scopeBtn) scopeBtn.textContent = scopeLabel;
    $$("#ws-scope-menu [data-scope]").forEach(function (btn) {
      btn.setAttribute("aria-checked", btn.dataset.scope === state.tab ? "true" : "false");
    });
    $("#ws-scope-btn").setAttribute("aria-expanded", state.scopeOpen ? "true" : "false");
    $("#ws-scope-menu").hidden = !state.scopeOpen;
    $("#ws-lib-ep-btn").setAttribute("aria-expanded", state.libEpOpen ? "true" : "false");
    $("#ws-lib-ep-menu").hidden = !state.libEpOpen;
    $("#ws-lib-search").hidden = !state.searchOpen;
    $("#ws-lib-search-btn").classList.toggle("on", state.searchOpen);
    $("#ws-lib-search-btn").setAttribute("aria-pressed", state.searchOpen ? "true" : "false");
    $$(".ws-lib-view [data-view]").forEach(function (btn) {
      var on = btn.dataset.view === state.assetView;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    $("#asset-scroll").dataset.view = state.assetView;
    $("#asset-scroll").dataset.tab = state.tab;
  }

  function closeLibMenus() {
    if (!state.scopeOpen && !state.libEpOpen) return;
    state.scopeOpen = false;
    state.libEpOpen = false;
    syncLibChrome();
  }

  function renderAssets() {
    var g = assetGroups();
    var emptyScope = state.tab === "clip" ? "当前片段暂无" : "暂无";
    var html = folderGroup("char", "角色", g.chars, charCard, emptyScope + "角色") +
      folderGroup("scene", "场景", g.scenes, sceneCard, emptyScope + "场景") +
      folderGroup("prop", "道具", g.props, propCard, emptyScope + "道具") +
      folderGroup("material", "素材", g.materials, function () { return ""; }, emptyScope + "素材");
    if (state.view === "stage" && state.tab === "clip") {
      html = '<p class="ws-drag-tip">把角色拖进站位图，或点一下放到最近的空位</p>' + html;
    }
    $("#asset-scroll").innerHTML = html;
    syncLibChrome();
  }

  function openAssetDelete(target) {
    pendingDeleteAsset = target;
    $("#asset-delete-desc").textContent = "删除“" + target.name + "”后，已引用位置将标记为“" + target.name + "-已删除”。";
    $("#asset-delete-modal").classList.add("open");
    setTimeout(function () { $('[data-act="confirm-asset-delete"]', $("#asset-delete-modal")).focus(); }, 0);
  }

  function closeAssetDelete() {
    pendingDeleteAsset = null;
    $("#asset-delete-modal").classList.remove("open");
  }

  function confirmAssetDelete() {
    var target = pendingDeleteAsset;
    if (!target) return;
    if (target.kind === "char") {
      ReplicaUI.rememberDeletedAsset("c", target.id, target.name, "char");
      D.characters = D.characters.filter(function (item) { return item.id !== target.id; });
      Object.keys(stages).forEach(function (shotId) {
        Object.keys(stages[shotId].boards || {}).forEach(function (key) {
          stages[shotId].boards[key].marks = stages[shotId].boards[key].marks.filter(function (mark) { return mark.asset !== target.id; });
        });
      });
    } else if (target.kind === "prop") {
      ReplicaUI.rememberDeletedAsset("p", target.id, target.name, "prop");
      D.props = D.props.filter(function (item) { return item.id !== target.id; });
    } else {
      var parts = target.id.split("/");
      var scene = sceneById(parts[0]);
      if (parts.length > 1) {
        ReplicaUI.rememberDeletedAsset("s", target.id, target.name);
        if (scene && scene.looksList) scene.looksList = scene.looksList.filter(function (look, i) { return i === 0 || look.id !== parts[1]; });
        delete D.stageScenes[target.id];
      } else {
        (scene ? sceneCards(scene) : [target]).forEach(function (card) {
          ReplicaUI.rememberDeletedAsset("s", card.key || target.id, card.name, card.key === target.id ? "scene" : null);
          delete D.stageScenes[card.key || target.id];
        });
        D.scenes = D.scenes.filter(function (item) { return item.id !== target.id; });
      }
      if (state.view === "stage" && (activeKey(shot()) === target.id || activeKey(shot()).indexOf(target.id + "/") === 0)) {
        state.view = "prompt";
        state.selected = null;
      }
    }
    closeAssetDelete();
    state.promptShot = null;
    renderAll();
    ReplicaUI.toast("资产已删除");
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
    function renderTokens(line) {
      var esc = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return esc.replace(/\{([csptm]):([^}]*)\}/g, function (all, kind, val) {
      if (kind === "t") return '<span class="pchip pc-time" contenteditable="false">◷ ' + val + " s</span>";
      if (kind === "m") {
        var title = val && sceneInfo(val) ? "@站位图·" + sceneInfo(val).name : "@站位图";
        return '<span class="pchip pc-stage" contenteditable="false" title="开启「应用站位」后自动带入，关闭后移除">' + ICON_STAGE + title + "</span>";
      }
      var asset = kind === "c" ? charById(val) : kind === "s" ? sceneRef(val) : propById(val);
      var deletedName = ReplicaUI.deletedAssetName(kind, val);
      var label = deletedName || (kind === "c" ? (asset ? charLabel(asset) : val) : asset ? asset.name : val);
      var cls = kind === "c" ? "pc-char" : kind === "s" ? "pc-scene" : "pc-prop";
      if (deletedName || !asset) {
        cls += " is-deleted";
        label = label.replace(/-已删除$/, "") + "-已删除";
      }
      return '<span class="pchip ' + cls + '" contenteditable="false">' + CHIP_ICONS[kind] + label + "</span>";
      });
    }
    return text.split("\n").map(function (line) {
      var trimmed = line.trim();
      var cls = "prompt-line";
      if (!trimmed) cls += " is-empty";
      else if (/^\[全局设定\]/.test(trimmed)) cls += " is-global";
      else if (/^##\s*/.test(trimmed)) cls += " is-scene";
      else if (/^c\d+/i.test(trimmed)) cls += " is-shot";
      else if (/^图中空间[:：]/.test(trimmed)) cls += " is-space";
      return '<div class="' + cls + '">' + (trimmed ? renderTokens(line) : "<br>") + "</div>";
    }).join("");
  }

  function promptPlainText(s) {
    return promptText(s).replace(/\{([csptm]):([^}]*)\}/g, function (all, kind, val) {
      if (kind === "t") return val + "s";
      if (kind === "m") return val && sceneInfo(val) ? "站位图·" + sceneInfo(val).name : "站位图";
      var asset = kind === "c" ? charById(val) : kind === "s" ? sceneRef(val) : propById(val);
      return asset ? (kind === "c" ? charLabel(asset) : asset.name) : val;
    });
  }

  function openScriptPreview() {
    var total = D.shots.reduce(function (sum, item) { return sum + item.duration; }, 0);
    var sceneCount = D.shots.reduce(function (list, item) {
      if (list.indexOf(item.scene) < 0) list.push(item.scene);
      return list;
    }, []).length;
    $("#script-preview-summary").innerHTML =
      '<span><b>' + sceneCount + '</b> 场</span><span><b>' + D.shots.length + '</b> 个片段</span><span><b>' + mmss(total) + '</b> 预计时长</span>';
    $("#script-preview-body").innerHTML = D.shots.map(function (item) {
      var text = promptPlainText(item);
      var lines = text.split("\n");
      var detail = lines.filter(function (line) { return line.trim() && !/^##/.test(line.trim()); }).join("\n");
      return '<article class="ws-script-card">' +
        '<div class="ws-script-card-meta"><span>片段 ' + item.no + '</span><em>' + item.duration + 's</em></div>' +
        '<h4>' + item.title + '</h4>' +
        '<p class="ws-script-scene">' + escAttr(sceneLabel(item)) + '</p>' +
        '<p class="ws-script-copy">' + detail.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</p>' +
      '</article>';
    }).join("");
    $("#script-preview-modal").classList.add("open");
    setTimeout(function () {
      var close = $('[data-act="close-script-preview"]', $("#script-preview-modal"));
      if (close) close.focus();
    }, 0);
  }

  function closeScriptPreview() {
    $("#script-preview-modal").classList.remove("open");
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
        '<img loading="lazy" decoding="async" src="' + sceneInfo(k).image + '" alt=""><span><b>' + sceneInfo(k).name + "</b><small>" + (n ? n + " 人" : "未摆放") + "</small></span></button>";
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
          '<span class="mk-body">' + (outfit ? '<img decoding="async" class="mk-wear" src="' + outfit + '" alt="" draggable="false">' : "") + '</span><span class="mk-foot"></span></div>';
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

  function renderShotVoices() {
    var s = shot();
    var chars = (s.refs || []).map(charById).filter(Boolean);
    var box = $("#shot-voices");
    if (!chars.length) {
      box.innerHTML = "";
      return;
    }
    var missing = chars.filter(function (c) { return !c.voiceBind || c.voiceOn === false; });
    box.innerHTML = '<span class="shot-voices-label">对白</span>' + chars.map(function (c) {
      if (!c.voiceBind) {
        return '<span class="shot-voice is-empty"><b>' + c.name + '</b><small>尚未绑定音色</small><a href="assets.html">去绑定</a></span>';
      }
      if (c.voiceOn === false) {
        return '<span class="shot-voice is-empty"><b>' + c.name + '</b><small>音色已关闭</small><a href="assets.html">去开启</a></span>';
      }
      var src = c.voiceBind.source === "upload" ? "上传" : c.voiceBind.source === "generated" ? "按描述生成" : "";
      return '<span class="shot-voice"><button type="button" data-preview-voice="' + c.id + '" aria-label="试听' + c.voiceBind.name + '">▶</button><b>' + c.name + "</b><strong>" + c.voiceBind.name + "</strong>" + (src ? "<i>" + src + "</i>" : "") + "</span>";
    }).join("") + '<em>' + (missing.some(function (c) { return !c.voiceBind; }) ? "配音前需要先绑定，这里不能临时另选" : missing.length ? "音色已关闭，配音前先到资产库开启" : "旁白和对白默认用角色已绑定的音色") + "</em>";
  }

  function segTitle(s) {
    return s.segName || ("片段 " + s.no);
  }

  function escAttr(text) {
    return String(text == null ? "" : text).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function sceneLabel(s) {
    var name = (s.scene || "").trim();
    var code = segCode(s);
    if (!name) return code;
    if (name === code || name.indexOf(code + " ") === 0) return name;
    var rest = name.replace(/^\d+-\d+\s*/, "");
    return rest ? code + " " + rest : name;
  }

  function paintSegHead(s) {
    var titleWrap = $("#shot-title-wrap");
    var sceneWrap = $("#shot-scene-wrap");
    if (titleWrap && !titleWrap.querySelector("input")) {
      titleWrap.innerHTML =
        '<b id="shot-title"></b>' +
        '<button type="button" class="ws-inline-edit" data-act="edit-shot-title" title="修改片段名" aria-label="修改片段名">✎</button>';
      $("#shot-title").textContent = segTitle(s);
    }
    if (sceneWrap && !sceneWrap.querySelector("input")) {
      sceneWrap.innerHTML =
        '<span id="shot-scene" data-act="edit-shot-scene" title="点击修改场次名称"></span>' +
        '<button type="button" class="ws-inline-edit" data-act="edit-shot-scene" title="修改场次名称" aria-label="修改场次名称">✎</button>';
      $("#shot-scene").textContent = sceneLabel(s);
    }
  }

  function citedAssets(s) {
    var seen = {};
    return (s.refs || []).map(function (id) {
      var kind = refKind(id);
      if (!kind || seen[kind + ":" + id]) return null;
      seen[kind + ":" + id] = true;
      if (kind === "char") {
        var character = charById(id);
        return character ? { id: id, kind: kind, name: charLabel(character), image: outfitImage(character) } : null;
      }
      if (kind === "scene") {
        var scene = sceneRef(id);
        return scene ? { id: id, kind: kind, name: scene.name, image: scene.image } : null;
      }
      var prop = propById(id);
      return prop ? { id: id, kind: kind, name: prop.name, image: prop.image } : null;
    }).filter(Boolean);
  }

  function replacementCatalog(kind) {
    var query = (state.replaceQuery || "").trim().toLowerCase();
    var items = [];
    if (kind === "char") {
      items = D.characters.map(function (item) {
        return { id: item.id, kind: "char", name: charLabel(item), image: outfitImage(item), group: "角色" };
      });
    } else if (kind === "scene") {
      D.scenes.forEach(function (scene) {
        sceneCards(scene).forEach(function (card) {
          items.push({ id: card.key, kind: "scene", name: card.name, image: card.image, group: "场景" });
        });
      });
    } else {
      items = D.props.map(function (item) {
        return { id: item.id, kind: "prop", name: item.name, image: item.image, group: "道具" };
      });
    }
    return items.filter(function (item) {
      return !query || item.name.toLowerCase().indexOf(query) > -1;
    });
  }

  function replaceShotAsset(oldId, newId, kind) {
    var s = shot();
    if (!s || !oldId || !newId || oldId === newId) {
      state.replaceTarget = null;
      renderRefStrip();
      return;
    }
    var token = kind === "char" ? "c" : kind === "scene" ? "s" : "p";
    s.refs = (s.refs || []).map(function (id) { return id === oldId ? newId : id; }).filter(function (id, index, list) {
      return list.indexOf(id) === index;
    });
    if (kind === "scene") {
      s.scenes = (s.scenes || []).map(function (key) {
        if (key === oldId) return newId;
        return key.indexOf(oldId + "/") === 0 ? newId + key.slice(oldId.length) : key;
      });
    }
    (s.anchors || []).forEach(function (anchor) {
      if (anchor.asset === oldId) anchor.asset = newId;
      if (kind === "scene" && anchor.scene && (anchor.scene === oldId || anchor.scene.indexOf(oldId + "/") === 0)) {
        anchor.scene = anchor.scene === oldId ? newId : newId + anchor.scene.slice(oldId.length);
      }
    });
    (s.offscreen || []).forEach(function (item) { if (item.asset === oldId) item.asset = newId; });
    s.prompt = (s.prompt || "").replace(new RegExp("\\{" + token + ":" + oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\}", "g"), "{" + token + ":" + newId + "}");
    state.promptShot = null;
    state.replaceTarget = null;
    renderAll();
    ReplicaUI.toast("已替换片段引用资产");
  }

  function renderRefStrip() {
    var row = $("#ws-ref-row");
    if (!row) return;
    var s = shot();
    var cited = citedAssets(s);
    var kindName = { char: "角色", scene: "场景", prop: "道具" };
    row.innerHTML = cited.map(function (item) {
      var open = state.replaceTarget && state.replaceTarget.id === item.id;
      return '<div class="ws-ref-item' + (open ? " is-open" : "") + '">' +
        '<img loading="lazy" decoding="async" src="' + item.image + '" alt="">' +
        '<button type="button" class="ws-ref-swap" data-act="replace-ref" data-ref="' + item.id + '" data-kind="' + item.kind + '" title="替换' + kindName[item.kind] + '" aria-label="替换' + item.name + '">替换</button>' +
        "</div>";
    }).join("") || '<span class="ws-ref-empty">当前片段还没有引用资产</span>';
    if (!state.replaceTarget) return;
    var current = cited.find(function (item) { return item.id === state.replaceTarget.id; });
    if (!current) { state.replaceTarget = null; return; }
    var catalog = replacementCatalog(current.kind);
    var pop = document.createElement("div");
    pop.className = "ws-replace-pop";
    pop.innerHTML =
      '<label class="ws-replace-search"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="m10.4 10.4 2.6 2.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
      '<input id="ws-replace-query" type="search" placeholder="搜索' + kindName[current.kind] + '" value="' + state.replaceQuery.replace(/"/g, "&quot;") + '" aria-label="搜索可替换资产"></label>' +
      '<div class="ws-replace-list"><b>' + kindName[current.kind] + "</b>" +
      (catalog.length ? catalog.map(function (item) {
        var on = item.id === current.id ? " is-current" : "";
        return '<button type="button" class="ws-replace-option' + on + '" data-act="pick-replace" data-replace-id="' + item.id + '" data-kind="' + item.kind + '">' +
          '<img loading="lazy" decoding="async" src="' + item.image + '" alt=""><span>' + item.name + "</span></button>";
      }).join("") : '<em>没有匹配的资产</em>') +
      "</div>";
    row.appendChild(pop);
    var anchor = row.querySelector('.ws-ref-item.is-open');
    if (anchor) pop.style.left = Math.max(0, anchor.offsetLeft) + "px";
    var input = $("#ws-replace-query");
    if (input) {
      input.addEventListener("input", function () {
        state.replaceQuery = input.value;
        var caret = input.selectionStart;
        renderRefStrip();
        var next = $("#ws-replace-query");
        if (next) { next.focus(); next.setSelectionRange(caret, caret); }
      });
      input.focus();
    }
  }

  function renderEditor() {
    var s = shot();
    paintSegHead(s);
    renderRefStrip();
    var promptKey = s.id + "|" + stationPrompt(s);
    if (state.promptShot !== promptKey) {
      $("#prompt").innerHTML = promptHtml(s);
      if (state.promptShot === null || state.promptShot.split("|")[0] !== s.id) $("#dur").value = s.duration;
      state.promptShot = promptKey;
      if (!versionsOf(s.id).some(function (item) { return item.id === state.versionId; })) {
        state.versionId = versionsOf(s.id).length ? versionsOf(s.id)[0].id : null;
      }
    }
    $("#stage-modal").classList.toggle("open", state.view === "stage");
    renderShotVoices();
    renderToolbar();
    renderPlayer();
    if (state.view === "stage") renderStage();
  }

  function timelineSpan() {
    var total = 0;
    var before = 0;
    D.shots.forEach(function (item) {
      if (item.id === state.shotId) before = total;
      total += item.duration;
    });
    return { before: before, total: total };
  }

  function playheadRatio() {
    var span = timelineSpan();
    return span.total ? span.before / span.total : 0;
  }

  function renderScrub() {
    var total = 0;
    D.shots.forEach(function (s) { total += s.duration; });
    var scrub = $("#ws-scrub");
    if (!scrub) return;
    if (!total) {
      scrub.innerHTML = "";
      return;
    }
    var head = Math.max(0, Math.min(1, playheadRatio())) * 100;
    scrub.innerHTML =
      '<div class="ws-scrub-track">' +
        D.shots.map(function (s) {
          var on = s.id === state.shotId ? " on" : "";
          var ready = state.videos[s.id] ? " is-ready" : "";
          return '<button type="button" class="ws-scrub-seg' + on + ready + '" data-shot="' + s.id + '" style="flex:' + s.duration + '" title="场次 ' + s.no + '" aria-label="场次 ' + s.no + '"' + (s.id === state.shotId ? ' aria-current="true"' : "") + "></button>";
        }).join("") +
      '</div>' +
      '<span class="ws-scrub-head" style="left:' + head + '%" aria-hidden="true"></span>';
  }

  function stageClock(s) {
    if (!state.seqPlay) return "00:00 / " + mmss(s.duration);
    var span = timelineSpan();
    return mmss(span.before) + " / " + mmss(span.total || s.duration);
  }

  function renderPlayer() {
    var s = shot();
    var m = model();
    var video = state.videos[s.id];
    var clock = stageClock(s);
    renderScrub();
    var seq = $("#seq-switch");
    if (seq) {
      seq.classList.toggle("on", state.seqPlay);
      seq.setAttribute("aria-checked", state.seqPlay ? "true" : "false");
    }
    var vol = $(".ws-vol");
    if (vol) {
      vol.classList.toggle("is-muted", state.muted);
      vol.setAttribute("aria-label", state.muted ? "取消静音" : "音量");
      vol.title = state.muted ? "取消静音" : "音量";
    }
    var timeHtml = '<span class="ws-stage-time" id="time-label">' + clock + "</span>";
    if (state.generating === s.id) {
      $("#stage").innerHTML = '<div class="ws-frame"><div class="stage-loading"><div class="spin"></div><div style="margin-top:8px">' + (m.draft ? "480P 样片生成中" : "片段生成中") + "</div></div>" + timeHtml + "</div>";
    } else if (state.upgrading === s.id) {
      $("#stage").innerHTML = '<div class="ws-frame"><div class="stage-loading"><div class="spin"></div><div style="margin-top:8px">正在基于样片生成 ' + finalResolution + " 正片</div></div>" + timeHtml + "</div>";
    } else if (video) {
      var frame = sceneInfo((s.scenes || [])[0]) ? sceneInfo(s.scenes[0]).image : "media/scenes/cemetery.png";
      var shownModel = (D.models.find(function (x) { return x.id === video.model; }) || m).name;
      var badges = '<span class="stage-badges">' +
        (video.kind === "draft" ? "" : '<span class="player-status"><i></i>' + shownModel + " 正片 · " + video.resolution + "</span>") +
        '<span class="station-badge' + (video.station ? " on" : "") + '">' + (video.station ? "已应用站位" : "未应用站位") + "</span></span>";
      $("#stage").innerHTML = '<div class="ws-frame"><img decoding="async" class="video-frame" src="' + frame + '" alt="片段视频">' +
        (video.kind === "draft"
          ? '<button class="upgrade-trigger" data-act="upgrade">✦ 生成 1080P 正片</button><span class="draft-watermark">' + shownModel + " · 样片 " + (video.resolution || "480P") + "</span>"
          : "") + badges + timeHtml + "</div>";
    } else {
      $("#stage").innerHTML = '<div class="ws-frame"><span class="ws-stage-empty">暂无视频</span>' + timeHtml + "</div>";
    }
  }

  function beginInlineEdit(wrap, value, ariaLabel, onSave) {
    if (!wrap || wrap.querySelector("input")) return;
    var input = document.createElement("input");
    input.className = "ws-inline-rename" + (wrap.id === "shot-scene-wrap" ? " is-scene" : wrap.classList.contains("ws-seg-tab") ? " is-tab" : "");
    input.value = value || "";
    input.setAttribute("aria-label", ariaLabel);
    wrap.innerHTML = "";
    wrap.appendChild(input);
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var next = input.value.trim();
      if (save && next && next !== value) onSave(next);
      wrap.innerHTML = "";
      renderEditor();
      renderTimeline();
    }
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); finish(true); }
      if (event.key === "Escape") { event.preventDefault(); finish(false); }
    });
    input.addEventListener("blur", function () { finish(true); });
    input.focus();
    input.select();
  }

  function selectSegment(shotId, versionId) {
    if (!D.shots.some(function (item) { return item.id === shotId; })) return;
    state.shotId = shotId;
    state.promptShot = null;
    state.replaceTarget = null;
    state.view = "prompt";
    var list = versionsOf(shotId);
    state.versionId = versionId || (list.length ? list[0].id : null);
    if (state.versionId) {
      var ver = list.find(function (item) { return item.id === state.versionId; });
      if (ver) {
        state.videos[shotId] = {
          kind: ver.kind,
          resolution: ver.resolution,
          model: ver.model,
          station: ver.station
        };
      }
    }
    renderAll();
  }

  function renderTimeline() {
    var tabs = $("#ws-seg-tabs");
    if (tabs) {
      tabs.innerHTML = D.shots.map(function (s) {
        var on = s.id === state.shotId ? " on" : "";
        var label = sceneLabel(s);
        return '<div class="ws-seg-tab' + on + '" data-tab-shot="' + s.id + '">' +
          '<button type="button" class="ws-seg-tab-main" role="tab" data-act="select-seg" data-shot="' + s.id + '" aria-selected="' + (s.id === state.shotId ? "true" : "false") + '" title="' + escAttr(label) + '">' +
            '<span class="ws-seg-tab-name">' + escAttr(label) + "</span></button>" +
          '<button type="button" class="ws-seg-tab-edit" data-act="edit-tab-scene" data-scene-shot="' + s.id + '" title="修改场次名称" aria-label="修改' + escAttr(label) + '">' +
            '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.1 3.1 12.9 6.9 6.4 13.4H2.6v-3.8Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="m8.2 4 3.8 3.8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button></div>';
      }).join("") +
        '<button type="button" class="ws-seg-tab ws-seg-add" data-act="add-shot" title="添加片段" aria-label="添加片段">+</button>';
    }

    var s = shot();
    var list = versionsOf(s.id);
    var cards = list.length
      ? list.map(function (ver) {
          var on = ver.id === state.versionId ? " on" : "";
          var label = ver.kind === "draft" ? "样片" : ver.resolution;
          return '<button type="button" class="tcard' + on + '" data-act="select-version" data-version="' + ver.id + '" title="' + ver.label + '">' +
            '<span class="ws-tl-frame"><img loading="lazy" decoding="async" src="' + ver.image + '" alt=""></span>' +
            (ver.isNew ? '<span class="ws-tl-new">NEW</span>' : "") +
            '<span class="num">' + ver.label + "</span>" +
            '<span class="state' + (ver.kind === "draft" ? " draft" : "") + '">' + label + "</span>" +
            '<span class="dur">' + mmss(ver.duration || s.duration) + "</span></button>";
        }).join("")
      : '<button type="button" class="tcard on is-empty" data-shot="' + s.id + '" title="尚未生成">' +
          '<span class="ws-tl-frame"><span class="ws-tl-empty" aria-hidden="true">' + segCode(s) + "</span></span>" +
          '<span class="num">' + segCode(s) + "</span>" +
          '<span class="state">未生成</span>' +
          '<span class="dur">' + mmss(s.duration) + "</span></button>";

    $("#tl-track").innerHTML = cards +
      '<button type="button" class="ws-tl-add" data-act="add-shot" title="添加片段">+</button>';

    $("#shot-list").innerHTML = D.shots.map(function (item) {
      var v = state.videos[item.id];
      var label = v ? (v.kind === "draft" ? "样片 · 480P" : "正片 · " + v.resolution) : "未生成";
      return '<button type="button" class="shot-row' + (item.id === state.shotId ? " on" : "") + '" data-shot="' + item.id + '">' +
        '<span class="shot-no">' + segCode(item) + '</span><span><b>' + (item.title || ("片段 " + item.no)) + "</b><small>" + escAttr(sceneLabel(item)) + " · " + item.duration + "s</small></span>" +
        '<span class="shot-state' + (v && v.kind === "draft" ? " draft" : "") + '">' + label + "</span></button>";
    }).join("");
  }

  function syncEditLink() {
    var link = $("#edit-link");
    if (link) link.href = "multitrack-editor.html?shot=" + encodeURIComponent(state.shotId);
  }

  function paintVideoRatio() {
    var ratio = D.project.ratio === "16:9" ? "16:9" : "9:16";
    D.project.ratio = ratio;
    document.body.dataset.videoRatio = ratio;
    $("#ws-ratio-label").textContent = ratio;
    $("#ws-ratio-btn").setAttribute("aria-expanded", state.ratioOpen ? "true" : "false");
    $("#ws-ratio-menu").hidden = !state.ratioOpen;
    $$("#ws-ratio-menu [data-ratio]").forEach(function (button) {
      button.setAttribute("aria-checked", button.dataset.ratio === ratio ? "true" : "false");
    });
  }

  function renderAll() { paintVideoRatio(); renderAssets(); renderEditor(); renderTimeline(); syncEditLink(); }

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
    var t = e.target.closest("[data-act],[data-shot],[data-tab],[data-asset],[data-model],[data-resolution],[data-sv],[data-scene],[data-select],[data-stage-open],[data-stage-person],[data-view]");
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
    if (state.ratioOpen && !e.target.closest(".ws-ratio")) {
      state.ratioOpen = false;
      paintVideoRatio();
    }
    if ((state.scopeOpen || state.libEpOpen) && !e.target.closest(".ws-lib-dd")) {
      closeLibMenus();
    }
    if (state.replaceTarget && !e.target.closest(".ws-ref-bar")) {
      state.replaceTarget = null;
      renderRefStrip();
    }
    var previewVoice = e.target.closest("[data-preview-voice]");
    if (previewVoice) {
      var voiced = charById(previewVoice.dataset.previewVoice);
      if (voiced && voiced.voiceBind && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(D.voiceSample || "这是一段统一试听。");
        utterance.lang = "zh-CN";
        utterance.pitch = voiced.voiceBind.pitch || 1;
        utterance.rate = voiced.voiceBind.rate || 1;
        window.speechSynthesis.speak(utterance);
      }
      return;
    }
    if (e.target.id === "asset-delete-modal") { closeAssetDelete(); return; }
    if (e.target.id === "script-preview-modal") { closeScriptPreview(); return; }
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
      $("#list-drawer").classList.remove("open");
      selectSegment(t.dataset.shot);
      return;
    }
    if (t.dataset.view) {
      state.assetView = t.dataset.view === "grid" ? "grid" : "list";
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
    if (act === "open-script-preview") { openScriptPreview(); return; }
    if (act === "close-script-preview") { closeScriptPreview(); return; }
    if (act === "select-seg") {
      selectSegment(t.dataset.shot);
      return;
    }
    if (act === "select-version") {
      selectSegment(state.shotId, t.dataset.version);
      return;
    }
    if (act === "edit-shot-title") {
      beginInlineEdit($("#shot-title-wrap"), segTitle(shot()), "修改片段名", function (next) {
        shot().segName = next;
        ReplicaUI.toast("片段名已修改");
      });
      return;
    }
    if (act === "replace-ref") {
      var same = state.replaceTarget && state.replaceTarget.id === t.dataset.ref;
      state.replaceTarget = same ? null : { id: t.dataset.ref, kind: t.dataset.kind };
      state.replaceQuery = "";
      renderRefStrip();
      return;
    }
    if (act === "pick-replace") {
      replaceShotAsset(state.replaceTarget && state.replaceTarget.id, t.dataset.replaceId, t.dataset.kind);
      return;
    }
    if (act === "edit-tab-scene") {
      var sceneShot = D.shots.find(function (item) { return item.id === t.dataset.sceneShot; });
      var sceneTab = t.closest(".ws-seg-tab");
      if (!sceneShot || !sceneTab) return;
      sceneTab.classList.add("is-editing");
      beginInlineEdit(sceneTab, sceneLabel(sceneShot), "修改场次名称", function (next) {
        sceneShot.scene = next;
        ReplicaUI.toast("场次名称已修改");
      });
      return;
    }
    if (act === "edit-shot-scene") {
      beginInlineEdit($("#shot-scene-wrap"), sceneLabel(shot()), "修改场次名称", function (next) {
        shot().scene = next;
        ReplicaUI.toast("场次名称已修改");
      });
      return;
    }
    if (act === "delete-asset") {
      openAssetDelete({ id: t.dataset.assetId, kind: t.dataset.assetKind, name: t.dataset.assetName });
      return;
    }
    if (act === "cancel-asset-delete") { closeAssetDelete(); return; }
    if (act === "confirm-asset-delete") { confirmAssetDelete(); return; }
    if (act === "list") $("#list-drawer").classList.add("open");
    if (act === "close-list") $("#list-drawer").classList.remove("open");
    if (act === "toggle-ratio") {
      state.ratioOpen = !state.ratioOpen;
      paintVideoRatio();
      return;
    }
    if (act === "set-ratio") {
      D.project.ratio = t.dataset.ratio === "16:9" ? "16:9" : "9:16";
      state.ratioOpen = false;
      paintVideoRatio();
      ReplicaUI.toast("已切换为 " + D.project.ratio + "，作用于当前集全部分镜");
      return;
    }
    if (act === "export") $("#export-modal").classList.add("open");
    if (act === "close-export") $("#export-modal").classList.remove("open");
    if (act === "collapse-assets") {
      setAssetsCollapsed(!state.assetsCollapsed);
      return;
    }
    if (act === "toggle-scope") {
      state.scopeOpen = !state.scopeOpen;
      state.libEpOpen = false;
      syncLibChrome();
      return;
    }
    if (act === "set-scope") {
      state.tab = t.dataset.scope === "clip" ? "clip" : "all";
      state.scopeOpen = false;
      renderAssets();
      return;
    }
    if (act === "toggle-lib-ep") {
      state.libEpOpen = !state.libEpOpen;
      state.scopeOpen = false;
      syncLibChrome();
      return;
    }
    if (act === "set-lib-ep") {
      state.libEpOpen = false;
      syncLibChrome();
      if (String(t.dataset.ep) === "1") {
        $$("#ws-lib-ep-menu [data-ep]").forEach(function (btn) {
          btn.setAttribute("aria-checked", btn.dataset.ep === "1" ? "true" : "false");
        });
        ReplicaUI.toast("当前已在第 01 集");
      } else {
        ReplicaUI.toast("演示：切换到第 " + String(t.dataset.ep).padStart(2, "0") + " 集资产");
      }
      return;
    }
    if (act === "toggle-search") {
      state.searchOpen = !state.searchOpen;
      syncLibChrome();
      if (state.searchOpen) setTimeout(function () { $("#asset-search").focus(); }, 0);
      return;
    }
    if (act === "toggle-folder") {
      var folder = t.dataset.folder;
      state.collapsedGroups[folder] = !state.collapsedGroups[folder];
      renderAssets();
      return;
    }
    if (act === "add") ReplicaUI.toast("演示：新增素材");
    if (act === "add-shot") ReplicaUI.toast("演示：添加片段模块");
    if (act === "multi") ReplicaUI.toast("演示：多选片段");
    if (act === "play") {
      ReplicaUI.toast(state.seqPlay ? "演示：按场次顺序播放全部片段" : "演示：仅播放当前场次");
      return;
    }
    if (act === "seq-play") {
      state.seqPlay = !state.seqPlay;
      renderPlayer();
      ReplicaUI.toast(state.seqPlay ? "已开启：每个片段顺序播放" : "已关闭：仅播放当前片段");
      return;
    }
    if (act === "player-expand") {
      setPlayerExpanded(!state.playerExpanded);
      return;
    }
    if (act === "volume") {
      state.muted = !state.muted;
      renderPlayer();
      ReplicaUI.toast(state.muted ? "已静音" : "已取消静音");
      return;
    }
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
    if ((act === "upgrade" || act === "generate") && (state.generating || state.upgrading)) {
      ReplicaUI.toast("上一个片段还在生成，请稍候");
      return;
    }
    if (act === "upgrade") {
      if (D.credits < finalCost) { ReplicaUI.toast("积分不足，生成正片需要 " + finalCost + " 积分"); return; }
      var upgradingShot = state.shotId;
      var keepStation = (state.videos[upgradingShot] || {}).station;
      state.upgrading = upgradingShot;
      D.credits -= finalCost;
      $("#credits").textContent = ReplicaUI.credits();
      renderAll();
      ReplicaUI.toast("Step 2 已提交 · " + finalResolution + " 正片独立计费");
      setTimeout(function () {
        pushVersion(upgradingShot, { kind: "final", resolution: finalResolution, model: "seedance-2.5", station: keepStation });
        state.upgrading = null;
        renderAll();
        ReplicaUI.toast("正片生成完成 · " + finalResolution);
      }, 1800);
    }
    if (act === "generate") {
      var generatingShot = state.shotId;
      var generatingModel = model();
      var unboundVoices = (shot().refs || []).map(charById).filter(function (c) { return c && (!c.voiceBind || c.voiceOn === false); });
      if (unboundVoices.length) ReplicaUI.toast(unboundVoices.map(function (c) { return c.name; }).join("、") + "没有可用的音色。旁白和对白需要先绑定或开启，本次只生成画面");
      if (D.credits < generatingModel.cost) { ReplicaUI.toast("积分不足，本次生成需要 " + generatingModel.cost + " 积分"); return; }
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
        pushVersion(generatingShot, {
          kind: generatingModel.draft ? "draft" : "final",
          resolution: generatingResolution,
          model: generatingModel.id,
          station: useStation
        });
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

  function setAssetsCollapsed(on) {
    state.assetsCollapsed = !!on;
    document.body.classList.toggle("ws-assets-collapsed", state.assetsCollapsed);
    var btn = $(".ws-assets-collapse");
    if (btn) {
      btn.title = state.assetsCollapsed ? "展开资产库" : "收起资产库";
      btn.setAttribute("aria-label", btn.title);
      btn.setAttribute("aria-expanded", state.assetsCollapsed ? "false" : "true");
    }
    var expand = $(".ws-assets-expand");
    if (expand) expand.hidden = !state.assetsCollapsed;
  }

  function initWorkspaceResizers() {
    var main = $(".ws");
    var handles = $$("[data-ws-resize]");
    var storageKey = "jieshuoju.workspace.layout.v5";
    var varNames = {
      assets: "--ws-assets-width",
      player: "--ws-player-width",
      timeline: "--ws-timeline-height"
    };
    var defaults = {};
    var layout = {};
    var active = null;

    function cssNumber(name) {
      return parseFloat(getComputedStyle(main).getPropertyValue(varNames[name])) || 0;
    }

    Object.keys(varNames).forEach(function (name) {
      defaults[name] = cssNumber(name);
      layout[name] = defaults[name];
    });

    function preferredLayout() {
      var preferred = Object.assign({}, defaults);
      try {
        var saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
        Object.keys(varNames).forEach(function (name) {
          if (Number.isFinite(saved[name])) preferred[name] = saved[name];
        });
      } catch (e) {}
      return preferred;
    }

    layout = preferredLayout();

    function metrics() {
      var rect = main.getBoundingClientRect();
      var style = getComputedStyle(main);
      var padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      var padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      var gapX = parseFloat(style.columnGap) || 0;
      var gapY = parseFloat(style.rowGap) || 0;
      return {
        rect: rect,
        width: rect.width - padX - gapX * 2,
        height: rect.height - padY - gapY
      };
    }

    function limits(name) {
      var space = metrics();
      var minEditor = space.width < 980 ? 300 : 360;
      if (name === "assets") {
        return { min: 160, max: Math.max(160, Math.min(420, space.width - layout.player - minEditor)) };
      }
      if (name === "player") {
        var halfScreen = space.rect.width * 0.5;
        var playerEditorFloor = space.width < 1100 ? 220 : 300;
        return {
          min: 180,
          max: Math.max(180, Math.min(
            halfScreen,
            space.width - (state.assetsCollapsed ? 0 : layout.assets) - playerEditorFloor
          ))
        };
      }
      return { min: 96, max: Math.max(96, Math.min(280, space.height - 230)) };
    }

    function updateHandle(name) {
      var handle = $('[data-ws-resize="' + name + '"]');
      var range = limits(name);
      if (!handle) return;
      handle.setAttribute("aria-valuemin", Math.round(range.min));
      handle.setAttribute("aria-valuemax", Math.round(range.max));
      handle.setAttribute("aria-valuenow", Math.round(layout[name]));
    }

    function apply(name, value, save) {
      var range = limits(name);
      layout[name] = clamp(value, range.min, range.max);
      main.style.setProperty(varNames[name], Math.round(layout[name]) + "px");
      updateHandle(name);
      if (save) {
        try { localStorage.setItem(storageKey, JSON.stringify(layout)); } catch (e) {}
      }
      if (state.view === "stage") renderStage();
    }

    function applyAll(save) {
      apply("assets", layout.assets, false);
      apply("player", layout.player, false);
      apply("assets", layout.assets, false);
      apply("timeline", layout.timeline, save);
      handles.forEach(function (handle) { updateHandle(handle.dataset.wsResize); });
    }

    function stopResize(event) {
      if (!active || (event && event.pointerId !== active.pointerId)) return;
      active.handle.classList.remove("is-dragging");
      document.body.classList.remove("ws-resizing", "ws-resizing-col", "ws-resizing-row");
      try { active.handle.releasePointerCapture(active.pointerId); } catch (e) {}
      try { localStorage.setItem(storageKey, JSON.stringify(layout)); } catch (e) {}
      active = null;
    }

    handles.forEach(function (handle) {
      var name = handle.dataset.wsResize;
      handle.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        event.preventDefault();
        var rect = main.getBoundingClientRect();
        active = {
          name: name,
          handle: handle,
          pointerId: event.pointerId,
          rect: rect,
          startX: event.clientX,
          startY: event.clientY,
          startValue: layout[name]
        };
        try { handle.setPointerCapture(event.pointerId); } catch (e) {}
        handle.classList.add("is-dragging");
        document.body.classList.add("ws-resizing", name === "timeline" ? "ws-resizing-row" : "ws-resizing-col");
      });
      handle.addEventListener("pointermove", function (event) {
        if (!active || active.pointerId !== event.pointerId) return;
        var value;
        if (name === "assets") value = active.startValue + event.clientX - active.startX;
        if (name === "player") value = active.startValue - (event.clientX - active.startX);
        if (name === "timeline") value = active.startValue - (event.clientY - active.startY);
        apply(name, value, false);
      });
      handle.addEventListener("pointerup", stopResize);
      handle.addEventListener("pointercancel", stopResize);
      handle.addEventListener("dblclick", function () {
        apply(name, defaults[name], true);
      });
      handle.addEventListener("keydown", function (event) {
        var vertical = name === "timeline";
        var decrease = vertical ? event.key === "ArrowDown" : event.key === "ArrowLeft";
        var increase = vertical ? event.key === "ArrowUp" : event.key === "ArrowRight";
        if (!decrease && !increase && event.key !== "Home") return;
        event.preventDefault();
        if (event.key === "Home") return apply(name, defaults[name], true);
        apply(name, layout[name] + (increase ? 12 : -12), true);
      });
    });

    var layoutResizeFrame = 0;
    window.addEventListener("resize", function () {
      if (layoutResizeFrame) cancelAnimationFrame(layoutResizeFrame);
      layoutResizeFrame = requestAnimationFrame(function () {
        layoutResizeFrame = 0;
        layout = preferredLayout();
        applyAll(false);
      });
    });

    applyAll(false);
  }

  function initEpisodeSwitcher() {
    var root = $("#ws-ep-switch");
    var btn = $("#ws-ep-btn");
    var menu = $("#ws-ep-menu");
    var label = $("#ws-ep-label");
    var titleEl = $("#ws-title");
    var STATUS = { ready: "可编辑", done: "已完成", parse: "解析中", running: "生成中", failed: "生成失败" };

    function shortName(ep) { return String(ep && ep.title || "").replace(/^第\d+集[：:]\s*/, ""); }
    function esc(text) { return String(text).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function episodeOf(no) { return D.episodes.find(function (e) { return e.no === no; }); }

    function render() {
      var ep = episodeOf(EPISODE);
      label.textContent = "第" + EPISODE + "集";
      titleEl.textContent = shortName(ep);
      document.title = "创作 · " + (ep ? ep.title : "第" + EPISODE + "集");
      menu.innerHTML = D.episodes.map(function (item) {
        var on = item.no === EPISODE;
        return '<button type="button" role="option" aria-selected="' + (on ? "true" : "false") + '" class="ws-ep-opt' + (on ? " on" : "") + '" data-ep-no="' + item.no + '">' +
          '<span class="ws-ep-no">第' + item.no + '集</span>' +
          '<span class="ws-ep-name">' + esc(shortName(item)) + '</span>' +
          '<em class="ws-ep-status s-' + item.status + '">' + (on ? "当前" : (STATUS[item.status] || "")) + '</em>' +
          '</button>';
      }).join("");
    }

    function setOpen(on) {
      menu.hidden = !on;
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) {
        var current = menu.querySelector(".on");
        if (current) current.scrollIntoView({ block: "nearest" });
      }
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(menu.hidden);
    });

    menu.addEventListener("click", function (e) {
      var opt = e.target.closest("[data-ep-no]");
      if (!opt) return;
      var no = Number(opt.dataset.epNo);
      setOpen(false);
      if (no === EPISODE) return;
      EPISODE = no;
      state.selected = null;
      render();
      renderAll();
      ReplicaUI.toast(no === 1
        ? "已切换到第1集"
        : "已切换到第" + no + "集（原型仅第1集有分镜演示数据）");
    });

    document.addEventListener("click", function (e) {
      if (!root.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) {
        setOpen(false);
        btn.focus();
      }
    });

    render();
  }

  function initStyleSwitcher() {
    var root = $("#ws-style-switch");
    var btn = $("#ws-style-btn");
    var menu = $("#ws-style-menu");
    var label = $("#ws-style-label");
    var swatch = $("#ws-style-swatch");
    var groups = ["真人", "3D", "2D"];

    function esc(text) {
      return String(text).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }
    function currentStyle() {
      return D.styles.find(function (item) {
        return item.id === D.project.styleId || item.name === D.project.style;
      }) || D.styles[0];
    }
    function render() {
      var current = currentStyle();
      D.project.style = current.name;
      D.project.styleId = current.id;
      label.textContent = current.name;
      btn.title = "画面风格：" + current.name;
      swatch.className = "ws-style-swatch sc " + current.cover;
      menu.innerHTML = groups.map(function (group) {
        var items = D.styles.filter(function (item) { return item.map === group; });
        if (!items.length) return "";
        return '<div class="ws-style-group"><div class="ws-style-group-name">' + group + "</div>" +
          items.map(function (item) {
            var on = item.id === current.id;
            return '<button type="button" role="option" aria-selected="' + (on ? "true" : "false") + '" class="ws-style-opt' + (on ? " on" : "") + '" data-style-id="' + item.id + '">' +
              '<i class="ws-style-swatch sc ' + item.cover + '" aria-hidden="true"></i>' +
              '<span class="ws-style-meta"><b>' + esc(item.name) + "</b><small>" + esc(item.desc) + "</small></span>" +
              (item.badge ? '<em class="ws-style-badge">' + esc(item.badge) + "</em>" : "") +
              (on ? '<em class="ws-style-current">当前</em>' : "") +
              "</button>";
          }).join("") +
          "</div>";
      }).join("");
    }
    function setOpen(on) {
      menu.hidden = !on;
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) {
        if (state.ratioOpen) {
          state.ratioOpen = false;
          paintVideoRatio();
        }
        var picked = menu.querySelector(".on");
        if (picked) picked.scrollIntoView({ block: "nearest" });
      }
    }
    var pending = null;
    var confirmMask = $("#style-confirm");
    function closeConfirm() {
      pending = null;
      confirmMask.classList.remove("open");
    }
    function openConfirm(style) {
      pending = style;
      confirmMask.classList.add("open");
      $("[data-style-confirm='ok']", confirmMask).focus();
    }
    function applyStyle(style) {
      D.applyProjectStyle(style);
      state.promptShot = null;
      render();
      renderAll();
      ReplicaUI.toast("已切换为「" + style.name + "」，之后生成按这个风格");
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(menu.hidden);
    });
    menu.addEventListener("click", function (e) {
      var opt = e.target.closest("[data-style-id]");
      if (!opt) return;
      var style = D.styles.find(function (item) { return item.id === opt.dataset.styleId; });
      setOpen(false);
      if (!style || style.id === D.project.styleId) return;
      openConfirm(style);
    });
    confirmMask.addEventListener("click", function (e) {
      if (e.target === confirmMask) {
        closeConfirm();
        return;
      }
      var act = e.target.closest("[data-style-confirm]");
      if (!act) return;
      var style = pending;
      closeConfirm();
      if (act.dataset.styleConfirm === "ok" && style) applyStyle(style);
    });
    document.addEventListener("click", function (e) {
      if (!root.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (confirmMask.classList.contains("open")) {
        closeConfirm();
        btn.focus();
        return;
      }
      if (!menu.hidden) {
        setOpen(false);
        btn.focus();
      }
    });
    render();
  }

  function setFull(on) {
    if (on && state.playerExpanded) setPlayerExpanded(false);
    state.full = on;
    document.body.classList.toggle("ws-full", on);
    var btn = $('.ws-icon[data-act="full"]');
    btn.innerHTML = on ? ICON_COLLAPSE : ICON_EXPAND;
    btn.title = on ? "退出全屏（Esc）" : "全屏编辑";
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    renderEditor();
  }

  function setPlayerExpanded(on) {
    state.playerExpanded = !!on;
    document.body.classList.toggle("ws-player-expanded", state.playerExpanded);
    var btn = $('[data-act="player-expand"]');
    if (btn) {
      btn.innerHTML = state.playerExpanded ? ICON_COLLAPSE : ICON_EXPAND;
      btn.title = state.playerExpanded ? "收起视频预览（Esc）" : "放大视频预览";
      btn.setAttribute("aria-label", btn.title);
      btn.setAttribute("aria-pressed", state.playerExpanded ? "true" : "false");
    }
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && $("#style-confirm").classList.contains("open")) return;
    if (e.key === "Escape" && $("#asset-delete-modal").classList.contains("open")) {
      closeAssetDelete();
      return;
    }
    var hotKey = e.target.closest && e.target.closest("[data-stage-open]");
    if (hotKey && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openStage(hotKey.dataset.stageOpen, false);
      return;
    }
    if (e.key === "Escape" && state.playerExpanded && !document.querySelector(".modal-mask.open")) { setPlayerExpanded(false); return; }
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

  var resizeFrame = 0;
  window.addEventListener("resize", function () {
    if (state.view !== "stage" || resizeFrame) return;
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = 0;
      if (state.view === "stage") renderStage();
    });
  });
  $("#sv-image").addEventListener("load", function () { if (state.view === "stage") renderStage(); });

  $("#asset-search").oninput = function () { state.query = this.value; renderAssets(); };
  $("#sv-person-search").oninput = function () {
    state.peopleQuery = this.value;
    renderPeoplePicker();
    $("#sv-person-search").focus();
  };
  initWorkspaceResizers();
  initEpisodeSwitcher();
  initStyleSwitcher();
  seedDemoVersions();
  renderAll();
})();
