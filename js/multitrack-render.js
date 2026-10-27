/* 多轨编辑器 · 渲染层：素材库、标尺、轨道、预览、响度表、右侧面板、工具栏可用状态。 */
(function () {
  var MT = window.MT;
  var D = window.ReplicaData;
  var $ = MT.$;
  var $$ = MT.$$;
  var esc = MT.escapeHtml;
  var state = MT.state;

  MT.renderCredits = function () {
    $("#credits").textContent = Number(D.credits).toLocaleString("zh-CN");
  };

  MT.renderAssets = function () {
    var list = MT.library.filter(function (asset) {
      return !state.query || asset.title.toLowerCase().indexOf(state.query.toLowerCase()) > -1;
    });
    var groups = [];
    list.forEach(function (asset) {
      if (groups.indexOf(asset.group) < 0) groups.push(asset.group);
    });
    $("#asset-list").classList.toggle("is-grid", state.assetView === "grid");
    $("#asset-list").innerHTML = groups.map(function (group) {
      var cards = list.filter(function (asset) { return asset.group === group; }).map(function (asset) {
        var count = MT.doc.clips.filter(function (clip) { return clip.assetId === asset.id; }).length;
        return '<button type="button" class="mt-asset' + (state.selected === asset.id ? " on" : "") + '" data-asset="' + asset.id + '" draggable="true" title="点击查看，拖到时间线添加">' +
          '<span class="mt-asset-thumb"><img src="' + asset.image + '" alt=""><small class="mt-asset-badge">' + asset.duration + "</small></span>" +
          "<span><b>" + esc(asset.title) + '</b><small class="mt-asset-meta">' + asset.duration + "</small></span>" +
          '<em class="' + (count ? "added" : "") + '" data-add-asset="' + asset.id + '" title="添加到播放位置">' + (count ? "已添加" : "＋") + "</em>" +
          "</button>";
      }).join("");
      return '<section class="mt-group"><button type="button" class="mt-group-head" data-group="' + esc(group) + '">' +
        '<span class="arrow">⌄</span><span class="folder">▱</span>' + esc(group) + "</button>" + cards + "</section>";
    }).join("") || '<div class="mt-inspector-empty"><p>没有找到相关素材</p></div>';
  };

  function timelineWidth() {
    return Math.max(MT.totalDuration() * state.pixelsPerSecond + 160, $("#timeline-scroll").clientWidth || 0);
  }

  MT.renderRuler = function () {
    var step = state.pixelsPerSecond >= 24 ? 5 : 10;
    var html = "";
    for (var second = 0; second <= MT.totalDuration() + 10; second += step) {
      html += '<span style="left:' + (second * state.pixelsPerSecond) + 'px">' + MT.mmss(second) + "</span>";
    }
    $("#timeline-canvas").style.width = timelineWidth() + "px";
    $("#ruler").innerHTML = html;
  };

  function videoClipHtml(entry) {
    var clip = entry.clip;
    var px = state.pixelsPerSecond;
    var fade = clip.opacity / 100 * 0.72;
    var picture = clip.parts
      ? '<em class="mt-clip-strip" style="opacity:' + fade + '">' + MT.partsOf(clip).map(function (part) {
        return '<img src="' + part.image + '" alt="" style="flex:' + part.duration + '">';
      }).join("") + "</em>"
      : '<img src="' + clip.image + '" alt="" style="opacity:' + fade + '">';
    var tags = [];
    if (clip.opacity < 100) tags.push("不透明 " + clip.opacity + "%");
    if (clip.muted) tags.push("已静音");
    else if (MT.audioOfClip(clip.id, "detached").length) tags.push("原声已分离");
    else if (clip.volume !== 100) tags.push("音量 " + clip.volume + "%");
    return '<button type="button" class="mt-clip mt-video-clip' + (state.selected === clip.id ? " on" : "") + (clip.generating ? " is-generating" : "") + '" data-select-shot="' + clip.id + '" style="left:' + (entry.start * px) + "px;width:" + Math.max(14, clip.duration * px - 2) + 'px">' +
      picture + "<span>" + esc(clip.label) + " · " + MT.secText(clip.duration) + "</span>" +
      (tags.length ? '<small class="mt-clip-tag">' + tags.join(" · ") + "</small>" : "") +
      '<i class="mt-trim left" data-trim="left" title="拖动裁剪开头"></i><i class="mt-trim right" data-trim="right" title="拖动裁剪结尾"></i></button>';
  }

  MT.renderTracks = function () {
    var px = state.pixelsPerSecond;
    var doc = MT.doc;
    var entries = MT.clipEntries();
    $("#subtitle-track").classList.toggle("is-disabled", !!state.disabledTracks.subtitle);
    $("#audio-track").classList.toggle("is-disabled", !!state.disabledTracks.audio || state.muted);
    $("#subtitle-track").innerHTML = doc.subtitles.map(function (subtitle) {
      return '<button type="button" class="mt-clip mt-subtitle-clip' + (state.selected === subtitle.id ? " on" : "") + '" data-select-subtitle="' + subtitle.id + '" style="left:' + (subtitle.start * px) + "px;width:" + Math.max(24, subtitle.duration * px) + 'px">' +
        "<span>" + esc(subtitle.text) + "</span></button>";
    }).join("");
    var marks = entries.slice(0, -1).map(function (entry) {
      var type = doc.transitions[entry.clip.id];
      var on = state.selectedKind === "transition" && state.selected === entry.clip.id;
      return '<button type="button" class="mt-transition-mark' + (type ? " has" : "") + (on ? " on" : "") + '" data-transition-at="' + entry.clip.id + '" style="left:' + (entry.end * px) + 'px" title="' + (type ? MT.TRANSITIONS[type].name : "添加转场") + '">' +
        (type ? MT.TRANSITIONS[type].name.slice(0, 1) : "＋") + "</button>";
    }).join("");
    $("#video-track").innerHTML = entries.map(videoClipHtml).join("") + marks;
    $("#audio-track").innerHTML = '<button type="button" class="mt-clip mt-audio-clip' + (state.selected === "audio1" ? " on" : "") + (doc.audio.muted ? " is-muted" : "") + '" data-select-audio="audio1" style="left:0;width:' + (MT.totalDuration() * px) + 'px"><span>第1集旁白音频 · ' + MT.mmss(MT.totalDuration()) + " · " + (state.muted || doc.audio.muted ? "已静音" : "音量 " + doc.audio.volume + "%") + "</span></button>";

    var audios = MT.audioEntries();
    $(".mt-main").classList.toggle("has-audio2", audios.length > 0);
    $("#audio2-track").innerHTML = audios.map(function (entry) {
      var item = entry.item;
      var text = item.generating ? item.label + " · 生成中…" : item.label + (item.muted ? " · 已静音" : item.volume !== 100 ? " · " + item.volume + "%" : "");
      return '<button type="button" class="mt-clip mt-audio-clip is-detached' + (item.kind === "dub" ? " is-dub" : "") + (item.generating ? " is-generating" : "") + (item.muted ? " is-muted" : "") + (state.selected === item.id ? " on" : "") + '" data-select-extra="' + item.id + '" style="left:' + (entry.start * px) + "px;width:" + Math.max(24, entry.duration * px - 2) + 'px"><span>' + esc(text) + "</span></button>";
    }).join("");
  };

  function transitionAt(time) {
    var entries = MT.clipEntries();
    var half = MT.TRANSITION_SECONDS / 2;
    for (var i = 0; i < entries.length - 1; i += 1) {
      var type = MT.doc.transitions[entries[i].clip.id];
      if (!type) continue;
      var boundary = entries[i].end;
      if (time >= boundary - half && time < boundary + half) {
        return { type: type, from: entries[i].clip, to: entries[i + 1].clip, progress: (time - (boundary - half)) / MT.TRANSITION_SECONDS };
      }
    }
    return null;
  }

  function visualTransform(clip) {
    return "scale(" + clip.scaleX + "," + clip.scaleY + ") rotate(" + clip.rotate + "deg)";
  }

  MT.renderPlayhead = function () {
    $("#playhead").style.left = state.currentTime * state.pixelsPerSecond + "px";
    $("#playhead").querySelector("span").textContent = MT.mmss(state.currentTime);
    $("#current-time").textContent = MT.mmss(state.currentTime);
    $("#total-time").textContent = MT.mmss(MT.totalDuration());
    if (!MT.doc.clips.length) return;

    var entry = MT.entryAt(state.currentTime);
    var clip = entry.clip;
    var picked = MT.selectedShot();
    var trans = transitionAt(state.currentTime);
    var base = $("#preview-image");
    var next = $("#preview-next");
    var layer = $("#transition-layer");

    base.src = MT.imageAt(clip, state.currentTime - entry.start);
    base.style.transform = visualTransform(clip);
    base.style.opacity = clip.opacity / 100;
    next.hidden = true;
    layer.className = "mt-transition-layer";
    layer.style.opacity = 0;

    if (trans) {
      if (trans.type === "dissolve") {
        base.src = MT.imageAt(trans.from, trans.from.duration);
        base.style.transform = visualTransform(trans.from);
        base.style.opacity = trans.from.opacity / 100;
        next.hidden = false;
        next.src = MT.imageAt(trans.to, 0);
        next.style.transform = visualTransform(trans.to);
        next.style.opacity = trans.progress * trans.to.opacity / 100;
      } else {
        layer.className = "mt-transition-layer " + trans.type;
        layer.style.opacity = 1 - Math.abs(trans.progress * 2 - 1);
      }
    }

    $("#transform-box").hidden = !(picked && picked.id === clip.id);
    $("#generating").hidden = !clip.generating;
    var subtitle = state.disabledTracks.subtitle ? null : MT.activeSubtitleAt(state.currentTime);
    $("#preview-meta").textContent = clip.label + " · " + clip.title + " · " + MT.secText(clip.duration) + (trans ? " · " + MT.TRANSITIONS[trans.type].name : "");
    $("#caption-preview").textContent = subtitle ? subtitle.text : "";
    $("#caption-preview").className = "mt-caption-preview" + (state.subtitleStyle === "plain" ? "" : " " + state.subtitleStyle);
    MT.renderMeter();
    MT.renderToolbarState();
  };

  function audioLevel() {
    if (state.muted || !state.playing) return { left: 0, right: 0 };
    var t = state.currentTime;
    var audio = MT.doc.audio;
    var gain = 0;
    if (!state.disabledTracks.audio && !audio.muted) {
      var fadeGain = 1;
      if (audio.fade > 0) fadeGain = Math.min(1, t / audio.fade, (MT.totalDuration() - t) / audio.fade);
      gain += (MT.activeSubtitleAt(t) ? 0.82 : 0.42) * (audio.volume / 100) * Math.max(0, fadeGain);
    }
    var clip = MT.entryAt(t).clip;
    if (!clip.muted) gain += 0.22 * (clip.volume / 100);
    MT.audioEntries().forEach(function (entry) {
      var item = entry.item;
      if (item.muted || item.generating) return;
      if (t >= entry.start && t < entry.start + entry.duration) gain += (item.kind === "dub" ? 0.3 : 0.22) * (item.volume / 100);
    });
    var wobble = 0.78 + 0.22 * Math.abs(Math.sin(t * 7.3) * Math.cos(t * 2.1));
    var level = MT.clamp(gain * wobble, 0, 1.08);
    return { left: level, right: MT.clamp(level * (0.9 + 0.1 * Math.sin(t * 5.1)), 0, 1.08) };
  }

  MT.renderMeter = function () {
    var level = audioLevel();
    [["left", level.left], ["right", level.right]].forEach(function (pair) {
      var bar = $("#meter-" + pair[0]);
      bar.style.height = Math.min(100, pair[1] / 1.08 * 100) + "%";
      bar.classList.toggle("is-hot", pair[1] > 0.95);
    });
    var peak = Math.max(level.left, level.right);
    $("#meter-value").textContent = peak > 0.01 ? Math.round(20 * Math.log10(peak) - 9) + " LUFS" : "—";
    $("#meter-value").classList.toggle("is-hot", peak > 0.95);
  };

  MT.canSplit = function () {
    var entry = MT.entryAt(state.currentTime);
    if (!entry) return false;
    var offset = state.currentTime - entry.start;
    return offset >= MT.MIN_CLIP && entry.clip.duration - offset >= MT.MIN_CLIP;
  };

  MT.renderToolbarState = function () {
    var shot = MT.selectedShot();
    var hasNext = shot && MT.doc.clips.indexOf(shot) < MT.doc.clips.length - 1;
    var rules = {
      split: MT.canSplit(),
      merge: !!hasNext,
      "add-transition": !!hasNext,
      "delete-selection": !!state.selected && state.selectedKind !== "asset" && state.selectedKind !== "audio",
      "generate-audio": !!shot && !MT.busyReason(shot),
      "remove-subtitles": MT.doc.subtitles.length > 0,
      undo: state.history.length > 0,
      redo: state.future.length > 0
    };
    Object.keys(rules).forEach(function (act) {
      $$('.mt-tool-group [data-act="' + act + '"]').forEach(function (button) { button.disabled = !rules[act]; });
    });
  };

  function axisRow(label, setting, value, min, max, step, unit) {
    return '<label class="mt-axis"><span>' + label + '</span>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" data-setting="' + setting + '">' +
      '<input type="number" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '" data-setting="' + setting + '">' +
      "<em>" + unit + "</em></label>";
  }

  function muteRow(muted, act) {
    return '<div class="mt-mute-row"><span>静音</span><button type="button" class="mt-switch' + (muted ? " on" : "") + '" data-act="' + act + '" role="switch" aria-checked="' + muted + '" aria-label="静音"><i></i></button></div>';
  }

  var EMPTY_TIPS = [
    ["点选片段", "改画面描述、重新生成、缩放旋转"],
    ["右键片段", "复制、剪切、创建副本、片段重拍等"],
    ["拖动片段", "调整顺序；拖两端可裁剪"],
    ["S", "在播放头处分割"],
    ["空格", "播放 / 暂停"]
  ];

  var inspectors = {
    empty: function (body) {
      $("#inspector-title").textContent = "片段设置";
      body.innerHTML = '<div class="mt-inspector-empty"><span>◇</span><p>选择片段或字幕后可进行调整</p>' +
        '<dl class="mt-tips">' + EMPTY_TIPS.map(function (tip) { return "<dt>" + tip[0] + "</dt><dd>" + tip[1] + "</dd>"; }).join("") + "</dl></div>";
    },
    shot: function (body) {
      var clip = MT.selectedShot();
      $("#inspector-title").textContent = "片段编辑";
      var tabs = '<div class="mt-edit-tabs" role="tablist">' +
        '<button type="button" role="tab" data-inspector-tab="info"' + (state.inspectorTab === "info" ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + ">生成信息</button>" +
        '<button type="button" role="tab" data-inspector-tab="clip"' + (state.inspectorTab === "clip" ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + ">片段设置</button></div>";
      var head = '<div class="mt-clip-head"><img src="' + MT.imageAt(clip, 0) + '" alt=""><span><b>' + esc(clip.label) + "</b><small>" + esc(clip.title) + " · " + MT.secText(clip.duration) + (clip.version > 1 ? " · 第 " + clip.version + " 版" : "") + "</small></span></div>";
      var content = state.inspectorTab === "clip"
        ? '<div class="mt-axis-group"><b>画面</b>' +
          axisRow("缩放 X", "scale-x", clip.scaleX.toFixed(2), "0.5", "2", "0.01", "×") +
          axisRow("缩放 Y", "scale-y", clip.scaleY.toFixed(2), "0.5", "2", "0.01", "×") +
          axisRow("旋转", "rotate", String(Math.round(clip.rotate)), "-180", "180", "1", "°") +
          axisRow("不透明", "opacity", String(clip.opacity), "0", "100", "1", "%") + "</div>" +
          '<div class="mt-axis-group"><b>声音</b>' + axisRow("音量", "clip-volume", String(clip.volume), "0", "200", "1", "%") +
          muteRow(clip.muted, "toggle-clip-mute") + "</div>" +
          '<div class="mt-clip-facts"><span>时长 <b>' + MT.secText(clip.duration) + "</b></span><span>素材入点 <b>" + MT.secText(clip.srcIn) + "</b></span></div>" +
          '<div class="mt-setting-actions mt-clip-actions"><button type="button" data-act="reset-visual">恢复默认画面</button></div>'
        : '<textarea class="mt-prompt" data-setting="prompt" placeholder="描述你想要生成的画面内容，@引用素材">' + esc(clip.prompt) + "</textarea>" +
          '<p class="mt-cost">重新生成会替换当前片段画面，消耗 <b>' + MT.REGENERATE_COST + "</b> 积分；失败不扣费</p>" +
          (clip.genError ? '<p class="mt-hint">重新生成失败：' + esc(clip.genError) + "</p>" : "") +
          '<div class="mt-edit-foot"><button type="button" data-act="edit-prompt">编辑</button>' +
          '<button type="button" class="is-primary" data-act="regenerate"' + (clip.generating ? " disabled" : "") + ">" + (clip.generating ? "生成中…" : clip.genError ? "重试" : "重新生成") + "</button></div>";
      body.innerHTML = head + tabs + content;
    },
    transition: function (body) {
      var from = MT.clipById(state.selected);
      var to = MT.doc.clips[MT.doc.clips.indexOf(from) + 1];
      var current = MT.doc.transitions[state.selected];
      $("#inspector-title").textContent = "转场";
      body.innerHTML = '<div class="mt-setting"><label>位置</label><div class="mt-setting-title">' + esc(from.label) + " → " + esc(to ? to.label : "") + "</div></div>" +
        '<div class="mt-transition-list">' + Object.keys(MT.TRANSITIONS).map(function (key) {
          return '<button type="button" class="mt-transition-option' + (current === key ? " on" : "") + '" data-transition-type="' + key + '">' +
            '<span class="mt-transition-swatch ' + key + '"></span><span><b>' + MT.TRANSITIONS[key].name + "</b><small>" + MT.TRANSITIONS[key].desc + "</small></span></button>";
        }).join("") + "</div>" +
        '<div class="mt-setting"><div class="mt-setting-row"><span>时长</span><span class="mt-fixed">' + MT.TRANSITION_SECONDS + " 秒 · 固定</span></div></div>" +
        (current ? '<div class="mt-setting-actions"><button type="button" data-act="preview-transition">预览转场</button><button type="button" class="danger" data-act="remove-transition">移除转场</button></div>' : "");
    },
    subtitle: function (body) {
      var subtitle = MT.selectedSubtitle();
      $("#inspector-title").textContent = "字幕设置";
      body.innerHTML = '<div class="mt-setting"><label>字幕内容</label><textarea class="mt-sub-text" data-setting="subtitle-text" rows="4">' + esc(subtitle.text) + "</textarea></div>" +
        '<div class="mt-setting"><b>时间</b><div class="mt-setting-row"><span>开始</span><input type="number" step="0.1" value="' + subtitle.start.toFixed(1) + '" data-setting="subtitle-start"></div>' +
        '<div class="mt-setting-row"><span>时长</span><input type="number" step="0.1" value="' + subtitle.duration.toFixed(1) + '" data-setting="subtitle-duration"></div></div>' +
        '<div class="mt-setting-actions"><button type="button" data-act="duplicate">创建副本</button><button type="button" class="danger" data-act="delete-selection">删除字幕</button></div>';
    },
    audio: function (body) {
      $("#inspector-title").textContent = "音频设置";
      body.innerHTML = '<div class="mt-setting"><label>当前选择</label><div class="mt-setting-title">第1集旁白音频</div></div>' +
        '<div class="mt-axis-group"><b>声音</b>' +
        axisRow("音量", "audio-volume", String(MT.doc.audio.volume), "0", "200", "1", "%") +
        axisRow("淡入出", "audio-fade", String(MT.doc.audio.fade), "0", "5", "0.5", "s") +
        muteRow(MT.doc.audio.muted, "toggle-narration-mute") + "</div>" +
        (state.muted ? '<p class="mt-hint">当前已全局静音，点时间线右上角的 ♬ 恢复。</p>' : "");
    },
    extra: function (body) {
      var item = MT.doc.extraAudio.find(function (audio) { return audio.id === state.selected; });
      var entry = MT.audioEntries().find(function (row) { return row.item === item; });
      var owner = MT.clipById(item.clipId);
      $("#inspector-title").textContent = item.kind === "dub" ? "配音" : "分离音频";
      body.innerHTML = '<div class="mt-setting"><label>当前选择</label><div class="mt-setting-title">' + esc(item.label) + "</div>" +
        (item.text ? '<p class="mt-dub-text">' + esc(item.text) + "</p>" : "") + "</div>" +
        '<div class="mt-setting"><div class="mt-setting-row"><span>跟随片段</span><span class="mt-fixed">' + esc(owner ? owner.label : "—") + '</span></div>' +
        '<div class="mt-setting-row"><span>开始</span><span class="mt-fixed">' + MT.secText(entry ? entry.start : 0) + '</span></div><div class="mt-setting-row"><span>时长</span><span class="mt-fixed">' + MT.secText(entry ? entry.duration : item.duration) + "</span></div></div>" +
        (item.generating ? '<p class="mt-cost">配音生成中，完成后可调整音量</p>' :
          '<div class="mt-axis-group"><b>声音</b>' + axisRow("音量", "extra-volume", String(item.volume), "0", "200", "1", "%") + muteRow(item.muted, "toggle-extra-mute") + "</div>") +
        '<div class="mt-setting-actions"><button type="button" class="danger" data-act="delete-selection"' + (item.generating ? " disabled" : "") + ">删除这段音频</button></div>";
    },
    asset: function (body) {
      var asset = MT.library.find(function (item) { return item.id === state.selected; }) || {};
      $("#inspector-title").textContent = "素材详情";
      body.innerHTML = '<div class="mt-asset-preview"><img src="' + asset.image + '" alt=""></div>' +
        '<div class="mt-setting"><label>当前选择</label><div class="mt-setting-title">' + esc(asset.title) + "</div></div>" +
        '<div class="mt-setting-actions"><button type="button" data-add-asset="' + asset.id + '">添加到播放位置</button></div>';
    }
  };

  MT.renderInspector = function () {
    var body = $("#inspector-body");
    var kind = state.selected ? state.selectedKind : "empty";
    (inspectors[kind] || inspectors.empty)(body);
  };

  MT.renderSelection = function () {
    MT.renderAssets();
    MT.renderTracks();
    MT.renderInspector();
    MT.renderToolbarState();
  };

  MT.renderAll = function () {
    MT.renderAssets();
    MT.renderRuler();
    MT.renderTracks();
    MT.renderInspector();
    MT.renderPlayhead();
    MT.renderCredits();
  };

  MT.select = function (kind, id, time) {
    state.selectedKind = kind;
    state.selected = id;
    if (typeof time === "number") state.currentTime = MT.clamp(time, 0, MT.totalDuration());
    MT.renderSelection();
    MT.renderPlayhead();
  };

  MT.refreshTimeline = function () {
    MT.normalizeDoc();
    if (state.selectedKind === "subtitle" && !MT.selectedSubtitle()) MT.clearSelection();
    if (state.selectedKind === "extra" && !MT.doc.extraAudio.some(function (item) { return item.id === state.selected; })) MT.clearSelection();
    state.currentTime = MT.clamp(state.currentTime, 0, MT.totalDuration());
    MT.renderAll();
  };
})();
