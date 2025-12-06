/**
 * 정체재고 분석 데이터 타입 정의
 */

// 단위 탭 타입 (분석 기준 KEY)
export type DimensionTab = "스타일" | "컬러" | "사이즈" | "컬러&사이즈";

// 채널 타입
export type StagnantChannel = "전체" | "FR" | "본사";

// 재고 상태
export type StockStatus = "정체재고" | "정상재고";

// 시즌 구분
export type SeasonGroup = "정체재고" | "당시즌" | "차기시즌" | "과시즌";

// 중분류
export type MidCategory = "전체" | "신발" | "모자" | "가방" | "기타";

// 개별 품번 데이터
export interface StagnantStockItem {
  dimensionKey: string;      // 분석 기준 KEY (탭에 따라 다름)
  prdt_cd: string;           // 품번
  prdt_nm: string;           // 품명
  color_cd?: string;         // 컬러코드
  size_cd?: string;          // 사이즈코드
  mid_category_kr: MidCategory; // 중분류
  season: string;            // 시즌
  stock_qty: number;         // 재고수량
  stock_amt: number;         // 재고금액
  sales_tag_amt: number;     // TAG 매출금액
  ratio: number;             // 비율 (매출/중분류재고)
  status: StockStatus;       // 상태 (정체/정상)
  seasonGroup: SeasonGroup;  // 시즌 그룹
}

// 중분류별 집계 데이터
export interface CategorySummary {
  category: MidCategory;
  stock_amt: number;         // 재고금액
  stock_amt_pct: number;     // 전체재고 대비 %
  stock_qty: number;         // 재고수량
  item_count: number;        // 품번수
  sales_tag_amt: number;     // 매출금액
}

// 요약 박스 데이터
export interface SummaryBoxData {
  title: string;
  categories: CategorySummary[];
  total: CategorySummary;
}

// 상세 테이블 데이터
export interface DetailTableData {
  title: string;
  seasonGroup: SeasonGroup;
  items: StagnantStockItem[];
  totalRow: {
    stock_qty: number;
    stock_amt: number;
    sales_tag_amt: number;
  };
}

// API 응답 데이터
export interface StagnantStockResponse {
  // 사용 가능한 월 목록
  availableMonths: string[];
  
  // 요약 박스 데이터
  totalSummary: SummaryBoxData;      // 전체 재고
  stagnantSummary: SummaryBoxData;   // 정체재고
  normalSummary: SummaryBoxData;     // 정상재고
  
  // 상세 테이블 데이터
  stagnantDetail: DetailTableData;   // 정체재고 - 전체
  currentSeasonDetail: DetailTableData;  // 당시즌 정상재고
  nextSeasonDetail: DetailTableData;     // 차기시즌 정상재고
  pastSeasonDetail: DetailTableData;     // 과시즌 정상재고
  
  // 메타 정보
  meta: {
    targetMonth: string;
    brand: string;
    dimensionTab: DimensionTab;
    thresholdPct: number;
    currentYear: string;  // 당해 연도 (예: "25")
    nextYear: string;     // 차기 연도 (예: "26")
  };
}

// API 요청 파라미터
export interface StagnantStockRequest {
  brand: string;           // M, I, X
  targetMonth: string;     // YYYYMM
  dimensionTab: DimensionTab;
  thresholdPct: number;    // 0.01 (%)
}

// 정렬 설정
export interface SortConfig {
  key: keyof StagnantStockItem;
  direction: "asc" | "desc";
}

// 브랜드 코드 매핑
export const BRAND_CODE_MAP: Record<string, string> = {
  "MLB": "M",
  "MLB KIDS": "I",
  "DISCOVERY": "X",
};

// 단위 탭 목록
export const DIMENSION_TABS: DimensionTab[] = ["스타일", "컬러", "사이즈", "컬러&사이즈"];

// 중분류 목록
export const MID_CATEGORIES: MidCategory[] = ["전체", "신발", "모자", "가방", "기타"];

