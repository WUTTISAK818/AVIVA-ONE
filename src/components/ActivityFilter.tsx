"use client";

import { useState, useCallback, useMemo } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import GlassCard from "@/components/GlassCard";

interface FilterParams {
  q?: string;
  category?: string[];
  dateFrom?: string;
  dateTo?: string;
  department?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

interface ActivityFilterProps {
  onFilter: (filters: FilterParams) => void;
  isLoading?: boolean;
  categories?: string[];
  departments?: string[];
  defaultFilters?: FilterParams;
}

const CATEGORIES = [
  "ลูกค้า/ขาย",
  "ก่อสร้าง",
  "บัญชี",
  "การเงิน",
  "การตลาด",
  "บุคคล",
  "ประชุม",
  "เอกสาร",
  "อื่นๆ",
];

const SORT_OPTIONS = [
  { value: "date", label: "วันที่" },
  { value: "category", label: "หมวดหมู่" },
  { value: "user", label: "ผู้บันทึก" },
  { value: "status", label: "สถานะ" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "รอการอนุมัติ" },
  { value: "approved", label: "อนุมัติแล้ว" },
  { value: "rejected", label: "ปฏิเสธ" },
];

export function ActivityFilter({
  onFilter,
  isLoading = false,
  categories = CATEGORIES,
  departments = [],
  defaultFilters = {},
}: ActivityFilterProps) {
  const [filters, setFilters] = useState<FilterParams>({
    q: "",
    category: [],
    dateFrom: "",
    dateTo: "",
    department: "",
    status: "",
    sortBy: "date",
    sortOrder: "desc",
    page: 1,
    limit: 20,
    ...defaultFilters,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null
  );

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setFilters((p) => ({ ...p, q: value, page: 1 }));

      if (searchTimeout) clearTimeout(searchTimeout);

      const timeout = setTimeout(() => {
        onFilter({ ...filters, q: value, page: 1 });
      }, 300);

      setSearchTimeout(timeout);
    },
    [filters, onFilter, searchTimeout]
  );

  // Category toggle
  const handleCategoryToggle = (cat: string) => {
    setFilters((p) => {
      const updated = p.category || [];
      const newCategories = updated.includes(cat)
        ? updated.filter((c) => c !== cat)
        : [...updated, cat];
      return { ...p, category: newCategories, page: 1 };
    });
  };

  // Apply filters
  const handleApplyFilters = useCallback(() => {
    onFilter({ ...filters, page: 1 });
  }, [filters, onFilter]);

  // Clear filters
  const handleClearFilters = () => {
    const cleared = {
      q: "",
      category: [],
      dateFrom: "",
      dateTo: "",
      department: "",
      status: "",
      sortBy: "date",
      sortOrder: "desc" as const,
      page: 1,
      limit: 20,
    };
    setFilters(cleared);
    onFilter(cleared);
  };

  // Check if filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      (filters.q && filters.q.length > 0) ||
      (filters.category && filters.category.length > 0) ||
      !!filters.dateFrom ||
      !!filters.dateTo ||
      !!filters.department ||
      !!filters.status
    );
  }, [filters]);

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-aviva-secondary/50"
        />
        <input
          type="text"
          placeholder="ค้นหา (ชื่อกิจกรรม, รายละเอียด)"
          value={filters.q || ""}
          onChange={(e) => handleSearchChange(e.target.value)}
          disabled={isLoading}
          className="w-full pl-10 pr-3 py-2.5 rounded-lg bg-aviva-card border border-aviva-gold/20 text-sm text-aviva-text placeholder-aviva-secondary/40 disabled:opacity-50"
        />
      </div>

      {/* Quick Filters (Collapsed) */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-aviva-gold/10 border border-aviva-gold/20 text-aviva-gold hover:bg-aviva-gold/20"
        >
          {showAdvanced ? "ซ่อน" : "ตัวกรอง"}
          <ChevronDown
            size={12}
            className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
          >
            <X size={12} />
            เคลียร์
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <GlassCard className="p-3 space-y-3">
          {/* Category Filter */}
          <div>
            <p className="text-xs font-semibold text-aviva-text mb-2">
              หมวดหมู่
            </p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <label
                  key={cat}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.category?.includes(cat) || false}
                    onChange={() => handleCategoryToggle(cat)}
                    className="w-4 h-4 rounded border-aviva-gold/40 bg-aviva-bg accent-aviva-gold"
                  />
                  <span className="text-xs text-aviva-text">{cat}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-aviva-text">
                จากวันที่
              </label>
              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, dateFrom: e.target.value }))
                }
                className="w-full px-2 py-1.5 rounded-lg bg-aviva-card border border-aviva-gold/20 text-xs text-aviva-text"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-aviva-text">
                ถึงวันที่
              </label>
              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, dateTo: e.target.value }))
                }
                className="w-full px-2 py-1.5 rounded-lg bg-aviva-card border border-aviva-gold/20 text-xs text-aviva-text"
              />
            </div>
          </div>

          {/* Department Filter (if available) */}
          {departments && departments.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-aviva-text">
                ฝ่าย
              </label>
              <select
                value={filters.department || ""}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, department: e.target.value }))
                }
                className="w-full px-2 py-1.5 rounded-lg bg-aviva-card border border-aviva-gold/20 text-xs text-aviva-text"
              >
                <option value="">ทั้งหมด</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div>
            <label className="text-xs font-semibold text-aviva-text">
              สถานะ
            </label>
            <select
              value={filters.status || ""}
              onChange={(e) =>
                setFilters((p) => ({ ...p, status: e.target.value }))
              }
              className="w-full px-2 py-1.5 rounded-lg bg-aviva-card border border-aviva-gold/20 text-xs text-aviva-text"
            >
              <option value="">ทั้งหมด</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Options */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-aviva-text">
                เรียงตาม
              </label>
              <select
                value={filters.sortBy || "date"}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, sortBy: e.target.value }))
                }
                className="w-full px-2 py-1.5 rounded-lg bg-aviva-card border border-aviva-gold/20 text-xs text-aviva-text"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-aviva-text">
                ลำดับ
              </label>
              <select
                value={filters.sortOrder || "desc"}
                onChange={(e) =>
                  setFilters((p) => ({
                    ...p,
                    sortOrder: e.target.value as "asc" | "desc",
                  }))
                }
                className="w-full px-2 py-1.5 rounded-lg bg-aviva-card border border-aviva-gold/20 text-xs text-aviva-text"
              >
                <option value="desc">ใหม่สุด</option>
                <option value="asc">เก่าสุด</option>
              </select>
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={handleApplyFilters}
            disabled={isLoading}
            className="w-full py-2 rounded-lg bg-aviva-gold text-aviva-bg text-xs font-bold hover:bg-aviva-gold/90 disabled:opacity-50"
          >
            ค้นหา
          </button>
        </GlassCard>
      )}
    </div>
  );
}
