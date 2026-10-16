function editorItems() {
  return editorKind === "scene" ? D.scenes : editorKind === "prop" ? D.props : D.characters;
}

function assetWord() {
  return editorKind === "scene" ? "场景" : editorKind === "prop" ? "道具" : "形象";
}

function ensureEditorLooks(item) {
  if (editorKind === "char" || (item.looksList && item.looksList.length)) return;
  var eps = Array.isArray(item.eps) ? item.eps.join(",") : (item.eps || "");
  item.look = item.name;
  item.looksList = [{
    id: item.id + "-main",
    name: item.name,
    eps: eps,
    image: item.image,
    sheet: item.status && item.status !== "pending" ? item.image : "",
    prompt: item.prompt || item.desc || ""
  }];
}

function sheetForLook(look) {
  if (!look) return "";
  if (look.sheet) return look.sheet;
  if (currentChar.sheet && (!currentChar.look || look.name.indexOf(currentChar.look) !== -1)) return currentChar.sheet;
  if (isLookRevealed(currentChar, look)) return look.image || currentChar.image || "";
  return "";
}

function lookVisualState(look, index) {
  if (look && (look.status === "generating" || look.status === "failed" || look.status === "pending")) return look.status;
  if (!isLookRevealed(currentChar, look)) return "pending";
  return sheetForLook(look) ? "ready" : "pending";
}

function lookStateText(state) {
  return state === "pending" ? "待生成"
    : state === "generating" ? "生成中"
    : state === "failed" ? "生成失败"
    : "已完成";
}

function lookStateIcon(state) {
  return state === "ready"
    ? '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 7.1 6.2 8.8 9.6 5.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : state === "failed"
    ? '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 4.1v3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="9.7" r=".7" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M11.3 7.1a4.3 4.3 0 1 1-1.23-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10.1 2.4v2.3H7.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function parseEpisodeNumbers(value) {
  var text = String(value || "").trim();
  var seen = {};
  if (!text || text === "待分配") return [];
  text.split(/[,，、\s]+/).forEach(function (part) {
    if (!part) return;
    var range = part.match(/^(\d+)\s*[-~～—–]\s*(\d+)$/);
    if (range) {
      var start = Number(range[1]);
      var end = Number(range[2]);
      if (start > end) { var swap = start; start = end; end = swap; }
      for (var n = start; n <= end; n++) seen[n] = true;
    } else if (/^\d+$/.test(part)) seen[Number(part)] = true;
  });
  return Object.keys(seen).map(Number).filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
}

function episodeGroups(numbers) {
  var groups = [];
  numbers.forEach(function (n) {
    var last = groups[groups.length - 1];
    if (last && n === last.end + 1) last.end = n;
    else groups.push({ start: n, end: n });
  });
  return groups;
}

function formatEpisodeGroups(groups) {
  return groups.map(function (group) {
    return group.start === group.end ? String(group.start) : group.start + "–" + group.end;
  }).join("、");
}

function serializeEpisodes(numbers) {
  var groups = episodeGroups(numbers);
  if (!groups.length) return "待分配";
  return groups.map(function (group) {
    return group.start === group.end ? String(group.start) : group.start + "-" + group.end;
  }).join(",");
}

function seriesEpisodeTotal(numbers) {
  var base = (D.project && D.project.episodeTotal) || (D.episodes || []).length || 1;
  var highest = numbers.length ? numbers[numbers.length - 1] : 0;
  return Math.max(base, highest);
}

function episodeChip(value) {
  var numbers = parseEpisodeNumbers(value);
  if (!numbers.length) return { title: "待分配", compact: false, html: "待分配" };
  var full = "第" + formatEpisodeGroups(episodeGroups(numbers)) + "集";
  if (full.length <= 16) return { title: "查看出现集数", compact: false, html: full };
  return { title: "查看出现集数", compact: true, html: "共 " + numbers.length + " 集" };
}

function voiceLabel(voice) {
  if (!voice) return "绑定音色";
  var names = [
    ["苍老沙哑", "年老状态"],
    ["含糊拖长", "醉酒状态"],
    ["虚弱低沉", "受伤状态"],
    ["年轻明亮", "青年自然声"],
    ["清冷利落", "清冷女声"],
    ["沉稳低沉", "沉稳男声"]
  ];
  for (var i = 0; i < names.length; i++) {
    if (voice.indexOf(names[i][0]) !== -1) return names[i][1];
  }
  return voice.length > 8 ? voice.slice(0, 8) + "…" : voice;
}

function lookShortName(look) {
  return look.name.replace(currentChar.name + "-", "");
}

function lookParent(looks, look) {
  if (!look || !look.parentId) return null;
  for (var i = 0; i < looks.length; i++) if (looks[i].id === look.parentId) return looks[i];
  return null;
}

