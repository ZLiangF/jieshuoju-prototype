function updatePromptCount() {
  var value = document.getElementById("f-prompt").value;
  document.getElementById("prompt-count").textContent = value.length + " / " + PROMPT_LIMIT;
}

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
  var isChar = D.characters.indexOf(item) !== -1;
  var unit = isChar ? "形象" : D.scenes.indexOf(item) !== -1 ? "场景" : "道具";
  if (completed) ReplicaUI.toast("生成完成 · " + item.name + " " + completed + " 个" + unit);
  if (completed && isChar && !item.voiceBind) openVoiceDialog(item, true);
}

function cancelLookGeneration(looks) {
  var refund = 0;
  looks.forEach(function (look) {
    if (look.status !== "generating") return;
    look.status = "pending";
    delete look.generationTask;
    delete look.generationProgress;
    delete look.generationStage;
    refund += 3;
  });
  if (refund) {
    D.credits += refund;
    document.getElementById("credits").textContent = ReplicaUI.credits();
  }
  return refund;
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
  document.querySelector(".composer-reference-row").classList.toggle("is-free", type.id === "free");
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
