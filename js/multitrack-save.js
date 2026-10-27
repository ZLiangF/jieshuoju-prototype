/* 多轨编辑器 · 保存：状态（已保存 / 未保存 / 保存中 / 保存失败）、手动保存、延迟自动保存、刷新恢复、离开前保存。
   原型用 localStorage 代替服务端；?mock=save-fail 让第一次保存失败，用来演示重试。 */
(function () {
  var MT = window.MT;
  var KEY = "jieshuoju.multitrack.ep1.v2";
  var AUTO_SAVE_DELAY = 1500;
  var status = "saved";
  var savedAt = null;
  var timer = null;
  var mockFailed = false;

  try {
    var raw = localStorage.getItem(KEY);
    var saved = raw && JSON.parse(raw);
    if (saved && saved.doc && saved.doc.clips && saved.doc.clips.length) {
      MT.restore(JSON.stringify(saved.doc));
      MT.normalizeDoc();
      savedAt = saved.savedAt || null;
      MT.restoredFromSave = true;
    }
  } catch (error) {
    localStorage.removeItem(KEY);
  }

  function clock(time) {
    var date = new Date(time);
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  function write() {
    if (MT.mock["save-fail"] && !mockFailed) {
      mockFailed = true;
      throw new Error("mock save failure");
    }
    savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify({ savedAt: savedAt, doc: MT.doc }));
  }

  MT.renderSaveStatus = function () {
    var el = MT.$("#save-status");
    if (!el) return;
    var text = {
      saved: savedAt ? "已保存 " + clock(savedAt) : "已保存",
      dirty: "有未保存的修改",
      saving: "保存中…",
      failed: "保存失败"
    }[status];
    el.className = "mt-saved is-" + status;
    el.innerHTML = "<i></i><span>" + text + "</span>" + (status === "failed" ? '<button type="button" data-act="retry-save">重试</button>' : "");
  };

  MT.markDirty = function () {
    if (status !== "saving") status = "dirty";
    MT.renderSaveStatus();
    clearTimeout(timer);
    timer = setTimeout(function () { MT.saveNow(false); }, AUTO_SAVE_DELAY);
  };

  MT.isSaved = function () { return status === "saved"; };

  MT.saveNow = function (manual) {
    clearTimeout(timer);
    status = "saving";
    MT.renderSaveStatus();
    setTimeout(function () {
      try {
        write();
        status = "saved";
        if (manual) MT.toast("已保存");
      } catch (error) {
        status = "failed";
        MT.toast("保存失败，修改仍保留在当前页面，可点顶部「重试」");
      }
      MT.renderSaveStatus();
    }, 450);
  };

  window.addEventListener("beforeunload", function (event) {
    if (status === "saved") return;
    try {
      write();
    } catch (error) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  if (MT.restoredFromSave) setTimeout(function () { MT.toast("已恢复上次保存的编辑内容" + (savedAt ? "（" + clock(savedAt) + "）" : "")); }, 300);
})();
