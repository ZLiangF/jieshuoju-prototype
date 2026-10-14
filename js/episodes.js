var D = ReplicaData;
var RATE = { "480P": 2, "720P": 3, "1080P": 5 };
var EP_SEC = 60;
var AUDIO_SEC = 72;
var creditsEl = document.getElementById("credits");
var epsEl = document.getElementById("eps");
creditsEl.textContent = ReplicaUI.credits();

var FLOWS = {
  oc: { name: "一键成片", steps: ["拆分镜", "生成画面", "配音合成", "视频合成"], minutes: 12 },
  ds: { name: "导演级分镜", steps: ["解析剧本", "设计镜头", "生成提示词"], minutes: 4 }
};
var STATES = {
  parse: { label: "待制作", tone: "idle" },
  running: { label: "生成中", tone: "run" },
  failed: { label: "生成失败", tone: "bad" },
  ready: { label: "可创作", tone: "ready" },
  done: { label: "已成片", tone: "done" }
};
var FILTERS = [
  { id: "all", label: "全部" },
  { id: "parse", label: "待制作" },
  { id: "running", label: "生成中" },
  { id: "failed", label: "失败" },
  { id: "ready", label: "可创作" },
  { id: "done", label: "已成片" }
];
var view = { filter: "all", query: "" };
var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.6v8.8L12.4 8 5.5 3.6Z" fill="currentColor"/></svg>';
var ICON_RETRY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.8 6.2A5 5 0 1 0 13 9.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13.2 2.8v3.6H9.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function flowOf(ep) { return FLOWS[ep.task === "ds" ? "ds" : "oc"]; }

function epById(id) { return D.episodes.filter(function (x) { return x.id === id; })[0]; }

function coverOf(ep) {
  var scene = D.scenes.filter(function (s) { return s.image && s.eps.indexOf(ep.no) >= 0; })[0];
  return scene ? scene.image : "media/scenes/office.png";
}

function shortTitle(ep) { return ep.title.split("：")[1] || ep.title; }

function progressInfo(ep) {
  var flow = flowOf(ep);
  var n = flow.steps.length;
  var share = 100 / n;
  var idx = Math.min(n - 1, Math.floor(ep.pct / share));
  return {
    flow: flow,
    idx: idx,
    fills: flow.steps.map(function (_, i) {
      return i < idx ? 100 : i > idx ? 0 : Math.round((ep.pct - idx * share) / share * 100);
    }),
    left: Math.max(1, Math.ceil((100 - ep.pct) / 100 * flow.minutes))
  };
}

function progressHtml(ep) {
  var info = progressInfo(ep);
  return '<div class="ep-progress">' +
      '<div class="ep-progress-top"><span class="ep-progress-name"><i class="ep-pulse"></i><em class="ep-progress-flow">' + info.flow.name + "</em>·<em class=\"ep-progress-step\">" + info.flow.steps[info.idx] + "</em></span>" +
        '<b class="ep-progress-pct">' + ep.pct + "%</b></div>" +
      '<div class="ep-steps">' + info.flow.steps.map(function (name, i) {
        return '<span class="ep-step' + (i < info.idx ? " is-done" : i === info.idx ? " is-current" : "") + '"><i><b style="width:' + info.fills[i] + '%"></b></i><em>' + name + "</em></span>";
      }).join("") + "</div>" +
      '<div class="ep-progress-foot"><span class="ep-progress-left">预计剩余约 ' + info.left + " 分钟</span><span>完成后通知</span></div>" +
    "</div>";
}

function updateProgress(ep) {
  var card = epsEl.querySelector('[data-id="' + ep.id + '"]');
  var box = card && card.querySelector(".ep-progress");
  if (!box) return;
  var info = progressInfo(ep);
  box.querySelector(".ep-progress-step").textContent = info.flow.steps[info.idx];
  box.querySelector(".ep-progress-pct").textContent = ep.pct + "%";
  box.querySelector(".ep-progress-left").textContent = "预计剩余约 " + info.left + " 分钟";
  [].forEach.call(box.querySelectorAll(".ep-step"), function (el, i) {
    el.classList.toggle("is-done", i < info.idx);
    el.classList.toggle("is-current", i === info.idx);
    el.querySelector("b").style.width = info.fills[i] + "%";
  });
}

