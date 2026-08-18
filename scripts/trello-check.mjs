/* Kiểm kết nối Trello + liệt kê board nhìn thấy được.
   Chạy: node scripts/trello-check.mjs                 (kiểm kết nối + list board)
         node scripts/trello-check.mjs <boardId>       (xem cột + đếm card của 1 board)
         node scripts/trello-check.mjs --card <shortLink>  (xem chi tiết 1 card) */
import "dotenv/config";
import { trelloConfigured, me, myBoards, boardLists, boardCards, cardByShortLink, cardComments, shortLinkFromUrl } from "./lib/trello.mjs";

const args = process.argv.slice(2);

if (!trelloConfigured()) {
  console.log(`
[CHƯA CẤU HÌNH] Thiếu TRELLO_API_KEY / TRELLO_TOKEN trong .env

Bạn tự lấy (mình không đăng nhập tài khoản của bạn được):
  1. Mở  https://trello.com/power-ups/admin
  2. "New" -> tạo 1 Power-Up bất kỳ (tên gì cũng được, vd "SERYN Content Sync")
  3. Vào tab "API key" -> copy dòng "API key"
  4. Ngay cạnh đó có chữ "Token" -> bấm -> "Allow" -> copy chuỗi token
  5. Thêm vào file .env:
       TRELLO_API_KEY=<api key vừa copy>
       TRELLO_TOKEN=<token vừa copy>

Lưu ý: token này cho quyền theo đúng tài khoản bạn — chỉ thấy board bạn có quyền xem.
Client mình viết CHỈ ĐỌC (GET), không ghi/sửa/xóa gì trên Trello.
`);
  process.exit(0);
}

try {
  if (args[0] === "--card") {
    const sl = shortLinkFromUrl(args[1]) || args[1];
    const c = await cardByShortLink(sl);
    console.log(`\nCard: ${c.name}\n  list: ${c.idList} | due: ${c.due || "—"} | đóng: ${c.closed}`);
    console.log(`  nhãn: ${(c.labels || []).map((l) => l.name || l.color).join(", ") || "—"}`);
    console.log(`  mô tả (${(c.desc || "").length} ký tự):\n${(c.desc || "(trống)").slice(0, 800)}`);
    const att = c.attachments || [];
    console.log(`\n  đính kèm (${att.length}):`);
    for (const a of att.slice(0, 10)) console.log(`    - ${a.name} -> ${a.url}`);
    const cm = await cardComments(c.id);
    console.log(`\n  bình luận (${cm.length}):`);
    for (const x of cm.slice(0, 5)) console.log(`    - ${x.memberCreator?.fullName}: ${String(x.data?.text || "").replace(/\s+/g, " ").slice(0, 160)}`);
    process.exit(0);
  }

  const u = await me();
  console.log(`\n[OK] Kết nối Trello thành công — ${u.fullName} (@${u.username})`);

  if (args[0]) {
    const id = args[0];
    const lists = await boardLists(id);
    const cards = await boardCards(id);
    console.log(`\nBoard ${id}: ${lists.length} cột · ${cards.length} card`);
    const byList = {};
    for (const c of cards) byList[c.idList] = (byList[c.idList] || 0) + 1;
    for (const l of lists) console.log(`  ${String(byList[l.id] || 0).padStart(4)} card  ${l.name}`);
    const withDesc = cards.filter((c) => (c.desc || "").trim()).length;
    const withAtt = cards.filter((c) => (c.attachments || []).length).length;
    console.log(`\n  card có mô tả: ${withDesc} · có file đính kèm: ${withAtt}`);
    process.exit(0);
  }

  const bs = await myBoards();
  console.log(`\nBoard bạn có quyền xem (${bs.length}):`);
  for (const b of bs) console.log(`  ${b.id}  ${b.name}`);
  console.log(`\n→ Xem chi tiết 1 board:  node scripts/trello-check.mjs <boardId>`);
} catch (e) {
  console.error("\n[X] " + (e?.message || e));
  process.exit(1);
}
