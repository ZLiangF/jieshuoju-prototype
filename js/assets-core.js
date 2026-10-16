var D = ReplicaData;
document.getElementById("credits").textContent = ReplicaUI.credits();
var TRASH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.8 4.3h10.4M6.3 4.3V2.9h3.4v1.4M4.2 4.3l.6 8.4c.05.6.5 1 1.1 1h4.2c.6 0 1.05-.4 1.1-1l.6-8.4M6.7 7v4.2M9.3 7v4.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var EMPTY_PERSON_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.3" r="3.1" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 18.6c0-2.3 2.7-3.9 6-3.9s6 1.6 6 3.9c0 .6-.5 1-1 1H7c-.5 0-1-.4-1-1Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
var EMPTY_IMAGE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5.5" width="15" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="9.3" cy="10" r="1.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m5.5 17 4.3-4 3 2.6 2.4-2.1 3.3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var tab = "char";
var editorKind = "char";
var currentChar = D.characters[0];
var editingLook = null;
var lookViewMode = "flat";
var lookMultiOn = false;
var selectedLooks = {};
var previewRailOpen = false;
var previewRailTab = "history";
var previewRailSrc = "";
var imgEdit = { scale: 1, rotate: 0, x: 0, y: 0, locked: false, cropping: false, crop: null };
var historySelectedId = "";
var newLookParentId = "";
var roleCreateMode = "asset";
var roleEpsNumbers = [];
var expandedLooks = {};
var episodePanelIndex = -1;
var episodeDraftNumbers = [];
var episodeDraftValid = true;
var lookDirty = false;
var PROMPT_LIMIT = 2000;
var imageAnalysisSeq = 0;
var lookImageMode = "upload";
var lookGenerationSeq = 0;
var voiceBeforeEdit = "";
var pendingReferenceSrc = "";
var referenceImageValue = "";
var referenceAssetChoices = [];

var query = "";
var episodeFilterNumbers = [];
var multiOn = false;
var expandedChars = {};
var roleTier = "配角";
var ROLE_TONES = { "主角": "lead", "配角": "support", "群演": "extra" };
var SUB_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.6" y="2.2" width="9.2" height="7.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.2 6.2v6c0 .9.7 1.6 1.6 1.6h6.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
var VOICE_OFF_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 11.6V4.1l6.4-1.3v7.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4.6" cy="11.6" r="1.55" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="10.1" r="1.55" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
var VOICE_ON_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.2 11.5V3.9l6.4-1.3v7.4" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4.6" cy="11.5" r="1.7" fill="currentColor"/><circle cx="11" cy="10" r="1.7" fill="currentColor"/></svg>';
var PLUS_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
var READY_MARK = '<span class="asset-done" role="img" aria-label="已完成" title="已完成"><svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="7" fill="currentColor"/><path d="M4.2 7.2 6.1 9 9.8 5.2" fill="none" stroke="#0f1f17" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
function cleanText(value, limit) {
  return String(value || "").replace(/[<>"&]/g, "").replace(/\s+/g, " ").trim().slice(0, limit);
}

var selectedAssets = {};
var revealedAssets = {};
var revealedLooks = {};
var ASSET_GENERATION_COSTS = {
  "gpt-25-flare": { "1K": 2, "2K": 3, "4K": 5 },
  "gpt-25-sunburst": { "1K": 3, "2K": 5, "4K": 8 },
  "gpt-2": { "1K": 2, "2K": 3, "4K": 5 },
  "nano-banana-21": { "512P": 1, "1K": 2, "2K": 3, "4K": 5 },
  "banana-2": { "512P": 1, "1K": 2, "2K": 3, "4K": 5 },
  "nano-banana-2-lite": { "1K": 1 },
  "banana-pro": { "1K": 3, "2K": 5, "4K": 8 },
  "seedream-5": { "1K": 3, "2K": 5 }
};
var pendingGenerationMode = "";
var bulkGenerationChoice = { model: "banana-2", quality: "2K" };
var FIRST_REVEAL = {
  xiaoming: true, hezhi: true, cuiguihua: true, sucheng: true,
  cemetery: true, meeting: true, banquet: true, rainst: true, xmoffice: true,
  ebike: true, incense: true, phone: true
};

function inEpisode(item) {
  if (!episodeFilterNumbers.length) return true;
  var eps = item.eps || [];
  return episodeFilterNumbers.some(function (n) { return eps.indexOf(n) !== -1; });
}

function rowsOf(kind) {
  var list = kind === "char" ? D.characters : kind === "scene" ? D.scenes : D.props;
  return list.map(function (item, i) { return { kind: kind, item: item, i: i }; })
    .filter(function (row) { return inEpisode(row.item); });
}

function isLookRevealed(item, look) {
  if (!revealedAssets[item.id]) return false;
  if (!look || revealedLooks[item.id + "/" + look.id]) return true;
  if (D.characters.indexOf(item) !== -1) return false;
  return look.status !== "pending";
}

function assetLookStats(a) {
  var looks = a.looksList || [];
  if (!looks.length) return { total: 1, done: revealedAssets[a.id] ? 1 : 0 };
  var done = looks.filter(function (look) { return isLookRevealed(a, look); }).length;
  return { total: looks.length, done: done };
}

function assetState(a) {
  var stats = assetLookStats(a);
  if (!stats.done && a.status === "generating") return "generating";
  if (!stats.done && a.status === "failed") return "failed";
  if (!stats.done) return "pending";
  return stats.done < stats.total ? "partial" : "ready";
}

function revealItemLooks(item, filter) {
  var looks = item.looksList || [];
  var count = 0;
  if (!looks.length) {
    if (!revealedAssets[item.id] && (!filter || filter(null))) {
      revealedAssets[item.id] = true;
      count = 1;
    }
    return count;
  }
  looks.forEach(function (look) {
    if (isLookRevealed(item, look)) return;
    if (filter && !filter(look)) return;
    revealedAssets[item.id] = true;
    revealedLooks[item.id + "/" + look.id] = true;
    if (look.status === "pending") delete look.status;
    count++;
  });
  return count;
}
