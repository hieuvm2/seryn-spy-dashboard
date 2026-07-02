/* ============================================================
   SERYN Spy — Report date helpers (timezone-aware)
   ------------------------------------------------------------
   Dùng chung cho generate-weekly-report.mjs + generate-monthly-report.mjs.

   NGUYÊN TẮC:
   - Tuần tính từ thứ Hai → Chủ Nhật.
   - "Last day of month" KHÔNG hardcode ngày 31 — kiểm tra ngày mai có sang
     tháng mới không.
   - Timezone mặc định Asia/Ho_Chi_Minh. Mọi phép tính lịch quy về calendar
     date (UTC midnight) để không lệ thuộc timezone của máy chạy (GitHub Actions
     chạy UTC).
   ============================================================ */

export const DEFAULT_TZ = "Asia/Ho_Chi_Minh";

const pad2 = (n) => String(n).padStart(2, "0");

/** Lấy {y,m,d} (calendar date) của `date` theo timezone `tz`. m là 1-based. */
function zonedYMD(date, tz) {
  // en-CA -> "YYYY-MM-DD" ổn định, không phụ thuộc locale máy.
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

/** Calendar date -> Date ở UTC midnight (chỉ để làm số học ngày, không quan tâm giờ). */
function ymdToUTC(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d));
}

/** Đọc lại "YYYY-MM-DD" từ Date (theo UTC, vì ta luôn dựng ở UTC midnight). */
function fmtUTC(dt) {
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function addDays(dt, n) {
  const x = new Date(dt.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * Khoảng TUẦN TRƯỚC (thứ Hai → Chủ Nhật) so với hôm nay (theo timezone).
 * - Tìm thứ Hai của tuần hiện tại, lùi 7 ngày = thứ Hai tuần trước.
 * - period_end = Chủ Nhật ngay trước thứ Hai tuần này.
 * - Nếu hôm nay là thứ Hai: vẫn trả thứ Hai tuần trước → Chủ Nhật vừa rồi.
 * @returns {{ period_start: string, period_end: string }}
 */
export function getLastWeekRange(timezone = DEFAULT_TZ, today = new Date()) {
  const { y, m, d } = zonedYMD(today, timezone);
  const cur = ymdToUTC(y, m, d);
  const isoDow = (cur.getUTCDay() + 6) % 7; // 0 = thứ Hai ... 6 = Chủ Nhật
  const thisMonday = addDays(cur, -isoDow);
  const lastMonday = addDays(thisMonday, -7);
  const lastSunday = addDays(thisMonday, -1);
  return { period_start: fmtUTC(lastMonday), period_end: fmtUTC(lastSunday) };
}

/**
 * Khoảng tuần (thứ Hai → Chủ Nhật) CHỨA ngày `date`.
 * Dùng khi truyền --period-start tùy ý để chuẩn hóa về biên tuần nếu cần.
 */
export function getWeekRangeContaining(dateISO, timezone = DEFAULT_TZ) {
  const [y, m, d] = String(dateISO).slice(0, 10).split("-").map(Number);
  const cur = ymdToUTC(y, m, d);
  const isoDow = (cur.getUTCDay() + 6) % 7;
  const monday = addDays(cur, -isoDow);
  const sunday = addDays(monday, 6);
  return { period_start: fmtUTC(monday), period_end: fmtUTC(sunday) };
}

/** Khoảng 1 tháng theo (year, month 1-based). period_end = ngày cuối tháng. */
export function getMonthRange(year, month, timezone = DEFAULT_TZ) {
  const first = ymdToUTC(year, month, 1);
  // Date.UTC(year, month, 0) -> ngày 0 của tháng KẾ = ngày cuối tháng hiện tại.
  const last = new Date(Date.UTC(year, month, 0));
  return {
    period_start: fmtUTC(first),
    period_end: fmtUTC(last),
    month: `${year}-${pad2(month)}`,
  };
}

/** Khoảng tháng HIỆN TẠI (chứa hôm nay theo timezone). */
export function getCurrentMonthRange(timezone = DEFAULT_TZ, today = new Date()) {
  const { y, m } = zonedYMD(today, timezone);
  return getMonthRange(y, m, timezone);
}

/** Parse "YYYY-MM" -> getMonthRange. Lỗi format -> null. */
export function getMonthRangeFromString(monthStr, timezone = DEFAULT_TZ) {
  const mt = /^(\d{4})-(\d{2})$/.exec(String(monthStr || "").trim());
  if (!mt) return null;
  const y = Number(mt[1]), m = Number(mt[2]);
  if (m < 1 || m > 12) return null;
  return getMonthRange(y, m, timezone);
}

/**
 * Hôm nay (theo timezone) có phải NGÀY CUỐI THÁNG không.
 * KHÔNG check bằng ngày 31 — tính ngày mai có sang tháng khác không.
 */
export function isLastDayOfMonth(date = new Date(), timezone = DEFAULT_TZ) {
  const { y, m, d } = zonedYMD(date, timezone);
  const tomorrow = addDays(ymdToUTC(y, m, d), 1);
  // Sang tháng mới (hoặc sang năm mới) -> hôm nay là ngày cuối tháng.
  return tomorrow.getUTCMonth() !== (m - 1) || tomorrow.getUTCFullYear() !== y;
}

/**
 * report_id ổn định theo kỳ (để upsert đúng kỳ, không tạo trùng).
 *   weekly  -> weekly-<period_start>_<period_end>
 *   monthly -> monthly-<YYYY-MM>
 */
export function getReportId(type, periodStart, periodEnd) {
  if (type === "monthly") return `monthly-${String(periodStart).slice(0, 7)}`;
  return `weekly-${periodStart}_${periodEnd}`;
}
