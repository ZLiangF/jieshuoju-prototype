var TAB_WORDS = { char: "角色", scene: "场景", prop: "道具" };

function paintPending(kind, n) {
  var el = document.getElementById("pending-" + kind);
  el.hidden = !n;
  el.querySelector("em").textContent = n || "";
  el.title = n ? "还有 " + n + " 项待生成" : "";
}

function matchesQuery(row) {
  var q = query.trim().toLowerCase();
  if (!q) return true;
  return ((row.item.name || "") + " " + (row.item.desc || "") + " " + (row.item.tag || "") + " " + (row.item.role || "")).toLowerCase().indexOf(q) !== -1;
}

function matchedRows(kind) {
  return rowsOf(kind).filter(matchesQuery);
}

function renderReadyBanner() {
  var total = 0;
  var done = 0;
  ["char", "scene", "prop"].forEach(function (kind) {
    rowsOf(kind).forEach(function (row) {
      var stats = assetLookStats(row.item);
      total += stats.total;
      done += stats.done;
    });
  });
  var title = document.getElementById("asset-ready-title");
  var desc = document.getElementById("asset-ready-desc");
  var bar = document.getElementById("asset-ready-bar");
  if (!title || !desc || !bar) return;
  var pct = total ? Math.round(done / total * 100) : 0;
  if (total && done >= total) {
    title.textContent = "资产已就绪，下一步确认成片方案";
    desc.textContent = done + "/" + total + " 项资产已就绪。请检查角色、场景与道具。";
  } else {
    title.textContent = "资产还在补齐，完成后再进入成片";
    desc.textContent = done + "/" + total + " 项已就绪，还有 " + (total - done) + " 项待生成。";
  }
  bar.style.width = pct + "%";
}

function renderTabCounts() {
  ["char", "scene", "prop"].forEach(function (kind) {
    var count = document.getElementById("count-" + kind);
    var rows = matchedRows(kind);
    var ready = rows.filter(function (row) { return assetState(row.item) === "ready"; }).length;
    var pending = rows.length - ready;
    count.textContent = ready + "/" + rows.length;
    count.title = ready + " 个已完成，共 " + rows.length + " 个" + TAB_WORDS[kind];
    paintPending(kind, query.trim() ? 0 : pending);
  });
}

function setActiveTab(kind) {
  tab = kind;
  document.querySelectorAll(".asset-commandbar .tabs button").forEach(function (button) {
    button.classList.toggle("on", button.dataset.tab === kind);
  });
  var word = kind === "scene" ? "场景" : kind === "prop" ? "道具" : "角色";
  var add = document.getElementById("add");
  add.title = "新增" + word;
  add.setAttribute("aria-label", "新增" + word);
  document.getElementById("asset-expand").hidden = kind !== "char";
}

function charsWithSubs() {
  return matchedRows("char").filter(function (row) { return subLooksOf(row.item).length; });
}

function allCharsOpen() {
  var rows = charsWithSubs();
  return rows.length > 0 && rows.every(function (row) { return expandedChars["char:" + row.i]; });
}

function paintExpandButton() {
  var btn = document.getElementById("asset-expand");
  var all = allCharsOpen();
  var label = all ? "收起子角色" : "展开子角色";
  btn.classList.toggle("on", all);
  btn.setAttribute("aria-pressed", all ? "true" : "false");
  btn.setAttribute("aria-label", label);
  btn.title = all ? "收起子角色：放回主角色下面" : "展开子角色：平铺所有子角色";
}

function roleTagsHtml(a, kind) {
  return kind === "char" && a.role ? '<span class="tag asset-role is-' + ROLE_TONES[a.role] + '">' + a.role + "</span>" : "";
}

function primaryLookOf(item) {
  var looks = item.looksList || [];
  return looks.filter(function (look) { return item.look && look.name.indexOf(item.look) !== -1; })[0] || looks[0] || null;
}

