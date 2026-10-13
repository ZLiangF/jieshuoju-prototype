document.getElementById("credits").textContent = ReplicaUI.credits();

var state = {
  source: "file",
  region: "cn",
  type: "short",
  styleId: "live-hd",
  pickType: "short",
  pickId: "live-hd"
};

var typeMap = { short: "短剧", comic: "漫剧", comment: "解说剧" };
var commentPromoOn = true;
var commentBubbleClosed = false;

function hideCommentBubble() {
  document.getElementById("comment-bubble").classList.remove("show");
}

function showCommentPromo() {
  document.getElementById("comment-promo").classList.toggle("is-on", commentPromoOn);
  if (commentPromoOn && !commentBubbleClosed) {
    document.getElementById("comment-bubble").classList.add("show");
  } else {
    hideCommentBubble();
  }
}

function findStyle(id) {
  return ReplicaData.styles.filter(function (s) { return s.id === id; })[0];
}

function filterStyles(type) {
  return ReplicaData.styles.filter(function (s) {
    return s.types.indexOf(type) > -1;
  });
}

function showFilled(kind) {
  state.source = kind || state.source;
  document.body.classList.add("is-filled");
  document.body.classList.remove("is-pasting");
  var titles = {
    file: ["上传成功", "离婚后（15集）.txt · 删除后可重新上传"],
    paste: ["已粘贴文本", "18,420 字 · 预估 3 集 · 可删除后重贴"]
  };
  var pack = titles[state.source] || titles.file;
  document.getElementById("ok-title").textContent = pack[0];
  document.getElementById("ok-sub").textContent = pack[1];
  if (state.source === "paste") document.getElementById("f-name").value = "粘贴剧本（3集）";
  if (state.source === "file") document.getElementById("f-name").value = "离婚后（15集）";
}

function showEmpty() {
  document.body.classList.remove("is-filled");
  document.body.classList.remove("is-pasting");
  setSource("file");
}

function setSource(source) {
  state.source = source;
  document.body.classList.toggle("is-pasting", source === "paste");
  document.querySelectorAll("#source-tabs button").forEach(function (btn) {
    btn.classList.toggle("on", btn.getAttribute("data-source") === source);
  });
  document.querySelectorAll("[data-pane]").forEach(function (pane) {
    pane.classList.toggle("on", pane.getAttribute("data-pane") === source);
  });
}

function syncStyleField() {
  var style = findStyle(state.styleId);
  document.getElementById("f-cat").value = state.region;
  if (!style) {
    document.getElementById("style-name").textContent = "请选择风格";
    document.getElementById("style-map").textContent = "";
    return;
  }
  document.getElementById("style-name").textContent = style.name;
  document.getElementById("style-map").textContent = typeMap[state.type];
  document.getElementById("style-thumb").className = "thumb sc " + style.cover;
}

function renderLibrary() {
  var grid = document.getElementById("style-grid");
  var list = filterStyles(state.pickType);
  var html = list.map(function (s) {
    return '<button class="style-card' + (s.id === state.pickId ? " on" : "") + '" type="button" data-id="' + s.id + '">' +
      '<div class="cover sc ' + s.cover + '">' + (s.badge ? '<span class="badge">' + s.badge + "</span>" : "") + "</div>" +
      '<div class="meta"><div class="ttl">' + s.name + "</div>" +
      '<div class="sub">' + s.map + " · " + s.desc + "</div></div></button>";
  }).join("");
  html += '<button class="style-card custom" type="button" data-id="custom"><div class="plus">+</div>自定义风格</button>';
  grid.innerHTML = html;
  var picked = findStyle(state.pickId);
  document.getElementById("style-pick").innerHTML = picked
    ? "已选 <b>" + picked.name + "</b> · " + typeMap[state.pickType]
    : "请选择一个风格";
}

function openLibrary() {
  state.pickType = state.type;
  state.pickId = state.styleId;
  document.querySelectorAll("#lib-types button[data-type]").forEach(function (btn) {
    btn.classList.toggle("on", btn.getAttribute("data-type") === state.pickType);
  });
  renderLibrary();
  document.getElementById("style-mask").classList.add("open");
  showCommentPromo();
}

function closeLibrary() {
  document.getElementById("style-mask").classList.remove("open");
}

function applyPick() {
  if (!state.pickId || state.pickId === "custom") {
    ReplicaUI.toast("请先选择一个风格");
    return;
  }
  state.type = state.pickType;
  state.styleId = state.pickId;
  syncStyleField();
  closeLibrary();
}

