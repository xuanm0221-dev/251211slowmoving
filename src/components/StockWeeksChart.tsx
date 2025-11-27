"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { 
  ItemTab, 
  ITEM_TABS,
  ChannelTab,
  InventoryItemTabData, 
  SalesItemTabData,
  InventoryBrandData,
  SalesBrandData,
  InventoryMonthData,
  SalesMonthData,
} from "@/types/sales";

interface StockWeeksChartProps {
  selectedTab: ItemTab;
  inventoryData: InventoryItemTabData;
  salesData: SalesItemTabData;
  daysInMonth: { [month: string]: number };
  stockWeek: number;
  // 모두선택 모드용
  showAllItems: boolean;
  allInventoryData?: InventoryBrandData;
  allSalesData?: SalesBrandData;
  // 채널 탭
  channelTab: ChannelTab;
}

// 아이템별 색상 정의 (주력: 진한색, 아울렛: 연한색)
const ITEM_COLORS: Record<ItemTab, { core: string; outlet: string }> = {
  전체: { core: "#1f2937", outlet: "#9ca3af" },      // 검정 / 연한 검정
  Shoes: { core: "#2563EB", outlet: "#93C5FD" },     // 진한 파랑 / 연한 파랑
  Headwear: { core: "#DC2626", outlet: "#FCA5A5" },  // 진한 빨강 / 연한 빨강
  Bag: { core: "#16A34A", outlet: "#86EFAC" },       // 진한 초록 / 연한 초록
  Acc_etc: { core: "#CA8A04", outlet: "#FDE047" },   // 진한 노랑 / 연한 노랑
};

// 아이템 라벨
const ITEM_LABELS: Record<ItemTab, string> = {
  전체: "전체",
  Shoes: "신발",
  Headwear: "모자",
  Bag: "가방",
  Acc_etc: "기타",
};

// 2025년 월 목록
const MONTHS_2025 = [
  "2025.01", "2025.02", "2025.03", "2025.04", "2025.05", "2025.06",
  "2025.07", "2025.08", "2025.09", "2025.10", "2025.11", "2025.12"
];

// 채널 라벨
const CHANNEL_LABELS: Record<ChannelTab, string> = {
  ALL: "전체",
  FRS: "대리상",
  창고: "창고",
};

