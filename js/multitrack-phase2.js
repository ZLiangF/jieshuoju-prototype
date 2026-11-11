/* 多轨编辑器 · 二期：轨道上限、磁吸、素材文件夹/上传、分辨率、自动保存增强、只读互斥。 */
(function () {
  var MT = window.MT;
  var $ = MT.$;
  var $$ = MT.$$;
  var state = MT.state;
  var esc = MT.escapeHtml;

  MT.TRACK_LIMITS = { subtitle: 3, video: 3, audio: 5 };
  MT.TRACK_LABEL = { subtitle: "字幕", video: "视频", audio: "音频" };

  state.magnet = true;
  state.projectResolution = "720P";
  state.readonly = false;
  state.uploadQueue = [];
  state.collapsedFolders = {};

  state.tracks = {
    subtitle: [{ id: "sub-1", name: "字幕 1", enabled: true }],
    video: [{ id: "vid-1", name: "视频 1", enabled: true }],
    audio: [
      { id: "aud-1", name: "音频 1", enabled: true },
      { id: "aud-2", name: "音频 2", enabled: true }
    ]
  };

  /* —— 素材文件夹（一层） —— */
  var folderSeed = {};
  MT.library.forEach(function (asset) {
    var name = asset.group || "未分组";
    if (!folderSeed[name]) folderSeed[name] = MT.nextId("folder");
    asset.folderId = folderSeed[name];
  });
  MT.folders = Object.keys(folderSeed).map(function (name) {
    return { id: folderSeed[name], name: name };
  });
  if (!MT.folders.some(function (folder) { return folder.name === "未分组"; })) {
    MT.folders.push({ id: "folder-ungrouped", name: "未分组" });
  }
  MT.ungroupedFolderId = (MT.folders.find(function (folder) { return folder.name === "未分组"; }) || {}).id;

  MT.folderById = function (id) {
    return MT.folders.find(function (folder) { return folder.id === id; });
  };

  MT.renderResolution = function () {
    var el = $("#project-resolution");
    if (el) el.textContent = state.projectResolution;
  };

  MT.renderTrackChrome = function () {
    var labels = $("#track-labels");
    var lanes = $("#track-lanes");
    if (!labels || !lanes) return;
    var htmlLabels = '<div class="mt-ruler-spacer"></div>';
    var htmlLanes = "";
    ["subtitle", "video", "audio"].forEach(function (type) {
      state.tracks[type].forEach(function (track, index) {
        var icon = type === "subtitle" ? "T" : type === "video" ? "▶" : "♪";
        var extras = "";
        if (type === "subtitle" && index === 0) {
          extras += '<button type="button" data-act="add-subtitle" title="在播放位置添加字幕">＋</button>';
        }
        extras += '<button type="button" data-track-toggle="' + track.id + '" title="' + (track.enabled ? "隐藏" : "显示") + track.name + '" class="' + (track.enabled ? "" : "off") + '">' + (track.enabled ? "◉" : "⊘") + "</button>";
        var canDelete = !(type === "video" && index === 0) && !(type === "audio" && index === 0);
        if (canDelete) {
          extras += '<button type="button" class="mt-track-delete" data-act="remove-track" data-track-type="' + type + '" data-track-id="' + track.id + '" title="删除' + track.name + '" aria-label="删除' + track.name + '">×</button>';
        }
        htmlLabels += '<div class="mt-label-row" data-track-row="' + track.id + '">' +
          '<button type="button" data-act="track-menu" title="右侧 ◉ 显示或隐藏，× 删除这条轨道"><i class="mt-track-icon ' + (type === "subtitle" ? "sub" : type) + '">' + icon + '</i><em class="mt-track-name">' + esc(track.name) + "</em></button>" +
          "<span>" + extras + "</span></div>";
        htmlLanes += '<div class="mt-track mt-' + type + '-track' + (track.enabled ? "" : " is-disabled") + '" id="lane-' + track.id + '" data-lane-type="' + type + '" data-lane-id="' + track.id + '"></div>';
      });
      htmlLabels += '<div class="mt-label-row mt-add-track-row">' +
        '<button type="button" class="mt-add-track" data-act="add-track" data-track-type="' + type + '">＋ 新增' + MT.TRACK_LABEL[type] + "轨</button></div>";
      htmlLanes += '<div class="mt-track mt-add-track-spacer" data-add-spacer="' + type + '"></div>';
    });
    labels.innerHTML = htmlLabels;
    lanes.innerHTML = htmlLanes;
  };

  var baseRenderTracks = MT.renderTracks;
  MT.renderTracks = function () {
    MT.renderTrackChrome();
    var px = state.pixelsPerSecond;
    var doc = MT.doc;
    var entries = MT.clipEntries();

    var firstSub = state.tracks.subtitle[0];
    var subLane = firstSub && $("#lane-" + firstSub.id);
    if (subLane) {
      subLane.classList.toggle("is-disabled", !firstSub.enabled);
      subLane.innerHTML = doc.subtitles.map(function (subtitle) {
        var tag = subtitle.bilingual ? "双语" : (subtitle.fromAsr ? "ASR" : "");
        var tip = subtitle.bilingual ? "双语字幕" : (subtitle.fromAsr ? "ASR · " + (MT.audioLabelForSubtitle(subtitle) || "") : subtitle.text);
        return '<button type="button" class="mt-clip mt-subtitle-clip' + (state.selected === subtitle.id ? " on" : "") + (subtitle.fromAsr || subtitle.bilingual ? " is-asr" : "") + '" data-select-subtitle="' + subtitle.id + '" style="left:' + (subtitle.start * px) + "px;width:" + Math.max(24, subtitle.duration * px) + 'px" title="' + esc(tip) + '">' +
          "<span>" + esc(subtitle.text) + "</span>" + (tag ? '<small class="mt-clip-tag">' + tag + "</small>" : "") +
          '<i class="mt-trim left" data-trim="left" title="拖动调整开始时间"></i><i class="mt-trim right" data-trim="right" title="拖动调整时长"></i></button>';
      }).join("");
    }

    var firstVid = state.tracks.video[0];
    var vidLane = firstVid && $("#lane-" + firstVid.id);
    if (vidLane) {
      var gaps = entries.map(function (entry) {
        var gap = entry.clip.gap || 0;
        if (gap < 0.05) return "";
        return '<div class="mt-gap" style="left:' + ((entry.start - gap) * px) + "px;width:" + (gap * px) + 'px"><span>' + MT.secText(gap) + "</span></div>";
      }).join("");
      var marks = entries.slice(0, -1).map(function (entry, i) {
        if ((entries[i + 1].clip.gap || 0) > 0.05) return "";
        var type = doc.transitions[entry.clip.id];
        var on = state.selectedKind === "transition" && state.selected === entry.clip.id;
        return '<button type="button" class="mt-transition-mark' + (type ? " has" : "") + (on ? " on" : "") + '" data-transition-at="' + entry.clip.id + '" style="left:' + (entry.end * px) + 'px" title="' + (type ? MT.TRANSITIONS[type].name : "添加转场") + '">' +
          (type ? MT.TRANSITIONS[type].name.slice(0, 1) : "＋") + "</button>";
      }).join("");
      vidLane.innerHTML = gaps + entries.map(function (entry) {
        return baseVideoClipHtml(entry);
      }).join("") + marks;
    }
    /* 额外空视频轨 */
    state.tracks.video.slice(1).forEach(function (track) {
      var lane = $("#lane-" + track.id);
      if (lane) lane.innerHTML = "";
    });

    var firstAud = state.tracks.audio[0];
    var audLane = firstAud && $("#lane-" + firstAud.id);
    if (audLane) {
      audLane.classList.toggle("is-disabled", !firstAud.enabled || state.muted);
      audLane.innerHTML = '<button type="button" class="mt-clip mt-audio-clip' + (state.selected === "audio1" ? " on" : "") + (doc.audio.muted ? " is-muted" : "") + '" data-select-audio="audio1" style="left:0;width:' + (MT.totalDuration() * px) + 'px"><span>第1集旁白音频 · ' + MT.mmss(MT.totalDuration()) + " · " + (state.muted || doc.audio.muted ? "已静音" : "音量 " + doc.audio.volume + "%") + "</span></button>";
    }

    var audios = MT.audioEntries();
    var secondAud = state.tracks.audio[1];
    var aud2 = secondAud && $("#lane-" + secondAud.id);
    if (aud2) {
      aud2.innerHTML = audios.map(function (entry) {
        var item = entry.item;
        var text = item.generating ? item.label + " · 生成中…" : item.label + (item.muted ? " · 已静音" : item.volume !== 100 ? " · " + item.volume + "%" : "");
        var deleted = item.assetMissing ? ' <em class="mt-clip-missing">素材已删除</em>' : "";
        return '<button type="button" class="mt-clip mt-audio-clip is-detached' + (item.kind === "dub" ? " is-dub" : "") + (item.generating ? " is-generating" : "") + (item.muted ? " is-muted" : "") + (item.assetMissing ? " is-missing" : "") + (state.selected === item.id ? " on" : "") + '" data-select-extra="' + item.id + '" style="left:' + (entry.start * px) + "px;width:" + Math.max(24, entry.duration * px - 2) + 'px"><span>' + esc(text) + deleted + "</span></button>";
      }).join("");
    }
    state.tracks.audio.slice(2).forEach(function (track) {
      var lane = $("#lane-" + track.id);
      if (lane) lane.innerHTML = "";
    });

    $(".mt-main").classList.toggle("has-audio2", state.tracks.audio.length > 1);
  };

  function baseVideoClipHtml(entry) {
    var clip = entry.clip;
    var px = state.pixelsPerSecond;
    var fade = clip.opacity / 100 * 0.72;
    var picture = clip.parts
      ? '<em class="mt-clip-strip" style="opacity:' + fade + '">' + MT.partsOf(clip).map(function (part) {
        return '<img loading="lazy" decoding="async" src="' + part.image + '" alt="" style="flex:' + part.duration + '">';
      }).join("") + "</em>"
      : '<img loading="lazy" decoding="async" src="' + clip.image + '" alt="" style="opacity:' + fade + '">';
    var tags = [];
    if (clip.opacity < 100) tags.push("不透明 " + clip.opacity + "%");
    if (clip.muted) tags.push("已静音");
    else if (MT.audioOfClip(clip.id, "detached").length) tags.push("原声已分离");
    else if (clip.volume !== 100) tags.push("音量 " + clip.volume + "%");
    if (clip.assetMissing) tags.push("素材已删除");
    return '<button type="button" class="mt-clip mt-video-clip' + (state.selected === clip.id ? " on" : "") + (clip.generating ? " is-generating" : "") + (clip.assetMissing ? " is-missing" : "") + '" data-select-shot="' + clip.id + '" style="left:' + (entry.start * px) + "px;width:" + Math.max(14, clip.duration * px - 2) + 'px">' +
      picture + "<span>" + esc(clip.label) + " · " + MT.secText(clip.duration) + "</span>" +
      (tags.length ? '<small class="mt-clip-tag">' + tags.join(" · ") + "</small>" : "") +
      '<i class="mt-trim left" data-trim="left" title="拖动裁剪开头"></i><i class="mt-trim right" data-trim="right" title="拖动裁剪结尾"></i></button>';
  }

  MT.addTrack = function (type) {
    if (state.readonly) return;
    var limit = MT.TRACK_LIMITS[type];
    var list = state.tracks[type];
    if (list.length >= limit) {
      MT.toast(MT.TRACK_LABEL[type] + "轨道最多支持 " + limit + " 轨");
      return;
    }
    var n = list.length + 1;
    list.push({ id: type.slice(0, 3) + "-" + Date.now().toString(36), name: MT.TRACK_LABEL[type] + " " + n, enabled: true });
    MT.renderTracks();
    MT.renderPlayhead();
    MT.toast("已新增" + MT.TRACK_LABEL[type] + "轨（" + list.length + "/" + limit + "）");
  };

  MT.removeTrack = function (type, id) {
    if (state.readonly) return;
    var list = state.tracks[type];
    var index = list.findIndex(function (track) { return track.id === id; });
    if (index < 0) return;
    if (type === "video" && index === 0) return MT.toast("主视频轨不可删除，可以隐藏");
    if (type === "audio" && index === 0) return MT.toast("旁白音轨不可删除，可以隐藏");
    list.splice(index, 1);
    list.forEach(function (track, i) { track.name = MT.TRACK_LABEL[type] + " " + (i + 1); });
    MT.renderTracks();
    MT.renderPlayhead();
    MT.toast("已删除轨道，当前 " + MT.TRACK_LABEL[type] + " " + list.length + "/" + MT.TRACK_LIMITS[type]);
  };

  /* —— 磁吸 —— */
  var SNAP_PX = 12;
  state.lastSnap = null;
  state.snapBypass = false;

  MT.magnetActive = function () {
    return state.magnet !== state.snapBypass;
  };

  MT.snapPoints = function (excludeId, options) {
    var points = [{ time: 0, label: "起点" }];
    if (!(options && options.skipPlayhead)) points.push({ time: state.currentTime, label: "播放头", sel: "#playhead" });
    var rippleIndex = options && options.ripple ? MT.doc.clips.indexOf(MT.clipById(excludeId)) : -1;
    var moving = {};
    MT.clipEntries().forEach(function (entry, i) {
      if (rippleIndex >= 0 && i >= rippleIndex) {
        moving[entry.clip.id] = true;
        return;
      }
      if (entry.clip.id === excludeId) return;
      var sel = '[data-select-shot="' + entry.clip.id + '"]';
      points.push({ time: entry.start, label: "镜头" + (i + 1) + " 开头", sel: sel });
      points.push({ time: entry.end, label: "镜头" + (i + 1) + " 结尾", sel: sel });
    });
    MT.doc.subtitles.forEach(function (item) {
      if (item.id === excludeId) return;
      var sel = '[data-select-subtitle="' + item.id + '"]';
      points.push({ time: item.start, label: "字幕开头", sel: sel });
      points.push({ time: item.start + item.duration, label: "字幕结尾", sel: sel });
    });
    if (MT.audioEntries) MT.audioEntries().forEach(function (entry) {
      if (entry.item.id === excludeId || moving[entry.item.clipId]) return;
      var sel = '[data-select-extra="' + entry.item.id + '"]';
      points.push({ time: entry.start, label: "音频开头", sel: sel });
      points.push({ time: entry.start + entry.duration, label: "音频结尾", sel: sel });
    });
    return points;
  };

  /* edges：被拖动对象上参与吸附的位置相对 time 的偏移，返回吸附后的 time，命中信息记在 state.lastSnap */
  function snapEdges(time, edges, excludeId, options) {
    state.lastSnap = null;
    if (!MT.magnetActive()) return time;
    var bestDist = SNAP_PX / state.pixelsPerSecond;
    var best = null;
    var points = MT.snapPoints(excludeId, options);
    edges.forEach(function (offset) {
      points.forEach(function (point) {
        var dist = Math.abs(point.time - (time + offset));
        if (dist < bestDist) {
          bestDist = dist;
          best = { time: point.time, label: point.label, sel: point.sel, shift: point.time - offset };
        }
      });
    });
    if (!best) return time;
    state.lastSnap = best;
    return MT.round1(best.shift);
  }

  MT.snapTime = function (time, excludeId, options) {
    return snapEdges(time, [0], excludeId, options);
  };

  MT.snapRange = function (start, duration, excludeId, options) {
    return snapEdges(start, [0, duration], excludeId, options);
  };

  MT.showSnapGuide = function (time, active) {
    var guide = $("#snap-guide");
    $$(".is-snap-target").forEach(function (el) { el.classList.remove("is-snap-target"); });
    if (!guide) return;
    var hit = active && state.lastSnap;
    if (!hit) {
      guide.hidden = true;
      guide.classList.remove("is-flash");
      state.snapGuideAt = null;
      return;
    }
    if (state.snapGuideAt !== hit.time) {
      guide.classList.remove("is-flash");
      void guide.offsetWidth;
      guide.classList.add("is-flash");
      state.snapGuideAt = hit.time;
    }
    guide.hidden = false;
    guide.style.left = (hit.time * state.pixelsPerSecond) + "px";
    guide.innerHTML = "<span>吸附 · " + esc(hit.label) + " " + MT.secText(hit.time) + "</span>";
    var target = hit.sel && $(hit.sel);
    if (target && target.id !== "playhead") target.classList.add("is-snap-target");
  };

  MT.showSnapMarks = function (show, excludeId, options) {
    var box = $("#snap-marks");
    if (!box) return;
    if (!show || !MT.magnetActive()) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    var seen = {};
    box.innerHTML = MT.snapPoints(excludeId, options).map(function (point) {
      var key = point.time.toFixed(1);
      if (seen[key]) return "";
      seen[key] = true;
      return '<i style="left:' + (point.time * state.pixelsPerSecond) + 'px"></i>';
    }).join("");
    box.hidden = false;
  };

  function syncMagnetButton() {
    var button = $('[data-act="toggle-magnet"]');
    if (!button) return;
    var on = MT.magnetActive();
    button.classList.toggle("on", on);
    button.classList.toggle("is-bypass", state.snapBypass);
    button.setAttribute("aria-pressed", state.magnet ? "true" : "false");
    button.textContent = on ? "🧲 磁吸开" : "🧲 磁吸关";
  }

  /* 合拢视频轨所有空隙；字幕按它前面被去掉的空隙长度一起前移 */
  MT.closeGaps = function () {
    var holes = MT.clipEntries().map(function (entry) {
      var gap = entry.clip.gap || 0;
      return { from: entry.start - gap, gap: gap };
    }).filter(function (hole) { return hole.gap > 0.05; });
    if (!holes.length) return 0;
    MT.doc.subtitles.forEach(function (item) {
      var removed = holes.reduce(function (sum, hole) { return sum + MT.clamp(item.start - hole.from, 0, hole.gap); }, 0);
      item.start = MT.round1(item.start - removed);
    });
    MT.doc.clips.forEach(function (clip) { clip.gap = 0; });
    return holes.length;
  };

  MT.toggleMagnet = function () {
    state.magnet = !state.magnet;
    syncMagnetButton();
    if (!state.magnet) {
      state.lastSnap = null;
      MT.showSnapGuide(0, false);
      return MT.toast("磁吸已关闭：片段、字幕可以自由拖动并留出空隙，不再自动对齐（按住 ⌥ 临时吸附）");
    }
    var count = MT.gapCount();
    if (count) {
      MT.saveHistory("开启磁吸，合拢空隙");
      MT.closeGaps();
      state.currentTime = MT.clamp(state.currentTime, 0, MT.totalDuration());
      MT.refreshTimeline();
      return MT.toast("磁吸已开启：已合拢视频轨 " + count + " 处空隙，可撤销");
    }
    MT.toast("磁吸已开启：视频片段首尾相接，拖动时靠近边缘自动对齐（按住 ⌥ 临时关闭吸附）");
  };

  function setBypass(on) {
    if (state.snapBypass === on) return;
    state.snapBypass = on;
    syncMagnetButton();
    if (!MT.magnetActive()) {
      state.lastSnap = null;
      MT.showSnapGuide(0, false);
      MT.showSnapMarks(false);
    }
  }
  document.addEventListener("keydown", function (event) { if (event.key === "Alt") setBypass(true); });
  document.addEventListener("keyup", function (event) { if (event.key === "Alt") setBypass(false); });
  window.addEventListener("blur", function () { setBypass(false); });

  /* —— 素材区渲染（文件夹） —— */
  MT.renderAssets = function () {
    var list = MT.library.filter(function (asset) {
      return !state.query || asset.title.toLowerCase().indexOf(state.query.toLowerCase()) > -1;
    });
    var folderIds = MT.folders.map(function (folder) { return folder.id; });
    $("#asset-list").classList.toggle("is-grid", state.assetView === "grid");
    $("#asset-list").innerHTML = folderIds.map(function (folderId) {
      var folder = MT.folderById(folderId);
      var cards = list.filter(function (asset) { return asset.folderId === folderId; });
      if (!cards.length && state.query) return "";
      var collapsed = !!state.collapsedFolders[folderId];
      var body = collapsed ? "" : cards.map(function (asset) {
        var count = MT.doc.clips.filter(function (clip) { return clip.assetId === asset.id; }).length;
        return '<button type="button" class="mt-asset' + (state.selected === asset.id ? " on" : "") + '" data-asset="' + asset.id + '" draggable="true" data-folder="' + folderId + '" title="拖到时间线或文件夹">' +
          '<span class="mt-asset-thumb"><img loading="lazy" decoding="async" src="' + asset.image + '" alt=""><small class="mt-asset-badge">' + asset.duration + "</small></span>" +
          "<span><b>" + esc(asset.title) + '</b><small class="mt-asset-meta">' + asset.duration + "</small></span>" +
          '<em class="' + (count ? "added" : "") + '" data-add-asset="' + asset.id + '" title="添加到播放位置">' + (count ? "已添加" : "＋") + "</em>" +
          "</button>";
      }).join("");
      return '<section class="mt-group' + (collapsed ? " is-collapsed" : "") + '" data-folder-drop="' + folderId + '">' +
        '<div class="mt-group-head">' +
        '<button type="button" data-toggle-folder="' + folderId + '"><span class="arrow">' + (collapsed ? "›" : "⌄") + '</span><span class="folder">▱</span>' + esc(folder.name) + " <small>(" + cards.length + ")</small></button>" +
        '<span class="mt-folder-acts">' +
        (folder.name === "未分组" ? "" : '<button type="button" data-act="rename-folder" data-folder-id="' + folderId + '" title="重命名">✎</button><button type="button" data-act="delete-folder" data-folder-id="' + folderId + '" title="删除文件夹">🗑</button>') +
        "</span></div>" + body + "</section>";
    }).join("") || '<div class="mt-inspector-empty"><p>没有找到相关素材</p></div>';
  };

  MT.newFolder = function () {
    if (state.readonly) return;
    var name = window.prompt("新建文件夹名称", "新文件夹");
    if (!name) return;
    name = String(name).trim().slice(0, 20);
    if (!name) return;
    if (MT.folders.some(function (folder) { return folder.name === name; })) return MT.toast("已有同名文件夹");
    MT.folders.splice(MT.folders.length - 1, 0, { id: MT.nextId("folder"), name: name });
    MT.renderAssets();
    MT.toast("已创建文件夹「" + name + "」");
  };

  MT.renameFolder = function (id) {
    if (state.readonly) return;
    var folder = MT.folderById(id);
    if (!folder || folder.name === "未分组") return;
    var name = window.prompt("重命名文件夹", folder.name);
    if (!name) return;
    name = String(name).trim().slice(0, 20);
    if (!name) return;
    folder.name = name;
    MT.renderAssets();
    MT.toast("已重命名为「" + name + "」");
  };

  MT.deleteFolder = function (id) {
    if (state.readonly) return;
    var folder = MT.folderById(id);
    if (!folder || folder.name === "未分组") return;
    if (!window.confirm("删除文件夹「" + folder.name + "」？组内素材将移回「未分组」，不会删除素材。")) return;
    MT.library.forEach(function (asset) {
      if (asset.folderId === id) asset.folderId = MT.ungroupedFolderId;
    });
    MT.folders = MT.folders.filter(function (item) { return item.id !== id; });
    MT.renderAssets();
    MT.toast("文件夹已删除，素材已移回未分组");
  };

  /* —— 上传 —— */
  var LIMITS = {
    video: { ext: ["mp4", "mov"], maxSec: 30, maxMb: 200, maxRes: 1080 },
    image: { ext: ["jpg", "jpeg", "png", "webp"], maxMb: 30, minPx: 300, maxPx: 6000 },
    audio: { ext: ["mp3", "wav"], maxSec: 30, maxMb: 15 }
  };

  function fileKind(file) {
    var name = (file.name || "").toLowerCase();
    var ext = name.split(".").pop();
    if (LIMITS.video.ext.indexOf(ext) >= 0 || (file.type || "").indexOf("video/") === 0) return "video";
    if (LIMITS.audio.ext.indexOf(ext) >= 0 || (file.type || "").indexOf("audio/") === 0) return "audio";
    if (LIMITS.image.ext.indexOf(ext) >= 0 || (file.type || "").indexOf("image/") === 0) return "image";
    return null;
  }

  function validateFile(file) {
    var kind = fileKind(file);
    if (!kind) return { ok: false, reason: "格式不支持" };
    var mb = file.size / (1024 * 1024);
    var rule = LIMITS[kind];
    var ext = (file.name || "").toLowerCase().split(".").pop();
    if (rule.ext.indexOf(ext) < 0) return { ok: false, reason: "格式不支持" };
    if (mb > rule.maxMb) return { ok: false, reason: kind === "video" ? "视频不能超过 200 MB" : kind === "audio" ? "音频不能超过 15 MB" : "图片不能超过 30 MB" };
    /* 原型不解码媒体，时长/分辨率用文件名提示演示；明显违规用 mock 名触发 */
    if (/over30s|too.?long/i.test(file.name)) return { ok: false, reason: kind === "video" ? "视频时长不能超过 30 秒" : "音频时长不能超过 30 秒" };
    if (/4k|2160/i.test(file.name) && kind === "video") return { ok: false, reason: "视频分辨率不能超过 1080P" };
    return { ok: true, kind: kind };
  }

  MT.openUpload = function () {
    if (state.readonly) return;
    state.uploadQueue = [];
    $("#upload-list").innerHTML = "";
    $('[data-act="confirm-upload"]').disabled = true;
    $("#upload-modal").hidden = false;
  };

  MT.closeUpload = function () {
    $("#upload-modal").hidden = true;
    state.uploadQueue = [];
  };

  MT.queueUploadFiles = function (files) {
    Array.prototype.forEach.call(files || [], function (file) {
      var check = validateFile(file);
      state.uploadQueue.push({
        id: MT.nextId("up"),
        file: file,
        name: file.name,
        ok: check.ok,
        kind: check.kind,
        reason: check.reason || "",
        status: check.ok ? "ready" : "blocked"
      });
    });
    MT.renderUploadList();
  };

  MT.renderUploadList = function () {
    var list = $("#upload-list");
    list.innerHTML = state.uploadQueue.map(function (item) {
      return "<li class=\"" + (item.ok ? "ok" : "bad") + "\"><b>" + esc(item.name) + "</b><span>" +
        (item.status === "blocked" ? item.reason : item.status === "done" ? "已进入未分组" : item.status === "fail" ? item.reason : item.kind) +
        "</span></li>";
    }).join("") || "<li class=\"empty\">尚未选择文件</li>";
    $('[data-act="confirm-upload"]').disabled = !state.uploadQueue.some(function (item) { return item.ok && item.status === "ready"; });
  };

  MT.confirmUpload = function () {
    var ready = state.uploadQueue.filter(function (item) { return item.ok && item.status === "ready"; });
    if (!ready.length) return;
    ready.forEach(function (item) {
      var cover = (MT.library[0] && MT.library[0].image) || "";
      MT.library.push({
        id: MT.nextId("asset"),
        folderId: MT.ungroupedFolderId,
        title: item.name.replace(/\.[^.]+$/, ""),
        duration: item.kind === "image" ? "图片" : item.kind === "audio" ? "音频" : "0:05",
        image: cover,
        kind: item.kind,
        uploaded: true
      });
      item.status = "done";
    });
    state.uploadQueue.filter(function (item) { return !item.ok; }).forEach(function (item) { item.status = "blocked"; });
    MT.renderUploadList();
    MT.renderAssets();
    MT.toast("已上传 " + ready.length + " 个素材到「未分组」");
    setTimeout(MT.closeUpload, 500);
  };

  /* —— 只读互斥 —— */
  var LOCK_KEY = "jieshuoju.multitrack.ep1.lock";
  var lockId = MT.nextId("tab");

  function claimLock() {
    try {
      var now = Date.now();
      var raw = localStorage.getItem(LOCK_KEY);
      var lock = raw ? JSON.parse(raw) : null;
      if (lock && lock.id !== lockId && now - lock.at < 15000) {
        state.readonly = true;
        $("#readonly-banner").hidden = false;
        document.body.classList.add("is-readonly");
        return false;
      }
      localStorage.setItem(LOCK_KEY, JSON.stringify({ id: lockId, at: now }));
      return true;
    } catch (error) {
      return true;
    }
  }

  function heartbeat() {
    if (state.readonly) return;
    try { localStorage.setItem(LOCK_KEY, JSON.stringify({ id: lockId, at: Date.now() })); } catch (error) {}
  }

  function releaseLock() {
    try {
      var raw = localStorage.getItem(LOCK_KEY);
      var lock = raw ? JSON.parse(raw) : null;
      if (lock && lock.id === lockId) localStorage.removeItem(LOCK_KEY);
    } catch (error) {}
  }

  if (new URLSearchParams(location.search).get("readonly") === "1") {
    state.readonly = true;
    $("#readonly-banner").hidden = false;
    document.body.classList.add("is-readonly");
  } else {
    claimLock();
    setInterval(heartbeat, 4000);
    window.addEventListener("beforeunload", releaseLock);
    window.addEventListener("storage", function (event) {
      if (event.key !== LOCK_KEY || state.readonly) return;
      claimLock();
    });
  }

  /* 覆盖 new-asset toast */
  document.addEventListener("click", function (event) {
    var target = event.target;
    var act = target.closest("[data-act]");
    if (!act) {
      var toggle = target.closest("[data-toggle-folder]");
      if (toggle) {
        var fid = toggle.dataset.toggleFolder;
        state.collapsedFolders[fid] = !state.collapsedFolders[fid];
        MT.renderAssets();
      }
      return;
    }
    var action = act.dataset.act;
    if (action === "toggle-magnet") return MT.toggleMagnet();
    if (action === "add-track") return MT.addTrack(act.dataset.trackType);
    if (action === "remove-track") return MT.removeTrack(act.dataset.trackType, act.dataset.trackId);
    if (action === "upload-asset" || action === "new-asset") return MT.openUpload();
    if (action === "close-upload") return MT.closeUpload();
    if (action === "confirm-upload") return MT.confirmUpload();
    if (action === "new-folder") return MT.newFolder();
    if (action === "rename-folder") return MT.renameFolder(act.dataset.folderId);
    if (action === "delete-folder") return MT.deleteFolder(act.dataset.folderId);
    if (action === "restore-draft") return MT.applyDraftRestore(true);
    if (action === "discard-draft") return MT.applyDraftRestore(false);
  }, true);

  /* track toggle by track id */
  document.addEventListener("click", function (event) {
    var toggle = event.target.closest("[data-track-toggle]");
    if (!toggle) return;
    var id = toggle.dataset.trackToggle;
    ["subtitle", "video", "audio"].some(function (type) {
      return state.tracks[type].some(function (track, index) {
        if (track.id !== id) return false;
        if (type === "subtitle" && MT.isSubtitleLocked && MT.doc.subtitles.some(function (subtitle) {
          return subtitle.trackId === id && MT.isSubtitleLocked(subtitle.id);
        })) {
          event.stopPropagation();
          MT.toast("AI 任务处理中，完成后可继续编辑");
          return true;
        }
        track.enabled = !track.enabled;
        if (index === 0 && (type === "subtitle" || type === "audio")) {
          state.disabledTracks[type === "subtitle" ? "subtitle" : "audio"] = !track.enabled;
        }
        event.stopPropagation();
        MT.renderTracks();
        MT.renderPlayhead();
        return true;
      });
    });
  }, true);

  var dropzone = $("#upload-dropzone");
  var uploadInput = $("#upload-input");
  if (dropzone && uploadInput) {
    dropzone.addEventListener("click", function () { uploadInput.click(); });
    uploadInput.addEventListener("change", function () {
      MT.queueUploadFiles(uploadInput.files);
      uploadInput.value = "";
    });
    dropzone.addEventListener("dragover", function (event) { event.preventDefault(); dropzone.classList.add("over"); });
    dropzone.addEventListener("dragleave", function () { dropzone.classList.remove("over"); });
    dropzone.addEventListener("drop", function (event) {
      event.preventDefault();
      dropzone.classList.remove("over");
      MT.queueUploadFiles(event.dataTransfer.files);
    });
  }

  /* 素材拖入文件夹 */
  document.addEventListener("dragover", function (event) {
    var zone = event.target.closest("[data-folder-drop]");
    if (!zone) return;
    event.preventDefault();
    zone.classList.add("is-drop-target");
  });
  document.addEventListener("dragleave", function (event) {
    var zone = event.target.closest("[data-folder-drop]");
    if (zone) zone.classList.remove("is-drop-target");
  });
  document.addEventListener("drop", function (event) {
    var zone = event.target.closest("[data-folder-drop]");
    $$(".is-drop-target").forEach(function (el) { el.classList.remove("is-drop-target"); });
    if (!zone || state.readonly) return;
    event.preventDefault();
    var assetId = event.dataTransfer.getData("text/plain");
    var asset = MT.library.find(function (item) { return item.id === assetId; });
    if (!asset) return;
    asset.folderId = zone.dataset.folderDrop;
    MT.renderAssets();
    MT.toast("已移到「" + MT.folderById(asset.folderId).name + "」");
  });

  MT.renderResolution();

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (!$("#upload-modal").hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      MT.closeUpload();
    } else if (!$("#draft-modal").hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      MT.applyDraftRestore(false);
    }
  }, true);

  /* 多轨超出可视高度时，左右栏纵向同步滚动 */
  (function syncTrackScroll() {
    var labels = $("#track-labels");
    var scroll = $("#timeline-scroll");
    if (!labels || !scroll) return;
    var locking = false;
    function link(from, to) {
      from.addEventListener("scroll", function () {
        if (locking) return;
        locking = true;
        to.scrollTop = from.scrollTop;
        locking = false;
      }, { passive: true });
    }
    link(labels, scroll);
    link(scroll, labels);
  })();

  /* 截图演示：?demo=upload|draft|readonly|tracks|magnet-off|gaps|snap */
  var demo = new URLSearchParams(location.search).get("demo");
  if (demo === "upload") setTimeout(function () { MT.openUpload(); }, 200);
  if (demo === "draft") setTimeout(function () {
    var modal = $("#draft-modal");
    if (modal) modal.hidden = false;
  }, 200);
  if (demo === "readonly") {
    state.readonly = true;
    $("#readonly-banner").hidden = false;
    document.body.classList.add("is-readonly");
  }
  if (demo === "tracks") setTimeout(function () {
    while (state.tracks.subtitle.length < MT.TRACK_LIMITS.subtitle) MT.addTrack("subtitle");
    while (state.tracks.video.length < MT.TRACK_LIMITS.video) MT.addTrack("video");
    while (state.tracks.audio.length < MT.TRACK_LIMITS.audio) MT.addTrack("audio");
    MT.toast("字幕轨道最多支持 3 轨");
  }, 250);
  if (demo === "magnet-off") setTimeout(function () {
    if (state.magnet) MT.toggleMagnet();
  }, 200);
  if (demo === "gaps") setTimeout(function () {
    if (state.magnet) MT.toggleMagnet();
    var anchors = MT.doc.subtitles.map(function (item) {
      var entry = MT.entryAt(item.start);
      return { item: item, clip: entry.clip, offset: item.start - entry.start };
    });
    MT.doc.clips[1].gap = 2.5;
    MT.doc.clips[3].gap = 4;
    anchors.forEach(function (a) { a.item.start = MT.round1(MT.entryOf(a.clip).start + a.offset); });
    MT.normalizeDoc();
    state.currentTime = MT.clipEntries()[1].start - 1.2;
    MT.refreshTimeline();
  }, 300);
  if (demo === "snap") setTimeout(function () {
    var subtitle = MT.doc.subtitles[1];
    var target = MT.clipEntries()[1];
    if (!subtitle || !target) return;
    subtitle.start = MT.snapRange(target.start + 0.3, subtitle.duration, subtitle.id);
    var hit = state.lastSnap;
    state.selectedKind = "subtitle";
    state.selected = subtitle.id;
    MT.refreshTimeline();
    state.lastSnap = hit;
    MT.showSnapMarks(true, subtitle.id);
    MT.showSnapGuide(0, true);
  }, 300);
  if (demo === "folders") setTimeout(function () {
    state.collapsedFolders = {};
    MT.renderAssets();
  }, 200);
})();
