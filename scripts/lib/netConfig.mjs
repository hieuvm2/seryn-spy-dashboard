/* ============================================================
   SERYN Spy — Network tuning (side-effect import, chạy 1 lần khi load)
   ------------------------------------------------------------
   FIX lỗi "Invalid response body ... oauth2 token: Premature close" gặp
   DAI DẲNG trên GitHub Actions (Node 20+/22+):

   Runner GitHub thường có IPv6 nửa-mở. Node bật Happy Eyeballs
   (autoSelectFamily=true) đua IPv4/IPv6; nhánh IPv6 tới googleapis bị đứt ->
   socket bị đóng giữa chừng -> node-fetch (gaxios/gtoken dùng) ném
   ERR_STREAM_PREMATURE_CLOSE ngay ở bước lấy OAuth token. Retry vô ích.

   3 lớp ép IPv4 (mạnh dần), áp cho MỌI kết nối http(s) trong tiến trình:
     1) dns.setDefaultResultOrder("ipv4first")     — DNS trả IPv4 trước
     2) net.setDefaultAutoSelectFamily(false)      — tắt đua IPv4/IPv6
     3) http(s).globalAgent = Agent({ family: 4 }) — CHỈ IPv4, không thử IPv6
   (node-fetch dùng globalAgent khi request không set agent -> lớp 3 ăn chắc.)

   An toàn cho local (các API đều có IPv4). Tắt qua env SERYN_NET_TUNING=off.
   ============================================================ */
import net from "node:net";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";

if (String(process.env.SERYN_NET_TUNING || "").trim().toLowerCase() !== "off") {
  try { dns.setDefaultResultOrder?.("ipv4first"); } catch { /* node cũ */ }
  try { net.setDefaultAutoSelectFamily?.(false); } catch { /* node cũ */ }
  try {
    const opts = { keepAlive: false, family: 4 }; // family:4 => chỉ IPv4
    http.globalAgent = new http.Agent(opts);
    https.globalAgent = new https.Agent(opts);
  } catch { /* ignore */ }
  let asf = "n/a";
  try { asf = String(net.getDefaultAutoSelectFamily?.()); } catch { /* ignore */ }
  console.log(`[netConfig] net tuning applied: dns=ipv4first, autoSelectFamily=${asf}, forcedFamily=4`);
}

/**
 * In chẩn đoán khi lỗi mở Google Sheet / lấy token (gọi trong catch trước khi
 * fail). Cho biết NGAY nguyên nhân thật nếu IPv4-first vẫn chưa đủ: node
 * version, NODE_OPTIONS, family hiện tại, error code/cause, và DNS A/AAAA.
 */
export async function logAuthDiag(e) {
  try {
    console.error("[diag] node:", process.version, "| NODE_OPTIONS:", process.env.NODE_OPTIONS || "(none)");
    console.error("[diag] autoSelectFamily:", net.getDefaultAutoSelectFamily?.(),
      "| https.globalAgent.family:", https.globalAgent?.options?.family ?? "(default)");
    console.error("[diag] error:", e?.message, "| code:", e?.code, "| errno:", e?.errno,
      "| cause:", e?.cause?.message || e?.cause?.code || "");
    for (const host of ["oauth2.googleapis.com", "www.googleapis.com"]) {
      const a4 = await dns.promises.resolve4(host).catch(() => []);
      const a6 = await dns.promises.resolve6(host).catch(() => []);
      console.error(`[diag] DNS ${host}: A=${a4.slice(0, 2).join(",") || "-"} | AAAA=${a6.slice(0, 2).join(",") || "-"}`);
    }
  } catch { /* chẩn đoán không được cũng không sao */ }
}
