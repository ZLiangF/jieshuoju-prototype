(function () {
  var D = ReplicaData;
  var state = {
    shotId: D.shots[0].id,
    tab: "all",
    query: "",
    selectedModel: "seedance-2.0",
    resolution: "720P",
    modelOpen: false,
    resolutionOpen: false,
    generating: null,
    upgrading: null,
    videos: {}
  };
  var finalResolution = "1080P";
  var finalCost = 240;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function shot() { return D.shots.find(function (x) { return x.id === state.shotId; }); }
  function model() { return D.models.find(function (x) { return x.id === state.selectedModel; }); }
  function allAssets() { return D.characters.concat(D.scenes, D.props); }
  function byId(id) { return allAssets().find(function (a) { return a.id === id; }); }

  document.getElementById("credits").textContent = ReplicaUI.credits();

  function card(a, extra) {
    return '<button class="acard ' + (extra || "") + '" data-asset="' + a.id + '"><div class="thumb"><img loading="lazy" decoding="async" src="' + a.image + '"></div><div class="name">' + (a.look ? a.name + "-" + a.look : a.name) + "</div></button>";
  }

  function renderAssets() {
    var q = state.query;
    var html = "";
    if (state.tab === "material") html = '<div style="color:#6b6674;padding:40px 0;text-align:center">素材库为空</div>';
    else if (state.tab === "clip") {
      var refs = (shot().refs || []).map(byId).filter(Boolean);
      html = refs.length ? '<div class="grid-2">' + refs.map(function (a) { return card(a, a.looks ? "" : "scene"); }).join("") + "</div>" : '<div style="color:#6b6674;padding:40px 0;text-align:center">当前片段暂无引用资产</div>';
    } else {
      var chars = D.characters.filter(function (a) { return !q || a.name.indexOf(q) > -1; });
      var scenes = D.scenes.filter(function (a) { return !q || a.name.indexOf(q) > -1; });
      var props = D.props.filter(function (a) { return !q || a.name.indexOf(q) > -1; });
      html += '<div class="cat"><div class="cat-h"><span>角色 (' + chars.length + ")</span></div><div class=\"grid-2\">" + chars.map(function (a) { return card(a); }).join("") + "</div></div>";
      html += '<div class="cat"><div class="cat-h"><span>场景 (' + scenes.length + ")</span></div><div class=\"grid-2\">" + scenes.map(function (a) { return card(a, "scene"); }).join("") + "</div></div>";
      html += '<div class="cat"><div class="cat-h"><span>道具 (' + props.length + ")</span></div><div class=\"grid-2\">" + props.map(function (a) { return card(a, "prop"); }).join("") + "</div></div>";
    }
    $("#asset-scroll").innerHTML = html;
    $("#tab-all").textContent = "资产 (" + (D.characters.length + D.scenes.length + D.props.length) + ")";
    $("#tab-clip").textContent = "当前片段 (" + (shot().refs || []).length + ")";
  }

  function renderEditor() {
    var s = shot();
    var m = model();
    var video = state.videos[s.id];
    $("#shot-title").textContent = "片段 " + s.no;
    $("#shot-scene").textContent = s.scene;
    $("#prompt").value = D.prompt;
    $("#dur").value = s.duration;
    $("#time-label").textContent = "00:00 / 00:" + String(s.duration).padStart(2, "0");
    $("#model-menu").innerHTML = D.models.map(function (m) {
      var tag = m.tag ? '<span class="model-tag' + (m.draft ? "" : " normal") + '">' + m.tag + "</span>" : "";
      var sub = m.draft ? "480P 低成本预览 · 可升级正片" : "正式视频生成";
      return '<button class="model-option' + (m.id === state.selectedModel ? " on" : "") + '" type="button" data-model="' + m.id + '">' +
        '<span><span class="model-title">' + m.name + tag + '</span><small>' + sub + '</small></span>' +
        '<span class="cost">' + m.cost + " 积分</span></button>";
    }).join("");
    $("#model-menu").classList.toggle("open", state.modelOpen);
    $("#resolution-menu").classList.toggle("open", state.resolutionOpen);
    $("#model-name").innerHTML = m.name + (m.draft ? ' <span class="draft-tag">样片</span>' : "");
    $("#resolution-name").textContent = state.resolution;
    $$("#resolution-menu button").forEach(function (b) {
      b.disabled = !!m.draft && b.dataset.resolution !== "480P";
      b.classList.toggle("on", b.dataset.resolution === state.resolution);
    });
    $("#resolution-btn").title = m.draft ? "样片模式固定生成 480P" : "选择生成分辨率";
    $("#draft-hint").classList.toggle("show", !!m.draft);
    $("#gen-btn").innerHTML = state.generating === s.id
      ? "生成中…"
      : (m.draft ? '生成样片 <span id="gen-cost">' + m.cost + "</span>" : '生成视频 <span id="gen-cost">' + m.cost + "</span>");
    $("#gen-btn").disabled = !!state.generating || !!state.upgrading;

    if (state.generating === s.id) {
      $("#stage").innerHTML = '<div class="stage-loading"><div class="spin"></div><div style="margin-top:8px">' + (m.draft ? "480P 样片生成中" : "片段生成中") + "</div></div>";
    } else if (state.upgrading === s.id) {
      $("#stage").innerHTML = '<div class="stage-loading"><div class="spin"></div><div style="margin-top:8px">正在基于样片生成 ' + finalResolution + " 正片</div></div>";
    } else if (video) {
      $("#stage").innerHTML = '<img class="video-frame" src="media/scenes/cemetery.png" alt="片段视频">' +
        (video.kind === "draft"
          ? '<button class="upgrade-trigger" data-act="upgrade">✦ 生成 1080P 正片</button><span class="draft-watermark">Seedance 2.5 · 样片 480P</span>'
          : '<span class="player-status"><i></i>Seedance 2.5 正片 · ' + video.resolution + "</span>");
    } else {
      $("#stage").textContent = "暂无视频";
    }
  }

  function renderTimeline() {
    $("#tl-track").innerHTML = D.shots.map(function (s) {
      var v = state.videos[s.id];
      var label = v ? (v.kind === "draft" ? "样片" : v.resolution) : "未生成";
      return '<button class="tcard' + (s.id === state.shotId ? " on" : "") + '" data-shot="' + s.id + '"><span class="num">' + s.no + '</span><span class="state' + (v && v.kind === "draft" ? " draft" : "") + '">' + label + '</span><div class="clock"></div><span class="dur">00:' + String(s.duration).padStart(2, "0") + "</span></button>";
    }).join("");
    $("#shot-list").innerHTML = D.shots.map(function (s) {
      var v = state.videos[s.id];
      var label = v ? (v.kind === "draft" ? "样片 · 480P" : "正片 · " + v.resolution) : "未生成";
      return '<button type="button" class="shot-row' + (s.id === state.shotId ? " on" : "") + '" data-shot="' + s.id + '">' +
        '<span class="shot-no">' + s.no + '</span><span><b>' + s.title + '</b><small>' + s.scene + " · " + s.duration + 's</small></span>' +
        '<span class="shot-state' + (v && v.kind === "draft" ? " draft" : "") + '">' + label + "</span></button>";
    }).join("");
  }

  function renderAll() { renderAssets(); renderEditor(); renderTimeline(); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act],[data-shot],[data-tab],[data-asset],[data-model],[data-resolution]");
    if (!e.target.closest(".model-wrap")) {
      state.modelOpen = false;
      state.resolutionOpen = false;
    }
    if (!t) { renderEditor(); return; }
    if (t.dataset.shot) { state.shotId = t.dataset.shot; $("#list-drawer").classList.remove("open"); renderAll(); return; }
    if (t.dataset.tab) {
      state.tab = t.dataset.tab;
      $$(".asset-tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === state.tab); });
      renderAssets(); return;
    }
    if (t.dataset.asset) { ReplicaUI.toast("已选中 " + byId(t.dataset.asset).name); return; }
    if (t.dataset.model) {
      state.selectedModel = t.dataset.model;
      state.resolution = model().draft ? "480P" : "720P";
      state.modelOpen = false;
      renderEditor();
      return;
    }
    if (t.dataset.resolution) {
      if (!t.disabled) state.resolution = t.dataset.resolution;
      state.resolutionOpen = false;
      renderEditor();
      return;
    }
    var act = t.getAttribute("data-act");
    if (act === "list") $("#list-drawer").classList.add("open");
    if (act === "close-list") $("#list-drawer").classList.remove("open");
    if (act === "export") ReplicaUI.toast("当前集还没有可导出的成片");
    if (act === "close-export") $("#export-modal").classList.remove("open");
    if (act === "add") ReplicaUI.toast("演示：新增素材");
    if (act === "toggle-model") {
      state.modelOpen = !state.modelOpen;
      state.resolutionOpen = false;
      renderEditor();
    }
    if (act === "toggle-resolution") {
      state.resolutionOpen = !state.resolutionOpen;
      state.modelOpen = false;
      renderEditor();
    }
    if (act === "rewrite") ReplicaUI.toast("演示：AI 改写提示词");
    if (act === "timer") ReplicaUI.toast("演示：定时生成");
    if (act === "full") ReplicaUI.toast("演示：全屏编辑");
    if (act === "upgrade") {
      var upgradingShot = state.shotId;
      state.upgrading = upgradingShot;
      D.credits -= finalCost;
      $("#credits").textContent = ReplicaUI.credits();
      renderAll();
      ReplicaUI.toast("Step 2 已提交 · " + finalResolution + " 正片独立计费");
      setTimeout(function () {
        state.videos[upgradingShot] = { kind: "final", resolution: finalResolution, model: "seedance-2.5" };
        state.upgrading = null;
        renderAll();
        ReplicaUI.toast("正片生成完成 · " + finalResolution);
      }, 1800);
    }
    if (act === "generate") {
      var generatingShot = state.shotId;
      var generatingModel = model();
      var generatingResolution = state.resolution;
      state.generating = generatingShot;
      D.credits -= generatingModel.cost;
      $("#credits").textContent = ReplicaUI.credits();
      renderAll();
      ReplicaUI.toast(generatingModel.draft ? "Step 1 已提交 · 480P 样片独立计费" : "已提交生成 · " + generatingModel.cost + " 积分");
      setTimeout(function () {
        state.videos[generatingShot] = {
          kind: generatingModel.draft ? "draft" : "final",
          resolution: generatingResolution,
          model: generatingModel.id
        };
        state.generating = null;
        renderAll();
        ReplicaUI.toast(generatingModel.draft ? "480P 样片生成完成，可继续生成正片" : "片段生成完成");
      }, 1800);
    }
  });

  $("#asset-search").oninput = function () { state.query = this.value; renderAssets(); };
  renderAll();
})();