function isChildOf(look, parent, primary) {
  if (!parent || look === parent) return false;
  if (look.parentId) return look.parentId === parent.id;
  return parent === primary;
}

function lookCardHtml(look, index, flat) {
  var state = lookVisualState(look, index);
  var shortName = lookShortName(look);
  var chip = episodeChip(look.eps);
  var looks = currentChar.looksList || [];
  var parent = lookParent(looks, look);
  var primary = looks[primaryLookIndex(looks)];
  var isPrimary = primary === look;
  var kindText = isPrimary ? "主" + assetWord() : "子" + assetWord();
  var parentName = !flat || isPrimary ? "" : lookShortName(parent || primary);
  var checked = editorKind === "char" && lookMultiOn && !!selectedLooks[look.id];
  var check = editorKind === "char" && lookMultiOn ? '<span class="asset-check look-pick' + (checked ? " is-on" : "") + '" role="checkbox" aria-checked="' + (checked ? "true" : "false") + '" aria-label="选择形象"></span>' : "";
  return '<article class="look-library-card ' + (editingLook === look ? "on " : "") + state + (checked ? " is-look-picked" : "") +
    '" data-look-index="' + index + '" tabindex="0">' +
    '<div class="look-card-image' + (state !== "ready" ? " is-empty" : "") + '">' +
    (state === "ready"
      ? '<img src="' + look.image + '" alt="' + shortName + '">'
      : state === "generating"
      ? '<span class="look-card-empty is-generating" aria-hidden="true"><i></i><small>' + (look.generationProgress || 8) + "%</small></span>"
      : '<span class="look-card-empty" aria-hidden="true">' + (editorKind === "char" ? EMPTY_PERSON_ICON : EMPTY_IMAGE_ICON) + "</span>") + check +
    (state === "ready" ? "" : '<span class="look-state-tag ' + state + '">' + lookStateIcon(state) + lookStateText(state) + "</span>") +
    (editorKind === "char" && lookMultiOn ? "" : '<button type="button" class="look-card-del" data-del-look="' + look.id + '" title="删除' + assetWord() + '" aria-label="删除' + shortName + '">' + TRASH_ICON + "</button>") +
    "</div>" +
    '<div class="look-card-info"><div class="look-card-copy"><strong>' + (state === "ready" ? READY_MARK : "") + '<span class="look-card-name">' + shortName + "</span></strong>" +
    '<button type="button" class="look-card-eps' + (chip.compact ? " is-compact" : "") + '" data-look-eps="' + index + '" title="' + chip.title + '">' + chip.html + "</button>" +
    '<div class="look-card-meta"><span class="look-kind-tag ' + (isPrimary ? "is-primary" : "is-child") + '">' + kindText + "</span>" +
    (parentName ? '<span class="look-parent-name">' + parentName + "</span>" : "") +
    "</div></div>" +
    '<button type="button" class="look-card-voice' + (look.voice ? " bound" : "") + '" data-look-voice="' + index + '" title="' + (look.voice || "绑定音色") + '" aria-label="' + (look.voice ? "已绑定音色：" + voiceLabel(look.voice) : "未绑定音色") + '">' +
    (look.voice ? VOICE_ON_ICON : VOICE_OFF_ICON) + "</button>" +
    (flat && !(editorKind === "char" && lookMultiOn) ? '<button type="button" class="look-add-child" data-add-child="' + look.id + '" title="新增子' + assetWord() + '" aria-label="新增子' + assetWord() + '">' + PLUS_ICON + "</button>" : "") +
    "</div></article>";
}

function orderedLooks(looks) {
  var acc = [];
  function walk(parentId) {
    looks.forEach(function (look, index) {
      if ((look.parentId || "") === parentId) {
        acc.push({ look: look, index: index });
        walk(look.id);
      }
    });
  }
  walk("");
  if (acc.length !== looks.length) {
    looks.forEach(function (look, index) {
      if (!acc.some(function (item) { return item.look === look; })) acc.push({ look: look, index: index });
    });
  }
  return acc;
}

