/* ============================================================
   SERYN Spy — Network tuning (side-effect import, chạy 1 lần khi load)
   ------------------------------------------------------------
   FIX lỗi "Invalid response body ... oauth2/v4/token: Premature close" gặp
   DAI DẲNG trên GitHub Actions (Node 20+/22+):

   - Node bật mặc định Happy Eyeballs (`autoSelectFamily=true`): đua kết nối
     IPv4/IPv6 song song. Trên runner dual-stack mà IPv6 tới googleapis.com bị
     chặn/đứt, socket nửa-mở bị server đóng giữa chừng -> node-fetch ném
     ERR_STREAM_PREMATURE_CLOSE ngay ở bước lấy OAuth token. Retry vô ích vì
     lỗi lặp lại mỗi lần.
   - Khắc phục triệt để: ép DNS IPv4-first + tắt autoSelectFamily (đi thẳng IPv4).

   Đặt ở tầng global trước mọi kết nối -> áp dụng cho googleapis (node-fetch),
   Supabase REST, mọi fetch khác. An toàn cho local (vẫn có IPv4).
   Cho phép override qua env nếu cần: SERYN_NET_TUNING=off.
   ============================================================ */
import net from "node:net";
import dns from "node:dns";

if (String(process.env.SERYN_NET_TUNING || "").trim().toLowerCase() !== "off") {
  try { dns.setDefaultResultOrder?.("ipv4first"); } catch { /* node cũ -> bỏ qua */ }
  try { net.setDefaultAutoSelectFamily?.(false); } catch { /* node cũ -> bỏ qua */ }
}
