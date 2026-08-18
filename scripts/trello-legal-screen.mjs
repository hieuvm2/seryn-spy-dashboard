/* ============================================================
   SERYN — Rà soát pháp lý content trên Trello TRƯỚC KHI ĐĂNG
   ------------------------------------------------------------
   Kéo card từ board Trello -> gom toàn bộ chữ (tên card + mô tả + checklist
   + bình luận) -> chạy bộ sàng lọc legalScreen -> in báo cáo + xuất JSON.

   Chạy:
     npm run legal:trello                      # board mặc định (TRELLO_BOARD_ID)
     node scripts/trello-legal-screen.mjs <boardId>
     node scripts/trello-legal-screen.mjs <boardId> --list "Chờ duyệt"
     node scripts/trello-legal-screen.mjs --card <shortLink|url>
     ... --json <đường dẫn>                    # xuất kết quả ra file

   CHỈ ĐỌC Trello. Không ghi/sửa/xóa card.
   Đây là SÀNG LỌC cho Marketing — KHÔNG thay ý kiến Phòng Pháp chế (Mục 8).
   ============================================================ */
import "dotenv/config";
import fs from "node:fs";
import {
  trelloConfigured, boardLists, boardCards, cardByShortLink, cardComments, shortLinkFromUrl,
} from "./lib/trello.mjs";
import { screenText, SO_QUY_TAC } from "./lib/legalScreen.mjs";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const boardArg = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--list"
  && args[args.indexOf(a) - 1] !== "--json" && args[args.indexOf(a) - 1] !== "--card");
// PHẠM VI MẶC ĐỊNH: chỉ 2 cột đã duyệt. Ghi đè bằng --list (nhiều cột thì phân tách
// bằng dấu phẩy), hoặc --all-lists để quét toàn board.
const COT_MAC_DINH = ["ĐÃ DUYỆT - HN", "ĐÃ DUYỆT - HCM"];
const listFilter = flag("--list");
const quetHet = args.includes("--all-lists");
const jsonOut = flag("--json");
const cardArg = flag("--card");
// Quét rộng: bỏ bình luận để không chạm giới hạn tần suất Trello (100 req/10s/token).
const boComment = args.includes("--no-comments");

if (!trelloConfigured()) {
  console.log("\n[CHƯA CẤU HÌNH] Thiếu TRELLO_API_KEY / TRELLO_TOKEN trong .env" +
    "\n  → Chạy `npm run trello:check` để xem hướng dẫn lấy key/token.\n");
  process.exit(0);
}

/** Gom MỌI chữ của 1 card thành 1 khối để sàng lọc. */
function textCuaCard(card, comments = []) {
  const phan = [card.name || "", card.desc || ""];
  for (const cl of card.checklists || []) {
    for (const it of cl.checkItems || []) phan.push(it.name || "");
  }
  for (const c of comments) phan.push(String(c?.data?.text || ""));
  return phan.filter(Boolean).join("\n");
}

function inKetQua(card, kq) {
  const bieuTuong = kq.tongRuiRo === "Cao" ? "🔴" : kq.tongRuiRo === "Trung bình" ? "🟡" : "🟢";
  console.log(`\n${bieuTuong} [${kq.tongRuiRo}] ${card.name}`);
  console.log(`   ${card.shortUrl || card.url || ""}`);
  if (kq.laKBCB) console.log("   → Nội dung có dấu hiệu KHÁM BỆNH, CHỮA BỆNH ⇒ áp quy tắc Mục 4.1 (chặt hơn).");
  for (const l of kq.loi) {
    console.log(`   • [${l.muc}] ${l.nhom}`);
    console.log(`     khớp "${l.cum_khop}" — căn cứ: ${l.canCu}`);
    console.log(`     trích: …${l.trich_dan}…`);
    console.log(`     sửa:   ${l.cach_sua}`);
  }
  for (const t of kq.thieu) {
    console.log(`   • [${t.muc}] THIẾU: ${t.thieu_gi}`);
    console.log(`     căn cứ: ${t.canCu}`);
    console.log(`     sửa:   ${t.cach_sua}`);
  }
  if (!kq.loi.length && !kq.thieu.length) console.log("   Không phát hiện vấn đề theo bộ quy tắc hiện có.");
}