function subLooksOf(item) {
  var primary = primaryLookOf(item);
  return orderedLooks(item.looksList || []).filter(function (entry) {
    if (entry.look === primary) return false;
    if (!episodeFilterNumbers.length) return true;
    var eps = parseEpisodeNumbers(entry.look.eps);
    return episodeFilterNumbers.some(function (n) { return eps.indexOf(n) !== -1; });
  });
}

function subLookState(item, look) {
  if (look.status === "generating" || look.status === "failed") return look.status;
  return isLookRevealed(item, look) ? "ready" : "pending";
}

function subCardHtml(row, entry) {
  var item = row.item;
  var look = entry.look;
  var state = subLookState(item, look);
  var shortName = look.name;
  var key = row.kind + ":" + row.i;
  var visual = state === "ready"
    ? '<img src="' + (look.sheet || look.image) + '" alt="' + look.name + '" loading="lazy" decoding="async">'
    : '<div class="asset-empty-state" aria-label="子角色尚未生成">' + EMPTY_PERSON_ICON + "</div>";
  var flag = state === "ready"
    ? ""
    : state === "generating"
    ? '<span class="asset-flag generating">' + lookStateIcon("generating") + "生成中</span>"
    : multiOn
    ? '<span class="asset-flag ' + state + '">' + lookStateIcon(state) + "待生成</span>"
    : '<button type="button" class="asset-flag is-action ' + state + '" data-gen-look="' + key + "|" + look.id + '" title="生成这个子角色">' + lookStateIcon(state) + (state === "failed" ? "重新生成" : "生成") + "</button>";
  var chip = episodeChip(look.eps);
  return '<article class="char-card asset-card asset-char asset-sub is-' + state + '" data-kind="char" data-i="' + row.i + '" data-key="' + key + '" data-look="' + look.id + '"' + (multiOn ? ' title="多选按角色整体选择"' : "") + ">" +
    '<div class="asset-card-media is-' + state + (state === "ready" ? " is-sheet" : state === "pending" ? " is-empty" : "") + '">' + visual + flag + "</div>" +
    '<div class="asset-card-info"><div class="asset-card-title"><h3 title="' + look.name + '"><span class="asset-name">' + shortName + '</span><span class="tag asset-sub-tag">子角色</span></h3>' +
    '<span class="looks" title="' + chip.title + '">' + chip.html.replace(/<[^>]+>/g, "") + "</span></div>" +
    '<p class="asset-sub-owner">' + SUB_ICON + "隶属 " + item.name + "</p>" +
    "</div></article>";
}

function visibleAssets() {
  return matchedRows(tab);
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
  var lookText = kind === "char"
    ? "形象 " + lookStats.done + "/" + looks
    : looks > 1
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
  var subCount = kind === "char" ? subLooksOf(a).length : 0;
  var subOpen = subCount && expandedChars[key];
  if (kind !== "char" && state === "ready" && looks > 1) lookText = "共 " + looks + " 个" + unit;
  var lookMeta = subCount
    ? '<button type="button" class="looks asset-sub-count' + (subOpen ? " on" : "") + '" data-expand-subs="1" aria-pressed="' + (subOpen ? "true" : "false") + '" title="' + (subOpen ? "收起这个角色的子形象" : "展开这个角色的子形象") + '">' + SUB_ICON + lookText + '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.2 2.4 7.8 6 4.2 9.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>'
    : '<span class="looks">' + lookText + "</span>";
  var flag = state === "ready"
    ? ""
    : actionable && !multiOn
    ? '<button type="button" class="asset-flag is-action ' + flagState + '" data-gen-asset="' + key + '" title="' + (failedLooks ? "重新生成失败内容" : "生成该资产还未完成的内容") + '">' + flagIcon + flagText + "</button>"
    : '<span class="asset-flag ' + flagState + '">' + flagIcon + (multiOn && actionable ? (state === "partial" ? pending + " 个待生成" : "待生成") : flagText) + "</span>";
  var voiceBtn = kind === "char" && charVoiceReady(a) ? cardVoiceHtml(a) : "";
  return '<article class="char-card asset-card asset-' + kind + " is-" + state + (picked ? " is-picked" : "") + '" data-kind="' + kind + '" data-i="' + row.i + '" data-key="' + key + '">' +
    '<div class="' + mediaClass + '">' + visual + check + voiceBtn + delBtn + flag + "</div>" +
    '<div class="asset-card-info"><div class="asset-card-title"><h3><span class="asset-name" title="' + a.name + '">' + a.name + "</span>" +
    roleTagsHtml(a, kind) + "</h3>" + (kind === "char" || looks > 1 ? lookMeta : "") + "</div>" +
    (a.desc ? "<p>" + a.desc + "</p>" : '<p class="asset-empty-desc">点击卡片直接编辑资产</p>') +
    "</div></article>";
}

