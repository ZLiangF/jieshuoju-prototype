var D = ReplicaData;
document.getElementById("credits").textContent = ReplicaUI.credits();
var TRASH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 4.3h10.4M6.3 4.3V2.9h3.4v1.4M4.2 4.3l.6 8.4c.05.6.5 1 1.1 1h4.2c.6 0 1.05-.4 1.1-1l.6-8.4M6.7 7v4.2M9.3 7v4.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var EMPTY_PERSON_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.3" r="3.1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 18.6c0-2.3 2.7-3.9 6-3.9s6 1.6 6 3.9c0 .6-.5 1-1 1H7c-.5 0-1-.4-1-1Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
var EMPTY_IMAGE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9.3" cy="10" r="1.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m5.5 17 4.3-4 3 2.6 2.4-2.1 3.3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var tab = "char";
var editorKind = "char";
var currentChar = D.characters[0];
var editingLook = null;
var lookViewMode = "flat";
var lookMultiOn = false;
var selectedLooks = {};
var previewRailOpen = false;
var previewRailTab = "history";
var previewRailSrc = "";
var historySelectedId = "";
var newLookParentId = "";
var roleCreateMode = "asset";
var roleEpsNumbers = [];
var expandedLooks = {};
var episodePanelIndex = -1;
var episodeDraftNumbers = [];
var episodeDraftValid = true;
var lookDirty = false;
var PROMPT_LIMIT = 2000;
var imageAnalysisSeq = 0;
var lookImageMode = "upload";
var lookGenerationSeq = 0;
var voiceBeforeEdit = "";
var pendingReferenceSrc = "";
var referenceImageValue = "";
var referenceAssetChoices = [];

function listForTab() {
  return tab === "char" ? D.characters : tab === "scene" ? D.scenes : D.props;
}

var query = "";
var episodeFilterNumbers = [];
var multiOn = false;
var selectedAssets = {};
var revealedAssets = {};
var revealedLooks = {};
var FIRST_REVEAL = {
  xiaoming: true, hezhi: true, cuiguihua: true, sucheng: true,
  cemetery: true, meeting: true, banquet: true, rainst: true, xmoffice: true,
  ebike: true, incense: true, phone: true
};

function inEpisode(item) {
  if (!episodeFilterNumbers.length) return true;
  var eps = item.eps || [];
  return episodeFilterNumbers.some(function (n) { return eps.indexOf(n) !== -1; });
}

function rowsOf(kind) {
  var list = kind === "char" ? D.characters : kind === "scene" ? D.scenes : D.props;
  return list.map(function (item, i) { return { kind: kind, item: item, i: i }; })
    .filter(function (row) { return inEpisode(row.item); });
}

function isLookRevealed(item, look) {
  if (!revealedAssets[item.id]) return false;
  if (!look || revealedLooks[item.id + "/" + look.id]) return true;
  if (D.characters.indexOf(item) !== -1) return false;
  return look.status !== "pending";
}

function assetLookStats(a) {
  var looks = a.looksList || [];
  if (!looks.length) return { total: 1, done: revealedAssets[a.id] ? 1 : 0 };
  var done = looks.filter(function (look) { return isLookRevealed(a, look); }).length;
  return { total: looks.length, done: done };
}

function assetState(a) {
  var stats = assetLookStats(a);
  if (!stats.done && a.status === "generating") return "generating";
  if (!stats.done && a.status === "failed") return "failed";
  if (!stats.done) return "pending";
  return stats.done < stats.total ? "partial" : "ready";
}

function renderProgress() {
  var roles = 0, scenes = 0, props = 0;
  rowsOf("char").forEach(function (row) {
    var stats = assetLookStats(row.item);
    roles += stats.total - stats.done;
  });
  rowsOf("scene").forEach(function (row) {
    var stats = assetLookStats(row.item);
    scenes += stats.total - stats.done;
  });
  rowsOf("prop").forEach(function (row) {
    var stats = assetLookStats(row.item);
    props += stats.total - stats.done;
  });
  [["char", roles], ["scene", scenes], ["prop", props]].forEach(function (entry) {
    var el = document.getElementById("pending-" + entry[0]);
    el.hidden = !entry[1];
    el.textContent = entry[1] ? "待 " + entry[1] : "";
    el.parentElement.classList.toggle("is-done", !entry[1]);
  });
}

function renderTabCounts() {
  var chars = rowsOf("char").length;
  var scenes = rowsOf("scene").length;
  var props = rowsOf("prop").length;
  document.getElementById("count-char").textContent = chars;
  document.getElementById("count-scene").textContent = scenes;
  document.getElementById("count-prop").textContent = props;
  document.getElementById("asset-total").textContent = chars + scenes + props;
  renderProgress();
}

function visibleAssets() {
  var q = query.trim().toLowerCase();
  var rows = q ? rowsOf("char").concat(rowsOf("scene"), rowsOf("prop")) : rowsOf(tab);
  if (!q) return rows;
  return rows.filter(function (row) {
    return ((row.item.name || "") + " " + (row.item.desc || "") + " " + (row.item.tag || "")).toLowerCase().indexOf(q) !== -1;
  });
}

function cardHtml(row) {
  var a = row.item;
  var kind = row.kind;
  var state = assetState(a);
  var lookStats = assetLookStats(a);
  var looks = lookStats.total;
  var pending = lookStats.total - lookStats.done;
  var showSheet = kind === "char" && a.sheet && state !== "pending";
  var unit = kind === "char" ? "形象" : kind === "scene" ? "场景" : "道具";
  var lookText = looks > 1
    ? "已生成 " + lookStats.done + "/" + looks + " 个" + unit
    : kind === "scene" ? "共 1 个场景图" : "共 1 个" + unit;
  var generatingLooks = (a.looksList || []).filter(function (look) { return look.status === "generating"; }).length;
  var failedLooks = (a.looksList || []).filter(function (look) { return look.status === "failed" && !isLookRevealed(a, look); }).length;
  if (!(a.looksList || []).length && a.status === "failed") failedLooks = 1;
  var flagText = state === "generating" ? "生成中"
    : generatingLooks ? generatingLooks + "个" + unit + "生成中"
    : failedLooks ? (pending > 1 ? "重试 " + pending + " 个" : "重新生成")
    : state === "partial" ? "补齐 " + pending + " 个"
    : state === "pending" ? "生成"
    : "已完成";
  var flagState = state === "generating" || generatingLooks ? "generating" : failedLooks ? "failed" : state;
  var flagIcon = state === "ready"
    ? '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 7.1 6.2 8.8 9.6 5.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : failedLooks
    ? '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 4.1v3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="9.7" r=".7" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M11.3 7.1a4.3 4.3 0 1 1-1.23-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10.1 2.4v2.3H7.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var mediaClass = "asset-card-media is-" + state + (showSheet ? " is-sheet" : "") + (state === "pending" ? " is-empty" : "");
  var visual = state === "pending"
    ? '<div class="asset-empty-state" aria-label="' + (kind === "char" ? "五视图尚未生成" : kind === "scene" ? "场景图尚未生成" : "道具图尚未生成") + '">' +
      (kind === "char" ? EMPTY_PERSON_ICON : EMPTY_IMAGE_ICON) + "</div>"
    : '<img src="' + (showSheet ? a.sheet : a.image) + '" alt="' + a.name + '">';
  var key = kind + ":" + row.i;
  var picked = multiOn && !!selectedAssets[key];
  var check = multiOn
    ? '<span class="asset-check card-pick' + (picked ? " is-on" : "") + '" role="checkbox" aria-checked="' + (picked ? "true" : "false") + '" aria-label="选择' + (kind === "char" ? "角色" : "资产") + '"></span>'
    : "";
  var delBtn = multiOn ? "" : '<button type="button" class="card-del" data-del-key="' + key + '" title="删除资产" aria-label="删除' + a.name + '">' + TRASH_ICON + "</button>";
  var actionable = pending && !generatingLooks && state !== "generating";
  var flag = actionable && !multiOn
    ? '<button type="button" class="asset-flag is-action ' + flagState + '" data-gen-asset="' + key + '" title="' + (failedLooks ? "重新生成失败内容" : "生成该资产还未完成的内容") + '">' + flagIcon + flagText + "</button>"
    : '<span class="asset-flag ' + flagState + '">' + flagIcon + (multiOn && actionable ? (state === "partial" ? pending + " 个待生成" : "待生成") : flagText) + "</span>";
  return '<article class="char-card asset-card asset-' + kind + " is-" + state + (picked ? " is-picked" : "") + '" data-kind="' + kind + '" data-i="' + row.i + '" data-key="' + key + '">' +
    '<div class="' + mediaClass + '">' + visual + check + delBtn + flag + "</div>" +
    '<div class="asset-card-info"><div class="asset-card-title"><h3>' + a.name +
    (a.tag ? ' <span class="tag">' + a.tag + "</span>" : "") + '</h3><span class="looks">' + lookText + "</span></div>" +
    (a.desc ? "<p>" + a.desc + "</p>" : '<p class="asset-empty-desc">点击卡片直接编辑资产</p>') +
    "</div></article>";
}

