const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}

let seconds = 45;
setInterval(() => {
  seconds = seconds > 0 ? seconds - 1 : 59;
  $("#seconds").textContent = String(seconds).padStart(2, "0");
}, 1000);

$(".trial-close").addEventListener("click", () => {
  $(".trial").style.display = "none";
  $(".topbar").style.top = "0";
  $(".sidebar").style.top = "0";
  document.querySelector("main").style.paddingTop = "62px";
});

const dropZone = $("#dropZone");
const fileInput = $("#fileInput");
$("#uploadBtn").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) openSetup("short", fileInput.files[0].name);
});
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
});
dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (file) openSetup("short", file.name);
});

const dialog = $("#pasteDialog");
$("#pasteBtn").addEventListener("click", () => dialog.showModal());
$(".dialog-close").addEventListener("click", () => dialog.close());
$(".dialog-confirm").addEventListener("click", () => {
  const value = $("textarea", dialog).value.trim();
  if (!value) return toast("请先粘贴剧本内容");
  dialog.close();
  openSetup("short", "粘贴文本 · 已解析");
});

let selectedKind = "short";
let currentStyleType = "short";
const selectedStyles = {};
const customStyleKey = "filmCustomStyles";
let savedCustomStyles = [];
try { savedCustomStyles = JSON.parse(localStorage.getItem(customStyleKey)) || []; } catch (error) { savedCustomStyles = []; }
let editingCustomType = "short";
function styleKey() { return selectedKind + ":" + currentStyleType; }
function presetsFor(kind, type) {
  if (type === "mine") return [];
  if (kind === "explain" && type === "short") return styleLibraries.explain;
  return styleLibraries[type];
}
const styleLibraries = {
  short: [
    ["真人古风", "media/characters/hezhi.png"],
    ["真人影视质感", "media/film-home/wall-cafe.jpg"],
    ["3D现代", "media/scenes/office.png"],
    ["真人写实电影风格", "media/film-home/wall-coast.jpg"],
    ["3D古风", "media/film-home/wall-dumpling.jpg"]
  ],
  comic: [
    ["漫画风格", "media/film-home/wall-flash.jpg"],
    ["2D国风半厚涂", "media/film-home/wall-palace.jpg"],
    ["3D CG动画高清", "media/characters/shen.png"],
    ["2D赛璐璐平涂", "media/film-home/wall-school.jpg"],
    ["2D卡通网点纸", "media/film-home/wall-sword.jpg"],
    ["2D油画风格", "media/film-home/wall-doctor.jpg"],
    ["2D韩漫插画", "media/film-home/wall-heiress.jpg"],
    ["3D CG风格", "media/characters/gushen.png"]
  ],
  explain: [
    ["漫画风格", "media/film-home/wall-flash.jpg"],
    ["2D国风半厚涂", "media/film-home/wall-palace.jpg"],
    ["3D CG动画高清", "media/characters/shen.png"],
    ["2D赛璐璐平涂", "media/film-home/wall-school.jpg"],
    ["2D卡通网点纸", "media/film-home/wall-sword.jpg"],
    ["真人古风", "media/characters/hezhi.png"],
    ["真人影视质感", "media/film-home/wall-cafe.jpg"],
    ["3D现代", "media/scenes/office.png"],
    ["真人写实电影风格", "media/film-home/wall-coast.jpg"],
    ["3D古风", "media/film-home/wall-dumpling.jpg"],
    ["2D油画风格", "media/film-home/wall-doctor.jpg"],
    ["2D韩漫插画", "media/film-home/wall-heiress.jpg"],
    ["3D CG风格", "media/characters/gushen.png"]
  ]
};
const kindOptions = {
  short: {
    title: "短剧创作设置",
    icon: "▣",
    styles: ["真人写实电影风格高清", "真人古风", "3D 卡通风格", "影视质感"],
    ratios: ["9:16", "16:9", "1:1"]
  },
  explain: {
    title: "解说剧创作设置",
    icon: "▤✧",
    styles: ["导演级解说分镜 V2.5", "真人电影解说", "动漫解说", "历史纪录片"],
    ratios: ["16:9", "9:16", "1:1"]
  }
};