function actsHtml(ep) {
  if (ep.status === "ready") {
    return '<div class="ep-acts"><a class="btn purple ep-main" href="workspace.html">创作</a></div>';
  }
  if (ep.status === "done") {
    return '<div class="ep-acts"><a class="btn ep-main" href="workspace.html">编辑</a>' +
      '<button class="btn ep-ghost" type="button" data-act="preview">' + ICON_PLAY + "预览</button></div>";
  }
  if (ep.status === "running") return progressHtml(ep);
  if (ep.status === "failed") {
    var flow = flowOf(ep);
    return '<p class="ep-note is-bad">' + flow.steps[ep.failStep || 0] + "失败：" + (ep.failReason || "服务繁忙") + "，积分已退回</p>" +
      '<div class="ep-acts"><button class="btn oneclick" type="button" data-act="retry">' + ICON_RETRY + "重新生成</button></div>";
  }
  return '<div class="ep-acts">' +
      '<button class="btn oneclick" type="button" data-act="oneclick">' +
        '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M7 .8 2.9 6.7h2.3L4.8 11.2 9.1 5H6.6L7 .8Z" fill="currentColor"/></svg>' +
        "一键成片" +
      "</button>" +
      '<button class="btn" type="button" data-act="director">导演级分镜</button>' +
    "</div>";
}

function matchesView(ep) {
  if (view.query && ep.title.indexOf(view.query) < 0) return false;
  return view.filter === "all" || ep.status === view.filter;
}

function renderFilters() {
  var pool = D.episodes.filter(function (ep) { return !view.query || ep.title.indexOf(view.query) >= 0; });
  document.getElementById("ep-filters").innerHTML = FILTERS.map(function (f) {
    var n = f.id === "all" ? pool.length : pool.filter(function (ep) { return ep.status === f.id; }).length;
    if (!n && f.id !== "all" && f.id !== view.filter) return "";
    var on = view.filter === f.id;
    return '<button type="button" role="tab" data-filter="' + f.id + '" class="ep-filter' + (on ? " on" : "") + (f.id === "running" ? " is-live" : "") + (f.id === "failed" ? " is-bad" : "") + '" aria-selected="' + on + '">' +
      (f.id === "running" ? '<i class="ep-pulse"></i>' : "") + f.label + "<em>" + n + "</em></button>";
  }).join("");
}

function render() {
  document.getElementById("ep-count").textContent = "共 " + D.episodes.length + " 集";
  renderFilters();
  var list = D.episodes.filter(matchesView);
  document.getElementById("ep-empty").hidden = list.length > 0;
  epsEl.innerHTML = list.map(function (ep) {
    var state = STATES[ep.status] || STATES.parse;
    var ready = ep.status === "ready" || ep.status === "done";
    var meta = [ep.roles + " 角色", ep.scenes + " 场景", ep.props + " 道具"].concat(ep.shots ? [ep.shots + " 片段"] : []);
    return '<article class="ep-item is-tone-' + state.tone + (ep.fresh ? " is-fresh" : "") + '" data-id="' + ep.id + '" data-ready="' + ready + '">' +
      '<div class="ep-cover">' +
        '<img src="' + coverOf(ep) + '" alt="" loading="lazy" decoding="async" />' +
        '<span class="ep-cover-no">EP ' + (ep.no < 10 ? "0" : "") + ep.no + "</span>" +
        (ep.status === "done" ? '<span class="ep-cover-play">' + ICON_PLAY + '</span><span class="ep-cover-dur">' + (ep.duration || "01:00") + "</span>" : "") +
      "</div>" +
      '<div class="ep-body">' +
        '<div class="ep-head"><h3 title="' + ep.title + '">' + shortTitle(ep) + '</h3><span class="ep-badge">' + state.label + "</span></div>" +
        '<div class="ep-meta">' + meta.map(function (m) { return "<span>" + m + "</span>"; }).join("") + "</div>" +
        '<div class="ep-foot">' + actsHtml(ep) + "</div>" +
      "</div></article>";
  }).join("");
  D.episodes.forEach(function (ep) { ep.fresh = false; });
}

