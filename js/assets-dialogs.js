function createKind() {
  return roleCreateMode === "child" ? editorKind : tab;
}

function createWord() {
  if (roleCreateMode === "child") return assetWord();
  var kind = createKind();
  return kind === "scene" ? "场景" : kind === "prop" ? "道具" : "角色";
}

function placeholderPortrait(label) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#241c30"/><text x="50%" y="52%" fill="#eadcff" font-size="28" text-anchor="middle" font-family="sans-serif">' + label + "</text></svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function paintRoleEps() {
  var total = (D.episodes || []).length || 15;
  var selected = {};
  roleEpsNumbers.forEach(function (n) { selected[n] = true; });
  document.getElementById("role-eps-grid").innerHTML = Array.apply(null, Array(total)).map(function (_, index) {
    var n = index + 1;
    return '<button type="button" class="episode-cell' + (selected[n] ? " is-on" : "") + '" data-role-episode="' + n + '">' + n + "</button>";
  }).join("");
}

function syncRoleEpsFromInput() {
  var input = document.getElementById("role-eps");
  roleEpsNumbers = parseEpisodeNumbers(input.value);
  var formatted = roleEpsNumbers.length ? serializeEpisodes(roleEpsNumbers) : "";
  if (input.value.trim() && formatted && input.value.replace(/\s/g, "") !== formatted.replace(/\s/g, "")) {
    /* keep what the user is typing until it is a clean list */
  }
  paintRoleEps();
}

function openCreateDialog(mode) {
  roleCreateMode = mode || "asset";
  var child = roleCreateMode === "child";
  var kind = createKind();
  var word = createWord();
  document.getElementById("role-title").textContent = child ? "新增子" + word : "新增" + word;
  document.getElementById("role-name").value = "";
  document.getElementById("role-name").placeholder = "请输入" + (child ? "子" : "") + word + "名称";
  document.getElementById("role-desc").value = "";
  document.getElementById("role-desc-wrap").hidden = child || kind !== "char";
  document.getElementById("role-tier-wrap").hidden = child || kind !== "char";
  roleTier = "配角";
  paintRoleTier();
  document.getElementById("role-voice-wrap").hidden = child || kind !== "char";
  roleEpsNumbers = [];
  document.getElementById("role-eps").value = "";
  paintRoleEps();
  document.getElementById("role-dialog").classList.add("open");
  setTimeout(function () { document.getElementById("role-name").focus(); }, 50);
}

document.getElementById("add").onclick = function () { openCreateDialog("asset"); };
function closeRole() { document.getElementById("role-dialog").classList.remove("open"); }
document.getElementById("role-x").onclick = closeRole;
document.getElementById("role-cancel").onclick = closeRole;
document.getElementById("role-eps").oninput = syncRoleEpsFromInput;
document.getElementById("role-name").onkeydown = function (e) {
  if (e.key === "Enter" && !e.isComposing) document.getElementById("role-save").click();
};
document.getElementById("role-eps-grid").onclick = function (e) {
  var cell = e.target.closest("[data-role-episode]");
  if (!cell) return;
  var selected = {};
  roleEpsNumbers.forEach(function (n) { selected[n] = true; });
  var n = Number(cell.dataset.roleEpisode);
  if (selected[n]) delete selected[n];
  else selected[n] = true;
  roleEpsNumbers = Object.keys(selected).map(Number).sort(function (a, b) { return a - b; });
  document.getElementById("role-eps").value = roleEpsNumbers.length ? serializeEpisodes(roleEpsNumbers) : "";
  paintRoleEps();
};
document.getElementById("role-save").onclick = function () {
  var name = cleanText(document.getElementById("role-name").value, 30);
  var desc = cleanText(document.getElementById("role-desc").value, 200);
  var word = createWord();
  if (!name) { ReplicaUI.toast("请填写" + word + "名称"); return; }
  var epsText = roleEpsNumbers.length ? serializeEpisodes(roleEpsNumbers) : "待分配";
  var kind = createKind();
  var siblings = roleCreateMode === "child"
    ? (currentChar.looksList || []).map(lookShortName)
    : (kind === "scene" ? D.scenes : kind === "prop" ? D.props : D.characters).map(function (item) { return item.name; });
  if (siblings.indexOf(name) !== -1) { ReplicaUI.toast("已经有叫「" + name + "」的" + (roleCreateMode === "child" ? "子" : "") + word + "了"); return; }
  if (roleCreateMode === "child") {
    if (!currentChar.looksList) currentChar.looksList = [];
    var look = {
      id: "new-" + Date.now(),
      name: name,
      eps: epsText,
      voice: "",
      image: currentChar.image || placeholderPortrait(name),
      prompt: "",
      status: "pending"
    };
    if (newLookParentId) look.parentId = newLookParentId;
    currentChar.looksList.push(look);
    currentChar.looks = currentChar.looksList.length;
    if (newLookParentId) expandedLooks[currentChar.id + ":" + newLookParentId] = true;
    closeRole();
    render();
    fillLookForm(look);
    ReplicaUI.toast("已新增子" + word);
    return;
  }
  var portrait = placeholderPortrait(name);
  var item = {
    id: kind + "-" + Date.now(),
    name: name,
    role: kind === "char" ? roleTier : undefined,
    desc: desc,
    voice: "",
    status: "pending",
    eps: roleEpsNumbers.slice(),
    image: portrait,
    look: name,
    looks: 1,
    looksList: [{
      id: "main-" + Date.now(),
      name: name,
      eps: epsText,
      voice: "",
      image: portrait,
      prompt: desc
    }]
  };
  var list = kind === "scene" ? D.scenes : kind === "prop" ? D.props : D.characters;
  list.push(item);
  closeRole();
  if (tab !== kind) setActiveTab(kind);
  render();
  ReplicaUI.toast("已新增" + word);
};

function closePlain() { document.getElementById("plain-dialog").classList.remove("open"); }
document.getElementById("plain-x").onclick = closePlain;
document.getElementById("plain-cancel").onclick = closePlain;
document.getElementById("plain-save").onclick = function () { closePlain(); ReplicaUI.toast("已保存"); };
document.getElementById("plain-gen").onclick = function () { ReplicaUI.toast("演示：开始生成"); };
