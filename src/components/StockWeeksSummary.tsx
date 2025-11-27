"use client";

import { useState, useMemo } from "react";
import { 
  Brand, 
  ItemTab, 
  ITEM_TABS,
  InventoryBrandData, 
  SalesBrandData,
  InventoryItemTabData,
  SalesItemTabData 
} from "@/types/sales";
import { cn } from "@/lib/utils";

interface StockWeeksSummaryProps {
  brand: Brand;
  inventoryBrandData: InventoryBrandData;
  salesBrandData: SalesBrandData;
  daysInMonth: { [month: string]: number };
  stockWeek: number;
}

// 아이템 탭 라벨 및 아이콘
const ITEM_TAB_INFO: Record<ItemTab, { icon: string; label: string }> = {
  전체: { icon: "📊", label: "전체" },
  Shoes: { icon: "👟", label: "신발" },
  Headwear: { icon: "🧢", label: "모자" },
  Bag: { icon: "👜", label: "가방" },
  Acc_etc: { icon: "⭐", label: "기타" },
};

// 브랜드별 "전체" 박스 연한 배경색
const BRAND_LIGHT_COLORS: Record<Brand, string> = {
  "MLB": "#F5F7FB",        // 더 밝은 네이비
  "MLB KIDS": "#FFFDF7",   // 더 밝은 노랑
  "DISCOVERY": "#F5FDF9",  // 더 밝은 초록
};

// Summary 행 정의 (새 구조: 전체 → 주력/아울렛 → 대리상/창고)
const SUMMARY_ROWS = [
  { label: "전체주수", level: 0, type: "total" },           // 헤더 level 0
  { label: "ㄴ 주력상품", level: 1, type: "total_core" },   // 헤더 level 1
  { label: "- 대리상", level: 2, type: "frs_core" },        // 상세 level 2
  { label: "- 창고", level: 2, type: "warehouse_core" },    // 상세 level 2
  { label: "ㄴ 아울렛상품", level: 1, type: "total_outlet" }, // 헤더 level 1
  { label: "- 대리상", level: 2, type: "frs_outlet" },      // 상세 level 2
  { label: "- 창고", level: 2, type: "warehouse_outlet" },  // 상세 level 2
];

// 2025년 월 옵션
const MONTHS_2025 = Array.from({ length: 12 }, (_, i) => ({
  value: `2025.${String(i + 1).padStart(2, "0")}`,
  label: `${i + 1}월`,
}));