async function main() {
  console.log(`\nSERYN — Rà soát pháp lý content Trello`);
  console.log(`Bộ quy tắc: ${SO_QUY_TAC.tien_le} tiền lệ Pháp chế + ${SO_QUY_TAC.huong_dan} nhóm quy tắc hướng dẫn v2.0`);

  const ketQua = [];

  if (cardArg) {
    const sl = shortLinkFromUrl(cardArg) || cardArg;
    const card = await cardByShortLink(sl);
    const cm = await cardComments(card.id).catch(() => []);
    const kq = screenText(textCuaCard(card, cm));
    inKetQua(card, kq);
    ketQua.push({ card: { id: card.id, name: card.name, url: card.shortUrl }, ...kq });
  } else {
    const boardId = boardArg || String(process.env.TRELLO_BOARD_ID || "").trim();
    if (!boardId) {
      console.error("\n[X] Chưa có board. Truyền <boardId> hoặc đặt TRELLO_BOARD_ID trong .env." +
        "\n    Xem danh sách board:  npm run trello:check\n");
      process.exit(1);
    }
    const [lists, cards] = await Promise.all([boardLists(boardId), boardCards(boardId)]);
    const tenList = new Map(lists.map((l) => [l.id, l.name]));
    let dsCard = cards.filter((c) => !c.closed);
    const canQuet = quetHet ? null
      : (listFilter ? listFilter.split(",").map((x) => x.trim()).filter(Boolean) : COT_MAC_DINH);
    if (canQuet) {
      const khop = lists.filter((l) => canQuet.some((f) => l.name.toLowerCase().includes(f.toLowerCase()))).map((l) => l.id);
      if (!khop.length) {
        console.error(`\n[X] Không thấy cột nào khớp "${canQuet.join(", ")}". Các cột có: ${lists.map((l) => l.name).join(" | ")}\n`);
        process.exit(1);
      }
      dsCard = dsCard.filter((c) => khop.includes(c.idList));
    }
    console.log(`Board ${boardId} — rà ${dsCard.length} card · phạm vi: ${canQuet ? canQuet.join(" + ") : "TOÀN BOARD"}${boComment ? " · bỏ qua bình luận" : ""}\n`);

    for (const card of dsCard) {
      // Bình luận hay chứa ý kiến duyệt -> tính vào text để không bỏ sót.
      const cm = boComment ? [] : await cardComments(card.id).catch(() => []);
      const kq = screenText(textCuaCard(card, cm));
      ketQua.push({
        card: { id: card.id, name: card.name, url: card.shortUrl, cot: tenList.get(card.idList) || "" },
        ...kq,
      });
    }
    // In theo mức rủi ro giảm dần: đội Marketing xử cái nặng trước.
    const thuTu = { "Cao": 0, "Trung bình": 1, "Thấp": 2 };
    ketQua.sort((a, b) => thuTu[a.tongRuiRo] - thuTu[b.tongRuiRo]);
    for (const r of ketQua) inKetQua(r.card, r);
  }

  const dem = (m) => ketQua.filter((r) => r.tongRuiRo === m).length;
  console.log(`\n${"—".repeat(60)}`);
  console.log(`TỔNG: ${ketQua.length} card — 🔴 Cao ${dem("Cao")} · 🟡 Trung bình ${dem("Trung bình")} · 🟢 Thấp ${dem("Thấp")}`);
  console.log(`LƯU Ý: đây là bản sàng lọc tự động theo câu chữ. Card mức Cao phải chuyển Pháp chế/Chuyên môn`);
  console.log(`xem trước khi đăng (Mục 8 hướng dẫn). Bản sàng lọc KHÔNG thay ý kiến Phòng Pháp chế.`);

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(ketQua, null, 1), "utf8");
    console.log(`\n[JSON] ${jsonOut}`);
  }

  // Đẩy lên Supabase cho dashboard đọc (tab SERYN). Dataset key: trelloLegalScreen.
  if (args.includes("--push")) {
    const { pushDatasets, supabaseConfigured } = await import("./lib/supabase.mjs");
    if (!supabaseConfigured()) { console.log("[Supabase] SKIP — chưa cấu hình SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); return; }
    const quetLuc = new Date().toISOString();
    const rows = ketQua.map((r) => ({
      card_id: r.card.id, card_name: r.card.name, card_url: r.card.url || "", cot: r.card.cot || "",
      tong_rui_ro: r.tongRuiRo, la_kbcb: !!r.laKBCB, co_khuyen_mai: !!r.coKhuyenMai,
      so_loi: r.loi.length, so_thieu: r.thieu.length,
      loi: r.loi, thieu: r.thieu, quet_luc: quetLuc,
    }));
    const res = await pushDatasets({ trelloLegalScreen: rows }, quetLuc.slice(0, 10));
    console.log(`[Supabase] trelloLegalScreen: ${res.fail ? "lỗi " + res.errors.join(" | ") : `đã đẩy ${rows.length} card`}`);
  }
}

main().catch((e) => { console.error("\n[X] " + (e?.message || e)); process.exit(1); });