var auto = { on: false, step: -1, run: 0, timers: [], tick: null, left: 0, waiting: false, finished: false };
var autoStepNames = ["剧本", "资产", "分集视频"];
var autoStages = [runAutoScript, runAutoAssets, runAutoVideos];

function $id(id) { return document.getElementById(id); }

function autoLater(fn, ms) {
  var run = auto.run;
  auto.timers.push(setTimeout(function () { if (run === auto.run) fn(); }, ms));
}

function clearAuto() {
  auto.timers.forEach(clearTimeout);
  auto.timers = [];
  clearInterval(auto.tick);
  auto.waiting = false;
}

function autoScroll() {
  var body = $id("auto-body");
  body.scrollTop = body.scrollHeight;
}

function renderAutoSteps() {
  document.querySelectorAll(".auto-step").forEach(function (el) {
    var i = Number(el.getAttribute("data-step"));
    el.classList.toggle("on", i === auto.step && !auto.finished);
    el.classList.toggle("done", i < auto.step || auto.finished);
  });
}

function setAutoFoot(mode) {
  var tip = $id("auto-tip");
  var pause = $id("auto-pause");
  var next = $id("auto-next");
  pause.style.display = mode === "waiting" ? "" : "none";
  next.style.display = mode === "running" ? "none" : "";
  if (mode === "running") tip.textContent = "正在流式生成" + autoStepNames[auto.step] + "…";
  if (mode === "waiting") {
    tip.innerHTML = "<b>" + auto.left + "</b> 秒后自动进入" + autoStepNames[auto.step + 1] + "生成 · 任意操作将重新计时";
    next.textContent = "进入" + autoStepNames[auto.step + 1];
  }
  if (mode === "paused") {
    tip.textContent = "已暂停，检查完成后可手动进入下一步";
    next.textContent = "进入" + autoStepNames[auto.step + 1];
  }
  if (mode === "done") {
    tip.textContent = "全部完成：剧本 3 集 · 资产 11 个 · 分集视频 3 集（1080P）";
    next.textContent = "查看分集成片";
  }
}

function typeText(el, text, done) {
  var i = 0;
  (function tick() {
    i = Math.min(text.length, i + 4);
    el.textContent = text.slice(0, i);
    autoScroll();
    if (i < text.length) autoLater(tick, 30);
    else done();
  })();
}

function runAutoScript(done) {
  var outline = ReplicaData.outline;
  var blocks = [{ title: "故事梗概", body: outline.summary }].concat(outline.scripts);
  var box = $id("auto-body");
  box.innerHTML = '<div class="auto-script"></div>';
  var wrap = box.firstChild;
  (function next(i) {
    if (i >= blocks.length) { done(); return; }
    var h = document.createElement("h4");
    var p = document.createElement("p");
    h.textContent = blocks[i].title;
    wrap.appendChild(h);
    wrap.appendChild(p);
    typeText(p, blocks[i].body, function () { autoLater(function () { next(i + 1); }, 200); });
  })(0);
}

function runAutoAssets(done) {
  var D = ReplicaData;
  var items = D.characters.map(function (c) { return { kind: "角色", name: c.name + "-" + c.look, image: c.image }; })
    .concat(D.scenes.map(function (s) { return { kind: "场景", name: s.name, image: s.image, wide: true }; }))
    .concat(D.props.map(function (p) { return { kind: "道具", name: p.name, image: p.image, wide: true }; }));
  $id("auto-body").innerHTML = '<div class="auto-grid">' + items.map(function (a, i) {
    return '<div class="auto-card' + (a.wide ? " wide" : "") + '" data-i="' + i + '"><div class="auto-thumb"><span>排队中</span></div>' +
      '<div class="auto-meta"><small>' + a.kind + "</small><b>" + a.name + "</b></div></div>";
  }).join("") + "</div>";
  (function next(i) {
    if (i >= items.length) { done(); return; }
    var card = document.querySelector('.auto-card[data-i="' + i + '"]');
    var thumb = card.querySelector(".auto-thumb");
    thumb.innerHTML = '<div class="spin"></div><span>图片生成中</span>';
    card.scrollIntoView({ block: "nearest" });
    autoLater(function () {
      thumb.innerHTML = '<img src="' + items[i].image + '" alt="">';
      card.classList.add("done");
      next(i + 1);
    }, 450);
  })(0);
}