function cardVoiceHtml(char) {
  var bind = char.voiceBind;
  var on = charVoiceOn(char);
  var text = on ? "音色：" + bind.name : bind ? "音色已关闭：" + bind.name : "绑定音色";
  return '<button type="button" class="card-voice' + (on ? " is-on" : "") + '" data-bind-voice="1" title="' + text + '" aria-label="' +
    (on ? "已开启音色「" + bind.name + "」，点击管理" : bind ? "音色「" + bind.name + "」已关闭，点击开启" : "绑定音色") + '">' +
    (on ? VOICE_ON_ICON : VOICE_OFF_ICON) + "</button>";
}

function render() {
  var rows = visibleAssets();
  renderTabCounts();
  document.getElementById("grid").innerHTML = rows.length
    ? rows.map(function (row) {
        var html = cardHtml(row);
        if (row.kind === "char" && expandedChars[row.kind + ":" + row.i]) {
          html += subLooksOf(row.item).map(function (entry) { return subCardHtml(row, entry); }).join("");
        }
        return html;
      }).join("")
    : '<p class="asset-none">没有找到相关资产</p>';
  document.getElementById("grid").classList.toggle("is-expanded", tab === "char" && allCharsOpen());
  document.getElementById("grid").classList.toggle("is-square", tab === "prop");
  paintExpandButton();
  renderReadyBanner();
  document.getElementById("grid").classList.toggle("is-multiselect", multiOn);
  var footer = document.querySelector(".guide-footer");
  if (footer) footer.classList.toggle("is-away", multiOn);
  syncGenButton();
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
  if (e.target.closest("[data-expand-subs]")) {
    var ownerCard = e.target.closest(".char-card");
    var ownerKey = ownerCard.dataset.key;
    var ownerName = ownerCard.querySelector(".asset-name").textContent;
    if (expandedChars[ownerKey]) delete expandedChars[ownerKey];
    else expandedChars[ownerKey] = true;
    render();
    var owner = document.querySelector('#grid [data-key="' + ownerKey + '"]:not([data-look])');
    if (owner) owner.scrollIntoView({ block: "nearest", behavior: "smooth" });
    ReplicaUI.toast(expandedChars[ownerKey] ? "已展开「" + ownerName + "」的子形象" : "已收起「" + ownerName + "」的子形象");
    return;
  }
  var genLook = e.target.closest("[data-gen-look]");
  if (genLook) {
    var lookParts = genLook.dataset.genLook.split("|");
    var owner2 = D.characters[Number(lookParts[0].split(":")[1])];
    var lookId = lookParts[1];
    var target = (owner2.looksList || []).filter(function (look) { return look.id === lookId; })[0];
    revealItemLooks(owner2, function (look) { return look && look.id === lookId; });
    render();
    ReplicaUI.toast("已生成「" + (target ? target.name : owner2.name) + "」");
    return;
  }
  var gen = e.target.closest("[data-gen-asset]");
  if (gen) {
    var parts = gen.dataset.genAsset.split(":");
    var source = parts[0] === "char" ? D.characters : parts[0] === "scene" ? D.scenes : D.props;
    var item = source[Number(parts[1])];
    var wasUnbound = item && parts[0] === "char" && !item.voiceBind && assetState(item) === "pending";
    var generated = item ? revealItemLooks(item) : 0;
    render();
    if (item && document.getElementById("look-dialog").classList.contains("open") && currentChar === item) fillLookForm(editingLook);
    ReplicaUI.toast(generated ? "已生成「" + item.name + "」的 " + generated + " 项内容" : "这个资产没有待生成内容");
    if (wasUnbound && generated) openVoiceDialog(item, true);
    return;
  }
  var bindVoice = e.target.closest("[data-bind-voice]");
  if (bindVoice) {
    var bindCard = bindVoice.closest(".char-card");
    var bindItem = D.characters[Number(bindCard.dataset.i)];
    if (bindItem) openVoiceDialog(bindItem);
    return;
  }
  var card = e.target.closest(".char-card");
  if (!card) return;
  if (multiOn) {
    if (card.dataset.look) return;
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
    var subLook = card.dataset.look && looks.filter(function (look) { return look.id === card.dataset.look; })[0];
    fillLookForm(subLook || primaryLook);
    return;
  }
};

