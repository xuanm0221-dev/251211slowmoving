/**
 * 재고주수 계산 관련 공통 유틸 함수
 */

import {
  StockWeekWindow,
  InventoryItemTabData,
  SalesItemTabData,
  InventoryMonthData,
  SalesMonthData,
} from "@/types/sales";

// "YYYY.MM"에서 이전 달 구하기 (예: 2025.03 -> 2025.02)
export function getPrevMonth(month: string): string {
  const [yearStr, monthStr] = month.split(".");
  let year = Number(yearStr);
  let m = Number(monthStr);
  if (m === 1) {
    year -= 1;
    m = 12;
  } else {
    m -= 1;
  }
  return `${year}.${String(m).padStart(2, "0")}`;
}

// 기준 월과 윈도우(1/2/3개월)에 따라 포함될 월 리스트 계산 (당월 포함, 과거로만 확장)
export function getWindowMonths(baseMonth: string, window: StockWeekWindow): string[] {
  const months: string[] = [baseMonth];
  let cur = baseMonth;
  for (let i = 1; i < window; i++) {
    cur = getPrevMonth(cur);
    months.push(cur);
  }
  return months;
}

// daysInMonth에 값이 없는 월(26.01~26.04 등)은 캘린더 기준으로 일수 계산
export function getDaysInMonthFromYm(month: string): number {
  const [yearStr, monthStr] = month.split(".");
  const year = Number(yearStr);
  const m = Number(monthStr);
  if (!year || !m) return 30; // 안전한 기본값
  // JS Date: month는 1월=1 기준에서 마지막 날 구하기 위해 (year, m, 0)
  return new Date(year, m, 0).getDate();
}

// 재고주수 계산 함수
export function calculateWeeks(
  inventory: number,
  sales: number,
  days: number
): number | null {
  if (sales === 0 || days === 0) return null;
  const dailySales = sales / days;
  const weeklySales = dailySales * 7;
  if (weeklySales === 0) return null;
  return inventory / weeklySales;
}

// 행 타입별 재고주수 계산 결과
export interface StockWeeksRowResult {
  weeks: number | null; // 주수 (null이면 계산 불가)
  inventory: number; // 재고자산
}

/**
 * 히트맵/Summary용 재고주수 계산 (행 타입별)
 * 히트맵과 Summary에서 동일한 계산 로직 사용
 */
