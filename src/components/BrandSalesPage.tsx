"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Brand, 
  SalesBrandData, 
  InventoryBrandData,
  ItemTab, 
  ChannelTab,
  SalesSummaryData, 
  InventorySummaryData,
  StockWeeksByItem,
  createDefaultStockWeeks,
  ForecastInventorySummaryData,
  ForecastInventoryData,
} from "@/types/sales";
import Navigation from "./Navigation";
import ItemTabs from "./ItemTabs";
import SalesTable from "./SalesTable";
import InventoryTable from "./InventoryTable";
import StockWeeksTable from "./StockWeeksTable";
import StockWeeksSummary from "./StockWeeksSummary";
import StockWeeksChart from "./StockWeeksChart";
import InventoryChart from "./InventoryChart";
import WarningBanner from "./WarningBanner";
import StockWeekInput from "./StockWeekInput";
import CollapsibleSection from "./CollapsibleSection";
import ForecastInventoryTable from "./ForecastInventoryTable";
import { generateForecastForBrand } from "@/lib/forecast";
import { buildInventoryForecastForTab } from "@/lib/inventoryForecast";

interface BrandSalesPageProps {
  brand: Brand;
  title: string;
}

export default function BrandSalesPage({ brand, title }: BrandSalesPageProps) {
  const [selectedTab, setSelectedTab] = useState<ItemTab>("전체");
  const [salesData, setSalesData] = useState<SalesSummaryData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventorySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockWeeks, setStockWeeks] = useState<StockWeeksByItem>(createDefaultStockWeeks());
  const [showAllItemsInChart, setShowAllItemsInChart] = useState(false); // 차트 모두선택 모드
  const [channelTab, setChannelTab] = useState<ChannelTab>("ALL"); // 채널 탭 (ALL, FRS, 창고)
  const [growthRate, setGrowthRate] = useState<number>(105); // 성장률 (기본값 105%)
  const [forecastInventoryData, setForecastInventoryData] = useState<ForecastInventorySummaryData | null>(null);
  
  // 특정 아이템의 stockWeek 변경 핸들러
  const handleStockWeekChange = (itemTab: ItemTab, value: number) => {
    setStockWeeks(prev => ({
      ...prev,
      [itemTab]: value
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const salesResponse = await fetch("/data/accessory_sales_summary.json");
        if (!salesResponse.ok) {
          throw new Error("판매 데이터를 불러오는데 실패했습니다.");
        }
        const salesJson: SalesSummaryData = await salesResponse.json();
        setSalesData(salesJson);

        const inventoryResponse = await fetch("/data/accessory_inventory_summary.json");
        if (!inventoryResponse.ok) {
          throw new Error("재고 데이터를 불러오는데 실패했습니다.");
        }
        const inventoryJson: InventorySummaryData = await inventoryResponse.json();
        setInventoryData(inventoryJson);

        // 입고예정 재고자산 데이터 로드 (실적 데이터와 동일하게 JSON 파일에서 읽기)
        try {
          const forecastResponse = await fetch("/data/accessory_forecast_inventory_summary.json");
          if (forecastResponse.ok) {
            const forecastJson: ForecastInventorySummaryData = await forecastResponse.json();
            setForecastInventoryData(forecastJson);
          } else {
            console.warn("입고예정 재고자산 데이터를 불러오는데 실패했습니다.");
          }
        } catch (e) {
          console.warn("입고예정 재고자산 데이터 로드 중 오류:", e);
        }

        if (salesJson.unexpectedCategories?.length > 0) {
          console.warn(
            "⚠ 판매 데이터 - 제품중분류에 예상치 못한 값이 포함되어 있습니다:",
            salesJson.unexpectedCategories
          );
        }
        if (inventoryJson.unexpectedCategories?.length > 0) {
          console.warn(
            "⚠ 재고 데이터 - 제품중분류에 예상치 못한 값이 포함되어 있습니다:",
            inventoryJson.unexpectedCategories
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 원본 브랜드 데이터
  const originalSalesBrandData: SalesBrandData | undefined = salesData?.brands[brand];
  
  // Forecast가 포함된 브랜드 데이터
  const salesBrandData: SalesBrandData | undefined = useMemo(() => {
    if (!originalSalesBrandData) return undefined;
    return generateForecastForBrand(originalSalesBrandData, growthRate);
  }, [originalSalesBrandData, growthRate]);

  const salesTabData = salesBrandData?.[selectedTab];

  const inventoryBrandData: InventoryBrandData | undefined = inventoryData?.brands[brand];
  const inventoryTabData = inventoryBrandData?.[selectedTab];

  const forecastInventoryBrandData: ForecastInventoryData | undefined =
    forecastInventoryData?.brands[brand];
  const forecastInventoryMonths: string[] = forecastInventoryData?.months || [];

  const allUnexpectedCategories = [
    ...(salesData?.unexpectedCategories || []),
    ...(inventoryData?.unexpectedCategories || [])
  ].filter((v, i, a) => a.indexOf(v) === i);

  // 재고자산 표용: 25.10까지 Actual + 25.11~26.04 Forecast 재고자산
  const {
    months: inventoryMonthsWithForecast,
    data: inventoryTabDataWithForecast,
  } = useMemo(() => {
    if (
      !inventoryData?.months ||
      !inventoryBrandData ||
      !salesBrandData
    ) {
      return {
        months: inventoryData?.months || [],
        data: inventoryTabData || {},
      };
    }

    return buildInventoryForecastForTab({
      itemTab: selectedTab,
      inventoryBrandData,
      inventoryMonths: inventoryData.months,
      salesBrandDataWithForecast: salesBrandData,
      forecastInventoryBrandData,
    });
  }, [
    selectedTab,
    inventoryBrandData,
    inventoryData?.months,
    salesBrandData,
    forecastInventoryBrandData,
    inventoryTabData,
  ]);

  // 재고자산/재고자산 차트용: 선택된 탭에는 forecast 재고를 반영
  const inventoryBrandDataForChart: InventoryBrandData | undefined = useMemo(() => {
    if (!inventoryBrandData) return undefined;
    return {
      ...inventoryBrandData,
      [selectedTab]: inventoryTabDataWithForecast,
    };
  }, [inventoryBrandData, inventoryTabDataWithForecast, selectedTab]);

  // months 배열에 forecast 월 추가
  const allMonths = useMemo(() => {
    if (!salesData?.months) return [];
    const monthsSet = new Set(salesData.months);
    
    // Forecast 월 추가
    if (salesBrandData) {
      Object.values(salesBrandData).forEach((itemData) => {
        Object.keys(itemData).forEach((month) => {
          if (itemData[month]?.isForecast) {
            monthsSet.add(month);
          }
        });
      });
    }
    
    // 월 정렬 (YYYY.MM 형식 기준)
    return Array.from(monthsSet).sort((a, b) => {
      const [yearA, monthA] = a.split(".").map(Number);
      const [yearB, monthB] = b.split(".").map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
  }, [salesData?.months, salesBrandData]);

  return (
    <>
      <Navigation />
      <main className="max-w-[1800px] mx-auto px-6 py-6">
        {/* 예상치 못한 중분류 경고 */}
        {allUnexpectedCategories.length > 0 && (
          <WarningBanner categories={allUnexpectedCategories} />
        )}

        {/* 로딩/에러 */}
        {loading ? (
          <div className="card">
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500">데이터 로딩 중...</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="card">
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-red-500 mb-2">❌ {error}</p>
                <p className="text-gray-500 text-sm">
                  전처리 스크립트를 먼저 실행해주세요: python scripts/preprocess_sales.py
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 0. 재고주수 Summary 섹션 */}
            {inventoryBrandData && salesBrandData && inventoryData?.daysInMonth && (
              <StockWeeksSummary
                brand={brand}
                inventoryBrandData={inventoryBrandData}
                salesBrandData={salesBrandData}
                daysInMonth={inventoryData.daysInMonth}
                stockWeeks={stockWeeks}
                onStockWeekChange={handleStockWeekChange}
              />
            )}

            {/* 1. 아이템 탭 + 차트 모두선택 */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <ItemTabs 
                selectedTab={selectedTab} 
                onTabChange={setSelectedTab} 
                brand={brand}
                showAllItems={showAllItemsInChart}
                setShowAllItems={setShowAllItemsInChart}
              />
            </div>

            {/* 1.5. 월별 재고주수 추이 차트 */}
            {salesTabData && inventoryTabDataWithForecast && inventoryData?.daysInMonth && (
              <StockWeeksChart
                selectedTab={selectedTab}
                // 25.11~26.04 forecast 재고주수까지 포함
                inventoryData={inventoryTabDataWithForecast}
                salesData={salesTabData}
                daysInMonth={inventoryData.daysInMonth}
                stockWeek={stockWeeks[selectedTab]}
                showAllItems={showAllItemsInChart}
                allInventoryData={inventoryBrandData}
                allSalesData={salesBrandData}
                channelTab={channelTab}
              />
            )}

            {/* 1.6. 월별 재고자산 추이 막대차트 */}
            {inventoryBrandDataForChart && salesBrandData && (
              <InventoryChart
                selectedTab={selectedTab}
                // 선택 탭에는 forecast 재고자산(25.11~26.04) 포함
                inventoryBrandData={inventoryBrandDataForChart}
                salesBrandData={salesBrandData}
                channelTab={channelTab}
                setChannelTab={setChannelTab}
              />
            )}

            {/* 2. 2025년 재고주수 표 */}
            {salesTabData && inventoryTabData && inventoryData?.daysInMonth && (
              <div className="card mb-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-yellow-500">📅</span>
                  2025년 재고주수
                </h2>
                <StockWeeksTable
                  inventoryData={inventoryTabDataWithForecast}
                  salesData={salesTabData}
                  daysInMonth={inventoryData.daysInMonth}
                  stockWeek={stockWeeks[selectedTab]}
                  year="2025"
                />

                {/* 재고주수 계산식 범례 */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-xs font-medium text-yellow-600 mb-2">📅 재고주수 계산식</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-2">
                      <div>
                        <span className="text-gray-600">1. 전체주수 = 전체재고 ÷ (전체판매 ÷ 일수 × 7)</span>
                      </div>
                      <div>
                        <span className="text-gray-600">2. 대리상주수 = 대리상재고 ÷ (대리상판매 ÷ 일수 × 7)</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-600 space-y-1">
                        <div>3. 창고재고주수(전체)=창고재고(전체) ÷ [(주력 대리상판매 + 주력 직영판매 + 아울렛 직영판매) ÷ 일수 × 7]</div>
                        <div className="pl-2">ㄴ 주력 재고주수=창고 주력재고 ÷ [(주력 대리상판매 + 주력 직영판매) ÷ 일수 × 7)]</div>
                        <div className="pl-2">ㄴ 아울렛 재고주수 = 창고 아울렛재고 ÷ (아울렛상품 직영판매 ÷ 일수 × 7)</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-300">
                    <div className="grid md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-gray-500 font-medium">주력상품 분류 기준:</span>{" "}
                        <span className="text-gray-600">INTRO/FOCUS 또는 24FW~26SS 시즌</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-medium">아울렛 상품 분류 기준:</span>{" "}
                        <span className="text-gray-600">OUTLET/CARE/DONE 또는 미지정에서 24FW이전시즌</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. 2024년 재고주수 표 */}
            {salesTabData && inventoryTabData && inventoryData?.daysInMonth && (
              <div className="card mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-yellow-500">📅</span>
                  2024년 재고주수
                </h2>
                <StockWeeksTable
                  inventoryData={inventoryTabData}
                  salesData={salesTabData}
                  daysInMonth={inventoryData.daysInMonth}
                  stockWeek={stockWeeks[selectedTab]}
                  year="2024"
                />
              </div>
            )}

            {/* 4. 판매매출 표 (토글 기능 - 기본 접힘) */}
            <div className="mb-4">
              <CollapsibleSection
                title="판매매출"
                icon="📊"
                iconColor="text-blue-500"
                defaultOpen={false}
                legend={
                  <>
                    <span><span className="text-gray-400">전체판매:</span> FRS + OR</span>
                    <span><span className="text-gray-400">대리상판매:</span> Channel 2 = FRS</span>
                    <span><span className="text-gray-400">직영판매:</span> Channel 2 = OR</span>
                    <span><span className="text-gray-400">금액단위:</span> 1위안</span>
                  </>
                }
                headerAction={
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 whitespace-nowrap">
                      성장률(전년동월 대비, %):
                    </label>
                    <input
                      type="number"
                      value={growthRate}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value > 0) {
                          setGrowthRate(value);
                        }
                      }}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      min="1"
                      step="0.1"
                    />
                  </div>
                }
              >
                {salesTabData && allMonths.length > 0 ? (
                  <SalesTable data={salesTabData} months={allMonths} />
                ) : (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-gray-500">판매 데이터가 없습니다.</p>
                  </div>
                )}
              </CollapsibleSection>
            </div>

            {/* 5. 재고자산 표 (토글 기능 - 기본 접힘) */}
            <div>
              <CollapsibleSection
                title="재고자산"
                icon="📦"
                iconColor="text-green-500"
                defaultOpen={false}
                legend={
                  <>
                    <span><span className="text-gray-400">전체재고:</span> FRS + HQ + OR</span>
                    <span><span className="text-gray-400">본사재고:</span> HQ + OR</span>
                    <span><span className="text-gray-400">직영재고:</span> OR판매 ÷ 일수 × 7 × {stockWeeks[selectedTab]}주</span>
                    <span><span className="text-gray-400">창고재고:</span> 본사재고 - 직영재고</span>
                  </>
                }
              >
                {inventoryTabDataWithForecast &&
                inventoryMonthsWithForecast.length > 0 &&
                inventoryData?.daysInMonth ? (
                  <InventoryTable 
                    data={inventoryTabDataWithForecast} 
                    months={inventoryMonthsWithForecast}
                    daysInMonth={inventoryData.daysInMonth}
                    stockWeek={stockWeeks[selectedTab]}
                  />
                ) : (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-gray-500">재고 데이터가 없습니다.</p>
                  </div>
                )}
              </CollapsibleSection>
            </div>

            {/* 6. 입고예정 재고자산 표 (새로 추가) */}
            <div className="mt-4">
              <CollapsibleSection
                title="입고예정 재고자산"
                icon="📥"
                iconColor="text-purple-500"
                defaultOpen={false}
                legend={
                  <>
                    <span className="text-gray-400">
                      실적 이후 6개월 기준 입고예정 재고자산 (파일 존재 월만 표시)
                    </span>
                    <span className="text-gray-400">금액단위: 1위안</span>
                  </>
                }
              >
                {forecastInventoryBrandData && forecastInventoryMonths.length > 0 ? (
                  <>
                    <div className="mb-3 text-xs text-gray-500">
                      표시 기간:{" "}
                      {forecastInventoryMonths.length > 0
                        ? `${forecastInventoryMonths[0]} ~ ${
                            forecastInventoryMonths[forecastInventoryMonths.length - 1]
                          }`
                        : "데이터 없음"}
                    </div>
                    <ForecastInventoryTable
                      data={forecastInventoryBrandData}
                      months={forecastInventoryMonths}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center py-10">
                    <p className="text-gray-500">입고예정 재고자산 데이터가 없습니다.</p>
                  </div>
                )}
              </CollapsibleSection>
            </div>
          </>
        )}
      </main>
    </>
  );
}