document.getElementById("asset-expand").onclick = function () {
  var open = !allCharsOpen();
  charsWithSubs().forEach(function (row) {
    var key = "char:" + row.i;
    if (open) expandedChars[key] = true;
    else delete expandedChars[key];
  });
  render();
  ReplicaUI.toast(open ? "已平铺所有子角色" : "子角色已收回主角色下");
};

document.getElementById("role-tier").onclick = function (e) {
  var b = e.target.closest("[data-role-tier]");
  if (!b) return;
  roleTier = b.dataset.roleTier;
  paintRoleTier();
};

function paintRoleTier() {
  document.querySelectorAll("#role-tier [data-role-tier]").forEach(function (b) {
    var on = b.dataset.roleTier === roleTier;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  });
}

document.querySelector(".tabs").onclick = function (e) {
  var b = e.target.closest("[data-tab]");
  if (!b) return;
  setActiveTab(b.dataset.tab);
  render();
};

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
  document.getElementById("episode-filter-trigger").classList.toggle("is-active", !allOn);
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
  if (query.trim() && !matchedRows(tab).length) {
    var next = ["char", "scene", "prop"].filter(function (kind) { return matchedRows(kind).length; })[0];
    if (next) setActiveTab(next);
  }
  render();
};
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
    if (mode === "all" && !inEpisode(entry.item)) return;
    if (mode === "tab" && (entry.kind !== tab || !inEpisode(entry.item))) return;
    var state = entryState(entry);
    if (state === "pending" || state === "failed") targets.push(entry);
  });
  return targets;
}

