function paintImageEditor() {
  var root = document.getElementById("img-edit");
  var img = document.getElementById("img-edit-img");
  var box = document.getElementById("img-edit-cropbox");
  var cropBtn = document.getElementById("img-edit-crop");
  root.classList.toggle("is-locked", imgEdit.locked);
  root.classList.toggle("is-cropping", imgEdit.cropping);
  img.style.transform = "translate(calc(-50% + " + imgEdit.x + "px), calc(-50% + " + imgEdit.y + "px)) rotate(" + imgEdit.rotate + "deg) scale(" + imgEdit.scale + ")";
  box.hidden = !imgEdit.cropping;
  if (imgEdit.cropping && imgEdit.crop) {
    box.style.left = imgEdit.crop.x + "px";
    box.style.top = imgEdit.crop.y + "px";
    box.style.width = imgEdit.crop.w + "px";
    box.style.height = imgEdit.crop.h + "px";
  }
  cropBtn.textContent = imgEdit.cropping ? "完成" : "裁剪";
  cropBtn.disabled = imgEdit.locked;
  root.querySelector("[data-img-act='lock']").setAttribute("aria-pressed", imgEdit.locked ? "true" : "false");
  root.querySelector("[data-img-act='lock']").classList.toggle("on", imgEdit.locked);
  root.querySelectorAll(".img-edit-bar [data-img-act]").forEach(function (button) {
    var act = button.dataset.imgAct;
    button.disabled = imgEdit.locked && act !== "lock" && act !== "close";
  });
}

function openImageEditor(src, alt) {
  var img = document.getElementById("img-edit-img");
  imgEdit.scale = 1;
  imgEdit.rotate = 0;
  imgEdit.x = 0;
  imgEdit.y = 0;
  imgEdit.locked = false;
  imgEdit.cropping = false;
  imgEdit.crop = null;
  img.alt = alt || "编辑图片";
  img.src = src;
  document.getElementById("img-edit").hidden = false;
  paintImageEditor();
}

function closeImageEditor(force) {
  if (imgEdit.cropping && !force) {
    imgEdit.cropping = false;
    paintImageEditor();
    return;
  }
  imgEdit.cropping = false;
  document.getElementById("img-edit").hidden = true;
}

function saveEditedSheet(url) {
  var primary = currentChar ? primaryLookOf(currentChar) : null;
  if (editingLook) editingLook.sheet = url;
  if (currentChar && (!editingLook || editingLook === primary)) currentChar.sheet = url;
  var previewImg = document.querySelector("#f-preview img");
  if (previewImg) previewImg.src = url;
  previewRailSrc = url;
  document.getElementById("img-edit-img").src = url;
  imgEdit.scale = 1;
  imgEdit.rotate = 0;
  imgEdit.x = 0;
  imgEdit.y = 0;
  imgEdit.cropping = false;
  paintImageEditor();
  var y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

function rotateEditedImage() {
  var img = document.getElementById("img-edit-img");
  if (!img.naturalWidth) return;
  var canvas = document.createElement("canvas");
  canvas.width = img.naturalHeight;
  canvas.height = img.naturalWidth;
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  var url = "";
  try { url = canvas.toDataURL("image/jpeg", 0.92); } catch (err) { url = ""; }
  if (!url) { ReplicaUI.toast("这张图片暂时不能编辑"); return; }
  saveEditedSheet(url);
}

function applyImageCrop() {
  var img = document.getElementById("img-edit-img");
  var stage = document.getElementById("img-edit-stage");
  var box = document.getElementById("img-edit-cropbox");
  var stageRect = stage.getBoundingClientRect();
  var boxRect = box.getBoundingClientRect();
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(stageRect.width * dpr));
  canvas.height = Math.max(1, Math.round(stageRect.height * dpr));
  var ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.translate(stageRect.width / 2 + imgEdit.x, stageRect.height / 2 + imgEdit.y);
  ctx.rotate(imgEdit.rotate * Math.PI / 180);
  ctx.scale(imgEdit.scale, imgEdit.scale);
  ctx.drawImage(img, -img.offsetWidth / 2, -img.offsetHeight / 2, img.offsetWidth, img.offsetHeight);
  ctx.restore();
  var out = document.createElement("canvas");
  var sx = (boxRect.left - stageRect.left) * dpr;
  var sy = (boxRect.top - stageRect.top) * dpr;
  var sw = Math.max(1, boxRect.width * dpr);
  var sh = Math.max(1, boxRect.height * dpr);
  out.width = Math.max(1, Math.round(sw));
  out.height = Math.max(1, Math.round(sh));
  out.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  var url = "";
  try { url = out.toDataURL("image/jpeg", 0.92); } catch (err) { url = ""; }
  if (!url) { ReplicaUI.toast("这张图片暂时不能编辑"); return; }
  saveEditedSheet(url);
  ReplicaUI.toast("已裁剪图片");
}

