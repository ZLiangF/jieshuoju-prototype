/* 多轨编辑器 · 三期：ASR 新字幕轨、结构化双语字幕、整集 AI BGM、0 积分任务确认与生成锁。 */
(function () {
  var MT = window.MT;
  var state = MT.state;
  var esc = MT.escapeHtml;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowLabel() {
    var date = new Date();
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }
  function trackName(type, index) {
    return (type === "subtitle" ? "字幕 " : type === "video" ? "视频 " : "音频 ") + (index + 1);
  }

  /* 轨道纳入文档快照，保证 AI 新建轨道和 BGM 版本可保存、撤销。 */
  MT.doc.tracks = MT.doc.tracks || clone(state.tracks);
  state.tracks = MT.doc.tracks;
  MT.doc.aiTasks = MT.doc.aiTasks || [];
  MT.doc.bgm = MT.doc.bgm || null;
  state.activeSubtitleTrackId = state.activeSubtitleTrackId || state.tracks.subtitle[0].id;
  MT.doc.subtitles.forEach(function (subtitle) {
    subtitle.trackId = subtitle.trackId || state.tracks.subtitle[0].id;
    subtitle.sourceText = subtitle.sourceText || subtitle.textOriginal || String(subtitle.text || "").split("\n")[0];
    subtitle.sourceLanguage = subtitle.sourceLanguage || (/[\u3400-\u9fff]/.test(subtitle.sourceText) ? "zh-CN" : "en");
    subtitle.translations = subtitle.translations || [];
    subtitle.displayMode = subtitle.bilingual ? "bilingual" : (subtitle.displayMode || "single");
  });

  function rebindTracks() {
    MT.doc.tracks = MT.doc.tracks || clone(state.tracks);
    state.tracks = MT.doc.tracks;
    MT.doc.aiTasks = MT.doc.aiTasks || [];
    MT.doc.bgm = MT.doc.bgm || null;
    state.activeSubtitleTrackId = state.activeSubtitleTrackId || (state.tracks.subtitle[0] || {}).id;
    MT.doc.subtitles.forEach(function (subtitle) {
      subtitle.trackId = subtitle.trackId || (state.tracks.subtitle[0] || {}).id;
      subtitle.sourceText = subtitle.sourceText || subtitle.textOriginal || String(subtitle.text || "").split("\n")[0];
      subtitle.sourceLanguage = subtitle.sourceLanguage || (/[\u3400-\u9fff]/.test(subtitle.sourceText) ? "zh-CN" : "en");
      subtitle.translations = subtitle.translations || [];
      subtitle.displayMode = subtitle.bilingual ? "bilingual" : (subtitle.displayMode || "single");
    });
  }

  var baseRestore = MT.restore;
  MT.restore = function (text) {
    baseRestore(text);
    rebindTracks();
  };

  MT.BGM_VERSION_LIMIT = 5;

  function activeTasks() {
    return (MT.doc.aiTasks || []).filter(function (task) { return task.status === "generating"; });
  }
  function activeTask(type) {
    return activeTasks().find(function (task) { return task.type === type; });
  }
  MT.hasActiveAiTask = function () { return activeTasks().length > 0; };
  MT.isClipLocked = function (clipId) {
    return !!clipId && activeTasks().some(function (task) {
      return task.type === "bgm" || task.type === "asr";
    });
  };
  MT.isSubtitleLocked = function (subtitleId) {
    return activeTasks().some(function (task) {
      return task.type === "translate" && task.subtitleIds.indexOf(subtitleId) > -1;
    });
  };
  MT.videoTaskBusy = function () {
    return activeTasks().some(function (task) { return task.type === "asr" || task.type === "bgm"; });
  };
  function lockedToast() { MT.toast("AI 任务处理中，完成后可继续编辑"); }

  var baseBusyReason = MT.busyReason;
  MT.busyReason = function (clip) {
    if (clip && MT.isClipLocked(clip.id)) return "AI 任务处理中，完成后可继续编辑";
    return baseBusyReason(clip);
  };

  function createTask(type, data) {
    var task = {
      id: MT.nextId("task"),
      type: type,
      status: "generating",
      startedAt: Date.now(),
      dueAt: Date.now() + (type === "bgm" ? 1800 : type === "asr" ? 1300 : 1000),
      estimatedCredits: 0,
      reservedCredits: 0
    };
    Object.keys(data || {}).forEach(function (key) { task[key] = data[key]; });
    MT.doc.aiTasks.push(task);
    return task;
  }
  function removeTask(task) {
    MT.doc.aiTasks = MT.doc.aiTasks.filter(function (item) { return item.id !== task.id; });
  }
  function addTrack(type, name, id) {
    var list = state.tracks[type];
    var track = { id: id || MT.nextId(type.slice(0, 3)), name: name || trackName(type, list.length), enabled: true };
    list.push(track);
    return track;
  }
  function removeTrackData(type, id) {
    state.tracks[type] = state.tracks[type].filter(function (track) { return track.id !== id; });
    MT.doc.tracks = state.tracks;
    if (type === "subtitle") MT.doc.subtitles = MT.doc.subtitles.filter(function (subtitle) { return subtitle.trackId !== id; });
    if (type === "audio" && MT.doc.bgm && MT.doc.bgm.trackId === id) MT.doc.bgm = null;
  }

  MT.subtitleDisplayText = function (subtitle) {
    var source = subtitle.sourceText || String(subtitle.text || "").split("\n")[0];
    if (subtitle.displayMode !== "bilingual" || !subtitle.translateLang) return source;
    var row = (subtitle.translations || []).find(function (item) { return item.language === subtitle.translateLang; });
    return row ? source + "\n" + row.text : source;
  };
  MT.updateSubtitleDisplay = function (subtitle) {
    subtitle.text = MT.subtitleDisplayText(subtitle);
    subtitle.bilingual = subtitle.displayMode === "bilingual" && !!subtitle.translateLang;
    subtitle.textOriginal = subtitle.sourceText;
  };
  MT.doc.subtitles.forEach(MT.updateSubtitleDisplay);

  /* 播放器优先展示已启用字幕轨上的字幕。 */
  MT.activeSubtitleAt = function (time) {
    var enabledIds = {};
    (state.tracks.subtitle || []).forEach(function (track) {
      if (track.enabled !== false) enabledIds[track.id] = true;
    });
    return MT.doc.subtitles.find(function (subtitle) {
      var trackId = subtitle.trackId || (state.tracks.subtitle[0] || {}).id;
      return !!enabledIds[trackId] && time >= subtitle.start && time <= subtitle.start + subtitle.duration;
    });
  };

  /* 实际渲染按 trackId 分发字幕，并在独立音轨展示当前 BGM 版本。 */
  var baseRenderTracks = MT.renderTracks;
  MT.renderTracks = function () {
    rebindTracks();
    state.disabledTracks.subtitle = !(state.tracks.subtitle || []).some(function (track) { return track.enabled !== false; });
    baseRenderTracks();
    var px = state.pixelsPerSecond;
    state.tracks.subtitle.forEach(function (track) {
      var lane = MT.$("#lane-" + track.id);
      if (!lane) return;
      lane.classList.toggle("is-disabled", track.enabled === false);
      lane.innerHTML = MT.doc.subtitles.filter(function (subtitle) {
        return subtitle.trackId === track.id;
      }).map(function (subtitle) {
        var text = MT.subtitleDisplayText(subtitle);
        var tag = subtitle.bilingual ? "双语" : (subtitle.fromAsr ? "ASR" : "");
        var locked = MT.isSubtitleLocked(subtitle.id);
        return '<button type="button" class="mt-clip mt-subtitle-clip' +
          (state.selected === subtitle.id ? " on" : "") +
          (subtitle.fromAsr || subtitle.bilingual ? " is-asr" : "") +
          (locked ? " is-ai-locked" : "") +
          '" data-select-subtitle="' + subtitle.id + '" style="left:' + (subtitle.start * px) + "px;width:" + Math.max(24, subtitle.duration * px) +
          'px" title="' + esc(text) + '"><span>' + esc(text) + "</span>" +
          (tag ? '<small class="mt-clip-tag">' + tag + "</small>" : "") +
          '<i class="mt-trim left" data-trim="left"></i><i class="mt-trim right" data-trim="right"></i></button>';
      }).join("");
    });
    if (MT.doc.bgm) {
      var lane = MT.$("#lane-" + MT.doc.bgm.trackId);
      var version = MT.doc.bgm.versions.find(function (item) { return item.active; });
      if (lane && version) {
        lane.innerHTML = '<button type="button" class="mt-clip mt-audio-clip is-bgm' +
          (version.muted ? " is-muted" : "") + (state.selectedKind === "bgm" ? " on" : "") +
          '" data-select-bgm="' + version.versionId + '" style="left:0;width:' + Math.max(24, version.duration * px) +
          'px"><span>AI BGM · V' + (MT.doc.bgm.versions.indexOf(version) + 1) + " · " +
          (version.muted ? "已静音" : "音量 " + version.volume + "%") + "</span></button>";
      }
    }
    MT.doc.clips.forEach(function (clip) {
      var button = MT.$('[data-select-shot="' + clip.id + '"]');
      if (button) button.classList.toggle("is-ai-locked", MT.isClipLocked(clip.id));
    });
  };

  var baseSelect = MT.select;
  MT.select = function (kind, id, time) {
    if (kind === "subtitle") {
      var subtitle = MT.subtitleById(id);
      if (subtitle) state.activeSubtitleTrackId = subtitle.trackId;
    }
    baseSelect(kind, id, time);
  };

  function failTask(task, message) {
    if (task.type === "asr" && task.trackId) removeTrackData("subtitle", task.trackId);
    removeTask(task);
    state.asrBusy = !!activeTask("asr");
    state.translateBusy = !!activeTask("translate");
    state.bgmBusy = !!activeTask("bgm");
    MT.refreshTimeline();
    MT.renderToolbarState();
    MT.toast(message + "，已退回 0 积分");
  }

  function completeAsr(task) {
    if (MT.mock["asr-fail"]) return failTask(task, "ASR 识别失败，请稍后重试");
    var added = [];
    task.clipIds.forEach(function (clipId) {
      var clip = MT.clipById(clipId);
      var entry = clip && MT.entryOf(clip);
      if (!entry) return;
      (MT.asrCuesForClip ? MT.asrCuesForClip(clip) : []).forEach(function (cue) {
        added.push({
          id: MT.nextId("sub"),
          trackId: task.trackId,
          start: MT.round1(entry.start + cue.offset),
          duration: cue.duration,
          text: cue.text,
          sourceText: cue.text,
          sourceLanguage: "zh-CN",
          translations: [],
          displayMode: "single",
          clipId: clip.id,
          sourceType: "videoOriginalAudio",
          audioKind: "clip",
          audioId: clip.id,
          audioLabel: clip.label + " 原声",
          sourceTaskId: task.id,
          editedByUser: false,
          fromAsr: true
        });
      });
    });
    removeTask(task);
    state.asrBusy = false;
    if (!added.length) {
      removeTrackData("subtitle", task.trackId);
      MT.refreshTimeline();
      MT.renderToolbarState();
      return MT.toast("未识别到人声，已有字幕保持不变");
    }
    state.tracks.subtitle.forEach(function (track) {
      track.enabled = track.id === task.trackId;
    });
    MT.doc.subtitles = MT.doc.subtitles.concat(added);
    MT.saveHistory("ASR 识别字幕", task.before);
    state.activeSubtitleTrackId = task.trackId;
    MT.refreshTimeline();
    MT.renderToolbarState();
    MT.select("subtitle", added[0].id, added[0].start);
    MT.toast("已在新字幕轨生成 " + added.length + " 条字幕，原启用字幕轨已自动隐藏 · 结算 0 积分");
  }

  function startAsr(targets) {
    var before = MT.snapshot();
    var track = addTrack("subtitle", "AI 字幕 " + (state.tracks.subtitle.length + 1));
    var task = createTask("asr", {
      clipIds: targets.map(function (clip) { return clip.id; }),
      trackId: track.id,
      before: before
    });
    state.asrBusy = true;
    MT.closeDialog();
    MT.refreshTimeline();
    MT.renderToolbarState();
    MT.toast("正在分析 " + targets.length + " 个视频片段的原声…");
    setTimeout(function () { completeAsr(task); }, Math.max(0, task.dueAt - Date.now()));
  }

  MT.recognizeSubtitles = function () {
    var targets = MT.doc.clips.slice().filter(Boolean);
    if (!targets.length) return MT.toast("时间线上没有可识别的视频片段");
    if (state.tracks.subtitle.length >= MT.TRACK_LIMITS.subtitle) return MT.toast("字幕轨已达上限，请点击轨道右侧 × 删除一条后再识别");
    if (MT.videoTaskBusy()) return lockedToast();
    var seconds = targets.reduce(function (sum, clip) { return sum + clip.duration; }, 0);
    MT.confirm({
      title: "识别视频原声",
      body: "识别范围：全部视频片段；共 " + targets.length + " 个片段，" + MT.secText(seconds) + "。将新建字幕轨并自动隐藏其他已启用字幕轨，预计消耗 0 积分。",
      ok: "确认识别 · 0 积分",
      onOk: function () { startAsr(targets); }
    });
  };
  MT.recognizeSubtitle = MT.recognizeSubtitles;

  var LANGS = { en: "英语", "zh-CN": "简体中文" };
  function sourceText(subtitle) {
    return subtitle.sourceText || subtitle.textOriginal || String(subtitle.text || "").split("\n")[0];
  }
  function isSymbolOnly(text) {
    return !/[A-Za-z\u3400-\u9fff]/.test(String(text || ""));
  }
  function detectLanguage(text) {
    if (isSymbolOnly(text)) return "symbol";
    return /[\u3400-\u9fff]/.test(text) ? "zh-CN" : "en";
  }
  function translate(text, lang) {
    if (lang === "en" && MT.translateLine) return MT.translateLine(text, "en");
    var zh = {
      "Mom, sorry I'm late today.": "妈，对不起，今天来晚了。",
      "No wonder I couldn't find anyone": "我说怎么找不到人",
      "Turns out you're here mourning a dead man.": "原来在给一个死人上坟。"
    };
    return zh[text] || "【中文】" + text;
  }
  function rawTranslationCandidates() {
    if (state.translateRange === "selected") {
      var selected = MT.selectedSubtitle();
      return selected ? [selected] : [];
    }
    var trackId = state.activeSubtitleTrackId || (state.tracks.subtitle[0] || {}).id;
    return MT.doc.subtitles.filter(function (subtitle) { return subtitle.trackId === trackId; });
  }
  function filterTranslatableSubtitles(list, lang) {
    var valid = (list || []).filter(function (subtitle) {
      var text = sourceText(subtitle).trim();
      return text && text !== "请输入字幕" && !isSymbolOnly(text);
    });
    if (state.translateRange === "selected" && valid.length <= 1) {
      return valid.filter(function (subtitle) { return detectLanguage(sourceText(subtitle)) !== lang; });
    }
    return valid.filter(function (subtitle) { return detectLanguage(sourceText(subtitle)) !== lang; });
  }
  function syncTranslatePanel3() {
    var lang = state.translateLang || "en";
    var targets = filterTranslatableSubtitles(rawTranslationCandidates(), lang);
    var track = state.tracks.subtitle.find(function (item) { return item.id === state.activeSubtitleTrackId; });
    var rangeLabel = MT.$("#translate-range-label");
    var langLabel = MT.$("#translate-lang-label");
    if (rangeLabel) rangeLabel.textContent = state.translateRange === "track" ? (track ? track.name : "当前字幕轨") + "（整轨）" : "选中的字幕";
    if (langLabel) langLabel.textContent = LANGS[lang] || LANGS.en;
    var count = MT.$("#translate-count");
    var quantity = MT.$("#translate-quantity");
    if (count) count.textContent = targets.length;
    if (quantity) quantity.textContent = targets.reduce(function (sum, subtitle) { return sum + sourceText(subtitle).length; }, 0);
    MT.$$("#translate-range-menu [data-translate-range]").forEach(function (button) {
      button.setAttribute("aria-selected", button.dataset.translateRange === state.translateRange ? "true" : "false");
    });
    MT.$$("#translate-lang-menu [data-translate-lang]").forEach(function (button) {
      button.setAttribute("aria-selected", button.dataset.translateLang === state.translateLang ? "true" : "false");
    });
    MT.closeTranslateMenus();
  }
  MT.openTranslatePanel = function () {
    if (!MT.doc.subtitles.length) return MT.toast("当前字幕轨没有可翻译内容");
    if (activeTask("translate")) return MT.toast("字幕翻译进行中，请稍候");
    state.translateRange = state.selectedKind === "subtitle" ? "selected" : "track";
    state.translateLang = LANGS[state.translateLang] ? state.translateLang : "en";
    syncTranslatePanel3();
    MT.$("#translate-modal").hidden = false;
  };
  MT.setTranslateRange = function (range) {
    state.translateRange = range === "track" ? "track" : "selected";
    syncTranslatePanel3();
  };
  MT.setTranslateLang = function (lang) {
    if (!LANGS[lang]) return;
    state.translateLang = lang;
    syncTranslatePanel3();
  };
  function completeTranslation(task) {
    if (MT.mock["translate-fail"]) return failTask(task, "字幕翻译失败，请稍后重试");
    var targets = task.subtitleIds.map(MT.subtitleById).filter(Boolean);
    targets.forEach(function (subtitle) {
      var original = sourceText(subtitle);
      var row = (subtitle.translations || []).find(function (item) { return item.language === task.lang; });
      if (!row) {
        row = { language: task.lang };
        subtitle.translations.push(row);
      }
      row.text = translate(original, task.lang);
      row.sourceTaskId = task.id;
      row.editedByUser = false;
      subtitle.sourceText = original;
      subtitle.sourceLanguage = detectLanguage(original);
      subtitle.translateLang = task.lang;
      subtitle.displayMode = "bilingual";
      subtitle.fromTranslation = true;
      MT.updateSubtitleDisplay(subtitle);
    });
    removeTask(task);
    state.translateBusy = false;
    MT.saveHistory("生成双语字幕", task.before);
    MT.refreshTimeline();
    MT.renderToolbarState();
    if (targets[0]) MT.select("subtitle", targets[0].id, targets[0].start);
    MT.toast("已生成 " + targets.length + " 条" + LANGS[task.lang] + "双语字幕" + (task.skipped ? "（跳过 " + task.skipped + " 条同语种/符号字幕）" : "") + " · 结算 0 积分");
  }
  function startTranslation(targets, lang, skipped) {
    var task = createTask("translate", {
      subtitleIds: targets.map(function (subtitle) { return subtitle.id; }),
      lang: lang,
      skipped: skipped || 0,
      before: MT.snapshot()
    });
    state.translateBusy = true;
    MT.closeTranslatePanel();
    MT.renderTracks();
    MT.renderToolbarState();
    MT.toast("正在翻译为" + LANGS[lang] + "…");
    setTimeout(function () { completeTranslation(task); }, Math.max(0, task.dueAt - Date.now()));
  }
  MT.confirmTranslateSubtitles = function () {
    var raw = rawTranslationCandidates().filter(function (subtitle) {
      var text = sourceText(subtitle).trim();
      return text && text !== "请输入字幕";
    });
    if (!raw.length) return MT.toast("当前字幕轨没有可翻译内容");
    var lang = state.translateLang || "en";
    var targets = filterTranslatableSubtitles(raw, lang);
    if (!targets.length) {
      return MT.toast("原字幕已是目标语言，请选择其他语言");
    }
    if (targets.some(function (subtitle) { return MT.isSubtitleLocked(subtitle.id); })) return lockedToast();
    var skipped = Math.max(0, raw.length - targets.length);
    var edited = targets.some(function (subtitle) {
      return (subtitle.translations || []).some(function (row) { return row.language === lang && row.editedByUser; });
    });
    if (edited) {
      MT.closeTranslatePanel();
      return MT.confirm({
        title: "覆盖人工译文？",
        body: "重新翻译将替换人工修改过的" + LANGS[lang] + "译文。",
        ok: "继续翻译 · 0 积分",
        onOk: function () { startTranslation(targets, lang, skipped); }
      });
    }
    startTranslation(targets, lang, skipped);
  };

  function completeBgm(task) {
    if (MT.mock["bgm-fail"]) return failTask(task, "BGM 生成失败，请稍后重试");
    var bgm = MT.doc.bgm;
    if (!bgm) {
      var track = addTrack("audio", "AI BGM", "aud-bgm-" + Date.now().toString(36));
      bgm = MT.doc.bgm = { trackId: track.id, versions: [] };
    }
    var previous = bgm.versions.find(function (version) { return version.active; });
    bgm.versions.forEach(function (version) {
      version.active = false;
      version.muted = true;
    });
    var version = {
      versionId: MT.nextId("bgm"),
      sourceTaskId: task.id,
      timelineStart: 0,
      duration: MT.totalDuration(),
      volume: previous ? previous.volume : 35,
      muted: false,
      active: true,
      createdAt: Date.now(),
      createdLabel: nowLabel()
    };
    bgm.versions.push(version);
    removeTask(task);
    state.bgmBusy = false;
    MT.saveHistory("生成 AI BGM", task.before);
    state.selectedKind = "bgm";
    state.selected = version.versionId;
    MT.refreshTimeline();
    MT.renderToolbarState();
    MT.renderInspector();
    MT.toast("AI BGM V" + bgm.versions.length + " 已生成 · 结算 0 积分");
  }
  function startBgm() {
    var task = createTask("bgm", { before: MT.snapshot(), duration: MT.totalDuration() });
    state.bgmBusy = true;
    MT.closeDialog();
    MT.refreshTimeline();
    MT.renderToolbarState();
    MT.toast("正在根据整集画面生成 BGM…");
    setTimeout(function () { completeBgm(task); }, Math.max(0, task.dueAt - Date.now()));
  }
  MT.hasValidSubtitlesForBgm = function () {
    return (MT.doc.subtitles || []).some(function (subtitle) {
      var text = sourceText(subtitle).trim();
      return text && text !== "请输入字幕";
    });
  };
  MT.openBgmPanel = function () {
    if (!MT.doc.clips.length) return MT.toast("先编辑视频再生成 BGM");
    if (!MT.hasValidSubtitlesForBgm()) return MT.toast("请先生成字幕、再生成BGM");
    if (MT.videoTaskBusy()) return lockedToast();
    if (!MT.doc.bgm && state.tracks.audio.length >= MT.TRACK_LIMITS.audio) return MT.toast("音频轨已达上限，请点击轨道右侧 × 删除一条后再生成");
    if (MT.doc.bgm && MT.doc.bgm.versions.length >= MT.BGM_VERSION_LIMIT) {
      return MT.toast("BGM 历史版本最多保留 " + MT.BGM_VERSION_LIMIT + " 个，请先删除旧版本后再生成");
    }
    MT.confirm({
      title: MT.doc.bgm ? "生成新的 BGM 版本" : "生成整集 BGM",
      body: "系统将结合整集画面与字幕时间戳，自动生成从 00:00 到 " + MT.mmss(MT.totalDuration()) + " 的连续 BGM" + (MT.doc.bgm ? "（最多保留 " + MT.BGM_VERSION_LIMIT + " 个版本）" : "") + "。预计消耗 0 积分。",
      ok: "确认生成 · 0 积分",
      onOk: startBgm
    });
  };
  MT.switchBgmVersion = function (versionId) {
    if (!MT.doc.bgm) return;
    MT.saveHistory("切换 BGM 版本");
    MT.doc.bgm.versions.forEach(function (version) {
      version.active = version.versionId === versionId;
      version.muted = !version.active;
    });
    state.selectedKind = "bgm";
    state.selected = versionId;
    MT.refreshTimeline();
    MT.toast("已切换 BGM 版本");
  };
  MT.toggleBgmMute = function () {
    if (!MT.doc.bgm) return;
    var version = MT.doc.bgm.versions.find(function (item) { return item.active; });
    if (!version) return;
    MT.saveHistory(version.muted ? "取消 BGM 静音" : "静音 BGM");
    version.muted = !version.muted;
    MT.refreshTimeline();
  };
  MT.deleteBgmVersion = function (versionId) {
    if (!MT.doc.bgm) return;
    if (MT.doc.bgm.versions.length <= 1) {
      MT.saveHistory("删除 AI BGM");
      removeTrackData("audio", MT.doc.bgm.trackId);
      MT.clearSelection();
      MT.refreshTimeline();
      return MT.toast("已删除 AI BGM");
    }
    MT.saveHistory("删除 BGM 版本");
    var removed = MT.doc.bgm.versions.find(function (item) { return item.versionId === versionId; });
    MT.doc.bgm.versions = MT.doc.bgm.versions.filter(function (item) { return item.versionId !== versionId; });
    if (removed && removed.active) {
      var latest = MT.doc.bgm.versions[MT.doc.bgm.versions.length - 1];
      latest.active = true;
      latest.muted = false;
      state.selected = latest.versionId;
    }
    MT.refreshTimeline();
    MT.toast("已删除 BGM 版本");
  };

  function performRemoveTrack(type, id) {
    MT.saveHistory("删除轨道");
    removeTrackData(type, id);
    state.tracks[type].forEach(function (track, i) {
      if (String(track.name || "").indexOf("AI ") === 0) return;
      track.name = trackName(type, i);
    });
    if (type === "subtitle" && !state.tracks.subtitle.some(function (track) { return track.id === state.activeSubtitleTrackId; })) {
      state.activeSubtitleTrackId = (state.tracks.subtitle[0] || {}).id || "";
    }
    MT.clearSelection();
    MT.refreshTimeline();
    MT.toast("已删除" + MT.TRACK_LABEL[type] + "轨");
  }

  /* 删除轨道时同步清理对应内容。主视频轨和旁白音轨只可隐藏。 */
  MT.removeTrack = function (type, id) {
    if (state.readonly) return;
    var list = state.tracks[type];
    var index = list.findIndex(function (track) { return track.id === id; });
    if (index < 0) return;
    if (type === "video" && index === 0) return MT.toast("主视频轨不可删除，可以隐藏");
    if (type === "audio" && index === 0) return MT.toast("旁白音轨不可删除，可以隐藏");
    if (type === "subtitle" && MT.doc.subtitles.some(function (subtitle) { return subtitle.trackId === id && MT.isSubtitleLocked(subtitle.id); })) return lockedToast();
    if (type === "audio" && MT.doc.bgm && MT.doc.bgm.trackId === id && activeTask("bgm")) return lockedToast();
    var track = list[index];
    var body = "删除后可以撤销，不退回已结算积分。";
    if (type === "subtitle") {
      var count = MT.doc.subtitles.filter(function (subtitle) { return subtitle.trackId === id; }).length;
      body = "将同时删除该轨上的 " + count + " 条字幕。" + body;
    } else if (type === "audio" && MT.doc.bgm && MT.doc.bgm.trackId === id) {
      body = "将同时删除这条 BGM 的全部历史版本。" + body;
    }
    MT.confirm({
      title: "删除「" + track.name + "」？",
      body: body,
      ok: "删除轨道",
      danger: true,
      onOk: function () { performRemoveTrack(type, id); }
    });
  };

  /* 关键编辑操作二次检查任务锁。 */
  var baseDelete = MT.deleteSelection;
  MT.deleteSelection = function () {
    if (state.selectedKind === "subtitle" && MT.isSubtitleLocked(state.selected)) return lockedToast();
    if (state.selectedKind === "bgm") return MT.deleteBgmVersion(state.selected);
    return baseDelete();
  };
  var baseClearSubtitles = MT.clearSubtitles;
  MT.clearSubtitles = function () {
    if (MT.doc.subtitles.some(function (subtitle) { return MT.isSubtitleLocked(subtitle.id); })) return lockedToast();
    baseClearSubtitles();
  };
  var baseRegenerate = MT.regenerate;
  MT.regenerate = function (clip) {
    if (clip && MT.isClipLocked(clip.id)) return lockedToast();
    baseRegenerate(clip);
  };
  var baseAddAsset = MT.addAsset;
  MT.addAsset = function () {
    if (MT.videoTaskBusy()) return lockedToast();
    return baseAddAsset.apply(null, arguments);
  };
  var basePaste = MT.paste;
  MT.paste = function () {
    if (state.clipboard && state.clipboard.kind === "shot" && MT.videoTaskBusy()) return lockedToast();
    return basePaste();
  };
  var baseDuplicate = MT.duplicate;
  MT.duplicate = function () {
    if (MT.selectedShot() && MT.videoTaskBusy()) return lockedToast();
    return baseDuplicate();
  };
  var baseToggleMagnet = MT.toggleMagnet;
  MT.toggleMagnet = function () {
    if (MT.videoTaskBusy()) return lockedToast();
    return baseToggleMagnet();
  };
  var baseAddSubtitle = MT.addSubtitle;
  MT.addSubtitle = function () {
    if (!state.tracks.subtitle.length) addTrack("subtitle", "字幕 1");
    if (!state.tracks.subtitle.some(function (track) { return track.id === state.activeSubtitleTrackId; })) {
      state.activeSubtitleTrackId = state.tracks.subtitle[0].id;
    }
    baseAddSubtitle();
    var subtitle = MT.selectedSubtitle();
    if (subtitle) {
      subtitle.trackId = state.activeSubtitleTrackId || state.tracks.subtitle[0].id;
      subtitle.sourceText = subtitle.text;
      subtitle.sourceLanguage = "zh-CN";
      subtitle.translations = [];
      subtitle.displayMode = "single";
      MT.renderTracks();
    }
  };

  var baseToolbar = MT.renderToolbarState;
  MT.renderToolbarState = function () {
    baseToolbar();
    var bgm = MT.$('[data-act="generate-bgm"]');
    var asr = MT.$('[data-act="recognize-subtitles"]');
    var hasSub = MT.hasValidSubtitlesForBgm();
    if (bgm) {
      var blockedByTask = !MT.doc.clips.length || MT.videoTaskBusy();
      bgm.disabled = blockedByTask;
      bgm.classList.toggle("is-sub-required", !blockedByTask && !hasSub);
      bgm.setAttribute("aria-disabled", blockedByTask || !hasSub ? "true" : "false");
      if (!hasSub) {
        bgm.setAttribute("data-hover-tip", "请先生成字幕、再生成BGM");
        bgm.title = "请先生成字幕、再生成BGM";
      } else {
        bgm.removeAttribute("data-hover-tip");
        bgm.title = "根据整集画面与字幕时间戳自动生成连续 BGM";
      }
    }
    if (asr) asr.disabled = !MT.doc.clips.length || MT.videoTaskBusy() || state.tracks.subtitle.length >= MT.TRACK_LIMITS.subtitle;
  };

  var baseExportVideo = MT.exportVideo;
  MT.exportVideo = function () {
    if (MT.hasActiveAiTask()) return MT.toast("AI 内容仍在生成，完成后再导出");
    baseExportVideo();
  };
  var baseExportXml = MT.exportXml;
  MT.exportXml = function () {
    if (MT.hasActiveAiTask()) return MT.toast("AI 内容仍在生成，完成后再导出");
    baseExportXml();
  };

  /* 刷新后继续完成尚未到期的 mock 任务。 */
  activeTasks().forEach(function (task) {
    if (task.type === "asr") {
      state.asrBusy = true;
      setTimeout(function () { completeAsr(task); }, Math.max(100, task.dueAt - Date.now()));
    }
    if (task.type === "translate") {
      state.translateBusy = true;
      setTimeout(function () { completeTranslation(task); }, Math.max(100, task.dueAt - Date.now()));
    }
    if (task.type === "bgm") {
      state.bgmBusy = true;
      setTimeout(function () { completeBgm(task); }, Math.max(100, task.dueAt - Date.now()));
    }
  });
})();
