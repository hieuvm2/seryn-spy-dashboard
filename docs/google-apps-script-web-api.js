/* ============================================================
   SERYN Spy Dashboard — Google Apps Script Web App API
   ------------------------------------------------------------
   Mục đích: đọc 5 tab trong Google Sheets và trả JSON cho dashboard
   Vercel (chế độ ONLINE SHEET DATA).

   CÁCH DÙNG:
   1. Mở Google Sheet chứa 5 tab (đúng tên ở SHEET_MAP bên dưới).
   2. Extensions → Apps Script.
   3. Xóa code mẫu, dán toàn bộ file này vào.
   4. Deploy → New deployment → Type: Web app
        - Execute as: Me
        - Who has access: Anyone
   5. Copy URL dạng .../exec → đặt vào biến môi trường Vercel:
        VITE_GOOGLE_SHEETS_API_URL = <URL /exec>

   BẢO MẬT: Web App này chỉ ĐỌC dữ liệu để hiển thị dashboard.
   Không đưa thông tin nhạy cảm vào Sheet nếu để "Anyone".
   ============================================================ */

const SHEET_MAP = {
  brandWeeklySnapshot: "Brand Weekly Snapshot",
  adLevelAnalysis: "Ad Level Analysis",
  scaledContentAnalysis: "Scaled Content Analysis",
  weeklyStrategyChange: "Weekly Strategy Change",
  serynContentRecommendations: "SERYN Content Recommendations",
};

function sheetToObjects_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getDisplayValues();

  if (!values || values.length < 2) {
    return [];
  }

  const headers = values[0].map(h => String(h || "").trim());

  return values.slice(1)
    .filter(row => row.some(cell => String(cell || "").trim() !== ""))
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });
}

function makeJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const data = {
      brandWeeklySnapshot: sheetToObjects_(SHEET_MAP.brandWeeklySnapshot),
      adLevelAnalysis: sheetToObjects_(SHEET_MAP.adLevelAnalysis),
      scaledContentAnalysis: sheetToObjects_(SHEET_MAP.scaledContentAnalysis),
      weeklyStrategyChange: sheetToObjects_(SHEET_MAP.weeklyStrategyChange),
      serynContentRecommendations: sheetToObjects_(SHEET_MAP.serynContentRecommendations),
      meta: {
        source: "GOOGLE_SHEETS",
        generatedAt: new Date().toISOString(),
      },
    };

    return makeJson_({
      ok: true,
      data,
    });
  } catch (err) {
    return makeJson_({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}
