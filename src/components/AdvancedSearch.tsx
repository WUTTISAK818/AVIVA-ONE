"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Download, Calendar, Users, Tag, Clock } from "lucide-react";
import { PhotoGallery } from "./PhotoGallery";

interface SearchResult {
  id: string;
  type: "activity" | "construction";
  title: string;
  description?: string;
  date: string;
  category?: string;
  status: string;
  creator: string;
  department?: string;
  approvedBy?: string;
  projectId?: string;
  photoCount?: number;
  createdAt: string;
}

interface SearchFilters {
  query: string;
  startDate: string;
  endDate: string;
  department: string;
  creator: string;
  status: string;
  type: "all" | "activity" | "construction";
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  approved: { bg: "bg-green-500/10", text: "text-green-400" },
  rejected: { bg: "bg-red-500/10", text: "text-red-400" },
  completed: { bg: "bg-blue-500/10", text: "text-blue-400" },
};

export function AdvancedSearch() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    startDate: "",
    endDate: "",
    department: "",
    creator: "",
    status: "",
    type: "all",
  });

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const limit = 20;

  const handleSearch = async (newOffset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.query) params.append("query", filters.query);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.department) params.append("department", filters.department);
      if (filters.creator) params.append("creator", filters.creator);
      if (filters.status) params.append("status", filters.status);
      params.append("type", filters.type);
      params.append("limit", limit.toString());
      params.append("offset", newOffset.toString());

      const res = await fetch(`/api/search/advanced?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setResults(data.data);
        setTotalCount(data.pagination.total);
        setOffset(newOffset);
      }
    } catch (error) {
      console.error("Error searching:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: "csv" | "pdf") => {
    if (format === "csv") {
      exportToCSV();
    } else {
      exportToPDF();
    }
  };

  const exportToCSV = () => {
    const csv = [
      ["Advanced Search Results", new Date().toLocaleString("th-TH")],
      [],
      ["Filters Applied:"],
      ["Search Query", filters.query || "None"],
      ["Date Range", `${filters.startDate} - ${filters.endDate}` || "None"],
      ["Department", filters.department || "All"],
      ["Creator", filters.creator || "All"],
      ["Status", filters.status || "All"],
      [],
      [
        "ID",
        "Type",
        "Title",
        "Date",
        "Status",
        "Creator",
        "Department",
        "Approved By",
      ],
      ...results.map((result) => [
        result.id,
        result.type,
        result.title,
        result.date,
        result.status,
        result.creator,
        result.department || "-",
        result.approvedBy || "-",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-results-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const exportToPDF = () => {
    const docContent = `
Search Results Report
Date: ${new Date().toLocaleString("th-TH")}

Filters Applied:
- Query: ${filters.query || "None"}
- Date: ${filters.startDate} - ${filters.endDate}
- Department: ${filters.department || "All"}
- Status: ${filters.status || "All"}

Total Results: ${totalCount}

${results
  .map(
    (r, i) => `
${i + 1}. ${r.title}
   Type: ${r.type}
   Date: ${r.date}
   Status: ${r.status}
   Creator: ${r.creator}
   ${r.description ? `Description: ${r.description}` : ""}
`
  )
  .join("\n")}
`;

    const blob = new Blob([docContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `search-results-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status] || STATUS_COLORS.pending;
  };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-aviva-text">🔍 Advanced Search</h1>
        <p className="text-sm text-aviva-secondary/70">
          ค้นหาและฟิลเตอร์รายงานตามเกณฑ์ต่างๆ
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-3 text-aviva-secondary/50"
          />
          <input
            type="text"
            placeholder="ค้นหาชื่อหรือรายละเอียด..."
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            onKeyPress={(e) => e.key === "Enter" && handleSearch(0)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-text placeholder-aviva-secondary/50 focus:outline-none focus:border-aviva-gold/50"
          />
        </div>
        <button
          onClick={() => handleSearch(0)}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-aviva-gold/20 text-aviva-gold hover:bg-aviva-gold/30 font-semibold text-sm disabled:opacity-50"
        >
          {loading ? "ค้นหา..." : "ค้นหา"}
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 rounded-lg bg-aviva-card text-aviva-secondary hover:bg-aviva-card/80 font-semibold text-sm flex items-center gap-2"
        >
          <Filter size={16} />
          Filters
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-aviva-card rounded-lg border border-aviva-gold/10 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Date Range */}
            <div>
              <label className="text-xs font-semibold text-aviva-secondary block mb-1">
                <Calendar size={14} className="inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-text text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-aviva-secondary block mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-text text-xs"
              />
            </div>

            {/* Report Type */}
            <div>
              <label className="text-xs font-semibold text-aviva-secondary block mb-1">
                <Tag size={14} className="inline mr-1" />
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    type: e.target.value as "all" | "activity" | "construction",
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-text text-xs"
              >
                <option value="all">All Types</option>
                <option value="activity">Activities</option>
                <option value="construction">Construction</option>
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="text-xs font-semibold text-aviva-secondary block mb-1">
                <Users size={14} className="inline mr-1" />
                Department
              </label>
              <input
                type="text"
                placeholder="Filter by department"
                value={filters.department}
                onChange={(e) =>
                  setFilters({ ...filters, department: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-text text-xs placeholder-aviva-secondary/50"
              />
            </div>

            {/* Creator */}
            <div>
              <label className="text-xs font-semibold text-aviva-secondary block mb-1">
                Creator
              </label>
              <input
                type="text"
                placeholder="Filter by creator"
                value={filters.creator}
                onChange={(e) =>
                  setFilters({ ...filters, creator: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-text text-xs placeholder-aviva-secondary/50"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-xs font-semibold text-aviva-secondary block mb-1">
                <Clock size={14} className="inline mr-1" />
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg bg-aviva-bg border border-aviva-gold/20 text-aviva-text text-xs"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => handleSearch(0)}
              className="flex-1 px-3 py-2 rounded-lg bg-aviva-gold text-aviva-bg font-semibold text-sm"
            >
              Apply Filters
            </button>
            <button
              onClick={() =>
                setFilters({
                  query: "",
                  startDate: "",
                  endDate: "",
                  department: "",
                  creator: "",
                  status: "",
                  type: "all",
                })
              }
              className="flex-1 px-3 py-2 rounded-lg bg-aviva-card text-aviva-secondary hover:bg-aviva-card/80 font-semibold text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Export Buttons */}
      {results.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 font-semibold text-sm flex items-center gap-2"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold text-sm flex items-center gap-2"
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
      )}

      {/* Results Summary */}
      {totalCount > 0 && (
        <div className="text-sm text-aviva-secondary bg-aviva-card rounded-lg border border-aviva-gold/10 p-3">
          Found {totalCount} result{totalCount !== 1 ? "s" : ""} (Showing{" "}
          {Math.min(limit, results.length)} per page)
        </div>
      )}

      {/* Results List */}
      <div className="space-y-3">
        {results.length === 0 && !loading ? (
          <div className="text-center py-8 text-aviva-secondary/60">
            {totalCount === 0
              ? "ไม่พบผลลัพธ์ - ลองค้นหาหรือปรับฟิลเตอร์"
              : "กำลังโหลด..."}
          </div>
        ) : (
          results.map((result) => {
            const isExpanded = expandedResult === result.id;
            const statusColor = getStatusColor(result.status);
            return (
              <div
                key={result.id}
                className="bg-aviva-card rounded-lg border border-aviva-gold/10 p-4 space-y-2 cursor-pointer hover:border-aviva-gold/30 transition-colors"
                onClick={() =>
                  setExpandedResult(isExpanded ? null : result.id)
                }
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-aviva-text">
                      {result.title}
                    </h3>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-xs bg-aviva-bg px-2 py-1 rounded text-aviva-secondary">
                        {result.type === "activity" ? "Activity" : "Construction"}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${statusColor.bg} ${statusColor.text}`}
                      >
                        {result.status}
                      </span>
                      {result.category && (
                        <span className="text-xs bg-aviva-bg px-2 py-1 rounded text-aviva-secondary">
                          {result.category}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-aviva-secondary/70">
                      {new Date(result.date).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex gap-4 text-xs text-aviva-secondary/60">
                  <span>By: {result.creator}</span>
                  {result.department && <span>Dept: {result.department}</span>}
                  {result.approvedBy && (
                    <span>Approved by: {result.approvedBy}</span>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-aviva-gold/10 space-y-2">
                    {result.description && (
                      <div>
                        <p className="text-xs font-semibold text-aviva-secondary mb-1">
                          Details:
                        </p>
                        <p className="text-xs text-aviva-text line-clamp-3">
                          {result.description}
                        </p>
                      </div>
                    )}
                    {result.photoCount && result.photoCount > 0 && (
                      <div className="text-xs text-aviva-gold">
                        📷 {result.photoCount} photos attached
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalCount > limit && (
        <div className="flex items-center justify-between p-4 bg-aviva-card rounded-lg border border-aviva-gold/10">
          <div className="text-xs text-aviva-secondary">
            Page {Math.floor(offset / limit) + 1} of{" "}
            {Math.ceil(totalCount / limit)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSearch(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1 rounded bg-aviva-gold/20 text-aviva-gold text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handleSearch(offset + limit)}
              disabled={offset + limit >= totalCount}
              className="px-3 py-1 rounded bg-aviva-gold/20 text-aviva-gold text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
