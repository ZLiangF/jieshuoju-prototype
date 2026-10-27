/* 多轨编辑器 · 入口：点击 / 输入 / 拖动 / 面板缩放的事件绑定，最后渲染首屏。
   加载顺序：data.js → multitrack-state → multitrack-render → multitrack-actions → multitrack-menu → 本文件。 */
(function () {
  var MT = window.MT;
  var $ = MT.$;
  var $$ = MT.$$;
  var clamp = MT.clamp;
  var state = MT.state;

  var TOAST_ONLY = {
    save: "已保存",
    export: "演示：打开导出设置",
    ratio: "当前画幅：9:16",
    "new-asset": "演示：上传素材或创建文件夹",
    "episode-filter": "演示：筛选素材",
    "type-filter": "演示：筛选素材",
    settings: "演示：时间轴设置",
    fullscreen: "演示：全屏预览",
    "generate-audio": "演示：根据字幕生成音频",
    "recognize-subtitles": "演示：智能识别整集字幕",
    "translate-subtitles": "演示：字幕翻译",
    "remove-subtitles": "演示：去除视频原字幕",
    "track-menu": "右键轨道上的片段可以打开编辑菜单"
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
    if (state.selectedKind === "audio") {
      if (setting === "audio-volume") MT.doc.audio.volume = clamp(Math.round(Number(value)) || 0, 0, 200);
      if (setting === "audio-fade") MT.doc.audio.fade = clamp(Number(value) || 0, 0, 5);
      MT.renderTracks();
      MT.renderMeter();
    }
    var subtitle = MT.selectedSubtitle();
    if (subtitle) {
      if (setting === "subtitle-text") subtitle.text = value.slice(0, 80);
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

  function followPointer(onMove, onUp) {
    function up(e) {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (onUp) onUp(e);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", up);
  }

  /* 拖动片段：中间拖 = 调换顺序；两端拖 = 裁剪；字幕拖 = 改开始时间。移动不足 4px 当作点击。 */
  function beginClipDrag(event, button) {
    var px = state.pixelsPerSecond;
    var startX = event.clientX;
    var trim = event.target.closest("[data-trim]");
    var clip = button.dataset.selectShot ? MT.clipById(button.dataset.selectShot) : null;
    var subtitle = button.dataset.selectSubtitle ? MT.subtitleById(button.dataset.selectSubtitle) : null;
    if (!clip && !subtitle) return;
    var before = MT.snapshot();
    var origin = clip ? { srcIn: clip.srcIn, duration: clip.duration } : { start: subtitle.start };
    var originLeft = parseFloat(button.style.left) || 0;
    var moved = false;
    MT.stopPlayback();

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
      var ds = dx / px;
      if (subtitle) {
        subtitle.start = MT.round1(clamp(origin.start + ds, 0, Math.max(0, MT.totalDuration() - subtitle.duration)));
        button.style.left = subtitle.start * px + "px";
        MT.renderPlayhead();
      } else if (trim && trim.dataset.trim === "right") {
        clip.duration = MT.round1(clamp(origin.duration + ds, MT.MIN_CLIP, clip.sourceDuration - clip.srcIn));
        MT.renderRuler();
        MT.renderTracks();
        markDragging();
      } else if (trim) {
        var shift = clamp(ds, -origin.srcIn, origin.duration - MT.MIN_CLIP);
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
    }, function (e) {
      if (!moved) return;
      state.suppressClick = true;
      setTimeout(function () { state.suppressClick = false; }, 0);
      if (clip && !trim) {
        var center = originLeft + (e.clientX - startX) + button.offsetWidth / 2;
        var others = MT.clipEntries().filter(function (entry) { return entry.clip !== clip; });
        var index = others.filter(function (entry) { return (entry.start + entry.end) / 2 * px < center; }).length;
        var from = MT.doc.clips.indexOf(clip);
        MT.doc.clips.splice(from, 1);
        MT.doc.clips.splice(index, 0, clip);
        MT.dropDanglingTransition();
        if (from === index) return MT.renderTracks();
      }
      if (before !== MT.snapshot()) MT.saveHistory(subtitle ? "移动字幕" : trim ? "裁剪片段" : "移动片段", before);
      state.selectedKind = subtitle ? "subtitle" : "shot";
      state.selected = subtitle ? subtitle.id : clip.id;
      if (clip) state.currentTime = MT.entryOf(clip).start;
      MT.refreshTimeline();
      if (clip && !trim) MT.toast("已移到第 " + (MT.doc.clips.indexOf(clip) + 1) + " 段");
      if (trim) MT.toast(clip.label + " 时长 " + MT.secText(clip.duration));
    });
  }

  $("#timeline-canvas").addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    if (event.target.closest("#playhead") || event.target.closest(".mt-transition-mark")) return;
    var clipButton = event.target.closest(".mt-video-clip, .mt-subtitle-clip");
    if (clipButton) return beginClipDrag(event, clipButton);
    if (event.target.closest(".mt-clip")) return;
    MT.stopPlayback();
    state.currentTime = timeFromPointer(event.clientX);
    MT.renderPlayhead();
  });

  $("#playhead").addEventListener("pointerdown", function (event) {
    event.preventDefault();
    MT.stopPlayback();
    followPointer(function (e) {
      state.currentTime = timeFromPointer(e.clientX);
      MT.renderPlayhead();
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

  window.addEventListener("resize", MT.renderRuler);

  MT.renderAll();
})();