function renderLookTreeNodes(looks, parent, primary) {
  var html = "";
  looks.forEach(function (look, index) {
    if (!isChildOf(look, parent, primary)) return;
    var childCount = looks.filter(function (item) { return isChildOf(item, look, primary); }).length;
    var open = !!expandedLooks[currentChar.id + ":" + look.id];
    var state = lookVisualState(look, index);
    var chipText = episodeChip(look.eps).html.replace(/<[^>]+>/g, "");
    var thumb = state === "ready"
      ? '<img src="' + look.image + '" alt="">'
      : '<span class="look-tree-avatar' + (state === "generating" ? " is-generating" : "") + '">' + (editorKind === "char" ? EMPTY_PERSON_ICON : EMPTY_IMAGE_ICON) + "</span>";
    var checked = editorKind === "char" && lookMultiOn && !!selectedLooks[look.id];
    var check = editorKind === "char" && lookMultiOn ? '<span class="asset-check look-tree-check look-pick' + (checked ? " is-on" : "") + '" role="checkbox" aria-checked="' + (checked ? "true" : "false") + '" aria-label="选择形象"></span>' : "";
    html += '<div class="look-tree-node">' +
      '<div class="look-tree-row' + (editingLook === look ? " on" : "") + (checked ? " is-look-picked" : "") + '">' +
      (childCount
        ? '<button type="button" class="look-tree-toggle' + (open ? " is-open" : "") + '" data-toggle-look="' + look.id + '" aria-label="展开子' + assetWord() + '">›</button>'
        : '<span class="look-tree-toggle is-leaf"></span>') +
      '<button type="button" class="look-tree-main" data-look-index="' + index + '">' + check + thumb +
      '<span class="look-tree-copy"><strong>' + (state === "ready" ? READY_MARK : "") + '<span class="look-tree-name">' + lookShortName(look) + "</span></strong><small>" +
      '<i class="look-kind-inline">子' + assetWord() + "</i>" +
      (state === "ready" ? "" : '<i class="state ' + state + '">' + lookStateText(state) + "</i>") +
      "<i>" + chipText + "</i>" +
      (childCount ? "<i>" + childCount + " 个子" + assetWord() + "</i>" : "") +
      "</small></span></button>" +
      '<button type="button" class="look-tree-voice' + (look.voice ? " bound" : "") + '" data-look-voice="' + index + '" title="' + (look.voice || "绑定音色") + '"><span>♪</span>' + voiceLabel(look.voice) + "</button>" +
      '<button type="button" class="look-tree-add" data-add-child="' + look.id + '" aria-label="新增子' + assetWord() + '">＋</button>' +
      (editorKind === "char" && lookMultiOn ? "" : '<button type="button" class="look-tree-del" data-del-look="' + look.id + '" title="删除' + assetWord() + '" aria-label="删除' + lookShortName(look) + '">' + TRASH_ICON + "</button>") +
      "</div>" +
      (open && childCount ? '<div class="look-tree-kids">' + renderLookTreeNodes(looks, look, primary) + "</div>" : "") +
      "</div>";
  });
  return html;
}

function primaryLookIndex(looks) {
  var index = looks.findIndex(function (look) {
    return currentChar.look && look.name.indexOf(currentChar.look) !== -1;
  });
  return index < 0 ? 0 : index;
}

function renderLookLibrary() {
  closeEpisodeUi();
  var looks = currentChar.looksList || [];
  document.getElementById("editor-char-name").textContent = currentChar.name;
  document.getElementById("editor-char-desc").textContent = currentChar.desc || "";
  document.getElementById("editor-char-desc").title = currentChar.desc || "";
  document.getElementById("editor-char-avatar").innerHTML = '<img src="' + currentChar.image + '" alt="">';
  document.getElementById("editor-role-switch").setAttribute("aria-label", editorKind === "char" ? "切换当前角色" : "切换当前" + assetWord());
  document.getElementById("editor-role-switch").innerHTML = editorItems().map(function (char) {
    var count = (char.looksList || []).length;
    var countText = editorKind === "char" ? count + "套" : (count > 1 ? count + "个" : "");
    return '<button type="button" data-editor-char="' + char.id + '" class="' + (char.id === currentChar.id ? "on" : "") + '">' +
      '<img src="' + char.image + '" alt=""><span>' + char.name + '</span>' + (countText ? "<small>" + countText + "</small>" : "") + "</button>";
  }).join("");
  requestAnimationFrame(updateRoleSwitchMask);
  document.querySelectorAll("#look-view-switch [data-look-view]").forEach(function (button) {
    button.classList.toggle("on", button.dataset.lookView === lookViewMode);
    button.setAttribute("aria-pressed", button.dataset.lookView === lookViewMode ? "true" : "false");
  });

  var library = document.getElementById("look-library");
  var libraryScroll = library.dataset.char === currentChar.id ? library.scrollTop : 0;
  var primaryIndex = primaryLookIndex(looks);
  var primary = looks[primaryIndex];
  var primaryCard = primary ? lookCardHtml(primary, primaryIndex) : "";
  if (expandedLooks._ready !== currentChar.id) {
    expandedLooks = { _ready: currentChar.id };
    expandedLooks[currentChar.id + ":home"] = true;
  }
  if (lookViewMode === "structure") {
    var childCount = looks.filter(function (look) { return isChildOf(look, primary, primary); }).length;
    library.innerHTML = '<div class="look-structure look-tree">' +
      '<div class="structure-root-look">' + primaryCard + "</div>" +
      (childCount ? '<div class="structure-trunk"></div><div class="look-tree-head"><span>子' + assetWord() + '</span><b>' + childCount + '</b></div><div class="look-tree-children">' + renderLookTreeNodes(looks, primary, primary) + "</div>" : "") +
      '<button type="button" class="structure-add" data-add-child="' + (primary ? primary.id : "") + '">＋ 新增子' + assetWord() + '</button></div>';
  } else {
    library.innerHTML = '<div class="look-flat-grid">' + orderedLooks(looks).map(function (item) {
      return lookCardHtml(item.look, item.index, true);
    }).join("") +
      '<button type="button" class="look-library-card look-add-card" data-new-look="1"><b>＋</b><span>新增' + (editorKind === "char" ? "角色形象" : assetWord()) + '</span></button></div>';
  }
  library.dataset.char = currentChar.id;
  library.scrollTop = libraryScroll;
  syncLookMulti();
}

