"use client";

import { useState, useEffect, useCallback } from "react";
import type { Brand } from "@/types/sales";
import type {
  StagnantStockResponse,
  DimensionTab,
  SummaryBoxData,
  DetailTableData,
  StagnantStockItem,
  SortConfig,
  MidCategory,
} from "@/types/stagnantStock";
import { DIMENSION_TABS, BRAND_CODE_MAP } from "@/types/stagnantStock";
import CollapsibleSection from "./CollapsibleSection";

interface StagnantStockAnalysisProps {
  brand: Brand;
}

// 숫자 포맷팅 함수
function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR");
}

function formatPercent(num: number, decimals: number = 2): string {
  return num.toFixed(decimals) + "%";
}

// 상단 요약 카드용: M 단위, 정수 반올림, 천단위 콤마 (예: 2,888M)
function formatAmountM(num: number): string {
  const mValue = Math.round(num / 1000000);
  return mValue.toLocaleString("ko-KR") + "M";
}

// 상세 테이블용: K 단위, 정수 반올림, 천단위 콤마 (예: 335,110K)
function formatAmountK(num: number): string {
  const kValue = Math.round(num / 1000);
  return kValue.toLocaleString("ko-KR") + "K";
}

// 기존 함수 유지 (다른 곳에서 사용될 수 있음)
function formatAmount(num: number): string {
  // 백만 단위로 표시
  return (num / 1000000).toFixed(2) + "M";
}

