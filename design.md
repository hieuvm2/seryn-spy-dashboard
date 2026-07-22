# Design — SERYN Insights (Spy Ads Dashboard)

Hệ thống thiết kế KHÓA cho app. Mọi trang đọc file này trước khi sửa giao diện.
Không tự tạo theme mới cho từng trang — mở rộng/sửa file này khi hệ thống cần lớn hơn.
Redesign bằng skill **hallmark** (genre: modern-minimal), giữ nguyên brand seryn.vn.

Stamp: `/* Hallmark · genre: modern-minimal · design-system: design.md · designed-as-app */`

## Genre
modern-minimal (công cụ phân tích nội bộ — Stripe/Linear school).

## Macrostructure family
- App pages (mọi tab xem): **Workbench** — mỗi trang mở bằng 1 page-header (tiêu đề + 1 câu ý định),
  nội dung xếp thành các **panel** viền mảnh; KPI là 1 **hàng số liệu** (stat row) chứ không phải lưới card icon.
- Content/report pages: Workbench + tuyến đọc dọc (bảng, danh sách quan sát).
- KHÔNG dùng hero/marketing enrichment — đây là app, chức năng gánh trang.

## Theme (LOCKED — brand seryn.vn, không đổi)
Giữ thang token hex hiện có trong `src/index.css @theme` (Tailwind v4). OKLCH tương đương ghi kèm để tham chiếu.
- `--color-paper`    #F5F0E8  ~ oklch(95% 0.012 85)   · nền app ấm
- `--color-paper-2`  #FAF6EF  ~ oklch(97% 0.010 85)   · nền panel phụ (slate-50)
- `--color-surface`  #FFFFFF                          · mặt panel
- `--color-ink`      #1B234C  ~ oklch(26% 0.07 268)   · NAVY — tiêu đề (slate-900)
- `--color-ink-2`    #57483A  ~ oklch(40% 0.02 60)    · chữ body nâu ấm (slate-700)
- `--color-muted`    #83725E  ~ oklch(54% 0.02 65)    · chữ phụ (slate-500)
- `--color-rule`     #E7DDD0  ~ oklch(89% 0.012 75)   · đường kẻ mảnh / viền (slate-200)
- `--color-accent`   #F47E6A  ~ oklch(72% 0.15 33)    · PEACH — dùng ≤5% mỗi màn
- `--color-accent-strong` #E85F4B                     · peach đậm (nút/hover)
- `--color-pos`      emerald-600 · tăng   · `--color-neg` rose-600 · giảm
- `--color-focus`    #F47E6A                          · ring focus

Kỷ luật màu: peach CHỈ cho điểm nhấn (accent trái section, số tăng/giảm, trạng thái active, 1 CTA).
Navy cho tiêu đề + xương sống. Không tô peach tràn lan.

## Typography
- Display + Body: **Be Vietnam Pro** (giống seryn.vn). Wordmark "SERYN": Playfair Display.
- Tiêu đề trang: 700–800, siết chữ (tracking -0.01em). Tiêu đề panel: 700.
- Body: 400–500. Nhãn nhỏ (eyebrow): 600–700, uppercase, tracking rộng, dùng TIẾT CHẾ (≤1/panel).
- **Mọi con số dùng `tabular-nums`** (KPI, bảng, %). Không dùng italic cho tiêu đề.

## Spacing
Thang 4pt, tên ngữ nghĩa `--space-*`. Panel padding chuẩn; nhịp section rộng rãi, nhất quán.

## Motion (tiết chế — thư viện `motion` đã có)
- Easing chuẩn `--ease-out: cubic-bezier(0.16,1,0.3,1)`, thời lượng `--dur: 220ms`.
- Reveal: chỉ fade + slide nhẹ khi ĐỔI TAB (một lần), không reveal-on-scroll khắp nơi.
- `prefers-reduced-motion`: rút về fade ≤150ms. Chỉ animate `transform`/`opacity`.
- Cắt bớt motion trước khi thêm. Không toast ăn mừng; ưu tiên phản hồi im.

## Component voice
- **Panel** thay "card": `bg surface` + viền `--color-rule` mảnh 1px + **bóng rất nhẹ** (không "biển bóng"),
  bo `--radius-panel: 14px`. Header panel = eyebrow (tùy chọn) + tiêu đề navy.
- **Stat** (KPI): số lớn tabular navy; nhãn nhỏ muted; tăng/giảm mới tô peach/emerald/rose + mũi tên.
  Xếp thành hàng chia bởi đường kẻ mảnh, không phải 6 ô icon-chip giống nhau.
- **Bảng**: header navy chữ trắng nhạt hoặc nền paper-2 + chữ navy; hàng kẻ mảnh; số canh phải tabular.
- **Chip**: nền paper-2, viền rule, chữ ink-2; đếm số peach. Bo `--radius-pill`.
- **Nút**: primary = nền accent, chữ trắng, bo `--radius-pill`; secondary = viền rule, nền surface.
- Focus: ring `--color-focus` ≥3:1, hiện tức thì (không animate ring).

## Per-page allowances
- App pages KHÔNG enrichment. Biểu đồ (movers, trend) giữ SVG/HTML thuần, palette CVD-safe hiện có.
- Mọi trang DÙNG CHUNG: wordmark, accent + vị trí accent, font display/body, voice nút, nhịp tiêu đề panel.

## What pages MUST share
Wordmark · accent peach (≤5%) · Be Vietnam Pro · voice nút/panel · nhịp page-header (tiêu đề + câu ý định).

## Exports
### tokens.css (tham chiếu — nguồn thật ở src/index.css @theme)
```css
:root {
  --color-paper: #F5F0E8; --color-paper-2: #FAF6EF; --color-surface: #FFFFFF;
  --color-ink: #1B234C; --color-ink-2: #57483A; --color-muted: #83725E;
  --color-rule: #E7DDD0; --color-accent: #F47E6A; --color-accent-strong: #E85F4B;
  --color-focus: #F47E6A;
  --font-display: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif;
  --font-body: "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif;
  --space-2xs:.5rem; --space-xs:.75rem; --space-sm:1rem; --space-md:1.5rem; --space-lg:2rem; --space-xl:3rem;
  --ease-out: cubic-bezier(0.16,1,0.3,1); --dur:220ms;
  --radius-panel:14px; --radius-pill:9999px; --radius-input:10px;
}
```