var oc = {
  ep: null,
  mask: document.getElementById("oc-mask"),
  desc: document.getElementById("oc-desc"),
  model: document.getElementById("oc-model"),
  res: document.getElementById("oc-res"),
  v20: document.getElementById("oc-v20"),
  speed: document.getElementById("oc-speed"),
  speedField: document.getElementById("oc-speed-field"),
  speedErr: document.getElementById("oc-speed-err"),
  lip: document.getElementById("oc-lip"),
  sub: document.getElementById("oc-sub"),
  upload: document.getElementById("oc-upload"),
  file: document.getElementById("oc-file"),
  tip: document.getElementById("oc-tip"),
  ok: document.getElementById("oc-ok"),
  hasAudio: false
};

function ocIsV20() { return oc.model.value === "v20"; }

function ocSeconds() {
  if (!ocIsV20()) return EP_SEC;
  if (oc.hasAudio) return AUDIO_SEC;
  var s = parseFloat(oc.speed.value);
  return Math.round(EP_SEC * 1.3 / (s >= 1 && s <= 1.5 ? s : 1.3));
}

function ocCost() { return ocSeconds() * RATE[oc.res.value]; }

function ocRefresh() {
  var v20 = ocIsV20();
  oc.v20.classList.toggle("hide", !v20);
  var s = parseFloat(oc.speed.value);
  var speedOk = !v20 || oc.hasAudio || (s >= 1 && s <= 1.5);
  oc.speed.classList.toggle("bad", !speedOk);
  oc.speedErr.textContent = speedOk ? "" : "语速需在 1.0–1.5 之间";
  oc.speedField.classList.toggle("disabled", oc.hasAudio);
  oc.upload.style.display = oc.hasAudio ? "none" : "";
  oc.file.classList.toggle("show", oc.hasAudio);

  var cost = ocCost();
  var enough = D.credits >= cost;
  oc.ok.textContent = "确认生成 · " + cost.toLocaleString("en-US") + " 积分";
  oc.ok.disabled = !speedOk || !enough;
  oc.tip.classList.toggle("bad", !enough);
  oc.tip.textContent = enough
    ? "预计 " + ocSeconds() + " 秒 × " + RATE[oc.res.value] + " 积分/秒" + (v20 && oc.hasAudio ? "（按音频时长）" : "")
    : "积分不足，请先充值";
}

function ocOpen(ep) {
  oc.ep = ep;
  oc.desc.textContent = ep.title + " · 确认后自动拆段并全量出片。整集重做请复制本集。";
  oc.model.value = "v25";
  oc.res.value = "480P";
  oc.speed.value = "1.3";
  oc.lip.classList.remove("on");
  oc.sub.classList.remove("on");
  oc.hasAudio = false;
  ocRefresh();
  oc.mask.classList.add("open");
}

function ocClose() {
  oc.mask.classList.remove("open");
  oc.ep = null;
}

function ocSubmit() {
  var ep = oc.ep;
  if (!ep || oc.ok.disabled || (ep.status !== "parse" && ep.status !== "failed")) return;
  oc.ok.disabled = true;
  D.credits -= ocCost();
  creditsEl.textContent = ReplicaUI.credits();
  ocClose();
  ReplicaUI.toast("已提交一键成片，预扣积分，结束后按实际成功秒数多退少补");
  runTask(ep, "oc");
}

function finishTask(ep) {
  var label = ep.title.split("：")[0];
  if (ep.task === "ds") {
    ep.status = "ready";
    ep.shots = ep.shots || 4 + ep.no % 5;
    ReplicaUI.toast(label + " 导演级分镜已生成，可以开始创作");
  } else {
    ep.status = "done";
    ep.shots = ep.shots || 4 + ep.no % 5;
    ep.duration = ep.duration || "00:" + (40 + ep.no % 20);
    ReplicaUI.toast(label + " 已成片，可预览或继续编辑");
  }
  ep.fresh = true;
  render();
}

function tick(ep) {
  var timer = setInterval(function () {
    ep.pct = Math.min(100, ep.pct + 3);
    if (ep.pct >= 100) {
      clearInterval(timer);
      finishTask(ep);
      return;
    }
    updateProgress(ep);
  }, 600);
}