export default function StockWeeksSummary({
  brand,
  inventoryBrandData,
  salesBrandData,
  daysInMonth,
  stockWeek,
}: StockWeeksSummaryProps) {
  // 가장 최근 데이터가 있는 월 찾기
  const getLatestMonth = (): string => {
    const allData = inventoryBrandData["전체"];
    for (let i = 11; i >= 0; i--) {
      const month = `2025.${String(i + 1).padStart(2, "0")}`;
      if (allData[month]) {
        return month;
      }
    }
    return "2025.10"; // 기본값
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getLatestMonth());

  // 주수 계산 함수
  const calculateWeeks = (inventory: number, sales: number, days: number): number => {
    if (sales === 0 || days === 0) return 0;
    const dailySales = sales / days;
    const weeklySales = dailySales * 7;
    if (weeklySales === 0) return 0;
    return inventory / weeklySales;
  };

  // 직영재고 계산 함수
  const calculateRetailStock = (orSales: number, days: number): number => {
    if (days === 0) return 0;
    return (orSales / days) * 7 * stockWeek;
  };

  // 특정 아이템, 월, 행 타입에 대한 데이터 계산
  const getRowData = (
    itemTab: ItemTab,
    month: string,
    rowType: string
  ): { weeks: number; inventory: number } => {
    const invData = inventoryBrandData[itemTab]?.[month];
    const slsData = salesBrandData[itemTab]?.[month];
    const days = daysInMonth[month] || 30;

    if (!invData || !slsData) {
      return { weeks: 0, inventory: 0 };
    }

    const totalStockCore = invData.전체_core || 0;
    const totalStockOutlet = invData.전체_outlet || 0;
    const frsStockCore = invData.FRS_core || 0;
    const frsStockOutlet = invData.FRS_outlet || 0;
    const hqOrStockCore = invData.HQ_OR_core || 0;
    const hqOrStockOutlet = invData.HQ_OR_outlet || 0;

    const orSalesCore = invData.OR_sales_core || 0;
    const orSalesOutlet = invData.OR_sales_outlet || 0;

    const retailStockCore = calculateRetailStock(orSalesCore, days) / 1_000_000;
    const retailStockOutlet = calculateRetailStock(orSalesOutlet, days) / 1_000_000;

    const warehouseStockCore = hqOrStockCore - retailStockCore;
    const warehouseStockOutlet = hqOrStockOutlet - retailStockOutlet;

    const totalSalesCore = slsData.전체_core || 0;
    const totalSalesOutlet = slsData.전체_outlet || 0;
    const frsSalesCore = slsData.FRS_core || 0;
    const frsSalesOutlet = slsData.FRS_outlet || 0;

    let weeks = 0;
    let inventory = 0;

    switch (rowType) {
      case "total":
        weeks = calculateWeeks(totalStockCore + totalStockOutlet, totalSalesCore + totalSalesOutlet, days);
        inventory = totalStockCore + totalStockOutlet;
        break;
      case "total_core":
        weeks = calculateWeeks(totalStockCore, totalSalesCore, days);
        inventory = totalStockCore;
        break;
      case "total_outlet":
        weeks = calculateWeeks(totalStockOutlet, totalSalesOutlet, days);
        inventory = totalStockOutlet;
        break;
      case "frs":
        weeks = calculateWeeks(frsStockCore + frsStockOutlet, frsSalesCore + frsSalesOutlet, days);
        inventory = frsStockCore + frsStockOutlet;
        break;
      case "frs_core":
        weeks = calculateWeeks(frsStockCore, frsSalesCore, days);
        inventory = frsStockCore;
        break;
      case "frs_outlet":
        weeks = calculateWeeks(frsStockOutlet, frsSalesOutlet, days);
        inventory = frsStockOutlet;
        break;
      case "warehouse":
        weeks = calculateWeeks(warehouseStockCore + warehouseStockOutlet, totalSalesCore + totalSalesOutlet, days);
        inventory = warehouseStockCore + warehouseStockOutlet;
        break;
      case "warehouse_core":
        weeks = calculateWeeks(warehouseStockCore, totalSalesCore, days);
        inventory = warehouseStockCore;
        break;
      case "warehouse_outlet":
        weeks = calculateWeeks(warehouseStockOutlet, totalSalesOutlet, days);
        inventory = warehouseStockOutlet;
        break;
    }

    return { weeks, inventory };
  };

  // YOY 증감 포맷팅
  const formatWeeksDiff = (diff: number): { text: string; color: string } => {
    if (diff === 0) return { text: "-", color: "text-gray-500" };
    if (diff > 0) {
      return { text: `+${diff.toFixed(1)}주`, color: "text-red-500" };
    }
    return { text: `△${Math.abs(diff).toFixed(1)}주`, color: "text-blue-500" };
  };

  const formatInventoryYOY = (current: number, previous: number): { text: string; color: string } => {
    if (previous === 0) return { text: "-", color: "text-gray-500" };
    const yoy = (current / previous) * 100;
    if (yoy === 100) return { text: "100%", color: "text-gray-500" };
    if (yoy > 100) {
      return { text: `${yoy.toFixed(0)}%`, color: "text-red-500" };
    }
    return { text: `${yoy.toFixed(0)}%`, color: "text-blue-500" };
  };

  // 전년 동월 계산
  const getPreviousYearMonth = (month: string): string => {
    return month.replace("2025", "2024");
  };

  // 천단위 콤마 포맷
  const formatWithComma = (num: number): string => {
    return Math.round(num).toLocaleString();
  };

  // 카드 렌더링
  const renderCard = (itemTab: ItemTab) => {
    const info = ITEM_TAB_INFO[itemTab];
    const prevMonth = getPreviousYearMonth(selectedMonth);
    
    // "전체" 박스는 브랜드별 연한 배경색 적용
    const isAllTab = itemTab === "전체";
    const cardBgColor = isAllTab ? BRAND_LIGHT_COLORS[brand] : "#ffffff";

    return (
      <div
        key={itemTab}
        className="border border-gray-200 rounded-xl shadow-sm overflow-hidden"
        style={{ backgroundColor: cardBgColor }}
      >
        {/* 카드 헤더 */}
        <div 
          className="px-3 py-2 border-b border-gray-200"
          style={{ backgroundColor: isAllTab ? 'rgba(0,0,0,0.05)' : '#f9fafb' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base">{info.icon}</span>
            <span className="font-semibold text-gray-800 text-sm">{info.label}</span>
          </div>
        </div>

        {/* 테이블 */}
        <div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-1.5 py-1 text-left font-medium">구분</th>
                <th className="px-1.5 py-1 text-right font-medium">당년주수</th>
                <th className="px-1.5 py-1 text-right font-medium">전년비</th>
                <th className="px-1.5 py-1 text-right font-medium">당년재고</th>
                <th className="px-1.5 py-1 text-right font-medium">YOY</th>
              </tr>
            </thead>
            <tbody>
              {SUMMARY_ROWS.map((row, idx) => {
                const currentData = getRowData(itemTab, selectedMonth, row.type);
                const prevData = getRowData(itemTab, prevMonth, row.type);
                
                const weeksDiff = currentData.weeks - prevData.weeks;
                const weeksDiffFormatted = formatWeeksDiff(weeksDiff);
                const inventoryYOY = formatInventoryYOY(currentData.inventory, prevData.inventory);

                // level 0, 1은 헤더 스타일 (회색 배경 + 구분선)
                const isHeader = row.level === 0 || row.level === 1;
                // 들여쓰기: level 1 = pl-2, level 2 = pl-4
                const paddingClass = row.level === 0 ? "" : row.level === 1 ? "pl-2" : "pl-4";

                return (
                  <tr
                    key={idx}
                    className={cn(
                      isHeader && "border-b border-gray-300"
                    )}
                    style={isHeader ? { backgroundColor: '#f3f4f6' } : undefined}
                  >
                    <td
                      className={cn(
                        "px-1.5 py-1 text-left whitespace-nowrap",
                        isHeader ? "font-semibold text-gray-800" : "text-gray-600",
                        paddingClass
                      )}
                    >
                      {row.label}
                    </td>
                    <td className="px-1.5 py-1 text-right font-medium text-gray-800 whitespace-nowrap">
                      {currentData.weeks === 0 ? "-" : `${currentData.weeks.toFixed(1)}주`}
                    </td>
                    <td className={cn("px-1.5 py-1 text-right font-medium whitespace-nowrap", weeksDiffFormatted.color)}>
                      {weeksDiffFormatted.text}
                    </td>
                    <td className="px-1.5 py-1 text-right text-gray-500 whitespace-nowrap">
                      {currentData.inventory === 0 ? "-" : `${formatWithComma(currentData.inventory)}M`}
                    </td>
                    <td className={cn("px-1.5 py-1 text-right font-medium whitespace-nowrap", inventoryYOY.color)}>
                      {inventoryYOY.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="card mb-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-blue-500">📋</span>
          {brand} 아이템별 재고 SUMMARY
        </h2>
        
        {/* 월 선택 드롭다운 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">기준 월:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {MONTHS_2025.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {ITEM_TABS.map((tab) => renderCard(tab))}
      </div>

      {/* 범례 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
          <span className="font-medium">YOY 증감:</span>
          <div className="flex items-center gap-1">
            <span className="text-red-500 font-medium">빨간색</span>
            <span>= 증가 (전년 대비 ↑)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-blue-500 font-medium">파란색</span>
            <span>= 감소 (전년 대비 ↓)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

