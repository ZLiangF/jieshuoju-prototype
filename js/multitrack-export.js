/* 多轨编辑器 · 弹窗与导出：二次确认、导出前检查、成片导出（排队/处理中/成功/失败）、XML 工程包（ZIP）。
   XML 采用 FCP7 XML（xmeml v5），Premiere Pro 与 DaVinci Resolve 都能导入；字幕随包导出 SRT。
   ?mock=export-fail 让成片导出在处理中失败，用来演示重试。 */
(function () {
  var MT = window.MT;
  var D = window.ReplicaData;
  var $ = MT.$;
  var esc = MT.escapeHtml;
  var state = MT.state;
  var FPS = 30;
  var WIDTH = 1080;
  var HEIGHT = 1920;

  var dialog = document.createElement("div");
  dialog.className = "mt-dialog";
  dialog.hidden = true;
  dialog.innerHTML = '<div class="mt-dialog-card" role="dialog" aria-modal="true" aria-labelledby="mt-dialog-title"></div>';
  document.body.appendChild(dialog);
  var card = dialog.firstElementChild;
  var onClose = null;

  function openDialog(html, wide) {
    card.className = "mt-dialog-card" + (wide ? " is-wide" : "");
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
    if (onClose) onClose();
    onClose = null;
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

  /* ---------- 导出前检查 ---------- */

  function issue(level, where, text, fix, target) {
    return { level: level, where: where, text: text, fix: fix, target: target || null };
  }

  function precheck() {
    var issues = [];
    MT.clipEntries().forEach(function (entry) {
      var clip = entry.clip;
      var where = clip.label + "（" + MT.mmss(entry.start) + "）";
      var target = { kind: "shot", id: clip.id, time: entry.start };
      if (clip.generating) issues.push(issue("block", where, "片段正在重新生成", "等生成完成后再导出", target));
      if (!clip.image && !(clip.parts && clip.parts.length)) issues.push(issue("block", where, "素材缺失", "重新生成或替换素材", target));
      if (clip.duration < MT.MIN_CLIP) issues.push(issue("block", where, "片段时长无效", "拖动边缘调整时长或删除片段", target));
      if (clip.genError) issues.push(issue("warn", where, "上次重新生成失败", "将按原片段导出", target));
    });
    MT.audioEntries().forEach(function (entry) {
      if (entry.item.generating) issues.push(issue("block", entry.item.label + "（" + MT.mmss(entry.start) + "）", "配音正在生成", "等生成完成后再导出", { kind: "extra", id: entry.item.id, time: entry.start }));
    });
    var subs = MT.doc.subtitles.slice().sort(function (a, b) { return a.start - b.start; });
    subs.forEach(function (sub, index) {
      var where = "字幕「" + (sub.text || "空") + "」（" + MT.mmss(sub.start) + "）";
      var target = { kind: "subtitle", id: sub.id, time: sub.start };
      if (!String(sub.text || "").trim()) issues.push(issue("block", where, "字幕内容为空", "填写文字或删除这条字幕", target));
      else if (sub.text === "请输入字幕") issues.push(issue("warn", where, "仍是默认文字", "确认是否需要修改", target));
      var next = subs[index + 1];
      if (next && next.start < sub.start + sub.duration - 0.05) issues.push(issue("warn", where, "与下一条字幕时间重叠", "画面会同时出现两条字幕", target));
    });
    if (state.disabledTracks.subtitle && MT.doc.subtitles.length) issues.push(issue("warn", "字幕 1", "字幕轨已停用", "导出将不包含字幕"));
    if (state.disabledTracks.audio || MT.doc.audio.muted) issues.push(issue("warn", "音频 1", "旁白音频已停用或静音", "导出将不包含旁白"));
    if (state.muted) issues.push(issue("warn", "全局", "已全局静音", "导出的成片没有声音"));
    return issues.filter(function (item) { return item.level === "block"; }).concat(issues.filter(function (item) { return item.level !== "block"; }));
  }

  function xmlDowngrades() {
    var list = [];
    var counts = { flash: 0, black: 0 };
    Object.keys(MT.doc.transitions).forEach(function (id) {
      var type = MT.doc.transitions[id];
      if (counts[type] !== undefined) counts[type] += 1;
    });
    if (counts.flash) list.push("闪白转场 " + counts.flash + " 处：以「Dip to Color（白）」写入，目标软件中可能需确认颜色");
    if (counts.black) list.push("黑场转场 " + counts.black + " 处：以「Dip to Color（黑）」写入");
    MT.doc.clips.forEach(function (clip) {
      if (Math.abs(clip.scaleX - clip.scaleY) > 0.001) list.push(clip.label + "：缩放 X/Y 不一致，按平均值 " + Math.round((clip.scaleX + clip.scaleY) * 50) + "% 写入");
    });
    if (MT.doc.subtitles.length) list.push("字幕样式不写入 XML：字幕文本和时间以 SRT 文件随包导出，需在目标软件中导入");
    if (MT.doc.audio.fade > 0) list.push("旁白淡入淡出 " + MT.doc.audio.fade + " 秒：未写入，需在目标软件中手动添加");
    return list;
  }

  function issuesHtml(issues) {
    var blocks = issues.filter(function (item) { return item.level === "block"; });
    var head = blocks.length
      ? '<div class="mt-check-head is-block">有 ' + blocks.length + " 个问题需要先处理</div>"
      : '<div class="mt-check-head is-ok">✓ 检查通过 · ' + MT.doc.clips.length + " 个片段 · " + MT.doc.subtitles.length + " 条字幕 · " + (MT.audioEntries().length + 1) + " 段音频 · " + MT.mmss(MT.totalDuration()) + "</div>";
    return head + (issues.length ? '<ul class="mt-check-list">' + issues.map(function (item, index) {
      return '<li class="is-' + item.level + '"><b>' + (item.level === "block" ? "阻断" : "提醒") + "</b><span><em>" + esc(item.where) + "</em>" + esc(item.text) + " · " + esc(item.fix) + "</span>" +
        (item.target ? '<button type="button" data-locate="' + index + '">定位</button>' : "") + "</li>";
    }).join("") + "</ul>" : "");
  }

  /* ---------- 导出弹窗 ---------- */

  var job = null;
  var view = { tab: "video", resolution: "1080P", quality: "high" };
  var currentIssues = [];

  MT.openExport = function () {
    if (!MT.isSaved()) MT.saveNow(false);
    renderExport();
  };

  function fileBase() {
    var now = new Date();
    var stamp = now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "-" +
      String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
    return (D.project.name + "_第1集_" + stamp).replace(/[\\/:*?"<>|\s]/g, "");
  }

  function renderExport() {
    currentIssues = precheck();
    var blocked = currentIssues.some(function (item) { return item.level === "block"; });
    var html = '<div class="mt-dialog-head"><h3 id="mt-dialog-title">导出 · 第1集</h3><button type="button" class="mt-dialog-x" data-dialog-close aria-label="关闭">×</button></div>' +
      '<div class="mt-export-tabs" role="tablist">' +
      '<button type="button" role="tab" data-export-tab="video"' + (view.tab === "video" ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + ">成片视频</button>" +
      '<button type="button" role="tab" data-export-tab="xml"' + (view.tab === "xml" ? ' class="on" aria-selected="true"' : ' aria-selected="false"') + ">XML 工程包</button></div>";

    if (view.tab === "video" && job) {
      html += jobHtml();
    } else {
      html += '<section class="mt-export-section"><b>导出前检查</b>' + issuesHtml(currentIssues) + "</section>";
      html += view.tab === "video" ? videoFormHtml(blocked) : xmlFormHtml(blocked);
    }
    openDialog(html, true);
  }

  function videoFormHtml(blocked) {
    return '<section class="mt-export-section"><b>导出参数</b><div class="mt-export-grid">' +
      '<label>分辨率<select data-export-field="resolution">' + ["720P", "1080P"].map(function (value) {
        return "<option" + (view.resolution === value ? " selected" : "") + ">" + value + "</option>";
      }).join("") + "</select></label>" +
      '<label>画面比例<span class="mt-export-fixed">9:16 · 项目画幅</span></label>' +
      '<label>格式<span class="mt-export-fixed">MP4（H.264 + AAC）</span></label>' +
      '<label>质量<select data-export-field="quality"><option value="standard"' + (view.quality === "standard" ? " selected" : "") + '>标准</option><option value="high"' + (view.quality === "high" ? " selected" : "") + ">高</option></select></label>" +
      "</div></section>" +
      '<div class="mt-dialog-foot"><button type="button" data-dialog-close>取消</button><button type="button" class="is-primary" data-export-start' + (blocked ? " disabled" : "") + ">开始导出</button></div>";
  }

  function xmlFormHtml(blocked) {
    var downgrades = xmlDowngrades();
    return '<section class="mt-export-section"><b>目标格式</b><p class="mt-export-note">FCP7 XML（xmeml v5）· 适用于 Premiere Pro、DaVinci Resolve 导入 · ' + FPS + " fps · " + WIDTH + "×" + HEIGHT + "</p>" +
      '<p class="mt-export-note">ZIP 内含：project.xml、media/（视频画面与音频素材）、subtitles.srt、导出清单.txt；素材全部使用相对路径。</p></section>' +
      '<section class="mt-export-section"><b>降级项（导出前确认）</b>' + (downgrades.length
        ? '<ul class="mt-check-list">' + downgrades.map(function (text) { return '<li class="is-warn"><b>降级</b><span>' + esc(text) + "</span></li>"; }).join("") + "</ul>"
        : '<p class="mt-export-note">没有需要降级的效果。</p>') + "</section>" +
      '<div class="mt-dialog-foot"><button type="button" data-dialog-close>取消</button><button type="button" class="is-primary" data-export-xml' + (blocked ? " disabled" : "") + ">下载 ZIP 工程包</button></div>";
  }

  function jobHtml() {
    var labels = { queued: "排队中", processing: "处理中", done: "导出完成", failed: "导出失败" };
    var body = '<section class="mt-export-section mt-job is-' + job.status + '"><b>' + labels[job.status] + "</b>" +
      '<p class="mt-export-note">' + esc(job.name) + " · " + job.resolution + " · " + (job.quality === "high" ? "高质量" : "标准质量") + "</p>" +
      '<div class="mt-progress"><i style="width:' + job.progress + '%"></i></div><p class="mt-export-note">' +
      (job.status === "queued" ? "前面还有 1 个任务，请稍候" : job.status === "processing" ? "已完成 " + job.progress + "%，关闭弹窗不影响导出" :
        job.status === "done" ? "时长 " + MT.mmss(job.duration) + " · 约 " + job.sizeMb + " MB" : esc(job.error)) + "</p></section>";
    var foot = job.status === "done"
      ? '<button type="button" data-export-new>重新设置</button><a class="mt-dialog-link" href="workspace.html">回到单集工作台</a><button type="button" data-export-preview>预览成片</button><button type="button" class="is-primary" data-export-download>下载</button>'
      : job.status === "failed"
        ? '<button type="button" data-export-new>返回设置</button><button type="button" class="is-primary" data-export-retry>重试</button>'
        : '<button type="button" data-dialog-close>后台导出</button><button type="button" data-export-cancel>取消导出</button>';
    return body + '<div class="mt-dialog-foot">' + foot + "</div>";
  }

  function startJob() {
    var mockFail = !!MT.mock["export-fail"] && !(job && job.retried);
    job = { name: fileBase() + ".mp4", resolution: view.resolution, quality: view.quality, status: "queued", progress: 0, duration: MT.totalDuration(), retried: !!job };
    job.sizeMb = Math.round(job.duration * (job.resolution === "1080P" ? 0.9 : 0.45) * (job.quality === "high" ? 1.4 : 1));
    var current = job;
    renderIfOpen();
    setTimeout(function () {
      if (job !== current) return;
      current.status = "processing";
      var tick = setInterval(function () {
        if (job !== current) return clearInterval(tick);
        current.progress = Math.min(100, current.progress + 7);
        if (mockFail && current.progress >= 56) {
          clearInterval(tick);
          current.status = "failed";
          current.error = "渲染服务超时，导出未完成，可以重试";
          MT.toast("导出失败，可以重试");
        } else if (current.progress >= 100) {
          clearInterval(tick);
          current.status = "done";
          MT.toast("成片导出完成");
        }
        renderIfOpen();
      }, 220);
      renderIfOpen();
    }, 900);
  }

  function renderIfOpen() {
    if (MT.dialogOpen() && card.querySelector(".mt-export-tabs") && view.tab === "video") renderExport();
  }

  card.addEventListener("change", function (event) {
    var field = event.target.dataset.exportField;
    if (field) view[field] = event.target.value;
  });

  card.addEventListener("click", function (event) {
    var target = event.target;
    var tab = target.closest("[data-export-tab]");
    if (tab) {
      view.tab = tab.dataset.exportTab;
      return renderExport();
    }
    var locate = target.closest("[data-locate]");
    if (locate) {
      var found = currentIssues[Number(locate.dataset.locate)];
      MT.closeDialog();
      if (found && found.target) MT.select(found.target.kind, found.target.id, found.target.time);
      return;
    }
    if (target.closest("[data-export-start]")) return startJob();
    if (target.closest("[data-export-retry]")) {
      job.retried = true;
      return startJob();
    }
    if (target.closest("[data-export-new]") || target.closest("[data-export-cancel]")) {
      if (target.closest("[data-export-cancel]")) MT.toast("已取消导出");
      job = null;
      return renderExport();
    }
    if (target.closest("[data-export-preview]")) {
      MT.closeDialog();
      state.currentTime = 0;
      MT.renderPlayhead();
      MT.togglePlayback();
      return;
    }
    if (target.closest("[data-export-download]")) return MT.toast("演示环境不生成真实视频文件：" + job.name);
    if (target.closest("[data-export-xml]")) return exportXmlPackage(target.closest("[data-export-xml]"));
  });

  /* ---------- XML 工程包 ---------- */

  function frames(seconds) { return Math.round(seconds * FPS); }
  function x(value) { return esc(value); }
  function rate() { return "<rate><timebase>" + FPS + "</timebase><ntsc>FALSE</ntsc></rate>"; }

  function srtTime(seconds) {
    var ms = Math.round(seconds * 1000);
    var h = Math.floor(ms / 3600000);
    var m = Math.floor(ms % 3600000 / 60000);
    var s = Math.floor(ms % 60000 / 1000);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "," + String(ms % 1000).padStart(3, "0");
  }

  function buildSrt() {
    return MT.doc.subtitles.slice().sort(function (a, b) { return a.start - b.start; }).map(function (sub, index) {
      return (index + 1) + "\n" + srtTime(sub.start) + " --> " + srtTime(sub.start + sub.duration) + "\n" + sub.text + "\n";
    }).join("\n");
  }

  /* 原型没有真实音频文件，用等长静音 WAV 占位，保证工程包里没有缺失素材。 */
  function silentWav(seconds) {
    var sampleRate = 8000;
    var count = Math.max(1, Math.round(seconds * sampleRate));
    var buffer = new Uint8Array(44 + count);
    var view = new DataView(buffer.buffer);
    function text(offset, value) { for (var i = 0; i < value.length; i += 1) buffer[offset + i] = value.charCodeAt(i); }
    text(0, "RIFF"); view.setUint32(4, 36 + count, true); text(8, "WAVE");
    text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    text(36, "data"); view.setUint32(40, count, true);
    buffer.fill(128, 44);
    return buffer;
  }

  function fileXml(registry, path, seconds, kind) {
    if (registry[path]) return '<file id="' + registry[path] + '"/>';
    registry[path] = "file-" + (Object.keys(registry).length + 1);
    var media = kind === "audio"
      ? "<audio><samplecharacteristics><depth>8</depth><samplerate>8000</samplerate></samplecharacteristics><channelcount>1</channelcount></audio>"
      : "<video><samplecharacteristics>" + rate() + "<width>" + WIDTH + "</width><height>" + HEIGHT + "</height></samplecharacteristics></video>";
    return '<file id="' + registry[path] + '"><name>' + x(path.split("/").pop()) + "</name><pathurl>" + x(path) + "</pathurl>" + rate() +
      "<duration>" + frames(seconds) + "</duration><media>" + media + "</media></file>";
  }

  function motionFilters(clip) {
    var scale = Math.round((clip.scaleX + clip.scaleY) * 50);
    return "<filter><effect><name>Basic Motion</name><effectid>basic</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype>" +
      "<parameter><parameterid>scale</parameterid><name>Scale</name><valuemin>0</valuemin><valuemax>1000</valuemax><value>" + scale + "</value></parameter>" +
      "<parameter><parameterid>rotation</parameterid><name>Rotation</name><valuemin>-8640</valuemin><valuemax>8640</valuemax><value>" + Math.round(clip.rotate) + "</value></parameter></effect></filter>" +
      "<filter><effect><name>Opacity</name><effectid>opacity</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype>" +
      "<parameter><parameterid>opacity</parameterid><name>opacity</name><valuemin>0</valuemin><valuemax>100</valuemax><value>" + clip.opacity + "</value></parameter></effect></filter>";
  }

  function levelFilter(volume) {
    return "<filter><effect><name>Audio Levels</name><effectid>audiolevels</effectid><effectcategory>audiolevels</effectcategory><effecttype>audiolevels</effecttype><mediatype>audio</mediatype>" +
      "<parameter><parameterid>level</parameterid><name>Level</name><valuemin>0</valuemin><valuemax>3.98109</valuemax><value>" + (volume / 100).toFixed(3) + "</value></parameter></effect></filter>";
  }

  function transitionXml(type, cut) {
    var half = frames(MT.TRANSITION_SECONDS / 2);
    var name = type === "dissolve" ? "Cross Dissolve" : "Dip to Color Dissolve";
    var color = type === "flash" ? "255" : "0";
    return "<transitionitem><start>" + (frames(cut) - half) + "</start><end>" + (frames(cut) + half) + "</end><alignment>center</alignment>" + rate() +
      "<effect><name>" + name + "</name><effectid>" + name + "</effectid><effectcategory>Dissolve</effectcategory><effecttype>transition</effecttype><mediatype>video</mediatype>" +
      (type === "dissolve" ? "" : "<parameter><parameterid>color</parameterid><name>Color</name><value><alpha>255</alpha><red>" + color + "</red><green>" + color + "</green><blue>" + color + "</blue></value></parameter>") +
      "</effect></transitionitem>";
  }

  function collectPackage() {
    var registry = {};
    var images = {};
    var audios = [];
    var itemNo = 0;
    var total = MT.totalDuration();

    function imagePath(url) {
      if (!images[url]) {
        var base = url.split("/").pop();
        var name = base;
        var n = 1;
        var taken = Object.keys(images).map(function (key) { return images[key]; });
        while (taken.indexOf("media/images/" + name) > -1) { n += 1; name = base.replace(/(\.\w+)$/, "-" + n + "$1"); }
        images[url] = "media/images/" + name;
      }
      return images[url];
    }

    var video = "";
    MT.clipEntries().forEach(function (entry) {
      var clip = entry.clip;
      var cursor = entry.start;
      var srcCursor = clip.parts ? 0 : clip.srcIn;
      MT.partsOf(clip).forEach(function (part) {
        itemNo += 1;
        var path = imagePath(part.image);
        video += '<clipitem id="clipitem-' + itemNo + '"><name>' + x(clip.label + " · " + clip.title) + "</name><enabled>TRUE</enabled>" +
          "<duration>" + frames(clip.sourceDuration) + "</duration>" + rate() +
          "<start>" + frames(cursor) + "</start><end>" + frames(cursor + part.duration) + "</end>" +
          "<in>" + frames(srcCursor) + "</in><out>" + frames(srcCursor + part.duration) + "</out>" +
          fileXml(registry, path, clip.sourceDuration, "video") + motionFilters(clip) + "</clipitem>";
        cursor += part.duration;
        srcCursor += part.duration;
      });
      var type = MT.doc.transitions[clip.id];
      if (type && entry.index < MT.doc.clips.length - 1) video += transitionXml(type, entry.end);
    });

    var narrationOn = !state.disabledTracks.audio && !MT.doc.audio.muted && !state.muted;
    audios.push({ path: "media/audio/narration.wav", seconds: total });
    itemNo += 1;
    var audio1 = '<clipitem id="clipitem-' + itemNo + '"><name>第1集旁白音频</name><enabled>' + (narrationOn ? "TRUE" : "FALSE") + "</enabled><duration>" + frames(total) + "</duration>" + rate() +
      "<start>0</start><end>" + frames(total) + "</end><in>0</in><out>" + frames(total) + "</out>" +
      fileXml(registry, "media/audio/narration.wav", total, "audio") + levelFilter(MT.doc.audio.volume) + "</clipitem>";

    var audio2 = MT.audioEntries().map(function (entry, index) {
      var item = entry.item;
      var path = "media/audio/" + (item.kind === "dub" ? "dub" : "detached") + "-" + String(index + 1).padStart(2, "0") + ".wav";
      audios.push({ path: path, seconds: item.duration });
      itemNo += 1;
      return '<clipitem id="clipitem-' + itemNo + '"><name>' + x(item.label) + "</name><enabled>" + (item.muted || state.muted ? "FALSE" : "TRUE") + "</enabled><duration>" + frames(item.duration) + "</duration>" + rate() +
        "<start>" + frames(entry.start) + "</start><end>" + frames(entry.start + entry.duration) + "</end><in>0</in><out>" + frames(entry.duration) + "</out>" +
        fileXml(registry, path, item.duration, "audio") + levelFilter(item.volume) + "</clipitem>";
    }).join("");

    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="5">\n<sequence id="sequence-1"><name>' + x(D.project.name + " 第1集") + "</name>" +
      "<duration>" + frames(total) + "</duration>" + rate() + "<timecode>" + rate() + "<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>" +
      "<media><video><format><samplecharacteristics>" + rate() + "<width>" + WIDTH + "</width><height>" + HEIGHT + "</height><pixelaspectratio>square</pixelaspectratio></samplecharacteristics></format>" +
      "<track>" + video + "</track></video>" +
      "<audio><numOutputChannels>2</numOutputChannels><track>" + audio1 + "</track>" + (audio2 ? "<track>" + audio2 + "</track>" : "") + "</audio></media></sequence>\n</xmeml>\n";

    return { xml: xml, images: images, audios: audios };
  }

  function manifestText(pkg, downgrades, sizes) {
    var lines = [
      "多轨工程导出清单",
      "项目：" + D.project.name + "　集数：第1集",
      "导出时间：" + new Date().toLocaleString("zh-CN"),
      "格式：FCP7 XML（xmeml v5）· " + FPS + " fps · " + WIDTH + "×" + HEIGHT + " · 总时长 " + MT.secText(MT.totalDuration()),
      "",
      "轨道：视频 1 条（" + MT.doc.clips.length + " 个片段，" + Object.keys(MT.doc.transitions).length + " 个转场）；音频 " + (MT.audioEntries().length ? 2 : 1) + " 条；字幕 " + MT.doc.subtitles.length + " 条（subtitles.srt）",
      "",
      "文件："
    ];
    Object.keys(sizes).forEach(function (path) { lines.push("  " + path + "（" + Math.max(1, Math.round(sizes[path] / 1024)) + " KB）"); });
    lines.push("", "降级项：");
    if (downgrades.length) downgrades.forEach(function (text) { lines.push("  - " + text); });
    else lines.push("  无");
    lines.push("", "说明：原型阶段音频为等长静音占位文件，正式版替换为实际旁白、配音和分离出的原声。");
    return lines.join("\n");
  }

  function exportXmlPackage(button) {
    button.disabled = true;
    button.textContent = "正在打包…";
    var pkg = collectPackage();
    var downgrades = xmlDowngrades();
    var urls = Object.keys(pkg.images);
    Promise.all(urls.map(function (url) {
      return fetch(url).then(function (response) {
        if (!response.ok) throw new Error(url);
        return response.arrayBuffer();
      }).then(function (data) { return { name: pkg.images[url], data: new Uint8Array(data) }; });
    })).then(function (imageFiles) {
      var files = [{ name: "project.xml", data: utf8(pkg.xml) }];
      files = files.concat(imageFiles);
      pkg.audios.forEach(function (item) { files.push({ name: item.path, data: silentWav(item.seconds) }); });
      files.push({ name: "subtitles.srt", data: utf8(buildSrt()) });
      var sizes = {};
      files.forEach(function (file) { sizes[file.name] = file.data.length; });
      files.push({ name: "导出清单.txt", data: utf8(manifestText(pkg, downgrades, sizes)) });
      var name = fileBase() + ".zip";
      download(new Blob([zip(files)], { type: "application/zip" }), name);
      MT.closeDialog();
      MT.toast("已导出工程包 " + name);
    }).catch(function (error) {
      button.disabled = false;
      button.textContent = "下载 ZIP 工程包";
      MT.toast("素材读取失败：" + error.message + "，请用本地服务打开页面后重试");
    });
  }

  function utf8(text) { return new TextEncoder().encode(text); }

  function download(blob, name) {
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 4000);
  }

  /* 不压缩（store）的 ZIP，文件名按 UTF-8 标记。 */
  var CRC_TABLE = (function () {
    var table = new Uint32Array(256);
    for (var n = 0; n < 256; n += 1) {
      var c = n;
      for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(data) {
    var crc = 0xffffffff;
    for (var i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zip(files) {
    var now = new Date();
    var time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    var chunks = [];
    var central = [];
    var offset = 0;
    files.forEach(function (file) {
      var name = utf8(file.name);
      var crc = crc32(file.data);
      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
      local.setUint16(10, time, true); local.setUint16(12, date, true); local.setUint32(14, crc, true);
      local.setUint32(18, file.data.length, true); local.setUint32(22, file.data.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      chunks.push(new Uint8Array(local.buffer), name, file.data);
      var entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true); entry.setUint16(10, 0, true);
      entry.setUint16(12, time, true); entry.setUint16(14, date, true); entry.setUint32(16, crc, true);
      entry.setUint32(20, file.data.length, true); entry.setUint32(24, file.data.length, true); entry.setUint16(28, name.length, true);
      entry.setUint32(42, offset, true);
      central.push(new Uint8Array(entry.buffer), name);
      offset += 30 + name.length + file.data.length;
    });
    var centralSize = central.reduce(function (sum, part) { return sum + part.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true); end.setUint32(16, offset, true);
    return new Blob(chunks.concat(central, [new Uint8Array(end.buffer)]));
  }

  MT.exportPackageForTest = function () {
    var pkg = collectPackage();
    return { xml: pkg.xml, srt: buildSrt(), downgrades: xmlDowngrades(), issues: precheck() };
  };
})();
