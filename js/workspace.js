(function () {
  var D = ReplicaData;
  var state = { shotId: D.shots[0].id, tab: "all", query: "", modelOpen: false, generating: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function shot() { return D.shots.find(function (x) { return x.id === state.shotId; }); }
  function allAssets() { return D.characters.concat(D.scenes, D.props); }
  function byId(id) { return allAssets().find(function (a) { return a.id === id; }); }

  document.getElementById("credits").textContent = ReplicaUI.credits();

  function card(a, extra) {
    return '<button class="acard ' + (extra || "") + '" data-asset="' + a.id + '"><div class="thumb"><img src="' + a.image + '"></div><div class="name">' + (a.look ? a.name + "-" + a.look : a.name) + "</div></button>";
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
    $("#shot-title").textContent = "片段 " + s.no;
    $("#shot-scene").textContent = s.scene;
    $("#prompt").value = D.prompt;
    $("#dur").value = s.duration;
    $("#time-label").textContent = "00:00 / 00:" + String(s.duration).padStart(2, "0");
    $("#model-menu").innerHTML = D.models.map(function (m) {
      return '<button type="button" data-model="' + m.id + '" style="width:100%;height:34px;border-radius:8px;display:flex;justify-content:space-between;padding:0 10px;align-items:center">' + m.name + "<span>" + m.cost + "</span></button>";
    }).join("");
    $("#model-menu").style.display = state.modelOpen ? "block" : "none";
    $("#gen-btn").textContent = state.generating ? "生成中…" : "生成视频 150";
    $("#stage").innerHTML = state.generating ? '<div class="spin"></div><div style="margin-top:8px">片段生成中</div>' : "暂无视频";
  }

  function renderTimeline() {
    $("#tl-track").innerHTML = D.shots.map(function (s) {
      return '<button class="tcard' + (s.id === state.shotId ? " on" : "") + '" data-shot="' + s.id + '"><span class="num">' + s.no + '</span><div class="clock"></div><span class="dur">00:' + String(s.duration).padStart(2, "0") + "</span></button>";
    }).join("");
    $("#shot-list").innerHTML = D.shots.map(function (s) {
      return '<div class="shot-row" data-shot="' + s.id + '" style="padding:8px 0;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.06)"><b>片段 ' + s.no + "</b> · " + s.title + " · " + s.duration + "s</div>";
    }).join("");
  }

  function renderAll() { renderAssets(); renderEditor(); renderTimeline(); }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act],[data-shot],[data-tab],[data-asset],[data-model]");
    if (!e.target.closest(".model-wrap")) state.modelOpen = false;
    if (!t) { renderEditor(); return; }
    if (t.dataset.shot) { state.shotId = t.dataset.shot; $("#list-drawer").classList.remove("open"); renderAll(); return; }
    if (t.dataset.tab) {
      state.tab = t.dataset.tab;
      $$(".asset-tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === state.tab); });
      renderAssets(); return;
    }
    if (t.dataset.asset) { ReplicaUI.toast("已选中 " + byId(t.dataset.asset).name); return; }
    if (t.dataset.model) {
      var m = D.models.find(function (x) { return x.id === t.dataset.model; });
      $("#model-name").textContent = m.name;
      $("#gen-cost").textContent = m.cost;
      state.modelOpen = false; renderEditor(); return;
    }
    var act = t.getAttribute("data-act");
    if (act === "list") $("#list-drawer").classList.add("open");
    if (act === "close-list") $("#list-drawer").classList.remove("open");
    if (act === "export") ReplicaUI.toast("当前集还没有可导出的成片");
    if (act === "close-export") $("#export-modal").classList.remove("open");
    if (act === "add") ReplicaUI.toast("演示：新增素材");
    if (act === "toggle-model") { state.modelOpen = !state.modelOpen; renderEditor(); }
    if (act === "rewrite") ReplicaUI.toast("演示：AI 改写提示词");
    if (act === "timer") ReplicaUI.toast("演示：定时生成");
    if (act === "full") ReplicaUI.toast("演示：全屏编辑");
    if (act === "generate") {
      state.generating = true; renderEditor();
      ReplicaUI.toast("已提交生成 · 150 积分");
      setTimeout(function () {
        state.generating = false;
        $("#stage").innerHTML = '<img src="media/scenes/cemetery.png" style="width:100%;height:100%;object-fit:cover">';
        ReplicaUI.toast("片段 " + shot().no + " 生成完成");
      }, 1800);
    }
  });
  $("#asset-search").oninput = function () { state.query = this.value; renderAssets(); };
  renderAll();
})();