function pendingLooksOf(item) {
  return (item.looksList || []).filter(function (look, index) {
    var state = item === currentChar ? lookVisualState(look, index) : (isLookRevealed(item, look) ? "ready" : "pending");
    return state === "pending" || state === "failed";
  });
}

function syncLookMulti() {
  var button = document.getElementById("look-multi");
  var bar = document.getElementById("look-multi-bar");
  var show = editorKind === "char";
  button.hidden = !show;
  if (!show) lookMultiOn = false;
  button.classList.toggle("on", lookMultiOn);
  button.setAttribute("aria-pressed", lookMultiOn ? "true" : "false");
  button.title = lookMultiOn ? "取消多选" : "多选未生成形象";
  button.querySelector("span").textContent = lookMultiOn ? "取消多选" : "多选";
  var pending = pendingLooksOf(currentChar);
  var picked = pending.filter(function (look) { return selectedLooks[look.id]; }).length;
  bar.hidden = !lookMultiOn;
  if (bar.hidden) return;
  var allPicked = pending.length > 0 && picked === pending.length;
  var allLooks = currentChar.looksList || [];
  var selectedCount = allLooks.filter(function (look) { return selectedLooks[look.id]; }).length;
  var selectAllLooks = document.getElementById("look-select-all");
  var everyLook = allLooks.length > 0 && selectedCount === allLooks.length;
  selectAllLooks.textContent = everyLook ? "取消" : "全选";
  selectAllLooks.disabled = !allLooks.length;
  var selectRest = document.getElementById("look-select-rest");
  selectRest.textContent = "全选剩余";
  selectRest.disabled = !pending.length;
  var removeLooks = document.getElementById("look-delete");
  removeLooks.disabled = !selectedCount;
  removeLooks.textContent = "删除";
  var gen = document.getElementById("look-gen-selected");
  gen.textContent = "生成所选";
  gen.disabled = !picked;
}

function fillLookForm(look) {
  if (!document.getElementById("look-dialog").classList.contains("open")) {
    lookMultiOn = false;
    selectedLooks = {};
  }
  ensureEditorLooks(currentChar);
  editingLook = look;
  lookDirty = false;
  imageAnalysisSeq++;
  document.getElementById("image-analyze-badge").hidden = true;
  document.getElementById("image-prompt-state").hidden = true;
  document.querySelector(".draft-hint").textContent = "修改会先保存为草稿，不会覆盖原图";
  var parentLook = (currentChar.looksList || []).filter(function (item) { return item.id === newLookParentId; })[0];
  document.getElementById("f-look-name").value = look ? look.name : (parentLook ? parentLook.name : currentChar.name) + "-新" + assetWord();
  document.getElementById("f-look-eps").value = look ? look.eps : "";
  document.getElementById("f-prompt").value = look ? look.prompt : "";
  document.getElementById("f-prompt").placeholder = editorKind === "scene"
    ? "描述时间、空间、光线和氛围"
    : editorKind === "prop"
    ? "描述道具的材质、尺寸和使用状态"
    : "描述服装、发型、体态和情绪，保持五视图一致";
  document.getElementById("use-reference-image").parentElement.querySelector("span").textContent = "参考当前" + assetWord();
  document.getElementById("use-main-image").parentElement.querySelector("span").textContent = "主" + assetWord();
  document.getElementById("look-dialog").classList.toggle("is-asset-other", editorKind !== "char");
  document.getElementById("f-voice").value = look ? (look.voice || currentChar.voice || "") : (currentChar.voice || "");
  updatePromptCount();
  renderLookLibrary();

  renderCurrentLookOutput(look);
  var referenceSrc = look && look.referenceImage ? look.referenceImage : "";
  updateReferenceComposer(referenceSrc);
  var referenceMode = look && (look.referenceMode === "current" || (look.useMainImage === false && look.useReferenceImage)) ? "current" : "main";
  document.getElementById("use-reference-image").checked = referenceMode === "current";
  document.getElementById("use-main-image").checked = referenceMode === "main";
  document.body.classList.add("asset-editor-page-open");
  document.getElementById("look-dialog").classList.add("open");
}

