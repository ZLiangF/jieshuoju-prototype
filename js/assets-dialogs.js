function createKind() {
  return roleCreateMode === "child" ? editorKind : tab;
}

function createWord() {
  if (roleCreateMode === "child") return assetWord();
  var kind = createKind();
  return kind === "scene" ? "场景" : kind === "prop" ? "道具" : "角色";
}

function createParentAsset() {
  if (roleCreateMode !== "child" || !newLookParentId) return currentChar;
  return (currentChar.looksList || []).filter(function (look) { return look.id === newLookParentId; })[0] || currentChar;
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
  var parentName = assetNameOf(createParentAsset());
  document.getElementById("role-title").textContent = child ? "新增子" + word : "新增" + word;
  document.getElementById("role-name").value = "";
  document.getElementById("role-main-name").value = "";
  document.getElementById("role-child-name").hidden = !child;
  document.getElementById("role-main-name").hidden = child;
  document.getElementById("role-parent-prefix").textContent = parentName + " -";
  document.getElementById("role-name").placeholder = kind === "char" ? "例如：白色礼服" : kind === "scene" ? "例如：雨夜状态" : "例如：破损状态";
  document.getElementById("role-main-name").placeholder = kind === "char" ? "例如：唐清梨" : kind === "scene" ? "例如：唐家客厅" : "例如：母亲留下的玉佩";
  document.getElementById("role-full-name").hidden = !child;
  document.querySelector("#role-full-name strong").textContent = parentName + " - ";
  document.getElementById("role-desc").value = "";
  document.getElementById("role-desc-error").hidden = true;
  document.getElementById("role-desc-wrap").hidden = false;
  document.getElementById("role-desc-label").innerHTML = (child ? word : kind === "char" ? "角色" : word) + '描述 <i>*</i>';
  document.getElementById("role-desc").placeholder = "请输入" + (child ? word : kind === "char" ? "角色" : word) + "描述";
  document.getElementById("role-tier-wrap").hidden = child || kind !== "char";
  roleTier = "配角";
  paintRoleTier();
  document.getElementById("role-voice-wrap").hidden = child || kind !== "char";
  roleEpsNumbers = [];
  document.getElementById("role-eps").value = "";
  paintRoleEps();
  syncCreateValidity();
  document.getElementById("role-dialog").classList.add("open");
  setTimeout(function () { document.getElementById(child ? "role-name" : "role-main-name").focus(); }, 50);
}

function currentCreateName() {
  return cleanText(document.getElementById(roleCreateMode === "child" ? "role-name" : "role-main-name").value, 30);
}

function syncCreateValidity() {
  var name = currentCreateName();
  var desc = cleanText(document.getElementById("role-desc").value, 2000);
  document.getElementById("role-save").disabled = !name || !desc;
  if (roleCreateMode === "child") {
    document.querySelector("#role-full-name strong").textContent = assetNameOf(createParentAsset()) + " - " + name;
  }
  if (desc) document.getElementById("role-desc-error").hidden = true;
}

document.getElementById("add").onclick = function () { openCreateDialog("asset"); };
function closeRole() { document.getElementById("role-dialog").classList.remove("open"); }
document.getElementById("role-x").onclick = closeRole;
document.getElementById("role-cancel").onclick = closeRole;
document.getElementById("role-eps").oninput = syncRoleEpsFromInput;
document.getElementById("role-name").oninput = syncCreateValidity;
document.getElementById("role-main-name").oninput = syncCreateValidity;
document.getElementById("role-desc").oninput = syncCreateValidity;
document.getElementById("role-name").onkeydown = document.getElementById("role-main-name").onkeydown = function (e) {
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
  var name = currentCreateName();
  var desc = cleanText(document.getElementById("role-desc").value, 2000);
  var prompt = desc;
  var word = createWord();
  var kind = createKind();
  if (!name) { ReplicaUI.toast("请填写" + word + "名称"); return; }
  if (!prompt) {
    document.getElementById("role-desc-error").textContent = "请输入" + (roleCreateMode === "child" ? word : kind === "char" ? "角色" : word) + "描述";
    document.getElementById("role-desc-error").hidden = false;
    document.getElementById("role-desc").focus();
    return;
  }
  var epsText = roleEpsNumbers.length ? serializeEpisodes(roleEpsNumbers) : "待分配";
  var siblings = roleCreateMode === "child"
    ? (currentChar.looksList || []).map(function (look) { return look.customName || lookShortName(look); })
    : (kind === "scene" ? D.scenes : kind === "prop" ? D.props : D.characters).map(assetNameOf);
  if (siblings.indexOf(name) !== -1) { ReplicaUI.toast(roleCreateMode === "child" ? "同一资产下已存在该名称" : "已经有叫「" + name + "」的" + word + "了"); return; }
  if (roleCreateMode === "child") {
    if (!currentChar.looksList) currentChar.looksList = [];
    var parentName = assetNameOf(createParentAsset());
    var look = {
      id: "new-" + Date.now(),
      name: parentName + " - " + name,
      customName: name,
      nameEditable: false,
      source: "manual",
      eps: epsText,
      voice: "",
      image: currentChar.image || placeholderPortrait(name),
      prompt: prompt,
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
    nameEditable: false,
    source: "manual",
    prompt: prompt,
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
      name: name + " - 默认" + (kind === "char" ? "形象" : word),
      customName: "默认" + (kind === "char" ? "形象" : word),
      nameEditable: false,
      source: "manual",
      eps: epsText,
      voice: "",
      image: portrait,
      prompt: prompt
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

function openNameEditor(item, look) {
  editingNameTarget = { item: item, look: look || null };
  var target = look || item;
  document.getElementById("plain-title").textContent = "查看资产名称";
  document.getElementById("plain-img").innerHTML = '<img src="' + ((look && look.image) || item.image || "") + '" alt="">';
  document.getElementById("plain-child-name").hidden = true;
  document.getElementById("plain-main-name").hidden = false;
  document.getElementById("plain-name").value = "";
  document.getElementById("plain-main-name").value = assetNameOf(target);
  document.getElementById("plain-main-name").readOnly = true;
  document.getElementById("plain-main-name").classList.add("locked-field");
  document.getElementById("plain-name-note").textContent = "资产名称不支持修改。";
  document.getElementById("plain-save").hidden = true;
  document.getElementById("plain-cancel").textContent = "关闭";
  document.getElementById("plain-name-error").hidden = true;
  document.getElementById("plain-dialog").classList.add("open");
  setTimeout(function () { document.getElementById("plain-cancel").focus(); }, 30);
}

document.getElementById("plain-save").onclick = closePlain;
