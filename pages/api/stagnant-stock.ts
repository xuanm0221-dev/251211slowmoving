import type { NextApiRequest, NextApiResponse } from "next";
import { runQuery } from "../../lib/snowflake";
import type {
  StagnantStockResponse,
  StagnantStockItem,
  CategorySummary,
  SummaryBoxData,
  DetailTableData,
  DimensionTab,
  MidCategory,
  StockStatus,
  SeasonGroup,
} from "../../src/types/stagnantStock";

// 단위 탭별 KEY 컬럼 매핑 (판매: s, 재고: a 테이블 alias 사용)
const DIMENSION_KEY_MAP: Record<DimensionTab, { salesKey: string; stockKey: string }> = {
  "스타일": {
    salesKey: "s.prdt_cd",
    stockKey: "a.prdt_cd",
  },
  "컬러": {
    salesKey: "s.prdt_cd || '_' || s.color_cd",
    stockKey: "a.prdt_cd || '_' || a.color_cd",
  },
  "사이즈": {
    salesKey: "s.prdt_cd || '_' || s.size_cd",
    stockKey: "a.prdt_cd || '_' || a.size_cd",
  },
  "컬러&사이즈": {
    salesKey: "s.prdt_scs_cd",
    stockKey: "a.prdt_scs_cd",
  },
};

// 현재 연도 기준으로 당해/차기 연도 계산
function getYearConfig(): { currentYear: string; nextYear: string } {
  const now = new Date();
  const year = now.getFullYear();
  return {
    currentYear: String(year).slice(-2), // "25"
    nextYear: String(year + 1).slice(-2), // "26"
  };
}

// 시즌 그룹 결정
function getSeasonGroup(status: StockStatus, season: string, currentYear: string, nextYear: string): SeasonGroup {
  if (status === "정체재고") return "정체재고";
  if (season && season.startsWith(currentYear)) return "당시즌";
  if (season && season.startsWith(nextYear)) return "차기시즌";
  return "과시즌";
}

// 사용 가능한 월 목록 조회 쿼리
function buildAvailableMonthsQuery(brand: string): string {
  return `
    SELECT DISTINCT TO_CHAR(sale_dt, 'YYYYMM') AS sale_ym
    FROM fnf.chn.dw_sale s
    LEFT JOIN fnf.sap_fnf.mst_prdt p ON s.prdt_cd = p.prdt_cd
    WHERE s.brd_cd = '${brand}'
      AND p.prdt_hrrc1_nm = 'ACC'
      AND sale_dt >= '2024-01-01'
    ORDER BY sale_ym DESC
  `;
}