function render() {
  var rows = visibleAssets();
  renderTabCounts();
  document.getElementById("grid").innerHTML = rows.length
    ? rows.map(cardHtml).join("")
    : '<p class="asset-none">没有找到相关资产</p>';
  document.getElementById("grid").classList.toggle("is-multiselect", multiOn);
  syncGenButton();
}

function renderPills() {
  document.getElementById("char-pills").innerHTML = D.characters.map(function (c) {
    return '<button type="button" data-id="' + c.id + '" class="' + (c.id === currentChar.id ? "on" : "") + '">' + c.name + "</button>";
  }).join("");
}

function renderBoard() {
  var looks = currentChar.looksList || [];
  document.getElementById("look-name").textContent = currentChar.name;
  document.getElementById("look-desc").textContent = currentChar.desc || "";
  document.getElementById("look-board").innerHTML = looks.map(function (look, i) {
    var imgs = [look.image, look.image, look.image].map(function (src, n) {
      var pos = n === 0 ? "top" : n === 1 ? "center top" : "right top";
      return '<img src="' + src + '" style="object-position:' + pos + '">';
    }).join("");
    return (i ? '<div class="look-line"></div>' : "") +
      '<article class="look-node" data-look="' + i + '"><div class="views">' + imgs + "</div><h4>" + look.name +
      "</h4><div class=\"eps\">出现集数：" + look.eps + '</div><button class="plus" data-add="1">＋</button></article>';
  }).join("");
}

function openStage(char) {
  currentChar = char;
  renderPills();
  renderBoard();
  document.getElementById("look-stage").classList.add("open");
}

function closeStage() {
  document.getElementById("look-stage").classList.remove("open");
}

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
  var parentText = !flat || isPrimary ? "" : "上级：" + lookShortName(parent || primary);
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
    '<button type="button" class="look-card-eps' + (chip.compact ? " is-compact" : "") + '" data-look-eps="' + index + '" title="' + chip.title + '">' + chip.html + "</button>" +
    '<span class="look-kind-tag ' + (isPrimary ? "is-primary" : "is-child") + '">' + kindText + "</span>" +
    '<span class="look-state-tag ' + state + '">' + lookStateIcon(state) + lookStateText(state) + "</span></div>" +
    '<div class="look-card-info"><strong>' + shortName + '</strong>' +
    (parentText ? '<em class="look-card-parent">' + parentText + "</em>" : "") +
    '<button type="button" class="look-card-voice ' + (look.voice ? "bound" : "") + '" data-look-voice="' + index + '" title="' + (look.voice || "绑定音色") + '">' +
    '<span>♪</span>' + voiceLabel(look.voice) + "</button></div></article>";
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
      '<span class="look-tree-copy"><strong>' + lookShortName(look) + '</strong><small>' +
      '<i class="look-kind-inline">子' + assetWord() + '</i><i class="state ' + state + '">' + lookStateText(state) + "</i><i>" + chipText + "</i>" +
      (childCount ? "<i>" + childCount + " 个子" + assetWord() + "</i>" : "") +
      "</small></span></button>" +
      '<button type="button" class="look-tree-voice' + (look.voice ? " bound" : "") + '" data-look-voice="' + index + '" title="' + (look.voice || "绑定音色") + '"><span>♪</span>' + voiceLabel(look.voice) + "</button>" +
      '<button type="button" class="look-tree-add" data-add-child="' + look.id + '" aria-label="新增子' + assetWord() + '">＋</button></div>' +
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

function revealItemLooks(item, filter) {
  var looks = item.looksList || [];
  var count = 0;
  if (!looks.length) {
    if (!revealedAssets[item.id] && (!filter || filter(null))) {
      revealedAssets[item.id] = true;
      count = 1;
    }
    return count;
  }
  looks.forEach(function (look) {
    if (isLookRevealed(item, look)) return;
    if (filter && !filter(look)) return;
    revealedAssets[item.id] = true;
    revealedLooks[item.id + "/" + look.id] = true;
    if (look.status === "pending") delete look.status;
    count++;
  });
  return count;
}

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

