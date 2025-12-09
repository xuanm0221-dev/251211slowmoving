"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { 
  ItemTab,
  ChannelTab,
  CHANNEL_TABS,
  InventoryBrandData,
  SalesBrandData,
  InventoryMonthData,
  SalesMonthData,
} from "@/types/sales";
import { cn } from "@/lib/utils";

interface InventoryChartProps {
  selectedTab: ItemTab;
  inventoryBrandData: InventoryBrandData;
  salesBrandData: SalesBrandData;
  channelTab: ChannelTab;
  setChannelTab: (tab: ChannelTab) => void;
}

// 색상 정의 (주력: 진한 계열, 아울렛: 연한 계열)
const COLORS = {
  // 24년 (전년)
  prev_core: "#6B7280",    // 진한 회색
  prev_outlet: "#D1D5DB",  // 연한 회색
  // 25년 (당년)
  curr_core: "#2563EB",    // 진한 파랑
  curr_outlet: "#93C5FD",  // 연한 파랑
  // 예상 구간
  forecast_inventory: "#16A34A",  // 초록색 (재고자산 예상)
  forecast_sales: "#86EFAC",      // 연한 초록색 (판매매출 예상)
  // YOY 라인
  yoy: "#DC2626",          // 빨간색
};

// 아이템 라벨
const ITEM_LABELS: Record<ItemTab, string> = {
  전체: "전체",
  Shoes: "신발",
  Headwear: "모자",
  Bag: "가방",
  Acc_etc: "기타",
};

// 채널 라벨
const CHANNEL_LABELS: Record<ChannelTab, string> = {
  ALL: "전체",
  FRS: "대리상",
  창고: "창고",
};

// 연도 탭 타입
type YearTab = "당년" | "전년";

// 연도 탭 목록
const YEAR_TABS: YearTab[] = ["당년", "전년"];

// ✅ 선택된 탭의 재고/판매에서 실제 존재하는 월 목록을 뽑아서 연도에 따라 필터링
const getMonthsForChart = (
  inventoryBrandData: InventoryBrandData,
  salesBrandData: SalesBrandData,
  selectedTab: ItemTab,
  yearTab: YearTab
): string[] => {
  const invItem = inventoryBrandData[selectedTab] || {};
  const salesItem = salesBrandData[selectedTab] || {};

  const monthSet = new Set<string>([
    ...Object.keys(invItem),
    ...Object.keys(salesItem),
  ]);

  // 연도에 따라 필터링
  const [startMonth, endMonth] = yearTab === "당년" 
    ? ["2025.01", "2026.04"]  // 당년: 2025.01 ~ 2026.04
    : ["2024.01", "2024.12"]; // 전년: 2024.01 ~ 2024.12

  return Array.from(monthSet)
    .filter((m) => m >= startMonth && m <= endMonth)
    .sort((a, b) => {
      const [ya, ma] = a.split(".").map(Number);
      const [yb, mb] = b.split(".").map(Number);
      if (ya !== yb) return ya - yb;
      return ma - mb;
    });
};