function startImageCrop() {
  var stage = document.getElementById("img-edit-stage").getBoundingClientRect();
  var img = document.getElementById("img-edit-img").getBoundingClientRect();
  var left = Math.max(stage.left, img.left);
  var top = Math.max(stage.top, img.top);
  var right = Math.min(stage.right, img.right);
  var bottom = Math.min(stage.bottom, img.bottom);
  var width = Math.max(80, right - left);
  var height = Math.max(80, bottom - top);
  var insetX = width * 0.08;
  var insetY = height * 0.08;
  imgEdit.crop = {
    x: left - stage.left + insetX,
    y: top - stage.top + insetY,
    w: Math.max(48, width - insetX * 2),
    h: Math.max(48, height - insetY * 2)
  };
  imgEdit.cropping = true;
  paintImageEditor();
}

function clampImageCrop(crop) {
  var stage = document.getElementById("img-edit-stage");
  var min = 48;
  crop.w = Math.max(min, crop.w);
  crop.h = Math.max(min, crop.h);
  if (crop.x < 8) crop.x = 8;
  if (crop.y < 8) crop.y = 8;
  if (crop.x + crop.w > stage.clientWidth - 8) crop.x = stage.clientWidth - 8 - crop.w;
  if (crop.y + crop.h > stage.clientHeight - 8) crop.y = stage.clientHeight - 8 - crop.h;
  if (crop.x < 8) { crop.x = 8; crop.w = stage.clientWidth - 16; }
  if (crop.y < 8) { crop.y = 8; crop.h = stage.clientHeight - 16; }
  return crop;
}

document.getElementById("img-edit").onclick = function (e) {
  if (e.target === this) closeImageEditor(true);
  var button = e.target.closest("[data-img-act]");
  if (!button || button.disabled) return;
  var act = button.dataset.imgAct;
  if (act === "close") closeImageEditor(true);
  else if (act === "lock") { imgEdit.locked = !imgEdit.locked; if (imgEdit.locked) imgEdit.cropping = false; paintImageEditor(); }
  else if (imgEdit.locked) return;
  else if (act === "zoom-in") { imgEdit.scale = Math.min(5, imgEdit.scale * 1.2); paintImageEditor(); }
  else if (act === "zoom-out") { imgEdit.scale = Math.max(0.25, imgEdit.scale / 1.2); paintImageEditor(); }
  else if (act === "fit") { imgEdit.scale = 1; imgEdit.rotate = 0; imgEdit.x = 0; imgEdit.y = 0; paintImageEditor(); }
  else if (act === "rotate") rotateEditedImage();
  else if (act === "crop") { if (imgEdit.cropping) applyImageCrop(); else startImageCrop(); }
};

(function () {
  var stage = document.getElementById("img-edit-stage");
  var drag = null;
  stage.addEventListener("pointerdown", function (e) {
    if (imgEdit.locked || e.target.closest("button")) return;
    var handle = e.target.closest("[data-crop-handle]");
    if (imgEdit.cropping && (handle || e.target.closest("#img-edit-cropbox"))) {
      drag = { type: handle ? handle.dataset.cropHandle : "move", x: e.clientX, y: e.clientY, crop: { x: imgEdit.crop.x, y: imgEdit.crop.y, w: imgEdit.crop.w, h: imgEdit.crop.h } };
    } else if (!imgEdit.cropping) {
      drag = { type: "pan", x: e.clientX, y: e.clientY, ox: imgEdit.x, oy: imgEdit.y };
      stage.classList.add("is-panning");
    } else return;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", function (e) {
    if (!drag) return;
    if (drag.type === "pan") {
      imgEdit.x = drag.ox + e.clientX - drag.x;
      imgEdit.y = drag.oy + e.clientY - drag.y;
      paintImageEditor();
      return;
    }
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    var next = { x: drag.crop.x, y: drag.crop.y, w: drag.crop.w, h: drag.crop.h };
    if (drag.type === "move") { next.x += dx; next.y += dy; }
    else {
      if (drag.type.indexOf("e") !== -1) next.w = drag.crop.w + dx;
      if (drag.type.indexOf("s") !== -1) next.h = drag.crop.h + dy;
      if (drag.type.indexOf("w") !== -1) { next.x = drag.crop.x + dx; next.w = drag.crop.w - dx; }
      if (drag.type.indexOf("n") !== -1) { next.y = drag.crop.y + dy; next.h = drag.crop.h - dy; }
      if (next.w < 48) { if (drag.type.indexOf("w") !== -1) next.x = drag.crop.x + drag.crop.w - 48; next.w = 48; }
      if (next.h < 48) { if (drag.type.indexOf("n") !== -1) next.y = drag.crop.y + drag.crop.h - 48; next.h = 48; }
    }
    imgEdit.crop = clampImageCrop(next);
    paintImageEditor();
  });
  stage.addEventListener("pointerup", function () { drag = null; stage.classList.remove("is-panning"); });
  stage.addEventListener("pointercancel", function () { drag = null; stage.classList.remove("is-panning"); });
  stage.addEventListener("wheel", function (e) {
    if (document.getElementById("img-edit").hidden || imgEdit.locked) return;
    e.preventDefault();
    imgEdit.scale = Math.min(5, Math.max(0.25, imgEdit.scale * (e.deltaY < 0 ? 1.08 : 0.92)));
    paintImageEditor();
  }, { passive: false });
})();