function stashLookDraft() {
  if (!lookDirty || !editingLook) return;
  editingLook.name = document.getElementById("f-look-name").value.trim() || editingLook.name;
  editingLook.eps = document.getElementById("f-look-eps").value.trim() || editingLook.eps;
  editingLook.prompt = document.getElementById("f-prompt").value.trim();
  editingLook.voice = document.getElementById("f-voice").value.trim();
  lookDirty = false;
}

function closeEpisodeDetail() {
  episodePanelIndex = -1;
  var detail = document.getElementById("episode-detail");
  if (detail) detail.hidden = true;
}

function closeEpisodeEditor() {
  var editor = document.getElementById("episode-editor");
  if (editor) editor.hidden = true;
}

function closeEpisodeUi() {
  closeEpisodeEditor();
  closeEpisodeDetail();
}

function positionEpisodeDetail() {
  var button = document.querySelector('#look-library [data-look-eps="' + episodePanelIndex + '"]');
  var detail = document.getElementById("episode-detail");
  if (!button || detail.hidden) return;
  var rect = button.getBoundingClientRect();
  var width = detail.offsetWidth;
  var height = detail.offsetHeight;
  var left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
  var top = rect.bottom + 8;
  if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 8);
  detail.style.left = left + "px";
  detail.style.top = top + "px";
}

function openEpisodeDetail(index) {
  var look = (currentChar.looksList || [])[index];
  if (!look) return;
  closeEpisodeEditor();
  episodePanelIndex = index;
  var numbers = parseEpisodeNumbers(look.eps);
  var total = seriesEpisodeTotal(numbers);
  var detail = document.getElementById("episode-detail");
  detail.dataset.total = String(total);
  detail.hidden = false;
  document.getElementById("episode-detail-title").textContent = look.name.replace(currentChar.name + "-", "");
  document.getElementById("episode-detail-count").textContent = numbers.length
    ? "共 " + numbers.length + " / " + total + " 集"
    : "尚未分配集数";
  document.getElementById("episode-detail-list").textContent = numbers.length
    ? "第" + formatEpisodeGroups(episodeGroups(numbers)) + "集"
    : "还没有分配集数。";
  positionEpisodeDetail();
}

function readEpisodeDraft(text, total) {
  var raw = String(text || "").trim();
  if (!raw || raw === "待分配") return { ok: true, numbers: [] };
  var parts = raw.split(/[,，、\s]+/).filter(Boolean);
  var seen = {};
  for (var i = 0; i < parts.length; i++) {
    var range = parts[i].match(/^(\d+)\s*[-~～—–]\s*(\d+)$/);
    if (range) {
      var start = Number(range[1]);
      var end = Number(range[2]);
      if (start < 1 || end < 1 || start > total || end > total) return { ok: false, message: "集数需在 1–" + total + " 之间" };
      if (start > end) { var swap = start; start = end; end = swap; }
      for (var n = start; n <= end; n++) seen[n] = true;
    } else if (/^\d+$/.test(parts[i])) {
      var episodeNo = Number(parts[i]);
      if (episodeNo < 1 || episodeNo > total) return { ok: false, message: "集数需在 1–" + total + " 之间" };
      seen[episodeNo] = true;
    } else return { ok: false, message: "请使用 1-18,20,22 这种格式" };
  }
  return {
    ok: true,
    numbers: Object.keys(seen).map(Number).sort(function (a, b) { return a - b; })
  };
}

function paintEpisodeEditor() {
  var editor = document.getElementById("episode-editor");
  var total = Number(editor.dataset.total) || 1;
  var selected = {};
  episodeDraftNumbers.forEach(function (n) { selected[n] = true; });
  var status = document.getElementById("episode-editor-status");
  var save = document.getElementById("episode-editor-save");
  status.classList.toggle("is-invalid", !episodeDraftValid);
  status.textContent = episodeDraftValid
    ? "已选择 " + episodeDraftNumbers.length + " / " + total + " 集"
    : status.dataset.message || "请使用 1-18,20,22 这种格式";
  save.disabled = !episodeDraftValid;
  var grid = document.getElementById("episode-editor-grid");
  var scroll = grid.scrollTop;
  var html = "";
  for (var n = 1; n <= total; n++) {
    html += '<button type="button" class="episode-cell' + (selected[n] ? " is-on" : "") + '" data-episode="' + n + '">' + n + "</button>";
  }
  grid.innerHTML = html;
  grid.scrollTop = scroll;
}

function syncEpisodeDraftFromInput() {
  var total = Number(document.getElementById("episode-editor").dataset.total) || 1;
  var result = readEpisodeDraft(document.getElementById("episode-editor-input").value, total);
  episodeDraftValid = result.ok;
  if (result.ok) episodeDraftNumbers = result.numbers;
  document.getElementById("episode-editor-status").dataset.message = result.message || "";
  paintEpisodeEditor();
}

