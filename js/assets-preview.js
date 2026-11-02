function emptyLookBoardHtml() {
  var doc = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h7.5L18 8v11.5H7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.5 10h6M9.5 13h6M9.5 16h3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var upload = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13.5v4.2c0 .9.7 1.6 1.6 1.6h10.8c.9 0 1.6-.7 1.6-1.6v-4.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 13.5h3.6l1.2 2h4.4l1.2-2H19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 12V4.5M9 7.4 12 4.5l3 2.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return '<div class="five-view-missing upload-empty">' +
    '<div class="upload-empty-cards" aria-hidden="true">' +
    '<span class="is-left">' + doc + '</span><span class="is-center">' + upload + '</span><span class="is-right">' + doc + "</span></div>" +
    '<div class="upload-empty-actions">' +
    '<button type="button" data-empty-upload="local"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V5M8.5 8.5 12 5l3.5 3.5M5 14v3.5c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5V14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>本地上传</button>' +
    '<button type="button" class="is-reverse" data-empty-upload="reverse">✦ 反推图片 <small>1积分</small></button>' +
    '<button type="button" data-empty-upload="library"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5c0-.8.7-1.5 1.5-1.5h4l1.6 2H18c.8 0 1.5.7 1.5 1.5v7.5c0 .8-.7 1.5-1.5 1.5H6c-.8 0-1.5-.7-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 14h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>资产库</button>' +
    "</div></div>";
}

function generationLookBoardHtml(look) {
  var progress = Math.max(6, Math.min(96, look.generationProgress || 8));
  var stage = look.generationStage || "任务排队中";
  return '<div class="look-generation-live">' +
    '<span class="look-generation-spinner" aria-hidden="true"></span>' +
    '<strong>' + stage + "</strong>" +
    '<span>正在使用 ' + document.getElementById("model-label").textContent + " 生成，可先切换到其他资产</span>" +
    '<div class="look-generation-track"><i style="width:' + progress + '%"></i></div>' +
    '<small>' + progress + "% · 预计很快完成</small></div>";
}

function failedLookBoardHtml() {
  return '<div class="look-generation-live is-failed">' +
    '<span class="look-generation-error" aria-hidden="true">!</span>' +
    '<strong>生成失败</strong><span>可以调整提示词或参考图后重新生成</span></div>';
}

function hdButtonHtml(look) {
  var level = look && look.upscale || "";
  var title = level === "4K" ? "当前已是 4K" : "超清到 4K，消耗 4 积分";
  return '<button type="button" class="img-hd-hover" data-upscale="1" aria-label="超清" title="' + title + '"' +
    (level === "4K" || upscaleBusy ? " disabled" : "") + ">HD</button>";
}

function previewImageHtml(src, alt, badge) {
  return '<img decoding="async" class="five-view-sheet" src="' + src + '" alt="' + alt + '">' +
    (badge ? '<span class="upscale-badge">' + badge + "</span>" : "") +
    hdButtonHtml(editingLook) +
    '<button type="button" class="img-edit-hover" data-edit-image="1">编辑</button>';
}

function renderCurrentLookHead(look) {
  var name = document.getElementById("current-look-name");
  var meta = document.getElementById("current-look-meta");
  if (!look) {
    name.textContent = "";
    meta.innerHTML = "";
    return;
  }
  var looks = currentChar.looksList || [];
  var index = looks.indexOf(look);
  var ready = lookVisualState(look, index) === "ready";
  var chip = episodeChip(look.eps);
  var primaryLabel = editorKind === "char" ? "主形象" : "主" + assetWord();
  name.innerHTML = (ready ? READY_MARK : "") + '<span class="look-name" title="' + escapeHtml(look.name) + '">' + escapeHtml(look.name) + "</span>" +
    (index === primaryLookIndex(looks) ? '<em class="look-primary-tag">' + primaryLabel + "</em>" : "");
  meta.innerHTML = editorKind === "char" && lookMultiOn
    ? '<span class="look-gen-eps is-static" title="' + chip.title + '">' + chip.html + "</span>"
    : '<button type="button" class="look-gen-eps" data-eps-edit="' + index + '" title="编辑集数：' + chip.title + '"><span>' + chip.html + "</span>" + EDIT_ICON + "</button>";
}

function renderCurrentLookOutput(look) {
  var preview = document.getElementById("f-preview");
  var state = look ? lookVisualState(look, (currentChar.looksList || []).indexOf(look)) : "pending";
  var stateBadge = document.getElementById("current-look-state");
  stateBadge.hidden = state === "ready";
  stateBadge.className = "current-look-state " + state;
  stateBadge.textContent = state === "ready" ? "" : lookStateText(state);
  renderCurrentLookHead(look);

  var hasSheet = !!(look && sheetForLook(look) && state === "ready");
  previewRailSrc = hasSheet ? sheetForLook(look) : "";
  historySelectedId = "";
  preview.innerHTML = hasSheet
    ? previewImageHtml(previewRailSrc, currentChar.name + "五视图", look && look.upscale ? "超清 " + look.upscale : "")
    : state === "generating" && look
    ? generationLookBoardHtml(look)
    : state === "failed"
    ? failedLookBoardHtml()
    : emptyLookBoardHtml();
  var output = preview.closest(".look-current-output");
  output.classList.toggle("is-empty", !hasSheet);
  output.classList.toggle("is-generating", state === "generating");
  renderPreviewRail(look, hasSheet);

  var generate = document.getElementById("gen-look");
  generate.disabled = state === "generating";
  generate.classList.toggle("is-generating", state === "generating");
  generate.textContent = state === "generating" ? "" : "↑";
  if (state === "generating") generate.setAttribute("aria-label", "生成中");
  else if (typeof paintGenControls === "function") paintGenControls();
  paintUpscaleButton(look, state);
}

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}