export default function StockWeeksChart({
  selectedTab,
  inventoryData,
  salesData,
  daysInMonth,
  stockWeek,
  showAllItems,
  allInventoryData,
  allSalesData,
  channelTab,
}: StockWeeksChartProps) {
  // 주수 계산 함수
  const calculateWeeks = (inventory: number, sales: number, days: number): number | null => {
    if (sales === 0 || days === 0) return null;
    const dailySales = sales / days;
    const weeklySales = dailySales * 7;
    if (weeklySales === 0) return null;
    return inventory / weeklySales;
  };

  // 채널별 재고/판매 데이터 가져오기 (히트맵과 동일한 계산 로직)
  const getChannelData = (
    invData: InventoryMonthData | undefined, 
    slsData: SalesMonthData | undefined,
    days: number
  ) => {
    if (!invData || !slsData) return { stockCore: 0, stockOutlet: 0, salesCore: 0, salesOutlet: 0 };

    // 직영재고 계산 함수 (히트맵과 동일)
    const calculateRetailStock = (orSales: number) => {
      if (days === 0) return 0;
      return (orSales / days) * 7 * stockWeek / 1_000_000; // M 단위로 변환
    };

    switch (channelTab) {
      case "FRS":
        // 대리상: frs_core, frs_outlet 주수 (히트맵과 동일)
        return {
          stockCore: invData.FRS_core || 0,
          stockOutlet: invData.FRS_outlet || 0,
          salesCore: slsData.FRS_core || 0,
          salesOutlet: slsData.FRS_outlet || 0,
        };
      case "창고":
        // 창고: warehouse_core, warehouse_outlet 주수 (히트맵과 동일)
        const retailStockCore = calculateRetailStock(invData.OR_sales_core || 0);
        const retailStockOutlet = calculateRetailStock(invData.OR_sales_outlet || 0);
        const warehouseStockCore = (invData.HQ_OR_core || 0) - retailStockCore;
        const warehouseStockOutlet = (invData.HQ_OR_outlet || 0) - retailStockOutlet;
        return {
          stockCore: Math.max(0, warehouseStockCore),
          stockOutlet: Math.max(0, warehouseStockOutlet),
          // 창고 주수는 전체 판매로 계산
          salesCore: slsData.전체_core || 0,
          salesOutlet: slsData.전체_outlet || 0,
        };
      case "ALL":
      default:
        // 전체: total_core, total_outlet 주수 (히트맵과 동일)
        return {
          stockCore: invData.전체_core || 0,
          stockOutlet: invData.전체_outlet || 0,
          salesCore: slsData.전체_core || 0,
          salesOutlet: slsData.전체_outlet || 0,
        };
    }
  };

  // 단일 아이템 차트 데이터 생성 (채널별)
  const singleItemChartData = useMemo(() => {
    return MONTHS_2025.map((month) => {
      const invData = inventoryData[month];
      const slsData = salesData[month];
      const days = daysInMonth[month];

      if (!invData || !slsData || !days) {
        return {
          month: month.replace("2025.", "") + "월",
          주력상품: null,
          아울렛상품: null,
        };
      }

      const channelData = getChannelData(invData, slsData, days);
      const weeksCore = calculateWeeks(channelData.stockCore, channelData.salesCore, days);
      const weeksOutlet = calculateWeeks(channelData.stockOutlet, channelData.salesOutlet, days);

      return {
        month: month.replace("2025.", "") + "월",
        주력상품: weeksCore !== null ? parseFloat(weeksCore.toFixed(1)) : null,
        아울렛상품: weeksOutlet !== null ? parseFloat(weeksOutlet.toFixed(1)) : null,
      };
    });
  }, [inventoryData, salesData, daysInMonth, channelTab, stockWeek]);

  // 모든 아이템 차트 데이터 생성 (주력/아울렛 따로, 채널별)
  const allItemsChartData = useMemo(() => {
    if (!showAllItems || !allInventoryData || !allSalesData) return [];

    return MONTHS_2025.map((month) => {
      const days = daysInMonth[month];
      const dataPoint: Record<string, string | number | null> = {
        month: month.replace("2025.", "") + "월",
      };

      ITEM_TABS.forEach((itemTab) => {
        const invData = allInventoryData[itemTab]?.[month];
        const slsData = allSalesData[itemTab]?.[month];

        if (!invData || !slsData || !days) {
          dataPoint[`${ITEM_LABELS[itemTab]}_주력`] = null;
          dataPoint[`${ITEM_LABELS[itemTab]}_아울렛`] = null;
          return;
        }

        // 채널별 데이터 가져오기
        const channelData = getChannelData(invData, slsData, days);
        
        // 주력상품
        const weeksCore = calculateWeeks(channelData.stockCore, channelData.salesCore, days);
        dataPoint[`${ITEM_LABELS[itemTab]}_주력`] = weeksCore !== null ? parseFloat(weeksCore.toFixed(1)) : null;

        // 아울렛상품
        const weeksOutlet = calculateWeeks(channelData.stockOutlet, channelData.salesOutlet, days);
        dataPoint[`${ITEM_LABELS[itemTab]}_아울렛`] = weeksOutlet !== null ? parseFloat(weeksOutlet.toFixed(1)) : null;
      });

      return dataPoint;
    });
  }, [showAllItems, allInventoryData, allSalesData, daysInMonth, channelTab, stockWeek]);

  const colors = ITEM_COLORS[selectedTab];
  const itemLabel = ITEM_LABELS[selectedTab];

  const channelLabel = CHANNEL_LABELS[channelTab];

  // 모두선택 모드일 때 렌더링
  if (showAllItems && allInventoryData && allSalesData) {
    return (
      <div className="card mb-4">
        {/* 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-purple-500">📈</span>
            2025년 월별 {channelLabel} 재고주수 추이 (전체 아이템 비교)
          </h2>
        </div>

        {/* 차트 */}
        <div className="w-full h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={allItemsChartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={{ stroke: "#d1d5db" }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickFormatter={(value) => `${value}주`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "white", 
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
                formatter={(value: number) => value !== null ? `${value}주` : "-"}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px" }}
              />
              {ITEM_TABS.flatMap((itemTab) => [
                <Line
                  key={`${itemTab}_core`}
                  type="monotone"
                  dataKey={`${ITEM_LABELS[itemTab]}_주력`}
                  name={`${ITEM_LABELS[itemTab]} 주력`}
                  stroke={ITEM_COLORS[itemTab].core}
                  strokeWidth={3}
                  dot={{ fill: ITEM_COLORS[itemTab].core, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />,
                <Line
                  key={`${itemTab}_outlet`}
                  type="monotone"
                  dataKey={`${ITEM_LABELS[itemTab]}_아울렛`}
                  name={`${ITEM_LABELS[itemTab]} 아울렛`}
                  stroke={ITEM_COLORS[itemTab].outlet}
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ fill: ITEM_COLORS[itemTab].outlet, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ])}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 범례 설명 */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="font-medium">라인 스타일:</span>
            <span>실선 = 주력상품</span>
            <span>점선 = 아울렛상품</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 mt-2">
            <span className="font-medium">아이템별 색상:</span>
            {ITEM_TABS.map((itemTab) => (
              <div key={itemTab} className="flex items-center gap-1">
                <span className="w-4 h-2 rounded" style={{ backgroundColor: ITEM_COLORS[itemTab].core }}></span>
                <span>{ITEM_LABELS[itemTab]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 단일 아이템 모드 렌더링
  return (
    <div className="card mb-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-purple-500">📈</span>
          2025년 월별 {channelLabel} 재고주수 추이 ({itemLabel})
        </h2>
      </div>

      {/* 차트 */}
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={singleItemChartData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
              tickFormatter={(value) => `${value}주`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "white", 
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px"
              }}
              formatter={(value: number) => value !== null ? `${value}주` : "-"}
            />
            <Legend 
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Line
              type="monotone"
              dataKey="주력상품"
              stroke={colors.core}
              strokeWidth={3}
              dot={{ fill: colors.core, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="아울렛상품"
              stroke={colors.outlet}
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ fill: colors.outlet, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 설명 */}
      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
          <span className="font-medium">라인 스타일:</span>
          <div className="flex items-center gap-1">
            <span className="w-6 h-0.5" style={{ backgroundColor: colors.core }}></span>
            <span>주력상품 (실선)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-6 h-0.5 border-dashed border-t-2" style={{ borderColor: colors.outlet }}></span>
            <span>아울렛상품 (점선)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
