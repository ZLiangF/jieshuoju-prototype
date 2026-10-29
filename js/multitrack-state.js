/* 多轨编辑器 · 数据层：工具函数、时间线数据、界面状态、撤销重做。其余 multitrack-*.js 都挂在 window.MT 上。 */
(function () {
  var D = window.ReplicaData;
  var MT = window.MT = {};

  MT.TRANSITION_SECONDS = 0.6;
  MT.MIN_CLIP = 0.5;
  MT.REGENERATE_COST = 150;
  /* 演示异常分支：地址栏加 ?mock=save-fail,regen-fail,dub-fail */
  MT.mock = {};
  (new URLSearchParams(location.search).get("mock") || "").split(",").forEach(function (key) {
    if (key) MT.mock[key.trim()] = true;
  });
  MT.TRANSITIONS = {
    flash: { name: "闪白", desc: "白光一闪切到下一段" },
    black: { name: "黑场", desc: "先压暗再亮起" },
    dissolve: { name: "叠化", desc: "前后画面交叠过渡" }
  };

  MT.$ = function (selector, root) { return (root || document).querySelector(selector); };
  MT.$$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  MT.clamp = function (value, min, max) { return Math.max(min, Math.min(max, value)); };
  MT.round1 = function (value) { return Math.round(value * 10) / 10; };
  MT.mmss = function (value) {
    var seconds = Math.max(0, Math.round(value));
    return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  };
  MT.secText = function (value) { return MT.round1(value).toFixed(1) + "s"; };
  MT.escapeHtml = function (value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  };
  var uid = 0;
  MT.nextId = function (prefix) { uid += 1; return prefix + Date.now().toString(36) + uid; };
  MT.toast = function (text) { window.ReplicaUI.toast(text); };

  function sceneOf(shot) {
    var sceneId = String((shot.scenes || [])[0] || "").split("/")[0];
    return D.scenes.find(function (scene) { return scene.id === sceneId; }) || D.scenes[0];
  }
  function coverOf(shot) {
    var scene = sceneOf(shot);
    var sceneId = String((shot.scenes || [])[0] || "");
    if (sceneId.indexOf("/") > -1) {
      var child = (scene.looksList || []).find(function (look) { return look.id === sceneId.split("/")[1]; });
      if (child && child.image) return child.image;
    }
    return scene.image;
  }

  MT.makeClip = function (source) {
    return {
      id: MT.nextId("clip"),
      label: source.label,
      title: source.title,
      image: source.image,
      prompt: source.prompt || "",
      sourceDuration: source.duration,
      srcIn: 0,
      duration: source.duration,
      scaleX: 1,
      scaleY: 1,
      rotate: 0,
      opacity: 100,
      volume: 100,
      muted: false,
      version: 1,
      generating: false
    };
  };

  MT.doc = {
    clips: D.shots.map(function (shot) {
      return MT.makeClip({
        label: "片段 " + String(shot.no).padStart(2, "0"),
        title: shot.title,
        image: coverOf(shot),
        prompt: shot.prompt,
        duration: shot.duration
      });
    }),
    subtitles: [
      { id: "sub1", start: 1.0, duration: 4.1, text: "妈，对不起，今天来晚了。" },
      { id: "sub2", start: 10.6, duration: 4.0, text: "我说怎么找不到人" },
      { id: "sub3", start: 15.0, duration: 5.4, text: "原来在给一个死人上坟。" },
      { id: "sub4", start: 29.0, duration: 4.8, text: "萧铭，你还要逃避到什么时候？" },
      { id: "sub5", start: 39.5, duration: 4.5, text: "这份离婚协议，今天必须签。" },
      { id: "sub6", start: 51.5, duration: 5.3, text: "从今天起，我们两不相欠。" }
    ],
    transitions: {},
    audio: { volume: 80, fade: 0, muted: false },
    /* 音频 2 上的片段都挂在某个视频片段上（clipId + offset），视频移动、分割、合并、删除时跟着走。 */
    extraAudio: []
  };

  MT.library = [
    { id: "a1", group: "01 集片段分组", title: "第1集｜片段01–03｜智能预演", duration: "0:06", shot: 0 },
    { id: "a2", group: "01 集片段分组", title: "第1集｜片段01｜分镜01｜智能预演", duration: "0:04", shot: 0 },
    { id: "a3", group: "01 集片段分组", title: "第1集｜片段01｜分镜02｜智能预演", duration: "0:06", shot: 1 },
    { id: "a4", group: "01 集片段分组", title: "第1集｜片段02｜分镜01｜智能预演", duration: "0:04", shot: 2 },
    { id: "a5", group: "01 集片段分组", title: "第1集｜片段03｜分镜01｜智能预演", duration: "0:05", shot: 3 },
    { id: "a6", group: "01 集片段分组", title: "第1集｜片段03｜分镜02｜智能预演", duration: "0:05", shot: 4 },
    { id: "a7", group: "01 集片段分组", title: "第1集｜片段04｜分镜01｜智能预演", duration: "0:07", shot: 5 },
    { id: "c1", group: "角色与场景", title: "萧铭 · 外卖服基础形象", duration: "角色", image: D.characters[0].image },
    { id: "c2", group: "角色与场景", title: "贺芷 · 职业装基础形象", duration: "角色", image: D.characters[1].image },
    { id: "s1", group: "角色与场景", title: "墓地 · 阴天全景", duration: "场景", image: D.scenes[0].image }
  ].concat(D.props.filter(function (prop) { return prop.eps.indexOf(1) > -1 && prop.status === "ready"; }).map(function (prop) {
    return { id: "p-" + prop.id, group: "道具", title: prop.name, duration: "道具", image: prop.image };
  })).map(function (asset) {
    if (typeof asset.shot === "number") {
      asset.image = coverOf(D.shots[asset.shot]);
      asset.prompt = D.shots[asset.shot].prompt;
    }
    return asset;
  });

  MT.state = {
    selected: null,
    selectedKind: null,
    currentTime: 0,
    pixelsPerSecond: 18,
    playing: false,
    timer: null,
    query: "",
    assetView: "list",
    disabledTracks: {},
    muted: false,
    subtitleStyle: "plain",
    libraryCollapsed: false,
    inspectorCollapsed: false,
    previewCollapsed: false,
    timelineCollapsed: false,
    libraryWidth: window.innerWidth <= 1180 ? 220 : 248,
    inspectorWidth: window.innerWidth <= 1180 ? 260 : 292,
    timelineHeight: null,
    inspectorTab: "info",
    suppressClick: false,
    clipboard: null,
    history: [],
    future: []
  };

  MT.totalDuration = function () {
    return MT.doc.clips.reduce(function (sum, clip) { return sum + clip.duration; }, 0);
  };

  MT.clipEntries = function () {
    var cursor = 0;
    return MT.doc.clips.map(function (clip, index) {
      var item = { clip: clip, index: index, start: cursor, end: cursor + clip.duration };
      cursor += clip.duration;
      return item;
    });
  };

  MT.entryOf = function (clip) {
    return MT.clipEntries().find(function (entry) { return entry.clip === clip; });
  };

  MT.clipById = function (id) {
    return MT.doc.clips.find(function (clip) { return clip.id === id; });
  };

  MT.subtitleById = function (id) {
    return MT.doc.subtitles.find(function (item) { return item.id === id; });
  };

  MT.entryAt = function (time) {
    var entries = MT.clipEntries();
    for (var i = entries.length - 1; i >= 0; i -= 1) {
      if (time >= entries[i].start) return entries[i];
    }
    return entries[0];
  };

  MT.activeSubtitleAt = function (time) {
    return MT.doc.subtitles.find(function (subtitle) {
      return time >= subtitle.start && time <= subtitle.start + subtitle.duration;
    });
  };

  MT.selectedShot = function () {
    return MT.state.selectedKind === "shot" ? MT.clipById(MT.state.selected) : null;
  };

  MT.selectedSubtitle = function () {
    return MT.state.selectedKind === "subtitle" ? MT.subtitleById(MT.state.selected) : null;
  };

  /* 合并过的片段会带 parts：按顺序记录每一小段用的画面，入点/时长裁剪后只取可见部分。 */
  MT.partsOf = function (clip) {
    var source = clip.parts || [{ image: clip.image, duration: clip.sourceDuration }];
    var from = clip.srcIn;
    var to = clip.srcIn + clip.duration;
    var cursor = 0;
    var result = [];
    source.forEach(function (part) {
      var start = Math.max(cursor, from);
      var end = Math.min(cursor + part.duration, to);
      if (end - start > 0.01) result.push({ image: part.image, duration: MT.round1(end - start) });
      cursor += part.duration;
    });
    return result;
  };

  MT.imageAt = function (clip, local) {
    if (!clip.parts) return clip.image;
    var position = clip.srcIn + MT.clamp(local, 0, clip.duration);
    var cursor = 0;
    for (var i = 0; i < clip.parts.length; i += 1) {
      cursor += clip.parts[i].duration;
      if (position < cursor) return clip.parts[i].image;
    }
    return clip.parts[clip.parts.length - 1].image;
  };

  MT.clearSelection = function () {
    MT.state.selected = null;
    MT.state.selectedKind = null;
  };

  MT.snapshot = function () {
    return JSON.stringify(MT.doc);
  };

  MT.restore = function (text) {
    MT.doc = JSON.parse(text);
    MT.doc.clips.forEach(function (clip) { clip.generating = false; });
    MT.doc.extraAudio = MT.doc.extraAudio.filter(function (item) { return !item.generating; });
    var state = MT.state;
    if (state.selectedKind === "shot" && !MT.clipById(state.selected)) MT.clearSelection();
    if (state.selectedKind === "subtitle" && !MT.subtitleById(state.selected)) MT.clearSelection();
    if (state.selectedKind === "transition" && !MT.doc.transitions[state.selected]) MT.clearSelection();
    state.currentTime = MT.clamp(state.currentTime, 0, MT.totalDuration());
  };

  MT.saveHistory = function (label, before) {
    MT.state.history.push({ label: label, data: before || MT.snapshot() });
    if (MT.state.history.length > 30) MT.state.history.shift();
    MT.state.future = [];
    if (MT.markDirty) MT.markDirty();
  };

  MT.dropDanglingTransition = function () {
    var clips = MT.doc.clips;
    if (clips.length) delete MT.doc.transitions[clips[clips.length - 1].id];
  };

  MT.audioEntries = function () {
    return MT.doc.extraAudio.map(function (item) {
      var entry = MT.entryOf(MT.clipById(item.clipId));
      if (!entry) return null;
      var duration = Math.min(item.duration, entry.clip.duration - item.offset);
      return { item: item, start: entry.start + item.offset, duration: Math.max(0, duration) };
    }).filter(function (entry) { return entry && entry.duration > 0.05; });
  };

  MT.audioOfClip = function (clipId, kind) {
    return MT.doc.extraAudio.filter(function (item) { return item.clipId === clipId && (!kind || item.kind === kind); });
  };

  MT.subtitlesIn = function (start, end) {
    return MT.doc.subtitles.filter(function (item) { return item.start >= start - 0.01 && item.start < end - 0.01; });
  };

  /* 视频轨在 at 处插入(delta>0)或删掉(delta<0)一段时间：删掉范围内开始的字幕一起删，后面的字幕整体平移。 */
  MT.retimeSubtitles = function (at, delta) {
    if (Math.abs(delta) < 0.01) return 0;
    var removed = 0;
    if (delta < 0) {
      var end = at - delta;
      var before = MT.doc.subtitles.length;
      MT.doc.subtitles = MT.doc.subtitles.filter(function (item) { return !(item.start >= at - 0.01 && item.start < end - 0.01); });
      removed = before - MT.doc.subtitles.length;
      MT.doc.subtitles.forEach(function (item) { if (item.start >= end - 0.01) item.start = MT.round1(item.start + delta); });
    } else {
      MT.doc.subtitles.forEach(function (item) { if (item.start >= at - 0.01) item.start = MT.round1(item.start + delta); });
    }
    return removed;
  };

  /* 保证不出现悬空引用、负时长、超出总时长的数据。 */
  MT.normalizeDoc = function () {
    var doc = MT.doc;
    var total = MT.totalDuration();
    doc.subtitles = doc.subtitles.filter(function (item) {
      if (item.start < 0) item.start = 0;
      if (item.start > total - MT.MIN_CLIP) return false;
      item.duration = MT.round1(Math.min(item.duration, total - item.start));
      return item.duration >= MT.MIN_CLIP - 0.01;
    });
    doc.extraAudio = doc.extraAudio.filter(function (item) { return !!MT.clipById(item.clipId); });
    Object.keys(doc.transitions).forEach(function (id) { if (!MT.clipById(id)) delete doc.transitions[id]; });
    MT.dropDanglingTransition();
  };
})();
