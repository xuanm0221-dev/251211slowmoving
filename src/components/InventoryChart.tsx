"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
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
  ChannelTab,
  InventoryBrandData,
  InventoryMonthData,
} from "@/types/sales";

interface InventoryChartProps {
  selectedTab: ItemTab;
  inventoryBrandData: InventoryBrandData;
  channelTab: ChannelTab;
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
  channelTab,
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
  // 차트 데이터 생성 (채널별)
  const chartData = useMemo(() => {
    return MONTHS.map((monthNum) => {
      const month2024 = `2024.${monthNum}`;
      const month2025 = `2025.${monthNum}`;
      
      const invData2024 = inventoryBrandData[selectedTab]?.[month2024];
      const invData2025 = inventoryBrandData[selectedTab]?.[month2025];

      // 채널별 데이터 가져오기
      const prev = getChannelInventory(invData2024);
      const curr = getChannelInventory(invData2025);

      // 24년 데이터
      const prev_total = prev.core + prev.outlet;
      
      // 25년 데이터
      const curr_total = curr.core + curr.outlet;

      // YOY 계산 (당년/전년 * 100) - 데이터가 없는 월은 null
      const hasData = invData2024 && invData2025 && prev_total > 0 && curr_total > 0;
      const yoy = hasData ? Math.round((curr_total / prev_total) * 100) : null;

      return {
        month: `${parseInt(monthNum)}월`,
        "24년_주력": prev.core,
        "24년_아울렛": prev.outlet,
        "25년_주력": curr.core,
        "25년_아울렛": curr.outlet,
        "YOY": yoy,
      };
    });
  }, [inventoryBrandData, selectedTab, channelTab]);

  const itemLabel = ITEM_LABELS[selectedTab];
  const channelLabel = CHANNEL_LABELS[channelTab];

  // Y축 포맷 (M 단위 숫자, 천단위 콤마)
  const formatYAxis = (value: number) => {
    return value.toLocaleString();
  };

  return (
    <div className="card mb-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-green-500">📊</span>
          월별 {channelLabel} 재고자산 추이 ({itemLabel}) - 24년 vs 25년
        </h2>
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
            {/* 오른쪽 Y축: YOY (%) */}
            <YAxis 
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "#DC2626" }}
              axisLine={{ stroke: "#DC2626" }}
              tickFormatter={(value) => `${value}%`}
              domain={[50, 150]}
              label={{ 
                value: "YOY (%)", 
                angle: 90, 
                position: "insideRight",
                style: { fontSize: 12, fill: "#DC2626" }
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
                if (name === "YOY") {
                  return value !== null ? [`${value}%`, "YOY"] : ["-", "YOY"];
                }
                const formattedValue = value.toLocaleString() + "M";
                return [formattedValue, name];
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: "12px" }}
            />
            {/* 24년 막대 (주력 + 아울렛 스택) */}
            <Bar 
              yAxisId="left"
              dataKey="24년_주력" 
              stackId="2024" 
              fill={COLORS.prev_core}
              name="24년 주력"
            />
            <Bar 
              yAxisId="left"
              dataKey="24년_아울렛" 
              stackId="2024" 
              fill={COLORS.prev_outlet}
              name="24년 아울렛"
            />
            {/* 25년 막대 (주력 + 아울렛 스택) */}
            <Bar 
              yAxisId="left"
              dataKey="25년_주력" 
              stackId="2025" 
              fill={COLORS.curr_core}
              name="25년 주력"
            />
            <Bar 
              yAxisId="left"
              dataKey="25년_아울렛" 
              stackId="2025" 
              fill={COLORS.curr_outlet}
              name="25년 아울렛"
            />
            {/* YOY 꺾은선 */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="YOY"
              name="YOY"
              stroke={COLORS.yoy}
              strokeWidth={2}
              dot={{ fill: COLORS.yoy, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 설명 */}
      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center gap-6 text-xs text-gray-600">
          <div className="flex items-center gap-3">
            <span className="font-medium">24년:</span>
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
            <span className="font-medium">25년:</span>
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
            <span className="font-medium text-red-600">YOY:</span>
            <div className="flex items-center gap-1">
              <span className="w-4 h-0.5" style={{ backgroundColor: COLORS.yoy }}></span>
              <span className="text-red-600">당년/전년 (%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