function syncSetupKind(kind) {
  selectedKind = kind;
  const config = kindOptions[kind];
  $("#setupStyle").innerHTML = config.styles.map((item) => `<option>${item}</option>`).join("");
  $("#setupRatio").innerHTML = config.ratios.map((item) => `<option>${item}</option>`).join("");
  $("#styleTriggerName").textContent = selectedStyles[styleKey()] || "请选择风格";
  $("#commentStyleLibrary").hidden = true;
  $$(".kind").forEach((item) => item.classList.toggle("selected", item.classList.contains(kind)));
  $$("[data-setup-kind]").forEach((button) => {
    button.classList.toggle("on", button.dataset.setupKind === kind);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function renderStyleLibrary() {
  $$("[data-style-type]").forEach((button) => {
    button.classList.toggle("on", button.dataset.styleType === currentStyleType);
  });
  const key = styleKey();
  const presetCards = presetsFor(selectedKind, currentStyleType).map(([name, image]) => (
    `<button data-style="${escapeHtml(name)}" class="${selectedStyles[key] === name ? "on" : ""}">` +
    `<img src="${image}" alt=""><b>${escapeHtml(name)}</b></button>`
  )).join("");
  const savedCards = currentStyleType === "mine" ? savedCustomStyles.map((style) => (
    `<button class="saved-style${selectedStyles[key] === style.name ? " on" : ""}" data-style="${escapeHtml(style.name)}">` +
    `<span>✦</span><b>${escapeHtml(style.name)}</b></button>`
  )).join("") : "";
  const emptyCard = currentStyleType === "mine" && !savedCustomStyles.length
    ? `<div class="style-empty">还没有保存的自定义风格</div>` : "";
  $("#commentStyleGrid").innerHTML = presetCards + savedCards + emptyCard +
    `<button class="custom-style" data-style="自定义风格"><span>✦</span><b>自定义风格</b></button>`;
}

$("#styleTrigger").addEventListener("click", () => {
  const willOpen = $("#commentStyleLibrary").hidden;
  if (willOpen) renderStyleLibrary();
  $("#commentStyleLibrary").hidden = !willOpen;
});
$("#styleLibraryClose").addEventListener("click", () => {
  $("#commentStyleLibrary").hidden = true;
});
$("#styleTypeTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-style-type]");
  if (!button) return;
  currentStyleType = button.dataset.styleType;
  $("#styleTriggerName").textContent = selectedStyles[styleKey()] || "请选择风格";
  renderStyleLibrary();
});
$("#commentStyleGrid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-style]");
  if (!card) return;
  if (card.dataset.style === "自定义风格") {
    editingCustomType = styleKey();
    const saved = { name: "", prompt: "" };
    $("#customStyleName").dataset.editingId = saved && saved.id ? saved.id : "";
    $("#customStyleName").value = saved ? saved.name : "";
    $("#customStylePrompt").value = saved ? saved.prompt : "";
    updateCustomCounts();
    $("#commentStyleLibrary").hidden = true;
    $("#customStyleDialog").showModal();
    return;
  }
  selectedStyles[styleKey()] = card.dataset.style;
  $("#styleTriggerName").textContent = selectedStyles[styleKey()];
  $$("#commentStyleGrid [data-style]").forEach((item) => item.classList.toggle("on", item === card));
  $("#commentStyleLibrary").hidden = true;
});

