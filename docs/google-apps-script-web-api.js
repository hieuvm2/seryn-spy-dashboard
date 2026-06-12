/* ============================================================
   SERYN Spy Dashboard — Google Apps Script Web App API
   ------------------------------------------------------------
   1) ĐỌC 5 tab dashboard -> JSON (doGet không có ?type).
   2) ĐỌC/GHI 2 tab "Swipe File" & "Creative Briefs"
        - doGet  ?type=swipe_file        | ?type=creative_briefs
        - doPost {type, action, record|id} (create/update/upsert/delete)
   3) BẢO VỆ bằng API key (Script Property API_SECRET_KEY) — xem mục BẢO MẬT.

   CÁCH DÙNG:
   1. Mở Google Sheet chứa các tab (đúng tên ở SHEET_MAP / RECORD_TABS).
   2. Extensions → Apps Script. Xóa code mẫu, dán toàn bộ file này vào.
   3. (Khuyến nghị) Project Settings → Script properties → Add script property:
        Name:  API_SECRET_KEY
        Value: <chuỗi bí mật của bạn>
   4. Deploy → New deployment → Type: Web app
        - Execute as: Me
        - Who has access: Anyone   (URL vẫn cần ?key=... nếu đã đặt API_SECRET_KEY)
   5. Copy URL .../exec → đặt biến môi trường cho dashboard:
        VITE_GOOGLE_SHEETS_API_URL = <URL /exec>
        VITE_GOOGLE_SHEETS_API_KEY = <đúng API_SECRET_KEY>   (nếu đã bật key)

   ── BẢO MẬT (Task 3) ────────────────────────────────────────
   - Nếu Script Property API_SECRET_KEY ĐƯỢC ĐẶT: mọi request phải có
     ?key=<API_SECRET_KEY>. Sai/thiếu key -> {ok:false, error:"Unauthorized"}.
   - Nếu CHƯA đặt API_SECRET_KEY: API mở (tương thích ngược) — nên đặt key cho
     môi trường production.
   - KHÔNG hardcode secret trong file này; luôn lấy từ Script Properties.
   ============================================================ */

/* Tab dashboard (read-only) -> trả trong doGet mặc định.
   Tab chưa tồn tại -> sheetToObjects_ trả [] (không lỗi). */
const SHEET_MAP = {
  brandWeeklySnapshot: "Brand Weekly Snapshot",
  adLevelAnalysis: "Ad Level Analysis",
  scaledContentAnalysis: "Scaled Content Analysis",
  weeklyStrategyChange: "Weekly Strategy Change",
  serynContentRecommendations: "SERYN Content Recommendations",
  // ---- nâng cấp v2 ----
  visualAnalysis: "Visual Analysis",
  brandVisualSummary: "Brand Visual Summary",
  visualPatternAnalysis: "Visual Pattern Analysis",
  weeklyChangeInsights: "Weekly Change Insights",
  // ---- nâng cấp v3 (incremental cache / provenance) ----
  crawlRuns: "Crawl Runs",
  adAnalysisCache: "Ad Analysis Cache",
  patternCache: "Pattern Cache",
  historicalWeeklySnapshots: "Historical Weekly Snapshots",
};

/* Tab read/write (Swipe File, Creative Briefs, Competitors).
   `headers` PHẢI khớp serializer ở frontend. */
const RECORD_TABS = {
  competitors: {
    tab: "Competitors",
    headers: [
      "brand_name", "page_ids", "page_urls", "active", "notes",
      "category", "last_crawled_at", "last_status", "id",
    ],
    required: ["brand_name"],
  },
  swipe_file: {
    tab: "Swipe File",
    headers: [
      "id", "savedAt", "sourceType", "brand_name", "hook", "service_or_product",
      "content_format", "content_angle", "offer_detected", "proof_point", "scale_level",
      "reason_to_save", "action", "seryn_reframe", "notes", "tags",
    ],
    required: ["id", "hook"],
  },
  creative_briefs: {
    tab: "Creative Briefs",
    headers: [
      "id", "createdAt", "sourceType", "title", "brand_name", "objective", "market_signal",
      "competitor_evidence", "seryn_angle", "target_audience", "core_message", "hook_options",
      "content_format", "script_outline", "visual_direction", "proof_points", "cta", "kpi",
      "dos", "donts", "markdown",
    ],
    required: ["id", "title"],
  },
};

/* ---------- helpers ---------- */
function makeJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Kiểm tra API key. Trả null nếu hợp lệ; trả response Unauthorized nếu sai. */
function checkAuth_(e) {
  const secret = PropertiesService.getScriptProperties().getProperty("API_SECRET_KEY");
  if (!secret) return null; // chưa bật key -> mở (tương thích ngược)
  const provided = e && e.parameter ? e.parameter.key : "";
  if (provided === secret) return null;
  return makeJson_({ ok: false, error: "Unauthorized" });
}

/** Đọc 1 tab -> mảng object keyed theo header (giá trị hiển thị, string). */
function sheetToObjects_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h || "").trim());
  return values.slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => {
      const obj = {};
      headers.forEach((header, index) => { obj[header] = row[index] || ""; });
      return obj;
    });
}

