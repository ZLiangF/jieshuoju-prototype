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
    if (subtitle.bilingual || subtitle.displayMode === "bilingual") subtitle.text = subtitle.sourceText;
    subtitle.bilingual = false;
    subtitle.displayMode = "single";
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
      if (subtitle.bilingual || subtitle.displayMode === "bilingual") subtitle.text = subtitle.sourceText;
      subtitle.bilingual = false;
      subtitle.displayMode = "single";
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

  /* 双语 = 两条字幕轨：原文一条、译文一条，每条字幕只存一种语言。 */
  MT.LANG_LABEL = { "zh-CN": "中文", en: "英文" };
  MT.subtitleDisplayText = function (subtitle) {
    return String(subtitle.text || "");
  };
  MT.updateSubtitleDisplay = function (subtitle) {
    subtitle.text = subtitle.sourceText || subtitle.text || "";
    subtitle.textOriginal = subtitle.text;
  };
  MT.subtitleLanguage = function (subtitle) {
    return subtitle.language || detectLanguage(String(subtitle.text || ""));
  };
  MT.trackLanguage = function (track) {
    if (!track) return "";
    if (track.language) return track.language;
    var counts = { "zh-CN": 0, en: 0 };
    MT.doc.subtitles.forEach(function (subtitle) {
      if (subtitle.trackId !== track.id) return;
      var lang = MT.subtitleLanguage(subtitle);
      if (counts[lang] !== undefined) counts[lang] += 1;
    });
    if (!counts["zh-CN"] && !counts.en) return "";
    return counts.en > counts["zh-CN"] ? "en" : "zh-CN";
  };
  function isValidSubtitleText(text) {
    var value = String(text || "").trim();
    return !!value && value !== "请输入字幕";
  }
  function visibleSubtitleTracks() {
    return (state.tracks.subtitle || []).filter(function (track) { return track.enabled !== false; });
  }

  /* 播放器同时展示所有显示中字幕轨的字幕，按轨道顺序从上到下一轨一行。 */
  MT.activeSubtitlesAt = function (time) {
    var rows = [];
    visibleSubtitleTracks().forEach(function (track) {
      var hit = MT.doc.subtitles.find(function (subtitle) {
        return subtitle.trackId === track.id && time >= subtitle.start && time <= subtitle.start + subtitle.duration;
      });
      if (hit) rows.push({ track: track, subtitle: hit });
    });
    return rows;
  };
  MT.activeSubtitleAt = function (time) {
    var rows = MT.activeSubtitlesAt(time);
    return rows.length ? rows[0].subtitle : null;
  };
  var baseRenderPlayhead = MT.renderPlayhead;
  MT.renderPlayhead = function () {
    baseRenderPlayhead();
    var caption = MT.$("#caption-preview");
    if (!caption) return;
    var rows = state.disabledTracks.subtitle ? [] : MT.activeSubtitlesAt(state.currentTime);
    var html = rows.map(function (row) {
      var lang = MT.subtitleLanguage(row.subtitle) === "en" ? "en" : "zh";
      return '<span class="mt-caption-line is-' + lang + '">' + esc(row.subtitle.text) + "</span>";
    }).join("");
    if (caption.innerHTML !== html) caption.innerHTML = html;
  };

  /* 左侧「字幕一览」：按字幕轨分组列出全部字幕，译文轨同时展示对应原文。 */
  MT.renderSubtitleOverview = function () {
    var box = MT.$("#subtitle-overview");
    if (!box) return;
    var tracks = state.tracks.subtitle || [];
    var total = MT.doc.subtitles.length;
    var html = '<div class="mt-sub-overview-head"><b>字幕一览</b><small>共 ' + tracks.length + " 条字幕轨 · " + total + " 条字幕</small></div>";
    if (!tracks.length || !total) {
      box.innerHTML = html + '<p class="mt-sub-overview-empty">还没有字幕。可以点击时间线上的「识别字幕」或「添加字幕」。</p>';
      return;
    }
    html += tracks.map(function (track) {
      var list = MT.doc.subtitles.filter(function (subtitle) { return subtitle.trackId === track.id; })
        .sort(function (a, b) { return a.start - b.start; });
      var lang = MT.trackLanguage(track);
      var source = track.sourceTrackId && tracks.find(function (item) { return item.id === track.sourceTrackId; });
      return '<section class="mt-sub-overview-track' + (track.enabled === false ? " is-hidden" : "") + '">' +
        '<header><b>' + esc(track.name) + "</b><span>" + (MT.LANG_LABEL[lang] || "未识别语言") +
        (source ? " · 译自 " + esc(source.name) : "") + " · " + (track.enabled === false ? "已隐藏" : "显示中") + " · " + list.length + " 条</span></header>" +
        (list.length ? list.map(function (subtitle) {
          var origin = subtitle.sourceSubtitleId && MT.subtitleById(subtitle.sourceSubtitleId);
          var on = state.selected === subtitle.id || (state.multi || []).some(function (item) { return item.kind === "subtitle" && item.id === subtitle.id; });
          return '<button type="button" class="mt-sub-overview-row' + (on ? " on" : "") + '" data-overview-sub="' + subtitle.id + '">' +
            "<time>" + MT.mmss(subtitle.start) + "</time><span>" + esc(subtitle.text) +
            (origin ? "<small>" + esc(origin.text) + "</small>" : "") + "</span></button>";
        }).join("") : '<p class="mt-sub-overview-empty">这条轨道还没有字幕</p>') +
        "</section>";
    }).join("");
    box.innerHTML = html;
  };
  document.addEventListener("click", function (event) {
    var row = event.target.closest && event.target.closest("[data-overview-sub]");
    if (!row) return;
    var subtitle = MT.subtitleById(row.dataset.overviewSub);
    if (subtitle) MT.select("subtitle", subtitle.id, subtitle.start);
  });

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
        var tag = subtitle.fromTranslation ? "译·" + (MT.LANG_LABEL[subtitle.language] || "") : (subtitle.fromAsr ? "ASR" : "");
        var locked = MT.isSubtitleLocked(subtitle.id);
        return '<button type="button" class="mt-clip mt-subtitle-clip' +
          (state.selected === subtitle.id ? " on" : "") +
          (subtitle.fromAsr || subtitle.fromTranslation ? " is-asr" : "") +
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
    MT.renderSubtitleOverview();
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
    var skippedClips = 0;
    task.clipIds.forEach(function (clipId) {
      var clip = MT.clipById(clipId);
      var entry = clip && MT.entryOf(clip);
      if (!entry) return;
      /* 本期识别中文和英文原声；无人声或语言无法识别的片段直接跳过。 */
      var cues = (MT.asrCuesForClip ? MT.asrCuesForClip(clip) : []).filter(function (cue) {
        return detectLanguage(cue.text) === "zh-CN" || detectLanguage(cue.text) === "en";
      });
      if (MT.mock["asr-unknown"] && MT.doc.clips.indexOf(clip) === 1) cues = [];
      if (!cues.length) skippedClips += 1;
      cues.forEach(function (cue) {
        added.push({
          id: MT.nextId("sub"),
          trackId: task.trackId,
          start: MT.round1(entry.start + cue.offset),
          duration: cue.duration,
          text: cue.text,
          sourceText: cue.text,
          language: detectLanguage(cue.text),
          sourceLanguage: detectLanguage(cue.text),
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
      return MT.toast("未识别到可用的人声，已有字幕保持不变");
    }
    state.tracks.subtitle.forEach(function (track) {
      track.enabled = track.id === task.trackId;
    });
    MT.doc.subtitles = MT.doc.subtitles.concat(added);
    var newTrack = state.tracks.subtitle.find(function (track) { return track.id === task.trackId; });
    if (newTrack) newTrack.language = MT.trackLanguage(newTrack);
    MT.saveHistory("ASR 识别字幕", task.before);
    state.activeSubtitleTrackId = task.trackId;
    MT.refreshTimeline();
    MT.renderToolbarState();
    MT.select("subtitle", added[0].id, added[0].start);
    MT.toast("已在新字幕轨生成 " + added.length + " 条字幕" + (skippedClips ? "，" + skippedClips + " 个片段无法识别已跳过" : "") + "，原显示字幕轨已自动隐藏");
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
    if (state.readonly) return MT.toast("只读模式下不可使用 AI 功能");
    var targets = MT.doc.clips.slice().filter(Boolean);
    if (!targets.length) return MT.toast("时间线上没有可识别的视频片段");
    if (state.tracks.subtitle.length >= MT.TRACK_LIMITS.subtitle) return MT.toast("字幕轨已达上限，请点击轨道右侧 × 删除一条后再识别");
    if (MT.videoTaskBusy()) return lockedToast();
    var seconds = targets.reduce(function (sum, clip) { return sum + clip.duration; }, 0);
    MT.confirm({
      title: "识别视频原声",
      body: "识别范围：全部视频片段；共 " + targets.length + " 个片段，" + MT.secText(seconds) + "。支持中文和英文原声，无法识别的片段会跳过。将新建字幕轨并自动隐藏其他显示中的字幕轨，预计消耗 0 积分。",
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
  function selectedSubtitles() {
    if (state.multi && state.multi.length > 1) {
      return state.multi.filter(function (item) { return item.kind === "subtitle"; }).map(function (item) { return MT.subtitleById(item.id); }).filter(Boolean);
    }
    var one = MT.selectedSubtitle();
    return one ? [one] : [];
  }
  /* 一次翻译只针对一条原文字幕轨；框选跨轨时取第一条字幕所在的轨。 */
  function rawTranslationCandidates() {
    if (state.translateRange === "selected") {
      var picked = selectedSubtitles();
      if (!picked.length) return [];
      var pickedTrack = picked[0].trackId;
      return picked.filter(function (subtitle) { return subtitle.trackId === pickedTrack; });
    }
    var trackId = state.activeSubtitleTrackId || (state.tracks.subtitle[0] || {}).id;
    return MT.doc.subtitles.filter(function (subtitle) { return subtitle.trackId === trackId; });
  }
  function translationTrackFor(sourceTrackId, lang) {
    return (state.tracks.subtitle || []).find(function (track) {
      return track.sourceTrackId === sourceTrackId && track.language === lang;
    });
  }
  function uniqueTrackName(base) {
    var names = (state.tracks.subtitle || []).map(function (track) { return track.name; });
    if (names.indexOf(base) < 0) return base;
    var n = 2;
    while (names.indexOf(base + " " + n) > -1) n += 1;
    return base + " " + n;
  }
  function insertTranslationTrack(sourceTrackId, lang) {
    var list = state.tracks.subtitle;
    var index = list.findIndex(function (track) { return track.id === sourceTrackId; });
    var track = {
      id: MT.nextId("sub-track"),
      name: uniqueTrackName((MT.LANG_LABEL[lang] || "译文") + "字幕"),
      enabled: true,
      language: lang,
      sourceTrackId: sourceTrackId
    };
    list.splice(index < 0 ? list.length : index + 1, 0, track);
    return track;
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
    var raw = rawTranslationCandidates();
    var targets = filterTranslatableSubtitles(raw, lang);
    var track = state.tracks.subtitle.find(function (item) { return item.id === state.activeSubtitleTrackId; });
    var rangeLabel = MT.$("#translate-range-label");
    var langLabel = MT.$("#translate-lang-label");
    if (rangeLabel) rangeLabel.textContent = state.translateRange === "track" ? (track ? track.name : "当前字幕轨") + "（整轨）" : "选中的字幕（" + raw.length + " 条）";
    var output = MT.$("#translate-output");
    var sourceTrackId = raw[0] ? raw[0].trackId : (track || {}).id;
    var existing = sourceTrackId && translationTrackFor(sourceTrackId, lang);
    if (output) {
      output.textContent = existing
        ? "译文写入已有的「" + existing.name + "」轨，对应条目会被更新"
        : "将在原字幕轨下方新建「" + (MT.LANG_LABEL[lang] || "译文") + "字幕」轨，原文轨保持不变";
    }
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
    if (state.readonly) return MT.toast("只读模式下不可使用 AI 功能");
    if (!MT.doc.subtitles.length) return MT.toast("当前字幕轨没有可翻译内容");
    if (activeTask("translate")) return MT.toast("字幕翻译进行中，请稍候");
    state.translateRange = selectedSubtitles().length ? "selected" : "track";
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
  /* 译文写入独立字幕轨：每条译文和原文同起止时间，通过 sourceSubtitleId 关联原文。 */
  function completeTranslation(task) {
    if (MT.mock["translate-fail"]) return failTask(task, "字幕翻译失败，请稍后重试");
    var targets = task.subtitleIds.map(MT.subtitleById).filter(Boolean);
    var track = translationTrackFor(task.sourceTrackId, task.lang);
    if (!track) {
      if (state.tracks.subtitle.length >= MT.TRACK_LIMITS.subtitle) return failTask(task, "字幕轨已达上限，翻译未写入");
      track = insertTranslationTrack(task.sourceTrackId, task.lang);
    }
    track.enabled = true;
    var sourceTrack = state.tracks.subtitle.find(function (item) { return item.id === task.sourceTrackId; });
    if (sourceTrack) sourceTrack.enabled = true;
    var written = [];
    targets.forEach(function (subtitle) {
      var original = sourceText(subtitle);
      subtitle.language = detectLanguage(original);
      var text = translate(original, task.lang);
      var row = MT.doc.subtitles.find(function (item) { return item.trackId === track.id && item.sourceSubtitleId === subtitle.id; });
      if (!row) {
        row = { id: MT.nextId("sub"), trackId: track.id, translations: [], displayMode: "single" };
        MT.doc.subtitles.push(row);
      }
      row.start = subtitle.start;
      row.duration = subtitle.duration;
      row.text = text;
      row.sourceText = text;
      row.language = task.lang;
      row.sourceLanguage = task.lang;
      row.sourceSubtitleId = subtitle.id;
      row.clipId = subtitle.clipId;
      row.sourceTaskId = task.id;
      row.editedByUser = false;
      row.fromTranslation = true;
      written.push(row);
    });
    removeTask(task);
    state.translateBusy = false;
    MT.saveHistory("生成" + LANGS[task.lang] + "字幕轨", task.before);
    MT.refreshTimeline();
    MT.renderToolbarState();
    if (written[0]) MT.select("subtitle", written[0].id, written[0].start);
    MT.toast("已在「" + track.name + "」写入 " + written.length + " 条" + LANGS[task.lang] + "字幕" + (task.skipped ? "（跳过 " + task.skipped + " 条同语种/符号字幕）" : "") + " · 结算 0 积分");
  }
  function startTranslation(targets, lang, skipped) {
    var task = createTask("translate", {
      subtitleIds: targets.map(function (subtitle) { return subtitle.id; }),
      sourceTrackId: targets[0].trackId,
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
    var existingTrack = translationTrackFor(targets[0].trackId, lang);
    if (!existingTrack && state.tracks.subtitle.length >= MT.TRACK_LIMITS.subtitle) {
      return MT.toast("字幕轨已达上限，请点击轨道右侧 × 删除一条后再翻译");
    }
    var targetIds = {};
    targets.forEach(function (subtitle) { targetIds[subtitle.id] = true; });
    var edited = !!existingTrack && MT.doc.subtitles.some(function (row) {
      return row.trackId === existingTrack.id && targetIds[row.sourceSubtitleId] && row.editedByUser;
    });
    if (edited) {
      MT.closeTranslatePanel();
      return MT.confirm({
        title: "覆盖人工译文？",
        body: "重新翻译将替换「" + existingTrack.name + "」中人工修改过的" + LANGS[lang] + "译文。",
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
  /* 只认显示中字幕轨上的有效字幕，隐藏的字幕轨不参与 BGM 时间戳。 */
  MT.hasValidSubtitlesForBgm = function () {
    var visible = {};
    visibleSubtitleTracks().forEach(function (track) { visible[track.id] = true; });
    return (MT.doc.subtitles || []).some(function (subtitle) {
      return visible[subtitle.trackId] && isValidSubtitleText(subtitle.text);
    });
  };
  MT.openBgmPanel = function () {
    if (state.readonly) return MT.toast("只读模式下不可使用 AI 功能");
    if (!MT.doc.clips.length) return MT.toast("先编辑视频再生成 BGM");
    if (!MT.hasValidSubtitlesForBgm()) return MT.toast("请先生成字幕、再生成BGM");
    if (MT.videoTaskBusy()) return lockedToast();
    if (!MT.doc.bgm && state.tracks.audio.length >= MT.TRACK_LIMITS.audio) return MT.toast("音频轨已达上限，请点击轨道右侧 × 删除一条后再生成");
    if (MT.doc.bgm && MT.doc.bgm.versions.length >= MT.BGM_VERSION_LIMIT) {
      return MT.toast("BGM 历史版本最多保留 " + MT.BGM_VERSION_LIMIT + " 个，请先删除旧版本后再生成");
    }
    MT.confirm({
      title: MT.doc.bgm ? "生成新的 BGM 版本" : "生成整集 BGM",
      body: "系统将结合整集画面与显示中字幕轨的时间戳，自动生成从 00:00 到 " + MT.mmss(MT.totalDuration()) + " 的连续 BGM" + (MT.doc.bgm ? "（最多保留 " + MT.BGM_VERSION_LIMIT + " 个版本）" : "") + "。预计消耗 0 积分。",
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
      if (/^(字幕|视频|音频) \d+$/.test(String(track.name || ""))) track.name = trackName(type, i);
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

  var READONLY_TIP = "只读模式下不可使用 AI 功能";
  var baseToolbar = MT.renderToolbarState;
  MT.renderToolbarState = function () {
    baseToolbar();
    var bgm = MT.$('[data-act="generate-bgm"]');
    var asr = MT.$('[data-act="recognize-subtitles"]');
    var translateButton = MT.$('.mt-tool-group [data-act="translate-subtitles"]');
    var hasSub = MT.hasValidSubtitlesForBgm();
    if (bgm) {
      var blockedByTask = !MT.doc.clips.length || MT.videoTaskBusy();
      var greyed = state.readonly || (!blockedByTask && !hasSub);
      bgm.disabled = blockedByTask && !state.readonly;
      bgm.classList.toggle("is-sub-required", greyed);
      bgm.setAttribute("aria-disabled", blockedByTask || greyed ? "true" : "false");
      var tip = state.readonly ? READONLY_TIP : !hasSub ? "请先生成字幕、再生成BGM" : "";
      if (tip) {
        bgm.setAttribute("data-hover-tip", tip);
        bgm.title = tip;
      } else {
        bgm.removeAttribute("data-hover-tip");
        bgm.title = "根据整集画面与显示中字幕轨的时间戳自动生成连续 BGM";
      }
    }
    if (asr) asr.disabled = state.readonly || !MT.doc.clips.length || MT.videoTaskBusy() || state.tracks.subtitle.length >= MT.TRACK_LIMITS.subtitle;
    if (translateButton && state.readonly) translateButton.disabled = true;
    [asr, translateButton].forEach(function (button) {
      if (!button) return;
      if (state.readonly) button.title = READONLY_TIP;
    });
  };

  /* 导出字幕：隐藏的字幕轨不导出；显示中同时有中文和英文字幕轨时，选择只导出其中一种语言。 */
  MT.pickExportSubtitles = function (done) {
    var visible = visibleSubtitleTracks().filter(function (track) {
      return MT.doc.subtitles.some(function (subtitle) { return subtitle.trackId === track.id; });
    });
    var hidden = (state.tracks.subtitle || []).length - visibleSubtitleTracks().length;
    var hiddenNote = hidden ? "，" + hidden + " 条隐藏字幕轨未导出" : "";
    var byLang = { "zh-CN": [], en: [] };
    visible.forEach(function (track) {
      var lang = MT.trackLanguage(track);
      if (byLang[lang]) byLang[lang].push(track);
    });
    if (!byLang["zh-CN"].length || !byLang.en.length) {
      var only = byLang["zh-CN"].length ? "中文" : byLang.en.length ? "英文" : "";
      return done(only ? "字幕：" + only + hiddenNote : "无字幕" + hiddenNote);
    }
    MT.choose({
      title: "选择导出字幕语言",
      body: "当前同时显示中文和英文字幕轨。导出时只保留一种语言，隐藏的字幕轨不导出。",
      value: "zh-CN",
      ok: "确认导出",
      options: [
        { value: "zh-CN", label: "仅导出中文字幕", hint: byLang["zh-CN"].map(function (track) { return track.name; }).join("、") },
        { value: "en", label: "仅导出英文字幕", hint: byLang.en.map(function (track) { return track.name; }).join("、") }
      ],
      onOk: function (lang) {
        done("字幕：" + (lang === "en" ? "英文" : "中文") + hiddenNote);
      }
    });
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