function runAutoVideos(done) {
  var shotCounts = [6, 4, 5];
  var covers = ["media/scenes/cemetery.png", "media/scenes/office.png", "media/scenes/rain.png"];
  var eps = ReplicaData.episodes;
  $id("auto-body").innerHTML = '<div class="auto-eps">' + eps.map(function (ep, i) {
    return '<div class="auto-ep" data-i="' + i + '"><div class="auto-ep-cover"><img src="' + covers[i] + '" alt=""></div>' +
      '<div class="auto-ep-main"><b>' + ep.title + '</b><div class="auto-bar"><i></i></div>' +
      '<small class="auto-ep-state">排队中 · ' + shotCounts[i] + " 个片段</small></div></div>";
  }).join("") + "</div>";
  (function nextEp(i) {
    if (i >= eps.length) { done(); return; }
    var row = document.querySelector('.auto-ep[data-i="' + i + '"]');
    var bar = row.querySelector(".auto-bar i");
    var stateEl = row.querySelector(".auto-ep-state");
    var total = shotCounts[i];
    row.classList.add("on");
    row.scrollIntoView({ block: "nearest" });
    (function nextShot(k) {
      if (k > total) {
        stateEl.textContent = "正在合成成片（字幕 / 配音 / BGM）…";
        autoLater(function () {
          row.classList.remove("on");
          row.classList.add("done");
          stateEl.textContent = "成片完成 · 1080P · " + total + " 个片段";
          nextEp(i + 1);
        }, 700);
        return;
      }
      stateEl.textContent = "视频片段 " + k + " / " + total + " 生成中";
      autoLater(function () {
        bar.style.width = Math.round(k / total * 90) + "%";
        nextShot(k + 1);
      }, 380);
    })(1);
  })(0);
}

function goAutoStep(i) {
  clearInterval(auto.tick);
  auto.waiting = false;
  auto.step = i;
  renderAutoSteps();
  setAutoFoot("running");
  autoStages[i](function () {
    if (i < autoStages.length - 1) startAutoCountdown();
    else finishAuto();
  });
}

function startAutoCountdown() {
  clearInterval(auto.tick);
  auto.waiting = true;
  auto.left = 5;
  setAutoFoot("waiting");
  auto.tick = setInterval(function () {
    auto.left -= 1;
    if (auto.left <= 0) goAutoStep(auto.step + 1);
    else setAutoFoot("waiting");
  }, 1000);
}

function finishAuto() {
  auto.finished = true;
  renderAutoSteps();
  $id("auto-title").textContent = "全自动创作完成";
  setAutoFoot("done");
  ReplicaUI.toast("剧本、资产图片与分集视频已全部生成");
}

function startAuto(name) {
  auto.run += 1;
  clearAuto();
  auto.finished = false;
  $id("auto-title").textContent = "全自动创作中";
  $id("auto-name").textContent = name + " · " + typeMap[state.type] + " · " + findStyle(state.styleId).name;
  $id("auto-mask").classList.add("open");
  goAutoStep(0);
}

function closeAuto() {
  auto.run += 1;
  clearAuto();
  $id("auto-mask").classList.remove("open");
}

function onAutoActivity(e) {
  if (!auto.waiting) return;
  if (e.target.closest && e.target.closest("#auto-pause,#auto-next,#auto-close")) return;
  startAutoCountdown();
}

$id("auto-switch").onclick = function () {
  auto.on = !auto.on;
  this.classList.toggle("on", auto.on);
  this.setAttribute("aria-checked", String(auto.on));
};
$id("auto-close").onclick = closeAuto;
$id("auto-pause").onclick = function () {
  clearInterval(auto.tick);
  auto.waiting = false;
  setAutoFoot("paused");
};
$id("auto-next").onclick = function () {
  if (auto.finished) { location.href = "episodes.html"; return; }
  goAutoStep(auto.step + 1);
};
["click", "wheel", "touchstart"].forEach(function (type) {
  $id("auto-mask").addEventListener(type, onAutoActivity, { passive: true });
});
document.addEventListener("keydown", onAutoActivity);

function startCreate() {
  if (!state.styleId) {
    ReplicaUI.toast("请先选择风格");
    return;
  }
  if (auto.on) {
    startAuto(document.getElementById("f-name").value);
    return;
  }
  var style = findStyle(state.styleId);
  var mask = document.getElementById("mask");
  var title = document.getElementById("flow-title");
  var sub = document.getElementById("flow-sub");
  mask.classList.add("open");
  var name = document.getElementById("f-name").value;
  var steps = [
    ["正在解析剧本", name],
    ["正在套用风格", typeMap[state.type] + " · " + style.name],
    ["正在生成剧本大纲", "故事梗概 / 人物关系 / 分集结构"],
    ["大纲已就绪", "进入确认"]
  ];
  var i = 0;
  title.textContent = steps[0][0];
  sub.textContent = steps[0][1];
  var t = setInterval(function () {
    i += 1;
    if (i >= steps.length) {
      clearInterval(t);
      location.href = "outline.html";
      return;
    }
    title.textContent = steps[i][0];
    sub.textContent = steps[i][1];
  }, 700);
}

