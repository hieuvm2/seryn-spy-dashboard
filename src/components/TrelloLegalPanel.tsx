/* Hallmark · genre: modern-minimal · design-system: design.md · designed-as-app */
/* ============================================================
   Khối "Rà soát pháp lý content trên Trello" — hiển thị trong tab SERYN.
   Nguồn: dataset `trelloLegalScreen` (scripts/trello-legal-screen.mjs --push).

   Chia 2 phần vì bản chất khác nhau:
   - LỖI HỆ THỐNG: gần như card nào cũng dính (thiếu disclaimer…) -> gộp 1 dòng,
     không lặp lại ở từng card, tránh nhấn chìm tín hiệu thật.
   - LỖI CÂU CHỮ: từng card cụ thể, có trích dẫn nguyên văn -> liệt kê để sửa.
   ============================================================ */
import React, { useMemo, useState } from "react";
import { ScrollText, ExternalLink, AlertTriangle, ShieldCheck, ChevronDown } from "lucide-react";
import type { SpyDashboardData, TrelloLegalCard } from "../types";

const TONE: Record<string, string> = {
  "Cao": "bg-rose-50 text-rose-700 border-rose-200",
  "Trung bình": "bg-amber-50 text-amber-700 border-amber-200",
  "Thấp": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function ngayGio(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CardRow({ c }: { c: TrelloLegalCard }) {
  const [mo, setMo] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        className="hm-touch w-full text-left px-3.5 py-3 flex items-start gap-2.5 hover:bg-slate-50 transition cursor-pointer"
      >
        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded border tabular-nums ${TONE[c.tong_rui_ro]}`}>
          {c.tong_rui_ro}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-slate-800 leading-snug break-words">{c.card_name}</span>
          <span className="block text-[11px] text-slate-500 font-semibold mt-0.5">
            {c.cot}
            {c.la_kbcb && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-[#C2492F]">· khám chữa bệnh</span>}
            {!!c.loi?.length && <span className="ml-1.5 tabular-nums">· {c.loi.length} lỗi câu chữ</span>}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition ${mo ? "rotate-180" : ""}`} />
      </button>

      {mo && (
        <div className="px-3.5 pb-3.5 pt-0 space-y-2.5 border-t border-slate-100">
          {c.card_url && (
            <a href={c.card_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#C2492F] hover:underline mt-2.5">
              Mở card Trello <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {c.loi?.map((l, i) => (
            <div key={i} className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2">
              <p className="text-[12px] font-bold text-slate-800">
                <span className={`inline-block mr-1.5 text-[10px] px-1.5 py-0.5 rounded border ${TONE[l.muc]}`}>{l.muc}</span>
                {l.nhom}
              </p>
              {l.canCu && <p className="text-[11px] text-slate-500 mt-1"><b>Căn cứ:</b> {l.canCu}</p>}
              {l.trich_dan && (
                <p className="text-[11px] text-slate-600 mt-1 italic break-words">“…{l.trich_dan}…”</p>
              )}
              {l.cach_sua && <p className="text-[11px] text-emerald-800 mt-1"><b>Sửa:</b> {l.cach_sua}</p>}
            </div>
          ))}
          {!c.loi?.length && (
            <p className="text-[12px] text-slate-500 mt-2.5">Không có lỗi câu chữ — chỉ thiếu yếu tố bắt buộc chung (xem phần trên).</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrelloLegalPanel({ data }: { data: SpyDashboardData }) {
  const rows = data.trelloLegalScreen ?? [];

  const { coLoi, heThong, quetLuc, theoNhom } = useMemo(() => {
    const coLoi = rows.filter((r) => (r.loi?.length ?? 0) > 0)
      .sort((a, b) => {
        const t: Record<string, number> = { "Cao": 0, "Trung bình": 1, "Thấp": 2 };
        return (t[a.tong_rui_ro] - t[b.tong_rui_ro]) || ((b.loi?.length ?? 0) - (a.loi?.length ?? 0));
      });
    // Lỗi hệ thống: gom theo "thiếu_gi", đếm số card dính.
    const m = new Map<string, { muc: string; canCu?: string; cach_sua?: string; n: number }>();
    for (const r of rows) {
      for (const t of r.thieu ?? []) {
        const cur = m.get(t.thieu_gi);
        if (cur) cur.n += 1;
        else m.set(t.thieu_gi, { muc: t.muc, canCu: t.canCu, cach_sua: t.cach_sua, n: 1 });
      }
    }
    const heThong = [...m.entries()].map(([k, v]) => ({ thieu_gi: k, ...v })).sort((a, b) => b.n - a.n);
    // Đếm lỗi câu chữ theo nhóm.
    const g = new Map<string, number>();
    for (const r of rows) for (const l of r.loi ?? []) g.set(l.nhom, (g.get(l.nhom) ?? 0) + 1);
    const theoNhom = [...g.entries()].sort((a, b) => b[1] - a[1]);
    return { coLoi, heThong, quetLuc: rows[0]?.quet_luc, theoNhom };
  }, [rows]);

  if (!rows.length) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5 border-l-4 border-[#F47E6A] pl-4">
          <span className="text-[11px] uppercase font-mono tracking-widest text-[#C2492F] font-bold">TRELLO</span>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-[#F47E6A]" /> Rà soát pháp lý content trên Trello
          </h3>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          Chưa có dữ liệu rà soát. Chạy <span className="font-mono">npm run legal:trello -- --push</span> để quét board và đẩy kết quả lên.
        </div>
      </div>
    );
  }

  const soCao = rows.filter((r) => r.tong_rui_ro === "Cao").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5 border-l-4 border-[#F47E6A] pl-4">
        <span className="text-[11px] uppercase font-mono tracking-widest text-[#C2492F] font-bold">TRELLO</span>
        <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-[#F47E6A]" /> Rà soát pháp lý content trên Trello
        </h3>
        <p className="text-[13px] text-slate-500 font-medium">
          Đã rà <b className="tabular-nums">{rows.length}</b> card ở cột đã duyệt · <b className="tabular-nums">{coLoi.length}</b> card có lỗi câu chữ · <b className="tabular-nums">{soCao}</b> card mức Cao.
          {quetLuc && <span className="text-slate-400"> Quét lúc {ngayGio(quetLuc)}.</span>}
        </p>
      </div>

      {/* Ranh giới phạm vi — nói rõ đây không phải kết luận pháp lý */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
        <b className="text-slate-800">Phạm vi:</b> đây là bản sàng lọc tự động theo <i>câu chữ</i>, đối chiếu Hướng dẫn tuân thủ v2.0 và các tiền lệ đã có phán quyết của Phòng Pháp chế.
        Công cụ <b>không</b> kiểm được hợp đồng/consent của người xuất hiện, chứng chỉ hành nghề của bác sĩ, thiết bị đã đăng ký chưa, hay ảnh trước–sau có bị chỉnh sửa không.
        <span className="block mt-1.5 text-slate-500">Card mức Cao phải chuyển Pháp chế/Chuyên môn xem trước khi đăng — bản sàng lọc <b>không thay</b> ý kiến Phòng Pháp chế.</span>
      </div>

      {/* Lỗi hệ thống — gom 1 chỗ, không lặp ở từng card */}
      {!!heThong.length && (
        <div className="hm-panel p-4 space-y-2.5">
          <p className="text-[11px] uppercase font-mono tracking-widest text-slate-500 font-bold">Vấn đề hệ thống</p>
          {heThong.map((h) => (
            <div key={h.thieu_gi} className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800">
                  {h.thieu_gi} — <span className="tabular-nums text-[#C2492F]">{h.n}/{rows.length} card</span>
                </p>
                {h.canCu && <p className="text-[11px] text-slate-500">Căn cứ: {h.canCu}</p>}
                {h.cach_sua && <p className="text-[11px] text-emerald-800 mt-0.5">{h.cach_sua}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Thống kê lỗi câu chữ theo nhóm */}
      {!!theoNhom.length && (
        <div className="hm-panel p-4">
          <p className="text-[11px] uppercase font-mono tracking-widest text-slate-500 font-bold mb-2.5">Lỗi câu chữ theo nhóm</p>
          <ul className="space-y-1">
            {theoNhom.map(([nhom, n]) => (
              <li key={nhom} className="flex items-baseline gap-2.5 text-[13px]">
                <span className="font-mono font-extrabold tabular-nums text-[#C2492F] w-9 text-right shrink-0">{n}</span>
                <span className="text-slate-700 font-medium">{nhom}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Danh sách card có lỗi */}
      {coLoi.length ? (
        <ul className="space-y-2">
          {coLoi.map((c) => <li key={c.card_id}><CardRow c={c} /></li>)}
        </ul>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          Không card nào có lỗi câu chữ theo bộ quy tắc hiện có.
        </div>
      )}
    </div>
  );
}