function openEpisodeEditor() {
  var look = (currentChar.looksList || [])[episodePanelIndex];
  if (!look) return;
  var numbers = parseEpisodeNumbers(look.eps);
  var editor = document.getElementById("episode-editor");
  editor.dataset.total = String(seriesEpisodeTotal(numbers));
  document.getElementById("episode-editor-title").textContent = look.name.replace(currentChar.name + "-", "") + " · 编辑集数";
  document.getElementById("episode-editor-input").value = numbers.length ? serializeEpisodes(numbers) : "";
  episodeDraftNumbers = numbers.slice();
  episodeDraftValid = true;
  document.getElementById("episode-detail").hidden = true;
  editor.hidden = false;
  paintEpisodeEditor();
  document.getElementById("episode-editor-input").focus();
}

function cancelEpisodeEditor() {
  closeEpisodeEditor();
  if (episodePanelIndex >= 0) {
    document.getElementById("episode-detail").hidden = false;
    positionEpisodeDetail();
  }
}

function refreshEpisodeChip(index) {
  var look = (currentChar.looksList || [])[index];
  var button = document.querySelector('#look-library [data-look-eps="' + index + '"]');
  if (!look || !button) return;
  var chip = episodeChip(look.eps);
  button.className = "look-card-eps" + (chip.compact ? " is-compact" : "");
  button.title = chip.title;
  button.innerHTML = chip.html;
}

function saveEpisodeEditor() {
  if (!episodeDraftValid) return;
  var look = (currentChar.looksList || [])[episodePanelIndex];
  if (!look) return;
  look.eps = episodeDraftNumbers.length ? serializeEpisodes(episodeDraftNumbers) : "待分配";
  if (editingLook === look) {
    document.getElementById("f-look-eps").value = look.eps === "待分配" ? "" : look.eps;
    lookDirty = true;
  }
  refreshEpisodeChip(episodePanelIndex);
  closeEpisodeUi();
  ReplicaUI.toast("已保存集数");
}

function closeLookDialog() {
  closeEpisodeUi();
  closeReferenceDialog();
  closeVoiceDialog(false);
  closeRewriteDialog(true);
  lookMultiOn = false;
  selectedLooks = {};
  document.body.classList.remove("asset-editor-page-open");
  document.getElementById("look-dialog").classList.remove("open");
}

function confirmDeleteLooks(removing) {
  var looks = currentChar.looksList || [];
  var word = editorKind === "char" ? "形象" : assetWord();
  if (!removing.length) {
    ReplicaUI.toast("请先勾选要删除的" + word);
    return;
  }
  if (removing.length >= looks.length) {
    ReplicaUI.toast("至少保留一个" + word);
    return;
  }
  var ids = removing.map(function (look) { return look.id; });
  var hasKids = looks.some(function (look) { return look.parentId && ids.indexOf(look.parentId) !== -1 && ids.indexOf(look.id) === -1; });
  var generating = removing.some(function (look) { return look.status === "generating"; });
  var owner = currentChar;
  openDangerConfirm(
    removing.length === 1 ? "删除" + word + "「" + lookShortName(removing[0]) + "」？" : "删除选中的 " + removing.length + " 个" + word + "？",
    (generating ? "正在生成的任务会取消并退回积分。" : "") + (hasKids ? "它的下级会挂到上一级。" : "") + "删除后无法恢复。",
    function () {
      if (currentChar !== owner) return;
      deleteLooks(removing.filter(function (look) { return (owner.looksList || []).indexOf(look) !== -1; }));
    }
  );
}

function deleteLooks(removing) {
  var looks = currentChar.looksList || [];
  if (!removing.length || removing.length >= looks.length) return;
  var refund = cancelLookGeneration(removing);
  closeEpisodeUi();
  var removedIds = {};
  removing.forEach(function (look) { removedIds[look.id] = look.parentId || ""; });
  var primaryGone = removing.some(function (look) {
    return currentChar.look && look.name.indexOf(currentChar.look) !== -1;
  });
  currentChar.looksList = looks.filter(function (look) { return !Object.prototype.hasOwnProperty.call(removedIds, look.id); });
  currentChar.looksList.forEach(function (look) {
    if (look.parentId && Object.prototype.hasOwnProperty.call(removedIds, look.parentId)) look.parentId = removedIds[look.parentId] || "";
  });
  if (primaryGone && currentChar.looksList[0]) currentChar.look = lookShortName(currentChar.looksList[0]);
  if (currentChar.looks != null) currentChar.looks = currentChar.looksList.length;
  var editingRemoved = editingLook && Object.prototype.hasOwnProperty.call(removedIds, editingLook.id);
  selectedLooks = {};
  render();
  fillLookForm(editingRemoved ? currentChar.looksList[0] : editingLook);
  deletedToast(removing.length === 1 ? "已删除「" + lookShortName(removing[0]) + "」" : "已删除 " + removing.length + " 个" + (editorKind === "char" ? "形象" : assetWord()), { refund: refund });
}

