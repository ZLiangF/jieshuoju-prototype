/* 多轨编辑器 · 弹窗：二次确认。导出入口只提交任务，不做检查、参数和进度。 */
(function () {
  var MT = window.MT;
  var esc = MT.escapeHtml;

  var dialog = document.createElement("div");
  dialog.className = "mt-dialog";
  dialog.hidden = true;
  dialog.innerHTML = '<div class="mt-dialog-card" role="dialog" aria-modal="true" aria-labelledby="mt-dialog-title"></div>';
  document.body.appendChild(dialog);
  var card = dialog.firstElementChild;

  function openDialog(html) {
    card.className = "mt-dialog-card";
    card.innerHTML = html;
    dialog.hidden = false;
    MT.stopPlayback();
    MT.closeMenu();
    var focus = card.querySelector("[data-autofocus]") || card.querySelector("button:not([disabled])");
    if (focus) focus.focus();
  }

  MT.closeDialog = function () {
    dialog.hidden = true;
    card.innerHTML = "";
  };

  MT.dialogOpen = function () { return !dialog.hidden; };

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog || event.target.closest("[data-dialog-close]")) MT.closeDialog();
  });

  MT.confirm = function (opts) {
    openDialog('<h3 id="mt-dialog-title">' + esc(opts.title) + "</h3><p class=\"mt-dialog-text\">" + esc(opts.body) + "</p>" +
      '<div class="mt-dialog-foot"><button type="button" data-dialog-close data-autofocus>取消</button>' +
      '<button type="button" class="' + (opts.danger ? "is-danger" : "is-primary") + '" data-confirm-ok>' + esc(opts.ok || "确定") + "</button></div>");
    card.querySelector("[data-confirm-ok]").addEventListener("click", function () {
      MT.closeDialog();
      opts.onOk();
    });
  };

  function closeExportMenu() {
    var menu = MT.$("#export-menu");
    var button = MT.$('[data-act="export"]');
    if (!menu) return;
    menu.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  MT.openExport = function (button) {
    var menu = MT.$("#export-menu");
    if (!menu) return;
    var open = menu.hidden;
    menu.hidden = !open;
    if (button) button.setAttribute("aria-expanded", open ? "true" : "false");
  };

  MT.exportVideo = function () {
    closeExportMenu();
    if (!MT.isSaved()) MT.saveNow(false);
    MT.toast("已导出成片");
  };

  MT.exportXml = function () {
    closeExportMenu();
    if (!MT.isSaved()) MT.saveNow(false);
    MT.toast("已导出 XML 工程包");
  };

  document.addEventListener("click", function (event) {
    if (!event.target.closest(".mt-export-wrap")) closeExportMenu();
  }, true);
})();