document.querySelectorAll("#source-tabs button").forEach(function (btn) {
  btn.onclick = function () { setSource(btn.getAttribute("data-source")); };
});
document.getElementById("upload").onclick = function () { showFilled("file"); };
document.getElementById("sample").onclick = function () { setSource("paste"); };
document.getElementById("confirm-paste").onclick = function () {
  if (!document.getElementById("paste-text").value.trim()) {
    document.getElementById("paste-text").value = "1-1 墓地 日 外  出场：萧铭、贺芷\n萧铭穿着外卖服将电动车停在路边…";
  }
  showFilled("paste");
};
document.getElementById("remove-file").onclick = showEmpty;
document.getElementById("new-project").onclick = function () { ReplicaUI.toast("演示：打开 AIGC 训练营"); };
document.getElementById("start-create").onclick = startCreate;

document.getElementById("f-cat").onchange = function () {
  state.region = this.value;
};

document.getElementById("open-style").onclick = openLibrary;
document.getElementById("style-close").onclick = closeLibrary;
document.getElementById("style-cancel").onclick = closeLibrary;
document.getElementById("style-ok").onclick = applyPick;
document.getElementById("style-mask").addEventListener("click", function (e) {
  if (e.target === this) closeLibrary();
});

document.querySelectorAll("#lib-types button[data-type]").forEach(function (btn) {
  btn.onclick = function () {
    state.pickType = btn.getAttribute("data-type");
    document.querySelectorAll("#lib-types button[data-type]").forEach(function (b) {
      b.classList.toggle("on", b === btn);
    });
    var list = filterStyles(state.pickType);
    if (!list.some(function (s) { return s.id === state.pickId; })) {
      state.pickId = list[0] ? list[0].id : "";
    }
    renderLibrary();
  };
});
document.getElementById("comment-bubble-close").onclick = function (e) {
  e.stopPropagation();
  commentBubbleClosed = true;
  hideCommentBubble();
};

document.getElementById("style-grid").addEventListener("click", function (e) {
  var card = e.target.closest("[data-id]");
  if (!card) return;
  if (card.getAttribute("data-id") === "custom") {
    document.getElementById("custom-mask").classList.add("open");
    return;
  }
  state.pickId = card.getAttribute("data-id");
  renderLibrary();
});

document.getElementById("custom-cancel").onclick = function () {
  document.getElementById("custom-mask").classList.remove("open");
};
document.getElementById("custom-ok").onclick = function () {
  var name = document.getElementById("custom-name").value.trim() || "自定义风格";
  var desc = document.getElementById("custom-prompt").value.trim() || "按自定义提示词生成角色、场景与道具";
  var id = "custom-" + Date.now();
  ReplicaData.styles.push({
    id: id,
    name: name,
    map: "自定义",
    desc: desc,
    types: [state.pickType],
    regions: ["cn", "os"],
    cover: "sc-custom"
  });
  state.pickId = id;
  document.getElementById("custom-mask").classList.remove("open");
  renderLibrary();
  ReplicaUI.toast("已加入风格库");
};

var drop = document.getElementById("empty-card");
drop.addEventListener("dragover", function (e) { e.preventDefault(); });
drop.addEventListener("drop", function (e) {
  e.preventDefault();
  showFilled("file");
});

document.getElementById("show-tabs").onclick = function (e) {
  var btn = e.target.closest("[data-show]");
  if (!btn) return;
  var pick = btn.getAttribute("data-show");
  this.querySelectorAll("[data-show]").forEach(function (item) {
    item.classList.toggle("on", item === btn);
  });
  document.querySelectorAll("#show-grid .show-card").forEach(function (card) {
    card.hidden = pick !== "all" && card.getAttribute("data-cat").split(" ").indexOf(pick) < 0;
  });
};
document.getElementById("show-grid").onclick = function (e) {
  var card = e.target.closest(".show-card");
  if (card) ReplicaUI.toast("演示：播放《" + card.querySelector("strong").textContent + "》");
};

syncStyleField();
if (/[?&]filled=1/.test(location.search)) showFilled("file");
