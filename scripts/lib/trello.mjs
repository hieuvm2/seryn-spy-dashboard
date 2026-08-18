/* ============================================================
   SERYN — Trello REST API client (server-side)
   ------------------------------------------------------------
   Dùng để kéo content (card) từ board Trello về cho pipeline rà soát
   pháp lý / theo dõi duyệt content.

   .env cần:
     TRELLO_API_KEY=<API key>      (lấy ở https://trello.com/power-ups/admin)
     TRELLO_TOKEN=<token>          (bấm "Token" ở trang trên, tự cấp cho chính mình)
     TRELLO_BOARD_ID=<id board>    (tùy chọn — mặc định cho các script)

   CHỈ ĐỌC: mọi hàm ở đây đều là GET. Không có hàm nào ghi/sửa/xóa Trello,
   để không rủi ro đụng vào bảng làm việc thật của team.
   ============================================================ */

const BASE = "https://api.trello.com/1";

export function trelloConfigured() {
  return !!String(process.env.TRELLO_API_KEY || "").trim() && !!String(process.env.TRELLO_TOKEN || "").trim();
}

function auth() {
  const key = String(process.env.TRELLO_API_KEY || "").trim();
  const token = String(process.env.TRELLO_TOKEN || "").trim();
  if (!key || !token) {
    throw new Error(
      "Thiếu TRELLO_API_KEY / TRELLO_TOKEN trong .env.\n" +
      "  → Vào https://trello.com/power-ups/admin tạo Power-Up, lấy API key,\n" +
      "    rồi bấm link 'Token' ngay dưới ô key để tự cấp token cho chính mình."
    );
  }
  return { key, token };
}

/** GET 1 endpoint Trello. Trả JSON. Lỗi -> throw kèm thông điệp đọc được. */
export async function trelloGet(path, params = {}) {
  const { key, token } = auth();
  const u = new URL(BASE + path);
  u.searchParams.set("key", key);
  u.searchParams.set("token", token);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const body = await res.text();
  if (!res.ok) {
    const hint = res.status === 401 ? " (key/token sai hoặc token hết hạn)"
      : res.status === 404 ? " (không thấy — sai id, hoặc token không có quyền xem board này)"
      : res.status === 429 ? " (bị giới hạn tần suất, thử lại sau)" : "";
    throw new Error(`Trello ${res.status}${hint}: ${body.slice(0, 200)}`);
  }
  try { return JSON.parse(body); } catch { return body; }
}

/** Thông tin tài khoản đang dùng token — dùng để kiểm kết nối. */
export const me = () => trelloGet("/members/me", { fields: "id,username,fullName,email" });

/** Danh sách board mà token nhìn thấy. */
export const myBoards = () => trelloGet("/members/me/boards", { fields: "id,name,url,closed", filter: "open" });

/** Các list (cột) của 1 board. */
export const boardLists = (boardId) => trelloGet(`/boards/${boardId}/lists`, { fields: "id,name,pos", cards: "none" });

/** Toàn bộ card của board, kèm mô tả / nhãn / hạn / thành viên / file đính kèm. */
export const boardCards = (boardId) => trelloGet(`/boards/${boardId}/cards`, {
  fields: "id,name,desc,shortLink,shortUrl,url,idList,idMembers,labels,due,dateLastActivity,closed",
  attachments: "true", attachment_fields: "name,url,mimeType,bytes",
  customFieldItems: "true",
});

/** 1 card theo shortLink (mã trong URL trello.com/c/<shortLink>). */
export const cardByShortLink = (shortLink) => trelloGet(`/cards/${shortLink}`, {
  fields: "id,name,desc,shortLink,shortUrl,url,idList,idBoard,labels,due,dateLastActivity,closed",
  attachments: "true", attachment_fields: "name,url,mimeType,bytes",
  checklists: "all", customFieldItems: "true",
});

/** Bình luận trên card (nơi team hay ghi ý kiến duyệt). */
export const cardComments = (cardId) => trelloGet(`/cards/${cardId}/actions`, {
  filter: "commentCard", limit: 50,
});

/** Định nghĩa custom field của board (để map id -> tên trường). */
export const boardCustomFields = (boardId) => trelloGet(`/boards/${boardId}/customFields`);

/** Lấy shortLink từ URL Trello bất kỳ. Không phải URL card -> "". */
export function shortLinkFromUrl(url) {
  const m = String(url || "").match(/trello\.com\/c\/([A-Za-z0-9]+)/);
  return m ? m[1] : "";
}
