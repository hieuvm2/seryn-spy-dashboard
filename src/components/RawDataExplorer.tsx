import React, { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  ChevronUp, 
  ChevronDown, 
  Maximize2,
  Table,
  HelpCircle
} from "lucide-react";

interface RawDataExplorerProps {
  rawTables?: any[];
  onRowClick: (entityName: string) => void;
}

export default function RawDataExplorer({ rawTables = [], onRowClick }: RawDataExplorerProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Gather available headers dynamically from row properties
  const headers = useMemo(() => {
    if (rawTables.length === 0) return [];
    // Accumulate all distinct keys across all structures
    const keysSet = new Set<string>();
    rawTables.forEach(row => {
      Object.keys(row).forEach(k => keysSet.add(k));
    });
    return Array.from(keysSet);
  }, [rawTables]);

  // Derive filter options dynamically
  const categories = useMemo(() => {
    const list = new Set<string>();
    rawTables.forEach((row) => {
      const keys = Object.keys(row);
      const catKey = keys.find(k => k.toLowerCase().includes("segment") || k.toLowerCase().includes("khúc") || k.toLowerCase().includes("category") || k.toLowerCase().includes("nhóm"));
      if (catKey && row[catKey]) {
        list.add(String(row[catKey]));
      }
    });
    return Array.from(list);
  }, [rawTables]);

  const statuses = useMemo(() => {
    const list = new Set<string>();
    rawTables.forEach((row) => {
      const keys = Object.keys(row);
      const statKey = keys.find(k => k.toLowerCase().includes("status") || k.toLowerCase().includes("trạng thái") || k.toLowerCase().includes("đe dọa") || k.toLowerCase().includes("ads active"));
      if (statKey && row[statKey]) {
        list.add(String(row[statKey]));
      }
    });
    return Array.from(list);
  }, [rawTables]);

  // Set default initial sorting key to the first numeric looking column
  useMemo(() => {
    if (headers.length > 0 && !sortKey) {
      // Find a numeric header
      const numericHead = headers.find(h => h.toLowerCase().includes("ads") || h.toLowerCase().includes("chỉ số") || h.toLowerCase().includes("value") || h.toLowerCase().includes("volume") || h.toLowerCase().includes("lượng"));
      if (numericHead) {
        setSortKey(numericHead);
      } else {
        setSortKey(headers[0]);
      }
    }
  }, [headers, sortKey]);

  // Handle Filtering & Sorting logic
  const filteredSortedRows = useMemo(() => {
    let result = [...rawTables];

    // 1. Text Search Filter (scans all text values of the row)
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((row) => 
        Object.values(row).some((val) => String(val).toLowerCase().includes(query))
      );
    }

    // 2. Category Filter
    if (selectedCategory !== "all") {
      result = result.filter((row) => {
        const keys = Object.keys(row);
        const catKey = keys.find(k => k.toLowerCase().includes("segment") || k.toLowerCase().includes("khúc") || k.toLowerCase().includes("category") || k.toLowerCase().includes("nhóm"));
        return catKey && String(row[catKey]) === selectedCategory;
      });
    }

    // 3. Status Filter
    if (selectedStatus !== "all") {
      result = result.filter((row) => {
        const keys = Object.keys(row);
        const statKey = keys.find(k => k.toLowerCase().includes("status") || k.toLowerCase().includes("trạng thái") || k.toLowerCase().includes("đe dọa") || k.toLowerCase().includes("ads active"));
        return statKey && String(row[statKey]) === selectedStatus;
      });
    }

    // 4. Sort Columns
    if (sortKey) {
      result.sort((a, b) => {
        const rawA = a[sortKey];
        const rawB = b[sortKey];

        const isNumA = rawA !== undefined && !isNaN(Number(String(rawA).replace(/[^0-9.-]/g, "")));
        const isNumB = rawB !== undefined && !isNaN(Number(String(rawB).replace(/[^0-9.-]/g, "")));

        if (isNumA && isNumB) {
          const valA = Number(String(rawA).replace(/[^0-9.-]/g, ""));
          const valB = Number(String(rawB).replace(/[^0-9.-]/g, ""));
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }

        const strA = String(rawA || "").toLowerCase();
        const strB = String(rawB || "").toLowerCase();
        if (strA < strB) return sortDirection === "asc" ? -1 : 1;
        if (strA > strB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawTables, search, selectedCategory, selectedStatus, sortKey, sortDirection]);

  // Sort Trigger Wrapper
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  // Convert raw row state into generic CSV text output
  const handleCSVExport = () => {
    if (filteredSortedRows.length === 0) return;
    try {
      const csvContent = [];
      // Headers
      csvContent.push(headers.join(","));
      
      // Rows convert
      filteredSortedRows.forEach((row) => {
        const values = headers.map(h => {
          const rawVal = String(row[h] ?? "");
          // Escape quotes
          const cleanVal = rawVal.replace(/"/g, '""');
          return cleanVal.includes(",") || cleanVal.includes("\n") ? `"${cleanVal}"` : cleanVal;
        });
        csvContent.push(values.join(","));
      });

      const csvString = csvContent.join("\n");
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvString], { type: "text/csv;charset=utf-8;" }); // UTF-8 BOM
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "SERYN_Intelligence_Export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Export failure: ", e);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-150 flex items-center justify-center text-cyan-600">
            <Table className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-wider">Khám Phá Dữ Liệu Thô (Raw Explorer)</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5 font-semibold">Tìm kiếm, lọc danh mục, xếp thứ tự cột và xuất báo cáo CSV</p>
          </div>
        </div>

        {/* CSV export trigger */}
        {rawTables.length > 0 && (
          <button
            id="csv-export-click-btn"
            onClick={handleCSVExport}
            className="flex items-center gap-2.5 text-sm font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 px-4 rounded-xl border border-slate-200 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-cyan-600" />
            <span>Xuất file CSV</span>
          </button>
        )}
      </div>

      {rawTables.length === 0 ? (
        <div className="p-10 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50">
          <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-bold">“No raw table available. Please upload a structured file.”</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Filters shelf */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Find search field */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                id="search-input-field"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm từ khóa thương hiệu, dịch vụ..."
                className="w-full bg-white border border-slate-205 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 font-medium focus:border-cyan-500 focus:outline-none transition-all"
              />
            </div>

            {/* Category Dropdown */}
            {categories.length > 0 && (
              <div className="relative">
                <select
                  id="category-dropdown-filter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-white border border-slate-205 rounded-xl py-3 px-4.5 pr-10 text-sm text-slate-700 focus:outline-none focus:border-cyan-500 transition-all cursor-pointer appearance-none font-semibold shadow-xs"
                >
                  <option value="all">Tất cả Phân Khúc</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <Filter className="absolute right-3.5 top-3.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            )}

            {/* Status Dropdown */}
            {statuses.length > 0 && (
              <div className="relative">
                <select
                  id="status-dropdown-filter"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-white border border-slate-205 rounded-xl py-3 px-4.5 pr-10 text-sm text-slate-705 focus:outline-none focus:border-cyan-500 transition-all cursor-pointer appearance-none font-semibold shadow-xs"
                >
                  <option value="all">Tất cả Trạng thái</option>
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Filter className="absolute right-3.5 top-3.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Table Element container */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-[420px] shadow-xs">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10 font-mono">
                  {headers.map((h) => {
                    const isSorted = sortKey === h;
                    return (
                      <th
                        key={h}
                        onClick={() => handleSort(h)}
                        className="py-3.5 px-4 text-xs uppercase font-extrabold text-slate-600 tracking-wider cursor-pointer hover:bg-slate-100 transition-all select-none"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{h}</span>
                          {isSorted ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5 text-cyan-600 font-extrabold" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-cyan-600 font-extrabold" />
                            )
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="py-3.5 px-4 text-xs uppercase font-extrabold text-slate-650 tracking-wider text-right w-24">
                    Chi Tiết
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length + 1} className="py-12 text-center text-slate-500 text-xs font-semibold">
                      <HelpCircle className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      Không tìm thấy bản ghi nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredSortedRows.map((row, index) => {
                    // Try to identify the entity name cell value to target clicking actions
                     const nameKey = Object.keys(row).find(k => k.toLowerCase().includes("brand") || k.toLowerCase().includes("thương hiệu") || k.toLowerCase().includes("name") || k.toLowerCase().includes("tên") || k.toLowerCase().includes("campaign"));
                    const entityName = nameKey ? String(row[nameKey]) : "";

                    return (
                      <tr 
                        key={index}
                        onClick={() => entityName && onRowClick(entityName)}
                        className="hover:bg-slate-50/80 transition duration-300 cursor-pointer group"
                      >
                        {headers.map((h, hIdx) => {
                          const cellVal = String(row[h] ?? "—");
                          const isSpecialActive = cellVal.toLowerCase().includes("active");
                          const isSpecialScale = cellVal.toLowerCase().includes("gốc");

                          return (
                            <td 
                              key={hIdx} 
                              className={`py-3.5 px-4 text-sm font-semibold leading-relaxed max-w-[240px] truncate ${
                                hIdx === 0 ? "font-extrabold text-slate-900 group-hover:text-cyan-600 font-sans" : "text-slate-600"
                              }`}
                            >
                              {isSpecialActive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs uppercase font-bold font-mono bg-emerald-55 bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {cellVal}
                                </span>
                              ) : isSpecialScale ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                                  {cellVal}
                                </span>
                              ) : (
                                cellVal
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3.5 px-4 text-right">
                          <button 
                            className="bg-slate-5 bg-slate-50 hover:bg-cyan-50 border border-slate-200 p-1.5 rounded-md text-slate-500 hover:text-cyan-600 transition duration-300"
                            title="Bấm để xem chi tiết"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Metrics footprint status lines indicator */}
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-2 px-1 font-semibold">
            <span>Hiển thị {filteredSortedRows.length} của {rawTables.length} thực thể thu thập</span>
            <span>Tip: Bấm chọn dòng để xem phân tích y khoa & chiến lược</span>
          </div>
        </div>
      )}
    </div>
  );
}