function renderCurrentLookOutput(look) {
  var preview = document.getElementById("f-preview");
  var state = look ? lookVisualState(look, (currentChar.looksList || []).indexOf(look)) : "pending";
  var stateBadge = document.getElementById("current-look-state");
  stateBadge.className = "current-look-state " + state;
  stateBadge.textContent = lookStateText(state);

  var hasSheet = !!(look && sheetForLook(look) && state === "ready");
  previewRailSrc = hasSheet ? sheetForLook(look) : "";
  historySelectedId = "";
  preview.innerHTML = hasSheet
    ? '<img class="five-view-sheet" src="' + previewRailSrc + '" alt="' + currentChar.name + '五视图">'
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
  preview.innerHTML = '<img class="five-view-sheet" src="' + item.src + '" alt="V' + item.version + '">';
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

function updatePromptCount() {
  var value = document.getElementById("f-prompt").value;
  document.getElementById("prompt-count").textContent = value.length + " / " + PROMPT_LIMIT;
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
  document.getElementById("voice-current-look").innerHTML = '<img src="' + editingLook.image + '" alt=""><span>' + currentChar.name + "</span>";
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
    '<button type="button" class="reference-asset-card on"><img src="' + src + '" alt=""><span>' + name + "</span></button>";
  document.getElementById("reference-confirm").disabled = false;
}

document.getElementById("grid").onclick = function (e) {
  var pickBox = e.target.closest(".card-pick");
  if (pickBox) {
    var pickCard = pickBox.closest(".char-card");
    var pickKey = pickCard.dataset.key;
    if (selectedAssets[pickKey]) delete selectedAssets[pickKey];
    else selectedAssets[pickKey] = true;
    if (Object.keys(selectedAssets).length) multiOn = true;
    render();
    return;
  }
  var del = e.target.closest("[data-del-key]");
  if (del) {
    openDeleteConfirm(del.dataset.delKey);
    return;
  }
  var gen = e.target.closest("[data-gen-asset]");
  if (gen) {
    var parts = gen.dataset.genAsset.split(":");
    var source = parts[0] === "char" ? D.characters : parts[0] === "scene" ? D.scenes : D.props;
    var item = source[Number(parts[1])];
    var generated = item ? revealItemLooks(item) : 0;
    render();
    if (item && document.getElementById("look-dialog").classList.contains("open") && currentChar === item) fillLookForm(editingLook);
    ReplicaUI.toast(generated ? "已生成「" + item.name + "」的 " + generated + " 项内容" : "这个资产没有待生成内容");
    return;
  }
  var card = e.target.closest(".char-card");
  if (!card) return;
  if (multiOn) {
    var pick = card.dataset.key;
    var on = !selectedAssets[pick];
    if (on) selectedAssets[pick] = true;
    else delete selectedAssets[pick];
    card.classList.toggle("is-picked", on);
    var box = card.querySelector(".asset-check");
    if (box) box.classList.toggle("is-on", on);
    syncGenButton();
    return;
  }
  var kind = card.dataset.kind || tab;
  var source = kind === "char" ? D.characters : kind === "scene" ? D.scenes : D.props;
  var item = source[Number(card.dataset.i)];
  if (kind === "char" || kind === "scene" || kind === "prop") {
    editorKind = kind;
    paintGenControls();
    ensureEditorLooks(item);
    currentChar = item;
    var looks = item.looksList || [];
    var primaryLook = looks.find(function (look) {
      return item.look && look.name.indexOf(item.look) !== -1;
    }) || looks[0] || null;
    fillLookForm(primaryLook);
    return;
  }
};

document.querySelector(".tabs").onclick = function (e) {
  var b = e.target.closest("[data-tab]");
  if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll(".tabs button").forEach(function (x) { x.classList.toggle("on", x === b); });
  render();
};

document.getElementById("char-pills").onclick = function (e) {
  var b = e.target.closest("[data-id]");
  if (!b) return;
  currentChar = D.characters.find(function (c) { return c.id === b.dataset.id; });
  renderPills();
  renderBoard();
};

document.getElementById("look-board").onclick = function (e) {
  if (e.target.closest(".plus") || e.target.closest("[data-add]")) {
    fillLookForm(null);
    return;
  }
  var node = e.target.closest(".look-node");
  if (!node) return;
  fillLookForm(currentChar.looksList[Number(node.dataset.look)]);
};

document.getElementById("look-library").onclick = function (e) {
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

document.getElementById("add-look").onclick = function () { fillLookForm(null); };
document.getElementById("look-back").onclick = closeStage;
document.getElementById("look-close").onclick = closeStage;
document.getElementById("look-dialog-x").onclick = closeLookDialog;
document.getElementById("asset-match").onclick = function () {
  ReplicaUI.toast("官方资产匹配中，完成后可确认");
};
function refreshLookGeneration(item) {
  if (currentChar !== item || !document.getElementById("look-dialog").classList.contains("open")) return;
  renderLookLibrary();
  renderCurrentLookOutput(editingLook);
}

function updateLookGeneration(item, looks, taskId, progress, stage) {
  looks.forEach(function (look) {
    if (look.generationTask !== taskId || look.status !== "generating") return;
    look.generationProgress = progress;
    look.generationStage = stage;
  });
  refreshLookGeneration(item);
}

function finishLookGeneration(item, looks, taskId) {
  var completed = 0;
  looks.forEach(function (look) {
    if (look.generationTask !== taskId || look.status !== "generating") return;
    delete look.status;
    delete look.generationTask;
    delete look.generationProgress;
    delete look.generationStage;
    revealedAssets[item.id] = true;
    revealedLooks[item.id + "/" + look.id] = true;
    recordLookHistory(item, look);
    completed++;
  });
  refreshPendingLooks();
  render();
  refreshLookGeneration(item);
  var unit = D.characters.indexOf(item) !== -1 ? "形象" : D.scenes.indexOf(item) !== -1 ? "场景" : "道具";
  if (completed) ReplicaUI.toast("生成完成 · " + item.name + " " + completed + " 个" + unit);
}

function startLookGeneration(item, looks) {
  var targets = looks.filter(function (look, index) {
    var state = item === currentChar ? lookVisualState(look, (item.looksList || []).indexOf(look)) : (isLookRevealed(item, look) ? "ready" : "pending");
    return state === "pending" || state === "failed";
  });
  if (!targets.length) {
    ReplicaUI.toast("没有待生成的" + (editorKind === "char" ? "形象" : assetWord()));
    return 0;
  }
  var cost = targets.length * 3;
  if (D.credits < cost) {
    ReplicaUI.toast("积分不足，本次生成需要 " + cost + " 积分");
    return 0;
  }
  D.credits -= cost;
  document.getElementById("credits").textContent = ReplicaUI.credits();
  var taskId = ++lookGenerationSeq;
  targets.forEach(function (look) {
    look.status = "generating";
    look.generationTask = taskId;
    look.generationProgress = 8;
    look.generationStage = "任务排队中";
  });
  refreshLookGeneration(item);
  ReplicaUI.toast("已扣除 " + cost + " 积分，任务已提交，可以继续浏览其他资产");
  setTimeout(function () { updateLookGeneration(item, targets, taskId, 36, "正在分析提示词"); }, 900);
  setTimeout(function () { updateLookGeneration(item, targets, taskId, 68, "正在生成图像"); }, 2100);
  setTimeout(function () { updateLookGeneration(item, targets, taskId, 91, "正在优化画面细节"); }, 3500);
  setTimeout(function () { finishLookGeneration(item, targets, taskId); }, 5200);
  return targets.length;
}

document.getElementById("gen-look").onclick = function () {
  if (!document.getElementById("f-prompt").value.trim()) {
    ReplicaUI.toast("请先填写" + (editorKind === "char" ? "形象" : assetWord()) + "提示词");
    return;
  }
  if (!editingLook) {
    ReplicaUI.toast("请先保存新增" + assetWord());
    return;
  }
  editingLook.prompt = document.getElementById("f-prompt").value.trim();
  lookDirty = false;
  document.querySelector(".draft-hint").textContent = "提示词已保存，生成任务在后台进行";
  startLookGeneration(currentChar, [editingLook]);
};
document.getElementById("rewrite").onclick = function () { openRewriteDialog(); };

var REWRITE_COST = 2;
var rewriteBusy = false;
var rewriteSelection = {};
var rewriteModelId = "gllm";
var rewriteModels = [
  { id: "gllm", name: "GLLM 3.5" },
  { id: "gllm-pro", name: "GLLM 3.5 Pro" }
];
var rewritePresets = {
  char: [
    { id: "persona", name: "更符合角色人设", line: "人物气质、年龄和身份更贴合角色设定" },
    { id: "face", name: "五官更精致", line: "五官端正清晰，眼神有神，皮肤质感自然" },
    { id: "costume", name: "服装更符合身份", line: "服饰款式、材质和配色符合人物身份" },
    { id: "unified", name: "整体造型更统一", line: "发型、妆造和服装风格统一" }
  ],
  scene: [
    { id: "space", name: "空间关系更清晰", line: "前后景层次清楚，主体位置明确" },
    { id: "light", name: "光线氛围更统一", line: "光线方向、色调和天气氛围统一" },
    { id: "nopeople", name: "去掉多余人物", line: "画面中不出现人物" },
    { id: "material", name: "材质细节更真实", line: "建筑、地面和物件材质真实" }
  ],
  prop: [
    { id: "material", name: "材质更清楚", line: "材质、颜色和结构清晰" },
    { id: "ratio", name: "比例更准确", line: "尺寸比例准确，轮廓完整" },
    { id: "clean", name: "背景更干净", line: "纯色干净背景，主体突出" },
    { id: "wear", name: "使用痕迹更自然", line: "使用痕迹自然，不过度做旧" }
  ]
};

function currentRewriteModel() {
  return rewriteModels.filter(function (item) { return item.id === rewriteModelId; })[0] || rewriteModels[0];
}

function closeRewriteModelMenu() {
  var menu = document.getElementById("rewrite-model-menu");
  if (!menu) return;
  menu.hidden = true;
  document.getElementById("rewrite-model-trigger").setAttribute("aria-expanded", "false");
}

function paintRewriteModels() {
  var current = currentRewriteModel();
  document.getElementById("rewrite-model-label").textContent = current.name;
  document.getElementById("rewrite-model-menu").innerHTML = rewriteModels.map(function (item) {
    var on = item.id === current.id;
    return '<button type="button" role="option" data-rewrite-model="' + item.id + '"' + (on ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '>' +
      '<span class="rewrite-model-mark" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 1.8 9.15 6.15 13.5 8 9.15 9.85 8 14.2 6.85 9.85 2.5 8 6.85 6.15Z" fill="currentColor"/></svg></span>' +
      '<span class="name">' + item.name + "</span>" +
      '<span class="tick" aria-hidden="true">' + (on ? '<svg viewBox="0 0 16 16"><path d="m3.4 8.2 3 3 6.2-6.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "") + "</span></button>";
  }).join("");
}

function paintRewritePresets() {
  var items = rewritePresets[editorKind] || rewritePresets.char;
  document.getElementById("rewrite-presets").innerHTML = items.map(function (item) {
    return '<button type="button" class="' + (rewriteSelection[item.id] ? "on" : "") + '" data-rewrite-preset="' + item.id + '">' + item.name + "</button>";
  }).join("");
}

function openRewriteDialog() {
  var text = document.getElementById("f-prompt").value.trim();
  if (!text) {
    ReplicaUI.toast("请先填写提示词，再进行改写");
    return;
  }
  rewriteSelection = {};
  rewriteBusy = false;
  document.getElementById("rewrite-free").value = "";
  document.getElementById("rewrite-source").textContent = text;
  document.getElementById("rewrite-cancel").disabled = false;
  var confirm = document.getElementById("rewrite-confirm");
  confirm.disabled = false;
  confirm.innerHTML = "改写 <b>✦ " + REWRITE_COST + "</b>";
  paintRewriteModels();
  closeRewriteModelMenu();
  paintRewritePresets();
  document.getElementById("rewrite-dialog").classList.add("open");
}

function closeRewriteDialog(force) {
  if (rewriteBusy && !force) return;
  closeRewriteModelMenu();
  document.getElementById("rewrite-dialog").classList.remove("open");
}

function applyRewrite() {
  if (rewriteBusy) return;
  var box = document.getElementById("f-prompt");
  var source = box.value.trim();
  if (!source) {
    ReplicaUI.toast("请先填写提示词，再进行改写");
    return;
  }
  if (D.credits < REWRITE_COST) {
    ReplicaUI.toast("积分不足，改写需要 " + REWRITE_COST + " 积分");
    return;
  }
  rewriteBusy = true;
  D.credits -= REWRITE_COST;
  document.getElementById("credits").textContent = ReplicaUI.credits();
  var confirm = document.getElementById("rewrite-confirm");
  var cancel = document.getElementById("rewrite-cancel");
  confirm.disabled = true;
  cancel.disabled = true;
  confirm.textContent = "改写中";
  var items = rewritePresets[editorKind] || rewritePresets.char;
  var lines = items.filter(function (item) { return rewriteSelection[item.id]; }).map(function (item) { return item.line; });
  var free = document.getElementById("rewrite-free").value.trim().replace(/[。；，\s]+$/, "");
  if (free) lines.push(free);
  var base = source.replace(/[。；，\s]+$/, "");
  lines.forEach(function (line) {
    if (base.indexOf(line) === -1) base += "，" + line;
  });
  if (!lines.length && base.indexOf("细节完整、描述具体") === -1) base += "，细节完整、描述具体";
  var next = (base + "。").slice(0, PROMPT_LIMIT);
  var model = currentRewriteModel().name;
  setTimeout(function () {
    if (document.getElementById("f-prompt") === box) {
      box.value = next;
      lookDirty = true;
      document.querySelector(".draft-hint").textContent = "已用 " + model + " 改写提示词";
      updatePromptCount();
    }
    rewriteBusy = false;
    cancel.disabled = false;
    confirm.disabled = false;
    confirm.innerHTML = "改写 <b>✦ " + REWRITE_COST + "</b>";
    document.getElementById("rewrite-dialog").classList.remove("open");
    ReplicaUI.toast("已扣除 " + REWRITE_COST + " 积分，提示词已改写");
  }, 900);
}

document.getElementById("rewrite-model-trigger").onclick = function () {
  if (rewriteBusy) return;
  var menu = document.getElementById("rewrite-model-menu");
  var open = menu.hidden;
  menu.hidden = !open;
  this.setAttribute("aria-expanded", open ? "true" : "false");
};
document.getElementById("rewrite-model-menu").onclick = function (e) {
  var button = e.target.closest("[data-rewrite-model]");
  if (!button || rewriteBusy) return;
  rewriteModelId = button.dataset.rewriteModel;
  paintRewriteModels();
  closeRewriteModelMenu();
};
document.getElementById("rewrite-dialog").addEventListener("click", function (e) {
  if (e.target.closest("#rewrite-model-control")) return;
  closeRewriteModelMenu();
});
document.getElementById("rewrite-presets").onclick = function (e) {
  var button = e.target.closest("[data-rewrite-preset]");
  if (!button || rewriteBusy) return;
  var id = button.dataset.rewritePreset;
  rewriteSelection[id] = !rewriteSelection[id];
  button.classList.toggle("on", rewriteSelection[id]);
};
document.getElementById("rewrite-x").onclick = function () { closeRewriteDialog(); };
document.getElementById("rewrite-cancel").onclick = function () { closeRewriteDialog(); };
document.getElementById("rewrite-confirm").onclick = applyRewrite;

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
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    ReplicaUI.toast("图片不能超过 10MB");
    return;
  }
  var shouldReverse = lookImageMode === "reverse";
  if (shouldReverse) {
    D.credits -= 1;
    document.getElementById("credits").textContent = ReplicaUI.credits();
  }
  var seq = ++imageAnalysisSeq;
  var reader = new FileReader();
  reader.onload = function () {
    if (seq !== imageAnalysisSeq) return;
    var src = String(reader.result || "");
    previewRailSrc = src;
    var preview = document.getElementById("f-preview");
    preview.innerHTML = '<img class="five-view-sheet" src="' + src + '" alt="本地上传图片">';
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
  preview.innerHTML = '<img class="five-view-sheet" src="' + previewRailSrc + '" alt="五视图">';
  renderPreviewRail(editingLook, true);
};
document.getElementById("f-preview").onclick = function (e) {
  var button = e.target.closest("[data-empty-upload]");
  if (!button) return;
  if (button.dataset.emptyUpload === "local") openLookImagePicker("upload");
  else if (button.dataset.emptyUpload === "reverse") openLookImagePicker("reverse");
  else ReplicaUI.toast("演示：从资产库选择形象图");
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
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    ReplicaUI.toast("图片不能超过 10MB");
    return;
  }
  var reader = new FileReader();
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
  var looks = currentChar.looksList || [];
  var removing = looks.filter(function (look) { return selectedLooks[look.id]; });
  if (!removing.length) {
    ReplicaUI.toast("请先勾选要删除的形象");
    return;
  }
  if (removing.length >= looks.length) {
    ReplicaUI.toast("至少保留一个形象");
    return;
  }
  var removedIds = {};
  removing.forEach(function (look) { removedIds[look.id] = look.parentId || ""; });
  currentChar.looksList = looks.filter(function (look) { return !Object.prototype.hasOwnProperty.call(removedIds, look.id); });
  currentChar.looksList.forEach(function (look) {
    if (look.parentId && Object.prototype.hasOwnProperty.call(removedIds, look.parentId)) look.parentId = removedIds[look.parentId] || "";
  });
  if (currentChar.looks != null) currentChar.looks = currentChar.looksList.length;
  var editingRemoved = editingLook && Object.prototype.hasOwnProperty.call(removedIds, editingLook.id);
  selectedLooks = {};
  render();
  fillLookForm(editingRemoved ? currentChar.looksList[0] : editingLook);
  ReplicaUI.toast("已删除 " + removing.length + " 个形象");
};
document.getElementById("look-gen-selected").onclick = function () {
  var targets = (currentChar.looksList || []).filter(function (look) { return selectedLooks[look.id]; });
  var count = startLookGeneration(currentChar, targets);
  if (!count) return;
  selectedLooks = {};
  renderLookLibrary();
};
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
var MODEL_ICON_GPT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round" d="M9.6 3.9a4.1 4.1 0 0 1 6.7 2.4 4.1 4.1 0 0 1 3.4 5.9 4.1 4.1 0 0 1-3.3 6 4.1 4.1 0 0 1-6.8 1.8 4.1 4.1 0 0 1-6.6-2.6 4.1 4.1 0 0 1-3.3-5.7A4.1 4.1 0 0 1 9.6 3.9Zm-2 4.9 4.4-2.5 4.4 2.5v5L12 16.3l-4.4-2.5Z"/></svg>';
var MODEL_ICON_BANANA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M6.4 7.2c-.9 5.9 3 11 8.6 11.3 1.9.1 3.5-.5 4.6-1.5-4.9-.2-8.6-3.9-9-9.2"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M6.4 7.2 10.6 7.8M8.1 7.4 8.6 4.6l1.6.3"/></svg>';
var MODEL_ICON_SEEDREAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="M12 3.5 13.9 10 20.5 12 13.9 14 12 20.5 10.1 14 3.5 12 10.1 10z"/></svg>';
var imageModels = [
  { id: "gpt-25-flare", group: "G", name: "G Image 2.5 Flare", badge: "新", maxRes: "4K", tags: ["快速"], qualities: ["1K", "2K", "4K"], thinking: false, search: false, mark: MODEL_ICON_GPT },
  { id: "gpt-25-sunburst", group: "G", name: "G Image 2.5 Sunburst", badge: "新", maxRes: "4K", tags: ["精修"], qualities: ["1K", "2K", "4K"], thinking: false, search: false, mark: MODEL_ICON_GPT },
  { id: "gpt-2", group: "G", name: "G Image2", badge: "热门", maxRes: "4K", tags: [], qualities: ["1K", "2K", "4K"], thinking: false, search: false, mark: MODEL_ICON_GPT },
  { id: "nano-banana-21", group: "Bimage", name: "Bimage 2.1", badge: "新", maxRes: "4K", tags: [], qualities: ["512P", "1K", "2K", "4K"], thinking: true, search: true, mark: MODEL_ICON_BANANA },
  { id: "banana-2", group: "Bimage", name: "Bimage 2", maxRes: "4K", tags: [], qualities: ["512P", "1K", "2K", "4K"], thinking: true, search: true, mark: MODEL_ICON_BANANA },
  { id: "nano-banana-2-lite", group: "Bimage", name: "Bimage 2 Lite", badge: "新", maxRes: "1K", tags: [], qualities: ["1K"], thinking: false, search: false, mark: MODEL_ICON_BANANA },
  { id: "banana-pro", group: "Bimage", name: "Bimage Pro", maxRes: "4K", tags: [], qualities: ["1K", "2K", "4K"], thinking: true, search: true, mark: MODEL_ICON_BANANA },
  { id: "seedream-5", group: "Seedream", name: "Seedream 5.0 Pro", maxRes: "2K", tags: [], qualities: ["1K", "2K"], thinking: false, search: false, mark: MODEL_ICON_SEEDREAM }
];
var ratioOptions = ["auto", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "5:4", "4:5", "21:9"];
var genChoice = { model: "banana-2", quality: "2K", ratio: "16:9", think: "high", search: "", type: "auto" };
var genTypeAuto = { id: "auto", name: "Auto", desc: "按提示词自动选择出图方式" };
var genTypeFree = { id: "free", name: "自由模式", desc: "完全按提示词出图，不加约束" };
var genTypesByKind = {
  char: [
    { group: "", items: [genTypeAuto] },
    { group: "多视图", items: [
      { id: "sheet", name: "角色五视图", desc: "近景、正面、左右侧面、背面", ratio: "16:9", state: "五视图", prompt: "白底，输出近景、正面、左右侧面与背面五视图。" },
      { id: "three", name: "角色三视图", desc: "正面、侧面、背面全身", ratio: "16:9", state: "三视图", prompt: "白底，输出正面、侧面、背面三视图全身站姿。" }
    ] },
    { group: "人脸", items: [
      { id: "face", name: "人脸特写", desc: "正脸近景，五官清晰", ratio: "1:1", state: "人脸特写", prompt: "正脸近景特写，五官清晰，皮肤质感真实，柔和光线。" },
      { id: "face-fix", name: "人脸优化", desc: "修复崩脸，保持长相一致", ratio: "", state: "人脸优化", prompt: "修复面部细节，五官端正对称，眼睛清晰有神，保持原有长相不变。" }
    ] },
    { group: "", items: [genTypeFree] }
  ],
  scene: [
    { group: "", items: [genTypeAuto] },
    { group: "场景", items: [
      { id: "scene-wide", name: "全景空镜", desc: "完整空间，无人物", ratio: "16:9", state: "全景", prompt: "全景空镜，完整展示空间结构，画面中不出现人物。" },
      { id: "scene-angles", name: "多机位四视角", desc: "同一场景的四个方向", ratio: "16:9", state: "四视角", prompt: "同一场景的正面、左侧、右侧、反打四个机位，布局与陈设保持一致。" },
      { id: "scene-light", name: "日夜光影", desc: "白天、黄昏、夜晚三版", ratio: "16:9", state: "光影版本", prompt: "同一场景的白天、黄昏、夜晚三种光线版本，结构不变。" }
    ] },
    { group: "", items: [genTypeFree] }
  ],
  prop: [
    { group: "", items: [genTypeAuto] },
    { group: "道具", items: [
      { id: "prop-three", name: "道具三视图", desc: "正面、侧面、俯视", ratio: "16:9", state: "三视图", prompt: "纯色背景，输出正面、侧面、俯视三视图。" },
      { id: "prop-detail", name: "细节特写", desc: "材质纹理与磨损痕迹", ratio: "1:1", state: "细节特写", prompt: "微距细节特写，材质纹理清晰，保留使用痕迹。" },
      { id: "prop-white", name: "白底单品", desc: "居中白底，方便抠图", ratio: "1:1", state: "单品图", prompt: "纯白背景，道具居中，光线均匀，无投影干扰。" }
    ] },
    { group: "", items: [genTypeFree] }
  ]
};
function currentGenTypes() {
  return genTypesByKind[editorKind] || genTypesByKind.char;
}
function currentGenType() {
  var all = [];
  currentGenTypes().forEach(function (block) { all = all.concat(block.items); });
  return all.filter(function (item) { return item.id === genChoice.type; })[0] || genTypeAuto;
}

function currentImageModel() {
  return imageModels.filter(function (item) { return item.id === genChoice.model; })[0] || imageModels[0];
}
function ratioGlyph(ratio) {
  if (ratio === "auto") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H6.2A1.2 1.2 0 0 0 5 6.2V9M15 5h2.8A1.2 1.2 0 0 1 19 6.2V9M9 19H6.2A1.2 1.2 0 0 1 5 17.8V15M15 19h2.8a1.2 1.2 0 0 0 1.2-1.2V15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }
  var parts = ratio.split(":");
  var w = Number(parts[0]);
  var h = Number(parts[1]);
  var max = 14;
  var rw = w >= h ? max : Math.max(5, Math.round(max * w / h));
  var rh = h >= w ? max : Math.max(5, Math.round(max * h / w));
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="' + ((24 - rw) / 2) + '" y="' + ((24 - rh) / 2) + '" width="' + rw + '" height="' + rh + '" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
}
function placeGenPanel(panel, anchor) {
  var rect = anchor.getBoundingClientRect();
  panel.hidden = false;
  var width = panel.offsetWidth;
  var height = panel.offsetHeight;
  var left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
  var top = rect.top - height - 8;
  if (top < 12) top = rect.bottom + 8;
  panel.style.left = left + "px";
  panel.style.top = top + "px";
}
function closeGenPanels() {
  document.getElementById("model-menu").hidden = true;
  document.getElementById("ratio-popover").hidden = true;
  document.getElementById("type-menu").hidden = true;
  document.getElementById("model-trigger").setAttribute("aria-expanded", "false");
  document.getElementById("ratio-trigger").setAttribute("aria-expanded", "false");
  document.getElementById("type-trigger").setAttribute("aria-expanded", "false");
}
function paintGenControls() {
  var model = currentImageModel();
  if (model.qualities.indexOf(genChoice.quality) === -1) genChoice.quality = model.qualities[model.qualities.length - 1];
  document.getElementById("model-mark").innerHTML = model.mark;
  document.getElementById("model-label").textContent = model.name;
  document.getElementById("ratio-label").textContent = (genChoice.ratio === "auto" ? "自适应" : genChoice.ratio) + " · " + genChoice.quality;
  var type = currentGenType();
  genChoice.type = type.id;
  document.getElementById("type-label").textContent = type.name;
  document.getElementById("gen-look").setAttribute("aria-label", "生成" + (type.state || (editorKind === "char" ? "形象" : assetWord())));
  document.getElementById("type-menu").innerHTML = currentGenTypes().map(function (block, index) {
    var head = block.group ? '<div class="gen-type-group">' + block.group + "</div>" : (index ? '<div class="gen-type-sep" role="separator"></div>' : "");
    return head + block.items.map(function (item) {
      return '<button type="button" role="option" data-gen-type="' + item.id + '"' + (item.id === type.id ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '>' +
        '<span class="gen-type-text"><b>' + item.name + '</b><small>' + item.desc + '</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
    }).join("");
  }).join("");
  var lastGroup = "";
  document.getElementById("model-menu").innerHTML = imageModels.map(function (item) {
    var head = item.group !== lastGroup ? '<div class="model-group">' + item.group + "</div>" : "";
    lastGroup = item.group;
    var badge = item.badge ? '<em class="model-badge' + (item.badge === "热门" ? " hot" : "") + '">' + item.badge + "</em>" : "";
    var meta = [item.maxRes].concat(item.tags).join(" · ");
    return head + '<button type="button" role="option" data-model="' + item.id + '"' + (item.id === model.id ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '>' +
      '<span class="gen-model-mark">' + item.mark + "</span>" +
      '<span class="model-name">' + item.name + "</span>" + badge +
      '<span class="model-meta">' + meta + "</span>" +
      '<span class="tick" aria-hidden="true">' + (item.id === model.id ? '<svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : "") + "</span></button>";
  }).join("");
  document.getElementById("quality-row").innerHTML = ["512P", "1K", "2K", "4K"].map(function (quality) {
    var enabled = model.qualities.indexOf(quality) !== -1;
    return '<button type="button" data-quality="' + quality + '"' + (quality === genChoice.quality ? ' class="on"' : '') + (enabled ? '' : ' disabled') + '>' + quality + '</button>';
  }).join("");
  document.getElementById("ratio-grid").innerHTML = ratioOptions.map(function (ratio) {
    var label = ratio === "auto" ? "自适应" : ratio;
    return '<button type="button" data-ratio="' + ratio + '"' + (ratio === genChoice.ratio ? ' class="on"' : '') + '>' + ratioGlyph(ratio) + '<span>' + label + '</span></button>';
  }).join("");
  document.getElementById("think-block").hidden = !model.thinking;
  document.getElementById("search-block").hidden = !model.search;
  document.querySelectorAll("[data-think]").forEach(function (button) {
    button.classList.toggle("on", button.dataset.think === genChoice.think);
  });
  document.querySelectorAll("[data-search]").forEach(function (button) {
    button.classList.toggle("on", button.dataset.search === genChoice.search);
  });
}
paintGenControls();
document.getElementById("model-trigger").onclick = function (e) {
  e.stopPropagation();
  var menu = document.getElementById("model-menu");
  var open = menu.hidden;
  closeGenPanels();
  if (!open) return;
  placeGenPanel(menu, this);
  this.setAttribute("aria-expanded", "true");
};
document.getElementById("ratio-trigger").onclick = function (e) {
  e.stopPropagation();
  var pop = document.getElementById("ratio-popover");
  var open = pop.hidden;
  closeGenPanels();
  if (!open) return;
  placeGenPanel(pop, this);
  this.setAttribute("aria-expanded", "true");
};
document.getElementById("type-trigger").onclick = function (e) {
  e.stopPropagation();
  var menu = document.getElementById("type-menu");
  var open = menu.hidden;
  closeGenPanels();
  if (!open) return;
  placeGenPanel(menu, this);
  this.setAttribute("aria-expanded", "true");
};
document.getElementById("type-menu").onclick = function (e) {
  var button = e.target.closest("[data-gen-type]");
  if (!button) return;
  genChoice.type = button.dataset.genType;
  var picked = currentGenType();
  if (picked.ratio && picked.ratio !== genChoice.ratio) {
    genChoice.ratio = picked.ratio;
    ReplicaUI.toast("已切换为「" + picked.name + "」，比例调整为 " + picked.ratio);
  }
  paintGenControls();
  closeGenPanels();
};
document.getElementById("model-menu").onclick = function (e) {
  var button = e.target.closest("[data-model]");
  if (!button) return;
  genChoice.model = button.dataset.model;
  paintGenControls();
  closeGenPanels();
};
document.getElementById("ratio-popover").onclick = function (e) {
  var quality = e.target.closest("[data-quality]");
  var ratio = e.target.closest("[data-ratio]");
  var think = e.target.closest("[data-think]");
  var search = e.target.closest("[data-search]");
  if (quality && !quality.disabled) genChoice.quality = quality.dataset.quality;
  if (ratio) genChoice.ratio = ratio.dataset.ratio;
  if (think) genChoice.think = think.dataset.think;
  if (search) genChoice.search = genChoice.search === search.dataset.search ? "" : search.dataset.search;
  paintGenControls();
  if (!document.getElementById("ratio-popover").hidden) placeGenPanel(document.getElementById("ratio-popover"), document.getElementById("ratio-trigger"));
};
document.addEventListener("click", function (e) {
  if (e.target.closest("#model-menu") || e.target.closest("#ratio-popover") || e.target.closest("#type-menu") || e.target.closest("#model-trigger") || e.target.closest("#ratio-trigger") || e.target.closest("#type-trigger")) return;
  closeGenPanels();
});

document.getElementById("composer-collapse").onclick = function () {
  var composer = document.getElementById("prompt-composer");
  composer.classList.toggle("collapsed");
  this.setAttribute("aria-label", composer.classList.contains("collapsed") ? "展开提示词" : "收起提示词");
};
["f-look-name", "f-look-eps", "f-prompt"].forEach(function (id) {
  document.getElementById(id).oninput = function () {
    lookDirty = true;
    document.querySelector(".draft-hint").textContent = "存在未保存的草稿修改";
    if (id === "f-prompt") updatePromptCount();
  };
});

function createKind() {
  return roleCreateMode === "child" ? editorKind : tab;
}

function createWord() {
  var kind = createKind();
  return kind === "scene" ? "场景" : kind === "prop" ? "道具" : "角色";
}

function placeholderPortrait(label) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#241c30"/><text x="50%" y="52%" fill="#eadcff" font-size="28" text-anchor="middle" font-family="sans-serif">' + label + "</text></svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function paintRoleEps() {
  var total = (D.episodes || []).length || 15;
  var selected = {};
  roleEpsNumbers.forEach(function (n) { selected[n] = true; });
  document.getElementById("role-eps-grid").innerHTML = Array.apply(null, Array(total)).map(function (_, index) {
    var n = index + 1;
    return '<button type="button" class="episode-cell' + (selected[n] ? " is-on" : "") + '" data-role-episode="' + n + '">' + n + "</button>";
  }).join("");
}

function syncRoleEpsFromInput() {
  var input = document.getElementById("role-eps");
  roleEpsNumbers = parseEpisodeNumbers(input.value);
  var formatted = roleEpsNumbers.length ? serializeEpisodes(roleEpsNumbers) : "";
  if (input.value.trim() && formatted && input.value.replace(/\s/g, "") !== formatted.replace(/\s/g, "")) {
    /* keep what the user is typing until it is a clean list */
  }
  paintRoleEps();
}

function openCreateDialog(mode) {
  roleCreateMode = mode || "asset";
  var child = roleCreateMode === "child";
  var kind = createKind();
  var word = createWord();
  document.getElementById("role-title").textContent = child ? "新增子" + word : "新增" + word;
  document.getElementById("role-name").value = "";
  document.getElementById("role-name").placeholder = "请输入" + (child ? "子" : "") + word + "名称";
  document.getElementById("role-desc").value = "";
  document.getElementById("role-desc-wrap").hidden = child || kind !== "char";
  document.getElementById("role-voice").value = "";
  document.getElementById("role-voice-wrap").hidden = kind !== "char";
  roleEpsNumbers = [];
  document.getElementById("role-eps").value = "";
  paintRoleEps();
  document.getElementById("role-dialog").classList.add("open");
}

document.getElementById("add").onclick = function () { openCreateDialog("asset"); };
function closeRole() { document.getElementById("role-dialog").classList.remove("open"); }
document.getElementById("role-x").onclick = closeRole;
document.getElementById("role-cancel").onclick = closeRole;
document.getElementById("role-eps").oninput = syncRoleEpsFromInput;
document.getElementById("role-eps-grid").onclick = function (e) {
  var cell = e.target.closest("[data-role-episode]");
  if (!cell) return;
  var selected = {};
  roleEpsNumbers.forEach(function (n) { selected[n] = true; });
  var n = Number(cell.dataset.roleEpisode);
  if (selected[n]) delete selected[n];
  else selected[n] = true;
  roleEpsNumbers = Object.keys(selected).map(Number).sort(function (a, b) { return a - b; });
  document.getElementById("role-eps").value = roleEpsNumbers.length ? serializeEpisodes(roleEpsNumbers) : "";
  paintRoleEps();
};
document.getElementById("role-save").onclick = function () {
  var name = document.getElementById("role-name").value.trim();
  var word = createWord();
  if (!name) { ReplicaUI.toast("请填写" + word + "名称"); return; }
  var epsText = roleEpsNumbers.length ? serializeEpisodes(roleEpsNumbers) : "待分配";
  var voice = document.getElementById("role-voice").value.trim();
  var kind = createKind();
  if (roleCreateMode === "child") {
    if (!currentChar.looksList) currentChar.looksList = [];
    var look = {
      id: "new-" + Date.now(),
      name: name,
      eps: epsText,
      voice: kind === "char" ? voice : "",
      image: currentChar.image || placeholderPortrait(name),
      prompt: "",
      status: "pending"
    };
    if (newLookParentId) look.parentId = newLookParentId;
    currentChar.looksList.push(look);
    currentChar.looks = currentChar.looksList.length;
    if (newLookParentId) expandedLooks[currentChar.id + ":" + newLookParentId] = true;
    closeRole();
    render();
    fillLookForm(look);
    ReplicaUI.toast("已新增子" + word);
    return;
  }
  var portrait = placeholderPortrait(name);
  var item = {
    id: kind + "-" + Date.now(),
    name: name,
    desc: document.getElementById("role-desc").value.trim(),
    voice: kind === "char" ? voice : "",
    status: "pending",
    eps: roleEpsNumbers.slice(),
    image: portrait,
    look: name,
    looks: 1,
    looksList: [{
      id: "main-" + Date.now(),
      name: name,
      eps: epsText,
      voice: kind === "char" ? voice : "",
      image: portrait,
      prompt: document.getElementById("role-desc").value.trim()
    }]
  };
  var list = kind === "scene" ? D.scenes : kind === "prop" ? D.props : D.characters;
  list.push(item);
  closeRole();
  if (tab !== kind) {
    tab = kind;
    document.querySelectorAll(".tabs button").forEach(function (button) {
      button.classList.toggle("on", button.dataset.tab === kind);
    });
  }
  render();
  ReplicaUI.toast("已新增" + word);
};

function closePlain() { document.getElementById("plain-dialog").classList.remove("open"); }
document.getElementById("plain-x").onclick = closePlain;
document.getElementById("plain-cancel").onclick = closePlain;
document.getElementById("plain-save").onclick = function () { closePlain(); ReplicaUI.toast("已保存"); };
document.getElementById("plain-gen").onclick = function () { ReplicaUI.toast("演示：开始生成"); };

function episodeFilterLabel() {
  if (!episodeFilterNumbers.length) return "全部集数";
  if (episodeFilterNumbers.length === 1) return "第" + episodeFilterNumbers[0] + "集";
  var compact = episodeFilterNumbers.join("、");
  if (compact.length <= 7) return "第" + compact + "集";
  return "已选 " + episodeFilterNumbers.length + " 集";
}

function paintEpisodeFilter() {
  var selected = {};
  episodeFilterNumbers.forEach(function (n) { selected[n] = true; });
  var allOn = !episodeFilterNumbers.length;
  document.getElementById("episode-filter-label").textContent = episodeFilterLabel();
  document.getElementById("episode-filter-menu").innerHTML =
    '<button type="button" data-episode-all="1"' + (allOn ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '><span class="box"></span>全部集数</button>' +
    D.episodes.map(function (ep) {
      var on = !!selected[ep.no];
      return '<button type="button" data-episode-no="' + ep.no + '"' + (on ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + '><span class="box"></span>第' + ep.no + "集</button>";
    }).join("");
}

function closeEpisodeFilter() {
  var menu = document.getElementById("episode-filter-menu");
  menu.hidden = true;
  document.getElementById("episode-filter-trigger").setAttribute("aria-expanded", "false");
}

paintEpisodeFilter();
document.getElementById("episode-filter-trigger").onclick = function (e) {
  e.stopPropagation();
  var menu = document.getElementById("episode-filter-menu");
  var open = menu.hidden;
  menu.hidden = !open;
  this.setAttribute("aria-expanded", open ? "true" : "false");
};
document.getElementById("episode-filter-menu").onclick = function (e) {
  e.stopPropagation();
  var all = e.target.closest("[data-episode-all]");
  var item = e.target.closest("[data-episode-no]");
  if (all) episodeFilterNumbers = [];
  if (item) {
    var n = Number(item.dataset.episodeNo);
    var selected = {};
    episodeFilterNumbers.forEach(function (value) { selected[value] = true; });
    if (selected[n]) delete selected[n];
    else selected[n] = true;
    episodeFilterNumbers = Object.keys(selected).map(Number).sort(function (a, b) { return a - b; });
  }
  if (!all && !item) return;
  paintEpisodeFilter();
  render();
};
document.addEventListener("click", function (e) {
  if (e.target.closest("#episode-filter")) return;
  closeEpisodeFilter();
});
document.getElementById("asset-search").oninput = function (e) {
  query = e.target.value;
  render();
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

document.getElementById("upload-asset").onclick = function () { ReplicaUI.toast("演示：上传资产"); };

function lookHasImage(item, look) {
  if (!look) return !!(item.sheet || item.image);
  if (look.sheet) return true;
  if (item.sheet && (!item.look || (look.name || "").indexOf(item.look) !== -1)) return true;
  return false;
}

function eachAssetImage(fn) {
  [
    ["char", D.characters],
    ["scene", D.scenes],
    ["prop", D.props]
  ].forEach(function (pair) {
    pair[1].forEach(function (item, index) {
      if (item.looksList && item.looksList.length) {
        item.looksList.forEach(function (look) {
          fn({ kind: pair[0], item: item, index: index, look: look });
        });
      } else {
        fn({ kind: pair[0], item: item, index: index, look: null });
      }
    });
  });
}

function entryState(entry) {
  return isLookRevealed(entry.item, entry.look) ? "ready" : "pending";
}

function generationTargets(mode) {
  var targets = [];
  eachAssetImage(function (entry) {
    if (mode === "selected" && !selectedAssets[entry.kind + ":" + entry.index]) return;
    if (mode === "tab" && (entry.kind !== tab || !inEpisode(entry.item))) return;
    var state = entryState(entry);
    if (state === "pending" || state === "failed") targets.push(entry);
  });
  return targets;
}

function assetImageStats(kind, filtered) {
  var generated = 0;
  var remaining = 0;
  eachAssetImage(function (entry) {
    if (kind && entry.kind !== kind) return;
    if (filtered && !inEpisode(entry.item)) return;
    var state = entryState(entry);
    if (state === "pending" || state === "failed") remaining++;
    else if (state !== "generating") generated++;
  });
  return { generated: generated, remaining: remaining };
}

function refreshPendingLooks() {
  D.characters.forEach(function (item) {
    if (item.status !== "partial" || !item.looksList) return;
    item.pendingLooks = item.looksList.filter(function (look) {
      return entryState({ item: item, look: look }) === "pending";
    }).length;
  });
}

function submitGeneration(mode) {
  var onlyFirst = (mode === "all" || mode === "tab") && !assetImageStats().generated;
  var ids = {};
  eachAssetImage(function (entry) {
    if (entryState(entry) === "ready") return;
    if (mode === "selected" && !selectedAssets[entry.kind + ":" + entry.index]) return;
    if (mode === "tab" && (entry.kind !== tab || !inEpisode(entry.item))) return;
    if (onlyFirst && !FIRST_REVEAL[entry.item.id]) return;
    if (onlyFirst && entry.look && entry.item.looksList.length > 1 && !lookHasImage(entry.item, entry.look)) return;
    revealedAssets[entry.item.id] = true;
    if (entry.look) {
      revealedLooks[entry.item.id + "/" + entry.look.id] = true;
      if (entry.look.status === "pending") delete entry.look.status;
    }
    ids[entry.item.id] = true;
  });
  render();
  return Object.keys(ids).length;
}

function syncGenButton() {
  var button = document.getElementById("gen-all");
  var multi = document.getElementById("asset-multi");
  var picked = document.getElementById("asset-picked");
  var stats = assetImageStats();
  var count = Object.keys(selectedAssets).length;
  var visibleCards = [].slice.call(document.querySelectorAll("#grid .char-card"));
  var allVisiblePicked = visibleCards.length > 0 && visibleCards.every(function (card) { return selectedAssets[card.dataset.key]; });
  multi.textContent = multiOn ? "取消" : "多选";
  multi.classList.toggle("on", multiOn);
  multi.setAttribute("aria-pressed", multiOn ? "true" : "false");
  multi.title = multiOn ? "取消多选，回到当前状态" : "勾选资产后单独生成";
  picked.hidden = !multiOn || !count;
  picked.textContent = "已选 " + count;
  var selectAll = document.getElementById("asset-select-all");
  selectAll.hidden = !multiOn || !visibleCards.length;
  selectAll.textContent = allVisiblePicked ? "取消全选" : "全选";
  var removeAssets = document.getElementById("asset-delete");
  removeAssets.hidden = !multiOn;
  removeAssets.disabled = !count;
  removeAssets.textContent = count ? "删除 " + count : "删除";
  button.classList.remove("is-complete");
  if (multiOn) {
    var assets = {};
    generationTargets("selected").forEach(function (entry) { assets[entry.kind + ":" + entry.index] = true; });
    var assetCount = Object.keys(assets).length;
    button.textContent = assetCount ? "生成所选 " + assetCount : "生成所选";
    button.disabled = !assetCount;
    button.title = assetCount ? "只生成勾选里还未完成的资产" : "请勾选待生成或生成失败的资产";
    return;
  }
  if (!stats.remaining) {
    button.textContent = "全量资产已完成";
    button.disabled = true;
    button.classList.add("is-complete");
    button.title = "角色、场景和道具均已完成";
  } else if (stats.generated) {
    button.textContent = "生成剩余资产";
    button.disabled = false;
    button.title = "生成剩余的 " + stats.remaining + " 项资产";
  } else {
    button.textContent = "全量生成";
    button.disabled = false;
    button.title = "生成角色、场景和道具的全部待办";
  }
}

function setMultiSelect(on) {
  multiOn = !!on;
  if (!multiOn) selectedAssets = {};
  render();
}

document.getElementById("asset-multi").onclick = function () {
  setMultiSelect(!multiOn);
};
function deleteSelectedAssets() {
  return deleteAssets(Object.keys(selectedAssets));
}
function deleteAssets(keys) {
  var groups = { char: [], scene: [], prop: [] };
  keys.forEach(function (key) {
    var parts = key.split(":");
    if (groups[parts[0]]) groups[parts[0]].push(Number(parts[1]));
  });
  var removed = 0;
  var removedCurrent = false;
  ["char", "scene", "prop"].forEach(function (kind) {
    var list = kind === "char" ? D.characters : kind === "scene" ? D.scenes : D.props;
    groups[kind].sort(function (a, b) { return b - a; }).forEach(function (index) {
      if (!list[index]) return;
      if (list[index] === currentChar) removedCurrent = true;
      list.splice(index, 1);
      removed++;
    });
  });
  selectedAssets = {};
  if (removedCurrent && document.getElementById("look-dialog").classList.contains("open")) closeLookDialog();
  var fallback = tab === "scene" ? D.scenes[0] : tab === "prop" ? D.props[0] : D.characters[0];
  if (!currentChar || D.characters.indexOf(currentChar) + D.scenes.indexOf(currentChar) + D.props.indexOf(currentChar) === -3) {
    currentChar = fallback || D.characters[0] || D.scenes[0] || D.props[0];
  }
  render();
  return removed;
}

var pendingDeleteKey = null;
function assetByKey(key) {
  var parts = key.split(":");
  var list = parts[0] === "char" ? D.characters : parts[0] === "scene" ? D.scenes : D.props;
  return list[Number(parts[1])] || null;
}
function openDeleteConfirm(key) {
  var item = assetByKey(key);
  if (!item) return;
  var kind = key.split(":")[0];
  var unit = kind === "char" ? "角色" : kind === "scene" ? "场景" : "道具";
  var looks = (item.looksList || []).length;
  var sub = kind === "char" ? "形象" : kind === "scene" ? "子场景" : "子道具";
  pendingDeleteKey = key;
  document.getElementById("asset-delete-title").textContent = "删除" + unit + "「" + item.name + "」？";
  document.getElementById("asset-delete-desc").textContent =
    (looks > 1 ? "它的 " + looks + " 个" + sub + "会一起删除，" : "") + "分镜里对它的引用会失效，删除后无法恢复。";
  document.getElementById("asset-delete-dialog").classList.add("open");
  document.getElementById("asset-delete-ok").focus();
}
function closeDeleteConfirm() {
  pendingDeleteKey = null;
  document.getElementById("asset-delete-dialog").classList.remove("open");
}
document.getElementById("asset-delete-cancel").onclick = closeDeleteConfirm;
document.getElementById("asset-delete-dialog").onclick = function (e) {
  if (e.target === this) closeDeleteConfirm();
};
document.getElementById("asset-delete-ok").onclick = function () {
  var key = pendingDeleteKey;
  var item = key && assetByKey(key);
  closeDeleteConfirm();
  if (!item) return;
  deleteAssets([key]);
  ReplicaUI.toast("已删除「" + item.name + "」");
};

document.getElementById("asset-delete").onclick = function () {
  if (this.disabled) return;
  var count = deleteSelectedAssets();
  ReplicaUI.toast(count ? "已删除 " + count + " 个资产" : "请先勾选要删除的资产");
};
document.getElementById("asset-select-all").onclick = function () {
  var cards = [].slice.call(document.querySelectorAll("#grid .char-card"));
  var allOn = cards.length && cards.every(function (card) { return selectedAssets[card.dataset.key]; });
  cards.forEach(function (card) {
    if (allOn) delete selectedAssets[card.dataset.key];
    else selectedAssets[card.dataset.key] = true;
    var on = !!selectedAssets[card.dataset.key];
    card.classList.toggle("is-picked", on);
    var box = card.querySelector(".asset-check");
    if (box) box.classList.toggle("is-on", on);
  });
  syncGenButton();
};
document.getElementById("gen-all").onclick = function () {
  if (this.disabled) return;
  if (multiOn) {
    var selectedCount = submitGeneration("selected");
    if (!selectedCount) {
      ReplicaUI.toast("所选资产已生成或正在生成");
      return;
    }
    ReplicaUI.toast("已生成所选 " + selectedCount + " 个资产");
    return;
  }
  var stats = assetImageStats();
  if (!stats.remaining) {
    ReplicaUI.toast("所有资产已完成");
    return;
  }
  var count = submitGeneration("all");
  var remaining = assetImageStats().remaining;
  ReplicaUI.toast(remaining
    ? "已生成 " + count + " 个资产，还有 " + remaining + " 项可以继续补齐"
    : "已生成全部待办，共 " + count + " 个资产");
};

document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  if (document.getElementById("asset-delete-dialog").classList.contains("open")) { closeDeleteConfirm(); return; }
  if (!document.getElementById("episode-filter-menu").hidden) { closeEpisodeFilter(); return; }
  if (!document.getElementById("model-menu").hidden || !document.getElementById("ratio-popover").hidden || !document.getElementById("type-menu").hidden) { closeGenPanels(); return; }
  if (!document.getElementById("episode-editor").hidden) cancelEpisodeEditor();
  else if (!document.getElementById("episode-detail").hidden) closeEpisodeDetail();
  else if (document.getElementById("reference-dialog").classList.contains("open")) closeReferenceDialog();
  else if (document.getElementById("rewrite-dialog").classList.contains("open")) {
    if (!document.getElementById("rewrite-model-menu").hidden) closeRewriteModelMenu();
    else closeRewriteDialog();
  }
  else if (document.getElementById("voice-dialog").classList.contains("open")) closeVoiceDialog(true);
  else if (document.getElementById("look-dialog").classList.contains("open") && lookMultiOn) {
    lookMultiOn = false;
    selectedLooks = {};
    renderLookLibrary();
  }
  else if (document.getElementById("look-dialog").classList.contains("open")) closeLookDialog();
  else if (document.getElementById("role-dialog").classList.contains("open")) closeRole();
  else if (document.getElementById("plain-dialog").classList.contains("open")) closePlain();
  else if (multiOn) setMultiSelect(false);
  else closeStage();
});

render();