export function computeStockWeeksForRowType(
  month: string,
  rowType: string,
  invData: InventoryMonthData,
  slsData: SalesMonthData,
  inventoryData: InventoryItemTabData,
  salesData: SalesItemTabData,
  daysInMonth: { [month: string]: number },
  stockWeekWindow: StockWeekWindow,
  stockWeek: number // 직영재고 계산용
): StockWeeksRowResult | null {
  if (!invData || !slsData) {
    return null;
  }

  const isForecast = slsData.isForecast;
  const totalStockFromField = invData.전체 !== undefined ? invData.전체 : null;
  
  const totalStockCore = invData.전체_core || 0;
  const totalStockOutlet = invData.전체_outlet || 0;
  const frsStockCore = invData.FRS_core || 0;
  const frsStockOutlet = invData.FRS_outlet || 0;
  const hqOrStockCore = invData.HQ_OR_core || 0;
  const hqOrStockOutlet = invData.HQ_OR_outlet || 0;

  const orSalesCore = invData.OR_sales_core || 0;
  const orSalesOutlet = invData.OR_sales_outlet || 0;

  // 윈도우(1/2/3개월)에 따른 매출/일수 집계
  const windowMonths = getWindowMonths(month, stockWeekWindow);
  
  // 2024년 1월만 특별 처리: 2개월/3개월 선택 시 데이터가 있는 월만 사용
  let monthsToUse = windowMonths;
  if (month === "2024.01" && stockWeekWindow > 1) {
    // 실제 데이터가 있는 월만 필터링
    monthsToUse = windowMonths.filter(m => 
      salesData[m] !== undefined && inventoryData[m] !== undefined
    );
    // 사용 가능한 월이 없으면 해당 월만 사용
    if (monthsToUse.length === 0) {
      monthsToUse = [month];
    }
  }
  
  let totalSalesWindow = 0;        // 전체주수용 전체 매출 (전체 필드 + 없는 경우 core+outlet)
  let totalSalesCoreWindow = 0;    // 주력행용
  let totalSalesOutletWindow = 0;  // 아울렛행용
  let frsSalesCoreWindow = 0;
  let frsSalesOutletWindow = 0;
  let warehouseSalesWindow = 0;
  let orSalesCoreWindow = 0;       // 주력 직영판매 2개월 합계 (창고재고주수 주력용)
  let orSalesOutletWindow = 0;     // 아울렛 직영판매 2개월 합계 (창고재고주수 아울렛용)
  let daysWindow = 0;

  monthsToUse.forEach((m) => {
    const sd = salesData[m];
    const id = inventoryData[m];
    const d = daysInMonth[m] || getDaysInMonthFromYm(m);
    daysWindow += d;
    if (sd) {
      // 전체주수용: forecast 월의 전체 필드까지 포함
      const monthTotal =
        sd.전체 !== undefined
          ? sd.전체
          : (sd.전체_core || 0) + (sd.전체_outlet || 0);

      totalSalesWindow += monthTotal;
      totalSalesCoreWindow += sd.전체_core || 0;
      totalSalesOutletWindow += sd.전체_outlet || 0;
      frsSalesCoreWindow += sd.FRS_core || 0;
      frsSalesOutletWindow += sd.FRS_outlet || 0;
      warehouseSalesWindow +=
        (sd.FRS_core || 0) + (sd.OR_core || 0) + (sd.OR_outlet || 0);
      // 창고재고주수 계산용 직영판매 데이터
      orSalesCoreWindow += sd.OR_core || 0;      // 주력 직영판매
      orSalesOutletWindow += sd.OR_outlet || 0;  // 아울렛 직영판매
    }
  });

  // daysWindow가 0이면 기존 일수 사용 (안전장치)
  const days =
    daysWindow > 0 ? daysWindow : daysInMonth[month] || getDaysInMonthFromYm(month);

  // forecast 월에서는 전체주수(전체/주력/아울렛)만 사용하고
  // 대리상/창고 관련 주수는 계산하지 않음
  if (
    isForecast &&
    rowType !== "total" &&
    rowType !== "total_core" &&
    rowType !== "total_outlet"
  ) {
    return null;
  }

  // 직영재고 계산 (현재 월 기준 - 월별 일수 사용)
  const currentMonthDays = daysInMonth[month] || getDaysInMonthFromYm(month);
  const calculateRetailStock = (orSales: number): number => {
    if (currentMonthDays === 0) return 0;
    return (orSales / currentMonthDays) * 7 * stockWeek;
  };

  const retailStockCore = calculateRetailStock(orSalesCore);
  const retailStockOutlet = calculateRetailStock(orSalesOutlet);

  const warehouseStockCore = hqOrStockCore - retailStockCore;
  const warehouseStockOutlet = hqOrStockOutlet - retailStockOutlet;

  const totalSalesCore = totalSalesCoreWindow;
  const totalSalesOutlet = totalSalesOutletWindow;
  const frsSalesCore = frsSalesCoreWindow;
  const frsSalesOutlet = frsSalesOutletWindow;

  let weeks: number | null = null;
  let inventory: number = 0;

  switch (rowType) {
    case "total":
      // 예상 구간에서는 전체 필드 사용, 실적 구간에서는 core + outlet
      const totalStock = totalStockFromField !== null 
        ? totalStockFromField 
        : totalStockCore + totalStockOutlet;
      const totalSales = totalSalesWindow;
      weeks = calculateWeeks(totalStock, totalSales, days);
      inventory = totalStock;
      break;
    case "total_core":
      // 예상 구간에서는 주력/아울렛 구분 없으므로 null 반환
      if (isForecast) {
        return null;
      }
      weeks = calculateWeeks(totalStockCore, totalSalesCore, days);
      inventory = totalStockCore;
      break;
    case "total_outlet":
      // 예상 구간에서는 주력/아울렛 구분 없으므로 null 반환
      if (isForecast) {
        return null;
      }
      weeks = calculateWeeks(totalStockOutlet, totalSalesOutlet, days);
      inventory = totalStockOutlet;
      break;
    case "frs":
      weeks = calculateWeeks(
        frsStockCore + frsStockOutlet,
        frsSalesCore + frsSalesOutlet,
        days
      );
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
      // 창고재고주수(전체) = 창고재고(전체) ÷ [(주력상품 대리상판매 + 주력상품 직영판매 + 아울렛상품 직영판매) ÷ 일수 × 7]
      const warehouseSales = warehouseSalesWindow;
      weeks = calculateWeeks(
        warehouseStockCore + warehouseStockOutlet,
        warehouseSales,
        days
      );
      inventory = warehouseStockCore + warehouseStockOutlet;
      break;
    case "warehouse_core":
      // 창고 주력재고 ÷ [(주력 대리상판매 + 주력 직영판매) ÷ 일수 × 7]
      const warehouseCoreSales = frsSalesCoreWindow + orSalesCoreWindow;
      weeks = calculateWeeks(warehouseStockCore, warehouseCoreSales, days);
      inventory = warehouseStockCore;
      break;
    case "warehouse_outlet":
      // 창고재고(아울렛) ÷ (직영판매 아울렛 ÷ 일수 × 7)
      weeks = calculateWeeks(warehouseStockOutlet, orSalesOutletWindow, days);
      inventory = warehouseStockOutlet;
      break;
    default:
      return null;
  }

  return { weeks, inventory };
}

