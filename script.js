/* ============================================================
   DAILY LEDGER — script.js
   프레임워크 없는 순수 JavaScript. 로그인 불필요, localStorage 저장.

   [데이터 모델]  키: "daily-ledger:v1"
   {
     version: 1,
     items:    [{ id, text, seed, createdAt }],   // 항목 원본 (영구 보존)
     history:  { "YYYY-MM-DD": [완료된 id, ...] }, // 날짜별 완료 표시
     snapshots:{ "YYYY-MM-DD": { id: "그날의 문구" } }, // 지난 장 복원용
     lastSeenDate: "YYYY-MM-DD"
   }

   핵심 설계: 항목(items)과 완료 표시(history)를 분리한다.
   → 날짜가 바뀌면 '그 날짜의 빈 완료 목록'을 새로 읽을 뿐이므로
     항목이 삭제되는 코드 경로가 아예 존재하지 않는다.
     (항목 소실·개수 감소 문제의 구조적 해결)
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- 상수 ---------------- */
  var STORAGE_KEY = "daily-ledger:v1";
  var THEME_KEY = "daily-ledger:theme";
  var MANUAL_NOTICE_KEY = "daily-ledger:manual-notices";
  var DATA_VERSION = 2;

  /** 코딩으로 만든 기본 항목 — 전체 초기화 후에도 반드시 남는 항목 */
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
    { id: "open-17", text: "정산 및 데일리 작성" },
  ];

  var WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

  /* 요일별 정기 업무 — 실제 오늘 날짜의 요일을 자동 인식해 맨 위 공지에 표시 */
  var WEEKLY_NOTICES = {
    0: ["물류 입고", "발주 체크", "파우더 폐기"],
    1: ["물류 발주", "제빙기 청소 (스케줄 코드 확인)", "쇼케이스 필터 청소"],
    2: ["냉동 발주 (바로 다음날 입고됨)", "발주 체크", "제빙기 청소 (스케줄 코드 확인)"],
    3: ["물류 입고", "물류 발주"],
    4: ["발주 체크"],
    5: ["냉동 발주 (바로 다음날 입고됨)", "물류 입고", "물류 발주"],
    6: [],
  };

  /* ---------------- 상태 ---------------- */
  var data = null; // LedgerData
  var today = ""; // "YYYY-MM-DD"
  var viewDate = ""; // 현재 보고 있는 날짜
  var dragId = null;
  var overId = null;
  var editingId = null;
  var flashId = null;
  var flashTimer = null;

  /* ---------------- DOM 참조 ---------------- */
  var $ = function (id) {
    return document.getElementById(id);
  };

  var el = {
    serial: $("serial"),
    themeToggle: $("themeToggle"),
    prevDay: $("prevDay"),
    nextDay: $("nextDay"),
    todayBtn: $("todayBtn"),
    dateMeta: $("dateMeta"),
    dateHead: $("dateHead"),
    readonlyNote: $("readonlyNote"),
    pctNum: $("pctNum"),
    track: $("track"),
    fill: $("fill"),
    tally: $("tally"),
    doneFlag: $("doneFlag"),
    pastEmpty: $("pastEmpty"),
    pastList: $("pastList"),
    clearChecks: $("clearChecks"),
    resetAll: $("resetAll"),
    captionKicker: $("captionKicker"),
    captionHead: $("captionHead"),
    captionDate: $("captionDate"),
    composeRow: $("composeRow"),
    newItem: $("newItem"),
    addBtn: $("addBtn"),
    pendingList: $("pendingList"),
    doneList: $("doneList"),
    emptyState: $("emptyState"),
    settledBar: $("settledBar"),
    settledCount: $("settledCount"),
    footTally: $("footTally"),
    overlay: $("overlay"),
    dlgCancel: $("dlgCancel"),
    dlgConfirm: $("dlgConfirm"),
    seedCount: $("seedCount"),
    toastWrap: $("toastWrap"),
    dailyNotice: $("dailyNotice"),
    dailyNoticeDay: $("dailyNoticeDay"),
    dailyNoticeList: $("dailyNoticeList"),
    manualNotice: $("manualNotice"),
    manualNoticeCount: $("manualNoticeCount"),
    manualNoticeInput: $("manualNoticeInput"),
    manualNoticeAdd: $("manualNoticeAdd"),
    manualNoticeList: $("manualNoticeList"),
    manualNoticeEmpty: $("manualNoticeEmpty"),
  };

  /* ============================================================
     1. 날짜 유틸 (모두 로컬 시간 기준)
     ============================================================ */
  function toDateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function todayKey() {
    return toDateKey(new Date());
  }

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
    return {
      md: d.getMonth() + 1 + "월 " + d.getDate() + "일",
      wd: WEEKDAY_KO[d.getDay()] + "요일",
    };
  }

  function formatShortKo(key) {
    var d = parseKey(key);
    return d.getMonth() + 1 + "." + d.getDate();
  }

  function relativeLabel(key) {
    if (key === today) return "오늘";
    if (key === shiftKey(today, -1)) return "어제";
    return null;
  }

  function newId() {
    return "it-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  /* ============================================================
     2. 저장 / 불러오기 (방어적으로)
     ============================================================ */
  function createInitialData() {
    var now = Date.now();
    return {
      version: DATA_VERSION,
      items: SEED_ITEMS.map(function (s, i) {
        return { id: s.id, text: s.text, seed: true, createdAt: now + i };
      }),
      history: {},
      snapshots: {},
      lastSeenDate: todayKey(),
    };
  }

  /**
   * 저장된 값이 어떤 형태로 깨져 있어도 항목을 버리지 않고 최대한 살린다.
   * 중복 id 제거까지 수행 — 중복 id는 렌더링 꼬임의 원인이 된다.
   */
  function normalize(raw) {
    var base = createInitialData();
    if (!raw || typeof raw !== "object") return base;

    var incomingVersion = Number(raw.version) || 1;
    var items = [];
    if (Array.isArray(raw.items)) {
      var seen = {};
      raw.items.forEach(function (it) {
        if (!it || typeof it !== "object") return;
        if (typeof it.id !== "string" || typeof it.text !== "string") return;
        if (seen[it.id]) return;
        seen[it.id] = true;
        items.push({
          id: it.id,
          text: it.text,
          seed: it.seed === true,
          createdAt: typeof it.createdAt === "number" ? it.createdAt : Date.now(),
        });
      });
    }
    if (!items.length && !Array.isArray(raw.items)) items = base.items;

    // v1 → v2: 예전 기본 목록은 새 오픈 To-do로 교체하고 직접 추가한 항목은 보존한다.
    if (incomingVersion < 2) {
      var customItems = items.filter(function (it) {
        return it.seed !== true;
      });
      items = base.items.concat(customItems);
    }

    var history = {};
    if (raw.history && typeof raw.history === "object") {
      Object.keys(raw.history).forEach(function (k) {
        var v = raw.history[k];
        if (!Array.isArray(v)) return;
        var uniq = [];
        v.forEach(function (x) {
          if (typeof x === "string" && uniq.indexOf(x) === -1) uniq.push(x);
        });
        history[k] = uniq;
      });
    }

    var snapshots = {};
    if (raw.snapshots && typeof raw.snapshots === "object") {
      Object.keys(raw.snapshots).forEach(function (k) {
        var v = raw.snapshots[k];
        if (!v || typeof v !== "object" || Array.isArray(v)) return;
        var inner = {};
        Object.keys(v).forEach(function (id) {
          if (typeof v[id] === "string") inner[id] = v[id];
        });
        snapshots[k] = inner;
      });
    }

    return {
      version: DATA_VERSION,
      items: items,
      history: history,
      snapshots: snapshots,
      lastSeenDate: typeof raw.lastSeenDate === "string" ? raw.lastSeenDate : todayKey(),
    };
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialData();
      return normalize(JSON.parse(raw));
    } catch (e) {
      // 파싱 실패 시에도 원본을 지우지 않고 백업으로 남긴다.
      try {
        var broken = localStorage.getItem(STORAGE_KEY);
        if (broken) localStorage.setItem(STORAGE_KEY + ":backup:" + Date.now(), broken);
      } catch (e2) {
        /* 무시 */
      }
      return createInitialData();
    }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* 용량 초과 / 시크릿 모드 — 화면은 계속 사용 가능하게 둔다 */
    }
  }

  /** 오늘 문구를 스냅샷에 기록해 두면, 나중에 수정/삭제해도 지난 장이 그대로 남는다. */
  function snapshot(dateKey) {
    if (!data.snapshots[dateKey]) data.snapshots[dateKey] = {};
    var snap = data.snapshots[dateKey];
    data.items.forEach(function (it) {
      snap[it.id] = it.text;
    });
  }

  /* ============================================================
     3. 파생 데이터
     ============================================================ */
  function completedList(dateKey) {
    return data.history[dateKey] || [];
  }

  /** 특정 날짜에 표시할 줄 목록. 스냅샷 문구가 우선. */
  function rowsForDate(dateKey) {
    var done = completedList(dateKey);
    var snap = data.snapshots[dateKey] || {};
    var liveIds = {};
    var rows = data.items.map(function (it) {
      liveIds[it.id] = true;
      return {
        id: it.id,
        text: snap[it.id] !== undefined && dateKey !== today ? snap[it.id] : it.text,
        done: done.indexOf(it.id) !== -1,
        removed: false,
      };
    });
    // 그날엔 있었지만 이후 삭제된 항목도 지난 장에는 남겨 보여준다.
    Object.keys(snap).forEach(function (id) {
      if (!liveIds[id]) {
        rows.push({ id: id, text: snap[id], done: done.indexOf(id) !== -1, removed: true });
      }
    });
    return rows;
  }

  function percentOf(total, done) {
    return total <= 0 ? 0 : Math.round((done / total) * 100);
  }

  /** 오늘 이전으로 기록이 있는 날짜들, 최신순 */
  function pastKeys() {
    var set = {};
    Object.keys(data.history).forEach(function (k) {
      set[k] = true;
    });
    Object.keys(data.snapshots).forEach(function (k) {
      set[k] = true;
    });
    return Object.keys(set)
      .filter(function (k) {
        return k < today;
      })
      .sort()
      .reverse();
  }

  function indexOfItem(id) {
    for (var i = 0; i < data.items.length; i++) {
      if (data.items[i].id === id) return i;
    }
    return -1;
  }

  /* ============================================================
     4. 동작(액션)
     ============================================================ */
  function addItem(text) {
    var clean = String(text || "").trim();
    if (!clean) return null;
    if (viewDate !== today) viewDate = today; // 지난 장을 보고 있었다면 오늘로 복귀
    var item = { id: newId(), text: clean, seed: false, createdAt: Date.now() };
    data.items.push(item);
    snapshot(today);
    saveData();
    setFlash(item.id);
    render();
    return item.id;
  }

  function editItem(id, text) {
    var clean = String(text || "").trim();
    if (!clean) return;
    var i = indexOfItem(id);
    if (i < 0) return;
    data.items[i].text = clean;
    snapshot(today);
    saveData();
  }

  function removeItem(id) {
    var i = indexOfItem(id);
    if (i < 0) return;
    var backup = data.items[i];
    data.items.splice(i, 1);
    saveData();
    render();

    // 되돌리기 제공 — 실수로 지운 항목을 잃지 않게
    toast("항목을 지웠습니다.", backup.text, "되돌리기", function () {
      if (indexOfItem(backup.id) !== -1) return;
      data.items.splice(Math.min(i, data.items.length), 0, backup);
      saveData();
      render();
    });
  }

  function toggleItem(id, dateKey) {
    var list = data.history[dateKey] ? data.history[dateKey].slice() : [];
    var at = list.indexOf(id);
    if (at === -1) list.push(id);
    else list.splice(at, 1);
    data.history[dateKey] = list;
    snapshot(dateKey);
    saveData();
    render();
  }

  /**
   * 순서 이동 + 화면 동시 스크롤.
   * 이동 전 화면상 위치를 기억한 뒤, 이동 후 위치와의 차이만큼
   * window 를 스크롤해 항목이 시선 아래에 그대로 머무르게 한다.
   */
  function moveItem(id, delta) {
    var from = indexOfItem(id);
    if (from < 0) return;
    var to = Math.min(Math.max(from + delta, 0), data.items.length - 1);
    if (to === from) return;

    var nodeBefore = document.querySelector('[data-row-id="' + id + '"]');
    var topBefore = nodeBefore ? nodeBefore.getBoundingClientRect().top : null;

    var moved = data.items.splice(from, 1)[0];
    data.items.splice(to, 0, moved);
    saveData();
    setFlash(id);
    render();

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var nodeAfter = document.querySelector('[data-row-id="' + id + '"]');
        if (!nodeAfter) return;
        var topAfter = nodeAfter.getBoundingClientRect().top;
        if (topBefore !== null) {
          var shift = topAfter - topBefore;
          if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "smooth" });
        }
        // 화면 밖으로 나갔다면 중앙으로 끌어온다
        var box = nodeAfter.getBoundingClientRect();
        if (box.top < 80 || box.bottom > window.innerHeight - 40) {
          nodeAfter.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  /** 드래그로 순서 교체 */
  function reorder(fromId, toId) {
    var from = indexOfItem(fromId);
    var to = indexOfItem(toId);
    if (from < 0 || to < 0 || from === to) return;
    var moved = data.items.splice(from, 1)[0];
    data.items.splice(to, 0, moved);
    saveData();
    render();
  }

  /** 오늘의 완료 표시만 지운다. 항목은 손대지 않는다. */
  function clearTodayChecks() {
    data.history[today] = [];
    saveData();
    render();
    toast("오늘의 완료 표시를 모두 지웠습니다.", "항목은 그대로 남아 있습니다.");
  }

  /**
   * 전체 초기화 — 추가한 항목, 모든 완료 표시, 지난 기록을 모두 비우고
   * 기본(코딩으로 만든) 항목만 남긴 '항목 추가 이전' 상태로 되돌린다.
   */
  function resetAll() {
    data = createInitialData();
    viewDate = today = todayKey();
    editingId = null;
    el.newItem.value = "";
    syncCommitBtn();
    saveData();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("장부를 새로 시작했습니다.", "기본 항목 " + SEED_ITEMS.length + "개만 남았습니다.");
  }

  function setFlash(id) {
    flashId = id;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      flashId = null;
      var n = document.querySelector(".row.flash");
      if (n) n.classList.remove("flash");
    }, 450);
  }

  /* ============================================================
     5. 렌더링
     ============================================================ */
  var ICONS = {
    check:
      '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    up: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    down: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    pencil:
      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash:
      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>',
    grip: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** 한 줄(li) 생성 */
  function buildRow(row, ordinal, readOnly) {
    var li = document.createElement("li");
    li.className = "row" + (row.done ? " done" : "");
    li.setAttribute("data-row-id", row.id);
    li.style.animationDelay = Math.min(ordinal, 12) * 32 + "ms";
    if (flashId === row.id) li.classList.add("flash");

    var editable = !readOnly && !row.removed;
    if (editable) li.draggable = true;

    var oi = indexOfItem(row.id);
    var canUp = oi > 0;
    var canDown = oi >= 0 && oi < data.items.length - 1;

    var html = "";
    html += '<span class="ordinal num-plate">' + String(ordinal).padStart(2, "0") + "</span>";
    html +=
      '<button type="button" class="seal-box" role="checkbox" aria-checked="' +
      (row.done ? "true" : "false") +
      '" data-act="toggle" aria-label="' +
      escapeHtml(row.text) +
      " " +
      (row.done ? "완료 해제" : "완료 표시") +
      '">' +
      (row.done ? ICONS.check : "") +
      "</button>";

    if (editingId === row.id) {
      html +=
        '<div class="row-text-wrap"><div class="row-edit">' +
        '<input type="text" class="edit-input" maxlength="140" value="' +
        escapeHtml(row.text) +
        '" aria-label="항목 수정" />' +
        "</div></div>";
    } else {
      html +=
        '<div class="row-text-wrap">' +
        '<button type="button" class="row-text" data-act="' +
        (editable ? "edit" : "toggle") +
        '" title="' +
        (editable ? "클릭하여 수정" : escapeHtml(row.text)) +
        '">' +
        escapeHtml(row.text) +
        '<span class="strike" aria-hidden="true"></span>' +
        "</button>" +
        "</div>";
    }

    if (editable && editingId !== row.id) {
      html +=
        '<div class="actions">' +
        '<button type="button" class="act" data-act="up" aria-label="위로 이동"' +
        (canUp ? "" : " disabled") +
        ">" +
        ICONS.up +
        "</button>" +
        '<button type="button" class="act" data-act="down" aria-label="아래로 이동"' +
        (canDown ? "" : " disabled") +
        ">" +
        ICONS.down +
        "</button>" +
        '<button type="button" class="act" data-act="edit" aria-label="항목 수정">' +
        ICONS.pencil +
        "</button>" +
        '<button type="button" class="act del" data-act="delete" aria-label="항목 삭제">' +
        ICONS.trash +
        "</button>" +
        '<span class="grip" title="드래그하여 순서 변경" aria-hidden="true">' +
        ICONS.grip +
        "</span>" +
        "</div>";
    }

    li.innerHTML = html;
    return li;
  }

  function loadManualNotices() {
    try {
      var raw = localStorage.getItem(MANUAL_NOTICE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && typeof item.id === "string" && typeof item.text === "string";
      });
    } catch (e) {
      return [];
    }
  }

  function saveManualNotices(items) {
    try {
      localStorage.setItem(MANUAL_NOTICE_KEY, JSON.stringify(items));
    } catch (e) {
      /* 저장 실패 시 화면 사용은 계속 허용 */
    }
  }

  function renderManualNotices() {
    if (!el.manualNoticeList || !el.manualNoticeCount || !el.manualNoticeEmpty) return;
    var items = loadManualNotices();
    el.manualNoticeCount.textContent = items.length + "건";
    el.manualNoticeEmpty.hidden = items.length > 0;
    el.manualNoticeList.innerHTML = items.map(function (item) {
      return (
        '<li data-manual-id="' + escapeHtml(item.id) + '">' +
        '<span class="manual-notice__text">' + escapeHtml(item.text) + '</span>' +
        '<button type="button" class="manual-notice__delete" data-manual-delete="' + escapeHtml(item.id) + '" aria-label="수동 공지 삭제">삭제</button>' +
        '</li>'
      );
    }).join("");
  }

  function addManualNotice() {
    if (!el.manualNoticeInput) return;
    var text = String(el.manualNoticeInput.value || "").trim();
    if (!text) {
      el.manualNoticeInput.focus();
      return;
    }
    var items = loadManualNotices();
    items.push({ id: "notice-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7), text: text });
    saveManualNotices(items);
    el.manualNoticeInput.value = "";
    renderManualNotices();
    el.manualNoticeInput.focus();
    toast("수동 공지를 추가했습니다.", text);
  }

  function deleteManualNotice(id) {
    var items = loadManualNotices();
    var removed = null;
    items = items.filter(function (item) {
      if (item.id === id) { removed = item; return false; }
      return true;
    });
    saveManualNotices(items);
    renderManualNotices();
    if (removed) toast("수동 공지를 삭제했습니다.", removed.text);
  }

  function renderDailyNotice() {
    if (!el.dailyNotice || !el.dailyNoticeList || !el.dailyNoticeDay) return;

    var now = new Date();
    var weekday = now.getDay();
    var notices = WEEKLY_NOTICES[weekday] || [];

    if (!notices.length) {
      el.dailyNotice.hidden = true;
      el.dailyNoticeList.innerHTML = "";
      return;
    }

    el.dailyNotice.hidden = false;
    el.dailyNoticeDay.textContent =
      (now.getMonth() + 1) + "." + now.getDate() + " · " + WEEKDAY_KO[weekday] + "요일";
    el.dailyNoticeList.innerHTML = notices.map(function (text) {
      return "<li>" + escapeHtml(text) + "</li>";
    }).join("");
  }

  function render() {
    renderDailyNotice();
    renderManualNotices();
    var isToday = viewDate === today;
    var rows = rowsForDate(viewDate);
    var pending = rows.filter(function (r) {
      return !r.done;
    });
    var finished = rows.filter(function (r) {
      return r.done;
    });
    var pct = percentOf(rows.length, finished.length);
    var complete = rows.length > 0 && finished.length === rows.length;

    /* --- 머리글 --- */
    el.serial.textContent = "NO. " + String(data.items.length).padStart(3, "0");

    /* --- 날짜 --- */
    var rel = relativeLabel(viewDate);
    el.dateMeta.innerHTML =
      (rel ? rel + " · " : "") + '<span class="num-plate">' + viewDate.replace(/-/g, ".") + "</span>";
    var lk = formatLongKo(viewDate);
    el.dateHead.querySelector(".line1").textContent = lk.md;
    el.dateHead.querySelector(".line2").textContent = lk.wd;
    el.readonlyNote.hidden = isToday;
    el.todayBtn.hidden = isToday;
    el.nextDay.disabled = viewDate >= today;

    /* --- 진행률 --- */
    el.pctNum.textContent = String(pct);
    el.pctNum.parentNode.classList.toggle("complete", complete);
    el.fill.style.transform = "scaleX(" + pct / 100 + ")";
    el.fill.classList.toggle("complete", complete);
    el.track.setAttribute("aria-valuenow", String(pct));
    el.tally.textContent = finished.length + " / " + rows.length + " 완료";
    el.doneFlag.hidden = !complete;

    /* --- 지난 기록 --- */
    var past = pastKeys();
    el.pastEmpty.hidden = past.length > 0;
    el.pastList.innerHTML = "";
    past.slice(0, 8).forEach(function (k) {
      var r = rowsForDate(k);
      var d = r.filter(function (x) {
        return x.done;
      }).length;
      var p = percentOf(r.length, d);
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "past-row" + (k === viewDate ? " active" : "");
      btn.innerHTML =
        '<span class="pd num-plate">' +
        formatShortKo(k) +
        "</span>" +
        '<span class="pbar"><i class="' +
        (p === 100 ? "full" : "") +
        '" style="transform:scaleX(' +
        p / 100 +
        ')"></i></span>' +
        '<span class="pp num-plate">' +
        p +
        "%</span>";
      btn.addEventListener("click", function () {
        viewDate = k;
        editingId = null;
        render();
      });
      li.appendChild(btn);
      el.pastList.appendChild(li);
    });

    /* --- 기입란 머리글 --- */
    el.captionKicker.textContent = isToday ? "오늘의 기입란" : "지난 장부";
    el.captionHead.textContent =
      rows.length === 0
        ? "기입란이 비어 있습니다"
        : complete
          ? "오늘 몫을 모두 적었습니다"
          : "남은 항목 " + pending.length + "개";
    el.captionDate.textContent = viewDate.replace(/-/g, ".");
    el.composeRow.hidden = !isToday;

    /* --- 목록 --- */
    el.pendingList.innerHTML = "";
    pending.forEach(function (r, i) {
      el.pendingList.appendChild(buildRow(r, i + 1, !isToday || r.removed));
    });

    el.emptyState.hidden = rows.length !== 0;

    el.settledBar.hidden = finished.length === 0;
    el.settledCount.textContent = finished.length + "건";
    el.doneList.innerHTML = "";
    finished.forEach(function (r, i) {
      el.doneList.appendChild(buildRow(r, pending.length + i + 1, !isToday || r.removed));
    });

    /* --- 합계선 --- */
    el.footTally.textContent =
      "항목 " + rows.length + " · 완료 " + finished.length + " · 남음 " + pending.length;

    /* --- 편집 중이면 입력란에 포커스 --- */
    if (editingId) {
      var input = document.querySelector('[data-row-id="' + editingId + '"] .edit-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  /* ============================================================
     6. 이벤트
     ============================================================ */

  /** 목록 클릭 처리 (이벤트 위임) */
  function onListClick(e) {
    var actEl = e.target.closest("[data-act]");
    if (!actEl) return;
    var li = e.target.closest("[data-row-id]");
    if (!li) return;
    var id = li.getAttribute("data-row-id");
    var act = actEl.getAttribute("data-act");

    if (act === "toggle") toggleItem(id, viewDate);
    else if (act === "edit") {
      editingId = id;
      render();
    } else if (act === "delete") removeItem(id);
    else if (act === "up") moveItem(id, -1);
    else if (act === "down") moveItem(id, 1);
  }

  /** 인라인 편집 확정/취소 */
  function onListKeydown(e) {
    if (!e.target.classList.contains("edit-input")) return;
    var li = e.target.closest("[data-row-id]");
    if (!li) return;
    var id = li.getAttribute("data-row-id");

    if (e.key === "Enter") {
      e.preventDefault();
      editItem(id, e.target.value);
      editingId = null;
      render();
    } else if (e.key === "Escape") {
      e.preventDefault();
      editingId = null;
      render();
    }
  }

  function onListBlur(e) {
    if (!e.target.classList.contains("edit-input")) return;
    var li = e.target.closest("[data-row-id]");
    if (!li) return;
    editItem(li.getAttribute("data-row-id"), e.target.value);
    editingId = null;
    render();
  }

  /** 드래그 앤 드롭 */
  function bindDnd(container) {
    container.addEventListener("dragstart", function (e) {
      var li = e.target.closest("[data-row-id]");
      if (!li || !li.draggable) return;
      dragId = li.getAttribute("data-row-id");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragId);
      li.classList.add("dragging");
    });

    container.addEventListener("dragover", function (e) {
      e.preventDefault();
      var li = e.target.closest("[data-row-id]");
      if (!li) return;
      var id = li.getAttribute("data-row-id");
      if (id === overId) return;
      overId = id;
      document.querySelectorAll(".row.drag-over").forEach(function (n) {
        n.classList.remove("drag-over");
      });
      if (id !== dragId) li.classList.add("drag-over");
    });

    container.addEventListener("drop", function (e) {
      e.preventDefault();
      finishDrag();
    });

    container.addEventListener("dragend", function () {
      finishDrag();
    });
  }

  function finishDrag() {
    if (dragId && overId && dragId !== overId) reorder(dragId, overId);
    dragId = null;
    overId = null;
    document.querySelectorAll(".row.dragging, .row.drag-over").forEach(function (n) {
      n.classList.remove("dragging", "drag-over");
    });
  }

  function syncCommitBtn() {
    el.addBtn.classList.toggle("ready", el.newItem.value.trim().length > 0);
  }

  /* ---------------- 토스트 ---------------- */
  function toast(title, desc, actionLabel, onAction) {
    var box = document.createElement("div");
    box.className = "toast";
    var body = document.createElement("div");
    body.className = "t-body";
    var t = document.createElement("div");
    t.textContent = title;
    body.appendChild(t);
    if (desc) {
      var d = document.createElement("div");
      d.className = "t-desc";
      d.textContent = desc;
      body.appendChild(d);
    }
    box.appendChild(body);

    if (actionLabel && onAction) {
      var a = document.createElement("button");
      a.type = "button";
      a.className = "t-act";
      a.textContent = actionLabel;
      a.addEventListener("click", function () {
        onAction();
        dismiss();
      });
      box.appendChild(a);
    }

    el.toastWrap.appendChild(box);
    var timer = setTimeout(dismiss, actionLabel ? 6000 : 3200);

    function dismiss() {
      clearTimeout(timer);
      if (!box.parentNode) return;
      box.classList.add("leaving");
      setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
      }, 200);
    }
  }

  /* ---------------- 테마 ---------------- */
  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      /* 무시 */
    }
  }

  /* ============================================================
     7. 날짜 넘어감 감시
     자정을 지나면 today 가 바뀌고, 그 날짜의 완료 목록은 비어 있으므로
     '완료 표시만 초기화'가 자동으로 이루어진다. 항목은 건드리지 않는다.
     ============================================================ */
  function checkRollover() {
    var t = todayKey();
    if (t === today) return;
    var wasToday = viewDate === today;
    today = t;
    data.lastSeenDate = t;
    if (wasToday) viewDate = t; // 오늘을 보고 있었다면 새 장으로 따라간다
    saveData();
    render();
  }

  /* ============================================================
     8. 초기화
     ============================================================ */
  function init() {
    // 테마
    var savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_KEY);
    } catch (e) {
      /* 무시 */
    }
    applyTheme(savedTheme === "dark" ? "dark" : "light");

    // 데이터
    data = loadData();
    today = todayKey();
    viewDate = today;
    data.lastSeenDate = today;
    el.seedCount.textContent = String(SEED_ITEMS.length);
    saveData();

    // 이벤트 바인딩
    el.themeToggle.addEventListener("click", function () {
      applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
    });

    el.prevDay.addEventListener("click", function () {
      viewDate = shiftKey(viewDate, -1);
      editingId = null;
      render();
    });

    el.nextDay.addEventListener("click", function () {
      if (viewDate >= today) return;
      viewDate = shiftKey(viewDate, 1);
      editingId = null;
      render();
    });

    el.todayBtn.addEventListener("click", function () {
      viewDate = today;
      editingId = null;
      render();
    });

    if (el.manualNoticeAdd && el.manualNoticeInput && el.manualNoticeList) {
      el.manualNoticeAdd.addEventListener("click", addManualNotice);
      el.manualNoticeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addManualNotice();
        }
      });
      el.manualNoticeList.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-manual-delete]");
        if (!btn) return;
        deleteManualNotice(btn.getAttribute("data-manual-delete"));
      });
    }

    el.addBtn.addEventListener("click", function () {
      var v = el.newItem.value;
      if (!v.trim()) {
        el.newItem.focus();
        return;
      }
      addItem(v);
      el.newItem.value = "";
      syncCommitBtn();
      el.newItem.focus();
    });

    el.newItem.addEventListener("input", syncCommitBtn);
    el.newItem.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        el.addBtn.click();
      }
    });

    [el.pendingList, el.doneList].forEach(function (c) {
      c.addEventListener("click", onListClick);
      c.addEventListener("keydown", onListKeydown);
      c.addEventListener("blur", onListBlur, true);
      bindDnd(c);
    });

    el.clearChecks.addEventListener("click", clearTodayChecks);

    el.resetAll.addEventListener("click", function () {
      el.overlay.hidden = false;
      el.dlgCancel.focus();
    });

    el.dlgCancel.addEventListener("click", function () {
      el.overlay.hidden = true;
    });

    el.dlgConfirm.addEventListener("click", function () {
      el.overlay.hidden = true;
      resetAll();
    });

    el.overlay.addEventListener("click", function (e) {
      if (e.target === el.overlay) el.overlay.hidden = true;
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !el.overlay.hidden) {
        el.overlay.hidden = true;
        return;
      }
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        el.newItem.focus();
      }
    });

    // 날짜 넘어감 감시
    setInterval(checkRollover, 30000);
    window.addEventListener("focus", checkRollover);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") checkRollover();
    });

    // 다른 탭에서 변경된 내용 동기화
    window.addEventListener("storage", function (e) {
      if (e.key === MANUAL_NOTICE_KEY) {
        renderManualNotices();
        return;
      }
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        data = normalize(JSON.parse(e.newValue));
        render();
      } catch (err) {
        /* 무시 */
      }
    });

    syncCommitBtn();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
