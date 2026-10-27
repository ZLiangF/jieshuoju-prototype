/* 多轨编辑器 · 右键菜单与快捷键。菜单项结构参考小云雀：基础编辑 / AI 处理 / 片段级操作。 */
(function () {
  var MT = window.MT;
  var $ = MT.$;
  var esc = MT.escapeHtml;
  var state = MT.state;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  var MOD = isMac ? "⌘" : "Ctrl ";

  function item(act, label, icon, opts) {
    opts = opts || {};
    return { act: act, label: label, icon: icon, key: opts.key || "", disabled: !!opts.disabled, ai: !!opts.ai, danger: !!opts.danger, checked: !!opts.checked };
  }

  function clipMenu(clip) {
    var entry = MT.entryOf(clip);
    var inside = state.currentTime > entry.start && state.currentTime < entry.end;
    var last = entry.index === MT.doc.clips.length - 1;
    return [
      [
        item("split", "分割", "✂", { key: "S", disabled: !(inside && MT.canSplit()) }),
        item("copy", "复制", "⧉", { key: MOD + "C" }),
        item("cut", "剪切", "✁", { key: MOD + "X" }),
        item("paste", "粘贴", "⎘", { key: MOD + "V", disabled: !state.clipboard }),
        item("duplicate", "创建副本", "⊕", { key: MOD + "D" }),
        item("delete-selection", "删除", "⌫", { key: "⌫", danger: true })
      ],
      [
        item("recognize-clip", "字幕识别", "T", { ai: true }),
        item("dub-clip", "生成配音", "♪"),
        item("detach-audio", "音频分离", "⇣", { disabled: clip.volume === 0 }),
        item("separate-voice", "分离人声与背景声", "≋", { ai: true })
      ],
      [
        item("merge", "与后一段合并", "⇥", { disabled: last }),
        item("add-transition", "添加转场", "◇", { disabled: last }),
        item("smart-split", "智能切割分镜", "⫼"),
        item("reshoot", "片段重拍", "↻")
      ]
    ];
  }

  function subtitleMenu() {
    return [
      [
        item("copy", "复制", "⧉", { key: MOD + "C" }),
        item("cut", "剪切", "✁", { key: MOD + "X" }),
        item("paste", "粘贴", "⎘", { key: MOD + "V", disabled: !state.clipboard }),
        item("duplicate", "创建副本", "⊕", { key: MOD + "D" }),
        item("delete-selection", "删除", "⌫", { key: "⌫", danger: true })
      ],
      [item("edit-subtitle", "编辑文字", "✎")]
    ];
  }

  function transitionMenu(clipId) {
    var current = MT.doc.transitions[clipId];
    return [
      Object.keys(MT.TRANSITIONS).map(function (key) {
        return item("transition:" + key, MT.TRANSITIONS[key].name, "◇", { checked: current === key });
      }),
      [item("remove-transition", "移除转场", "⌫", { disabled: !current, danger: true })]
    ];
  }

  function audioMenu() {
    return [[
      item("audio-settings", "音量与淡入淡出", "♪"),
      item("mute-all", state.muted ? "取消全局静音" : "全局静音", "♬")
    ]];
  }

  function extraMenu() {
    return [[item("delete-selection", "删除这段音频", "⌫", { key: "⌫", danger: true })]];
  }

  function blankMenu() {
    return [[
      item("paste", "粘贴到播放头", "⎘", { key: MOD + "V", disabled: !state.clipboard }),
      item("add-subtitle", "在此添加字幕", "T"),
      item("split", "在播放头分割", "✂", { key: "S", disabled: !MT.canSplit() })
    ]];
  }

  function menuHtml(title, groups) {
    return '<div class="mt-menu-title">' + esc(title) + "</div>" + groups.map(function (group) {
      return '<div class="mt-menu-group">' + group.map(function (entry) {
        return '<button type="button" role="menuitem" class="mt-menu-item' + (entry.danger ? " danger" : "") + (entry.checked ? " checked" : "") + '" data-menu-act="' + entry.act + '"' + (entry.disabled ? " disabled" : "") + ">" +
          '<i aria-hidden="true">' + entry.icon + "</i><span>" + esc(entry.label) + (entry.ai ? '<em class="mt-menu-ai">✦</em>' : "") + "</span>" +
          (entry.checked ? "<kbd>✓</kbd>" : entry.key ? "<kbd>" + entry.key + "</kbd>" : "") + "</button>";
      }).join("") + "</div>";
    }).join("");
  }

  MT.closeMenu = function () {
    var menu = $("#context-menu");
    menu.hidden = true;
    menu.innerHTML = "";
  };

  function openMenu(x, y, title, groups) {
    var menu = $("#context-menu");
    menu.innerHTML = menuHtml(title, groups);
    menu.hidden = false;
    var rect = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - rect.width - 8) + "px";
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + "px";
    var first = menu.querySelector(".mt-menu-item:not([disabled])");
    if (first) first.focus({ preventScroll: true });
  }

  document.addEventListener("contextmenu", function (event) {
    var timeline = event.target.closest("#timeline-canvas");
    if (!timeline) return;
    event.preventDefault();
    MT.stopPlayback();
    var shot = event.target.closest("[data-select-shot]");
    var subtitle = event.target.closest("[data-select-subtitle]");
    var mark = event.target.closest("[data-transition-at]");
    var audio = event.target.closest("[data-select-audio]");
    var extra = event.target.closest("[data-select-extra]");
    if (mark) {
      var markClip = MT.clipById(mark.dataset.transitionAt);
      MT.select("transition", markClip.id, MT.entryOf(markClip).end);
      openMenu(event.clientX, event.clientY, "转场 · " + markClip.label + " 之后", transitionMenu(markClip.id));
    } else if (shot) {
      var clip = MT.clipById(shot.dataset.selectShot);
      var entry = MT.entryOf(clip);
      var canvas = $("#timeline-canvas").getBoundingClientRect();
      var pointed = MT.round1((event.clientX - canvas.left) / state.pixelsPerSecond);
      MT.select("shot", clip.id, MT.clamp(pointed, entry.start, entry.end - 0.05));
      openMenu(event.clientX, event.clientY, clip.label + " · " + MT.secText(clip.duration), clipMenu(clip));
    } else if (subtitle) {
      var sub = MT.subtitleById(subtitle.dataset.selectSubtitle);
      MT.select("subtitle", sub.id, sub.start);
      openMenu(event.clientX, event.clientY, "字幕 · " + sub.text, subtitleMenu());
    } else if (audio) {
      MT.select("audio", "audio1");
      openMenu(event.clientX, event.clientY, "第1集旁白音频", audioMenu());
    } else if (extra) {
      MT.select("extra", extra.dataset.selectExtra);
      openMenu(event.clientX, event.clientY, "分离音频", extraMenu());
    } else {
      var rect = $("#timeline-canvas").getBoundingClientRect();
      state.currentTime = MT.clamp((event.clientX - rect.left) / state.pixelsPerSecond, 0, MT.totalDuration());
      MT.renderPlayhead();
      openMenu(event.clientX, event.clientY, "时间线 · " + MT.mmss(state.currentTime), blankMenu());
    }
  });

  MT.runCommand = function (act) {
    var clip = MT.selectedShot();
    if (act.indexOf("transition:") === 0) {
      MT.setTransition(state.selected, act.split(":")[1]);
      return;
    }
    var commands = {
      split: MT.splitAtPlayhead,
      copy: function () { MT.copySelection(); },
      cut: MT.cutSelection,
      paste: MT.paste,
      duplicate: MT.duplicate,
      "delete-selection": MT.deleteSelection,
      "recognize-clip": function () { if (clip) MT.recognizeSubtitle(clip); },
      "dub-clip": function () { if (clip) MT.toast("演示：根据 " + clip.label + " 的字幕生成配音"); },
      "detach-audio": function () { if (clip) MT.detachAudio(clip); },
      "separate-voice": function () { if (clip) MT.toast("演示：正在把 " + clip.label + " 的人声与背景声拆成两条音轨"); },
      merge: function () { if (clip) MT.mergeWithNext(clip); },
      "add-transition": function () { if (clip) MT.openTransition(clip); },
      "smart-split": function () { if (clip) MT.smartSplit(clip); },
      reshoot: function () { if (clip) MT.reshoot(clip); },
      "edit-subtitle": function () {
        var text = $(".mt-sub-text");
        if (text) { text.focus(); text.select(); }
      },
      "remove-transition": MT.deleteSelection,
      "audio-settings": function () { MT.select("audio", "audio1"); },
      "mute-all": MT.toggleMute,
      "add-subtitle": MT.addSubtitle
    };
    if (commands[act]) commands[act]();
  };

  document.addEventListener("click", function (event) {
    var menu = $("#context-menu");
    if (menu.hidden) return;
    var entry = event.target.closest("[data-menu-act]");
    if (entry) {
      event.stopPropagation();
      if (entry.disabled) return;
      MT.closeMenu();
      MT.runCommand(entry.dataset.menuAct);
      return;
    }
    if (!event.target.closest("#context-menu")) MT.closeMenu();
  }, true);

  window.addEventListener("blur", MT.closeMenu);
  document.addEventListener("scroll", MT.closeMenu, true);

  document.addEventListener("keydown", function (event) {
    var menu = $("#context-menu");
    if (!menu.hidden) {
      if (event.key === "Escape") {
        event.preventDefault();
        MT.closeMenu();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        var items = MT.$$(".mt-menu-item:not([disabled])", menu);
        var index = items.indexOf(document.activeElement);
        var next = items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
        if (next) next.focus();
        return;
      }
    }
    if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    var mod = event.metaKey || event.ctrlKey;
    var key = event.key.toLowerCase();
    var handled = true;
    if (event.key === " ") MT.togglePlayback();
    else if (mod && key === "z" && event.shiftKey) MT.redo();
    else if (mod && key === "z") MT.undo();
    else if (mod && key === "y") MT.redo();
    else if (mod && key === "c") MT.copySelection();
    else if (mod && key === "x") MT.cutSelection();
    else if (mod && key === "v") MT.paste();
    else if (mod && key === "d") MT.duplicate();
    else if (!mod && key === "s") MT.splitAtPlayhead();
    else if (event.key === "Delete" || event.key === "Backspace") MT.deleteSelection();
    else if (event.key === "Escape") { MT.clearSelection(); MT.renderSelection(); MT.renderPlayhead(); }
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      state.currentTime = MT.clamp(state.currentTime + (event.key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 1 : 0.1), 0, MT.totalDuration());
      MT.renderPlayhead();
    } else handled = false;
    if (handled) event.preventDefault();
  });
})();
