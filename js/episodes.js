var D = ReplicaData;
var promoClosed = false;
var RATE = { "480P": 2, "720P": 3, "1080P": 5 };
var EP_SEC = 60;
var AUDIO_SEC = 72;
var creditsEl = document.getElementById("credits");
var epsEl = document.getElementById("eps");
creditsEl.textContent = ReplicaUI.credits();

function directorBtn(showPromo) {
  return '<div class="comment-promo is-on">' +
      '<span class="promo-halo" aria-hidden="true"></span>' +
      '<button class="btn" type="button" data-act="director">导演级分镜</button>' +
      (showPromo
        ? '<div class="promo-bubble' + (promoClosed ? "" : " show") + '" role="status">' +
            "<span>解说剧导演级分镜 V 2.5<br>焕新上线，成片效果全面升级</span>" +
            '<button type="button" class="promo-x" aria-label="关闭提示">✕</button>' +
            '<i class="promo-arrow"></i>' +
          "</div>"
        : "") +
    "</div>";
}

function actsHtml(ep, showPromo) {
  if (ep.status === "ready") {
    return '<div class="ep-status">解析完成，开始制作视频</div><div class="ep-acts"><a class="btn" href="workspace.html">编辑</a></div>';
  }
  if (ep.status === "done") {
    return '<div class="ep-status">已成片</div><div class="ep-acts"><a class="btn" href="workspace.html">进入编辑</a></div>';
  }
  if (ep.status === "running") {
    return '<div class="ep-running"><span>' + (ep.task === "ds" ? "导演级分镜生成中" : "一键成片生成中") + '</span><span class="bar"><i style="width:' + ep.pct + '%"></i></span><span>' + ep.pct + "%</span></div>";
  }
  return '<div class="ep-acts">' +
      '<button class="btn oneclick" type="button" data-act="oneclick">' +
        '<svg viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M7 .8 2.9 6.7h2.3L4.8 11.2 9.1 5H6.6L7 .8Z" fill="currentColor"/></svg>' +
        "一键成片" +
      "</button>" +
      directorBtn(showPromo) +
    "</div>";
}

function render() {
  var promoUsed = false;
  document.getElementById("ep-count").textContent = "共 " + D.episodes.length + " 集";
  epsEl.innerHTML = D.episodes.map(function (ep) {
    var ready = ep.status === "ready" || ep.status === "done";
    var idle = ep.status === "parse";
    var showPromo = idle && !promoUsed;
    if (showPromo) promoUsed = true;
    return '<article class="ep-item' + (showPromo ? " has-promo" : "") + '" data-id="' + ep.id + '" data-ready="' + ready + '">' +
      '<div class="ep-no">' + ep.no + "</div>" +
      '<div class="ep-cover">' + (ready ? "☰" : "◷") + "</div>" +
      "<div><h3>" + ep.title + "</h3>" +
      '<div class="ep-meta"><span>' + ep.roles + " 角色</span><span>" + ep.scenes + " 场景</span><span>" + ep.props + " 道具</span>" +
      (ep.shots ? "<span>" + ep.shots + " 片段</span>" : "") + "</div>" +
      actsHtml(ep, showPromo) +
      "</div></article>";
  }).join("");
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
  if (!ep || oc.ok.disabled || ep.status !== "parse") return;
  oc.ok.disabled = true;
  D.credits -= ocCost();
  creditsEl.textContent = ReplicaUI.credits();
  ocClose();
  ReplicaUI.toast("已提交一键成片，预扣积分，结束后按实际成功秒数多退少补");
  runTask(ep, "oc", "done", "已成片");
}

function runTask(ep, task, doneStatus, doneMsg) {
  ep.status = "running";
  ep.task = task;
  ep.pct = 0;
  render();
  var timer = setInterval(function () {
    ep.pct = Math.min(100, ep.pct + 10);
    if (ep.pct >= 100) {
      clearInterval(timer);
      ep.status = doneStatus;
      ReplicaUI.toast(ep.title.split("：")[0] + " " + doneMsg);
    }
    render();
  }, 800);
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
  if (!ep || ds.ok.disabled || ep.status !== "parse") return;
  ds.ok.disabled = true;
  D.credits -= dsCost();
  creditsEl.textContent = ReplicaUI.credits();
  dsClose();
  ReplicaUI.toast("已提交导演级分镜任务");
  runTask(ep, "ds", "ready", "导演级分镜已生成");
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

epsEl.onclick = function (e) {
  var close = e.target.closest(".promo-x");
  if (close) {
    e.preventDefault();
    e.stopPropagation();
    promoClosed = true;
    close.closest(".promo-bubble").classList.remove("show");
    return;
  }
  var card = e.target.closest(".ep-item");
  if (!card) return;
  var act = e.target.closest("[data-act]");
  if (act) {
    var ep = D.episodes.filter(function (x) { return x.id === card.dataset.id; })[0];
    if (act.getAttribute("data-act") === "oneclick") ocOpen(ep);
    else if (act.getAttribute("data-act") === "director") dsOpen(ep);
    return;
  }
  if (e.target.closest("a")) return;
  if (card.dataset.ready === "true") location.href = "workspace.html";
};
document.getElementById("add-ep").onclick = function () { ReplicaUI.toast("演示：新增集"); };