document.getElementById("look-library").onclick = function (e) {
  var delLook = e.target.closest("[data-del-look]");
  if (delLook) {
    e.stopPropagation();
    var target = (currentChar.looksList || []).filter(function (look) { return look.id === delLook.dataset.delLook; })[0];
    if (target) confirmDeleteLooks([target]);
    return;
  }
  var episodeButton = e.target.closest("[data-look-eps]");
  if (episodeButton) {
    e.stopPropagation();
    var episodeIndex = Number(episodeButton.dataset.lookEps);
    var episodeLook = (currentChar.looksList || [])[episodeIndex];
    if (episodePanelIndex === episodeIndex && !document.getElementById("episode-detail").hidden) {
      closeEpisodeDetail();
      return;
    }
    if (editingLook !== episodeLook) {
      stashLookDraft();
      fillLookForm(episodeLook);
    }
    openEpisodeDetail(episodeIndex);
    return;
  }
  var toggle = e.target.closest("[data-toggle-look]");
  if (toggle) {
    e.stopPropagation();
    var toggleKey = currentChar.id + ":" + toggle.dataset.toggleLook;
    expandedLooks[toggleKey] = !expandedLooks[toggleKey];
    renderLookLibrary();
    return;
  }
  var addChild = e.target.closest("[data-add-child]");
  if (addChild) {
    e.stopPropagation();
    newLookParentId = addChild.dataset.addChild || "";
    if (newLookParentId) expandedLooks[currentChar.id + ":" + newLookParentId] = true;
    openCreateDialog("child");
    return;
  }
  var add = e.target.closest("[data-new-look]");
  if (add) {
    var looksNow = currentChar.looksList || [];
    var primaryNow = looksNow[primaryLookIndex(looksNow)];
    var usesTree = looksNow.some(function (look) { return look.parentId; });
    newLookParentId = usesTree ? ((editingLook && editingLook.id) || (primaryNow && primaryNow.id) || "") : "";
    openCreateDialog("child");
    return;
  }
  var lookPick = e.target.closest(".look-pick");
  if (lookPick) {
    var pickHost = lookPick.closest("[data-look-index]");
    var pickLook = pickHost && (currentChar.looksList || [])[Number(pickHost.dataset.lookIndex)];
    if (pickLook) {
      if (selectedLooks[pickLook.id]) delete selectedLooks[pickLook.id];
      else selectedLooks[pickLook.id] = true;
      renderLookLibrary();
    }
    return;
  }
  var voiceButton = e.target.closest("[data-look-voice]");
  if (voiceButton) {
    newLookParentId = "";
    stashLookDraft();
    fillLookForm((currentChar.looksList || [])[Number(voiceButton.dataset.lookVoice)]);
    openVoiceDialog();
    return;
  }
  var lookCard = e.target.closest("[data-look-index]");
  if (!lookCard) return;
  var pickedLook = (currentChar.looksList || [])[Number(lookCard.dataset.lookIndex)];
  if (lookMultiOn && editorKind === "char" && pickedLook) {
    if (selectedLooks[pickedLook.id]) delete selectedLooks[pickedLook.id];
    else selectedLooks[pickedLook.id] = true;
    renderLookLibrary();
    return;
  }
  newLookParentId = "";
  stashLookDraft();
  fillLookForm(pickedLook);
};

document.getElementById("editor-role-switch").onclick = function (e) {
  var button = e.target.closest("[data-editor-char]");
  if (!button || button.classList.contains("on")) return;
  stashLookDraft();
  selectedLooks = {};
  currentChar = editorItems().find(function (char) { return char.id === button.dataset.editorChar; });
  ensureEditorLooks(currentChar);
  var looks = currentChar.looksList || [];
  var primaryLook = looks.find(function (look) {
    return currentChar.look && look.name.indexOf(currentChar.look) !== -1;
  }) || looks[0] || null;
  fillLookForm(primaryLook);
};