// 정체재고 분석 메인 쿼리 생성
function buildStagnantStockQuery(
  brand: string,
  targetMonth: string,
  dimensionTab: DimensionTab,
  thresholdRatio: number
): string {
  const dimConfig = DIMENSION_KEY_MAP[dimensionTab];
  
  return `
    WITH 
    -- 판매 데이터 집계
    sales_agg AS (
      SELECT 
        ${dimConfig.salesKey} AS dimension_key,
        MAX(s.prdt_cd) AS prdt_cd,
        MAX(s.color_cd) AS color_cd,
        MAX(s.size_cd) AS size_cd,
        MAX(p.prdt_nm) AS prdt_nm,
        MAX(SUBSTR(s.prdt_cd, 2, 3)) AS season,
        MAX(CASE
          WHEN p.prdt_hrrc2_nm = 'Shoes' THEN '신발'
          WHEN p.prdt_hrrc2_nm = 'Headwear' THEN '모자'
          WHEN p.prdt_hrrc2_nm = 'Bag' THEN '가방'
          WHEN p.prdt_hrrc2_nm = 'Acc_etc' THEN '기타'
          ELSE p.prdt_hrrc2_nm
        END) AS mid_category_kr,
        SUM(s.tag_amt) AS sales_tag_amt,
        SUM(s.qty) AS sales_qty
      FROM fnf.chn.dw_sale s
      LEFT JOIN fnf.sap_fnf.mst_prdt p ON s.prdt_cd = p.prdt_cd
      LEFT JOIN fnf.chn.dw_shop_wh_detail d ON s.shop_id = d.oa_map_shop_id
      WHERE TO_CHAR(s.sale_dt, 'YYYYMM') = '${targetMonth}'
        AND s.brd_cd = '${brand}'
        AND p.prdt_hrrc1_nm = 'ACC'
        AND d.fr_or_cls IN ('FR', 'OR')
      GROUP BY ${dimConfig.salesKey}
    ),
    
    -- 재고 데이터 집계
    stock_agg AS (
      SELECT 
        ${dimConfig.stockKey} AS dimension_key,
        MAX(a.prdt_cd) AS prdt_cd,
        MAX(a.color_cd) AS color_cd,
        MAX(a.size_cd) AS size_cd,
        MAX(b.prdt_nm) AS prdt_nm,
        MAX(a.sesn) AS season,
        MAX(CASE
          WHEN b.prdt_hrrc2_nm = 'Shoes' THEN '신발'
          WHEN b.prdt_hrrc2_nm = 'Headwear' THEN '모자'
          WHEN b.prdt_hrrc2_nm = 'Bag' THEN '가방'
          WHEN b.prdt_hrrc2_nm = 'Acc_etc' THEN '기타'
          ELSE b.prdt_hrrc2_nm
        END) AS mid_category_kr,
        SUM(a.stock_tag_amt_expected) AS stock_amt,
        SUM(a.stock_qty_expected) AS stock_qty
      FROM fnf.chn.dw_stock_m a
      LEFT JOIN fnf.sap_fnf.mst_prdt b ON a.prdt_cd = b.prdt_cd
      LEFT JOIN fnf.chn.dw_shop_wh_detail c ON a.shop_id = c.oa_map_shop_id
      WHERE a.yymm = '${targetMonth}'
        AND a.brd_cd = '${brand}'
        AND b.prdt_hrrc1_nm = 'ACC'
      GROUP BY ${dimConfig.stockKey}
    ),
    
    -- 중분류별 재고 합계 (정체재고 분모)
    mid_category_totals AS (
      SELECT 
        mid_category_kr,
        SUM(stock_amt) AS stock_amt_total_mid
      FROM stock_agg
      WHERE mid_category_kr IN ('신발', '모자', '가방', '기타')
      GROUP BY mid_category_kr
    ),
    
    -- 판매와 재고 JOIN
    combined AS (
      SELECT 
        COALESCE(st.dimension_key, sa.dimension_key) AS dimension_key,
        COALESCE(st.prdt_cd, sa.prdt_cd) AS prdt_cd,
        COALESCE(st.color_cd, sa.color_cd) AS color_cd,
        COALESCE(st.size_cd, sa.size_cd) AS size_cd,
        COALESCE(st.prdt_nm, sa.prdt_nm) AS prdt_nm,
        COALESCE(st.mid_category_kr, sa.mid_category_kr) AS mid_category_kr,
        COALESCE(st.season, sa.season) AS season,
        COALESCE(st.stock_qty, 0) AS stock_qty,
        COALESCE(st.stock_amt, 0) AS stock_amt,
        COALESCE(sa.sales_tag_amt, 0) AS sales_tag_amt,
        mt.stock_amt_total_mid
      FROM stock_agg st
      FULL OUTER JOIN sales_agg sa ON st.dimension_key = sa.dimension_key
      LEFT JOIN mid_category_totals mt ON COALESCE(st.mid_category_kr, sa.mid_category_kr) = mt.mid_category_kr
      WHERE COALESCE(st.stock_amt, 0) > 0
        AND COALESCE(st.mid_category_kr, sa.mid_category_kr) IN ('신발', '모자', '가방', '기타')
    )
    
    -- 최종 결과: 비율 계산 및 상태 구분
    SELECT 
      dimension_key,
      prdt_cd,
      color_cd,
      size_cd,
      prdt_nm,
      mid_category_kr,
      season,
      stock_qty,
      stock_amt,
      sales_tag_amt,
      stock_amt_total_mid,
      CASE 
        WHEN stock_amt_total_mid > 0 THEN sales_tag_amt / stock_amt_total_mid
        ELSE 0
      END AS ratio,
      CASE 
        WHEN stock_amt_total_mid > 0 AND (sales_tag_amt / stock_amt_total_mid) < ${thresholdRatio}
        THEN '정체재고'
        ELSE '정상재고'
      END AS status
    FROM combined
    ORDER BY stock_amt DESC
  `;
}

// 카테고리별 집계 함수
function aggregateByCategory(
  items: StagnantStockItem[],
  totalStockAmt: number
): CategorySummary[] {
  const categories: MidCategory[] = ["전체", "신발", "모자", "가방", "기타"];
  
  return categories.map(category => {
    const filtered = category === "전체" 
      ? items 
      : items.filter(item => item.mid_category_kr === category);
    
    const stock_amt = filtered.reduce((sum, item) => sum + item.stock_amt, 0);
    const stock_qty = filtered.reduce((sum, item) => sum + item.stock_qty, 0);
    const sales_tag_amt = filtered.reduce((sum, item) => sum + item.sales_tag_amt, 0);
    const item_count = new Set(filtered.map(item => item.dimensionKey)).size;
    
    return {
      category,
      stock_amt,
      stock_amt_pct: totalStockAmt > 0 ? (stock_amt / totalStockAmt) * 100 : 0,
      stock_qty,
      item_count,
      sales_tag_amt,
    };
  });
}