/** Lấy (tạo nếu thiếu) sheet cho record-tab và bảo đảm có dòng header chuẩn. */
function ensureRecordSheet_(conf) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(conf.tab);
  if (!sheet) {
    sheet = ss.insertSheet(conf.tab);
    sheet.getRange(1, 1, 1, conf.headers.length).setValues([conf.headers]);
    return sheet;
  }
  const lastCol = Math.max(sheet.getLastColumn(), conf.headers.length);
  const firstRow = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const hasHeader = conf.headers.every((h, i) => String(firstRow[i] || "").trim() === h);
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, conf.headers.length).setValues([conf.headers]);
  }
  return sheet;
}

/** record (object) -> mảng theo đúng thứ tự header. */
function recordToRow_(conf, record) {
  return conf.headers.map((h) => {
    const v = record[h];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Tìm số dòng (1-based, gồm header) theo id; -1 nếu không thấy. */
function findRowById_(sheet, conf, id) {
  const idCol = conf.headers.indexOf("id") + 1; // 1-based
  if (idCol < 1) return -1;
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const ids = sheet.getRange(2, idCol, last - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return i + 2;
  }
  return -1;
}

/* ---------- doGet ---------- */
function doGet(e) {
  try {
    const unauthorized = checkAuth_(e);
    if (unauthorized) return unauthorized;

    const type = e && e.parameter ? String(e.parameter.type || "").trim() : "";

    // Đọc 1 trong 2 tab record (Swipe File / Creative Briefs).
    if (type && RECORD_TABS[type]) {
      const conf = RECORD_TABS[type];
      return makeJson_({ ok: true, type: type, data: sheetToObjects_(conf.tab) });
    }
    if (type) {
      return makeJson_({ ok: false, error: "Unknown type: " + type });
    }

    // Mặc định: 5 bảng dashboard + tab v2 (tab thiếu -> []).
    const data = {
      brandWeeklySnapshot: sheetToObjects_(SHEET_MAP.brandWeeklySnapshot),
      adLevelAnalysis: sheetToObjects_(SHEET_MAP.adLevelAnalysis),
      scaledContentAnalysis: sheetToObjects_(SHEET_MAP.scaledContentAnalysis),
      weeklyStrategyChange: sheetToObjects_(SHEET_MAP.weeklyStrategyChange),
      serynContentRecommendations: sheetToObjects_(SHEET_MAP.serynContentRecommendations),
      visualAnalysis: sheetToObjects_(SHEET_MAP.visualAnalysis),
      brandVisualSummary: sheetToObjects_(SHEET_MAP.brandVisualSummary),
      visualPatternAnalysis: sheetToObjects_(SHEET_MAP.visualPatternAnalysis),
      weeklyChangeInsights: sheetToObjects_(SHEET_MAP.weeklyChangeInsights),
      crawlRuns: sheetToObjects_(SHEET_MAP.crawlRuns),
      meta: { source: "GOOGLE_SHEETS", generatedAt: new Date().toISOString() },
    };
    return makeJson_({ ok: true, data: data });
  } catch (err) {
    return makeJson_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ---------- doPost (create/update/upsert/delete) ---------- */
function doPost(e) {
  try {
    const unauthorized = checkAuth_(e);
    if (unauthorized) return unauthorized;

    let body = {};
    try {
      body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    } catch (parseErr) {
      return makeJson_({ ok: false, error: "Body không phải JSON hợp lệ." });
    }

    const type = String(body.type || "").trim();
    const conf = RECORD_TABS[type];
    if (!conf) return makeJson_({ ok: false, error: "Unknown type: " + type });

    const action = String(body.action || "upsert").trim().toLowerCase();
    const sheet = ensureRecordSheet_(conf);

    if (action === "delete") {
      const id = String(body.id || (body.record && body.record.id) || "").trim();
      if (!id) return makeJson_({ ok: false, error: "Thiếu id để xóa." });
      const rowNum = findRowById_(sheet, conf, id);
      if (rowNum > 0) sheet.deleteRow(rowNum);
      return makeJson_({ ok: true, type: type, action: "delete", id: id, deleted: rowNum > 0 });
    }

    // create / update / upsert -> đều cần record hợp lệ.
    const record = body.record || {};
    for (let i = 0; i < conf.required.length; i++) {
      const f = conf.required[i];
      if (!String(record[f] || "").trim()) {
        return makeJson_({ ok: false, error: "Thiếu trường bắt buộc: " + f });
      }
    }

    const id = String(record.id).trim();
    const existingRow = findRowById_(sheet, conf, id);
    const row = recordToRow_(conf, record);

    if (existingRow > 0) {
      // update / upsert: ghi đè đúng dòng (tránh trùng record).
      sheet.getRange(existingRow, 1, 1, conf.headers.length).setValues([row]);
      return makeJson_({ ok: true, type: type, action: "update", id: id });
    }

    // create / upsert mới: thêm dòng cuối.
    sheet.appendRow(row);
    return makeJson_({ ok: true, type: type, action: "create", id: id });
  } catch (err) {
    return makeJson_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