function generationSubmissionTargets(mode) {
  var onlyFirst = (mode === "all" || mode === "tab") && !assetImageStats(null, true).generated;
  return generationTargets(mode).filter(function (entry) {
    if (onlyFirst && !FIRST_REVEAL[entry.item.id]) return false;
    if (onlyFirst && entry.look && entry.item.looksList.length > 1 && !lookHasImage(entry.item, entry.look)) return false;
    return true;
  });
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
  var ids = {};
  generationSubmissionTargets(mode).forEach(function (entry) {
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
  var stats = assetImageStats(null, true);
  var scope = episodeFilterNumbers.length ? episodeFilterLabel() : "";
  var count = Object.keys(selectedAssets).length;
  var visibleCards = [].slice.call(document.querySelectorAll("#grid .char-card"));
  var allVisiblePicked = visibleCards.length > 0 && visibleCards.every(function (card) { return selectedAssets[card.dataset.key]; });
  document.getElementById("asset-multi-label").textContent = multiOn ? "取消" : "多选";
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
  var assets = {};
  generationTargets("selected").forEach(function (entry) { assets[entry.kind + ":" + entry.index] = true; });
  var assetCount = Object.keys(assets).length;
  document.getElementById("asset-expand").hidden = tab !== "char" || multiOn;
  document.getElementById("add").hidden = multiOn;
  document.getElementById("upload-asset").hidden = multiOn;
  var genSelected = document.getElementById("gen-selected");
  genSelected.hidden = !multiOn;
  genSelected.textContent = assetCount ? "生成所选 " + assetCount : "生成所选";
  genSelected.disabled = !assetCount;
  genSelected.title = assetCount ? "只生成勾选里还未完成的资产" : "请勾选待生成或生成失败的资产";

  var label = document.getElementById("gen-all-label");
  var pendingCount = document.getElementById("gen-all-count");
  button.hidden = multiOn;
  button.classList.remove("is-complete");
  if (!stats.remaining) {
    label.textContent = scope ? scope + "资产已完成" : "全量资产已完成";
    pendingCount.textContent = "";
    button.disabled = true;
    button.classList.add("is-complete");
    button.title = (scope || "全部集数") + "的角色、场景和道具均已完成";
  } else {
    label.textContent = stats.generated
      ? (scope ? "生成" + scope + "剩余资产" : "生成剩余资产")
      : (scope ? "生成" + scope + "资产" : "全量生成");
    pendingCount.textContent = generationSubmissionTargets("all").length || "";
    button.disabled = multiOn;
    button.title = multiOn ? "多选中，请使用「生成所选」" : "生成" + (scope || "全部集数") + "的待生成内容";
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
function deletedToast(text, result) {
  ReplicaUI.toast(text + (result.refund ? "，生成中的任务已取消，退回 " + result.refund + " 积分" : ""));
}
function deleteAssets(keys) {
  var groups = { char: [], scene: [], prop: [] };
  keys.forEach(function (key) {
    var parts = key.split(":");
    if (groups[parts[0]]) groups[parts[0]].push(Number(parts[1]));
  });
  var removed = 0;
  var refund = 0;
  var removedCurrent = false;
  ["char", "scene", "prop"].forEach(function (kind) {
    var list = kind === "char" ? D.characters : kind === "scene" ? D.scenes : D.props;
    groups[kind].sort(function (a, b) { return b - a; }).forEach(function (index) {
      if (!list[index]) return;
      if (list[index] === currentChar) removedCurrent = true;
      refund += cancelLookGeneration(list[index].looksList || []);
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
  return { removed: removed, refund: refund };
}

var pendingDeleteAction = null;
function assetByKey(key) {
  var parts = key.split(":");
  var list = parts[0] === "char" ? D.characters : parts[0] === "scene" ? D.scenes : D.props;
  return list[Number(parts[1])] || null;
}
function openDangerConfirm(title, desc, onConfirm) {
  pendingDeleteAction = onConfirm;
  document.getElementById("asset-delete-title").textContent = title;
  document.getElementById("asset-delete-desc").textContent = desc;
  document.getElementById("asset-delete-dialog").classList.add("open");
  document.getElementById("asset-delete-ok").focus();
}
function openDeleteConfirm(key) {
  var item = assetByKey(key);
  if (!item) return;
  var kind = key.split(":")[0];
  var unit = kind === "char" ? "角色" : kind === "scene" ? "场景" : "道具";
  var looks = (item.looksList || []).length;
  var sub = kind === "char" ? "形象" : kind === "scene" ? "子场景" : "子道具";
  openDangerConfirm(
    "删除" + unit + "「" + item.name + "」？",
    (looks > 1 ? "它的 " + looks + " 个" + sub + "会一起删除，" : "") + "分镜里对它的引用会失效，删除后无法恢复。",
    function () {
      if (assetByKey(key) !== item) return;
      deletedToast("已删除「" + item.name + "」", deleteAssets([key]));
    }
  );
}
function closeDeleteConfirm() {
  pendingDeleteAction = null;
  document.getElementById("asset-delete-dialog").classList.remove("open");
}
document.getElementById("asset-delete-cancel").onclick = closeDeleteConfirm;
document.getElementById("asset-delete-dialog").onclick = function (e) {
  if (e.target === this) closeDeleteConfirm();
};
document.getElementById("asset-delete-ok").onclick = function () {
  var action = pendingDeleteAction;
  closeDeleteConfirm();
  if (action) action();
};

document.getElementById("asset-delete").onclick = function () {
  if (this.disabled) return;
  var keys = Object.keys(selectedAssets).filter(assetByKey);
  if (!keys.length) { ReplicaUI.toast("请先勾选要删除的资产"); return; }
  openDangerConfirm(
    "删除选中的 " + keys.length + " 个资产？",
    "它们的子形象会一起删除，分镜里对它们的引用会失效，删除后无法恢复。",
    function () {
      var result = deleteAssets(keys);
      deletedToast("已删除 " + result.removed + " 个资产", result);
    }
  );
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

function generationAssetCount(targets) {
  var assets = {};
  targets.forEach(function (entry) { assets[entry.kind + ":" + entry.index] = true; });
  return Object.keys(assets).length;
}

function generationKindNames(targets) {
  var kinds = {};
  targets.forEach(function (entry) { kinds[entry.kind] = true; });
  return [["char", "角色"], ["scene", "场景"], ["prop", "道具"]]
    .filter(function (entry) { return kinds[entry[0]]; })
    .map(function (entry) { return entry[1]; })
    .join("、");
}

function closeGenerationConfirm() {
  pendingGenerationMode = "";
  document.getElementById("asset-generate-dialog").classList.remove("open");
}

function currentBulkGenerationModel() {
  return imageModels.filter(function (item) { return item.id === bulkGenerationChoice.model; })[0] || imageModels[0];
}

function paintBulkGenerationOptions() {
  var model = currentBulkGenerationModel();
  if (model.qualities.indexOf(bulkGenerationChoice.quality) === -1) {
    bulkGenerationChoice.quality = model.qualities.indexOf("2K") !== -1 ? "2K" : model.qualities[model.qualities.length - 1];
  }
  var select = document.getElementById("asset-generate-model");
  select.innerHTML = imageModels.map(function (item) {
    return '<option value="' + item.id + '"' + (item.id === model.id ? " selected" : "") + ">" + item.name + "</option>";
  }).join("");
  document.getElementById("asset-generate-quality").innerHTML = ["512P", "1K", "2K", "4K"].map(function (quality) {
    var enabled = model.qualities.indexOf(quality) !== -1;
    var on = quality === bulkGenerationChoice.quality;
    return '<button type="button" data-bulk-quality="' + quality + '" role="radio" aria-checked="' + (on ? "true" : "false") + '"' +
      (on ? ' class="on"' : "") + (enabled ? "" : " disabled") + ">" + quality + "</button>";
  }).join("");
}

function bulkGenerationUnitCost() {
  var costs = ASSET_GENERATION_COSTS[bulkGenerationChoice.model] || {};
  return costs[bulkGenerationChoice.quality] || 3;
}

function refreshGenerationEstimate() {
  if (!pendingGenerationMode) return;
  var targets = generationSubmissionTargets(pendingGenerationMode);
  var unitCost = bulkGenerationUnitCost();
  var cost = targets.length * unitCost;
  var note = document.getElementById("asset-generate-note");
  var confirm = document.getElementById("asset-generate-ok");
  var enough = D.credits >= cost;
  document.getElementById("asset-generate-cost").textContent = "✦ " + cost;
  note.classList.toggle("is-error", !enough);
  note.textContent = enough
    ? currentBulkGenerationModel().name + " · " + bulkGenerationChoice.quality + "，每项 " + unitCost + " 积分；提交后扣除。"
    : "积分不足：当前余额 ✦ " + D.credits.toLocaleString("en-US") + "，本次需要 ✦ " + cost + "。";
  confirm.disabled = !enough;
  confirm.innerHTML = "确认生成 <b>✦ " + cost + "</b>";
}

function openGenerationConfirm(mode) {
  var targets = generationSubmissionTargets(mode);
  if (!targets.length) {
    ReplicaUI.toast(mode === "selected" ? "所选资产已生成或正在生成" : "所有资产已完成");
    return;
  }
  var selected = mode === "selected";
  var generated = assetImageStats(null, true).generated;
  var scope = episodeFilterNumbers.length ? episodeFilterLabel() : "全部集数";
  var title = selected ? "确认生成所选资产"
    : episodeFilterNumbers.length ? "确认生成" + scope + (generated ? "剩余资产" : "资产")
    : generated ? "确认生成剩余资产" : "确认全量生成";
  var range = selected
    ? "已选 " + generationAssetCount(targets) + " 个资产"
    : scope + (generated ? "剩余资产" : "资产");
  var kinds = generationKindNames(targets);
  if (kinds) range += " · " + kinds;
  pendingGenerationMode = mode;
  paintBulkGenerationOptions();
  document.getElementById("asset-generate-title").textContent = title;
  document.getElementById("asset-generate-range").textContent = range;
  document.getElementById("asset-generate-count").textContent = targets.length + " 项生成内容";
  refreshGenerationEstimate();
  var confirm = document.getElementById("asset-generate-ok");
  document.getElementById("asset-generate-dialog").classList.add("open");
  (confirm.disabled ? document.getElementById("asset-generate-cancel") : confirm).focus();
}

document.getElementById("asset-generate-model").onchange = function () {
  bulkGenerationChoice.model = this.value;
  paintBulkGenerationOptions();
  refreshGenerationEstimate();
};
document.getElementById("asset-generate-quality").onclick = function (e) {
  var button = e.target.closest("[data-bulk-quality]");
  if (!button || button.disabled) return;
  bulkGenerationChoice.quality = button.dataset.bulkQuality;
  paintBulkGenerationOptions();
  refreshGenerationEstimate();
};
document.getElementById("asset-generate-cancel").onclick = closeGenerationConfirm;
document.getElementById("asset-generate-dialog").onclick = function (e) {
  if (e.target === this) closeGenerationConfirm();
};
document.getElementById("asset-generate-ok").onclick = function () {
  if (this.disabled || !pendingGenerationMode) return;
  var mode = pendingGenerationMode;
  var targets = generationSubmissionTargets(mode);
  var cost = targets.length * bulkGenerationUnitCost();
  if (!targets.length) {
    closeGenerationConfirm();
    ReplicaUI.toast("生成内容已发生变化，请重新选择");
    return;
  }
  if (D.credits < cost) {
    openGenerationConfirm(mode);
    return;
  }
  D.credits -= cost;
  document.getElementById("credits").textContent = ReplicaUI.credits();
  closeGenerationConfirm();
  submitGeneration(mode);
  var remaining = mode === "selected" ? 0 : assetImageStats(null, true).remaining;
  ReplicaUI.toast(currentBulkGenerationModel().name + " · " + bulkGenerationChoice.quality + "，已扣除 " + cost + " 积分并提交 " + targets.length + " 项" + (remaining ? "，还有 " + remaining + " 项待生成" : ""));
};

document.getElementById("gen-all").onclick = function () {
  if (this.disabled) return;
  openGenerationConfirm("all");
};
document.getElementById("gen-selected").onclick = function () {
  if (this.disabled) return;
  openGenerationConfirm("selected");
};