function runTask(ep, task) {
  ep.status = "running";
  ep.task = task;
  ep.pct = 0;
  ep.failStep = null;
  ep.failReason = null;
  if (view.filter !== "all" && view.filter !== "running") view.filter = "all";
  render();
  tick(ep);
}

var DS_COST = { "480P": 40, "720P": 60, "1080P": 100 };
var ds = {
  ep: null,
  mask: document.getElementById("ds-mask"),
  res: document.getElementById("ds-res"),
  credit: document.getElementById("ds-credit"),
  ok: document.getElementById("ds-ok")
};

function dsCost() { return DS_COST[ds.res.value]; }

function dsRefresh() {
  var cost = dsCost();
  var enough = D.credits >= cost;
  ds.credit.innerHTML = enough
    ? "预计消耗 <b>" + cost + " 积分</b>，将根据所选分辨率计算；具体扣减以实际解析结果为准。"
    : "预计消耗 <b>" + cost + " 积分</b>，当前积分不足，请先充值。";
  ds.ok.disabled = !enough;
}

function dsOpen(ep) {
  ds.ep = ep;
  ds.res.value = "480P";
  dsRefresh();
  ds.mask.classList.add("open");
}

function dsClose() {
  ds.mask.classList.remove("open");
  ds.ep = null;
}

function dsSubmit() {
  var ep = ds.ep;
  if (!ep || ds.ok.disabled || (ep.status !== "parse" && ep.status !== "failed")) return;
  ds.ok.disabled = true;
  D.credits -= dsCost();
  creditsEl.textContent = ReplicaUI.credits();
  dsClose();
  ReplicaUI.toast("已提交导演级分镜任务");
  runTask(ep, "ds");
}

ds.res.onchange = dsRefresh;
ds.ok.onclick = dsSubmit;
document.getElementById("ds-close").onclick = dsClose;
document.getElementById("ds-cancel").onclick = dsClose;
ds.mask.onclick = function (e) { if (e.target === ds.mask) dsClose(); };

document.getElementById("oc-close").onclick = ocClose;
document.getElementById("oc-cancel").onclick = ocClose;
oc.mask.onclick = function (e) { if (e.target === oc.mask) ocClose(); };
oc.ok.onclick = ocSubmit;
oc.model.onchange = ocRefresh;
oc.res.onchange = ocRefresh;
oc.speed.oninput = ocRefresh;
oc.lip.onclick = function () { oc.lip.classList.toggle("on"); };
oc.sub.onclick = function () { oc.sub.classList.toggle("on"); };
oc.upload.onclick = function () { oc.hasAudio = true; ocRefresh(); };
document.getElementById("oc-reup").onclick = function () { ReplicaUI.toast("演示：重新选择音频文件"); };
document.getElementById("oc-play").onclick = function () { ReplicaUI.toast("演示：试听本集旁白.mp3"); };
document.getElementById("oc-del").onclick = function () { oc.hasAudio = false; ocRefresh(); };

render();
D.episodes.forEach(function (ep) { if (ep.status === "running") tick(ep); });

document.getElementById("ep-filters").onclick = function (e) {
  var btn = e.target.closest("[data-filter]");
  if (!btn) return;
  view.filter = btn.dataset.filter;
  render();
};
document.getElementById("ep-search").oninput = function () {
  view.query = this.value.trim();
  render();
};

epsEl.onclick = function (e) {
  var card = e.target.closest(".ep-item");
  if (!card) return;
  var act = e.target.closest("[data-act]");
  if (act) {
    var ep = epById(card.dataset.id);
    var name = act.getAttribute("data-act");
    if (name === "oneclick") ocOpen(ep);
    else if (name === "director") dsOpen(ep);
    else if (name === "retry") (ep.task === "ds" ? dsOpen : ocOpen)(ep);
    else if (name === "preview") ReplicaUI.toast("演示：播放" + ep.title.split("：")[0] + "成片");
    return;
  }
  if (e.target.closest("a")) return;
  if (card.dataset.ready === "true") location.href = "workspace.html";
};
document.getElementById("add-ep").onclick = function () { ReplicaUI.toast("演示：新增集"); };
