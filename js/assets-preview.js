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

function previewImageHtml(src, alt) {
  return '<img class="five-view-sheet" src="' + src + '" alt="' + alt + '">' +
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
  var primary = looks[primaryLookIndex(looks)];
  var isPrimary = look === primary;
  var parent = isPrimary ? null : lookParent(looks, look) || primary;
  var ready = lookVisualState(look, looks.indexOf(look)) === "ready";
  name.innerHTML = (ready ? READY_MARK : "") + "<span>" + escapeHtml(lookShortName(look)) + "</span>";
  meta.innerHTML = '<span class="' + (isPrimary ? "is-primary" : "") + '">' + (isPrimary ? "主" : "子") + assetWord() + "</span>" +
    (parent ? "<span>上级：" + escapeHtml(lookShortName(parent)) + "</span>" : "") +
    "<span>" + episodeChip(look.eps).html + "</span>";
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
    ? previewImageHtml(previewRailSrc, currentChar.name + "五视图")
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
    return { id: item.id, src: item.src, label: "V" + item.version, prompt: item.prompt, time: item.time };
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
        '<img src="' + item.src + '" alt="' + item.label + '">' +
        '<span class="preview-history-caption"><b>' + item.label + "</b><small>" + escapeHtml(item.time || "") + "</small>" + escapeHtml(promptText || "暂无提示词") + "</span></button>" +
        '<div class="preview-history-acts">' +
        '<button type="button" data-history-restore="' + item.id + '" aria-label="恢复提示词"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 7.2h6.1a3.1 3.1 0 1 1 0 6.2H7.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5.6 4.8 3.2 7.2l2.4 2.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button type="button" data-history-download="' + item.id + '" aria-label="下载图片"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.8v6.4M5.4 7.2 8 9.8l2.6-2.6M3.4 12.6h9.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button type="button" data-history-delete="' + item.id + '" aria-label="删除记录"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4.6h9.6M6.2 4.6V3.4h3.6v1.2M4.6 4.6l.5 7.4h5.8l.5-7.4M6.8 7v3.2M9.2 7v3.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></article>';
    }
    return '<button type="button" class="preview-side-card' + (item.src === previewRailSrc ? " on" : "") + '" data-preview-src="' + item.src + '">' +
      '<img src="' + item.src + '" alt="' + item.label + '"><span>' + item.label + "</span></button>";
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
  preview.innerHTML = previewImageHtml(item.src, "V" + item.version);
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
  var name = (editingLook ? lookShortName(editingLook) : "历史图片") + "-V" + item.version;
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

function renderVoiceSelection() {
  var value = document.getElementById("f-voice").value.trim();
  document.querySelectorAll("#voice-library-grid [data-voice-value]").forEach(function (button) {
    button.classList.toggle("on", button.dataset.voiceValue === value);
  });
}

function openVoiceDialog() {
  if (!editingLook) { ReplicaUI.toast("请先选择一个形象"); return; }
  voiceBeforeEdit = document.getElementById("f-voice").value;
  document.getElementById("voice-dialog-title").textContent = editingLook.name.replace(currentChar.name + "-", "") + " · 配置音色";
  document.getElementById("voice-current-look").innerHTML = '<img src="' + editingLook.image + '" alt="' + currentChar.name + '">';
  document.getElementById("voice-search").value = "";
  document.querySelectorAll("#voice-library-grid [data-voice-value]").forEach(function (button) { button.hidden = false; });
  renderVoiceSelection();
  document.getElementById("voice-dialog").classList.add("open");
}

function closeVoiceDialog(restore) {
  var dialog = document.getElementById("voice-dialog");
  if (!dialog.classList.contains("open")) return;
  if (restore) document.getElementById("f-voice").value = voiceBeforeEdit;
  dialog.classList.remove("open");
}

function updateReferenceComposer(src) {
  referenceImageValue = src || "";
  var preview = document.getElementById("f-ref");
  preview.innerHTML = src ? '<img src="' + src + '" alt="参考图">' : "＋";
  document.getElementById("pick-asset").classList.toggle("has-image", !!src);
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
  document.getElementById("reference-asset-grid").innerHTML = referenceAssetChoices.map(function (asset, index) {
    return '<button type="button" class="reference-asset-card" data-reference-index="' + index + '">' +
      '<img src="' + asset.src + '" alt=""><span>' + asset.name + "</span></button>";
  }).join("");
}