function updateCustomCounts() {
  $("#customNameCount").textContent = $("#customStyleName").value.length;
  $("#customPromptCount").textContent = $("#customStylePrompt").value.length;
}
$("#customStyleName").addEventListener("input", updateCustomCounts);
$("#customStylePrompt").addEventListener("input", updateCustomCounts);
function closeCustomStyleDialog() {
  $("#customStyleDialog").close();
}
$(".custom-dialog-close").addEventListener("click", closeCustomStyleDialog);
$("#customStyleCancel").addEventListener("click", closeCustomStyleDialog);
$("#customStyleSave").addEventListener("click", () => {
  const name = $("#customStyleName").value.trim();
  const prompt = $("#customStylePrompt").value.trim();
  if (!name) return toast("请输入风格名称");
  if (!prompt) return toast("请输入提示词描述");
  const editingId = $("#customStyleName").dataset.editingId;
  const current = savedCustomStyles.find((style) => String(style.id) === editingId)
    || savedCustomStyles.find((style) => style.name === name);
  if (current) {
    current.name = name;
    current.prompt = prompt;
  } else {
    savedCustomStyles.unshift({ id: Date.now(), name, prompt });
  }
  localStorage.setItem(customStyleKey, JSON.stringify(savedCustomStyles));
  currentStyleType = "mine";
  selectedStyles[styleKey()] = name;
  $("#styleTriggerName").textContent = name;
  closeCustomStyleDialog();
  renderStyleLibrary();
  $("#commentStyleLibrary").hidden = false;
  toast("自定义风格已保存");
});

function openSetup(kind, fileName = "剧本文件已完成解析") {
  syncSetupKind(kind);
  $("#setupFileName").textContent = fileName;
  $("#homePage").hidden = true;
  $("#setupPage").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$(".kind.short").addEventListener("click", () => openSetup("short"));
$(".kind.explain").addEventListener("click", () => openSetup("explain"));
$$("[data-setup-kind]").forEach((button) => {
  button.addEventListener("click", () => syncSetupKind(button.dataset.setupKind));
});
$("#setupBack").addEventListener("click", () => {
  $("#setupPage").hidden = true;
  $("#homePage").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#oneClickSwitch").addEventListener("click", function () {
  const on = this.classList.toggle("on");
  this.setAttribute("aria-checked", String(on));
});

const tierCosts = { economy: 3200, standard: 4800, premium: 6400, luxury: 12800 };
$("#resolutionGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tier]");
  if (!button) return;
  $$("#resolutionGrid button").forEach((item) => item.classList.toggle("on", item === button));
  $("#costText").textContent = tierCosts[button.dataset.tier];
});

$("#setupProject").addEventListener("change", function () {
  $("#setupConfirm").classList.toggle("ready", Boolean(this.value));
});

$("#setupConfirm").addEventListener("click", () => {
  if (!$("#setupProject").value) return toast("请先选择项目");
  const settings = {
    kind: selectedKind,
    name: $("#setupName").value.trim() || "未命名影视项目",
    project: $("#setupProject").value,
    style: selectedStyles[styleKey()],
    styleType: currentStyleType,
    customStyle: savedCustomStyles.find((style) => style.name === selectedStyles[styleKey()]) || null,
    ratio: $("#setupRatio").value,
    tier: $("#resolutionGrid .on").dataset.tier,
    auto: $("#oneClickSwitch").classList.contains("on")
  };
  if (!settings.style) return toast("请先选择风格");
  sessionStorage.setItem("filmCreationSettings", JSON.stringify(settings));
  toast("创作设置已保存，正在进入剧本流程");
  setTimeout(() => { location.href = "outline.html"; }, 500);
});

$("#searchToggle").addEventListener("click", () => {
  $("#projectSearch").classList.toggle("show");
  if ($("#projectSearch").classList.contains("show")) $("#projectSearch").focus();
});
$("#projectSearch").addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  $$(".project-card").forEach((card) => {
    card.hidden = query && !card.dataset.name.toLowerCase().includes(query);
  });
});

$("#filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  $$("#filters button").forEach((item) => item.classList.toggle("on", item === button));
  const filter = button.dataset.filter;
  $$("#hitGrid article").forEach((card) => {
    card.hidden = filter !== "all" && !card.dataset.cat.split(" ").includes(filter);
  });
});

$$(".project-card, .hit-grid article").forEach((card) => {
  card.addEventListener("click", () => toast("演示页面：功能入口已触发"));
});
$("#vimo").addEventListener("click", () => toast("Vimo：你好，想做什么类型的短剧？"));
