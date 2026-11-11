/* 多轨编辑器 · 入口：点击 / 输入 / 拖动 / 面板缩放的事件绑定，最后渲染首屏。
   加载顺序：data.js → multitrack-state → multitrack-render → multitrack-actions → multitrack-menu → 本文件。 */
(function () {
  var MT = window.MT;
  var $ = MT.$;
  var $$ = MT.$$;
  var clamp = MT.clamp;
  var state = MT.state;

  var TOAST_ONLY = {
    ratio: "当前画幅：9:16",
    "episode-filter": "演示：筛选素材",
    "type-filter": "演示：筛选素材",
    settings: "演示：时间轴设置",
    fullscreen: "演示：全屏预览",
    "track-menu": "轨道右侧 ◉ 可隐藏，× 可删除。主视频轨和旁白轨不能删除"
  };

  function toggleLayout(flag, className, button, labels) {
    state[flag] = !state[flag];
    $(".mt-main").classList.toggle(className, state[flag]);
    if (button && labels) button.textContent = state[flag] ? labels[1] : labels[0];
    setTimeout(MT.renderRuler, 0);
  }

  function handleAction(action, button) {
    var picked = MT.selectedShot();
    if (TOAST_ONLY[action]) return MT.toast(TOAST_ONLY[action]);
    if (action === "play") return MT.togglePlayback();
    if (action === "save" || action === "retry-save") return MT.saveNow(true);
    if (action === "export") return MT.openExport(button);
    if (action === "export-video") return MT.exportVideo();
    if (action === "export-xml") return MT.exportXml();
    if (action === "generate-audio") return MT.generateDub(picked);
    if (action === "recognize-subtitles") return MT.recognizeSubtitles();
    if (action === "translate-subtitles") return MT.openTranslatePanel();
    if (action === "generate-bgm") return MT.openBgmPanel();
    if (action === "toggle-translate-source") return MT.toggleTranslateMenu("source");
    if (action === "toggle-translate-lang") return MT.toggleTranslateMenu("lang");
    if (action === "confirm-translate") return MT.confirmTranslateSubtitles();
    if (action === "close-translate") return MT.closeTranslatePanel();
    if (action === "remove-subtitles") return MT.clearSubtitles();
    if (action === "toggle-clip-mute" && picked) return MT.toggleClipMute(picked);
    if (action === "toggle-narration-mute") return MT.toggleNarrationMute();
    if (action === "toggle-extra-mute") return MT.toggleSelectedExtraMute();
    if (action === "toggle-bgm-mute") return MT.toggleBgmMute();
    if (action === "mute-all") return MT.toggleMute();
    if (action === "undo") return MT.undo();
    if (action === "redo") return MT.redo();
    if (action === "add-subtitle") return MT.addSubtitle();
    if (action === "split") return MT.splitAtPlayhead();
    if (action === "merge") return MT.mergeWithNext(picked || MT.entryAt(state.currentTime).clip);
    if (action === "add-transition") return MT.openTransition(picked || MT.entryAt(state.currentTime).clip);
    if (action === "delete-selection") return MT.deleteSelection();
    if (action === "duplicate") return MT.duplicate();
    if (action === "remove-transition" && state.selectedKind === "transition") return MT.deleteSelection();
    if (action === "preview-transition" && state.selectedKind === "transition") return MT.previewTransition(state.selected);
    if (action === "edit-prompt") {
      var prompt = $(".mt-prompt");
      if (prompt) prompt.focus();
      return;
    }
    if (action === "nudge-rotate" && picked) {
      picked.rotate = clamp(picked.rotate + 15, -180, 180);
      MT.renderInspector();
      MT.renderPlayhead();
      return;
    }
    if (action === "regenerate" && picked) return MT.regenerate(picked);
    if (action === "reset-visual" && picked) return MT.resetVisual(picked);
    if (action === "collapse-library") {
      toggleLayout("libraryCollapsed", "library-collapsed");
      button.textContent = state.libraryCollapsed ? "›" : "‹";
      button.title = state.libraryCollapsed ? "展开资产库" : "收起资产库";
      return;
    }
    if (action === "collapse-preview") {
      if (!state.previewCollapsed && state.timelineCollapsed) toggleLayout("timelineCollapsed", "timeline-collapsed", $('[data-act="collapse-timeline"]'), ["⌄", "⌃"]);
      return toggleLayout("previewCollapsed", "preview-collapsed", button, ["收起预览", "展开预览"]);
    }
    if (action === "collapse-timeline") {
      if (!state.timelineCollapsed && state.previewCollapsed) toggleLayout("previewCollapsed", "preview-collapsed", $('[data-act="collapse-preview"]'), ["收起预览", "展开预览"]);
      toggleLayout("timelineCollapsed", "timeline-collapsed", button, ["⌄", "⌃"]);
      button.setAttribute("aria-label", state.timelineCollapsed ? "展开时间线" : "收起时间线");
      return;
    }
    if (action === "close-inspector" || action === "collapse-inspector") MT.toggleInspector();
  }

  document.addEventListener("click", function (event) {
    if (state.suppressClick) {
      state.suppressClick = false;
      if (event.target.closest(".mt-clip")) return;
    }
    var target = event.target;

    var inspectorTab = target.closest("[data-inspector-tab]");
    if (inspectorTab) {
      state.inspectorTab = inspectorTab.dataset.inspectorTab;
      MT.renderInspector();
      return;
    }

    var libraryTab = target.closest("[data-library-tab]");
    if (libraryTab) {
      var tab = libraryTab.dataset.libraryTab;
      $$("[data-library-tab]").forEach(function (button) {
        var on = button.dataset.libraryTab === tab;
        button.classList.toggle("on", on);
        button.setAttribute("aria-selected", on ? "true" : "false");
      });
      $$("[data-library-pane]").forEach(function (pane) { pane.classList.toggle("on", pane.dataset.libraryPane === tab); });
      return;
    }

    var addAsset = target.closest("[data-add-asset]");
    if (addAsset) {
      event.stopPropagation();
      var asset = MT.library.find(function (item) { return item.id === addAsset.dataset.addAsset; });
      if (asset) MT.addAsset(asset);
      return;
    }

    var assetCard = target.closest("[data-asset]");
    if (assetCard) return MT.select("asset", assetCard.dataset.asset);

    var transitionMark = target.closest("[data-transition-at]");
    if (transitionMark) {
      var markClip = MT.clipById(transitionMark.dataset.transitionAt);
      return MT.select("transition", markClip.id, MT.entryOf(markClip).end);
    }

    var transitionType = target.closest("[data-transition-type]");
    if (transitionType && state.selectedKind === "transition") return MT.setTransition(state.selected, transitionType.dataset.transitionType);

    var shotButton = target.closest("[data-select-shot]");
    if (shotButton) {
      var entry = MT.entryOf(MT.clipById(shotButton.dataset.selectShot));
      var inside = state.currentTime >= entry.start && state.currentTime < entry.end;
      return MT.select("shot", entry.clip.id, inside ? state.currentTime : entry.start);
    }

    var subtitleButton = target.closest("[data-select-subtitle]");
    if (subtitleButton) {
      var subtitle = MT.subtitleById(subtitleButton.dataset.selectSubtitle);
      return MT.select("subtitle", subtitle.id, subtitle.start);
    }

    var bgmButton = target.closest("[data-select-bgm]");
    if (bgmButton) return MT.select("bgm", bgmButton.dataset.selectBgm, 0);

    var bgmVersion = target.closest("[data-bgm-version]");
    if (bgmVersion) return MT.switchBgmVersion(bgmVersion.dataset.bgmVersion);

    var deleteBgmVersion = target.closest("[data-delete-bgm-version]");
    if (deleteBgmVersion) return MT.deleteBgmVersion(deleteBgmVersion.dataset.deleteBgmVersion);

    if (target.closest("[data-select-audio]")) return MT.select("audio", "audio1");

    var extra = target.closest("[data-select-extra]");
    if (extra) return MT.select("extra", extra.dataset.selectExtra);

    var subStyle = target.closest("[data-sub-style]");
    if (subStyle) {
      state.subtitleStyle = subStyle.dataset.subStyle;
      $$(".mt-sub-preset").forEach(function (button) { button.classList.toggle("on", button === subStyle); });
      return MT.renderPlayhead();
    }

    var view = target.closest("[data-view]");
    if (view) {
      state.assetView = view.dataset.view;
      $$(".mt-view").forEach(function (button) { button.classList.toggle("on", button === view); });
      return MT.renderAssets();
    }

    var trackToggle = target.closest("[data-track-toggle]");
    if (trackToggle) {
      var track = trackToggle.dataset.trackToggle;
      state.disabledTracks[track] = !state.disabledTracks[track];
      trackToggle.classList.toggle("off", state.disabledTracks[track]);
      trackToggle.textContent = state.disabledTracks[track] ? "⊘" : "◉";
      MT.renderTracks();
      return MT.renderPlayhead();
    }

    var translateSource = target.closest("[data-translate-source]");
    if (translateSource) {
      event.stopPropagation();
      return MT.setTranslateSource(translateSource.dataset.translateSource);
    }
    var translateLang = target.closest("[data-translate-lang]");
    if (translateLang) {
      event.stopPropagation();
      return MT.setTranslateLang(translateLang.dataset.translateLang);
    }
    if (target.id === "translate-modal") return MT.closeTranslatePanel();

    var actionButton = target.closest("[data-act]");
    if (actionButton && !actionButton.disabled) handleAction(actionButton.dataset.act, actionButton);
  });

  var historyArmed = false;
  document.addEventListener("focusin", function (event) {
    if (event.target.dataset && event.target.dataset.setting) historyArmed = true;
  });

  document.addEventListener("input", function (event) {
    if (event.target.id === "asset-search") {
      state.query = event.target.value.trim();
      MT.renderAssets();
    }
    if (event.target.id === "zoom") {
      state.pixelsPerSecond = Number(event.target.value);
      MT.renderRuler();
      MT.renderTracks();
      MT.renderPlayhead();
    }
    var setting = event.target.dataset.setting;
    if (!setting) return;
    if (historyArmed && setting !== "prompt") {
      MT.saveHistory("调整参数");
      historyArmed = false;
    }
    MT.markDirty();
    var value = event.target.value;
    $$('[data-setting="' + setting + '"]').forEach(function (input) {
      if (input !== event.target) input.value = value;
    });

    var clip = MT.selectedShot();
    if (clip) {
      if (setting === "prompt") clip.prompt = value.slice(0, 800);
      if (setting === "scale-x") clip.scaleX = clamp(Number(value) || 1, 0.5, 2);
      if (setting === "scale-y") clip.scaleY = clamp(Number(value) || 1, 0.5, 2);
      if (setting === "rotate") clip.rotate = clamp(Number(value) || 0, -180, 180);
      if (setting === "opacity") clip.opacity = clamp(Math.round(Number(value)) || 0, 0, 100);
      if (setting === "clip-volume") clip.volume = clamp(Math.round(Number(value)) || 0, 0, 200);
      if (setting === "opacity" || setting === "clip-volume") MT.renderTracks();
      MT.renderPlayhead();
    }
    if (state.selectedKind === "extra" && setting === "extra-volume") {
      var audio = MT.doc.extraAudio.find(function (item) { return item.id === state.selected; });
      if (audio) audio.volume = clamp(Math.round(Number(value)) || 0, 0, 200);
      MT.renderTracks();
      MT.renderMeter();
    }
    if (state.selectedKind === "bgm" && setting === "bgm-volume" && MT.doc.bgm) {
      var bgm = MT.doc.bgm.versions.find(function (item) { return item.active; });
      if (bgm) bgm.volume = clamp(Math.round(Number(value)) || 0, 0, 200);
      MT.renderTracks();
      MT.renderMeter();
    }
    if (state.selectedKind === "audio") {
      if (setting === "audio-volume") MT.doc.audio.volume = clamp(Math.round(Number(value)) || 0, 0, 200);
      if (setting === "audio-fade") MT.doc.audio.fade = clamp(Number(value) || 0, 0, 5);
      MT.renderTracks();
      MT.renderMeter();
    }
    var subtitle = MT.selectedSubtitle();
    if (subtitle) {
      if (MT.isSubtitleLocked && MT.isSubtitleLocked(subtitle.id)) {
        event.target.value = setting === "subtitle-translation"
          ? (subtitle.bilingual ? (subtitle.translation || "") : (((subtitle.translations || []).find(function (item) { return item.language === subtitle.translateLang; }) || {}).text || ""))
          : (subtitle.sourceText || subtitle.text);
        return MT.toast("AI 任务处理中，完成后可继续编辑");
      }
      if (setting === "subtitle-text") {
        subtitle.text = value.slice(0, 200);
        subtitle.sourceText = subtitle.text;
        subtitle.textOriginal = subtitle.text;
        subtitle.editedByUser = true;
      }
      if (setting === "subtitle-source") {
        subtitle.sourceText = value.slice(0, 200);
        subtitle.editedByUser = true;
        MT.updateSubtitleDisplay(subtitle);
      }
      if (setting === "subtitle-translation") {
        if (subtitle.bilingual) {
          subtitle.translation = value.slice(0, 200);
          subtitle.editedByUser = true;
        } else {
          var translation = (subtitle.translations || []).find(function (item) { return item.language === subtitle.translateLang; });
          if (translation) {
            translation.text = value.slice(0, 200);
            translation.editedByUser = true;
            MT.updateSubtitleDisplay(subtitle);
          }
        }
      }
      if (setting === "subtitle-start") subtitle.start = clamp(Number(value) || 0, 0, MT.totalDuration() - 0.5);
      if (setting === "subtitle-duration") subtitle.duration = clamp(Number(value) || 0.5, 0.5, 20);
      MT.renderTracks();
      MT.renderPlayhead();
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target.dataset && event.target.dataset.setting) historyArmed = true;
  });

  function timeFromPointer(clientX) {
    var rect = $("#timeline-canvas").getBoundingClientRect();
    return clamp((clientX - rect.left) / state.pixelsPerSecond, 0, MT.totalDuration());
  }

  function followPointer(handler, onUp) {
    var pending = null;
    var frame = 0;
    function flush() {
      frame = 0;
      if (!pending) return;
      var e = pending;
      pending = null;
      handler(e);
    }
    function onMove(e) {
      pending = e;
      if (!frame) frame = requestAnimationFrame(flush);
    }
    function up(e) {
      cancelAnimationFrame(frame);
      flush();
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (onUp) onUp(e);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", up);
  }

  /* 拖动片段：磁吸开时中间拖 = 调换顺序、两端拖 = 裁剪并带动后面片段；磁吸关时中间拖 = 自由移动、两端拖 = 裁剪并留出空隙，后面片段不动（被顶到才往后推）。
     字幕中间拖 = 改开始时间，两端拖 = 改时长。移动不足 4px 当作点击。 */
  function beginClipDrag(event, button) {
    var px = state.pixelsPerSecond;
    var startX = event.clientX;
    var trim = event.target.closest("[data-trim]");
    var clip = button.dataset.selectShot ? MT.clipById(button.dataset.selectShot) : null;
    var subtitle = button.dataset.selectSubtitle ? MT.subtitleById(button.dataset.selectSubtitle) : null;
    if (!clip && !subtitle) return;
    if ((clip && MT.isClipLocked && MT.isClipLocked(clip.id)) || (subtitle && MT.isSubtitleLocked && MT.isSubtitleLocked(subtitle.id))) {
      MT.toast("AI 任务处理中，完成后可继续编辑");
      return;
    }
    var before = MT.snapshot();
    var origin = clip ? { srcIn: clip.srcIn, duration: clip.duration, start: MT.entryOf(clip).start, gap: clip.gap || 0 } : { start: subtitle.start, duration: subtitle.duration };
    var free = !!clip && state.magnet === false;
    var next = clip ? MT.doc.clips[MT.doc.clips.indexOf(clip) + 1] : null;
    if (next) {
      origin.nextGap = next.gap || 0;
      origin.nextStart = MT.entryOf(next).start;
    }
    var riders = free && !trim ? MT.subtitlesIn(origin.start, origin.start + origin.duration) : [];
    var originLeft = parseFloat(button.style.left) || 0;
    var moved = false;
    MT.stopPlayback();

    /* 片段尾部后移时先吃掉后一段前面的空隙，不够再把后面整体往后推；尾部前移则在后面留出空隙 */
    function shiftFree(gap, duration) {
      clip.gap = MT.round1(Math.max(0, gap));
      clip.duration = MT.round1(duration);
      if (next) next.gap = MT.round1(Math.max(0, origin.nextGap - (clip.gap + clip.duration - origin.gap - origin.duration)));
      MT.renderRuler();
      MT.renderTracks();
      markDragging();
    }

    function markDragging() {
      var current = $('[data-select-shot="' + clip.id + '"]');
      if (current) current.classList.add("is-dragging");
    }

    followPointer(function (e) {
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) {
        moved = true;
        button.classList.add("is-dragging");
        document.body.style.userSelect = "none";
      }
      if (subtitle || trim || free) MT.showSnapMarks(true, subtitle ? subtitle.id : clip.id, clip ? { ripple: true } : null);
      var ds = dx / px;
      var origEnd = origin.start + origin.duration;
      var lead = clip ? origin.start - origin.gap : 0;
      if (free && !trim) {
        var placed = MT.snapRange(lead + Math.max(0, origin.gap + ds), origin.duration, clip.id, { ripple: true });
        shiftFree(placed - lead, origin.duration);
      } else if (free && trim.dataset.trim === "right") {
        var freeEnd = MT.snapTime(origin.start + clamp(origin.duration + ds, MT.MIN_CLIP, clip.sourceDuration - clip.srcIn), clip.id, { ripple: true });
        shiftFree(origin.gap, clamp(freeEnd - origin.start, MT.MIN_CLIP, clip.sourceDuration - clip.srcIn));
      } else if (free) {
        var minShift = -Math.min(origin.srcIn, origin.gap);
        var freeStart = MT.snapTime(origin.start + clamp(ds, minShift, origin.duration - MT.MIN_CLIP), clip.id, { ripple: true });
        var cut = clamp(freeStart - origin.start, minShift, origin.duration - MT.MIN_CLIP);
        clip.srcIn = MT.round1(origin.srcIn + cut);
        shiftFree(origin.gap + cut, origin.duration - cut);
      } else if (subtitle && trim && trim.dataset.trim === "right") {
        var maxDur = Math.min(20, MT.totalDuration() - origin.start);
        var end = MT.snapTime(origin.start + clamp(origin.duration + ds, MT.MIN_CLIP, maxDur), subtitle.id);
        subtitle.duration = MT.round1(clamp(end - origin.start, MT.MIN_CLIP, maxDur));
        button.style.width = Math.max(24, subtitle.duration * px) + "px";
        MT.renderPlayhead();
      } else if (subtitle && trim) {
        var minStart = Math.max(0, origEnd - 20);
        var start = MT.snapTime(clamp(origin.start + ds, minStart, origEnd - MT.MIN_CLIP), subtitle.id);
        start = clamp(start, minStart, origEnd - MT.MIN_CLIP);
        subtitle.start = MT.round1(start);
        subtitle.duration = MT.round1(origEnd - subtitle.start);
        button.style.left = subtitle.start * px + "px";
        button.style.width = Math.max(24, subtitle.duration * px) + "px";
        MT.renderPlayhead();
      } else if (subtitle) {
        var maxStart = Math.max(0, MT.totalDuration() - subtitle.duration);
        var movedStart = MT.snapRange(clamp(origin.start + ds, 0, maxStart), subtitle.duration, subtitle.id);
        subtitle.start = MT.round1(clamp(movedStart, 0, maxStart));
        button.style.left = subtitle.start * px + "px";
        MT.renderPlayhead();
      } else if (trim && trim.dataset.trim === "right") {
        var maxClip = clip.sourceDuration - clip.srcIn;
        var rightEnd = MT.snapTime(origin.start + clamp(origin.duration + ds, MT.MIN_CLIP, maxClip), clip.id, { ripple: true });
        clip.duration = MT.round1(clamp(rightEnd - origin.start, MT.MIN_CLIP, maxClip));
        MT.renderRuler();
        MT.renderTracks();
        markDragging();
      } else if (trim) {
        var shift = clamp(ds, -origin.srcIn, origin.duration - MT.MIN_CLIP);
        var trimmedEnd = MT.snapTime(origEnd - shift, clip.id, { ripple: true });
        shift = clamp(origEnd - trimmedEnd, -origin.srcIn, origin.duration - MT.MIN_CLIP);
        clip.srcIn = MT.round1(origin.srcIn + shift);
        clip.duration = MT.round1(origin.duration - shift);
        MT.renderRuler();
        MT.renderTracks();
        markDragging();
      } else {
        button.style.transform = "translateX(" + dx + "px)";
        var center = originLeft + dx + button.offsetWidth / 2;
        $$(".mt-video-clip").forEach(function (other) {
          if (other === button) return;
          var left = parseFloat(other.style.left);
          var hit = center > left && center < left + other.offsetWidth;
          other.classList.toggle("is-drop-before", hit && center < left + other.offsetWidth / 2);
          other.classList.toggle("is-drop-after", hit && center >= left + other.offsetWidth / 2);
        });
      }
      if (subtitle || trim || free) MT.showSnapGuide(0, true);
    }, function (e) {
      MT.showSnapGuide(0, false);
      MT.showSnapMarks(false);
      if (!moved) return;
      state.suppressClick = true;
      setTimeout(function () { state.suppressClick = false; }, 0);
      if (free) {
        var push = next ? MT.entryOf(next).start - origin.nextStart : 0;
        if (push > 0.01) MT.doc.subtitles.forEach(function (item) { if (item.start >= origin.nextStart - 0.01) item.start = MT.round1(item.start + push); });
        var startDelta = MT.entryOf(clip).start - origin.start;
        riders.forEach(function (item) { item.start = MT.round1(item.start + startDelta); });
      } else if (clip && !trim) {
        var center = originLeft + (e.clientX - startX) + button.offsetWidth / 2;
        var others = MT.clipEntries().filter(function (entry) { return entry.clip !== clip; });
        var index = others.filter(function (entry) { return (entry.start + entry.end) / 2 * px < center; }).length;
        var from = MT.doc.clips.indexOf(clip);
        if (from === index) {
          button.style.transform = "";
          button.classList.remove("is-dragging");
          return MT.renderTracks();
        }
        var carried = MT.subtitlesIn(origin.start, origin.start + clip.duration);
        MT.doc.subtitles = MT.doc.subtitles.filter(function (item) { return carried.indexOf(item) < 0; });
        MT.retimeSubtitles(origin.start, -clip.duration);
        MT.doc.clips.splice(from, 1);
        MT.doc.clips.splice(index, 0, clip);
        var newStart = MT.entryOf(clip).start;
        MT.retimeSubtitles(newStart, clip.duration);
        carried.forEach(function (item) {
          item.start = MT.round1(newStart + (item.start - origin.start));
          MT.doc.subtitles.push(item);
        });
        MT.dropDanglingTransition();
      }
      if (clip && trim && !free) {
        if (trim.dataset.trim === "right") {
          MT.retimeSubtitles(origin.start + Math.min(origin.duration, clip.duration), clip.duration - origin.duration);
        } else {
          MT.retimeSubtitles(origin.start, -(clip.srcIn - origin.srcIn));
        }
      }
      if (before !== MT.snapshot()) MT.saveHistory(subtitle ? (trim ? "调整字幕时长" : "移动字幕") : trim ? "裁剪片段" : "移动片段", before);
      state.selectedKind = subtitle ? "subtitle" : "shot";
      state.selected = subtitle ? subtitle.id : clip.id;
      if (clip) state.currentTime = MT.entryOf(clip).start;
      MT.refreshTimeline();
      if (free && !trim) MT.toast(clip.label + " 已移到 " + MT.secText(state.currentTime) + (clip.gap > 0.05 ? "，前面空 " + MT.secText(clip.gap) : ""));
      else if (clip && !trim) MT.toast("已移到第 " + (MT.doc.clips.indexOf(clip) + 1) + " 段");
      if (clip && trim) MT.toast(clip.label + " 时长 " + MT.secText(clip.duration) + (free ? "，后面片段位置不变" : ""));
      if (subtitle && trim) MT.toast("字幕时长 " + MT.secText(subtitle.duration));
    });
  }

  function selectionItem(button) {
    if (!button) return null;
    if (button.dataset.selectShot) return { kind: "shot", id: button.dataset.selectShot };
    if (button.dataset.selectSubtitle) return { kind: "subtitle", id: button.dataset.selectSubtitle };
    if (button.dataset.selectExtra) return { kind: "extra", id: button.dataset.selectExtra };
    return null;
  }

  function toggleMulti(item) {
    var list = (state.multi || []).slice();
    if (!list.length && (state.selectedKind === "shot" || state.selectedKind === "subtitle" || state.selectedKind === "extra")) {
      list = [{ kind: state.selectedKind, id: state.selected }];
    }
    var index = list.findIndex(function (row) { return row.kind === item.kind && row.id === item.id; });
    if (index >= 0) list.splice(index, 1);
    else list.push(item);
    MT.setMulti(list);
    MT.renderSelection();
    MT.renderPlayhead();
  }

  function paintMulti() {
    var chosen = {};
    (state.multi || []).forEach(function (item) { chosen[item.kind + ":" + item.id] = true; });
    $$("#timeline-canvas .mt-clip").forEach(function (clip) {
      var item = selectionItem(clip);
      if (!item) return;
      clip.classList.toggle("on", !!chosen[item.kind + ":" + item.id]);
    });
  }

  var renderTracksForSelection = MT.renderTracks;
  MT.renderTracks = function () {
    renderTracksForSelection();
    paintMulti();
  };

  function hitsInBox(x1, y1, x2, y2) {
    var canvas = $("#timeline-canvas").getBoundingClientRect();
    var left = Math.min(x1, x2);
    var right = Math.max(x1, x2);
    var top = Math.min(y1, y2);
    var bottom = Math.max(y1, y2);
    var hits = [];
    $$("#timeline-canvas [data-select-shot], #timeline-canvas [data-select-subtitle], #timeline-canvas [data-select-extra]").forEach(function (clip) {
      var rect = clip.getBoundingClientRect();
      var clipLeft = rect.left - canvas.left;
      var clipTop = rect.top - canvas.top;
      var clipRight = rect.right - canvas.left;
      var clipBottom = rect.bottom - canvas.top;
      if (clipRight < left || clipLeft > right || clipBottom < top || clipTop > bottom) return;
      var item = selectionItem(clip);
      if (item) hits.push(item);
    });
    return hits;
  }

  /* 框选后拖动其中任一字幕：框中的字幕按同一时间差整体平移，视频片段不跟着动。 */
  function beginGroupDrag(event) {
    var subs = state.multi.filter(function (item) { return item.kind === "subtitle"; })
      .map(function (item) { return MT.subtitleById(item.id); }).filter(Boolean);
    if (!subs.length) return;
    if (subs.some(function (subtitle) { return MT.isSubtitleLocked && MT.isSubtitleLocked(subtitle.id); })) {
      return MT.toast("AI 任务处理中，完成后可继续编辑");
    }
    var px = state.pixelsPerSecond;
    var total = MT.totalDuration();
    var before = MT.snapshot();
    var origins = subs.map(function (subtitle) { return subtitle.start; });
    var minDelta = -Math.min.apply(null, origins);
    var maxDelta = Math.min.apply(null, subs.map(function (subtitle, i) { return total - subtitle.duration - origins[i]; }));
    var startX = event.clientX;
    var moved = false;
    MT.stopPlayback();
    followPointer(function (e) {
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 4) return;
      moved = true;
      document.body.style.userSelect = "none";
      var delta = clamp(dx / px, minDelta, Math.max(minDelta, maxDelta));
      subs.forEach(function (subtitle, i) {
        subtitle.start = MT.round1(origins[i] + delta);
        var button = $('#timeline-canvas [data-select-subtitle="' + subtitle.id + '"]');
        if (button) {
          button.style.left = subtitle.start * px + "px";
          button.classList.add("is-dragging");
        }
      });
      MT.renderPlayhead();
    }, function () {
      if (!moved) return;
      state.suppressClick = true;
      setTimeout(function () { state.suppressClick = false; }, 0);
      if (before !== MT.snapshot()) MT.saveHistory("移动框选字幕", before);
      MT.renderTracks();
      MT.renderPlayhead();
      MT.toast("已整体移动 " + subs.length + " 条字幕");
    });
  }

  function selectionSummary(items) {
    var shots = items.filter(function (item) { return item.kind === "shot"; }).length;
    var subtitles = items.filter(function (item) { return item.kind === "subtitle"; }).length;
    var extras = items.filter(function (item) { return item.kind === "extra"; }).length;
    var parts = [];
    if (shots) parts.push(shots + " 个片段");
    if (subtitles) parts.push(subtitles + " 条字幕");
    if (extras) parts.push(extras + " 段音频");
    return parts.join("、");
  }

  $("#timeline-canvas").addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    if (event.target.closest("#playhead") || event.target.closest(".mt-transition-mark") || event.target.closest(".mt-trim")) return;
    var clipButton = event.target.closest(".mt-video-clip, .mt-subtitle-clip, [data-select-extra]");
    if (clipButton && event.shiftKey) {
      var toggled = selectionItem(clipButton);
      if (!toggled) return;
      event.preventDefault();
      state.suppressClick = true;
      toggleMulti(toggled);
      return;
    }
    var groupItem = clipButton && clipButton.dataset.selectSubtitle && (state.multi || []).length > 1 &&
      state.multi.some(function (item) { return item.kind === "subtitle" && item.id === clipButton.dataset.selectSubtitle; });
    if (groupItem && !event.target.closest("[data-trim]")) return beginGroupDrag(event);
    if (clipButton && clipButton.matches(".mt-video-clip, .mt-subtitle-clip")) return beginClipDrag(event, clipButton);
    if (event.target.closest(".mt-clip")) return;

    var canvas = $("#timeline-canvas");
    var startX = event.clientX;
    var startY = event.clientY;
    var marquee = $("#marquee");
    var dragged = false;
    var additive = event.shiftKey || event.metaKey;
    var base = additive ? (state.multi || []).slice() : [];
    function point(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    }
    MT.stopPlayback();
    followPointer(function (e) {
      var from = point(startX, startY);
      var to = point(e.clientX, e.clientY);
      if (!dragged && Math.abs(to.x - from.x) < 4 && Math.abs(to.y - from.y) < 4) return;
      dragged = true;
      document.body.style.userSelect = "none";
      marquee.hidden = false;
      marquee.style.left = Math.min(from.x, to.x) + "px";
      marquee.style.top = Math.min(from.y, to.y) + "px";
      marquee.style.width = Math.abs(to.x - from.x) + "px";
      marquee.style.height = Math.abs(to.y - from.y) + "px";
    }, function (e) {
      marquee.hidden = true;
      if (!dragged) {
        state.currentTime = MT.snapTime(timeFromPointer(e.clientX), null, { skipPlayhead: true });
        MT.renderPlayhead();
        return;
      }
      state.suppressClick = true;
      setTimeout(function () { state.suppressClick = false; }, 0);
      var from = point(startX, startY);
      var to = point(e.clientX, e.clientY);
      var hits = hitsInBox(from.x, from.y, to.x, to.y);
      MT.setMulti(base.concat(hits));
      MT.renderSelection();
      MT.renderPlayhead();
      MT.toast(state.multi.length ? "已框选 " + selectionSummary(state.multi) : "框选范围内没有片段或字幕");
    });
  });

  $("#playhead").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    MT.stopPlayback();
    MT.showSnapMarks(true, null, { skipPlayhead: true });
    followPointer(function (e) {
      state.currentTime = MT.snapTime(timeFromPointer(e.clientX), null, { skipPlayhead: true });
      MT.renderPlayhead();
      MT.showSnapGuide(0, true);
    }, function () {
      MT.showSnapGuide(0, false);
      MT.showSnapMarks(false);
    });
  });

  $$("[data-resize]").forEach(function (handle) {
    handle.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      var type = handle.dataset.resize;
      var main = $(".mt-main");
      handle.classList.add("is-dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = type === "timeline" ? "row-resize" : "col-resize";
      followPointer(function (e) {
        var rect = main.getBoundingClientRect();
        if (type === "library") {
          state.libraryWidth = clamp(e.clientX - rect.left, 170, Math.min(420, rect.width - state.inspectorWidth - 360));
          main.style.setProperty("--library-width", state.libraryWidth + "px");
        }
        if (type === "inspector") {
          state.inspectorWidth = clamp(rect.right - e.clientX, 180, Math.min(380, rect.width - state.libraryWidth - 360));
          main.style.setProperty("--inspector-width", state.inspectorWidth + "px");
        }
        if (type === "timeline") {
          state.timelineHeight = clamp(rect.bottom - e.clientY, 220, rect.height - 180);
          main.style.setProperty("--timeline-height", state.timelineHeight + "px");
        }
        MT.renderRuler();
      }, function () {
        handle.classList.remove("is-dragging");
      });
    });
  });

  /* 素材拖入时间线：按落点插到最近片段的前或后。 */
  var draggingAsset = null;
  document.addEventListener("dragstart", function (event) {
    var card = event.target.closest && event.target.closest("[data-asset]");
    if (!card) return;
    draggingAsset = card.dataset.asset;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", draggingAsset);
  });
  document.addEventListener("dragend", function () {
    draggingAsset = null;
    clearDropMarks();
  });

  function clearDropMarks() {
    $$(".mt-video-clip").forEach(function (clip) { clip.classList.remove("is-drop-before", "is-drop-after"); });
    $("#timeline-scroll").classList.remove("is-asset-over");
  }

  function dropIndexAt(clientX) {
    var time = (clientX - $("#timeline-canvas").getBoundingClientRect().left) / state.pixelsPerSecond;
    var entries = MT.clipEntries();
    for (var i = 0; i < entries.length; i += 1) {
      if (time < entries[i].end) return time < (entries[i].start + entries[i].end) / 2 ? i : i + 1;
    }
    return entries.length;
  }

  $("#timeline-scroll").addEventListener("dragover", function (event) {
    if (!draggingAsset) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    var index = dropIndexAt(event.clientX);
    var clips = $$(".mt-video-clip");
    clips.forEach(function (clip, i) {
      clip.classList.toggle("is-drop-before", i === index);
      clip.classList.toggle("is-drop-after", index === clips.length && i === clips.length - 1);
    });
    $("#timeline-scroll").classList.add("is-asset-over");
  });
  $("#timeline-scroll").addEventListener("dragleave", function (event) {
    if (!event.currentTarget.contains(event.relatedTarget)) clearDropMarks();
  });
  $("#timeline-scroll").addEventListener("drop", function (event) {
    if (!draggingAsset) return;
    event.preventDefault();
    var asset = MT.library.find(function (item) { return item.id === draggingAsset; });
    var index = dropIndexAt(event.clientX);
    clearDropMarks();
    draggingAsset = null;
    if (asset) MT.addAsset(asset, index);
  });

  var resizeFrame = 0;
  window.addEventListener("resize", function () {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = 0;
      MT.renderRuler();
    });
  });

  MT.renderAll();
  MT.renderSaveStatus();
})();
