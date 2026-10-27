/* 多轨编辑器 · 编辑操作：播放、分割合并、复制粘贴、转场、素材入轨、AI 演示操作、撤销重做。 */
(function () {
  var MT = window.MT;
  var D = window.ReplicaData;
  var $$ = MT.$$;
  var state = MT.state;
  var clone = function (value) { return JSON.parse(JSON.stringify(value)); };

  MT.stopPlayback = function () {
    state.playing = false;
    clearInterval(state.timer);
    state.timer = null;
    $$(".mt-play").forEach(function (button) { button.textContent = "▶"; });
    MT.renderMeter();
  };

  MT.togglePlayback = function () {
    if (state.playing) {
      MT.stopPlayback();
      return;
    }
    if (state.currentTime >= MT.totalDuration()) state.currentTime = 0;
    state.playing = true;
    $$(".mt-play").forEach(function (button) { button.textContent = "❚❚"; });
    state.timer = setInterval(function () {
      state.currentTime = Math.min(MT.totalDuration(), state.currentTime + 0.1);
      MT.renderPlayhead();
      if (state.currentTime >= MT.totalDuration()) MT.stopPlayback();
    }, 100);
  };

  MT.undo = function () {
    if (!state.history.length) return MT.toast("没有可撤销的操作");
    var last = state.history.pop();
    state.future.push({ label: last.label, data: MT.snapshot() });
    MT.restore(last.data);
    MT.refreshTimeline();
    MT.toast("已撤销：" + last.label);
  };

  MT.redo = function () {
    if (!state.future.length) return MT.toast("没有可重做的操作");
    var next = state.future.pop();
    state.history.push({ label: next.label, data: MT.snapshot() });
    MT.restore(next.data);
    MT.refreshTimeline();
    MT.toast("已重做：" + next.label);
  };

  function splitClipAt(entry, offset) {
    var first = entry.clip;
    var second = clone(first);
    second.id = MT.nextId("clip");
    second.srcIn = MT.round1(first.srcIn + offset);
    second.duration = MT.round1(first.duration - offset);
    first.duration = MT.round1(offset);
    var base = first.label.replace(/-\d+$/, "");
    if (first.label === base) first.label = base + "-1";
    second.label = base + "-" + (MT.doc.clips.filter(function (clip) { return clip.label.indexOf(base) === 0; }).length + 1);
    if (MT.doc.transitions[first.id]) {
      MT.doc.transitions[second.id] = MT.doc.transitions[first.id];
      delete MT.doc.transitions[first.id];
    }
    MT.doc.clips.splice(entry.index + 1, 0, second);
    return second;
  }

  MT.splitAtPlayhead = function () {
    if (!MT.canSplit()) return MT.toast("把播放头移到片段中间再分割，两边至少留 " + MT.MIN_CLIP + " 秒");
    var entry = MT.entryAt(state.currentTime);
    MT.saveHistory("分割片段");
    var second = splitClipAt(entry, state.currentTime - entry.start);
    state.selectedKind = "shot";
    state.selected = second.id;
    MT.refreshTimeline();
    MT.toast("已在 " + MT.secText(state.currentTime) + " 处分割");
  };

  MT.smartSplit = function (clip) {
    var count = clip.duration >= 12 ? 3 : 2;
    var piece = clip.duration / count;
    if (piece < 2) return MT.toast("片段太短，无法再切割分镜");
    MT.saveHistory("智能切割分镜");
    var current = clip;
    for (var i = 1; i < count; i += 1) {
      current = splitClipAt(MT.entryOf(current), MT.round1(piece));
    }
    state.selectedKind = "shot";
    state.selected = clip.id;
    MT.refreshTimeline();
    MT.toast("已按镜头切成 " + count + " 段");
  };

  MT.mergeWithNext = function (clip) {
    var clips = MT.doc.clips;
    var transitions = MT.doc.transitions;
    var index = clips.indexOf(clip);
    var next = clips[index + 1];
    if (!next) return MT.toast("后面没有片段可以合并");
    MT.saveHistory("合并片段");
    var base = clip.label.replace(/-\d+$/, "");
    var continuous = !clip.parts && !next.parts && base === next.label.replace(/-\d+$/, "") &&
      clip.image === next.image && Math.abs(next.srcIn - (clip.srcIn + clip.duration)) < 0.05;
    if (continuous) {
      clip.label = base;
    } else {
      clip.parts = MT.partsOf(clip).concat(MT.partsOf(next));
      clip.srcIn = 0;
      clip.sourceDuration = MT.round1(clip.duration + next.duration);
      clip.label = clip.label + "+" + next.label.replace(/^\S+\s/, "");
    }
    clip.duration = MT.round1(clip.duration + next.duration);
    clip.sourceDuration = Math.max(clip.sourceDuration, clip.srcIn + clip.duration);
    delete transitions[clip.id];
    if (transitions[next.id]) transitions[clip.id] = transitions[next.id];
    delete transitions[next.id];
    clips.splice(index + 1, 1);
    state.selectedKind = "shot";
    state.selected = clip.id;
    MT.refreshTimeline();
    MT.toast("已合并为 " + clip.label + "，共 " + MT.secText(clip.duration));
  };

  function insertIndexAtPlayhead() {
    var entry = MT.entryAt(state.currentTime);
    if (!entry) return MT.doc.clips.length;
    return state.currentTime - entry.start < entry.clip.duration / 2 ? entry.index : entry.index + 1;
  }

  function insertClip(clip, index, label) {
    MT.doc.clips.splice(index, 0, clip);
    state.selectedKind = "shot";
    state.selected = clip.id;
    state.currentTime = MT.entryOf(clip).start;
    MT.refreshTimeline();
    MT.toast(label + " " + MT.mmss(state.currentTime));
  }

  MT.addAsset = function (asset) {
    var parts = String(asset.duration).split(":");
    var duration = parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : 3;
    MT.saveHistory("添加素材");
    var clip = MT.makeClip({
      label: "素材 " + String(MT.doc.clips.length + 1).padStart(2, "0"),
      title: asset.title,
      image: asset.image,
      prompt: asset.prompt,
      duration: duration
    });
    clip.assetId = asset.id;
    insertClip(clip, insertIndexAtPlayhead(), "已添加到视频轨");
  };

  MT.deleteSelection = function () {
    var kind = state.selectedKind;
    if (kind === "shot") {
      var clip = MT.selectedShot();
      if (MT.doc.clips.length <= 1) return MT.toast("视频轨至少保留一个片段");
      MT.saveHistory("删除片段");
      delete MT.doc.transitions[clip.id];
      MT.doc.clips.splice(MT.doc.clips.indexOf(clip), 1);
      MT.dropDanglingTransition();
      MT.toast("已删除 " + clip.label);
    } else if (kind === "subtitle") {
      MT.saveHistory("删除字幕");
      MT.doc.subtitles = MT.doc.subtitles.filter(function (item) { return item.id !== state.selected; });
      MT.toast("已删除字幕");
    } else if (kind === "transition") {
      MT.saveHistory("移除转场");
      delete MT.doc.transitions[state.selected];
      MT.toast("已移除转场");
    } else if (kind === "extra") {
      MT.saveHistory("删除分离音频");
      MT.doc.extraAudio = MT.doc.extraAudio.filter(function (item) { return item.id !== state.selected; });
      MT.toast("已删除分离音频");
    } else {
      return;
    }
    MT.clearSelection();
    MT.refreshTimeline();
  };

  MT.copySelection = function (silent) {
    var clip = MT.selectedShot();
    var subtitle = MT.selectedSubtitle();
    if (!clip && !subtitle) return false;
    state.clipboard = clip ? { kind: "shot", data: clone(clip) } : { kind: "subtitle", data: clone(subtitle) };
    state.clipboard.data.generating = false;
    if (!silent) MT.toast("已复制" + (clip ? " " + clip.label : "字幕"));
    return true;
  };

  MT.cutSelection = function () {
    if (MT.selectedShot() && MT.doc.clips.length <= 1) return MT.toast("视频轨至少保留一个片段");
    if (!MT.copySelection(true)) return;
    MT.deleteSelection();
    MT.toast("已剪切，按 ⌘V 粘贴到播放头位置");
  };

  MT.paste = function () {
    var board = state.clipboard;
    if (!board) return MT.toast("剪贴板是空的");
    if (board.kind === "shot") {
      MT.saveHistory("粘贴片段");
      var clip = clone(board.data);
      clip.id = MT.nextId("clip");
      if (MT.clipById(board.data.id)) clip.label = board.data.label + " 副本";
      insertClip(clip, insertIndexAtPlayhead(), "已粘贴到");
      return;
    }
    MT.saveHistory("粘贴字幕");
    var subtitle = clone(board.data);
    subtitle.id = MT.nextId("sub");
    subtitle.start = MT.round1(MT.clamp(state.currentTime, 0, Math.max(0, MT.totalDuration() - subtitle.duration)));
    MT.doc.subtitles.push(subtitle);
    MT.select("subtitle", subtitle.id, subtitle.start);
    MT.toast("已粘贴字幕到 " + MT.mmss(subtitle.start));
  };

  MT.duplicate = function () {
    var clip = MT.selectedShot();
    var subtitle = MT.selectedSubtitle();
    if (clip) {
      MT.saveHistory("创建副本");
      var copy = clone(clip);
      copy.id = MT.nextId("clip");
      copy.generating = false;
      copy.label = clip.label + " 副本";
      insertClip(copy, MT.doc.clips.indexOf(clip) + 1, "已创建副本，位于");
    } else if (subtitle) {
      MT.saveHistory("创建字幕副本");
      var sub = clone(subtitle);
      sub.id = MT.nextId("sub");
      sub.start = MT.round1(subtitle.start + subtitle.duration);
      MT.doc.subtitles.push(sub);
      MT.select("subtitle", sub.id, sub.start);
      MT.toast("已创建字幕副本");
    }
  };

  MT.addSubtitle = function () {
    MT.saveHistory("添加字幕");
    var added = { id: MT.nextId("sub"), start: MT.round1(state.currentTime), duration: 3, text: "请输入字幕" };
    MT.doc.subtitles.push(added);
    MT.select("subtitle", added.id, added.start);
    MT.toast("已在播放位置添加字幕");
  };

  MT.setTransition = function (clipId, type) {
    if (MT.doc.transitions[clipId] !== type) {
      MT.saveHistory("添加转场");
      MT.doc.transitions[clipId] = type;
    }
    MT.select("transition", clipId);
    MT.toast("已添加" + MT.TRANSITIONS[type].name + "转场，时长 " + MT.TRANSITION_SECONDS + " 秒");
  };

  MT.openTransition = function (clip) {
    var entry = MT.entryOf(clip);
    if (!entry || entry.index >= MT.doc.clips.length - 1) return MT.toast("最后一段后面没有片段，无法加转场");
    MT.select("transition", clip.id, entry.end);
  };

  MT.previewTransition = function (clipId) {
    var entry = MT.entryOf(MT.clipById(clipId));
    if (!entry) return;
    MT.stopPlayback();
    state.currentTime = Math.max(0, entry.end - 1.2);
    MT.togglePlayback();
    setTimeout(function () { if (state.playing) MT.stopPlayback(); }, 2400);
  };

  MT.detachAudio = function (clip) {
    if (clip.volume === 0) return MT.toast(clip.label + " 的原声已经分离过了");
    var entry = MT.entryOf(clip);
    MT.saveHistory("音频分离");
    MT.doc.extraAudio.push({ id: MT.nextId("aud"), start: entry.start, duration: clip.duration, label: clip.label + " 原声" });
    clip.volume = 0;
    MT.refreshTimeline();
    MT.toast("已把 " + clip.label + " 的原声分离到「音频 2」");
  };

  MT.recognizeSubtitle = function (clip) {
    var entry = MT.entryOf(clip);
    MT.toast("正在识别 " + clip.label + " 的台词…");
    setTimeout(function () {
      var busy = MT.doc.subtitles
        .filter(function (item) { return item.start < entry.end && item.start + item.duration > entry.start; })
        .sort(function (a, b) { return a.start - b.start; });
      var cursor = entry.start;
      var gap = null;
      busy.concat([{ start: entry.end, duration: 0 }]).some(function (item) {
        if (item.start - cursor >= 1.5) gap = { start: cursor, end: item.start };
        cursor = Math.max(cursor, item.start + item.duration);
        return !!gap;
      });
      if (!gap) return MT.toast(clip.label + " 的台词都已有字幕，没有新增");
      MT.saveHistory("字幕识别");
      var added = { id: MT.nextId("sub"), start: MT.round1(gap.start + 0.2), duration: MT.round1(Math.min(4, gap.end - gap.start - 0.4)), text: clip.title };
      MT.doc.subtitles.push(added);
      MT.select("subtitle", added.id, added.start);
      MT.toast("已识别并添加 1 条字幕");
    }, 900);
  };

  MT.reshoot = function (clip) {
    state.inspectorTab = "info";
    if (state.inspectorCollapsed) MT.toggleInspector();
    MT.select("shot", clip.id, MT.entryOf(clip).start);
    var prompt = MT.$(".mt-prompt");
    if (prompt) prompt.focus();
    MT.toast("改好画面描述后点「重新生成」，消耗 " + MT.REGENERATE_COST + " 积分");
  };

  MT.regenerate = function (clip) {
    if (clip.generating) return;
    if (D.credits < MT.REGENERATE_COST) return MT.toast("积分不足，重新生成片段需要 " + MT.REGENERATE_COST + " 积分");
    D.credits -= MT.REGENERATE_COST;
    clip.generating = true;
    MT.renderCredits();
    MT.renderTracks();
    MT.renderInspector();
    MT.renderPlayhead();
    MT.toast("正在重新生成 " + clip.label + "，已扣 " + MT.REGENERATE_COST + " 积分");
    setTimeout(function () {
      clip.generating = false;
      clip.version += 1;
      MT.renderTracks();
      MT.renderInspector();
      MT.renderPlayhead();
      MT.toast(clip.label + " 已重新生成");
    }, 1400);
  };

  MT.resetVisual = function (clip) {
    MT.saveHistory("恢复默认画面");
    clip.scaleX = 1;
    clip.scaleY = 1;
    clip.rotate = 0;
    clip.opacity = 100;
    MT.renderTracks();
    MT.renderInspector();
    MT.renderPlayhead();
  };

  MT.toggleMute = function () {
    state.muted = !state.muted;
    var button = MT.$('[data-act="mute-all"]');
    button.classList.toggle("off", state.muted);
    button.setAttribute("aria-label", state.muted ? "取消静音" : "静音");
    MT.renderTracks();
    MT.renderInspector();
    MT.renderMeter();
    MT.toast(state.muted ? "已全局静音" : "已恢复声音");
  };

  MT.toggleInspector = function () {
    state.inspectorCollapsed = !state.inspectorCollapsed;
    MT.$("#inspector").classList.toggle("is-collapsed", state.inspectorCollapsed);
    MT.$(".mt-main").classList.toggle("inspector-collapsed", state.inspectorCollapsed);
    MT.$('[data-act="collapse-inspector"]').textContent = state.inspectorCollapsed ? "展开设置" : "收起设置";
    setTimeout(MT.renderRuler, 0);
  };
})();