function openReferenceDialog() {
  pendingReferenceSrc = "";
  document.getElementById("reference-library-panel").hidden = true;
  document.getElementById("reference-confirm").disabled = true;
  document.querySelectorAll(".reference-source-actions > button").forEach(function (button) {
    button.classList.remove("on");
  });
  document.getElementById("reference-dialog").classList.add("open");
}

function closeReferenceDialog() {
  document.getElementById("reference-dialog").classList.remove("open");
}

function showLocalReference(src, name) {
  var panel = document.getElementById("reference-library-panel");
  panel.hidden = false;
  panel.querySelector(".reference-library-head strong").textContent = "本地图片";
  panel.querySelector(".reference-library-head span").textContent = "已选择 1 张图片";
  document.getElementById("reference-asset-grid").innerHTML =
    '<button type="button" class="reference-asset-card on"><img src="' + src + '" alt=""><span>' + escapeHtml(name) + "</span></button>";
  document.getElementById("reference-confirm").disabled = false;
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

document.getElementById("upload-audio").onclick = function () { ReplicaUI.toast("演示：上传参考音频"); };
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
  var reader = new FileReader();
  reader.onerror = function () { ReplicaUI.toast("图片读取失败，请换一张再试"); };
  reader.onload = function () {
    pendingReferenceSrc = String(reader.result || "");
    showLocalReference(pendingReferenceSrc, file.name);
  };
  reader.readAsDataURL(file);
};
document.getElementById("reference-library-source").onclick = function () {
  document.querySelectorAll(".reference-source-actions > button").forEach(function (button) {
    button.classList.toggle("on", button.id === "reference-library-source");
  });
  var panel = document.getElementById("reference-library-panel");
  panel.hidden = false;
  panel.querySelector(".reference-library-head strong").textContent = "资产库";
  panel.querySelector(".reference-library-head span").textContent = "选择一张图片作为参考";
  renderReferenceLibrary();
  pendingReferenceSrc = "";
  document.getElementById("reference-confirm").disabled = true;
};
document.getElementById("reference-asset-grid").onclick = function (e) {
  var card = e.target.closest("[data-reference-index]");
  if (!card) return;
  var asset = referenceAssetChoices[Number(card.dataset.referenceIndex)];
  if (!asset) return;
  pendingReferenceSrc = asset.src;
  this.querySelectorAll(".reference-asset-card").forEach(function (item) {
    item.classList.toggle("on", item === card);
  });
  document.getElementById("reference-confirm").disabled = false;
};
document.getElementById("reference-confirm").onclick = function () {
  if (!pendingReferenceSrc) return;
  updateReferenceComposer(pendingReferenceSrc);
  lookDirty = true;
  closeReferenceDialog();
  ReplicaUI.toast("已添加参考图");
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
document.getElementById("voice-dialog-x").onclick = function () { closeVoiceDialog(true); };
document.getElementById("voice-cancel").onclick = function () { closeVoiceDialog(true); };
document.getElementById("voice-save").onclick = function () {
  if (!editingLook) return;
  editingLook.voice = document.getElementById("f-voice").value.trim();
  closeVoiceDialog(false);
  renderLookLibrary();
  ReplicaUI.toast(editingLook.voice ? "音色已绑定到当前形象" : "已清除当前形象音色");
};
document.getElementById("voice-library-grid").onclick = function (e) {
  var card = e.target.closest("[data-voice-value]");
  if (!card) return;
  document.getElementById("f-voice").value = card.dataset.voiceValue;
  renderVoiceSelection();
};
document.getElementById("voice-search").oninput = function (e) {
  var query = e.target.value.trim().toLowerCase();
  document.querySelectorAll("#voice-library-grid [data-voice-value]").forEach(function (button) {
    button.hidden = query && button.textContent.toLowerCase().indexOf(query) === -1;
  });
};
document.querySelector(".voice-tabs").onclick = function (e) {
  var button = e.target.closest("button");
  if (!button) return;
  document.querySelectorAll(".voice-tabs button").forEach(function (item) { item.classList.toggle("on", item === button); });
};