// 커스텀 Tooltip 컴포넌트
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    name: string;
    payload: {
      month: string;
      isForecast?: boolean;
      yearLabel: string;  // "25년" 또는 "24년"
      "0_재고자산_주력": number;
      "0_재고자산_아울렛": number;
      "1_판매매출_주력": number;
      "1_판매매출_아울렛": number;
      "0_재고자산_전체"?: number;
      "1_판매매출_전체"?: number;
    };
  }>;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // 데이터 추출
  const data = payload[0]?.payload;
  if (!data) return null;

  const isForecast = data.isForecast || false;
  const yearLabel = data.yearLabel || "25년";

  // 포맷팅
  const formatValue = (value: number) => {
    const roundedValue = Math.round(value / 1_000_000);
    return roundedValue.toLocaleString() + "M";
  };

  // 예상 구간: 전체만 표시
  if (isForecast) {
    const inventoryTotal = data["0_재고자산_전체"] || 0;
    const salesTotal = data["1_판매매출_전체"] || 0;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs shadow-lg">
        <div className="font-bold text-gray-800 mb-2">
          {data.month} (예상)
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: COLORS.forecast_inventory }}
            ></div>
            <span>{yearLabel} 재고자산 전체: {formatValue(inventoryTotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded" 
              style={{ backgroundColor: COLORS.forecast_sales }}
            ></div>
            <span>{yearLabel} 판매매출 전체: {formatValue(salesTotal)}</span>
          </div>
        </div>
      </div>
    );
  }

  // 실적 구간: 주력/아울렛 구분 표시
  const inventoryCore = data["0_재고자산_주력"] || 0;
  const inventoryOutlet = data["0_재고자산_아울렛"] || 0;
  const salesCore = data["1_판매매출_주력"] || 0;
  const salesOutlet = data["1_판매매출_아울렛"] || 0;

  // 비중 계산
  const inventoryTotal = inventoryCore + inventoryOutlet;
  const salesTotal = salesCore + salesOutlet;

  const inventoryCorePercent = inventoryTotal > 0 
    ? ((inventoryCore / inventoryTotal) * 100).toFixed(1) 
    : "0.0";
  const inventoryOutletPercent = inventoryTotal > 0 
    ? ((inventoryOutlet / inventoryTotal) * 100).toFixed(1) 
    : "0.0";
  const salesCorePercent = salesTotal > 0 
    ? ((salesCore / salesTotal) * 100).toFixed(1) 
    : "0.0";
  const salesOutletPercent = salesTotal > 0 
    ? ((salesOutlet / salesTotal) * 100).toFixed(1) 
    : "0.0";

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs shadow-lg">
      <div className="font-bold text-gray-800 mb-2">
        {data.month}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded" 
            style={{ backgroundColor: COLORS.curr_outlet }}
          ></div>
          <span>{yearLabel} 재고자산 아울렛: {formatValue(inventoryOutlet)} ({inventoryOutletPercent}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded" 
            style={{ backgroundColor: COLORS.curr_core }}
          ></div>
          <span>{yearLabel} 재고자산 주력: {formatValue(inventoryCore)} ({inventoryCorePercent}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded" 
            style={{ backgroundColor: COLORS.prev_outlet }}
          ></div>
          <span>{yearLabel} 판매매출 아울렛: {formatValue(salesOutlet)} ({salesOutletPercent}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded" 
            style={{ backgroundColor: COLORS.prev_core }}
          ></div>
          <span>{yearLabel} 판매매출 주력: {formatValue(salesCore)} ({salesCorePercent}%)</span>
        </div>
      </div>
    </div>
  );
};

export default function InventoryChart({
  selectedTab,
  inventoryBrandData,
  salesBrandData,
  channelTab,
  setChannelTab,
}: InventoryChartProps) {
  // 연도 탭 상태 (당년/전년)
  const [yearTab, setYearTab] = useState<YearTab>("당년");

  const months = useMemo(
    () => getMonthsForChart(inventoryBrandData, salesBrandData, selectedTab, yearTab),
    [inventoryBrandData, salesBrandData, selectedTab, yearTab]
  );

  // 채널별 재고 데이터 가져오기
  const getChannelInventory = (
    invData: InventoryMonthData | undefined,
    slsData?: SalesMonthData
  ) => {
    if (!invData) return { core: 0, outlet: 0 };

    // ✅ forecast 월 처리
    if (slsData?.isForecast) {
      if (channelTab === "ALL") {
        // 전체 탭: 예상 구간에서는 전체 필드 사용 (주력/아울렛 구분 없음)
        const totalInventory = invData.전체 !== undefined 
          ? invData.전체 
          : (invData.전체_core || 0) + (invData.전체_outlet || 0);
        return {
          core: Math.round(totalInventory),
          outlet: 0,
        };
      }
      // 대리상/창고 탭: forecast 구간은 막대 없음
      return { core: 0, outlet: 0 };
    }

    // (실적 구간) 채널별 분기
    switch (channelTab) {
      case "FRS":
        return {
          core: Math.round(invData.FRS_core || 0),
          outlet: Math.round(invData.FRS_outlet || 0),
        };
      case "창고":
        // 창고 = 본사재고(HQ_OR)로 표시 (직영재고 제외 전)
        return {
          core: Math.round(invData.HQ_OR_core || 0),
          outlet: Math.round(invData.HQ_OR_outlet || 0),
        };
      case "ALL":
      default:
        return {
          core: Math.round(invData.전체_core || 0),
          outlet: Math.round(invData.전체_outlet || 0),
        };
    }
  };

  // 채널별 판매매출 데이터 가져오기
  const getChannelSales = (slsData: SalesMonthData | undefined) => {
    if (!slsData) return { core: 0, outlet: 0 };

    // ✅ forecast 월 처리
    if (slsData.isForecast) {
      if (channelTab === "ALL") {
        // 전체 탭: 예상 구간에서는 전체 필드 사용 (주력/아울렛 구분 없음)
        const totalSales = slsData.전체 !== undefined 
          ? slsData.전체 
          : (slsData.전체_core || 0) + (slsData.전체_outlet || 0);
        // 예상 구간에서는 주력/아울렛 구분 없으므로 전체를 core에 표시
        return {
          core: Math.round(totalSales),
          outlet: 0,
        };
      }
      // 대리상/창고 탭: forecast 구간은 막대 없음
      return { core: 0, outlet: 0 };
    }

    // (실적 구간) 채널별 분기
    switch (channelTab) {
      case "FRS":
        return {
          core: Math.round(slsData.FRS_core || 0),
          outlet: Math.round(slsData.FRS_outlet || 0),
        };
      case "창고":
        // 창고는 전체 판매로 표시
        return {
          core: Math.round(slsData.전체_core || 0),
          outlet: Math.round(slsData.전체_outlet || 0),
        };
      case "ALL":
      default:
        return {
          core: Math.round(slsData.전체_core || 0),
          outlet: Math.round(slsData.전체_outlet || 0),
        };
    }
  };
  // 차트 데이터 생성 (전년 막대 = 판매매출, 당년 막대 = 재고자산 + forecast)
  const chartData = useMemo(() => {
    // 연도 라벨 (툴팁용)
    const yearLabel = yearTab === "당년" ? "25년" : "24년";

    return months.map((monthYm) => {
      const invData = inventoryBrandData[selectedTab]?.[monthYm];
      const slsData = salesBrandData[selectedTab]?.[monthYm];
      const isForecast = slsData?.isForecast || false;

      // "전년" 역할: 해당 월의 판매매출 (채널별)
      const prev = getChannelSales(slsData);
      // "당년" 역할: 해당 월의 재고자산 (채널별, forecast 포함)
      const curr = getChannelInventory(invData, slsData);

      // 월 레이블을 "25.01", "26.01" 형식으로 변환, 예상 월은 (F) 추가
      const [yearStr, monthStr] = monthYm.split(".");
      const yearShort = yearStr.slice(-2); // "2025" -> "25"
      const monthLabel = isForecast 
        ? `${yearShort}.${monthStr}(F)`
        : `${yearShort}.${monthStr}`;

      // 예상 구간: 전체만 표시 (주력/아울렛 구분 없음)
      if (isForecast && channelTab === "ALL") {
        return {
          month: monthLabel,
          isForecast: true,
          yearLabel,
          "0_재고자산_전체": curr.core,  // 전체 재고자산
          "0_재고자산_주력": 0,
          "0_재고자산_아울렛": 0,
          "1_판매매출_전체": prev.core,  // 전체 판매매출
          "1_판매매출_주력": 0,
          "1_판매매출_아울렛": 0,
        };
      }

      // 실적 구간: 주력/아울렛 구분 표시
      return {
        month: monthLabel,
        isForecast: false,
        yearLabel,
        "0_재고자산_주력": curr.core,      // 재고자산 주력
        "0_재고자산_아울렛": curr.outlet,  // 재고자산 아울렛
        "1_판매매출_주력": prev.core,      // 판매매출 주력
        "1_판매매출_아울렛": prev.outlet,  // 판매매출 아울렛
      };
    });
  }, [months, inventoryBrandData, salesBrandData, selectedTab, channelTab, yearTab]);

  // 재고자산 최대값 계산 (동적 Y축 범위 설정용) - 2024년+2025년 모두 고려하여 동일한 Y축 범위 유지
  const maxInventory = useMemo(() => {
    let max = 0;
    
    // 2024년 + 2025년 모든 월 데이터에서 최대값 계산
    const allMonths = Object.keys(inventoryBrandData[selectedTab] || {}).filter(
      (m) => m >= "2024.01" && m <= "2026.04"
    );
    
    allMonths.forEach((monthYm) => {
      const invData = inventoryBrandData[selectedTab]?.[monthYm];
      const slsData = salesBrandData[selectedTab]?.[monthYm];
      if (invData) {
        const inventory = getChannelInventory(invData, slsData);
        const total = inventory.core + inventory.outlet;
        if (total > max) max = total;
      }
    });
    return Math.max(Math.ceil(max * 1.1), 100);
  }, [inventoryBrandData, salesBrandData, selectedTab, channelTab]);

  // 판매매출 최대값 계산 (동적 Y축 범위 설정용) - 2024년+2025년 모두 고려하여 동일한 Y축 범위 유지
  const maxSales = useMemo(() => {
    let max = 0;
    
    // 2024년 + 2025년 모든 월 데이터에서 최대값 계산
    const allMonths = Object.keys(salesBrandData[selectedTab] || {}).filter(
      (m) => m >= "2024.01" && m <= "2026.04"
    );
    
    allMonths.forEach((monthYm) => {
      const slsData = salesBrandData[selectedTab]?.[monthYm];
      if (slsData) {
        const sales = getChannelSales(slsData);
        const total = sales.core + sales.outlet;
        if (total > max) max = total;
      }
    });
    return Math.max(Math.ceil(max * 1.3), 100);
  }, [salesBrandData, selectedTab, channelTab]);

  const itemLabel = ITEM_LABELS[selectedTab];
  const channelLabel = CHANNEL_LABELS[channelTab];

  // Y축 포맷 (M 단위 숫자, 천단위 콤마, 소수점 없음)
  const formatYAxis = (value: number) => {
    return Math.round(value / 1_000_000).toLocaleString();
  };

  return (
    <div className="card mb-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-green-500">📊</span>
          월별 {channelLabel} 재고자산 추이 ({itemLabel}) - {yearTab === "당년" ? "2025년" : "2024년"}
        </h2>
        
        {/* 채널 탭 (ALL, 대리상, 창고) - 제목 바로 옆 */}
        <div className="flex flex-wrap items-center gap-2">
          {CHANNEL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setChannelTab(tab)}
              className={cn(
                "px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                channelTab === tab
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {CHANNEL_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* 구분선 */}
        <div className="h-8 w-px bg-gray-300"></div>

        {/* 연도 탭 (당년/전년) */}
        <div className="flex flex-wrap items-center gap-2">
          {YEAR_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setYearTab(tab)}
              className={cn(
                "px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                yearTab === tab
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            {/* 왼쪽 Y축: 재고자산 (M) - 2024+2025 동일 범위 */}
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
              tickFormatter={formatYAxis}
              domain={[0, maxInventory]}
              label={{ 
                value: "재고자산 (M)", 
                angle: -90, 
                position: "insideLeft",
                style: { fontSize: 12, fill: "#6b7280" }
              }}
            />
            {/* 오른쪽 Y축: 판매매출 (M) - 동적 범위 (2배로 확대하여 막대기 길이를 반으로) */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "#6B7280" }}
              axisLine={{ stroke: "#6B7280" }}
              tickFormatter={formatYAxis}
              domain={[0, maxSales * 2]}  // Y축 범위를 2배로 확대하여 막대기 길이를 상대적으로 반으로
              label={{ 
                value: "판매매출 (M)", 
                angle: 90, 
                position: "insideRight",
                style: { fontSize: 12, fill: "#6B7280" }
              }}
            />
            <Tooltip 
              content={<CustomTooltip />}
            />
            {/* 예상 구간 막대 (25.12부터) - 전체만 표시, 같은 stackId 사용하여 폭 일관성 유지 */}
            {/* 예상 구간에서는 0_재고자산_전체만 값이 있고 주력/아울렛은 0이므로 같은 stackId 사용해도 전체 막대만 표시됨 */}
            <Bar 
              yAxisId="left"
              dataKey="0_재고자산_전체" 
              stackId="inventory"
              fill={COLORS.forecast_inventory}
              name="25년 재고자산 전체 (예상)"
            />
            <Bar 
              yAxisId="right"
              dataKey="1_판매매출_전체" 
              stackId="sales"
              fill={COLORS.forecast_sales}
              name="25년 판매매출 전체 (예상)"
            />
            {/* 실적 구간 막대 (주력 + 아울렛 스택) */}
            {/* 실적 구간에서는 0_재고자산_주력/아울렛만 값이 있고 전체는 0이므로 주력/아울렛 스택 막대만 표시됨 */}
            <Bar 
              yAxisId="left"
              dataKey="0_재고자산_주력" 
              stackId="inventory" 
              fill={COLORS.curr_core}
              name="25년 재고자산 주력"
            />
            <Bar 
              yAxisId="left"
              dataKey="0_재고자산_아울렛" 
              stackId="inventory" 
              fill={COLORS.curr_outlet}
              name="25년 재고자산 아울렛"
            />
            {/* 25년 판매매출 막대 (주력 + 아울렛 스택) - 나중에 표시, 오른쪽 Y축 사용 */}
            <Bar 
              yAxisId="right"
              dataKey="1_판매매출_주력" 
              stackId="sales" 
              fill={COLORS.prev_core}
              name="25년 판매매출 주력"
            />
            <Bar 
              yAxisId="right"
              dataKey="1_판매매출_아울렛" 
              stackId="sales" 
              fill={COLORS.prev_outlet}
              name="25년 판매매출 아울렛"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 설명 */}
      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-3">
            <span className="font-medium">{yearTab === "당년" ? "25년" : "24년"} 재고자산:</span>
            {yearTab === "당년" && (
              <div className="flex items-center gap-1">
                <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.forecast_inventory }}></span>
                <span>전체 (예상)</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.curr_core }}></span>
              <span>주력</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.curr_outlet }}></span>
              <span>아울렛</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium">{yearTab === "당년" ? "25년" : "24년"} 판매매출:</span>
            {yearTab === "당년" && (
              <div className="flex items-center gap-1">
                <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.forecast_sales }}></span>
                <span>전체 (예상)</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.prev_core }}></span>
              <span>주력</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.prev_outlet }}></span>
              <span>아울렛</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