// 차트용 주수 데이터 포인트 타입
export interface StockWeeksChartPoint {
  month: string; // "2025.12" 또는 "25.12(F)"
  합계: number | null; // 전체주수
  대리상: number | null; // 대리상주수 (예상 구간에서는 null)
}

// 상품 타입 탭 타입
export type ProductTypeTab = "전체" | "주력" | "아울렛";

/**
 * 차트용 재고주수 데이터 계산 (단일 아이템)
 * 히트맵과 동일한 계산 로직 사용
 */
export function computeStockWeeksForChart(
  months: string[],
  inventoryData: InventoryItemTabData,
  salesData: SalesItemTabData,
  daysInMonth: { [month: string]: number },
  stockWeekWindow: StockWeekWindow,
  productTypeTab: ProductTypeTab = "전체"
): StockWeeksChartPoint[] {
  return months.map((month) => {
    const invData = inventoryData[month];
    const slsData = salesData[month];
    const windowMonths = getWindowMonths(month, stockWeekWindow);
    
    // 윈도우 매출/일수 집계
    let daysWindow = 0;
    let totalSalesWindow = 0;
    let totalSalesCoreWindow = 0;
    let totalSalesOutletWindow = 0;
    let frsSalesCoreWindow = 0;
    let frsSalesOutletWindow = 0;

    windowMonths.forEach((m) => {
      const sd = salesData[m];
      const d = daysInMonth[m] || getDaysInMonthFromYm(m);
      daysWindow += d;
      if (sd) {
        // 전체주수용: forecast 월의 전체 필드까지 포함
        const monthTotal =
          sd.전체 !== undefined
            ? sd.전체
            : (sd.전체_core || 0) + (sd.전체_outlet || 0);

        totalSalesWindow += monthTotal;
        totalSalesCoreWindow += sd.전체_core || 0;
        totalSalesOutletWindow += sd.전체_outlet || 0;
        frsSalesCoreWindow += sd.FRS_core || 0;
        frsSalesOutletWindow += sd.FRS_outlet || 0;
      }
    });

    const days = daysWindow || (daysInMonth[month] || getDaysInMonthFromYm(month));

    // 월 레이블 생성: 25.01 형식, 예상 월은 (F) 추가
    const [yearStr, monthStr] = month.split(".");
    const yearShort = yearStr.slice(-2);
    const isForecast = slsData?.isForecast || false;
    const monthLabel = isForecast 
      ? `${yearShort}.${monthStr}(F)`
      : `${yearShort}.${monthStr}`;

    if (!invData || !slsData || !days) {
      return {
        month: monthLabel,
        합계: null,
        대리상: null,
      };
    }

    let totalStock: number;
    let totalSales: number;
    let frsStock: number;
    let frsSales: number;

    // 상품 타입 탭에 따라 계산
    switch (productTypeTab) {
      case "주력":
        totalStock = invData.전체_core || 0;
        totalSales = totalSalesCoreWindow;
        frsStock = invData.FRS_core || 0;
        frsSales = frsSalesCoreWindow;
        break;
      case "아울렛":
        totalStock = invData.전체_outlet || 0;
        totalSales = totalSalesOutletWindow;
        frsStock = invData.FRS_outlet || 0;
        frsSales = frsSalesOutletWindow;
        break;
      case "전체":
      default:
        // StockWeeksTable의 "전체주수" 계산과 동일:
        // 재고는 해당 월, 매출은 window(1/2/3개월) 합계
        const totalStockFromField = invData.전체 !== undefined ? invData.전체 : null;
        const totalStockCore = invData.전체_core || 0;
        const totalStockOutlet = invData.전체_outlet || 0;
        
        totalStock = totalStockFromField !== null 
          ? totalStockFromField 
          : totalStockCore + totalStockOutlet;
        totalSales = totalSalesWindow;
        
        frsStock = (invData.FRS_core || 0) + (invData.FRS_outlet || 0);
        // 히트맵과 동일: 대리상 매출도 윈도우 합계 사용
        frsSales = frsSalesCoreWindow + frsSalesOutletWindow;
        break;
    }

    // 실선: 합계 기준
    // 예상 구간에서는 주력/아울렛 탭일 때 선 표시하지 않음
    const weeksTotal = (isForecast && (productTypeTab === "주력" || productTypeTab === "아울렛"))
      ? null
      : calculateWeeks(totalStock, totalSales, days);

    // 점선: 대리상 기준
    // 히트맵과 동일: 예상 구간에서는 대리상주수 계산하지 않음
    const weeksFRS = isForecast 
      ? null 
      : calculateWeeks(frsStock, frsSales, days);

    return {
      month: monthLabel,
      합계: weeksTotal !== null ? parseFloat(weeksTotal.toFixed(1)) : null,
      대리상: weeksFRS !== null ? parseFloat(weeksFRS.toFixed(1)) : null,
    };
  });
}

