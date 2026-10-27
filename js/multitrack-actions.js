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
    MT.markDirty();
    MT.toast("已撤销：" + last.label);
  };

  MT.redo = function () {
    if (!state.future.length) return MT.toast("没有可重做的操作");
    var next = state.future.pop();
    state.history.push({ label: next.label, data: MT.snapshot() });
    MT.restore(next.data);
    MT.refreshTimeline();
    MT.markDirty();
    MT.toast("已重做：" + next.label);
  };

  function busyReason(clip) {
    if (!clip) return "";
    if (clip.generating) return clip.label + " 正在重新生成，完成后再操作";
    if (MT.audioOfClip(clip.id).some(function (item) { return item.generating; })) return clip.label + " 的配音正在生成，完成后再操作";
    return "";
  }
  MT.busyReason = busyReason;

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
    MT.audioOfClip(first.id).forEach(function (item) {
      if (item.offset >= offset - 0.01) {
        item.clipId = second.id;
        item.offset = MT.round1(item.offset - offset);
      }
    });
    MT.doc.clips.splice(entry.index + 1, 0, second);
    return second;
  }

  MT.splitAtPlayhead = function () {
    if (!MT.canSplit()) return MT.toast("把播放头移到片段中间再分割，两边至少留 " + MT.MIN_CLIP + " 秒");
    var entry = MT.entryAt(state.currentTime);
    if (busyReason(entry.clip)) return MT.toast(busyReason(entry.clip));
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
    if (busyReason(clip)) return MT.toast(busyReason(clip));
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
    if (busyReason(clip) || busyReason(next)) return MT.toast(busyReason(clip) || busyReason(next));
    MT.saveHistory("合并片段");
    MT.audioOfClip(next.id).forEach(function (item) {
      item.clipId = clip.id;
      item.offset = MT.round1(item.offset + clip.duration);
    });
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
    MT.retimeSubtitles(state.currentTime, clip.duration);
    MT.refreshTimeline();
    MT.toast(label + " " + MT.mmss(state.currentTime));
  }

  MT.addAsset = function (asset, index) {
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
    insertClip(clip, typeof index === "number" ? index : insertIndexAtPlayhead(), "已添加到视频轨");
  };

  MT.deleteSelection = function () {
    var kind = state.selectedKind;
    if (kind === "shot") {
      var clip = MT.selectedShot();
      if (MT.doc.clips.length <= 1) return MT.toast("视频轨至少保留一个片段");
      if (busyReason(clip)) return MT.toast(busyReason(clip));
      var entry = MT.entryOf(clip);
      MT.saveHistory("删除片段");
      delete MT.doc.transitions[clip.id];
      MT.doc.clips.splice(MT.doc.clips.indexOf(clip), 1);
      MT.doc.extraAudio = MT.doc.extraAudio.filter(function (item) { return item.clipId !== clip.id; });
      var removed = MT.retimeSubtitles(entry.start, -clip.duration);
      MT.dropDanglingTransition();
      MT.toast("已删除 " + clip.label + (removed ? "，同步移除 " + removed + " 条字幕" : ""));
    } else if (kind === "subtitle") {
      MT.saveHistory("删除字幕");
      MT.doc.subtitles = MT.doc.subtitles.filter(function (item) { return item.id !== state.selected; });
      MT.toast("已删除字幕");
    } else if (kind === "transition") {
      MT.saveHistory("移除转场");
      delete MT.doc.transitions[state.selected];
      MT.toast("已移除转场");
    } else if (kind === "extra") {
      var audio = MT.doc.extraAudio.find(function (item) { return item.id === state.selected; });
      if (audio && audio.generating) return MT.toast("配音还在生成，完成后再删除");
      MT.saveHistory("删除音频");
      MT.doc.extraAudio = MT.doc.extraAudio.filter(function (item) { return item.id !== state.selected; });
      MT.toast("已删除音频");
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
    state.clipboard.data.genError = "";
    if (!silent) MT.toast("已复制" + (clip ? " " + clip.label : "字幕"));
    return true;
  };

  MT.cutSelection = function () {
    if (MT.selectedShot() && MT.doc.clips.length <= 1) return MT.toast("视频轨至少保留一个片段");
    if (busyReason(MT.selectedShot())) return MT.toast(busyReason(MT.selectedShot()));
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
    if (MT.audioOfClip(clip.id, "detached").length) return MT.toast(clip.label + " 的原声已经分离过了");
    MT.saveHistory("音频分离");
    MT.doc.extraAudio.push({ id: MT.nextId("aud"), kind: "detached", clipId: clip.id, offset: 0, duration: clip.duration, label: clip.label + " 原声", volume: clip.volume || 100, muted: false });
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

  /* 积分先冻结，成功才算扣费；失败退回并保留原片段。 */
  MT.regenerate = function (clip) {
    if (clip.generating) return;
    if (!String(clip.prompt || "").trim()) return MT.toast("画面描述为空，先写好描述再重新生成");
    if (D.credits < MT.REGENERATE_COST) return MT.toast("积分不足，重新生成片段需要 " + MT.REGENERATE_COST + " 积分，当前 " + D.credits);
    var clipId = clip.id;
    D.credits -= MT.REGENERATE_COST;
    clip.generating = true;
    clip.genError = "";
    MT.renderCredits();
    MT.renderTracks();
    MT.renderInspector();
    MT.renderPlayhead();
    MT.toast("正在重新生成 " + clip.label + "，预扣 " + MT.REGENERATE_COST + " 积分");
    setTimeout(function () {
      var target = MT.clipById(clipId) || clip;
      target.generating = false;
      if (MT.mock["regen-fail"]) {
        D.credits += MT.REGENERATE_COST;
        target.genError = "生成服务繁忙，原片段已保留，" + MT.REGENERATE_COST + " 积分已退回";
        MT.toast(target.label + " 重新生成失败，积分已退回");
      } else {
        target.version += 1;
        MT.markDirty();
        MT.toast(target.label + " 已重新生成（第 " + target.version + " 版）");
      }
      MT.renderCredits();
      MT.renderTracks();
      MT.renderInspector();
      MT.renderPlayhead();
    }, 1400);
  };

  /* 用片段时间范围内的字幕当台词生成配音，放到音频 2 对应位置；同一片段已有配音则替换。 */
  MT.generateDub = function (clip) {
    if (!clip) return MT.toast("先在时间线上选中一个视频片段");
    if (busyReason(clip)) return MT.toast(busyReason(clip));
    var entry = MT.entryOf(clip);
    var lines = MT.doc.subtitles.filter(function (item) {
      return item.start < entry.end - 0.05 && item.start + item.duration > entry.start + 0.05 && String(item.text).trim() && item.text !== "请输入字幕";
    }).sort(function (a, b) { return a.start - b.start; });
    if (!lines.length) return MT.toast(clip.label + " 时间范围内没有台词字幕，先添加字幕再生成配音");
    var from = Math.max(entry.start, lines[0].start);
    var to = Math.min(entry.end, Math.max.apply(null, lines.map(function (item) { return item.start + item.duration; })));
    MT.saveHistory("生成配音");
    MT.doc.extraAudio = MT.doc.extraAudio.filter(function (item) { return !(item.clipId === clip.id && item.kind === "dub"); });
    var dub = { id: MT.nextId("dub"), kind: "dub", clipId: clip.id, offset: MT.round1(from - entry.start), duration: MT.round1(to - from), label: clip.label + " 配音", volume: 100, muted: false, generating: true, text: lines.map(function (item) { return item.text; }).join(" / ") };
    MT.doc.extraAudio.push(dub);
    MT.refreshTimeline();
    MT.toast("正在为 " + clip.label + " 生成配音（" + lines.length + " 句台词）");
    setTimeout(function () {
      var target = MT.doc.extraAudio.find(function (item) { return item.id === dub.id; });
      if (!target) return;
      if (MT.mock["dub-fail"]) {
        MT.doc.extraAudio = MT.doc.extraAudio.filter(function (item) { return item !== target; });
        MT.toast(clip.label + " 配音生成失败，可以重试");
      } else {
        target.generating = false;
        MT.markDirty();
        MT.toast(clip.label + " 配音已生成，放在「音频 2」");
      }
      MT.refreshTimeline();
    }, 1600);
  };

  MT.toggleClipMute = function (clip) {
    MT.saveHistory(clip.muted ? "取消片段静音" : "片段静音");
    clip.muted = !clip.muted;
    MT.renderTracks();
    MT.renderInspector();
    MT.renderMeter();
    MT.toast(clip.muted ? "已静音 " + clip.label : "已恢复 " + clip.label + " 的声音");
  };

  MT.toggleAudioMute = function (item) {
    MT.saveHistory(item.muted ? "取消音频静音" : "音频静音");
    item.muted = !item.muted;
    MT.renderTracks();
    MT.renderInspector();
    MT.renderMeter();
    MT.toast(item.muted ? "已静音这段音频" : "已恢复这段音频");
  };

  MT.toggleNarrationMute = function () {
    MT.saveHistory(MT.doc.audio.muted ? "取消旁白静音" : "旁白静音");
    MT.doc.audio.muted = !MT.doc.audio.muted;
    MT.renderTracks();
    MT.renderInspector();
    MT.renderMeter();
    MT.toast(MT.doc.audio.muted ? "已静音旁白音频" : "已恢复旁白音频");
  };

  MT.toggleSelectedExtraMute = function () {
    var item = MT.doc.extraAudio.find(function (row) { return row.id === state.selected; });
    if (item && !item.generating) MT.toggleAudioMute(item);
  };

  MT.clearSubtitles = function () {
    var count = MT.doc.subtitles.length;
    if (!count) return MT.toast("字幕轨上没有字幕");
    MT.confirm({
      title: "清空全部字幕？",
      body: "将删除字幕轨上的 " + count + " 条字幕。只影响时间线字幕，不会擦除画面里已有的文字；清空后可以撤销。",
      ok: "清空字幕",
      danger: true,
      onOk: function () {
        MT.saveHistory("清空字幕");
        MT.doc.subtitles = [];
        if (state.selectedKind === "subtitle") MT.clearSelection();
        MT.refreshTimeline();
        MT.toast("已清空 " + count + " 条字幕");
      }
    });
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
