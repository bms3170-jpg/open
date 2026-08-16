(function () {
  "use strict";

  var STORAGE_KEY = "daily-ledger:v2";
  var LEGACY_STORAGE_KEY = "daily-ledger:v1";
  var THEME_KEY = "daily-ledger:theme";
  var MANUAL_NOTICE_KEY = "daily-ledger:manual-notices:v2";
  var LEGACY_MANUAL_NOTICE_KEY = "daily-ledger:manual-notices";
  var MEMO_KEY = "daily-ledger:memos:v1";
  var NOTICE_CHECK_KEY = "daily-ledger:notice-checks:v1";
  var PIN_KEY = "daily-ledger:pins:v1";
  var DATA_VERSION = 3;

  var SEED_ITEMS = [
    { id: "open-1", text: "매장 에어컨, 불 ON" },
    { id: "open-2", text: "마스트레나는 꼭 깨워주기 (시간 걸림)" },
    { id: "open-3", text: "쇼케이스 조명, 오븐 전원 ON" },
    { id: "open-4", text: "PC, 노래 전원 ON" },
    { id: "open-5", text: "SOD, 캐셔 입력" },
    { id: "open-6", text: "푸드 검수입고" },
    { id: "open-7", text: "전일자 푸드 전수 검사하면서 푸드 진열 (상온 > SW > Cake) · 미입고/과입고는 11시 이전까지 등록 (미입고: 365 > 검수입고 / 과입고: ep > 배송특이사항)" },
    { id: "open-8", text: "오픈 365 (오픈 후 30분 이내: 온도, SWT, 커피 점검)" },
    { id: "open-9", text: "SWT (푸드 쇼케이스 명표&진열 재확인 / 매장 거미줄 확인 / 먼지 확인 및 제거)" },
    { id: "open-10", text: "매니저페이지" },
    { id: "open-11", text: "근태마감 · 연장 근무 승인: 계획 외 근무 승인 / 근태 수정: 근태 수정 신청" },
    { id: "open-12", text: "푸드 발주 (토요일은 2번)" },
    { id: "open-13", text: "휴게시간 체크" },
    { id: "open-14", text: "게시판 확인, 데일리 업데이트 확인" },
    { id: "open-15", text: "10~11시 콜드브루 준비 또는 소분(원두 미리 분쇄하기)" },
    { id: "open-16", text: "콜드브루 추출" },
    { id: "open-17", text: "정산 및 데일리 작성" }
  ];

  var WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
  var WEEKLY_NOTICES = {
    0: ["물류 입고", "발주 체크", "파우더 폐기"],
    1: ["물류 발주", "제빙기 청소 (스케줄 코드 확인)", "쇼케이스 필터 청소"],
    2: ["냉동 발주 (바로 다음날 입고됨)", "발주 체크", "제빙기 청소 (스케줄 코드 확인)"],
    3: ["물류 입고", "물류 발주"],
    4: ["발주 체크"],
    5: ["냉동 발주 (바로 다음날 입고됨)", "물류 입고", "물류 발주"],
    6: []
  };

  var data = null;
  var today = "";
  var viewDate = "";
  var editingId = null;
  var dragId = null;
  var overId = null;
  var doneCollapsed = true;
  var focusMode = false;
  var searchQuery = "";

  function $(id) { return document.getElementById(id); }

  var el = {
    serial: $("serial"), themeToggle: $("themeToggle"), focusToggle: $("focusToggle"),
    prevDay: $("prevDay"), nextDay: $("nextDay"), todayBtn: $("todayBtn"),
    dateMeta: $("dateMeta"), dateHead: $("dateHead"), readonlyNote: $("readonlyNote"),
    pctNum: $("pctNum"), progressRing: $("progressRing"), track: $("track"), fill: $("fill"),
    statTotal: $("statTotal"), statDone: $("statDone"), statRemain: $("statRemain"), doneFlag: $("doneFlag"),
    weekAverage: $("weekAverage"), pastEmpty: $("pastEmpty"), pastList: $("pastList"),
    clearChecks: $("clearChecks"), resetAll: $("resetAll"),
    captionKicker: $("captionKicker"), captionHead: $("captionHead"),
    composeRow: $("composeRow"), newItem: $("newItem"), addBtn: $("addBtn"),
    pendingCount: $("pendingCount"), pendingList: $("pendingList"), doneList: $("doneList"),
    emptyState: $("emptyState"), settledBar: $("settledBar"), settledCount: $("settledCount"),
    doneToggleButton: $("doneToggleButton"), toggleDone: $("toggleDone"),
    searchToggle: $("searchToggle"), searchWrap: $("searchWrap"), searchInput: $("searchInput"), searchClear: $("searchClear"),
    footTally: $("footTally"), overlay: $("overlay"), dlgCancel: $("dlgCancel"), dlgConfirm: $("dlgConfirm"),
    seedCount: $("seedCount"), toastWrap: $("toastWrap"),
    dailyNotice: $("dailyNotice"), dailyNoticeDay: $("dailyNoticeDay"), dailyNoticeList: $("dailyNoticeList"),
    dailyNoticeSummary: $("dailyNoticeSummary"), dailyNoticeReset: $("dailyNoticeReset"),
    manualNoticeCount: $("manualNoticeCount"), manualNoticeInput: $("manualNoticeInput"),
    manualNoticeAdd: $("manualNoticeAdd"), manualNoticeList: $("manualNoticeList"), manualNoticeEmpty: $("manualNoticeEmpty"),
    todayMemo: $("todayMemo"), memoSaveState: $("memoSaveState"), memoCount: $("memoCount"), memoClear: $("memoClear"),
    quickAddFab: $("quickAddFab")
  };

  function toDateKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function todayKey() { return toDateKey(new Date()); }
  function parseKey(key) {
    var p = key.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  function shiftKey(key, delta) {
    var d = parseKey(key);
    d.setDate(d.getDate() + delta);
    return toDateKey(d);
  }
  function formatLongKo(key) {
    var d = parseKey(key);
    return { md: (d.getMonth() + 1) + "월 " + d.getDate() + "일", wd: WEEKDAY_KO[d.getDay()] + "요일" };
  }
  function formatShortKo(key) {
    var d = parseKey(key);
    return (d.getMonth() + 1) + "." + d.getDate();
  }
  function newId(prefix) {
    return (prefix || "it") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function createInitialData() {
    var now = Date.now();
    return {
      version: DATA_VERSION,
      items: SEED_ITEMS.map(function (s, i) {
        return { id: s.id, text: s.text, seed: true, pinned: false, createdAt: now + i };
      }),
      history: {},
      snapshots: {},
      lastSeenDate: todayKey()
    };
  }

  function normalize(raw) {
    var base = createInitialData();
    if (!raw || typeof raw !== "object") return base;
    var items = [];
    var seen = {};
    if (Array.isArray(raw.items)) {
      raw.items.forEach(function (it) {
        if (!it || typeof it.id !== "string" || typeof it.text !== "string" || seen[it.id]) return;
        seen[it.id] = true;
        items.push({
          id: it.id,
          text: it.text,
          seed: it.seed === true,
          pinned: it.pinned === true,
          createdAt: typeof it.createdAt === "number" ? it.createdAt : Date.now()
        });
      });
    }
    if (!items.length) items = base.items;

    var history = {};
    if (raw.history && typeof raw.history === "object") {
      Object.keys(raw.history).forEach(function (k) {
        history[k] = Array.isArray(raw.history[k]) ? raw.history[k].filter(function (x, i, a) {
          return typeof x === "string" && a.indexOf(x) === i;
        }) : [];
      });
    }

    var snapshots = {};
    if (raw.snapshots && typeof raw.snapshots === "object") {
      Object.keys(raw.snapshots).forEach(function (k) {
        if (!raw.snapshots[k] || typeof raw.snapshots[k] !== "object") return;
        snapshots[k] = {};
        Object.keys(raw.snapshots[k]).forEach(function (id) {
          if (typeof raw.snapshots[k][id] === "string") snapshots[k][id] = raw.snapshots[k][id];
        });
      });
    }

    return {
      version: DATA_VERSION,
      items: items,
      history: history,
      snapshots: snapshots,
      lastSeenDate: typeof raw.lastSeenDate === "string" ? raw.lastSeenDate : todayKey()
    };
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
      var legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        var migrated = normalize(JSON.parse(legacy));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (e) {}
    return createInitialData();
  }
  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function snapshot(dateKey) {
    if (!data.snapshots[dateKey]) data.snapshots[dateKey] = {};
    data.items.forEach(function (it) { data.snapshots[dateKey][it.id] = it.text; });
  }

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function completedList(dateKey) { return data.history[dateKey] || []; }
  function rowsForDate(dateKey) {
    var done = completedList(dateKey);
    var snap = data.snapshots[dateKey] || {};
    var live = {};
    var rows = data.items.map(function (it) {
      live[it.id] = true;
      return {
        id: it.id,
        text: (dateKey !== today && snap[it.id] !== undefined) ? snap[it.id] : it.text,
        done: done.indexOf(it.id) !== -1,
        removed: false,
        pinned: it.pinned === true
      };
    });
    Object.keys(snap).forEach(function (id) {
      if (!live[id]) rows.push({ id: id, text: snap[id], done: done.indexOf(id) !== -1, removed: true, pinned: false });
    });
    return rows;
  }
  function percentOf(total, done) { return total ? Math.round((done / total) * 100) : 0; }
  function indexOfItem(id) { return data.items.findIndex(function (it) { return it.id === id; }); }
  function pastKeys() {
    var set = {};
    Object.keys(data.history).forEach(function (k) { set[k] = true; });
    Object.keys(data.snapshots).forEach(function (k) { set[k] = true; });
    return Object.keys(set).filter(function (k) { return k < today; }).sort().reverse();
  }

  function addItem(text) {
    var clean = String(text || "").trim();
    if (!clean) return;
    if (viewDate !== today) viewDate = today;
    data.items.push({ id: newId("it"), text: clean, seed: false, pinned: false, createdAt: Date.now() });
    snapshot(today); saveData(); render();
  }
  function editItem(id, text) {
    var clean = String(text || "").trim();
    if (!clean) return;
    var i = indexOfItem(id);
    if (i < 0) return;
    data.items[i].text = clean; snapshot(today); saveData();
  }
  function removeItem(id) {
    var i = indexOfItem(id);
    if (i < 0) return;
    var backup = data.items[i];
    data.items.splice(i, 1); saveData(); render();
    toast("업무를 삭제했습니다.", backup.text, "되돌리기", function () {
      if (indexOfItem(backup.id) !== -1) return;
      data.items.splice(Math.min(i, data.items.length), 0, backup); saveData(); render();
    });
  }
  function toggleItem(id, dateKey) {
    var list = (data.history[dateKey] || []).slice();
    var at = list.indexOf(id);
    if (at === -1) list.push(id); else list.splice(at, 1);
    data.history[dateKey] = list; snapshot(dateKey); saveData(); render();
  }
  function togglePin(id) {
    var i = indexOfItem(id);
    if (i < 0) return;
    data.items[i].pinned = !data.items[i].pinned;
    saveData(); render();
  }
  function moveItem(id, delta) {
    var from = indexOfItem(id);
    if (from < 0) return;
    var to = Math.max(0, Math.min(data.items.length - 1, from + delta));
    if (to === from) return;
    var moved = data.items.splice(from, 1)[0];
    data.items.splice(to, 0, moved); saveData(); render();
  }
  function reorder(fromId, toId) {
    var from = indexOfItem(fromId), to = indexOfItem(toId);
    if (from < 0 || to < 0 || from === to) return;
    var moved = data.items.splice(from, 1)[0];
    data.items.splice(to, 0, moved); saveData(); render();
  }

  function loadManualNotices() {
    var items = loadJson(MANUAL_NOTICE_KEY, null);
    if (!Array.isArray(items)) {
      var legacy = loadJson(LEGACY_MANUAL_NOTICE_KEY, []);
      if (Array.isArray(legacy)) {
        items = legacy.map(function (x) {
          return { id: x.id || newId("quick"), text: x.text || "", done: false, createdAt: Date.now() };
        });
        saveJson(MANUAL_NOTICE_KEY, items);
      } else items = [];
    }
    return items.filter(function (x) { return x && typeof x.id === "string" && typeof x.text === "string"; });
  }
  function saveManualNotices(items) { saveJson(MANUAL_NOTICE_KEY, items); }
  function addManualNotice() {
    var text = el.manualNoticeInput.value.trim();
    if (!text) { el.manualNoticeInput.focus(); return; }
    var items = loadManualNotices();
    items.push({ id: newId("quick"), text: text, done: false, createdAt: Date.now() });
    saveManualNotices(items); el.manualNoticeInput.value = ""; renderManualNotices(); el.manualNoticeInput.focus();
  }
  function toggleManualNotice(id) {
    var items = loadManualNotices();
    items.forEach(function (x) { if (x.id === id) x.done = !x.done; });
    saveManualNotices(items); renderManualNotices();
  }
  function deleteManualNotice(id) {
    var items = loadManualNotices().filter(function (x) { return x.id !== id; });
    saveManualNotices(items); renderManualNotices();
  }
  function renderManualNotices() {
    var items = loadManualNotices();
    var done = items.filter(function (x) { return x.done; }).length;
    el.manualNoticeCount.textContent = items.length ? (done + "/" + items.length) : "0건";
    el.manualNoticeEmpty.hidden = items.length > 0;
    el.manualNoticeList.innerHTML = items.map(function (item) {
      return '<li class="' + (item.done ? 'done' : '') + '" data-manual-id="' + escapeHtml(item.id) + '">' +
        '<button type="button" class="quick-check" data-manual-toggle="' + escapeHtml(item.id) + '" aria-label="완료 표시">' + (item.done ? "✓" : "") + '</button>' +
        '<span class="quick-text">' + escapeHtml(item.text) + '</span>' +
        '<button type="button" class="quick-delete" data-manual-delete="' + escapeHtml(item.id) + '">삭제</button>' +
        '</li>';
    }).join("");
  }

  function loadNoticeChecks() { return loadJson(NOTICE_CHECK_KEY, {}); }
  function saveNoticeChecks(v) { saveJson(NOTICE_CHECK_KEY, v); }
  function noticeKeyFor(dateKey, text) { return dateKey + "::" + text; }
  function renderDailyNotice() {
    var d = parseKey(viewDate);
    var weekday = d.getDay();
    var notices = WEEKLY_NOTICES[weekday] || [];
    if (!notices.length) {
      el.dailyNotice.hidden = true; el.dailyNoticeList.innerHTML = ""; return;
    }
    el.dailyNotice.hidden = false;
    el.dailyNoticeDay.textContent = (d.getMonth() + 1) + "." + d.getDate() + " · " + WEEKDAY_KO[weekday] + "요일";

    var checks = loadNoticeChecks();
    var completed = 0;
    el.dailyNoticeList.innerHTML = notices.map(function (text) {
      var key = noticeKeyFor(viewDate, text);
      var checked = !!checks[key];
      if (checked) completed++;
      return '<li class="' + (checked ? "done" : "") + '">' +
        '<button type="button" class="notice-check" data-notice-key="' + escapeHtml(key) + '" aria-label="정기 업무 완료">' + (checked ? "✓" : "") + '</button>' +
        '<span>' + escapeHtml(text) + '</span>' +
        '</li>';
    }).join("");
    el.dailyNoticeSummary.textContent = completed + " / " + notices.length + " 완료";
    el.dailyNotice.classList.toggle("all-done", completed === notices.length && notices.length > 0);
  }

  function loadMemos() { return loadJson(MEMO_KEY, {}); }
  function renderMemo() {
    var memos = loadMemos();
    var text = typeof memos[viewDate] === "string" ? memos[viewDate] : "";
    el.todayMemo.value = text;
    el.todayMemo.readOnly = viewDate !== today;
    el.memoClear.hidden = viewDate !== today || !text;
    el.memoCount.textContent = text.length + " / 500";
    el.memoSaveState.textContent = viewDate === today ? "자동 저장" : "지난 메모";
  }
  function saveMemo() {
    if (viewDate !== today) return;
    var memos = loadMemos();
    memos[today] = el.todayMemo.value;
    saveJson(MEMO_KEY, memos);
    el.memoCount.textContent = el.todayMemo.value.length + " / 500";
    el.memoSaveState.textContent = "저장됨";
    setTimeout(function () { if (viewDate === today) el.memoSaveState.textContent = "자동 저장"; }, 700);
    el.memoClear.hidden = !el.todayMemo.value;
  }

  function buildRow(row, ordinal, readOnly) {
    var li = document.createElement("li");
    li.className = "task-row" + (row.done ? " done" : "") + (row.pinned ? " pinned" : "");
    li.dataset.rowId = row.id;
    var editable = !readOnly && !row.removed;
    if (editable) li.draggable = true;

    var idx = indexOfItem(row.id);
    var canUp = idx > 0, canDown = idx >= 0 && idx < data.items.length - 1;

    var html = '<span class="task-index mono">' + String(ordinal).padStart(2, "0") + '</span>' +
      '<button type="button" class="task-check" data-act="toggle" aria-label="완료 표시">' + (row.done ? "✓" : "") + '</button>' +
      '<div class="task-text-wrap">';

    if (editingId === row.id) {
      html += '<input class="edit-input" type="text" maxlength="140" value="' + escapeHtml(row.text) + '">';
    } else {
      html += '<button type="button" class="task-text" data-act="' + (editable ? "edit" : "toggle") + '">' +
        escapeHtml(row.text) + '</button>';
    }
    html += '</div>';

    if (editable && editingId !== row.id) {
      html += '<div class="task-actions">' +
        '<button type="button" class="mini-btn pin-btn ' + (row.pinned ? "active" : "") + '" data-act="pin" title="상단 고정">📌</button>' +
        '<button type="button" class="mini-btn" data-act="up" ' + (canUp ? "" : "disabled") + '>↑</button>' +
        '<button type="button" class="mini-btn" data-act="down" ' + (canDown ? "" : "disabled") + '>↓</button>' +
        '<button type="button" class="mini-btn" data-act="edit">✎</button>' +
        '<button type="button" class="mini-btn danger" data-act="delete">×</button>' +
        '<span class="grip" aria-hidden="true">⋮⋮</span>' +
      '</div>';
    }
    li.innerHTML = html;
    return li;
  }

  function sortRows(rows) {
    return rows.slice().sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return indexOfItem(a.id) - indexOfItem(b.id);
    });
  }

  function renderHistory() {
    var past = pastKeys();
    el.pastEmpty.hidden = past.length > 0;
    el.pastList.innerHTML = "";
    var recent = [];
    past.slice(0, 7).forEach(function (k) {
      var rows = rowsForDate(k);
      var done = rows.filter(function (r) { return r.done; }).length;
      var pct = percentOf(rows.length, done);
      recent.push(pct);
      var li = document.createElement("li");
      li.innerHTML = '<button type="button" class="history-row ' + (k === viewDate ? "active" : "") + '" data-history-date="' + k + '">' +
        '<span><strong>' + formatShortKo(k) + '</strong><small>' + WEEKDAY_KO[parseKey(k).getDay()] + '요일</small></span>' +
        '<span class="history-bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="mono">' + pct + '%</span>' +
      '</button>';
      el.pastList.appendChild(li);
    });
    var avg = recent.length ? Math.round(recent.reduce(function (a, b) { return a + b; }, 0) / recent.length) : 0;
    el.weekAverage.textContent = "7일 평균 " + avg + "%";
  }

  function render() {
    renderDailyNotice();
    renderManualNotices();
    renderMemo();
    renderHistory();

    var isToday = viewDate === today;
    var rows = rowsForDate(viewDate);
    var q = searchQuery.trim().toLowerCase();
    if (q) rows = rows.filter(function (r) { return r.text.toLowerCase().indexOf(q) !== -1; });

    var pending = sortRows(rows.filter(function (r) { return !r.done; }));
    var finished = sortRows(rows.filter(function (r) { return r.done; }));

    var fullRows = rowsForDate(viewDate);
    var fullDone = fullRows.filter(function (r) { return r.done; }).length;
    var pct = percentOf(fullRows.length, fullDone);
    var remain = Math.max(0, fullRows.length - fullDone);

    el.serial.textContent = "NO. " + String(data.items.length).padStart(3, "0");
    el.dateMeta.textContent = (viewDate === today ? "오늘 · " : "") + viewDate.replace(/-/g, ".");
    var lk = formatLongKo(viewDate);
    el.dateHead.querySelector(".line1").textContent = lk.md;
    el.dateHead.querySelector(".line2").textContent = lk.wd;
    el.readonlyNote.hidden = isToday;
    el.todayBtn.hidden = isToday;
    el.nextDay.disabled = viewDate >= today;

    el.pctNum.textContent = pct;
    el.progressRing.style.setProperty("--pct", pct);
    el.fill.style.width = pct + "%";
    el.track.setAttribute("aria-valuenow", pct);
    el.statTotal.textContent = fullRows.length;
    el.statDone.textContent = fullDone;
    el.statRemain.textContent = remain;
    el.doneFlag.hidden = !(fullRows.length > 0 && remain === 0);

    el.captionHead.textContent = fullRows.length ? "남은 항목 " + remain + "개" : "업무가 없습니다";
    el.captionKicker.textContent = isToday ? "오늘의 업무를 순서대로 처리하세요." : "지난 기록은 완료 표시만 변경할 수 있습니다.";
    el.composeRow.hidden = !isToday;

    el.pendingCount.textContent = pending.length + "건";
    el.pendingList.innerHTML = "";
    pending.forEach(function (r, i) { el.pendingList.appendChild(buildRow(r, i + 1, !isToday || r.removed)); });

    el.settledCount.textContent = finished.length + "건";
    el.settledBar.hidden = finished.length === 0;
    el.doneList.hidden = doneCollapsed;
    el.doneList.innerHTML = "";
    finished.forEach(function (r, i) { el.doneList.appendChild(buildRow(r, pending.length + i + 1, !isToday || r.removed)); });
    el.toggleDone.textContent = doneCollapsed ? "완료 펼치기" : "완료 접기";
    el.doneToggleButton.classList.toggle("open", !doneCollapsed);

    el.emptyState.hidden = (pending.length + finished.length) > 0;
    el.footTally.textContent = "항목 " + fullRows.length + " · 완료 " + fullDone + " · 남음 " + remain;

    if (editingId) {
      var input = document.querySelector('[data-row-id="' + editingId + '"] .edit-input');
      if (input) { input.focus(); input.select(); }
    }
  }

  function toast(title, desc, actionLabel, onAction) {
    var box = document.createElement("div");
    box.className = "toast";
    box.innerHTML = '<div><strong>' + escapeHtml(title) + '</strong>' + (desc ? '<span>' + escapeHtml(desc) + '</span>' : '') + '</div>';
    if (actionLabel && onAction) {
      var btn = document.createElement("button");
      btn.textContent = actionLabel;
      btn.onclick = function () { onAction(); box.remove(); };
      box.appendChild(btn);
    }
    el.toastWrap.appendChild(box);
    setTimeout(function () { if (box.parentNode) box.remove(); }, actionLabel ? 6000 : 3200);
  }

  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  }

  function checkRollover() {
    var t = todayKey();
    if (t === today) return;
    var wasToday = viewDate === today;
    today = t; data.lastSeenDate = t;
    if (wasToday) viewDate = t;
    saveData(); render();
  }

  function bindList(container) {
    container.addEventListener("click", function (e) {
      var actEl = e.target.closest("[data-act]");
      if (!actEl) return;
      var row = e.target.closest("[data-row-id]");
      if (!row) return;
      var id = row.dataset.rowId;
      var act = actEl.dataset.act;
      if (act === "toggle") toggleItem(id, viewDate);
      if (act === "edit") { editingId = id; render(); }
      if (act === "delete") removeItem(id);
      if (act === "up") moveItem(id, -1);
      if (act === "down") moveItem(id, 1);
      if (act === "pin") togglePin(id);
    });

    container.addEventListener("keydown", function (e) {
      if (!e.target.classList.contains("edit-input")) return;
      var row = e.target.closest("[data-row-id]");
      if (!row) return;
      if (e.key === "Enter") {
        e.preventDefault(); editItem(row.dataset.rowId, e.target.value); editingId = null; render();
      } else if (e.key === "Escape") {
        e.preventDefault(); editingId = null; render();
      }
    });

    container.addEventListener("blur", function (e) {
      if (!e.target.classList.contains("edit-input")) return;
      var row = e.target.closest("[data-row-id]");
      if (!row) return;
      editItem(row.dataset.rowId, e.target.value); editingId = null; render();
    }, true);

    container.addEventListener("dragstart", function (e) {
      var row = e.target.closest("[data-row-id]");
      if (!row || !row.draggable) return;
      dragId = row.dataset.rowId; row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    container.addEventListener("dragover", function (e) {
      e.preventDefault();
      var row = e.target.closest("[data-row-id]");
      if (!row) return;
      overId = row.dataset.rowId;
      document.querySelectorAll(".task-row.drag-over").forEach(function (n) { n.classList.remove("drag-over"); });
      if (overId !== dragId) row.classList.add("drag-over");
    });
    container.addEventListener("drop", finishDrag);
    container.addEventListener("dragend", finishDrag);
  }

  function finishDrag(e) {
    if (e) e.preventDefault();
    if (dragId && overId && dragId !== overId) reorder(dragId, overId);
    dragId = overId = null;
    document.querySelectorAll(".task-row.dragging,.task-row.drag-over").forEach(function (n) {
      n.classList.remove("dragging", "drag-over");
    });
  }

  function resetAll() {
    data = createInitialData();
    today = viewDate = todayKey();
    saveData();
    saveJson(MEMO_KEY, {});
    saveJson(NOTICE_CHECK_KEY, {});
    saveJson(MANUAL_NOTICE_KEY, []);
    el.overlay.hidden = true;
    render();
    toast("전체 초기화했습니다.", "기본 업무만 다시 생성했습니다.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function init() {
    var savedTheme = null;
    try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(savedTheme === "light" ? "light" : "dark");

    data = loadData();
    today = todayKey();
    viewDate = today;
    data.lastSeenDate = today;
    el.seedCount.textContent = SEED_ITEMS.length;
    saveData();

    el.themeToggle.addEventListener("click", function () {
      applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });

    el.focusToggle.addEventListener("click", function () {
      focusMode = !focusMode;
      document.body.classList.toggle("focus-mode", focusMode);
      el.focusToggle.classList.toggle("active", focusMode);
      if (focusMode) document.getElementById("checklistCard").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    el.prevDay.addEventListener("click", function () { viewDate = shiftKey(viewDate, -1); editingId = null; render(); });
    el.nextDay.addEventListener("click", function () { if (viewDate < today) { viewDate = shiftKey(viewDate, 1); editingId = null; render(); } });
    el.todayBtn.addEventListener("click", function () { viewDate = today; editingId = null; render(); });

    el.addBtn.addEventListener("click", function () {
      addItem(el.newItem.value); el.newItem.value = ""; el.newItem.focus();
    });
    el.newItem.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); el.addBtn.click(); } });

    el.manualNoticeAdd.addEventListener("click", addManualNotice);
    el.manualNoticeInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addManualNotice(); } });
    el.manualNoticeList.addEventListener("click", function (e) {
      var t = e.target.closest("[data-manual-toggle]");
      if (t) toggleManualNotice(t.dataset.manualToggle);
      var d = e.target.closest("[data-manual-delete]");
      if (d) deleteManualNotice(d.dataset.manualDelete);
    });

    el.dailyNoticeList.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-notice-key]");
      if (!btn) return;
      var checks = loadNoticeChecks();
      checks[btn.dataset.noticeKey] = !checks[btn.dataset.noticeKey];
      saveNoticeChecks(checks); renderDailyNotice();
    });
    el.dailyNoticeReset.addEventListener("click", function () {
      var checks = loadNoticeChecks();
      Object.keys(checks).forEach(function (k) { if (k.indexOf(viewDate + "::") === 0) delete checks[k]; });
      saveNoticeChecks(checks); renderDailyNotice();
    });

    el.todayMemo.addEventListener("input", saveMemo);
    el.memoClear.addEventListener("click", function () { if (viewDate === today) { el.todayMemo.value = ""; saveMemo(); } });

    el.toggleDone.addEventListener("click", function () { doneCollapsed = !doneCollapsed; render(); });
    el.doneToggleButton.addEventListener("click", function () { doneCollapsed = !doneCollapsed; render(); });

    el.searchToggle.addEventListener("click", function () {
      el.searchWrap.hidden = !el.searchWrap.hidden;
      if (!el.searchWrap.hidden) el.searchInput.focus();
      else { searchQuery = ""; el.searchInput.value = ""; render(); }
    });
    el.searchInput.addEventListener("input", function () { searchQuery = el.searchInput.value; render(); });
    el.searchClear.addEventListener("click", function () { searchQuery = ""; el.searchInput.value = ""; render(); });

    el.pastList.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-history-date]");
      if (!btn) return;
      viewDate = btn.dataset.historyDate; editingId = null; render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    bindList(el.pendingList); bindList(el.doneList);

    el.clearChecks.addEventListener("click", function () {
      data.history[today] = []; saveData(); render(); toast("오늘 완료 표시를 지웠습니다.");
    });
    el.resetAll.addEventListener("click", function () { el.overlay.hidden = false; el.dlgCancel.focus(); });
    el.dlgCancel.addEventListener("click", function () { el.overlay.hidden = true; });
    el.dlgConfirm.addEventListener("click", resetAll);
    el.overlay.addEventListener("click", function (e) { if (e.target === el.overlay) el.overlay.hidden = true; });

    el.quickAddFab.addEventListener("click", function () {
      document.getElementById("manualNotice").scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { el.manualNoticeInput.focus(); }, 350);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !el.overlay.hidden) { el.overlay.hidden = true; return; }
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); el.newItem.focus(); }
    });

    setInterval(checkRollover, 30000);
    window.addEventListener("focus", checkRollover);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") checkRollover(); });

    window.addEventListener("storage", function () { data = loadData(); render(); });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();