function placeRolePreview(button) {
  var preview = document.getElementById("editor-role-preview");
  var rect = button.getBoundingClientRect();
  var width = preview.offsetWidth || 200;
  preview.style.left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)) + "px";
  preview.style.top = (rect.bottom + 8) + "px";
}
document.getElementById("editor-role-switch").onmouseover = function (e) {
  var button = e.target.closest("[data-editor-char]");
  if (!button) return;
  var char = editorItems().find(function (item) { return item.id === button.dataset.editorChar; });
  if (!char) return;
  var preview = document.getElementById("editor-role-preview");
  var src = char.sheet || char.image;
  preview.innerHTML = '<img src="' + src + '" alt=""><div><strong>' + char.name + '</strong><span>' + (char.desc || "") + "</span></div>";
  preview.classList.add("show");
  var img = preview.querySelector("img");
  var fit = function () {
    if (!img.naturalWidth) return;
    preview.style.setProperty("--preview-ratio", img.naturalWidth + " / " + img.naturalHeight);
    var copy = preview.querySelector("div");
    if (copy) copy.style.width = img.offsetWidth + "px";
    placeRolePreview(button);
  };
  if (img.complete) fit();
  else img.onload = fit;
  placeRolePreview(button);
};
document.getElementById("editor-role-switch").onmouseleave = function () {
  document.getElementById("editor-role-preview").classList.remove("show");
};

function updateRoleSwitchMask() {
  var strip = document.getElementById("editor-role-switch");
  var overflowing = strip.scrollWidth > strip.clientWidth + 2;
  var atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
  strip.classList.toggle("is-overflowing", overflowing);
  strip.classList.toggle("at-end", !overflowing || atEnd);
}
document.getElementById("editor-role-switch").onscroll = updateRoleSwitchMask;
document.getElementById("editor-role-switch").onwheel = function (e) {
  if (this.scrollWidth <= this.clientWidth || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
  e.preventDefault();
  this.scrollLeft += e.deltaY;
};
window.addEventListener("resize", updateRoleSwitchMask);

document.getElementById("look-view-switch").onclick = function (e) {
  var button = e.target.closest("[data-look-view]");
  if (!button) return;
  lookViewMode = button.dataset.lookView;
  renderLookLibrary();
};

document.getElementById("look-dialog-x").onclick = closeLookDialog;
document.getElementById("look-multi").onclick = function () {
  lookMultiOn = !lookMultiOn;
  if (!lookMultiOn) selectedLooks = {};
  renderLookLibrary();
};
document.getElementById("look-select-all").onclick = function () {
  var looks = currentChar.looksList || [];
  var allPicked = looks.length > 0 && looks.every(function (look) { return selectedLooks[look.id]; });
  selectedLooks = {};
  if (!allPicked) looks.forEach(function (look) { selectedLooks[look.id] = true; });
  renderLookLibrary();
};
document.getElementById("look-select-rest").onclick = function () {
  var pending = pendingLooksOf(currentChar);
  var allPicked = pending.length > 0 && pending.every(function (look) { return selectedLooks[look.id]; });
  selectedLooks = {};
  if (!allPicked) pending.forEach(function (look) { selectedLooks[look.id] = true; });
  renderLookLibrary();
};
document.getElementById("look-delete").onclick = function () {
  if (this.disabled) return;
  confirmDeleteLooks((currentChar.looksList || []).filter(function (look) { return selectedLooks[look.id]; }));
};
document.getElementById("look-gen-selected").onclick = function () {
  var targets = (currentChar.looksList || []).filter(function (look) { return selectedLooks[look.id]; });
  var count = startLookGeneration(currentChar, targets);
  if (!count) return;
  selectedLooks = {};
  renderLookLibrary();
};
document.getElementById("look-library").addEventListener("scroll", positionEpisodeDetail);
document.getElementById("episode-detail-close").onclick = closeEpisodeDetail;
document.getElementById("episode-detail-edit").onclick = openEpisodeEditor;
document.getElementById("episode-detail").onclick = function (e) { e.stopPropagation(); };
document.getElementById("episode-editor-x").onclick = cancelEpisodeEditor;
document.getElementById("episode-editor-cancel").onclick = cancelEpisodeEditor;
document.getElementById("episode-editor-save").onclick = saveEpisodeEditor;
document.getElementById("episode-editor-input").oninput = syncEpisodeDraftFromInput;
document.getElementById("episode-editor").onclick = function (e) {
  if (e.target === this) cancelEpisodeEditor();
};
document.getElementById("episode-editor-grid").onclick = function (e) {
  var cell = e.target.closest("[data-episode]");
  if (!cell) return;
  var selected = {};
  episodeDraftNumbers.forEach(function (n) { selected[n] = true; });
  var episodeNo = Number(cell.dataset.episode);
  if (selected[episodeNo]) delete selected[episodeNo];
  else selected[episodeNo] = true;
  episodeDraftNumbers = Object.keys(selected).map(Number).sort(function (a, b) { return a - b; });
  episodeDraftValid = true;
  document.getElementById("episode-editor-input").value = episodeDraftNumbers.length ? serializeEpisodes(episodeDraftNumbers) : "";
  paintEpisodeEditor();
};
document.addEventListener("click", function (e) {
  var detail = document.getElementById("episode-detail");
  if (detail.hidden) return;
  if (e.target.closest("#episode-detail") || e.target.closest("[data-look-eps]") || e.target.closest("#episode-editor")) return;
  closeEpisodeDetail();
});