// 요약 박스 생성 함수
function createSummaryBox(
  title: string,
  items: StagnantStockItem[],
  totalStockAmt: number
): SummaryBoxData {
  const categories = aggregateByCategory(items, totalStockAmt);
  const total = categories.find(c => c.category === "전체")!;
  
  return {
    title,
    categories,
    total,
  };
}

// 상세 테이블 생성 함수
function createDetailTable(
  title: string,
  seasonGroup: SeasonGroup,
  items: StagnantStockItem[]
): DetailTableData {
  const filteredItems = items.filter(item => item.seasonGroup === seasonGroup);
  
  return {
    title,
    seasonGroup,
    items: filteredItems.sort((a, b) => b.stock_amt - a.stock_amt),
    totalRow: {
      stock_qty: filteredItems.reduce((sum, item) => sum + item.stock_qty, 0),
      stock_amt: filteredItems.reduce((sum, item) => sum + item.stock_amt, 0),
      sales_tag_amt: filteredItems.reduce((sum, item) => sum + item.sales_tag_amt, 0),
    },
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StagnantStockResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { brand, targetMonth, dimensionTab, thresholdPct } = req.query;

  // 파라미터 검증
  if (!brand || typeof brand !== "string") {
    return res.status(400).json({ error: "brand parameter is required" });
  }
  if (!targetMonth || typeof targetMonth !== "string") {
    return res.status(400).json({ error: "targetMonth parameter is required" });
  }

  const dimTab = (dimensionTab as DimensionTab) || "스타일";
  const threshold = parseFloat(thresholdPct as string) || 0.01;
  const thresholdRatio = threshold / 100; // 0.01% → 0.0001

  const { currentYear, nextYear } = getYearConfig();

  try {
    // 1. 사용 가능한 월 목록 조회
    const monthsQuery = buildAvailableMonthsQuery(brand);
    const monthsResult = await runQuery(monthsQuery);
    const availableMonths = monthsResult.map((row: any) => row.SALE_YM);

    // 2. 정체재고 분석 데이터 조회
    const mainQuery = buildStagnantStockQuery(brand, targetMonth, dimTab, thresholdRatio);
    const mainResult = await runQuery(mainQuery);

    // 3. 결과 변환
    const items: StagnantStockItem[] = mainResult.map((row: any) => {
      const status: StockStatus = row.STATUS === "정체재고" ? "정체재고" : "정상재고";
      const season = row.SEASON || "";
      const seasonGroup = getSeasonGroup(status, season, currentYear, nextYear);

      return {
        dimensionKey: row.DIMENSION_KEY || "",
        prdt_cd: row.PRDT_CD || "",
        prdt_nm: row.PRDT_NM || "",
        color_cd: row.COLOR_CD,
        size_cd: row.SIZE_CD,
        mid_category_kr: row.MID_CATEGORY_KR || "기타",
        season,
        stock_qty: Number(row.STOCK_QTY) || 0,
        stock_amt: Number(row.STOCK_AMT) || 0,
        sales_tag_amt: Number(row.SALES_TAG_AMT) || 0,
        ratio: Number(row.RATIO) || 0,
        status,
        seasonGroup,
      };
    });

    // 4. 전체 재고금액 계산 (요약 박스의 % 계산용)
    const totalStockAmt = items.reduce((sum, item) => sum + item.stock_amt, 0);

    // 5. 정체/정상 재고 분리
    const stagnantItems = items.filter(item => item.status === "정체재고");
    const normalItems = items.filter(item => item.status === "정상재고");

    // 6. 응답 생성
    const response: StagnantStockResponse = {
      availableMonths,
      
      totalSummary: createSummaryBox("전체 재고", items, totalStockAmt),
      stagnantSummary: createSummaryBox("정체재고", stagnantItems, totalStockAmt),
      normalSummary: createSummaryBox("정상재고", normalItems, totalStockAmt),
      
      stagnantDetail: createDetailTable("정체재고 - 전체", "정체재고", items),
      currentSeasonDetail: createDetailTable("당시즌 정상재고", "당시즌", items),
      nextSeasonDetail: createDetailTable("차기시즌 정상재고", "차기시즌", items),
      pastSeasonDetail: createDetailTable("과시즌 정상재고", "과시즌", items),
      
      meta: {
        targetMonth,
        brand,
        dimensionTab: dimTab,
        thresholdPct: threshold,
        currentYear,
        nextYear,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Stagnant stock query error:", error);
    res.status(500).json({ error: String(error) });
  }
}

