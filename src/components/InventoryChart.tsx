"use client";

import { useMemo } from "react";
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

// 월 목록
const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

// 색상 정의 (주력: 진한 계열, 아울렛: 연한 계열)
const COLORS = {
  // 24년 (전년)
  prev_core: "#6B7280",    // 진한 회색
  prev_outlet: "#D1D5DB",  // 연한 회색
  // 25년 (당년)
  curr_core: "#2563EB",    // 진한 파랑
  curr_outlet: "#93C5FD",  // 연한 파랑
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

export default function InventoryChart({
  selectedTab,
  inventoryBrandData,
  salesBrandData,
  channelTab,
  setChannelTab,
}: InventoryChartProps) {
  // 채널별 재고 데이터 가져오기
  const getChannelInventory = (invData: InventoryMonthData | undefined) => {
    if (!invData) return { core: 0, outlet: 0 };

    // 창고재고 계산용 (직영재고 추정 필요하지만, 여기서는 단순히 본사재고 사용)
    // 실제로는 창고 = 본사(HQ_OR) - 직영(OR판매 기반 추정)이지만
    // 차트에서는 단순화하여 HQ_OR 사용
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
  // 차트 데이터 생성 (24년 막대 = 25년 판매매출, 25년 막대 = 25년 재고자산)
  const chartData = useMemo(() => {
    return MONTHS.map((monthNum) => {
      const month2025 = `2025.${monthNum}`;
      
      const invData2025 = inventoryBrandData[selectedTab]?.[month2025];
      const slsData2025 = salesBrandData[selectedTab]?.[month2025];

      // 24년 막대: 25년 판매매출 (채널별)
      const prev = getChannelSales(slsData2025);
      
      // 25년 막대: 25년 재고자산 (채널별)
      const curr = getChannelInventory(invData2025);

      return {
        month: `${parseInt(monthNum)}월`,
        "0_재고자산_주력": curr.core,  // 25년 재고자산 주력 (먼저 표시) - 숫자 접두사로 순서 보장
        "0_재고자산_아울렛": curr.outlet,  // 25년 재고자산 아울렛
        "1_판매매출_주력": prev.core,  // 25년 판매매출 주력 (나중 표시)
        "1_판매매출_아울렛": prev.outlet,  // 25년 판매매출 아울렛
      };
    });
  }, [inventoryBrandData, salesBrandData, selectedTab, channelTab]);

  // 판매매출 최대값 계산 (동적 Y축 범위 설정용)
  const maxSales = useMemo(() => {
    let max = 0;
    MONTHS.forEach((monthNum) => {
      const month2025 = `2025.${monthNum}`;
      const slsData2025 = salesBrandData[selectedTab]?.[month2025];
      if (slsData2025) {
        const sales = getChannelSales(slsData2025);
        const total = sales.core + sales.outlet;
        if (total > max) max = total;
      }
    });
    // 최대값의 1.3배로 설정 (여유 공간 확보), 최소 100M
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
          월별 {channelLabel} 재고자산 추이 ({itemLabel}) - 24년 vs 25년
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
            {/* 왼쪽 Y축: 재고자산 (M) */}
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#d1d5db" }}
              tickFormatter={formatYAxis}
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
              contentStyle={{ 
                backgroundColor: "white", 
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px"
              }}
              formatter={(value: number, name: string) => {
                const formattedValue = (value / 1_000_000).toLocaleString() + "M";
                return [formattedValue, name];
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: "12px" }}
            />
            {/* 25년 재고자산 막대 (주력 + 아울렛 스택) - 먼저 표시 */}
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
            <span className="font-medium">25년 판매매출:</span>
            <div className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.prev_core }}></span>
              <span>주력</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.prev_outlet }}></span>
              <span>아울렛</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium">25년 재고자산:</span>
            <div className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.curr_core }}></span>
              <span>주력</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-3 rounded" style={{ backgroundColor: COLORS.curr_outlet }}></span>
              <span>아울렛</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