// ========== 목표 재고주수 역산 관련 ==========

/**
 * 타겟월의 목표 재고주수를 달성하기 위한 재고 증감액 계산 결과
 */
export interface TargetInventoryDeltaResult {
  targetInventory: number;      // 목표 재고자산
  deltaInventory: number;       // 증가/감축 필요 금액 (양수: 추가발주 가능, 음수: 발주 줄여야 함)
  currentInventory: number;     // 현재 타겟월 예상 기말재고
  salesPeriod: number;          // 기준 기간 매출
  daysPeriod: number;           // 기준 기간 일수
}

/**
 * 타겟월의 목표 재고주수를 달성하기 위한 재고 증감액 계산
 * 
 * 공식:
 * - 목표 재고자산 = (salesPeriod ÷ daysPeriod × 7) × weeksTarget
 * - deltaInventory = 목표 재고자산 - 현재 예상 기말재고
 * 
 * @param targetMonth 타겟월 (예: "2026.03")
 * @param weeksTarget 목표 재고주수 (예: 40)
 * @param monthBasis 재고주수 기준 (1 | 2 | 3개월)
 * @param projectedSalesByMonth 월별 예상 매출 { 'YYYY.MM': number }
 * @param projectedInventoryByMonth 월별 예상 기말재고 { 'YYYY.MM': number }
 * @param daysInMonth 월별 일수 { 'YYYY.MM': number }
 * @returns TargetInventoryDeltaResult | null
 */
export function computeTargetInventoryDelta({
  targetMonth,
  weeksTarget,
  monthBasis,
  projectedSalesByMonth,
  projectedInventoryByMonth,
  daysInMonth,
}: {
  targetMonth: string;
  weeksTarget: number;
  monthBasis: StockWeekWindow;
  projectedSalesByMonth: { [month: string]: number };
  projectedInventoryByMonth: { [month: string]: number };
  daysInMonth: { [month: string]: number };
}): TargetInventoryDeltaResult | null {
  // monthBasis에 따른 월 리스트 (타겟월 포함, 과거로 확장)
  // 기존 getWindowMonths 함수 재사용
  const monthsToUse = getWindowMonths(targetMonth, monthBasis);

  // sales1, sales2, sales3 및 days1, days2, days3 계산
  let salesPeriod = 0;
  let daysPeriod = 0;

  monthsToUse.forEach((m) => {
    const sales = projectedSalesByMonth[m] || 0;
    const days = daysInMonth[m] || getDaysInMonthFromYm(m);
    salesPeriod += sales;
    daysPeriod += days;
  });

  // 타겟월의 예상 기말재고
  const currentInventory = projectedInventoryByMonth[targetMonth] || 0;

  // 목표 재고자산 계산
  // 목표 재고자산 = (salesPeriod ÷ daysPeriod × 7) × weeksTarget
  if (daysPeriod === 0) {
    return null;
  }

  const dailySales = salesPeriod / daysPeriod;
  const weeklySales = dailySales * 7;
  const targetInventory = weeklySales * weeksTarget;

  // deltaInventory = 목표 재고자산 - 현재 예상 기말재고
  // > 0: 재고 부족 → 추가 발주 가능
  // < 0: 재고 과다 → 발주 줄여야 함
  const deltaInventory = targetInventory - currentInventory;

  return {
    targetInventory: Math.round(targetInventory),
    deltaInventory: Math.round(deltaInventory),
    currentInventory: Math.round(currentInventory),
    salesPeriod: Math.round(salesPeriod),
    daysPeriod,
  };
}

