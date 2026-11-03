/* 多轨编辑器 · 保存：状态（已保存 / 未保存 / 保存中 / 保存失败）、手动保存、5–10 秒自动保存、
   服务端(localStorage) + 本地草稿兜底、刷新恢复、失败重试。?mock=save-fail 演示失败。 */
(function () {
  var MT = window.MT;
  var KEY = "jieshuoju.multitrack.ep1.v2";
  var DRAFT_KEY = "jieshuoju.multitrack.ep1.draft";
  var AUTO_SAVE_DELAY = 6000;
  var status = "saved";
  var savedAt = null;
  var timer = null;
  var mockFailed = false;
  var pendingDraft = null;

  function clock(time) {
    var date = new Date(time);
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }

  function writeServer() {
    if (MT.mock["save-fail"] && !mockFailed) {
      mockFailed = true;
      throw new Error("mock save failure");
    }
    savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify({ savedAt: savedAt, doc: MT.doc }));
  }

  function writeDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), doc: MT.doc }));
    } catch (error) {}
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (error) {}
  }

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

  try {
    var draftRaw = localStorage.getItem(DRAFT_KEY);
    var draft = draftRaw && JSON.parse(draftRaw);
    if (draft && draft.doc && draft.doc.clips && draft.doc.clips.length) {
      if (!savedAt || (draft.savedAt || 0) > savedAt + 500) {
        pendingDraft = draft;
      }
    }
  } catch (error) {
    clearDraft();
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
    if (MT.state && MT.state.readonly) return;
    if (status !== "saving") status = "dirty";
    MT.renderSaveStatus();
    writeDraft();
    clearTimeout(timer);
    timer = setTimeout(function () { MT.saveNow(false); }, AUTO_SAVE_DELAY);
  };

  MT.isSaved = function () { return status === "saved"; };

  MT.saveNow = function (manual) {
    if (MT.state && MT.state.readonly) return MT.toast("只读模式，无法保存");
    clearTimeout(timer);
    status = "saving";
    MT.renderSaveStatus();
    setTimeout(function () {
      try {
        writeServer();
        clearDraft();
        status = "saved";
        if (manual) MT.toast("已保存");
      } catch (error) {
        status = "failed";
        writeDraft();
        MT.toast("保存失败，已写入本地草稿，可点顶部「重试」");
        setTimeout(function () {
          if (status === "failed") MT.saveNow(false);
        }, 2500);
      }
      MT.renderSaveStatus();
    }, 450);
  };

  MT.applyDraftRestore = function (restore) {
    var modal = MT.$("#draft-modal");
    if (modal) modal.hidden = true;
    if (restore && pendingDraft) {
      MT.restore(JSON.stringify(pendingDraft.doc));
      MT.normalizeDoc();
      MT.renderAll && MT.renderAll();
      MT.toast("已恢复本地草稿");
      MT.markDirty();
    } else {
      clearDraft();
      MT.toast("已放弃本地草稿");
    }
    pendingDraft = null;
  };

  window.addEventListener("beforeunload", function (event) {
    if (status === "saved") return;
    try {
      writeDraft();
      writeServer();
    } catch (error) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  if (pendingDraft) {
    setTimeout(function () {
      var modal = MT.$("#draft-modal");
      if (modal) modal.hidden = false;
    }, 400);
  } else if (MT.restoredFromSave) {
    setTimeout(function () { MT.toast("已恢复上次保存的编辑内容" + (savedAt ? "（" + clock(savedAt) + "）" : "")); }, 300);
  }
})();