function historyStamp(date) {
  var d = date || new Date();
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

function ensureLookHistory(look) {
  if (!look) return [];
  if (look.history) return look.history;
  look.history = [];
  var src = look.sheet || (isLookRevealed(currentChar, look) ? sheetForLook(look) : "");
  if (src) {
    look.history.push({
      id: look.id + "-v1",
      version: 1,
      time: "2026/10/14 11:20:03",
      prompt: look.prompt || "",
      src: src
    });
  }
  return look.history;
}

function recordLookHistory(item, look) {
  var previous = currentChar;
  currentChar = item;
  var src = sheetForLook(look);
  currentChar = previous;
  if (!src) return;
  var list = ensureLookHistory(look);
  var prompt = look.prompt || "";
  var last = list[list.length - 1];
  if (last && last.src === src && last.prompt === prompt) return;
  list.push({
    id: look.id + "-v" + (list.length + 1) + "-" + Date.now(),
    version: list.length + 1,
    time: historyStamp(),
    prompt: prompt,
    src: src
  });
}

function previewHistoryItems(look) {
  return ensureLookHistory(look).slice().reverse().map(function (item) {
    return { id: item.id, src: item.src, label: "V" + item.version + (item.tag ? " · " + item.tag : ""), prompt: item.prompt, time: item.time, tag: item.tag || "" };
  });
}

function previewRecommendItems() {
  var items = [];
  if (editorKind === "char") {
    D.characters.forEach(function (char) {
      if (!char.sheet || items.some(function (item) { return item.src === char.sheet; })) return;
      items.push({ src: char.sheet, label: char.name });
    });
    return items;
  }
  editorItems().forEach(function (item) {
    if (!item.image || item.status === "pending" || items.some(function (entry) { return entry.src === item.image; })) return;
    items.push({ src: item.image, label: item.name });
  });
  return items;
}

function renderPreviewRail(look, hasSheet) {
  var side = document.getElementById("preview-side");
  var output = side.closest(".look-current-output");
  var history = previewHistoryItems(look);
  side.hidden = !hasSheet || !history.length;
  side.classList.toggle("is-collapsed", !previewRailOpen);
  side.classList.toggle("is-open", previewRailOpen && !side.hidden);
  output.classList.toggle("is-rail-open", previewRailOpen && !side.hidden);
  var toggle = document.getElementById("preview-side-toggle");
  toggle.setAttribute("aria-expanded", previewRailOpen && !side.hidden ? "true" : "false");
  toggle.setAttribute("aria-label", previewRailOpen ? "收起图片记录" : "展开图片记录");
  document.querySelectorAll("#preview-side [data-preview-tab]").forEach(function (button) {
    button.classList.toggle("on", button.dataset.previewTab === previewRailTab);
  });
  if (previewRailTab === "history" && !history.some(function (item) { return item.id === historySelectedId; })) historySelectedId = "";
  var items = previewRailTab === "history" ? history : previewRecommendItems();
  document.getElementById("preview-side-list").innerHTML = items.map(function (item) {
    if (item.id) {
      var promptText = (item.prompt || "").replace(/\s+/g, " ").trim();
      return '<article class="preview-side-card' + (item.id === historySelectedId ? " on" : "") + '">' +
        '<button type="button" class="preview-side-open" data-preview-src="' + item.src + '" data-history-id="' + item.id + '">' +
        '<img loading="lazy" decoding="async" src="' + item.src + '" alt="' + item.label + '">' +
        '<span class="preview-history-caption"><b>' + item.label + "</b><small>" + escapeHtml(item.time || "") + "</small>" + escapeHtml(promptText || "暂无提示词") + "</span></button>" +
        '<div class="preview-history-acts">' +
        '<button type="button" data-history-restore="' + item.id + '" aria-label="恢复提示词"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 7.2h6.1a3.1 3.1 0 1 1 0 6.2H7.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5.6 4.8 3.2 7.2l2.4 2.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button type="button" data-history-download="' + item.id + '" aria-label="下载图片"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v6.4M5.4 7.2 8 9.8l2.6-2.6M3.4 12.6h9.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button type="button" data-history-delete="' + item.id + '" aria-label="删除记录"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4.6h9.6M6.2 4.6V3.4h3.6v1.2M4.6 4.6l.5 7.4h5.8l.5-7.4M6.8 7v3.2M9.2 7v3.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></article>';
    }
    return '<button type="button" class="preview-side-card' + (item.src === previewRailSrc ? " on" : "") + '" data-preview-src="' + item.src + '">' +
      '<img loading="lazy" decoding="async" src="' + item.src + '" alt="' + item.label + '"><span>' + item.label + "</span></button>";
  }).join("") || '<p class="preview-side-empty">' + (previewRailTab === "history" ? "还没有生成历史" : "暂无内容") + "</p>";
}

function historyById(id) {
  return (editingLook ? ensureLookHistory(editingLook) : []).filter(function (item) { return item.id === id; })[0] || null;
}

function showHistoryImage(item) {
  if (!item) return;
  historySelectedId = item.id;
  previewRailSrc = item.src;
  var preview = document.getElementById("f-preview");
  preview.innerHTML = previewImageHtml(item.src, "V" + item.version, item.tag || "");
  preview.closest(".look-current-output").classList.remove("is-empty");
  renderPreviewRail(editingLook, true);
}

function restoreHistory(id) {
  var item = historyById(id);
  if (!item) return;
  document.getElementById("f-prompt").value = item.prompt || "";
  updatePromptCount();
  lookDirty = true;
  document.querySelector(".draft-hint").textContent = "已从 V" + item.version + " 恢复提示词";
  ReplicaUI.toast("已恢复 V" + item.version + " 的提示词");
}

function downloadHistory(id) {
  var item = historyById(id);
  if (!item) return;
  var link = document.createElement("a");
  var name = (editingLook ? editingLook.name : "历史图片") + "-V" + item.version;
  link.href = item.src;
  link.download = name.replace(/[\\/:*?"<>|]/g, "-") + ".jpg";
  document.body.appendChild(link);
  link.click();
  link.remove();
  ReplicaUI.toast("已开始下载 V" + item.version);
}

function deleteHistory(id) {
  if (!editingLook) return;
  var item = historyById(id);
  if (!item) return;
  editingLook.history = ensureLookHistory(editingLook).filter(function (entry) { return entry.id !== id; });
  if (historySelectedId === id) historySelectedId = "";
  renderPreviewRail(editingLook, !document.querySelector(".look-current-output").classList.contains("is-empty"));
  ReplicaUI.toast("已删除 V" + item.version);
}

var VOICE_TRASH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4.6h9.6M6.2 4.6V3.4h3.6v1.2M4.6 4.6l.5 7.4h5.8l.5-7.4M6.8 7v3.2M9.2 7v3.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var VOICE_REUSE_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 7.2h6.1a3.1 3.1 0 1 1 0 6.2H7.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5.6 4.8 3.2 7.2l2.4 2.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var voiceNewId = "";
var voiceUploadSeq = 0;

function voiceAssetsOf(char) {
  if (!char) return [];
  if (!char.voiceAssets) char.voiceAssets = [];
  var bound = char.voiceBind;
  if (bound && !char.voiceAssets.some(function (voice) { return voice.id === bound.id; })) {
    char.voiceAssets.unshift({
      id: bound.id, name: bound.name, summary: bound.summary, source: bound.source || "generated",
      status: "ready", time: bound.time || "已绑定", duration: bound.duration || 0,
      pitch: bound.pitch, rate: bound.rate, sample: bound.sample
    });
  }
  return char.voiceAssets;
}

function voiceAssetById(id) {
  return voiceAssetsOf(voiceBindChar).filter(function (voice) { return voice.id === id; })[0] || null;
}

function voiceDurationText(sec) {
  return sec ? "0:" + String(Math.round(sec)).padStart(2, "0") : "";
}

function voiceItemHtml(voice) {
  var bound = voiceBindChar && voiceBindChar.voiceBind && voiceBindChar.voiceBind.id === voice.id;
  var picked = voiceBindPick && voiceBindPick.id === voice.id;
  var playing = voicePlayingId === voice.id;
  var source = voice.source === "upload" ? "上传" : "AI 生成";
  var cls = "voice-item" + (picked ? " on" : "") + (bound ? " is-bound" : "") + (playing ? " is-playing" : "") +
    (voice.id === voiceNewId ? " is-new" : "") + (voice.status !== "ready" ? " is-" + voice.status : "");
  var lead;
  var meta;
  if (voice.status === "generating") {
    lead = '<span class="voice-item-lead"><i class="voice-spin" aria-hidden="true"></i></span>';
    meta = "生成中，约 10 秒，可先关闭弹窗";
  } else if (voice.status === "failed") {
    lead = '<span class="voice-item-lead is-error" aria-hidden="true">!</span>';
    meta = escapeHtml(voice.error || "生成失败，参数已保留");
  } else {
    lead = '<button type="button" class="voice-play' + (playing ? " is-playing" : "") + '" data-voice-play="' + voice.id + '" aria-label="' + (playing ? "停止" : "试听") + escapeHtml(voice.name) + '">' +
      (playing ? '<span class="voice-bars" aria-hidden="true"><i></i><i></i><i></i></span>' : "▶") + "</button>";
    meta = [escapeHtml(voice.summary || ""), voiceDurationText(voice.duration), escapeHtml(voice.time || "")].filter(Boolean).join(" · ");
  }
  var acts = "";
  if (voice.status === "failed") {
    acts += '<button type="button" class="voice-item-retry" data-voice-retry="' + voice.id + '">重试</button>';
  }
  if (voice.status !== "generating" && voice.source !== "upload" && voice.prompt) {
    acts += '<button type="button" class="voice-item-act" data-voice-reuse="' + voice.id + '" aria-label="复用参数" data-tip="复用参数">' + VOICE_REUSE_ICON + "</button>";
  }
  if (voice.status !== "generating") {
    acts += '<button type="button" class="voice-item-act is-danger" data-voice-del="' + voice.id + '"' +
      (bound ? ' disabled aria-label="使用中的音色不能删除" data-tip="使用中，不能删除"' : ' aria-label="删除" data-tip="删除"') + ">" + VOICE_TRASH_ICON + "</button>";
  }
  return '<div class="' + cls + '" data-voice-id="' + voice.id + '"' +
    (voice.status === "ready" ? ' role="radio" tabindex="0" aria-checked="' + (picked ? "true" : "false") + '"' : "") + ">" +
    lead +
    '<span class="voice-item-main"><span class="voice-item-title"><strong>' + escapeHtml(voice.name) + "</strong>" +
    '<em class="voice-tag">' + source + "</em>" + (bound ? '<em class="voice-tag is-bound">使用中</em>' : "") + "</span>" +
    "<small>" + meta + "</small></span>" +
    '<span class="voice-item-acts">' + acts + "</span>" +
    (voice.status === "ready" ? '<span class="voice-radio" aria-hidden="true"></span>' : "") +
    "</div>";
}

function renderVoiceList() {
  var list = voiceAssetsOf(voiceBindChar);
  var ready = list.filter(function (voice) { return voice.status === "ready"; }).length;
  document.getElementById("voice-list-count").textContent = list.length ? ready + " 条可用" : "";
  document.getElementById("voice-list").innerHTML = list.length
    ? list.map(voiceItemHtml).join("")
    : '<div class="voice-list-empty"><strong>还没有音频</strong><span>在左侧 AI 生成或上传一段人声，结果会出现在这里</span></div>';
}

function paintVoiceSwitch() {
  var char = voiceBindChar;
  var button = document.getElementById("voice-switch");
  var bound = !!(char && char.voiceBind);
  var on = charVoiceOn(char);
  button.disabled = !bound;
  button.classList.toggle("is-on", on);
  button.setAttribute("aria-checked", on ? "true" : "false");
  button.title = bound ? (on ? "点击停用，已选音色会保留" : "点击开启，旁白和对白使用这个音色") : "先绑定一条音色，才能开启";
  document.getElementById("voice-switch-label").textContent = on ? "已开启" : bound ? "已关闭" : "未开启";
}

function paintVoiceConfirm() {
  var button = document.getElementById("voice-save");
  var note = document.getElementById("voice-foot-note");
  var bound = voiceBindChar && voiceBindChar.voiceBind;
  var pick = voiceBindPick;
  var isBound = !!(pick && bound && bound.id === pick.id);
  var heard = !!(pick && voiceHeard[pick.id]);
  button.disabled = !pick || isBound || !heard;
  button.textContent = isBound ? "使用中" : bound ? "替换为此音色" : "使用此音色";
  if (!pick) note.textContent = bound ? "选择列表中的另一条音频可替换当前音色" : "从右侧列表选择一条音频";
  else if (isBound) note.textContent = "这条音频正在使用";
  else if (!heard) note.textContent = "试听后才能使用「" + pick.name + "」";
  else note.textContent = bound ? "替换后只影响之后的配音，已生成的不变" : "将绑定到「" + voiceBindChar.name + "」";
}

function renderVoicePanes() {
  document.querySelectorAll(".voice-seg [data-voice-tab]").forEach(function (button) {
    var on = button.dataset.voiceTab === voiceBindTab;
    button.classList.toggle("on", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll("[data-voice-pane]").forEach(function (pane) {
    pane.hidden = pane.dataset.voicePane !== voiceBindTab;
  });
  paintVoiceConfirm();
}

function selectVoiceCandidate(voice) {
  voiceBindPick = voice;
  renderVoiceList();
  paintVoiceConfirm();
}

function paintVoiceGenerateButton() {
  var button = document.getElementById("voice-gen");
  button.disabled = voiceGenerating;
  button.textContent = voiceGenerating ? "生成中…" : "生成音频";
}

function paintVoiceReferenceNames() {
  document.getElementById("voice-ref-chips").innerHTML = voiceReferenceNames.map(function (name, index) {
    return '<span>' + escapeHtml(name) + '<button type="button" data-voice-ref-remove="' + index + '" aria-label="移除参考音频">×</button></span>';
  }).join("");
  document.getElementById("voice-ref-btn").hidden = voiceReferenceNames.length >= 3;
}

function paintVoiceDescriptionCount() {
  document.getElementById("voice-desc-count").textContent = document.getElementById("voice-desc").value.length + " / 400";
}

function paintVoiceUploadState(state, title, detail) {
  var box = document.getElementById("voice-upload-state");
  box.hidden = !state;
  box.className = "voice-upload-state" + (state ? " is-" + state : "");
  if (!state) { box.innerHTML = ""; return; }
  var icon = state === "error" ? '<i class="voice-state-icon">!</i>' : state === "done" ? '<i class="voice-state-icon">✓</i>' : '<i class="voice-spin" aria-hidden="true"></i>';
  box.innerHTML = icon + '<span><strong>' + escapeHtml(title) + "</strong><small>" + escapeHtml(detail || "") + "</small></span>" +
    (state === "error" ? '<button type="button" class="voice-item-retry" data-voice-reupload="1">重新上传</button>' : "");
}

function openVoiceDialog(item, auto) {
  var char = item && D.characters.indexOf(item) !== -1 ? item : currentChar;
  if (!char || D.characters.indexOf(char) === -1) {
    ReplicaUI.toast("请先选择一个角色");
    return;
  }
  if (auto && voicePromptSkipped[char.id]) return;
  stopVoicePreview();
  voiceBindChar = char;
  voiceDialogAuto = !!auto;
  document.getElementById("voice-cancel").textContent = auto ? "跳过，稍后再说" : "取消";
  voiceBindTab = "generate";
  voiceBindPick = null;
  voiceHeard = {};
  voiceNewId = "";
  voiceReferenceNames = [];
  var bound = char.voiceBind;
  document.getElementById("voice-dialog-title").textContent = (bound ? "更换音色 · " : "绑定音色 · ") + char.name;
  document.getElementById("voice-current-look").innerHTML = '<img decoding="async" src="' + (char.image || "") + '" alt="' + char.name + '">';
  document.getElementById("voice-current-title").textContent = bound ? "当前音色：" + bound.name : "尚未绑定音色";
  var source = bound ? voiceSourceLabel(bound.source) : "";
  document.getElementById("voice-current-desc").textContent = bound
    ? bound.summary + (source ? " · " + source : "")
    : "生成或上传一段音频，试听满意后再绑定到角色。";
  paintVoiceSwitch();
  document.getElementById("voice-desc").value = voiceDraftText(char);
  document.getElementById("voice-sample-text").value = D.voiceSample || "这是一段统一试听，方便对比不同音色。";
  document.getElementById("voice-gen-error").hidden = true;
  paintVoiceUploadState("");
  paintVoiceGenerateButton();
  paintVoiceDescriptionCount();
  paintVoiceReferenceNames();
  if (bound) voiceBindPick = voiceAssetById(bound.id);
  renderVoiceList();
  renderVoicePanes();
  document.getElementById("voice-dialog").classList.add("open");
}

function closeVoiceDialog() {
  var dialog = document.getElementById("voice-dialog");
  if (!dialog.classList.contains("open")) return;
  stopVoicePreview();
  dialog.classList.remove("open");
}

function refreshVoiceSurfaces() {
  if (typeof render === "function") render();
  if (document.getElementById("look-dialog").classList.contains("open") && voiceBindChar === currentChar) renderLookLibrary();
}

function paintReferenceSources() {
  document.getElementById("reference-current-label").textContent = "参考当前" + assetWord();
  document.getElementById("reference-main-label").textContent = "主" + assetWord();
}

function lookReferenceImages(look) {
  if (!look) return [];
  if (Array.isArray(look.referenceImages)) return look.referenceImages;
  if (look.referenceImage) return [{ src: look.referenceImage, name: "参考图" }];
  return [];
}

function updateReferenceComposer(look) {
  var list = lookReferenceImages(look);
  referenceImageValue = list.length ? list[0].src : "";
  document.getElementById("reference-picks").innerHTML = list.map(function (item, index) {
    return '<span class="reference-pick"><img loading="lazy" decoding="async" src="' + item.src + '" alt="' + escapeHtml(item.name || "参考图") + '">' +
      '<button type="button" data-reference-remove="' + index + '" aria-label="移除「' + escapeHtml(item.name || "参考图") + '」">×</button></span>';
  }).join("");
  var button = document.getElementById("pick-asset");
  var full = list.length >= REFERENCE_LIMIT;
  button.innerHTML = PLUS_ICON;
  button.disabled = full;
  button.title = full ? "最多 " + REFERENCE_LIMIT + " 张参考图" : "添加参考图，可从本地或其他资产选择";
  button.setAttribute("aria-label", button.title);
}

function paintPendingReferences() {
  var count = pendingReferenceList.length;
  var room = REFERENCE_LIMIT - lookReferenceImages(editingLook).length;
  document.getElementById("reference-confirm").disabled = !count;
  document.getElementById("reference-confirm").textContent = count > 1 ? "添加 " + count + " 张" : "使用参考图";
  var panel = document.getElementById("reference-library-panel");
  if (!panel.hidden) {
    panel.querySelector(".reference-library-head span").textContent = count
      ? "已选择 " + count + " 张，还可以再加 " + Math.max(0, room - count) + " 张"
      : "可多选，最多 " + room + " 张";
  }
}

function renderReferenceLibrary() {
  referenceAssetChoices = [];
  D.characters.forEach(function (char) {
    (char.looksList || []).forEach(function (look) {
      referenceAssetChoices.push({
        src: look.image,
        name: look.name.replace(char.name + "-", "")
      });
    });
  });
  var saved = {};
  lookReferenceImages(editingLook).forEach(function (item) { saved[item.src] = true; });
  var pending = {};
  pendingReferenceList.forEach(function (item) { pending[item.src] = true; });
  document.getElementById("reference-asset-grid").innerHTML = referenceAssetChoices.map(function (asset, index) {
    var cls = saved[asset.src] ? " is-added" : pending[asset.src] ? " on" : "";
    return '<button type="button" class="reference-asset-card' + cls + '" data-reference-index="' + index + '">' +
      '<img loading="lazy" decoding="async" src="' + asset.src + '" alt=""><span>' + asset.name + "</span></button>";
  }).join("");
}

function openReferenceDialog() {
  if (lookReferenceImages(editingLook).length >= REFERENCE_LIMIT) {
    ReplicaUI.toast("最多 " + REFERENCE_LIMIT + " 张参考图");
    return;
  }
  pendingReferenceList = [];
  document.getElementById("reference-library-panel").hidden = true;
  document.getElementById("reference-confirm").disabled = true;
  document.getElementById("reference-confirm").textContent = "使用参考图";
  document.querySelectorAll(".reference-source-actions > button").forEach(function (button) {
    button.classList.remove("on");
  });
  document.getElementById("reference-dialog").classList.add("open");
}

function closeReferenceDialog() {
  document.getElementById("reference-dialog").classList.remove("open");
}

function showPendingReferences(title) {
  var panel = document.getElementById("reference-library-panel");
  panel.hidden = false;
  panel.querySelector(".reference-library-head strong").textContent = title;
  document.getElementById("reference-asset-grid").innerHTML = pendingReferenceList.map(function (item, index) {
    return '<button type="button" class="reference-asset-card on" data-pending-index="' + index + '">' +
      '<img loading="lazy" decoding="async" src="' + item.src + '" alt=""><span>' + escapeHtml(item.name || "参考图") + "</span></button>";
  }).join("");
  paintPendingReferences();
}

function openLookImagePicker(mode) {
  if (mode === "reverse" && D.credits < 1) {
    ReplicaUI.toast("积分不足，无法反推图片");
    return;
  }
  lookImageMode = mode || "upload";
  var input = document.getElementById("look-image-input");
  input.value = "";
  input.click();
}

function reversePromptFromImage() {
  var box = document.getElementById("f-prompt");
  var existing = box.value.trim()
    .replace(/。?保持上传图片中的[\s\S]*$/, "")
    .replace(/[。；，\s]+$/, "");
  var inferred;
  if (editorKind === "scene") {
    inferred = "根据上传图片还原「" + currentChar.name + "」的空间结构、主体布局、建筑与地面材质、光线方向、色调和天气，保持画面透视准确，不新增人物。";
  } else if (editorKind === "prop") {
    inferred = "根据上传图片还原「" + currentChar.name + "」的外形、材质、颜色、尺寸比例和使用痕迹，纯色背景，多角度清晰展示。";
  } else {
    inferred = (existing ? existing + "。" : currentChar.name + "，") +
      "保持上传图片中的五官、发型、服装款式、颜色与材质一致，身材比例自然，白底，输出近景、正面、左右侧面与背面五视图。";
  }
  box.value = inferred.slice(0, PROMPT_LIMIT);
  lookDirty = true;
  document.querySelector(".draft-hint").textContent = "存在未保存的草稿修改";
  updatePromptCount();
}

function setImageAnalysis(state, text) {
  var badge = document.getElementById("image-analyze-badge");
  var hint = document.getElementById("image-prompt-state");
  badge.className = "image-analyze-badge " + state;
  badge.textContent = text;
  badge.hidden = state === "done";
  hint.className = "image-prompt-state " + state;
  hint.textContent = state === "loading" ? "✦ 正在识别图片…" : "✦ 已根据上传图片生成";
  hint.hidden = false;
}

document.getElementById("look-image-input").onchange = function () {
  var file = this.files && this.files[0];
  this.value = "";
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    ReplicaUI.toast("请选择图片文件");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    ReplicaUI.toast("图片不能超过 10MB");
    return;
  }
  var shouldReverse = lookImageMode === "reverse";
  if (shouldReverse && D.credits < 1) {
    ReplicaUI.toast("积分不足，反推提示词需要 1 积分");
    return;
  }
  var seq = ++imageAnalysisSeq;
  var reader = new FileReader();
  reader.onerror = function () {
    if (seq === imageAnalysisSeq) ReplicaUI.toast("图片读取失败，请换一张再试");
  };
  reader.onload = function () {
    if (seq !== imageAnalysisSeq) return;
    var src = String(reader.result || "");
    if (shouldReverse) {
      D.credits -= 1;
      document.getElementById("credits").textContent = ReplicaUI.credits();
    }
    previewRailSrc = src;
    var preview = document.getElementById("f-preview");
    preview.innerHTML = previewImageHtml(src, "本地上传图片");
    preview.closest(".look-current-output").classList.remove("is-empty");
    renderPreviewRail(editingLook, false);
    lookDirty = true;
    document.querySelector(".draft-hint").textContent = "存在未保存的草稿修改";
    if (!shouldReverse) {
      document.getElementById("image-analyze-badge").hidden = true;
      document.getElementById("image-prompt-state").hidden = true;
      ReplicaUI.toast("图片上传成功");
      return;
    }
    setImageAnalysis("loading", "✦ AI 正在反推提示词");
    ReplicaUI.toast("已扣除 1 积分，正在反推提示词");
    setTimeout(function () {
      if (seq !== imageAnalysisSeq) return;
      reversePromptFromImage();
      setImageAnalysis("done", "");
      ReplicaUI.toast("已根据图片生成提示词，可以继续修改");
    }, 1200);
  };
  reader.readAsDataURL(file);
};

var UPSCALE_COST = 4;
var upscaleBusy = false;
var upscaleSeq = 0;

function paintUpscaleButton(look, state) {
  var button = document.querySelector("#f-preview .img-hd-hover");
  if (!button) return;
  var done = look && state === "ready" && look.upscale === "4K";
  button.disabled = upscaleBusy || done;
  button.title = done ? "当前已是 4K" : "超清到 4K，消耗 4 积分";
}

function paintUpscaleNote() {
  var enough = D.credits >= UPSCALE_COST;
  var note = document.getElementById("upscale-note");
  note.textContent = enough
    ? "完成后作为新版本，原图留在历史记录。"
    : "积分不足：当前余额 ✦ " + D.credits.toLocaleString("en-US") + "，本次需要 ✦ " + UPSCALE_COST + "。";
  note.classList.toggle("is-error", !enough);
  document.getElementById("upscale-ok").disabled = !enough;
}

function openUpscaleDialog() {
  if (!editingLook || upscaleBusy) return;
  if (!previewRailSrc) {
    ReplicaUI.toast("当前没有可以超清的图片");
    return;
  }
  if (editingLook.upscale === "4K") {
    ReplicaUI.toast("这张图已经是 4K");
    return;
  }
  paintUpscaleNote();
  document.getElementById("upscale-dialog").classList.add("open");
}

function closeUpscaleDialog() {
  document.getElementById("upscale-dialog").classList.remove("open");
}

function paintUpscaleOverlay(progress, stage) {
  var preview = document.getElementById("f-preview");
  var live = preview.querySelector(".upscale-live");
  if (!live) {
    live = document.createElement("div");
    live.className = "upscale-live";
    preview.appendChild(live);
  }
  live.innerHTML = '<span class="look-generation-spinner" aria-hidden="true"></span><strong>' + stage + '</strong>' +
    '<div class="look-generation-track"><i style="width:' + progress + '%"></i></div>';
}

function pushUpscaleHistory(look, level) {
  var list = ensureLookHistory(look);
  var src = previewRailSrc || sheetForLook(look);
  if (!src) return;
  list.push({
    id: look.id + "-hd-" + Date.now(),
    version: list.length + 1,
    time: historyStamp(),
    prompt: look.prompt || "",
    src: src,
    tag: "超清 " + level
  });
}

function startUpscale() {
  var look = editingLook;
  var item = currentChar;
  var level = "4K";
  var cost = UPSCALE_COST;
  if (!look || upscaleBusy || D.credits < cost) return;
  D.credits -= cost;
  document.getElementById("credits").textContent = ReplicaUI.credits();
  closeUpscaleDialog();
  upscaleBusy = true;
  paintUpscaleButton(look, "ready");
  paintUpscaleOverlay(18, "正在提升到 " + level);
  ReplicaUI.toast("已扣除 " + cost + " 积分，正在生成 " + level);
  var token = ++upscaleSeq;
  setTimeout(function () {
    if (token === upscaleSeq && editingLook === look) paintUpscaleOverlay(68, "正在补充细节");
  }, 700);
  setTimeout(function () {
    if (token !== upscaleSeq) return;
    look.upscale = level;
    pushUpscaleHistory(look, level);
    upscaleBusy = false;
    if (currentChar === item && editingLook === look) renderCurrentLookOutput(look);
    if (typeof render === "function") render();
    ReplicaUI.toast("超清完成 · " + level);
  }, 1600);
}

document.getElementById("upscale-cancel").onclick = closeUpscaleDialog;
document.getElementById("upscale-dialog").onclick = function (e) {
  if (e.target.id === "upscale-dialog") closeUpscaleDialog();
};
document.getElementById("upscale-ok").onclick = startUpscale;
document.getElementById("local-upload").onclick = function () { openLookImagePicker("upload"); };
document.getElementById("reverse-image").onclick = function () { openLookImagePicker("reverse"); };
document.getElementById("replace-view").onclick = function () { openLookImagePicker("upload"); };
document.getElementById("download-view").onclick = function () {
  var src = previewRailSrc || (editingLook ? sheetForLook(editingLook) : "");
  if (!src) return;
  var link = document.createElement("a");
  var name = editingLook ? lookShortName(editingLook) : currentChar.name;
  link.href = src;
  link.download = String(name || "形象").replace(/[\\/:*?"<>|]/g, "-") + ".jpg";
  document.body.appendChild(link);
  link.click();
  link.remove();
  ReplicaUI.toast("已开始下载");
};
document.getElementById("preview-side-toggle").onclick = function () {
  previewRailOpen = !previewRailOpen;
  renderPreviewRail(editingLook, !!previewRailSrc || !document.querySelector(".look-current-output").classList.contains("is-empty"));
};
document.getElementById("preview-side").onclick = function (e) {
  var tab = e.target.closest("[data-preview-tab]");
  if (tab) {
    previewRailTab = tab.dataset.previewTab;
    renderPreviewRail(editingLook, !document.querySelector(".look-current-output").classList.contains("is-empty"));
    return;
  }
  var restore = e.target.closest("[data-history-restore]");
  if (restore) { restoreHistory(restore.dataset.historyRestore); return; }
  var download = e.target.closest("[data-history-download]");
  if (download) { downloadHistory(download.dataset.historyDownload); return; }
  var remove = e.target.closest("[data-history-delete]");
  if (remove) { deleteHistory(remove.dataset.historyDelete); return; }
  var card = e.target.closest("[data-preview-src]");
  if (!card) return;
  if (card.dataset.historyId) {
    showHistoryImage(historyById(card.dataset.historyId));
    return;
  }
  previewRailSrc = card.dataset.previewSrc;
  var preview = document.getElementById("f-preview");
  preview.innerHTML = previewImageHtml(previewRailSrc, "五视图");
  renderPreviewRail(editingLook, true);
};
document.getElementById("f-preview").onclick = function (e) {
  var button = e.target.closest("[data-empty-upload]");
  if (button) {
    if (button.dataset.emptyUpload === "local") openLookImagePicker("upload");
    else if (button.dataset.emptyUpload === "reverse") openLookImagePicker("reverse");
    else ReplicaUI.toast("演示：从资产库选择形象图");
    return;
  }
  var upscale = e.target.closest("[data-upscale]");
  if (upscale) {
    openUpscaleDialog();
    return;
  }
  var edit = e.target.closest("[data-edit-image]");
  if (!edit) return;
  var img = edit.parentElement.querySelector("img");
  if (img && img.getAttribute("src")) openImageEditor(img.getAttribute("src"), img.alt);
};
document.getElementById("pick-asset").onclick = openReferenceDialog;
document.getElementById("reference-dialog-x").onclick = closeReferenceDialog;
document.getElementById("reference-cancel").onclick = closeReferenceDialog;
document.getElementById("reference-local-source").onclick = function () {
  document.querySelectorAll(".reference-source-actions > button").forEach(function (button) {
    button.classList.toggle("on", button.id === "reference-local-source");
  });
  var input = document.getElementById("reference-file-input");
  input.value = "";
  input.click();
};
document.getElementById("reference-file-input").onchange = function () {
  var files = Array.prototype.slice.call(this.files || []);
  this.value = "";
  var room = REFERENCE_LIMIT - lookReferenceImages(editingLook).length;
  var accepted = [];
  files.forEach(function (file) {
    if (!/^image\//.test(file.type)) return;
    if (file.size > 10 * 1024 * 1024) {
      ReplicaUI.toast("「" + file.name + "」超过 10MB");
      return;
    }
    accepted.push(file);
  });
  if (accepted.length > room) {
    ReplicaUI.toast("最多 " + REFERENCE_LIMIT + " 张参考图");
    accepted = accepted.slice(0, room);
  }
  if (!accepted.length) {
    if (files.length) ReplicaUI.toast("请选择图片文件");
    return;
  }
  pendingReferenceList = [];
  var left = accepted.length;
  accepted.forEach(function (file) {
    var reader = new FileReader();
    reader.onerror = function () { ReplicaUI.toast("图片读取失败，请换一张再试"); };
    reader.onload = function () {
      pendingReferenceList.push({ src: String(reader.result || ""), name: file.name });
      left -= 1;
      if (!left) showPendingReferences("本地图片");
    };
    reader.readAsDataURL(file);
  });
};
document.getElementById("reference-library-source").onclick = function () {
  document.querySelectorAll(".reference-source-actions > button").forEach(function (button) {
    button.classList.toggle("on", button.id === "reference-library-source");
  });
  pendingReferenceList = [];
  var panel = document.getElementById("reference-library-panel");
  panel.hidden = false;
  panel.querySelector(".reference-library-head strong").textContent = "资产库";
  renderReferenceLibrary();
  paintPendingReferences();
};
document.getElementById("reference-asset-grid").onclick = function (e) {
  var pendingCard = e.target.closest("[data-pending-index]");
  if (pendingCard && !e.target.closest("[data-reference-index]")) {
    pendingReferenceList.splice(Number(pendingCard.dataset.pendingIndex), 1);
    showPendingReferences("本地图片");
    return;
  }
  var card = e.target.closest("[data-reference-index]");
  if (!card) return;
  var asset = referenceAssetChoices[Number(card.dataset.referenceIndex)];
  if (!asset) return;
  if (lookReferenceImages(editingLook).some(function (item) { return item.src === asset.src; })) {
    ReplicaUI.toast("这张图已经添加过");
    return;
  }
  var index = -1;
  pendingReferenceList.forEach(function (item, i) { if (item.src === asset.src) index = i; });
  if (index >= 0) pendingReferenceList.splice(index, 1);
  else if (lookReferenceImages(editingLook).length + pendingReferenceList.length >= REFERENCE_LIMIT) {
    ReplicaUI.toast("最多 " + REFERENCE_LIMIT + " 张参考图");
    return;
  } else pendingReferenceList.push({ src: asset.src, name: asset.name });
  renderReferenceLibrary();
  paintPendingReferences();
};
document.getElementById("reference-confirm").onclick = function () {
  if (!pendingReferenceList.length || !editingLook) return;
  var list = lookReferenceImages(editingLook).slice();
  var seen = {};
  var added = 0;
  list.forEach(function (item) { seen[item.src] = true; });
  pendingReferenceList.forEach(function (item) {
    if (seen[item.src] || list.length >= REFERENCE_LIMIT) return;
    seen[item.src] = true;
    list.push(item);
    added += 1;
  });
  editingLook.referenceImages = list;
  editingLook.referenceImage = list.length ? list[0].src : "";
  updateReferenceComposer(editingLook);
  lookDirty = true;
  document.querySelector(".draft-hint").textContent = "存在未保存的草稿修改";
  closeReferenceDialog();
  ReplicaUI.toast(added > 1 ? "已添加 " + added + " 张参考图" : "已添加参考图");
};
document.getElementById("reference-picks").onclick = function (e) {
  var remove = e.target.closest("[data-reference-remove]");
  if (!remove || !editingLook) return;
  var list = lookReferenceImages(editingLook).slice();
  list.splice(Number(remove.dataset.referenceRemove), 1);
  editingLook.referenceImages = list;
  editingLook.referenceImage = list.length ? list[0].src : "";
  updateReferenceComposer(editingLook);
  lookDirty = true;
  document.querySelector(".draft-hint").textContent = "存在未保存的草稿修改";
};
function syncReferenceMode() {
  var current = document.getElementById("use-reference-image").checked;
  if (editingLook) {
    editingLook.referenceMode = current ? "current" : "main";
    editingLook.useReferenceImage = current;
    editingLook.useMainImage = !current;
  }
  lookDirty = true;
  document.querySelector(".draft-hint").textContent = "存在未保存的草稿修改";
}
document.getElementById("use-reference-image").onchange = syncReferenceMode;
document.getElementById("use-main-image").onchange = syncReferenceMode;
document.getElementById("voice-dialog-x").onclick = function () { document.getElementById("voice-cancel").onclick(); };
document.getElementById("voice-cancel").onclick = function () {
  closeVoiceDialog();
  if (!voiceDialogAuto || !voiceBindChar || voiceBindChar.voiceBind) return;
  voicePromptSkipped[voiceBindChar.id] = true;
  ReplicaUI.toast("已跳过，可随时在角色图片右下角绑定音色");
};
document.getElementById("voice-save").onclick = function () {
  var pick = voiceBindPick;
  if (this.disabled || !voiceBindChar || !pick || !voiceHeard[pick.id]) return;
  voiceBindChar.voiceBind = {
    id: pick.id,
    name: pick.name,
    summary: pick.summary,
    source: pick.source,
    pitch: pick.pitch,
    rate: pick.rate,
    sample: pick.sample,
    duration: pick.duration,
    time: pick.time
  };
  voiceBindChar.voiceOn = true;
  var name = voiceBindChar.name;
  closeVoiceDialog();
  refreshVoiceSurfaces();
  ReplicaUI.toast("已为「" + name + "」绑定「" + pick.name + "」");
};
document.getElementById("voice-switch").onclick = function () {
  var char = voiceBindChar;
  if (this.disabled || !char || !char.voiceBind) return;
  char.voiceOn = !charVoiceOn(char);
  if (!char.voiceOn) stopVoicePreview();
  paintVoiceSwitch();
  refreshVoiceSurfaces();
  ReplicaUI.toast(char.voiceOn ? "已开启「" + char.name + "」的音色" : "已关闭「" + char.name + "」的音色，已选音色会保留");
};
document.querySelector(".voice-seg").onclick = function (e) {
  var button = e.target.closest("[data-voice-tab]");
  if (!button) return;
  voiceBindTab = button.dataset.voiceTab;
  renderVoicePanes();
};

function toggleVoicePlay(voice) {
  if (voicePlayingId === voice.id) {
    stopVoicePreview();
  } else {
    playVoiceSample(voice, null);
  }
  renderVoiceList();
  paintVoiceConfirm();
}

function onVoiceListClick(e) {
  var item = e.target.closest("[data-voice-id]");
  if (!item) return;
  var voice = voiceAssetById(item.dataset.voiceId);
  if (!voice) return;
  if (e.target.closest("[data-voice-del]")) {
    if (e.target.closest("[data-voice-del]").disabled) return;
    if (voicePlayingId === voice.id) stopVoicePreview();
    voiceBindChar.voiceAssets = voiceAssetsOf(voiceBindChar).filter(function (entry) { return entry.id !== voice.id; });
    if (voiceBindPick && voiceBindPick.id === voice.id) voiceBindPick = null;
    renderVoiceList();
    paintVoiceConfirm();
    ReplicaUI.toast("已删除「" + voice.name + "」");
    return;
  }
  if (e.target.closest("[data-voice-reuse]")) {
    document.getElementById("voice-desc").value = voice.prompt || "";
    document.getElementById("voice-sample-text").value = voice.sample || "";
    voiceReferenceNames = (voice.references || []).slice();
    paintVoiceDescriptionCount();
    paintVoiceReferenceNames();
    voiceBindTab = "generate";
    renderVoicePanes();
    ReplicaUI.toast("已填入这条音频的生成参数");
    return;
  }
  if (e.target.closest("[data-voice-retry]")) {
    startVoiceGeneration({ prompt: voice.prompt, sample: voice.sample, references: voice.references || [] }, voice);
    return;
  }
  if (voice.status !== "ready") return;
  var isPicked = voiceBindPick && voiceBindPick.id === voice.id;
  if (e.target.closest("[data-voice-play]")) {
    if (!isPicked) voiceBindPick = voice;
    toggleVoicePlay(voice);
    return;
  }
  if (isPicked) return;
  voiceBindPick = voice;
  voiceNewId = "";
  playVoiceSample(voice, null);
  renderVoiceList();
  paintVoiceConfirm();
}
document.getElementById("voice-list").onclick = onVoiceListClick;
document.getElementById("voice-list").onkeydown = function (e) {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-voice-id][role=radio]")) {
    e.preventDefault();
    e.target.click();
  }
};
document.getElementById("voice-desc").oninput = paintVoiceDescriptionCount;
document.getElementById("voice-ref-btn").onclick = function () {
  if (voiceReferenceNames.length < 3) document.getElementById("voice-ref-input").click();
};
document.getElementById("voice-ref-input").onchange = function () {
  var files = Array.prototype.slice.call(this.files || []);
  this.value = "";
  var room = 3 - voiceReferenceNames.length;
  files.slice(0, room).forEach(function (file) { voiceReferenceNames.push(file.name); });
  if (files.length > room) ReplicaUI.toast("参考音频最多 3 条");
  paintVoiceReferenceNames();
};
document.getElementById("voice-ref-chips").onclick = function (e) {
  var remove = e.target.closest("[data-voice-ref-remove]");
  if (!remove) return;
  voiceReferenceNames.splice(Number(remove.dataset.voiceRefRemove), 1);
  paintVoiceReferenceNames();
};

function voiceStamp() {
  var d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

function handleVoiceUpload(file) {
  if (!file || !voiceBindChar) return;
  var jobChar = voiceBindChar;
  if (!/^audio\//.test(file.type) && !/\.(mp3|wav|m4a)$/i.test(file.name)) {
    paintVoiceUploadState("error", "格式不支持", "请上传 MP3、WAV 或 M4A 音频");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    paintVoiceUploadState("error", "文件过大", "请上传 20MB 以内的音频");
    return;
  }
  var token = ++voiceUploadSeq;
  paintVoiceUploadState("loading", "正在上传 " + file.name, "上传中…");
  setTimeout(function () {
    if (token !== voiceUploadSeq) return;
    paintVoiceUploadState("loading", "正在检测人声", "检查时长、噪声和说话人数");
  }, 500);
  setTimeout(function () {
    if (token !== voiceUploadSeq) return;
    if (file.size < 12 * 1024) {
      paintVoiceUploadState("error", "音频太短", "请上传 10 秒以上的清晰人声");
      return;
    }
    if (/噪|嘈杂|noise|吵|bgm|音乐/i.test(file.name)) {
      paintVoiceUploadState("error", "检测不到清晰人声", "背景噪声或音乐过大，请换一段干净录音");
      return;
    }
    if (/多人|对话/i.test(file.name)) {
      paintVoiceUploadState("error", "检测到多人说话", "请只保留一个人的声音");
      return;
    }
    var voice = {
      id: "upload-" + Date.now(),
      source: "upload",
      status: "ready",
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 14) || "上传人声",
      summary: "上传人声",
      time: voiceStamp(),
      duration: Math.max(10, Math.min(60, Math.round(file.size / 32000))),
      pitch: 1,
      rate: 1
    };
    voiceAssetsOf(jobChar).unshift(voice);
    if (voiceBindChar === jobChar && document.getElementById("voice-dialog").classList.contains("open")) {
      voiceBindPick = voice;
      voiceNewId = voice.id;
      paintVoiceUploadState("done", "已添加到音色列表", "试听后即可使用");
      renderVoiceList();
      paintVoiceConfirm();
    }
  }, 1300);
}

document.getElementById("voice-upload-btn").onclick = function () {
  document.getElementById("voice-upload-input").click();
};
document.getElementById("voice-upload-state").onclick = function (e) {
  if (e.target.closest("[data-voice-reupload]")) document.getElementById("voice-upload-input").click();
};
document.getElementById("voice-upload-input").onchange = function () {
  var file = this.files && this.files[0];
  this.value = "";
  handleVoiceUpload(file);
};
(function () {
  var drop = document.getElementById("voice-upload-btn");
  drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("is-over"); });
  drop.addEventListener("dragleave", function () { drop.classList.remove("is-over"); });
  drop.addEventListener("drop", function (e) {
    e.preventDefault();
    drop.classList.remove("is-over");
    handleVoiceUpload(e.dataTransfer.files && e.dataTransfer.files[0]);
  });
})();

function startVoiceGeneration(params, retryOf) {
  if (voiceGenerating || !voiceBindChar) return;
  var jobChar = voiceBindChar;
  var list = voiceAssetsOf(jobChar);
  var voice = retryOf || {
    id: "gen-" + Date.now(),
    source: "generated",
    name: "音色 " + (list.filter(function (entry) { return entry.source !== "upload"; }).length + 1)
  };
  voice.status = "generating";
  voice.prompt = params.prompt;
  voice.sample = params.sample;
  voice.references = params.references;
  voice.error = "";
  if (!retryOf) list.unshift(voice);
  voiceGenerating = true;
  paintVoiceGenerateButton();
  renderVoiceList();
  var token = ++voiceGenerationSeq;
  setTimeout(function () {
    if (token !== voiceGenerationSeq) return;
    voiceGenerating = false;
    var open = document.getElementById("voice-dialog").classList.contains("open") && voiceBindChar === jobChar;
    if (/失败|超时/.test(params.prompt)) {
      voice.status = "failed";
      voice.error = "生成失败，参数已保留，可直接重试";
    } else {
      var female = jobChar.voiceProfile && jobChar.voiceProfile.gender === "女";
      voice.status = "ready";
      voice.summary = params.prompt.split(/[，,。]/).filter(Boolean).slice(0, 2).join("，").slice(0, 20);
      voice.time = voiceStamp();
      voice.duration = Math.max(3, Math.round(params.sample.length / 4.5));
      voice.pitch = female ? 1.12 : 0.9;
      voice.rate = 1;
    }
    if (open) {
      if (voice.status === "ready") {
        voiceBindPick = voice;
        voiceNewId = voice.id;
      }
      paintVoiceGenerateButton();
      renderVoiceList();
      paintVoiceConfirm();
    } else {
      ReplicaUI.toast(voice.status === "ready"
        ? "「" + jobChar.name + "」的音频已生成，打开音色即可试听"
        : "「" + jobChar.name + "」的音频生成失败，可在音色列表重试");
    }
  }, 1400);
}

document.getElementById("voice-gen").onclick = function () {
  if (this.disabled || voiceGenerating) return;
  var desc = document.getElementById("voice-desc").value.trim();
  var sample = document.getElementById("voice-sample-text").value.trim();
  var error = document.getElementById("voice-gen-error");
  if (desc.length < 4) {
    error.hidden = false;
    error.textContent = "请把声音描述写得再具体一点。";
    return;
  }
  if (!sample) {
    error.hidden = false;
    error.textContent = "请填写试听文案。";
    return;
  }
  error.hidden = true;
  startVoiceGeneration({ prompt: desc, sample: sample, references: voiceReferenceNames.slice() }, null);
};