// 요약 박스 컴포넌트
function SummaryBox({ data, isTotal = false }: { data: SummaryBoxData; isTotal?: boolean }) {
  const bgColor = isTotal 
    ? "bg-gray-50" 
    : data.title === "정체재고" 
      ? "bg-red-50" 
      : "bg-green-50";
  
  const borderColor = isTotal
    ? "border-gray-200"
    : data.title === "정체재고"
      ? "border-red-200"
      : "border-green-200";

  const titleColor = isTotal
    ? "text-gray-800"
    : data.title === "정체재고"
      ? "text-red-700"
      : "text-green-700";

  // 카테고리 순서: 전체, 신발, 모자, 가방, 기타
  const categoryOrder = ["전체", "신발", "모자", "가방", "기타"];
  const sortedCategories = categoryOrder
    .map(name => data.categories.find(c => c.category === name))
    .filter(Boolean);

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4`}>
      <h4 className={`text-lg font-bold ${titleColor} mb-3`}>{data.title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 px-2 font-medium text-gray-600">구분</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">재고금액</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">전체대비 %</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">재고수량</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">품번수</th>
              <th className="text-right py-2 px-2 font-medium text-gray-600">매출금액</th>
            </tr>
          </thead>
          <tbody>
            {sortedCategories.map((cat, idx) => (
              <tr 
                key={cat!.category} 
                className={`${idx < sortedCategories.length - 1 ? "border-b border-gray-200" : ""} ${cat!.category === "전체" ? "font-semibold bg-white/50" : ""}`}
              >
                <td className="py-2 px-2 text-gray-700">{cat!.category}</td>
                <td className="text-right py-2 px-2 text-gray-900">{formatAmountM(cat!.stock_amt)}</td>
                <td className="text-right py-2 px-2 text-gray-600">{formatPercent(cat!.stock_amt_pct, 1)}</td>
                <td className="text-right py-2 px-2 text-gray-900">{formatNumber(cat!.stock_qty)}</td>
                <td className="text-right py-2 px-2 text-gray-900">{formatNumber(cat!.item_count)}</td>
                <td className="text-right py-2 px-2 text-gray-900">{formatAmountM(cat!.sales_tag_amt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 전체재고 합계(체크용) 테이블 컴포넌트
function CheckSummaryTable({ 
  data,
  dimensionTab,
}: { 
  data: StagnantStockResponse;
  dimensionTab: DimensionTab;
}) {
  const [isOpen, setIsOpen] = useState(false); // 기본 접힌 상태

  // 4개 상세 테이블의 모든 아이템을 합침
  const allItems = [
    ...data.stagnantDetail.items,
    ...data.currentSeasonDetail.items,
    ...data.nextSeasonDetail.items,
    ...data.pastSeasonDetail.items,
  ];

  // 전체 합계 계산
  const totalStock = {
    stock_qty: allItems.reduce((sum, item) => sum + item.stock_qty, 0),
    stock_amt: allItems.reduce((sum, item) => sum + item.stock_amt, 0),
    sales_tag_amt: allItems.reduce((sum, item) => sum + item.sales_tag_amt, 0),
  };

  // 중분류별 합계 계산
  const categories = ["신발", "모자", "가방", "기타"];
  const categoryTotals = categories.map(cat => {
    const catItems = allItems.filter(item => item.mid_category_kr === cat);
    const stock_amt = catItems.reduce((sum, item) => sum + item.stock_amt, 0);
    const sales_tag_amt = catItems.reduce((sum, item) => sum + item.sales_tag_amt, 0);
    return {
      category: cat,
      stock_qty: catItems.reduce((sum, item) => sum + item.stock_qty, 0),
      stock_amt,
      sales_tag_amt,
      ratio: stock_amt > 0 ? (sales_tag_amt / stock_amt) * 100 : 0,
      item_count: catItems.length,
    };
  });

  // 전체 비율 계산
  const totalRatio = totalStock.stock_amt > 0 
    ? (totalStock.sales_tag_amt / totalStock.stock_amt) * 100 
    : 0;

  // 품번 컬럼 헤더
  const dimensionLabel = dimensionTab === "스타일" ? "품번" 
    : dimensionTab === "컬러" ? "품번_컬러"
    : dimensionTab === "사이즈" ? "품번_사이즈"
    : "품번_컬러_사이즈";

  return (
    <div className="rounded-lg border border-gray-300 bg-gray-100 overflow-hidden mb-4">
      {/* 토글 헤더 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-gray-200 hover:bg-gray-300 transition-colors flex items-center gap-2 text-left"
      >
        <span className={`text-gray-600 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
          ▶
        </span>
        <h4 className="text-md font-bold text-gray-700">
          🔍 전체재고 합계 (4개 내역 합계 체크용)
        </h4>
        <span className="text-xs text-gray-500 ml-2">
          {isOpen ? "접기" : "펼치기"}
        </span>
      </button>
      
      {/* 토글 콘텐츠 */}
      {isOpen && (
        <>
          <div className="overflow-x-auto border-t border-gray-300">
            <table className="w-full text-sm">
              <thead className="bg-gray-200">
                <tr className="border-b border-gray-300">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">중분류</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">{dimensionLabel}</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">품명</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">시즌</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">재고수량</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">재고금액</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">매출금액</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">비율</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-600">상태</th>
                </tr>
              </thead>
              <tbody>
                {/* 전체 합계 행 */}
                <tr className="bg-white font-semibold border-b border-gray-300">
                  <td className="py-2 px-2 text-gray-800">(Total)</td>
                  <td className="py-2 px-2 text-gray-500">-</td>
                  <td className="py-2 px-2 text-gray-500">-</td>
                  <td className="py-2 px-2 text-gray-500">-</td>
                  <td className="text-right py-2 px-2 text-gray-900">{formatNumber(totalStock.stock_qty)}</td>
                  <td className="text-right py-2 px-2 text-gray-900">{formatAmount(totalStock.stock_amt)}</td>
                  <td className="text-right py-2 px-2 text-gray-900">{formatAmount(totalStock.sales_tag_amt)}</td>
                  <td className="text-right py-2 px-2 text-gray-700">{formatPercent(totalRatio, 2)}</td>
                  <td className="text-center py-2 px-2 text-gray-500">-</td>
                </tr>
                {/* 중분류별 합계 행 */}
                {categoryTotals.map((cat, idx) => (
                  <tr 
                    key={cat.category} 
                    className={`bg-white/70 ${idx < categoryTotals.length - 1 ? "border-b border-gray-200" : ""}`}
                  >
                    <td className="py-2 px-2 text-gray-700">{cat.category}</td>
                    <td className="py-2 px-2 text-gray-500">-</td>
                    <td className="py-2 px-2 text-gray-500">-</td>
                    <td className="py-2 px-2 text-gray-500">-</td>
                    <td className="text-right py-2 px-2 text-gray-900">{formatNumber(cat.stock_qty)}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{formatAmount(cat.stock_amt)}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{formatAmount(cat.sales_tag_amt)}</td>
                    <td className="text-right py-2 px-2 text-gray-700">{formatPercent(cat.ratio, 2)}</td>
                    <td className="text-center py-2 px-2 text-gray-500">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 안내 문구 */}
          <div className="p-2 bg-gray-200 text-xs text-gray-600 border-t border-gray-300">
            ※ 위 합계가 상단 "전체 재고" 카드의 값과 일치해야 합니다. (4개 상세 테이블 합계 = 전체 재고)
          </div>
        </>
      )}
    </div>
  );
}

// 상세 테이블 컴포넌트
// 월의 일수 계산 함수
function getDaysInMonth(yyyymm: string): number {
  if (yyyymm.length !== 6) return 30;
  const year = parseInt(yyyymm.slice(0, 4), 10);
  const month = parseInt(yyyymm.slice(4, 6), 10);
  return new Date(year, month, 0).getDate();
}

// 재고주수 계산 함수 (정수 반올림 + 천단위 콤마 + "주")
function calcStockWeeks(stockAmt: number, salesAmt: number, daysInMonth: number): string {
  if (salesAmt <= 0) return "판매0";
  const weekSales = (salesAmt / daysInMonth) * 7;
  if (weekSales <= 0) return "판매0";
  const weeks = Math.round(stockAmt / weekSales);
  return weeks.toLocaleString("ko-KR") + "주";
}

function DetailTable({ 
  data, 
  dimensionTab,
  sortConfig,
  onSort,
  targetMonth,
}: { 
  data: DetailTableData;
  dimensionTab: DimensionTab;
  sortConfig: SortConfig;
  onSort: (key: keyof StagnantStockItem) => void;
  targetMonth: string;
}) {
  const daysInMonth = getDaysInMonth(targetMonth);

  const bgColor = data.seasonGroup === "정체재고" 
    ? "bg-red-50" 
    : data.seasonGroup === "당시즌"
      ? "bg-blue-50"
      : data.seasonGroup === "차기시즌"
        ? "bg-purple-50"
        : "bg-amber-50";

  const borderColor = data.seasonGroup === "정체재고"
    ? "border-red-200"
    : data.seasonGroup === "당시즌"
      ? "border-blue-200"
      : data.seasonGroup === "차기시즌"
        ? "border-purple-200"
        : "border-amber-200";

  const titleColor = data.seasonGroup === "정체재고"
    ? "text-red-700"
    : data.seasonGroup === "당시즌"
      ? "text-blue-700"
      : data.seasonGroup === "차기시즌"
        ? "text-purple-700"
        : "text-amber-700";

  // 정렬된 아이템
  const sortedItems = [...data.items].sort((a, b) => {
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    }
    return sortConfig.direction === "asc" 
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  // 정렬 아이콘
  const SortIcon = ({ columnKey }: { columnKey: keyof StagnantStockItem }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-300 ml-1">↕</span>;
    }
    return (
      <span className="text-blue-500 ml-1">
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // 품번 컬럼 헤더
  const dimensionLabel = dimensionTab === "스타일" ? "품번" 
    : dimensionTab === "컬러" ? "품번_컬러"
    : dimensionTab === "사이즈" ? "품번_사이즈"
    : "품번_컬러_사이즈";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      <div className="p-3 border-b ${borderColor}">
        <h4 className={`text-md font-bold ${titleColor}`}>
          {data.title} ({formatNumber(data.items.length)}건)
        </h4>
      </div>
      
      <div className="overflow-x-auto">
        <div style={{ maxHeight: "280px", overflowY: "auto" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 px-2 font-medium text-gray-600">중분류</th>
                <th 
                  className="text-left py-2 px-2 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => onSort("dimensionKey")}
                >
                  {dimensionLabel}
                  <SortIcon columnKey="dimensionKey" />
                </th>
                <th className="text-left py-2 px-2 font-medium text-gray-600">품명</th>
                <th 
                  className="text-left py-2 px-2 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => onSort("season")}
                >
                  시즌
                  <SortIcon columnKey="season" />
                </th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">재고주수</th>
                <th 
                  className="text-right py-2 px-2 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => onSort("stock_qty")}
                >
                  재고수량
                  <SortIcon columnKey="stock_qty" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => onSort("stock_amt")}
                >
                  재고금액(K)
                  <SortIcon columnKey="stock_amt" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => onSort("sales_tag_amt")}
                >
                  매출금액(K)
                  <SortIcon columnKey="sales_tag_amt" />
                </th>
                <th 
                  className="text-right py-2 px-2 font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => onSort("ratio")}
                >
                  비율
                  <SortIcon columnKey="ratio" />
                </th>
                <th className="text-center py-2 px-2 font-medium text-gray-600">상태</th>
              </tr>
              {/* 합계 행 - 헤더에 고정 */}
              <tr className="bg-gray-100 font-semibold border-b border-gray-300">
                <td className="py-2 px-2 text-gray-700">(Total)</td>
                <td className="py-2 px-2 text-gray-500">-</td>
                <td className="py-2 px-2 text-gray-500">-</td>
                <td className="py-2 px-2 text-gray-500">-</td>
                <td className="text-right py-2 px-2 text-gray-900">{calcStockWeeks(data.totalRow.stock_amt, data.totalRow.sales_tag_amt, daysInMonth)}</td>
                <td className="text-right py-2 px-2 text-gray-900">{formatNumber(data.totalRow.stock_qty)}</td>
                <td className="text-right py-2 px-2 text-gray-900">{formatAmountK(data.totalRow.stock_amt)}</td>
                <td className="text-right py-2 px-2 text-gray-900">{formatAmountK(data.totalRow.sales_tag_amt)}</td>
                <td className="text-right py-2 px-2 text-gray-500">-</td>
                <td className="text-center py-2 px-2 text-gray-500">-</td>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-500">
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item, idx) => (
                  <tr key={item.dimensionKey + idx} className="border-b border-gray-200 hover:bg-white/50">
                    <td className="py-2 px-2 text-gray-700">{item.mid_category_kr}</td>
                    <td className="py-2 px-2 text-gray-900 font-mono text-xs">{item.dimensionKey}</td>
                    <td className="py-2 px-2 text-gray-700 max-w-[200px] truncate" title={item.prdt_nm}>
                      {item.prdt_nm}
                    </td>
                    <td className="py-2 px-2 text-gray-700">{item.season}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{calcStockWeeks(item.stock_amt, item.sales_tag_amt, daysInMonth)}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{formatNumber(item.stock_qty)}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{formatAmountK(item.stock_amt)}</td>
                    <td className="text-right py-2 px-2 text-gray-900">{formatAmountK(item.sales_tag_amt)}</td>
                    <td className="text-right py-2 px-2 text-gray-700">{formatPercent(item.ratio * 100, 4)}</td>
                    <td className="text-center py-2 px-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        item.status === "정체재고" 
                          ? "bg-red-100 text-red-700" 
                          : "bg-green-100 text-green-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function StagnantStockAnalysis({ brand }: StagnantStockAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StagnantStockResponse | null>(null);
  
  // 컨트롤 상태
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [targetMonth, setTargetMonth] = useState<string>("");
  const [thresholdPct, setThresholdPct] = useState<number>(0.01);
  const [dimensionTab, setDimensionTab] = useState<DimensionTab>("스타일");
  
  // 정렬 상태
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "stock_amt",
    direction: "desc",
  });

  // 아이템 탭 상태 (ACC합계, 신발, 모자, 가방, 기타)
  type ItemFilterTab = "ACC합계" | "신발" | "모자" | "가방" | "기타";
  const [itemTab, setItemTab] = useState<ItemFilterTab>("ACC합계");
  const ITEM_FILTER_TABS: ItemFilterTab[] = ["ACC합계", "신발", "모자", "가방", "기타"];

  const brandCode = BRAND_CODE_MAP[brand] || "M";

  // 아이템 탭에 따라 상세 테이블 데이터 필터링
  const filterDetailTableByItem = (detail: DetailTableData): DetailTableData => {
    if (itemTab === "ACC합계") {
      return detail; // 필터 없음
    }
    
    // mid_category_kr로 필터링
    const filteredItems = detail.items.filter(item => item.mid_category_kr === itemTab);
    
    // Total 재계산
    const totalRow = {
      stock_qty: filteredItems.reduce((sum, item) => sum + item.stock_qty, 0),
      stock_amt: filteredItems.reduce((sum, item) => sum + item.stock_amt, 0),
      sales_tag_amt: filteredItems.reduce((sum, item) => sum + item.sales_tag_amt, 0),
    };
    
    return {
      ...detail,
      items: filteredItems,
      totalRow,
    };
  };

  // 데이터 로드 함수
  const fetchData = useCallback(async () => {
    if (!targetMonth) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        brand: brandCode,
        targetMonth,
        dimensionTab,
        thresholdPct: String(thresholdPct),
      });
      
      const response = await fetch(`/api/stagnant-stock?${params}`);
      
      if (!response.ok) {
        throw new Error("데이터를 불러오는데 실패했습니다.");
      }
      
      const result: StagnantStockResponse = await response.json();
      setData(result);
      
      // 사용 가능한 월 목록 업데이트
      if (result.availableMonths && result.availableMonths.length > 0) {
        setAvailableMonths(result.availableMonths);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [brandCode, targetMonth, dimensionTab, thresholdPct]);

  // 초기 월 목록 로드
  useEffect(() => {
    const loadInitialMonths = async () => {
      try {
        // 현재 날짜 기준 기본 월 설정
        const now = new Date();
        const defaultMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        
        const params = new URLSearchParams({
          brand: brandCode,
          targetMonth: defaultMonth,
          dimensionTab: "스타일",
          thresholdPct: "0.01",
        });
        
        const response = await fetch(`/api/stagnant-stock?${params}`);
        if (response.ok) {
          const result: StagnantStockResponse = await response.json();
          if (result.availableMonths && result.availableMonths.length > 0) {
            setAvailableMonths(result.availableMonths);
            setTargetMonth(result.availableMonths[0]); // 최신 월 선택
          }
        }
      } catch (err) {
        console.error("Failed to load initial months:", err);
      }
    };
    
    loadInitialMonths();
  }, [brandCode]);

  // 조건 변경 시 데이터 재로드 (탭 전환 시 반드시 재계산)
  useEffect(() => {
    if (targetMonth) {
      fetchData();
    }
  }, [fetchData, targetMonth, dimensionTab, thresholdPct]);

  // 정렬 핸들러
  const handleSort = (key: keyof StagnantStockItem) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  // 월 포맷팅 (202501 → 2025.01)
  const formatMonth = (ym: string) => {
    if (ym.length !== 6) return ym;
    return `${ym.slice(0, 4)}.${ym.slice(4)}`;
  };

  return (
    <div className="mb-4">
      <CollapsibleSection
        title="정체재고 분석"
        icon="📊"
        iconColor="text-orange-500"
        defaultOpen={false}
      >
        {/* 컨트롤 영역 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-wrap items-end gap-4">
            {/* 기준월 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">기준월</label>
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{formatMonth(m)}</option>
                ))}
              </select>
            </div>

            {/* 정체재고 기준 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">정체재고 기준 (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholdPct}
                  onChange={(e) => setThresholdPct(parseFloat(e.target.value) || 0)}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="range"
                  value={thresholdPct}
                  onChange={(e) => setThresholdPct(parseFloat(e.target.value))}
                  step="0.01"
                  min="0"
                  max="1"
                  className="w-32"
                />
              </div>
            </div>

            {/* 단위 탭 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">분석 단위</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {DIMENSION_TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDimensionTab(tab)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      dimensionTab === tab
                        ? "bg-blue-500 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* 채널 (현재는 전체만) */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">채널</label>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-600">
                전체 (FR+OR+HQ)
              </div>
            </div>

            {/* 아이템 필터 탭 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">아이템</label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {ITEM_FILTER_TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setItemTab(tab)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      itemTab === tab
                        ? "bg-orange-500 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 범례 */}
          <div className="mt-3 text-xs text-gray-500">
            <span className="font-medium">정체재고 기준:</span> 해당 품번의 월 판매금액 ÷ 중분류 전체 재고금액 {"<"} {thresholdPct}% 이면 정체재고로 분류
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">데이터 로딩 중...</span>
          </div>
        )}

        {/* 에러 상태 */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* 데이터 표시 */}
        {!loading && !error && data && (
          <>
            {/* 요약 박스 3개 */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <SummaryBox data={data.totalSummary} isTotal={true} />
              <SummaryBox data={data.stagnantSummary} />
              <SummaryBox data={data.normalSummary} />
            </div>

            {/* 정체재고 합계 (4개 내역 합계 체크용) */}
            <CheckSummaryTable data={data} dimensionTab={dimensionTab} />

            {/* 상세 테이블 4개 (아이템 탭으로 필터링) */}
            <div className="space-y-4">
              <DetailTable 
                data={filterDetailTableByItem(data.stagnantDetail)} 
                dimensionTab={dimensionTab}
                sortConfig={sortConfig}
                onSort={handleSort}
                targetMonth={targetMonth}
              />
              <DetailTable 
                data={filterDetailTableByItem(data.currentSeasonDetail)} 
                dimensionTab={dimensionTab}
                sortConfig={sortConfig}
                onSort={handleSort}
                targetMonth={targetMonth}
              />
              <DetailTable 
                data={filterDetailTableByItem(data.nextSeasonDetail)} 
                dimensionTab={dimensionTab}
                sortConfig={sortConfig}
                onSort={handleSort}
                targetMonth={targetMonth}
              />
              <DetailTable 
                data={filterDetailTableByItem(data.pastSeasonDetail)} 
                dimensionTab={dimensionTab}
                sortConfig={sortConfig}
                onSort={handleSort}
                targetMonth={targetMonth}
              />
            </div>

            {/* 메타 정보 */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500">
              <div className="flex flex-wrap gap-4">
                <span>기준월: {formatMonth(data.meta.targetMonth)}</span>
                <span>브랜드: {brand}</span>
                <span>분석단위: {data.meta.dimensionTab}</span>
                <span>정체기준: {data.meta.thresholdPct}%</span>
                <span>당해연도: 20{data.meta.currentYear}</span>
                <span>차기연도: 20{data.meta.nextYear}</span>
              </div>
            </div>
          </>
        )}

        {/* 데이터 없음 */}
        {!loading && !error && !data && targetMonth && (
          <div className="text-center py-12 text-gray-500">
            선택한 조건에 해당하는 데이터가 없습니다.
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

