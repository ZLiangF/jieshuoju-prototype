document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  if (!document.getElementById("img-edit").hidden) { closeImageEditor(false); return; }
  if (document.getElementById("asset-generate-dialog").classList.contains("open")) { closeGenerationConfirm(); return; }
  if (document.getElementById("asset-delete-dialog").classList.contains("open")) { closeDeleteConfirm(); return; }
  if (!document.getElementById("episode-filter-menu").hidden) { closeEpisodeFilter(); return; }
  if (!document.getElementById("model-menu").hidden || !document.getElementById("ratio-popover").hidden || !document.getElementById("type-menu").hidden) { closeGenPanels(); return; }
  if (!document.getElementById("episode-editor").hidden) closeEpisodeEditor();
  else if (document.getElementById("reference-dialog").classList.contains("open")) closeReferenceDialog();
  else if (document.getElementById("rewrite-dialog").classList.contains("open")) {
    if (!document.getElementById("rewrite-model-menu").hidden) closeRewriteModelMenu();
    else closeRewriteDialog();
  }
  else if (document.getElementById("voice-dialog").classList.contains("open")) document.getElementById("voice-cancel").onclick();
  else if (document.getElementById("role-dialog").classList.contains("open")) closeRole();
  else if (document.getElementById("plain-dialog").classList.contains("open")) closePlain();
  else if (document.getElementById("look-dialog").classList.contains("open") && lookMultiOn) {
    lookMultiOn = false;
    selectedLooks = {};
    renderLookLibrary();
  }
  else if (document.getElementById("look-dialog").classList.contains("open")) closeLookDialog();
  else if (multiOn) setMultiSelect(false);
});

paintGenControls();
paintEpisodeFilter();
render();
