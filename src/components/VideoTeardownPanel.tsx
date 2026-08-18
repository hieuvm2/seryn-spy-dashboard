/* Hallmark · genre: modern-minimal · design-system: design.md · designed-as-app */
/* ============================================================
   Khối "Bóc tách video quảng cáo đối thủ" — hiển thị ở tab Theo dõi đối thủ.
   Nguồn: dataset `videoTeardown` (scripts/_push-video-teardown.mjs).

   Vì sao khối này tồn tại: 89,6% quảng cáo mới của đối thủ là VIDEO, nhưng ảnh
   preview mà Facebook trả về chỉ là 1 khung bắt ngẫu nhiên giữa chừng, thường mờ.
   Dữ liệu ở đây tách 6 khung theo mốc % thời lượng bằng ffmpeg, nên nói được về
   cấu trúc video và thời điểm từng thứ xuất hiện — thứ ảnh tĩnh không cho biết.
   ============================================================ */
import React, { useMemo, useState } from "react";
import { Clapperboard, ExternalLink, ChevronDown, Clock } from "lucide-react";
import type { SpyDashboardData, VideoTeardown } from "../types";

function giay(n?: number) {
  const s = Number(n) || 0;
  if (s >= 600) return `${Math.round(s / 60)} phút`;
  return `${s.toFixed(1)}s`;
}

/** Nhịp đổi cảnh suy từ câu mô tả — chỉ để gắn nhãn nhanh, chữ gốc vẫn hiện đầy đủ. */
function nhanNhip(s?: string): { nhan: string; tone: string } {
  const t = String(s || "").toLowerCase();
  if (/gần như không đổi|không đổi cảnh|gần như tĩnh|đúng một lần/.test(t)) {
    return { nhan: "gần như đứng yên", tone: "bg-slate-100 text-slate-600 border-slate-200" };
  }
  if (/rất nhiều|liên tục|đổi hẳn|không lặp/.test(t)) {
    return { nhan: "đổi cảnh dày", tone: "bg-[#FDF4EE] text-[#C2492F] border-[#F4B3A4]" };
  }
  if (/ít và|thưa|chậm|giữ khung lâu|phạm vi hẹp/.test(t)) {
    return { nhan: "đổi cảnh thưa", tone: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { nhan: "", tone: "" };
}

function Muc({ nhan, noi }: { nhan: string; noi?: string }) {
  if (!noi || !noi.trim()) return null;
  return (
    <div className="text-[12px] leading-relaxed">
      <b className="text-slate-500">{nhan}:</b> <span className="text-slate-700">{noi}</span>
    </div>
  );
}

function VideoRow({ v }: { v: VideoTeardown }) {
  const [mo, setMo] = useState(false);
  const nh = nhanNhip(v.co_doi_canh);
  const coTruocSau = /^có/i.test(String(v.truoc_sau || "").trim());
  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setMo((x) => !x)}
        className="hm-touch w-full text-left px-3.5 py-3 flex items-start gap-2.5 hover:bg-slate-50 transition cursor-pointer"
      >
        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono font-extrabold tabular-nums text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
          <Clock className="w-3 h-3" />{giay(v.thoi_luong_giay)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-slate-800 leading-snug break-words">{v.brand}</span>
          <span className="flex flex-wrap items-center gap-1.5 mt-1">
            {nh.nhan && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${nh.tone}`}>{nh.nhan}</span>}
            {coTruocSau && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200">có ảnh trước–sau</span>}
            {!!v.so_khung && <span className="text-[11px] text-slate-400 font-semibold tabular-nums">{v.so_khung} khung</span>}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition ${mo ? "rotate-180" : ""}`} />
      </button>

      {mo && (
        <div className="px-3.5 pb-3.5 pt-2.5 space-y-2 border-t border-slate-100">
          {v.url && (
            <a href={v.url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#C2492F] hover:underline">
              Mở quảng cáo trên Ad Library <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <Muc nhan="Mở đầu" noi={v.ba_giay_dau} />
          <Muc nhan="Cấu trúc theo mốc giây" noi={v.cau_truc} />
          <Muc nhan="Đổi cảnh" noi={v.co_doi_canh} />
          <Muc nhan="Chữ trên hình" noi={v.chu_tren_hinh} />
          <Muc nhan="Ảnh trước–sau" noi={v.truoc_sau} />
          <Muc nhan="Đồ họa chèn" noi={v.do_hoa_chen} />
          {v.diem_dang_hoc && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[12px] leading-relaxed">
              <b className="text-emerald-800">Đáng học:</b> <span className="text-slate-700">{v.diem_dang_hoc}</span>
            </div>
          )}
          {v.diem_nen_tranh && (
            <div className="rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-[12px] leading-relaxed">
              <b className="text-rose-800">Nên tránh:</b> <span className="text-slate-700">{v.diem_nen_tranh}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VideoTeardownPanel({ data }: { data: SpyDashboardData }) {
  const rows = data.videoTeardown ?? [];

  const { theoBrand, soBrand, dl } = useMemo(() => {
    const m = new Map<string, VideoTeardown[]>();
    for (const r of rows) {
      const k = r.brand || "(không rõ)";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    const ds = rows.map((r) => Number(r.thoi_luong_giay) || 0).sort((a, b) => a - b);
    return { theoBrand: [...m.entries()], soBrand: m.size, dl: ds };
  }, [rows]);

  if (!rows.length) return null;   // chưa có dữ liệu thì ẩn hẳn, không chiếm chỗ

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5 border-l-4 border-[#F47E6A] pl-4">
        <span className="text-[11px] uppercase font-mono tracking-widest text-[#C2492F] font-bold">VIDEO</span>
        <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Clapperboard className="w-6 h-6 text-[#F47E6A]" /> Bóc tách video quảng cáo đối thủ
        </h3>
        <p className="text-[13px] text-slate-500 font-medium">
          <b className="tabular-nums">{rows.length}</b> video của <b className="tabular-nums">{soBrand}</b> đối thủ, mỗi video tách <b>6 khung</b> tại mốc 2% · 15% · 35% · 55% · 75% · 95% thời lượng.
          {dl.length > 0 && <> Thời lượng: ngắn nhất <b className="tabular-nums">{giay(dl[0])}</b>, dài nhất <b className="tabular-nums">{giay(dl[dl.length - 1])}</b>.</>}
        </p>
      </div>

      {/* Ranh giới — nói rõ cái gì biết và cái gì không */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
        <b className="text-slate-800">Đọc thế nào:</b> đây là ảnh chụp cách quãng theo mốc thời lượng, không phải xem video liên tục.
        Vì vậy biết được cấu trúc, thời điểm chữ và ảnh trước–sau xuất hiện, có đổi cảnh hay đứng yên;
        <b> nhưng không biết</b> nhạc nền, lời thoại, giọng nói, và nhịp cắt cảnh giữa hai mốc.
      </div>

      <div className="space-y-4">
        {theoBrand.map(([brand, list]) => (
          <div key={brand} className="space-y-2">
            <p className="text-[12px] font-extrabold text-slate-700 uppercase tracking-wide">
              {brand} <span className="text-slate-400 font-mono tabular-nums">({list.length})</span>
            </p>
            <div className="space-y-2">
              {list.map((v) => <div key={v.ad_id}><VideoRow v={v} /></div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
